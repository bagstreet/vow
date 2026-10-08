// Delivery channel choice (T47 wired into the tick). The bot picks the channel, the user does not have to.
// Order: explicit user priority list (if set) > most recent activity (last_seen_at) > DEFAULT_ORDER.
// Channels already tried for this occurrence are excluded by the store, so escalation always moves to the next one.
import { DEFAULT_ORDER } from './registry.mjs';

const idx = (list, id) => { const i = list.indexOf(id); return i < 0 ? list.length : i; };
export const KNOWN_CHANNELS = ['telegram', 'discord', 'slack'];

export function orderChannels(channels, priority = []) {
  return [...channels].sort((a, b) =>
    idx(priority, a.channel) - idx(priority, b.channel) ||
    (Number(b.lastSeenAt) || 0) - (Number(a.lastSeenAt) || 0) ||
    idx(DEFAULT_ORDER, a.channel) - idx(DEFAULT_ORDER, b.channel));
}

/** "slack, telegram" / "slack>telegram" -> ['slack','telegram']; unknown names dropped; 'auto'/'' -> [] */
export function parsePriority(text) {
  const out = [];
  for (const t of String(text ?? '').toLowerCase().split(/[\s,>;]+/)) if (KNOWN_CHANNELS.includes(t) && !out.includes(t)) out.push(t);
  return out;
}
