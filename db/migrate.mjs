// Applies the files in db/migrations that have not been applied yet, in name order, each in a transaction.
// Usage: npm run db:migrate             (the branch in .env.local, from `neon checkout` / `neon env pull`)
//        DATABASE_URL_UNPOOLED=... node db/migrate.mjs   (any other database)
import { Pool } from '@neondatabase/serverless';
import { readdirSync, readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL_UNPOOLED (run `neon env pull` first)');
const dir = new URL('./migrations/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const pool = new Pool({ connectionString: url });
const client = await pool.connect();
try {
  await client.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  await client.query(`alter table schema_migrations enable row level security`);
  // Databases set up before this runner existed already have the first migration
  const { rows: [{ seeded }] } = await client.query(`select to_regclass('public.seasons') is not null as seeded`);
  if (seeded) await client.query(`insert into schema_migrations (name) values ($1) on conflict do nothing`, [files[0]]);

  const { rows } = await client.query(`select name from schema_migrations`);
  const done = new Set(rows.map((r) => r.name));
  const todo = files.filter((f) => !done.has(f));
  for (const f of todo) {
    await client.query('begin');
    try {
      await client.query(readFileSync(new URL(f, dir), 'utf8'));
      await client.query(`insert into schema_migrations (name) values ($1)`, [f]);
      await client.query('commit');
      console.log(`applied ${f}`);
    } catch (e) {
      await client.query('rollback');
      throw new Error(`${f}: ${e.message}`);
    }
  }
  if (!todo.length) console.log('nothing to apply');
} finally {
  client.release();
  await pool.end();
}
