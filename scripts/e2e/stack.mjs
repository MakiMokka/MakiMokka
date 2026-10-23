/**
 * Local end-to-end stack for Unified Mail (test-only; never deployed).
 *
 *   Postgres (TEST_DATABASE_URL server) ── migrations applied fresh
 *   PostgREST  (real binary, POSTGREST_BIN) ── Supabase Data API equivalent
 *   gateway    (this file) ── serves /rest/v1 → PostgREST and a minimal
 *              stand-in for the Supabase Auth endpoints the app calls
 *              (JWKS, email OTP request/verify, logout).
 *
 * The auth stand-in issues real ES256-signed JWTs that the app verifies with
 * getClaims() exactly as in production. It is a test double for Supabase Auth
 * and lives only in scripts/e2e. No mail account is ever created.
 */
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

import postgres from 'postgres';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const OTP_CODE = '424242';
const AUTHENTICATOR_PASSWORD = 'authenticator_e2e_only';
const WORKER_PASSWORD = 'app_worker_e2e_only';

function withDb(url, database, user, password) {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  if (user) {
    parsed.username = user;
    parsed.password = password;
  }
  return parsed.toString();
}

export async function createDatabase(baseUrl, name) {
  const admin = postgres(withDb(baseUrl, 'postgres'), { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.unsafe(`create database ${name}`);
  await admin.end();

  const db = postgres(withDb(baseUrl, name), { max: 1, onnotice: () => {} });
  await db.unsafe(await readFile(path.join(ROOT, 'tests/db/supabase-shim.sql'), 'utf8'));
  const dir = path.join(ROOT, 'supabase/migrations');
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
    await db.unsafe(await readFile(path.join(dir, file), 'utf8'));
  }
  await db.unsafe(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticator') then
        create role authenticator login noinherit;
      end if;
    end $$;
    alter role authenticator with login password '${AUTHENTICATOR_PASSWORD}';
    grant anon, authenticated to authenticator;
    alter role app_worker with login password '${WORKER_PASSWORD}';
  `);
  return {
    sql: db,
    restUri: withDb(baseUrl, name, 'authenticator', AUTHENTICATOR_PASSWORD),
    workerUri: withDb(baseUrl, name, 'app_worker', WORKER_PASSWORD),
  };
}

export function createSigner() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const kid = randomUUID();
  const jwk = {
    ...publicKey.export({ format: 'jwk' }),
    kid,
    alg: 'ES256',
    use: 'sig',
    key_ops: ['verify'],
  };
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const issue = (claims) => {
    const unsigned = `${b64({ alg: 'ES256', typ: 'JWT', kid })}.${b64(claims)}`;
    const signature = sign('sha256', Buffer.from(unsigned), {
      key: privateKey,
      dsaEncoding: 'ieee-p1363',
    });
    return `${unsigned}.${signature.toString('base64url')}`;
  };
  return { jwks: { keys: [jwk] }, issue };
}

export function sessionFor(signer, user, issuer) {
  const now = Math.floor(Date.now() / 1000);
  const sessionId = randomUUID();
  const accessToken = signer.issue({
    iss: issuer,
    sub: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    session_id: sessionId,
    aal: 'aal1',
    iat: now,
    exp: now + 3600,
    is_anonymous: false,
  });
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: randomUUID(),
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      app_metadata: {},
      user_metadata: {},
    },
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export function startGateway({ port, restPort, signer, users, issuer, log }) {
  const json = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const body = await readBody(req);
    log.push(`${req.method} ${url.pathname}`);

    if (url.pathname.startsWith('/rest/v1/')) {
      const target = `http://127.0.0.1:${restPort}${url.pathname.slice('/rest/v1'.length)}${url.search}`;
      const headers = { ...req.headers };
      delete headers.host;
      delete headers['content-length'];
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      });
      res.writeHead(
        upstream.status,
        Object.fromEntries(
          [...upstream.headers].filter(
            ([k]) => k !== 'content-encoding' && k !== 'transfer-encoding',
          ),
        ),
      );
      res.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    if (url.pathname === '/auth/v1/.well-known/jwks.json') return json(res, 200, signer.jwks);
    if (url.pathname === '/auth/v1/otp' && req.method === 'POST') return json(res, 200, {});
    if (url.pathname === '/auth/v1/verify' && req.method === 'POST') {
      const { email, token } = JSON.parse(body.toString() || '{}');
      const user = users.find((u) => u.email === email);
      if (!user || token !== OTP_CODE)
        return json(res, 403, { code: 'otp_expired', msg: 'Token has expired or is invalid' });
      return json(res, 200, sessionFor(signer, user, issuer));
    }
    if (url.pathname === '/auth/v1/logout') {
      res.writeHead(204);
      res.end();
      return;
    }
    json(res, 404, { code: 'not_found' });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

export function startProcess(command, args, env, name, output) {
  // detached: own process group, so stopProcess() also stops grandchildren (npx → next-server).
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const capture = (chunk) => output.push(`[${name}] ${chunk.toString().trimEnd()}`);
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  return child;
}

export function stopProcess(child, signal = 'SIGTERM') {
  try {
    process.kill(-child.pid, signal);
  } catch {
    // already exited
  }
}

export async function waitFor(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
