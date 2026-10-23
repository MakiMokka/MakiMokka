import { z } from 'zod';

import { parseAllowlist } from '@/lib/auth/allowlist';

const nonEmpty = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .trim()
    .min(1, `${name} is required`);

const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: 'NEXT_PUBLIC_SUPABASE_URL must be a URL' }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: nonEmpty('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  AUTH_ALLOWED_USER_IDS: nonEmpty('AUTH_ALLOWED_USER_IDS'),
  DATABASE_URL: z.string().trim().optional(),
  CREDENTIALS_ENCRYPTION_KEYS: z.string().trim().optional(),
  CREDENTIALS_ACTIVE_KEY_VERSION: z.string().trim().optional(),
});

export interface ServerEnv {
  nodeEnv: 'development' | 'test' | 'production';
  supabaseUrl: string;
  supabasePublishableKey: string;
  allowedUserIds: ReadonlySet<string>;
  /** Direct Postgres URL for the least-privilege app_worker role. */
  databaseUrl: string | null;
  credentialKeys: { raw: string; activeVersion: number } | null;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = rawSchema.safeParse(source);
  if (!result.success) {
    // Report which variables are wrong, never their values.
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid server environment:\n- ${issues.join('\n- ')}`);
  }
  const env = result.data;

  if (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be the publishable key, not a secret key',
    );
  }

  const allowedUserIds = parseAllowlist(env.AUTH_ALLOWED_USER_IDS);
  if (allowedUserIds.size === 0) {
    throw new Error('AUTH_ALLOWED_USER_IDS must list at least one user ID');
  }

  const databaseUrl = env.DATABASE_URL ? env.DATABASE_URL : null;
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error('DATABASE_URL must be a postgres:// connection string');
  }
  if (!databaseUrl && env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required in production (audit logging depends on it)');
  }

  let credentialKeys: ServerEnv['credentialKeys'] = null;
  if (env.CREDENTIALS_ENCRYPTION_KEYS) {
    const activeVersion = Number(env.CREDENTIALS_ACTIVE_KEY_VERSION);
    if (!Number.isInteger(activeVersion) || activeVersion < 1) {
      throw new Error(
        'CREDENTIALS_ACTIVE_KEY_VERSION must be a positive integer when keys are set',
      );
    }
    credentialKeys = { raw: env.CREDENTIALS_ENCRYPTION_KEYS, activeVersion };
  }

  return {
    nodeEnv: env.NODE_ENV,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    allowedUserIds,
    databaseUrl,
    credentialKeys,
  };
}
