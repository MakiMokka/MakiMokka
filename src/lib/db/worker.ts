import 'server-only';

import postgres from 'postgres';

import { getServerEnv } from '@/lib/env/server';

export type WorkerSql = postgres.Sql;

let client: WorkerSql | null | undefined;

/**
 * Direct Postgres connection as the least-privilege `app_worker` role, used
 * for operational schemas (audit, credentials, sync) that are not exposed
 * through the Data API. Returns null when DATABASE_URL is not configured
 * (allowed in development only; see src/lib/env/schema.ts).
 *
 * Callers must already have authorized the user and must scope every query
 * to that user id; app_worker itself is not user-scoped.
 */
export function getWorkerSql(): WorkerSql | null {
  if (client !== undefined) return client;
  const { databaseUrl } = getServerEnv();
  client = databaseUrl
    ? postgres(databaseUrl, {
        // Supabase's transaction pooler does not support prepared statements.
        prepare: false,
        max: 3,
        idle_timeout: 20,
        connect_timeout: 10,
        connection: { application_name: 'unified-mail-server' },
        onnotice: () => {},
      })
    : null;
  return client;
}
