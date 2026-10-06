import { rankChannels } from './presence.mjs';
import { buildReminder, replyToCheckin } from './quickreply.mjs';

export const MAX_PERMITS = 2; // DOMAIN_CONTRACT §8 global cap
export const ACK_TIMEOUT_MIN = { def: 10, min: 2, max: 120 };

export function normalizeSettings(s = {}) {
  const t = Number(s.ackTimeoutMin);
  const ackTimeoutMin = Number.isFinite(t) ? Math.min(ACK_TIMEOUT_MIN.max, Math.max(ACK_TIMEOUT_MIN.min, t)) : ACK_TIMEOUT_MIN.def;
  return { ackTimeoutMin, priority: s.priority ?? [], quietHours: s.quietHours ?? null, utcOffsetMin: s.utcOffsetMin ?? 0 };
}

export function inQuietHours(now, { quietHours, utcOffsetMin }) {
  if (!quietHours) return false;
  const m = Math.floor((now / 60000 + utcOffsetMin) % 1440 + 1440) % 1440;
  const p = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const s = p(quietHours.start), e = p(quietHours.end);
  return s <= e ? m >= s && m < e : m >= s || m < e;
}

export class InMemoryPermitStore {
  #m = new Map();
  has(k) { return this.#m.has(k); }
  put(k, v) { this.#m.set(k, v); }
  get(k) { return this.#m.get(k); }
}

// ack(occurrenceId, reply) may arrive before or after waitFor(); early acks are remembered.
export class AckBus {
  #early = new Map(); #waiters = new Map();
  constructor({ setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout } = {}) { this.st = setTimeoutFn; this.ct = clearTimeoutFn; }
  ack(id, reply) {
    const w = this.#waiters.get(id);
    if (w) { this.#waiters.delete(id); this.ct(w.timer); w.resolve(reply); } else this.#early.set(id, reply);
  }
  waitFor(id, ms) {
    if (this.#early.has(id)) { const r = this.#early.get(id); this.#early.delete(id); return Promise.resolve(r); }
    return new Promise(resolve => {
      const timer = this.st(() => { this.#waiters.delete(id); resolve(null); }, ms);
      this.#waiters.set(id, { resolve, timer });
    });
  }
}

async function sendWithRetry(adapter, msg, { attempts = 3, backoffMs = 200, sleep }) {
  for (let i = 1; i <= attempts; i++) {
    try { await adapter.send(msg); return true; } catch { if (i < attempts) await sleep(backoffMs * 2 ** (i - 1)); }
  }
  return false;
}

// Single dispatcher per account (MVP). Failed sends never consume a permit; max 2 delivered sends.
export async function dispatchReminder({ account, occurrence, registry, bus, store = new InMemoryPermitStore(),
  settings = {}, now = Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms)), retry = {} }) {
  const cfg = normalizeSettings(settings);
  if (inQuietHours(now, cfg)) return { status: 'deferred_quiet_hours', sends: [] };
  const sends = []; const tried = [];
  const msg = buildReminder(occurrence);
  for (let permit = 1; permit <= MAX_PERMITS; permit++) {
    const key = `${account}:${occurrence.id}:${permit}`;
    let delivered = store.get(key)?.channel ?? null;       // restart: permit already used -> do not resend
    if (!delivered) {
      const ranked = await rankChannels(registry.list(), { priority: cfg.priority, exclude: tried });
      for (const r of ranked) {
        tried.push(r.id);
        if (await sendWithRetry(r.adapter, { ...msg, permit }, { sleep, ...retry })) { delivered = r.id; break; }
      }
      if (!delivered) break;                                 // nothing deliverable -> unacknowledged
      store.put(key, { channel: delivered, at: now });
      sends.push({ permit, channel: delivered });
    } else tried.push(delivered);
    const reply = await bus.waitFor(occurrence.id, cfg.ackTimeoutMin * 60000);
    if (reply != null) return { status: 'acknowledged', checkin: replyToCheckin(reply, occurrence), sends };
  }
  return { status: 'unacknowledged', sends };               // never 'skipped'
}
