// One-time reminder wording: today, tonight, tomorrow, once, next <weekday>, in N minutes/hours, ISO date, "on Oct 12". Pure, no I/O.
import { tzOffsetMin } from '../scheduler/time.mjs';

const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const ONCE_WORDS = /\b(?:tomorrow|tonight|today|once|one[- ]time|next\s+(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*|in\s+\d{1,3}\s*(?:min(?:ute)?s?|h(?:ou)?rs?|hours?)|\d{4}-\d{2}-\d{2}|on\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?)\b/gi;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Returns { date: 'YYYY-MM-DD' (user-local), time?: 'HH:MM' (only for relative "in N minutes") } or null for recurring wording. */
export function resolveOnce(text, { now = Date.now(), tz = 'UTC', time = null } = {}) {
  const t = String(text).toLowerCase();
  const local = new Date(now + tzOffsetMin(tz, now) * 60000); // UTC fields = user-local wall clock
  const day = (add) => ymd(new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + add)));
  let m;
  if ((m = t.match(/\bin\s+(\d{1,3})\s*(min(?:ute)?s?|h(?:ou)?rs?|hours?)\b/))) {
    const mins = +m[1] * (/^h/.test(m[2]) ? 60 : 1);
    const at = new Date(local.getTime() + mins * 60000);
    return { date: ymd(at), time: `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}` };
  }
  if ((m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return { date: m[0] };
  if ((m = t.match(/\bon\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/))) {
    const mo = MON.indexOf(m[1]); let y = local.getUTCFullYear();
    if (Date.UTC(y, mo, +m[2]) < Date.UTC(y, local.getUTCMonth(), local.getUTCDate())) y++;
    return { date: ymd(new Date(Date.UTC(y, mo, +m[2]))) };
  }
  if ((m = t.match(/\bnext\s+(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/))) {
    const diff = ((WD.indexOf(m[1]) - local.getUTCDay() + 7) % 7) || 7;
    return { date: day(diff) };
  }
  const past = time && time <= `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
  if (/\btomorrow\b/.test(t)) return { date: day(1) };
  if (/\b(today|tonight)\b/.test(t)) return { date: day(past ? 1 : 0) };
  if (/\b(once|one[- ]time)\b/.test(t)) return { date: day(past ? 1 : 0) };
  return null;
}
