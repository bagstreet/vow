import { get, set, call, isMuted, badge, POLL_MINUTES } from './lib.js';

const ICON = 'icons/128.png';
chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create('poll', { periodInMinutes: POLL_MINUTES }); void poll(); });
chrome.runtime.onStartup.addListener(() => { chrome.alarms.create('poll', { periodInMinutes: POLL_MINUTES }); void poll(); });
chrome.runtime.onMessage.addListener((m) => { if (m?.type === 'poll') void poll(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'poll') void poll(); });

export async function poll() {
  const { secret, mutedUntil, notified = [] } = await get(['secret', 'mutedUntil', 'notified']);
  if (!secret) return badge(0);
  const r = await call('poll');
  if (r.status === 401) { await set({ secret: null, items: [], authLost: true }); return badge('!'); }
  if (!r.ok) return; // offline or server error: keep the last known state, try again on the next alarm
  const items = r.items ?? [];
  await set({ items, authLost: false });
  await badge(items.length);
  if (isMuted(mutedUntil)) return; // muted reminders stay in the popup and are announced after unmuting
  const fresh = items.filter((i) => !notified.includes(i.id));
  for (const i of fresh) {
    const [yes, later] = [i.buttons[0], i.buttons.find((b) => b.id.startsWith('snooze'))];
    chrome.notifications.create(i.id, { type: 'basic', iconUrl: ICON, title: `Vow · ${i.role}`, message: i.title, requireInteraction: true, buttons: [{ title: yes.label }, { title: later?.label ?? 'Remind later' }] });
  }
  await set({ notified: [...notified.filter((id) => items.some((i) => i.id === id)), ...fresh.map((i) => i.id)] });
}

async function answer(id, button) {
  const r = await call('reply', { method: 'POST', body: { id, button } });
  chrome.notifications.clear(id);
  if (r.ok) await poll();
}

chrome.notifications.onButtonClicked.addListener(async (id, idx) => {
  const { items = [] } = await get(['items']);
  const item = items.find((i) => i.id === id); if (!item) return;
  const b = idx === 0 ? item.buttons[0] : item.buttons.find((x) => x.id.startsWith('snooze'));
  if (b) await answer(id, b.id);
});
