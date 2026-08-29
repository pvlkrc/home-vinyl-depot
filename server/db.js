const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initSchema({ retries = 10, delayMs = 1000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vinyls (
          id SERIAL PRIMARY KEY,
          discogs_id BIGINT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          data JSONB NOT NULL,
          added_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        ALTER TABLE vinyls ADD COLUMN IF NOT EXISTS artist TEXT;
        ALTER TABLE vinyls ADD COLUMN IF NOT EXISTS album TEXT;

        UPDATE vinyls
        SET artist = split_part(title, ' - ', 1),
            album = trim(substring(title from position(' - ' in title) + 3))
        WHERE artist IS NULL AND title LIKE '% - %';
      `);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = { pool, initSchema };
