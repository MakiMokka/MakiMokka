import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Application-layer encryption for OAuth credentials (AES-256-GCM).
 *
 * - Keys live only in server environment variables; the database stores
 *   ciphertext, nonce, auth tag and key version.
 * - Each record is bound to (userId, accountId) through additional
 *   authenticated data, so a ciphertext copied onto another account's row
 *   fails to decrypt.
 * - Multiple key versions may be configured for rotation; new writes use the
 *   active version.
 */

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const KEY_BYTES = 32;
const AAD_PREFIX = 'unified-mail:oauth-credential:v1';

export interface Keyring {
  activeVersion: number;
  keys: ReadonlyMap<number, Buffer>;
}

export interface EncryptedCredential {
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

export interface CredentialBinding {
  userId: string;
  accountId: string;
}

/** Provider tokens. Never log, never send to the browser. */
export interface OAuthSecret {
  refreshToken: string;
  accessToken?: string;
}

export class CredentialCryptoError extends Error {
  override name = 'CredentialCryptoError';
}

/**
 * Parse "1:<base64 32 bytes>,2:<base64 32 bytes>".
 * Generate a key with: openssl rand -base64 32
 */
export function parseKeyring(raw: string, activeVersion: number): Keyring {
  const keys = new Map<number, Buffer>();
  for (const entry of raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)) {
    const separator = entry.indexOf(':');
    const version = Number(entry.slice(0, separator));
    const material = Buffer.from(entry.slice(separator + 1), 'base64');
    if (separator < 1 || !Number.isInteger(version) || version < 1 || version > 32767) {
      throw new CredentialCryptoError('Invalid key version in credential keyring');
    }
    if (material.length !== KEY_BYTES) {
      throw new CredentialCryptoError(
        `Credential key version ${version} must be ${KEY_BYTES} bytes`,
      );
    }
    if (keys.has(version)) {
      throw new CredentialCryptoError(`Duplicate credential key version ${version}`);
    }
    keys.set(version, material);
  }
  if (!keys.has(activeVersion)) {
    throw new CredentialCryptoError('Active credential key version is not in the keyring');
  }
  return { activeVersion, keys };
}

function aad({ userId, accountId }: CredentialBinding): Buffer {
  return Buffer.from(`${AAD_PREFIX}:${userId.toLowerCase()}:${accountId.toLowerCase()}`, 'utf8');
}

export function encryptCredential(
  keyring: Keyring,
  secret: OAuthSecret,
  binding: CredentialBinding,
): EncryptedCredential {
  const key = keyring.keys.get(keyring.activeVersion);
  if (!key) throw new CredentialCryptoError('Active credential key is missing');
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  cipher.setAAD(aad(binding));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(secret), 'utf8'), cipher.final()]);
  return { ciphertext, nonce, authTag: cipher.getAuthTag(), keyVersion: keyring.activeVersion };
}

export function decryptCredential(
  keyring: Keyring,
  record: EncryptedCredential,
  binding: CredentialBinding,
): OAuthSecret {
  const key = keyring.keys.get(record.keyVersion);
  if (!key) throw new CredentialCryptoError('Credential key version is not available');
  try {
    const decipher = createDecipheriv(ALGORITHM, key, record.nonce);
    decipher.setAAD(aad(binding));
    decipher.setAuthTag(record.authTag);
    const plaintext = Buffer.concat([decipher.update(record.ciphertext), decipher.final()]);
    const parsed: unknown = JSON.parse(plaintext.toString('utf8'));
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as OAuthSecret).refreshToken !== 'string'
    ) {
      throw new CredentialCryptoError('Decrypted credential has an unexpected shape');
    }
    return parsed as OAuthSecret;
  } catch (error) {
    if (error instanceof CredentialCryptoError) throw error;
    // Do not surface the underlying error: it adds nothing and may vary by key.
    throw new CredentialCryptoError('Credential could not be decrypted');
  }
}

/** True when the record should be re-encrypted with the active key. */
export function needsRotation(
  keyring: Keyring,
  record: Pick<EncryptedCredential, 'keyVersion'>,
): boolean {
  return record.keyVersion !== keyring.activeVersion;
}
