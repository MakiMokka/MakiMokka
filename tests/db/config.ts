/**
 * Connection settings for the migration test suite. Point TEST_DATABASE_URL
 * at a disposable Postgres 15+ server where the connecting user is a
 * superuser; the suite drops and recreates the database named in the URL.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/unified_mail_test';

/** Test-only password for the app_worker role in the throwaway test cluster. */
export const WORKER_TEST_PASSWORD = 'app_worker_test_only';

export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export function withCredentials(url: string, user: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = user;
  parsed.password = password;
  return parsed.toString();
}

export const TEST_DATABASE_NAME = new URL(TEST_DATABASE_URL).pathname.slice(1);
export const WORKER_DATABASE_URL = withCredentials(
  TEST_DATABASE_URL,
  'app_worker',
  WORKER_TEST_PASSWORD,
);
