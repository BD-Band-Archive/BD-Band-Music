import { neon } from '@neondatabase/serverless';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const sql = neon(env.DATABASE_URL);

    // Health check
    if (url.pathname === '/api/health' && request.method === 'GET') {
      try {
        const check = await sql`SELECT NOW() as db_time;`;
        return jsonResponse({
          status: 'ok',
          provider: 'Neon Postgres',
          runtime: 'Cloudflare Worker',
          version: '5.3.13',
          dbTime: check[0].db_time
        });
      } catch (err) {
        return jsonResponse({ status: 'error', error: err.message }, 500);
      }
    }

    // Trending tracks & Global plays map
    if (url.pathname === '/api/trending' && request.method === 'GET') {
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
        return jsonResponse({
          success: true,
          version: '5.3.13',
          trending: allRows.slice(0, 15),
          plays: playsMap,
          total_played_tracks: allRows.length
        });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // Record track play
    if (url.pathname === '/api/play' && request.method === 'POST') {
      try {
        let trackKey = url.searchParams.get('track');
        if (!trackKey) {
          const body = await request.json().catch(() => ({}));
          trackKey = body.track_key || body.track;
        }

        if (!trackKey || typeof trackKey !== 'string') {
          return jsonResponse({ error: 'Missing track_key' }, 400);
        }

        const cleanKey = trackKey.trim().toLowerCase();
        const result = await sql`
          INSERT INTO plays (track_key, count, last_played_at)
          VALUES (${cleanKey}, 1, NOW())
          ON CONFLICT (track_key)
          DO UPDATE SET count = plays.count + 1, last_played_at = NOW()
          RETURNING track_key, count, last_played_at;
        `;

        return jsonResponse({
          success: true,
          track_key: result[0].track_key,
          count: result[0].count,
          last_played_at: result[0].last_played_at
        });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  }
};
