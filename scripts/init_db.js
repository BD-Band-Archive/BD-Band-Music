const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
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

async function testNeon() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not defined in .env.local');
  }

  console.log('[*] Connecting to Neon Postgres at:', dbUrl.split('@')[1]);
  const sql = neon(dbUrl);

  console.log('[*] Creating plays table if not exists...');
  await sql`
    CREATE TABLE IF NOT EXISTS plays (
      track_key VARCHAR(255) PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      last_played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  console.log('[✓] Table "plays" ready.');

  console.log('[*] Testing atomic increment on a test track...');
  const testKey = 'artcell::oniket prantor';
  await sql`
    INSERT INTO plays (track_key, count, last_played_at)
    VALUES (${testKey}, 1, NOW())
    ON CONFLICT (track_key)
    DO UPDATE SET count = plays.count + 1, last_played_at = NOW();
  `;

  console.log('[*] Fetching top trending tracks from Neon Postgres...');
  const rows = await sql`
    SELECT track_key, count, last_played_at
    FROM plays
    ORDER BY count DESC
    LIMIT 15;
  `;

  console.log('[✓] Query result:');
  console.table(rows);
  console.log('[✓] End-to-end Neon Postgres connection and query successful!');
}

testNeon().catch(err => {
  console.error('❌ Error testing Neon Postgres:', err);
  process.exit(1);
});
