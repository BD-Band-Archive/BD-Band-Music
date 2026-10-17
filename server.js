const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { neon } = require('@neondatabase/serverless');

// Load environment variables (.env.local prioritized, fallback to .env)
const envPath = path.resolve(__dirname, '.env.local');
const fallbackEnvPath = path.resolve(__dirname, '.env');
const targetEnv = fs.existsSync(envPath) ? envPath : (fs.existsSync(fallbackEnvPath) ? fallbackEnvPath : null);

if (targetEnv) {
  const content = fs.readFileSync(targetEnv, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.substring(0, idx).trim();
      let v = trimmed.substring(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
  }
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.warn('⚠️ WARNING: DATABASE_URL is not set. Neon Postgres features will fail.');
}

const sql = dbUrl ? neon(dbUrl) : null;

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.flac': 'audio/flac',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

// Real-time SSE active subscriber pool
const sseClients = new Set();

// Keep-alive heartbeat ping for active SSE subscribers
setInterval(() => {
  const ping = `data: ${JSON.stringify({ type: 'ping' })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(ping);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}, 25000);

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // Real-time Server-Sent Events (SSE) Stream
  if (pathname === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // --- API Routes ---

  // Health check endpoint
  if (pathname === '/api/health' && req.method === 'GET') {
    if (!sql) {
      return sendJson(res, 500, { status: 'error', error: 'Database not configured' });
    }
    try {
      const dbCheck = await sql`SELECT NOW() as db_time;`;
      return sendJson(res, 200, {
        status: 'ok',
        database: 'connected',
        provider: 'Neon Postgres',
        version: '5.0.2',
        branch: process.env.NEON_BRANCH || 'production',
        dbTime: dbCheck[0].db_time
      });
    } catch (err) {
      return sendJson(res, 500, { status: 'error', error: err.message });
    }
  }

  // Trending tracks & Global plays map
  if (pathname === '/api/trending' && req.method === 'GET') {
    if (!sql) {
      return sendJson(res, 500, { error: 'Database connection unavailable' });
    }
    try {
      const allRows = await sql`
        SELECT track_key, count, last_played_at
        FROM plays
        ORDER BY count DESC, last_played_at DESC;
      `;
      const playsMap = {};
      for (const row of allRows) {
        playsMap[row.track_key] = row.count;
      }
      return sendJson(res, 200, {
        success: true,
        version: '5.0.2',
        trending: allRows.slice(0, 15),
        plays: playsMap,
        total_played_tracks: allRows.length
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Record a track play (Atomic Upsert)
  if (pathname === '/api/play' && req.method === 'POST') {
    if (!sql) {
      return sendJson(res, 500, { error: 'Database connection unavailable' });
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let trackKey = parsedUrl.searchParams.get('track') || '';
      if (!trackKey && body) {
        try {
          const parsed = JSON.parse(body);
          trackKey = parsed.track_key || parsed.track || '';
        } catch (_) {}
      }

      if (!trackKey || typeof trackKey !== 'string') {
        return sendJson(res, 400, { error: 'Missing or invalid track_key' });
      }

      const cleanKey = trackKey.trim().toLowerCase();
      try {
        const result = await sql`
          INSERT INTO plays (track_key, count, last_played_at)
          VALUES (${cleanKey}, 1, NOW())
          ON CONFLICT (track_key)
          DO UPDATE SET count = plays.count + 1, last_played_at = NOW()
          RETURNING track_key, count, last_played_at;
        `;

        const playData = {
          type: 'play',
          track_key: result[0].track_key,
          count: result[0].count,
          last_played_at: result[0].last_played_at
        };

        // Broadcast real-time play increment to all active SSE listeners
        const sseMessage = `data: ${JSON.stringify(playData)}\n\n`;
        for (const client of sseClients) {
          try {
            client.write(sseMessage);
          } catch (_) {
            sseClients.delete(client);
          }
        }

        return sendJson(res, 200, {
          success: true,
          ...playData
        });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  // --- Static File Serving ---
  if (req.method === 'GET' || req.method === 'HEAD') {
    let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }
    const fullPath = path.join(__dirname, safePath);

    fs.stat(fullPath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const headers = {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Access-Control-Allow-Origin': '*'
      };

      if (ext === '.html' || ext === '.json' || ext === '.js') {
        headers['Cache-Control'] = 'no-cache';
      } else {
        headers['Cache-Control'] = 'public, max-age=86400';
      }

      res.writeHead(200, headers);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
    });
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`\n====================================================`);
  console.log(`  BD Band Music App with Neon Postgres Running!`);
  console.log(`  Local URL:   http://localhost:${PORT}`);
  console.log(`  Health API:  http://localhost:${PORT}/api/health`);
  console.log(`  Trending:    http://localhost:${PORT}/api/trending`);
  console.log(`  Neon Branch: ${process.env.NEON_BRANCH || 'production'}`);
  console.log(`====================================================\n`);
});

module.exports = server;
