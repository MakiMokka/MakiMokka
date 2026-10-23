import { describe, expect, it } from 'vitest';

import { parseServerEnv } from '@/lib/env/schema';

const valid = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  AUTH_ALLOWED_USER_IDS: '6f1c2d3e-4a5b-4c6d-8e7f-90a1b2c3d4e5',
};

describe('parseServerEnv', () => {
  it('accepts a minimal development configuration', () => {
    const env = parseServerEnv(valid);
    expect(env.allowedUserIds.size).toBe(1);
    expect(env.databaseUrl).toBeNull();
    expect(env.credentialKeys).toBeNull();
  });

  it('requires an allowlist', () => {
    expect(() => parseServerEnv({ ...valid, AUTH_ALLOWED_USER_IDS: '' })).toThrow(
      'AUTH_ALLOWED_USER_IDS',
    );
    expect(() => parseServerEnv({ ...valid, AUTH_ALLOWED_USER_IDS: ' , ' })).toThrow(
      'at least one',
    );
  });

  it('refuses a secret key in the publishable slot', () => {
    expect(() =>
      parseServerEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' }),
    ).toThrow('publishable key');
  });

  it('requires DATABASE_URL in production', () => {
    expect(() => parseServerEnv({ ...valid, NODE_ENV: 'production' })).toThrow('DATABASE_URL');
    expect(
      parseServerEnv({
        ...valid,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://u@h:6543/postgres',
      }).databaseUrl,
    ).toContain('postgresql://');
  });

  it('requires an active key version when encryption keys are set', () => {
    expect(() => parseServerEnv({ ...valid, CREDENTIALS_ENCRYPTION_KEYS: '1:abc' })).toThrow(
      'ACTIVE_KEY_VERSION',
    );
  });

  it('never echoes values in error messages', () => {
    try {
      parseServerEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: 'not a url sb_secret_leak' });
    } catch (error) {
      expect((error as Error).message).not.toContain('sb_secret_leak');
      return;
    }
    throw new Error('expected failure');
  });
});
