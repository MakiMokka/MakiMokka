import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CredentialCryptoError,
  decryptCredential,
  encryptCredential,
  needsRotation,
  parseKeyring,
} from '@/lib/crypto/credentials';

const key = () => randomBytes(32).toString('base64');
const binding = {
  userId: '6f1c2d3e-4a5b-4c6d-8e7f-90a1b2c3d4e5',
  accountId: '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d',
};
const secret = { refreshToken: 'refresh-token-value', accessToken: 'access-token-value' };

describe('parseKeyring', () => {
  it('parses versioned keys', () => {
    const ring = parseKeyring(`1:${key()}, 2:${key()}`, 2);
    expect(ring.activeVersion).toBe(2);
    expect([...ring.keys.keys()]).toEqual([1, 2]);
  });

  it.each([
    ['wrong length', `1:${randomBytes(16).toString('base64')}`, 1],
    ['missing active key', `1:${key()}`, 2],
    ['bad version', `x:${key()}`, 1],
    ['duplicate version', `1:${key()},1:${key()}`, 1],
  ])('rejects %s', (_label, raw, active) => {
    expect(() => parseKeyring(raw as string, active as number)).toThrow(CredentialCryptoError);
  });
});

describe('credential encryption', () => {
  const ring = parseKeyring(`1:${key()}`, 1);

  it('round-trips and never contains plaintext', () => {
    const encrypted = encryptCredential(ring, secret, binding);
    expect(encrypted.nonce).toHaveLength(12);
    expect(encrypted.authTag).toHaveLength(16);
    expect(encrypted.ciphertext.toString('utf8')).not.toContain('refresh-token-value');
    expect(decryptCredential(ring, encrypted, binding)).toEqual(secret);
  });

  it('uses a fresh nonce for every encryption', () => {
    const a = encryptCredential(ring, secret, binding);
    const b = encryptCredential(ring, secret, binding);
    expect(a.nonce.equals(b.nonce)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it('fails when the ciphertext is tampered with', () => {
    const encrypted = encryptCredential(ring, secret, binding);
    encrypted.ciphertext[0] = encrypted.ciphertext[0]! ^ 0xff;
    expect(() => decryptCredential(ring, encrypted, binding)).toThrow('could not be decrypted');
  });

  it('fails when moved to another account or user (AAD binding)', () => {
    const encrypted = encryptCredential(ring, secret, binding);
    expect(() =>
      decryptCredential(ring, encrypted, {
        ...binding,
        accountId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toThrow(CredentialCryptoError);
    expect(() =>
      decryptCredential(ring, encrypted, {
        ...binding,
        userId: '22222222-2222-4222-8222-222222222222',
      }),
    ).toThrow(CredentialCryptoError);
  });

  it('fails with the wrong key and supports rotation', () => {
    const old = encryptCredential(ring, secret, binding);
    const other = parseKeyring(`1:${key()}`, 1);
    expect(() => decryptCredential(other, old, binding)).toThrow(CredentialCryptoError);

    const rotated = parseKeyring(
      `1:${[...ring.keys.values()][0]!.toString('base64')},2:${key()}`,
      2,
    );
    expect(needsRotation(rotated, old)).toBe(true);
    expect(decryptCredential(rotated, old, binding)).toEqual(secret);
    const fresh = encryptCredential(rotated, secret, binding);
    expect(fresh.keyVersion).toBe(2);
    expect(needsRotation(rotated, fresh)).toBe(false);
  });
});
