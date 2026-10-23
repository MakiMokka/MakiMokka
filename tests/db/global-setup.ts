import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import postgres from 'postgres';

import {
  TEST_DATABASE_NAME,
  TEST_DATABASE_URL,
  WORKER_TEST_PASSWORD,
  withDatabase,
} from './config';

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * Build a fresh database: Supabase shim, then every migration in order,
 * exactly as `supabase db push` would apply them.
 */
export default async function setup() {
  if (!/^[a-z0-9_]+$/.test(TEST_DATABASE_NAME)) throw new Error('Unsafe test database name');
  const admin = postgres(withDatabase(TEST_DATABASE_URL, 'postgres'), {
    max: 1,
    onnotice: () => {},
  });
  try {
    await admin.unsafe(`drop database if exists ${TEST_DATABASE_NAME} with (force)`);
    await admin.unsafe(`create database ${TEST_DATABASE_NAME}`);
  } finally {
    await admin.end();
  }

  const db = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await db.unsafe(await readFile(path.join(ROOT, 'tests/db/supabase-shim.sql'), 'utf8'));
    const dir = path.join(ROOT, 'supabase/migrations');
    const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
    if (files.length === 0) throw new Error('No migrations found');
    for (const file of files) {
      try {
        await db.unsafe(await readFile(path.join(dir, file), 'utf8'));
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }
    // Test cluster only: let the suite connect as app_worker like the server does.
    await db.unsafe(`alter role app_worker with login password '${WORKER_TEST_PASSWORD}'`);
  } finally {
    await db.end();
  }
}
