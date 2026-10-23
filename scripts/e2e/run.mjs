/**
 * End-to-end smoke test against a production build (`npm run build` first).
 *
 *   POSTGREST_BIN=/path/to/postgrest node scripts/e2e/run.mjs
 *
 * Requires a local Postgres superuser URL in TEST_DATABASE_URL (same as the
 * migration tests) and Chromium for Playwright.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { chromium, devices } from 'playwright';

import {
  OTP_CODE,
  createDatabase,
  createSigner,
  startGateway,
  startProcess,
  stopProcess,
  waitFor,
} from './stack.mjs';

const BASE_DB =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/unified_mail_test';
const POSTGREST_BIN = process.env.POSTGREST_BIN ?? 'postgrest';
const OUT = path.resolve(process.env.E2E_ARTIFACTS_DIR ?? 'e2e-artifacts');
const APP_PORT = 3100;
const GATEWAY_PORT = 54329;
const REST_PORT = 3101;
const APP = `http://localhost:${APP_PORT}`;
const SUPABASE_URL = `http://127.0.0.1:${GATEWAY_PORT}`;

const owner = { id: randomUUID(), email: 'owner@example.test' };
const intruder = { id: randomUUID(), email: 'intruder@example.test' };

const output = [];
const gatewayLog = [];
const children = [];
let gateway;
let db;
let browser;
const results = [];

async function step(name, fn) {
  if (process.env.E2E_VERBOSE) console.log(`… ${name}`);
  try {
    await fn();
    results.push(`  ✓ ${name}`);
  } catch (error) {
    results.push(`  ✗ ${name}\n    ${error.message.split('\n').join('\n    ')}`);
    throw error;
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  if (process.env.E2E_VERBOSE) console.log('… starting stack');
  const stack = await createDatabase(BASE_DB, 'unified_mail_e2e');
  db = stack.sql;
  for (const user of [owner, intruder]) {
    await db`insert into auth.users (id, email) values (${user.id}, ${user.email})`;
  }
  // Only the owner is authorized, both in the database and the app allowlist.
  await db`insert into app_private.authorized_users (user_id, note) values (${owner.id}, 'e2e owner')`;

  const signer = createSigner();
  gateway = await startGateway({
    port: GATEWAY_PORT,
    restPort: REST_PORT,
    signer,
    users: [owner, intruder],
    issuer: `${SUPABASE_URL}/auth/v1`,
    log: gatewayLog,
  });

  children.push(
    startProcess(
      POSTGREST_BIN,
      [],
      {
        PGRST_DB_URI: stack.restUri,
        PGRST_DB_SCHEMAS: 'public',
        PGRST_DB_ANON_ROLE: 'anon',
        PGRST_JWT_SECRET: JSON.stringify(signer.jwks),
        PGRST_SERVER_PORT: String(REST_PORT),
        PGRST_SERVER_HOST: '127.0.0.1',
      },
      'postgrest',
      output,
    ),
  );
  await waitFor(`http://127.0.0.1:${REST_PORT}/`);
  if (process.env.E2E_VERBOSE) console.log('… postgrest up');

  children.push(
    startProcess(
      'npx',
      ['next', 'start', '-p', String(APP_PORT)],
      {
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_local_only',
        AUTH_ALLOWED_USER_IDS: owner.id,
        DATABASE_URL: stack.workerUri,
        DESIGN_PREVIEW: '1',
      },
      'next',
      output,
    ),
  );
  await waitFor(`${APP}/api/health`, 60_000);

  browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 15 Pro'], locale: 'en-US' });
  context.setDefaultTimeout(15_000);
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  await step('anonymous visitors are redirected to sign-in', async () => {
    const response = await page.goto(`${APP}/inbox`);
    assert.equal(new URL(page.url()).pathname, '/login');
    assert.equal(new URL(page.url()).searchParams.get('next'), '/inbox');
    const csp = response.headers()['content-security-policy'] ?? '';
    assert.match(csp, /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    assert.ok(!csp.includes('unsafe-inline'), 'no unsafe-inline in production CSP');
    assert.equal(response.headers()['x-frame-options'], 'DENY');
    assert.equal(response.headers()['x-content-type-options'], 'nosniff');
    assert.ok(!response.headers()['x-powered-by'], 'x-powered-by removed');
    await page.getByText('Version 0.1.0').first().waitFor();
    // Brand assets must load without a session (they bypass the auth proxy).
    const logo = page.locator('img.theme-light-only').first();
    await logo.waitFor();
    assert.ok(
      await logo.evaluate((img) => img.complete && img.naturalWidth > 0),
      'wordmark SVG loaded',
    );
    for (const asset of [
      '/brand/ovyra-wordmark-color-on-dark.svg',
      '/icons/apple-touch-icon.png',
      '/icon.svg',
    ]) {
      const res = await page.request.get(`${APP}${asset}`, { maxRedirects: 0 });
      assert.equal(res.status(), 200, `${asset} served publicly`);
    }
    await page.screenshot({ path: path.join(OUT, '01-login-iphone.png') });
  });

  await step('API rejects anonymous requests with 401 JSON and no-store', async () => {
    const response = await page.request.get(`${APP}/api/accounts`);
    assert.equal(response.status(), 401);
    assert.equal((await response.json()).error.code, 'unauthenticated');
    assert.match(response.headers()['cache-control'], /no-store/);
  });

  await step('email code sign-in for an allowlisted user', async () => {
    await page.getByLabel('Email').fill(owner.email);
    await page.getByRole('button', { name: 'Send sign-in code' }).click();
    await page.getByLabel('Sign-in code').fill(OTP_CODE);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(`${APP}/inbox`);
    await page.getByTestId('inbox-no-accounts').waitFor();
    await page.screenshot({ path: path.join(OUT, '02-inbox-empty-iphone.png') });
  });

  await step('session cookie is HttpOnly and nothing is kept in web storage', async () => {
    const cookies = await context.cookies();
    const session = cookies.find(
      (cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'),
    );
    assert.ok(session, 'session cookie present');
    assert.equal(session.httpOnly, true);
    assert.equal(session.sameSite, 'Lax');
    const exposed = await page.evaluate(() => ({
      cookie: document.cookie,
      local: window.localStorage.length,
      session: window.sessionStorage.length,
    }));
    assert.ok(!exposed.cookie.includes('auth-token'), 'session cookie not readable from JS');
    assert.equal(exposed.local, 0);
    assert.equal(exposed.session, 0);
  });

  await step('every primary screen renders a labeled empty state', async () => {
    const screens = [
      ['/search', 'search-no-accounts', '03-search'],
      ['/actions', 'actions-empty', '04-actions'],
      ['/follow-ups', 'follow-ups-empty', '05-follow-ups'],
      ['/settings/accounts', 'accounts-empty', '07-mail-accounts'],
    ];
    for (const [route, testId, shot] of screens) {
      await page.goto(`${APP}${route}`);
      await page.getByTestId(testId).waitFor();
      await page.screenshot({ path: path.join(OUT, `${shot}-iphone.png`) });
    }
    await page.goto(`${APP}/settings`);
    await page.getByText(owner.email).waitFor();
    await page.screenshot({ path: path.join(OUT, '06-settings-iphone.png') });
    await page.goto(`${APP}/settings/accounts`);
    const connect = page.getByText('Connect Gmail account');
    assert.equal(
      await connect.locator('xpath=ancestor::*[@aria-disabled="true"][1]').count(),
      1,
      'connect is disabled',
    );
  });

  await step('sign-in was written to the audit log and shown under Security', async () => {
    const rows =
      await db`select event_type, actor from audit.events where user_id = ${owner.id} order by id`;
    assert.deepEqual(
      rows.map((row) => row.event_type),
      ['auth.sign_in'],
    );
    await page.goto(`${APP}/settings/security`);
    await page.getByText('Signed in', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(OUT, '08-security-iphone.png') });
  });

  await step('profile form validates and saves through RLS', async () => {
    await page.goto(`${APP}/settings/profile`);
    await page.getByLabel('Display name').fill('Owner');
    await page.getByLabel('Time zone').fill('Not/AZone');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText('Enter a valid time zone.').waitFor();
    await page.getByLabel('Time zone').fill('America/Mexico_City');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText('Saved', { exact: true }).waitFor();
    const [profile] =
      await db`select display_name, time_zone from public.profiles where id = ${owner.id}`;
    assert.deepEqual(profile, { display_name: 'Owner', time_zone: 'America/Mexico_City' });
  });

  await step('switching to Spanish persists to the profile', async () => {
    await page.goto(`${APP}/settings/language`);
    await page.getByRole('button', { name: 'Español' }).click();
    await page.getByRole('heading', { name: 'Idioma' }).waitFor();
    assert.equal(await page.getAttribute('html', 'lang'), 'es');
    await page.goto(`${APP}/inbox`);
    await page.getByRole('heading', { name: 'Bandeja de entrada' }).waitFor();
    await page.getByText('No hay cuentas de correo conectadas').waitFor();
    await page.screenshot({ path: path.join(OUT, '09-inbox-es-iphone.png') });
    const [profile] = await db`select locale from public.profiles where id = ${owner.id}`;
    assert.equal(profile.locale, 'es');
    await page.goto(`${APP}/settings/language`);
    await page.getByRole('button', { name: 'English' }).click();
    await page.getByRole('heading', { name: 'Language' }).waitFor();
  });

  await step('API enforces account ownership', async () => {
    const list = await page.request.get(`${APP}/api/accounts`);
    assert.equal(list.status(), 200);
    assert.deepEqual(await list.json(), { accounts: [] });
    // An account that exists but belongs to someone else must look like it does not exist.
    const foreign = randomUUID();
    await db`insert into public.profiles (id) values (${intruder.id}) on conflict do nothing`;
    await db`
      insert into public.mail_accounts (id, user_id, provider, provider_account_id, email_address)
      values (${foreign}, ${intruder.id}, 'google', 'e2e-foreign', 'foreign@example.test')
    `;
    for (const id of [foreign, randomUUID(), 'not-a-uuid']) {
      const response = await page.request.get(`${APP}/api/accounts/${id}`);
      assert.equal(response.status(), 404, `GET /api/accounts/${id}`);
    }
    const del = await page.request.delete(`${APP}/api/accounts/${foreign}`);
    assert.equal(del.status(), 404);
    await db`delete from public.mail_accounts where id = ${foreign}`;
  });

  await step('desktop layout shows the sidebar with the version under the name', async () => {
    const desktop = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      storageState: await context.storageState(),
    });
    const desktopPage = await desktop.newPage();
    await desktopPage.goto(`${APP}/inbox`);
    const sidebar = desktopPage.locator('aside');
    await sidebar.getByRole('img', { name: 'OVYRA' }).waitFor();
    await sidebar.getByText('Version 0.1.0').waitFor();
    await desktopPage.screenshot({ path: path.join(OUT, '10-inbox-desktop.png') });
    await desktop.close();
  });

  await step('dark mode keeps the brand character (system preference)', async () => {
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const [route, shot] of [
      ['/inbox', '11-inbox-dark-iphone'],
      ['/settings', '12-settings-dark-iphone'],
    ]) {
      await page.goto(`${APP}${route}`);
      const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert.equal(background, 'rgb(11, 16, 37)', 'dark canvas #0B1025');
      await page.screenshot({ path: path.join(OUT, `${shot}.png`) });
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`${APP}/inbox`);
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.equal(background, 'rgb(248, 249, 255)', 'light canvas #F8F9FF');
  });

  await step('design-system preview renders neutral content outside navigation', async () => {
    const links = await page
      .locator('nav a')
      .evaluateAll((items) => items.map((a) => a.getAttribute('href')));
    assert.ok(!links.includes('/design-system'), 'not linked from navigation');
    await page.goto(`${APP}/design-system`);
    await page.getByTestId('design-system').waitFor();
    await page.screenshot({ path: path.join(OUT, '13-design-system-iphone.png'), fullPage: true });
    const desktop = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      storageState: await context.storageState(),
    });
    const desktopPage = await desktop.newPage();
    await desktopPage.goto(`${APP}/design-system`);
    await desktopPage.getByTestId('design-system').waitFor();
    await desktopPage.screenshot({
      path: path.join(OUT, '14-design-system-desktop.png'),
      fullPage: true,
    });
    await desktop.close();
  });

  await step('PWA manifest and service worker are served', async () => {
    const manifest = await page.request.get(`${APP}/manifest.webmanifest`);
    assert.equal(manifest.status(), 200);
    assert.equal((await manifest.json()).display, 'standalone');
    const registered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      return Boolean(registration);
    });
    assert.ok(registered, 'service worker registered');
  });

  await step('sign out ends the session', async () => {
    await page.goto(`${APP}/settings/security`);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL(/\/login/);
    const response = await page.request.get(`${APP}/api/accounts`);
    assert.equal(response.status(), 401);
  });

  await step('a valid user who is not allowlisted is refused and audited', async () => {
    await page.goto(`${APP}/login`);
    await page.getByLabel('Email').fill(intruder.email);
    await page.getByRole('button', { name: 'Send sign-in code' }).click();
    await page.getByLabel('Sign-in code').fill(OTP_CODE);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(`${APP}/unauthorized`);
    await page.getByTestId('unauthorized').waitFor();
    const response = await page.request.get(`${APP}/api/accounts`);
    assert.ok([401, 403].includes(response.status()));
    const rows = await db`select event_type from audit.events where user_id = ${intruder.id}`;
    assert.deepEqual(
      rows.map((row) => row.event_type),
      ['auth.sign_in_denied'],
    );
    await page.goto(`${APP}/inbox`);
    assert.notEqual(new URL(page.url()).pathname, '/inbox');
  });

  await step('a wrong sign-in code is rejected generically', async () => {
    await page.goto(`${APP}/login`);
    await page.getByLabel('Email').fill(owner.email);
    await page.getByRole('button', { name: 'Send sign-in code' }).click();
    await page.getByLabel('Sign-in code').fill('000000');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByText('That code is invalid or has expired.').waitFor();
  });

  await step('no CSP violations or client errors were reported', async () => {
    assert.deepEqual(problems, []);
  });

  await step('server logs contain no tokens or OTP codes', async () => {
    const logs = output.join('\n');
    assert.ok(!/eyJ[A-Za-z0-9_-]{10,}\./.test(logs), 'no JWTs in logs');
    assert.ok(!logs.includes(OTP_CODE), 'no OTP codes in logs');
  });
}

// Hard stop so a hung browser or server can never block CI indefinitely.
const watchdog = setTimeout(() => {
  console.log(`E2E watchdog fired.\n${results.join('\n')}\n${output.slice(-40).join('\n')}`);
  for (const child of children) stopProcess(child, 'SIGKILL');
  process.exit(1);
}, 240_000);

let failed = false;
try {
  await main();
} catch (error) {
  failed = true;
  if (!results.some((line) => line.includes('✗'))) results.push(`  ✗ setup\n    ${error.stack}`);
} finally {
  await browser?.close();
  for (const child of children) stopProcess(child);
  gateway?.close();
  await db?.end();
  clearTimeout(watchdog);
}
console.log(`E2E results:\n${results.join('\n')}`);
if (failed) {
  console.log('\n--- process output (tail) ---');
  console.log(output.slice(-40).join('\n'));
  process.exitCode = 1;
}
