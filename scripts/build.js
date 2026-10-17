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

async function runBuild() {
  console.log('====================================================');
  console.log('  BD Band Music — Build & Verification');
  console.log('====================================================\n');

  // 1. Verify Catalog JSON
  const catalogPath = path.resolve(__dirname, '..', 'catalog.json');
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`catalog.json not found at ${catalogPath}`);
  }
  const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  console.log(`[✓] catalog.json validated: ${catalogData.length} audio tracks indexed.`);

  // 2. Verify Neon Database Configuration
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is missing from environment or .env.local');
  }
  const maskedHost = dbUrl.split('@')[1] ? dbUrl.split('@')[1].split('/')[0] : 'hidden';
  console.log(`[✓] Neon database configuration detected: ${maskedHost}`);
  console.log(`[✓] Active Neon branch: ${process.env.NEON_BRANCH || 'production'}`);

  // 3. Connect to Neon and ensure schema
  console.log('[*] Testing connection to Neon Postgres & ensuring schema...');
  const sql = neon(dbUrl);

  await sql`
    CREATE TABLE IF NOT EXISTS plays (
      track_key VARCHAR(255) PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      last_played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  console.log('[✓] Table "plays" confirmed in Neon Postgres.');

  // Verify read query
  const countRes = await sql`SELECT COUNT(*)::int AS total_tracks FROM plays;`;
  console.log(`[✓] Total uniquely tracked songs in Neon: ${countRes[0].total_tracks}`);

  // 4. Validate core application files exist
  const requiredFiles = ['app.js', 'index.html', 'style.css'];
  for (const file of requiredFiles) {
    const filePath = path.resolve(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required file: ${file}`);
    }
  }
  console.log('[✓] Frontend static assets verified (index.html, app.js, style.css).');

  console.log('\n====================================================');
  console.log('  BUILD PASSED: App & Neon Service Ready');
  console.log('====================================================');
}

runBuild().catch(err => {
  console.error('\n❌ BUILD FAILED:', err.message || err);
  process.exit(1);
});
