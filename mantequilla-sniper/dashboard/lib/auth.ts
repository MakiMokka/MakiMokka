// Sesión mínima por contraseña: cookie con HMAC de la contraseña configurada. Funciona en Edge y Node.
export const COOKIE = 'msc_session';

export async function sessionToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('mantequilla-dashboard-v1'));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password || !token) return false;
  return token === (await sessionToken(password));
}
