// Pure time helpers for the reminder scheduler. No I/O.
/** Offset (minutes east of UTC) of an IANA zone at instant `ms`. Falls back to 0 for unknown zones. */
export function tzOffsetMin(tz, ms) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 60000);
  } catch { return 0; }
}

/** Next fire instant (ms) strictly after `now` for a daily-time reminder. days: ISO weekdays 1..7 (Mon=1). */
export function computeNextFire({ timeLocal, days = [1, 2, 3, 4, 5, 6, 7], tz = 'UTC' }, now) {
  const [hh, mm] = String(timeLocal).split(':').map(Number);
  const allowed = new Set(days.length ? days : [1, 2, 3, 4, 5, 6, 7]);
  const off = tzOffsetMin(tz, now);
  const local = new Date(now + off * 60000);
  for (let d = 0; d <= 8; d++) {
    const base = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + d, hh, mm);
    const wd = new Date(base).getUTCDay() || 7;
    const cand = base - tzOffsetMin(tz, base - off * 60000) * 60000;
    if (allowed.has(wd) && cand > now) return cand;
  }
  return null; // no allowed day
}

export function parseArr(v) {
  if (Array.isArray(v)) return v.map(Number);
  if (typeof v === 'string') return v.replace(/[{}]/g, '').split(',').filter(Boolean).map(Number);
  return [];
}

/** text[] column -> string[] (Neon returns either a JS array or a '{a,b}' literal). parseArr is numeric-only. */
export function parseTextArr(v) {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return v.replace(/^\{|\}$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '').trim()).filter(Boolean);
  return [];
}
