// Server-side sessions: random 32-byte token in an HttpOnly cookie, only its SHA-256 lives in the DB.
import { createHash, randomBytes } from 'node:crypto';

export const COOKIE = 'vow_sid';
export const SESSION_DAYS = 30;
export const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

export function cookieHeader(token, { maxAgeSec = SESSION_DAYS * 86400 } = {}) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}
export const clearCookieHeader = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function readCookie(header) {
  for (const part of String(header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=') || null;
  }
  return null;
}
