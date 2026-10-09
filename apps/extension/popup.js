import { get, set, call, isMuted, muteUntil, badge, DEFAULT_BASE } from './lib.js';
const $ = (id) => document.getElementById(id);
const msg = (t) => { $('msg').textContent = t ?? ''; };

async function render() {
  const { secret, items = [], mutedUntil, muteKind, authLost, base } = await get(['secret', 'items', 'mutedUntil', 'muteKind', 'authLost', 'base']);
  $('pair').hidden = !!secret; $('main').hidden = !secret;
  $('base').value = base ?? DEFAULT_BASE;
  $('state').textContent = secret ? (isMuted(mutedUntil) ? 'muted' : 'connected') : '';
  if (authLost) msg('This browser was disconnected in the dashboard. Pair it again.');
  $('mute').value = isMuted(mutedUntil) ? (muteKind ?? 'off') : '';
  $('empty').hidden = items.length > 0;
  $('items').replaceChildren(...items.map((i) => {
    const li = document.createElement('li'); const t = document.createElement('div'); t.textContent = `${i.title} (${i.role})`; li.append(t);
    for (const b of i.buttons) { const x = document.createElement('button'); x.textContent = b.label; x.onclick = async () => { const r = await call('reply', { method: 'POST', body: { id: i.id, button: b.id } }); if (r.ok) { const next = items.filter((y) => y.id !== i.id); await set({ items: next }); await badge(next.length); chrome.notifications.clear(i.id); await render(); } else msg('Could not send the answer. Try again.'); }; li.append(x); }
    return li;
  }));
}

$('go').onclick = async () => {
  msg('');
  const base = $('base').value.trim().replace(/\/+$/, '') || DEFAULT_BASE;
  if (base !== DEFAULT_BASE) { const ok = await chrome.permissions.request({ origins: [`${new URL(base).origin}/*`] }); if (!ok) return msg('Permission for that server was not granted.'); }
  const r = await call('pair', { method: 'POST', body: { code: $('code').value.trim() }, base });
  if (!r.ok) return msg(r.error === 'invalid_or_expired_code' ? 'That code is invalid or expired. Create a new one in the dashboard.' : 'Could not connect. Check the code.');
  await set({ secret: r.secret, base, items: [], notified: [], authLost: false, mutedUntil: 0 });
  chrome.alarms.create('poll', { periodInMinutes: 1 });
  chrome.runtime.sendMessage({ type: 'poll' }).catch(() => {}); // fetch the first reminders right away
  msg('Connected. Reminders arrive here and as notifications.'); await render();
};
$('mute').onchange = async () => { const v = $('mute').value; await set({ mutedUntil: muteUntil(v), muteKind: v || null }); await render(); };
$('test').onclick = () => chrome.notifications.create('vow-test', { type: 'basic', iconUrl: 'icons/128.png', title: 'Vow', message: 'Notifications work. Real reminders show Taken, Skip and Later.' });
$('unpair').onclick = async () => { await set({ secret: null, items: [], notified: [] }); await badge(0); msg('Disconnected here. Remove the channel in the dashboard to stop reminders being sent to it.'); await render(); };
void render();
