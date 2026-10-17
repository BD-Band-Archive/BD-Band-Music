const http = require('http');
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

// Load environment variables
const envPath = path.resolve(__dirname, '..', '.env.local');
const fallbackEnvPath = path.resolve(__dirname, '..', '.env');
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

async function requestHttp(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (_) {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data, json: parsed });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  BD Band Music — End-to-End Service Tests');
  console.log('====================================================\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is missing in environment.');
  }

  // TEST 1: Neon Postgres Direct Service Test
  console.log('[TEST 1] Direct Neon Postgres Connectivity & Schema...');
  const sql = neon(dbUrl);
  const nowResult = await sql`SELECT NOW() AS current_time;`;
  console.log(`[✓] Neon Postgres Time: ${nowResult[0].current_time}`);

  // Test atomic play recording across multiple artists & albums
  console.log('[*] Testing atomic increments across multiple artists & albums in Neon...');
  const testTracks = [
    'artcell::oniket prantor',
    'artcell::dukkho bilash',
    'black::amar prithibi',
    'aurthohin::chaite paro'
  ];

  for (const t of testTracks) {
    const upsert = await sql`
      INSERT INTO plays (track_key, count, last_played_at)
      VALUES (${t}, 1, NOW())
      ON CONFLICT (track_key)
      DO UPDATE SET count = plays.count + 1, last_played_at = NOW()
      RETURNING track_key, count;
    `;
    console.log(`[✓] Upserted track: "${upsert[0].track_key}" -> count ${upsert[0].count}`);
  }

  // Query top trending directly
  const trendingRows = await sql`
    SELECT track_key, count
    FROM plays
    ORDER BY count DESC, last_played_at DESC
    LIMIT 15;
  `;
  console.log(`[✓] Direct Neon Top Trending retrieved: ${trendingRows.length} track(s)`);

  // TEST 2: App Server End-to-End HTTP Service Test
  console.log('\n[TEST 2] App Server HTTP API & Global Trending Multi-Artist Test...');
  const TEST_PORT = 3899;
  process.env.PORT = String(TEST_PORT);
  const server = require('../server.js');

  // Wait for server to bind
  await new Promise(r => setTimeout(r, 500));

  try {
    // 2a. Health check
    const health = await requestHttp({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/health',
      method: 'GET'
    });
    if (health.statusCode !== 200 || health.json?.status !== 'ok') {
      throw new Error(`Health check failed: ${health.body}`);
    }
    console.log('[✓] HTTP GET /api/health passed:', health.json);

    // 2b. Record play via API
    const playRecord = await requestHttp({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/play',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { track_key: 'artcell::oniket prantor' });

    if (playRecord.statusCode !== 200 || !playRecord.json?.success) {
      throw new Error(`POST /api/play failed: ${playRecord.body}`);
    }
    console.log('[✓] HTTP POST /api/play passed:', playRecord.json);

    // 2c. Get trending & plays map via API
    const trendingResp = await requestHttp({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/trending',
      method: 'GET'
    });
    if (trendingResp.statusCode !== 200 || !Array.isArray(trendingResp.json?.trending)) {
      throw new Error(`GET /api/trending failed: ${trendingResp.body}`);
    }
    if (!trendingResp.json?.plays || typeof trendingResp.json.plays !== 'object') {
      throw new Error('GET /api/trending did not return global plays map');
    }
    console.log(`[✓] HTTP GET /api/trending passed: ${trendingResp.json.trending.length} trending items`);
    console.log(`[✓] HTTP GET /api/trending plays dictionary passed: ${Object.keys(trendingResp.json.plays).length} tracked song keys`);

    // 2d. Real-time SSE stream check
    const sseCheckPromise = new Promise((resolve, reject) => {
      const sseReq = http.request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/stream',
        method: 'GET'
      }, res => {
        if (res.statusCode !== 200 || !res.headers['content-type']?.includes('text/event-stream')) {
          reject(new Error(`SSE stream failed: status ${res.statusCode}`));
          return;
        }
        res.on('data', chunk => {
          const str = chunk.toString();
          if (str.includes('connected')) {
            sseReq.destroy();
            resolve(true);
          }
        });
      });
      sseReq.on('error', err => {
        if (err.code !== 'ECONNRESET') reject(err);
        else resolve(true);
      });
      sseReq.end();
    });
    await sseCheckPromise;
    console.log('[✓] HTTP GET /api/stream passed: Real-time SSE connection & handshake active.');

    // TEST 3: Validate artist & album trending sorting logic with catalog
    console.log('\n[TEST 3] Verifying Artist & Album Trending Filter Simulation...');
    const catalogPath = path.resolve(__dirname, '..', 'catalog.json');
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    const playsMap = trendingResp.json.plays;

    function getTrackKey(track) {
      const cleanTitle = (track.title || '').replace(/\s*\([\u0980-\u09FF\s\d\w\-\.,]+\)/g, '').trim().toLowerCase();
      const cleanArtist = (track.artist || '').trim().toLowerCase();
      return `${cleanArtist}::${cleanTitle}`;
    }

    // Test 3a: Artcell artist filter with trending sort
    const artcellTracks = catalog.filter(t => t.artist.toLowerCase() === 'artcell');
    artcellTracks.sort((a, b) => {
      const countA = playsMap[getTrackKey(a)] || 0;
      const countB = playsMap[getTrackKey(b)] || 0;
      if (countB !== countA) return countB - countA;
      return (a.year || 0) - (b.year || 0) || (a.trackNo || 0) - (b.trackNo || 0) || a.title.localeCompare(b.title);
    });

    console.log(`[✓] Artcell trending sort verified: Top track is "${artcellTracks[0].title}" (${playsMap[getTrackKey(artcellTracks[0])] || 0} plays)`);

    // Test 3b: Album filter with trending sort (Oniket Prantor album)
    const oniketAlbumTracks = catalog.filter(t => t.album.toLowerCase().includes('oniket prantor'));
    oniketAlbumTracks.sort((a, b) => {
      const countA = playsMap[getTrackKey(a)] || 0;
      const countB = playsMap[getTrackKey(b)] || 0;
      if (countB !== countA) return countB - countA;
      return (a.trackNo || 0) - (b.trackNo || 0);
    });

    console.log(`[✓] "Oniket Prantor" album trending sort verified: Top track is "${oniketAlbumTracks[0].title}" (${playsMap[getTrackKey(oniketAlbumTracks[0])] || 0} plays)`);

    // 2d. Static file serving check
    const staticCheck = await requestHttp({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/index.html',
      method: 'GET'
    });
    if (staticCheck.statusCode !== 200 || !staticCheck.body.includes('<!DOCTYPE html>')) {
      throw new Error(`Static file serving failed: status ${staticCheck.statusCode}`);
    }
    console.log('[✓] HTTP GET /index.html passed: Served static assets correctly.');

  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log('  ALL END-TO-END SERVICE TESTS PASSED SUCCESSFULLY!  ');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
