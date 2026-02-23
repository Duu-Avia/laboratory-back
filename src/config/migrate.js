import { getConnection } from './connection-db.js';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../../migrations');

/**
 * Create the schema_migrations tracking table if it doesn't exist.
 * This table records which .sql files have already been executed.
 */
async function ensureMigrationsTable(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='schema_migrations' AND xtype='U')
    CREATE TABLE schema_migrations (
      id INT IDENTITY(1,1) PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME DEFAULT GETDATE()
    )
  `);
}

/**
 * Returns a Set of filenames that have already been executed.
 */
async function getExecutedMigrations(pool) {
  const result = await pool.request().query(`
    SELECT filename FROM schema_migrations ORDER BY executed_at
  `);
  return new Set(result.recordset.map((r) => r.filename));
}

/**
 * Execute a single SQL migration file.
 * Splits on GO statements (T-SQL batch separator) so multi-batch files work correctly.
 * Records the filename in schema_migrations after success.
 */
async function runMigration(pool, filename, sql) {
  // Split on GO (on its own line, case-insensitive) to support multi-batch SQL files
  const batches = sql.split(/^\s*GO\s*$/im).filter((b) => b.trim());

  for (const batch of batches) {
    await pool.request().query(batch);
  }

  await pool
    .request()
    .input('filename', filename)
    .query(`INSERT INTO schema_migrations (filename) VALUES (@filename)`);
}

async function migrate() {
  let pool;

  try {
    pool = await getConnection();
  } catch (error) {
    console.error('❌ Cannot connect to database:', error.message);
    process.exit(1);
  }

  await ensureMigrationsTable(pool);

  const executed = await getExecutedMigrations(pool);

  let files;
  try {
    files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort(); // alphabetical order ensures correct sequence (001_, 002_, ...)
  } catch {
    console.error(`❌ Cannot read migrations folder: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const pending = files.filter((f) => !executed.has(f));

  if (pending.length === 0) {
    console.log('✅ No pending migrations. Database is up to date.');
    process.exit(0);
  }

  console.log(`Found ${pending.length} pending migration(s):\n`);

  for (const filename of pending) {
    const filepath = join(MIGRATIONS_DIR, filename);
    const sql = await readFile(filepath, 'utf-8');

    try {
      console.log(`⏳ Running: ${filename}`);
      await runMigration(pool, filename, sql);
      console.log(`✅ Done:    ${filename}\n`);
    } catch (error) {
      console.error(`❌ Failed:  ${filename}`);
      console.error(error.message);
      process.exit(1);
    }
  }

  console.log('✅ All migrations completed successfully.');
  process.exit(0);
}

migrate();
