// Shared helpers: settings live in chrome.storage.local; calls go to the Vow Agent API.
const DEFAULTS = { base: 'https://vow-livid.vercel.app', token: '', role: '' };
export const getSettings = async () => ({ ...DEFAULTS, ...(await chrome.storage.local.get(Object.keys(DEFAULTS))) });
export const saveSettings = (s) => chrome.storage.local.set(s);

async function call(path, init = {}) {
  const s = await getSettings();
  if (!s.token) throw new Error('Add your agent token in the popup first.');
  const r = await fetch(s.base.replace(/\/$/, '') + path, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${s.token}` },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
export const whoami = () => call('/api/agent?action=me');
export const recall = (q) => call('/api/agent?action=recall&q=' + encodeURIComponent(q));
export async function remember(text, role) {
  const s = await getSettings();
  return call('/api/agent?action=remember', { method: 'POST', body: JSON.stringify({ role: role || s.role, text, verified: true }) });
}
