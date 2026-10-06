import { DEFAULT_ORDER } from './registry.mjs';

const idx = (list, id) => { const i = list.indexOf(id); return i < 0 ? list.length : i; };

async function probe(adapter) {
  try {
    const p = (await adapter.presence()) || {};
    return { state: ['online', 'last_seen'].includes(p.state) ? p.state : 'unknown', ts: Number(p.ts) || 0 };
  } catch { return { state: 'unknown', ts: 0 }; }
}

// Order: online now > most recent activity > user priority list > default order (desktop first).
export async function rankChannels(adapters, { priority = [], exclude = [] } = {}) {
  const rows = [];
  for (const a of adapters) {
    if (exclude.includes(a.id)) continue;
    rows.push({ adapter: a, presence: await probe(a) });
  }
  const tier = r => (r.presence.state === 'online' ? 0 : r.presence.state === 'last_seen' ? 1 : 2);
  rows.sort((x, y) =>
    tier(x) - tier(y) ||
    (tier(x) === 1 ? y.presence.ts - x.presence.ts : 0) ||
    idx(priority, x.adapter.id) - idx(priority, y.adapter.id) ||
    idx(DEFAULT_ORDER, x.adapter.id) - idx(DEFAULT_ORDER, y.adapter.id));
  return rows.map(r => ({ id: r.adapter.id, adapter: r.adapter, presence: r.presence }));
}
