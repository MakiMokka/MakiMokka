/**
 * Build-time guard: refuse to build if a secret appears in a variable that
 * Next.js would inline into browser bundles (NEXT_PUBLIC_*).
 *
 * Pure function so it can run from next.config.ts and from unit tests.
 */

const SECRET_NAME_PATTERN =
  /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|DATABASE_URL|ENCRYPTION|REFRESH)/i;

function decodeJwtPayload(value: string): Record<string, unknown> | null {
  const parts = value.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function findPublicSecretLeaks(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('NEXT_PUBLIC_')) continue;
    if (SECRET_NAME_PATTERN.test(name)) {
      problems.push(`${name}: secret-like variables must not use the NEXT_PUBLIC_ prefix`);
      continue;
    }
    if (!value) continue;
    if (value.startsWith('sb_secret_')) {
      problems.push(`${name}: contains a Supabase secret key`);
      continue;
    }
    if (/^postgres(ql)?:\/\//i.test(value)) {
      problems.push(`${name}: contains a database connection string`);
      continue;
    }
    const payload = decodeJwtPayload(value);
    if (payload && payload['role'] === 'service_role') {
      problems.push(`${name}: contains a Supabase service-role JWT`);
    }
  }
  return problems;
}

export function assertNoPublicSecretLeaks(env: Record<string, string | undefined>): void {
  const problems = findPublicSecretLeaks(env);
  if (problems.length > 0) {
    // Only variable names are reported, never values.
    throw new Error(
      `Refusing to build: secrets exposed to the browser.\n- ${problems.join('\n- ')}`,
    );
  }
}
