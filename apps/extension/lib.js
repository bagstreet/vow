// Shared by the popup and the service worker. Storage keys: base, secret, mutedUntil, items, notified.
export const DEFAULT_BASE = 'https://vow-livid.vercel.app';
export const POLL_MINUTES = 1;

export const get = (keys) => chrome.storage.local.get(keys);
export const set = (o) => chrome.storage.local.set(o);

export async function call(action, { method = 'GET', body, secret, base } = {}) {
  const cfg = await get(['base', 'secret']);
  const root = (base ?? cfg.base ?? DEFAULT_BASE).replace(/\/+$/, '');
  const token = secret ?? cfg.secret;
  const r = await fetch(`${root}/api/ext?action=${action}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, ...json };
}

export const isMuted = (mutedUntil, now = Date.now()) => mutedUntil === 'off' || (Number(mutedUntil) || 0) > now;

/** Mute presets -> value for storage ('off' = until the user switches it back). */
export function muteUntil(kind, now = new Date()) {
  if (kind === 'hour') return now.getTime() + 3600_000;
  if (kind === 'tomorrow') { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(7, 0, 0, 0); return d.getTime(); }
  if (kind === 'off') return 'off';
  return 0;
}

export async function badge(count) {
  await chrome.action.setBadgeBackgroundColor({ color: '#0E9C86' });
  await chrome.action.setBadgeText({ text: count ? String(count) : '' });
}
