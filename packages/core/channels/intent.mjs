import { resolveOnce, ONCE_WORDS } from './once.mjs';
// Deterministic intent layer that runs BEFORE the LLM chat. Free text that is really an action
// ("I took it", "remind me to take vitamin D at 9", "list my reminders", "delete the vitamin reminder")
// is executed against the same reminders/outbox the dashboard shows, so chat and dashboard never diverge.
// Pure: store, memory and settle are injected. Multilingual (EN/RU) regex, no model call, no cost.
import { route } from '../roles/router.mjs';

const DAY_NAMES = [[1, /(?:^|[^\p{L}\d_])(mon(?:day)?|пн|понедельник[\p{L}\d_]*)/i], [2, /(?:^|[^\p{L}\d_])(tue(?:s|sday)?|вт|вторник[\p{L}\d_]*)/i], [3, /(?:^|[^\p{L}\d_])(wed(?:nesday)?|ср|сред[\p{L}\d_]*)/i],
  [4, /(?:^|[^\p{L}\d_])(thu(?:r|rs|rsday)?|чт|четверг[\p{L}\d_]*)/i], [5, /(?:^|[^\p{L}\d_])(fri(?:day)?|пт|пятниц[\p{L}\d_]*)/i], [6, /(?:^|[^\p{L}\d_])(sat(?:urday)?|сб|суббот[\p{L}\d_]*)/i], [7, /(?:^|[^\p{L}\d_])(sun(?:day)?|вс|воскресень[\p{L}\d_]*)/i]];
const ALL = [1, 2, 3, 4, 5, 6, 7];

const SKIP = /(не\s+(?:принял|приняла|выпил|выпила|сделал|сделала|смог|смогла|буду)|пропустил[\p{L}\d_]*|(?<![\p{L}\d_])skip(?:ped)?(?![\p{L}\d_])|(?<![\p{L}\d_])missed(?![\p{L}\d_])|didn'?t\s+(?:take|do)|not\s+today|не\s+сегодня)/ui;
const LATER = /(напомни\s+(?:мне\s+)?(?:позже|через)|попозже|(?<![\p{L}\d_])snooze(?![\p{L}\d_])|remind me (?:later|in)|later please)/ui;
const TAKEN = /(выполнено|готово|отметь\s+(?:как\s+)?(?:выполнен\w*|принят\w*|сделан\w*)|принял[аи]?|выпил[аи]?|съел[аи]?|сделал[аи]?|выполнил[аи]?|потренировал[\p{L}\d_]*|позанимал[\p{L}\d_]*|(?<![\p{L}\d_])took(?![\p{L}\d_])|(?<![\p{L}\d_])taken(?![\p{L}\d_])|(?<![\p{L}\d_])done(?![\p{L}\d_])|(?<![\p{L}\d_])finished(?![\p{L}\d_])|(?<![\p{L}\d_])completed(?![\p{L}\d_])|(?<![\p{L}\d_])had it(?![\p{L}\d_])|(?<![\p{L}\d_])did it(?![\p{L}\d_])|записывай что принял)/ui;
const CREATE = /(напомни(?:ть)?(?![\p{L}\d_])|(?:создай|добавь|поставь|сделай)\s+напоминани[\p{L}\d_]*|remind me|(?:set|create|add)\s+(?:a\s+)?reminder)/ui;
const LIST = /((?:мои|все|список|покажи|показать)\s+напоминани[\p{L}\d_]*|what reminders|(?:my|list|show)\s+(?:all\s+)?reminders|\/reminders)/ui;
const DELETE = /((?:удали|отмени|убери|выключи)\s+(?:мне\s+)?напоминани[\p{L}\d_]*|(?:delete|remove|cancel)\s+(?:the\s+|my\s+)?(?:[\p{L}\d_]+\s+)?reminder)/ui;

const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, 'twenty five': 25, 'twenty-five': 25, thirty: 30, forty: 40, 'forty five': 45, 'forty-five': 45 };
const NW = Object.keys(NUM_WORDS).sort((a, b) => b.length - a.length).join('|');
const num = (x) => (/^\d+$/.test(x) ? +x : NUM_WORDS[x.toLowerCase()]);
const hhmm = (h, m) => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const PART = '(?:\\s+(?:in the|at)\\s+(morning|afternoon|evening|night)|\\s+(am|pm|a\\.m\\.|p\\.m\\.))?';
function applyPart(h, part, ampm) {
  const p = (part ?? '').toLowerCase(); const a = (ampm ?? '').replace(/\./g, '').toLowerCase();
  if ((p === 'afternoon' || p === 'evening' || a === 'pm') && h < 12) return h + 12;
  if (p === 'night' && h >= 6 && h < 12) return h + 12;
  if ((p === 'morning' || p === 'night' || a === 'am') && h === 12) return 0;
  return h;
}
/** Rewrite spoken times ("noon", "half past one", "quarter to 5", "7 in the evening", "12h", "9 o'clock") to "at HH:MM". */
export function normalizeTimeWords(text) {
  let t = String(text);
  t = t.replace(/(?<![\p{L}\d_])(?:at\s+)?(noon|midday)(?![\p{L}\d_])/giu, ' at 12:00 ')
    .replace(/(?<![\p{L}\d_])(?:at\s+)?midnight(?![\p{L}\d_])/giu, ' at 00:00 ')
    .replace(new RegExp(`(?<![\\p{L}\\d_])(?:at\\s+)?(half|quarter|(?:${NW})(?:\\s+minutes?)?)\\s+(past|after|to|till|before)\\s+(\\d{1,2}|${NW})${PART}(?![\\p{L}\\d_])`, 'giu'),
      (_, a, dir, hh, part, ampm) => {
        const amount = /^half/i.test(a) ? 30 : /^quarter/i.test(a) ? 15 : num(a.replace(/\s+minutes?$/i, ''));
        let h = num(hh); if (!amount || !h) return _;
        const before = /^(to|till|before)$/i.test(dir);
        h = applyPart(h, part, ampm);
        return before ? ` at ${hhmm(h - 1, 60 - amount)} ` : ` at ${hhmm(h, amount)} `;
      })
    .replace(new RegExp(`(?<![\\p{L}\\d_])(?:at\\s+)?(\\d{1,2}|${NW})\\s*(?:o'?\\s?clock|oclock)${PART}(?![\\p{L}\\d_])`, 'giu'),
      (_, hh, part, ampm) => { const h = num(hh); return h ? ` at ${hhmm(applyPart(h, part, ampm), 0)} ` : _; })
    .replace(/(?<![\p{L}\d_.:])(?:at\s+)?(\d{1,2})\s*(?:h|hrs?|hours?)(?![\p{L}\d_])(?!\s+(?:a|per|every|before|after|of)\b)/giu, (_, hh) => (+hh <= 23 ? ` at ${hhmm(+hh, 0)} ` : _))
    .replace(new RegExp(`(?<![\\p{L}\\d_])at\\s+(\\d{1,2}|${NW})\\s+(fifteen|twenty|twenty[ -]five|thirty|forty|forty[ -]five|fifty|ten|five|oh\\s?(?:one|two|three|four|five|six|seven|eight|nine))${PART}(?![\\p{L}\\d_])`, 'giu'),
      (_, hh, mm, part, ampm) => { const h = num(hh); const mn = /^oh/i.test(mm) ? NUM_WORDS[mm.replace(/^oh\s?/i, '').toLowerCase()] : (mm.toLowerCase() === 'fifty' ? 50 : num(mm.toLowerCase().replace(' ', '-'))); return h && mn != null ? ` at ${hhmm(applyPart(h, part, ampm), mn)} ` : _; })
    .replace(new RegExp(`(?<![\\p{L}\\d_])at\\s+(${NW})${PART}(?![\\p{L}\\d_])`, 'giu'), (_, hh, part, ampm) => ` at ${hhmm(applyPart(num(hh), part, ampm), 0)} `)
    .replace(new RegExp(`(?<![\\d.:])(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s+(?:in the|at)\\s+(morning|afternoon|evening|night)(?![\\p{L}\\d_])`, 'giu'),
      (_, hh, mm, part) => (+hh <= 12 ? ` at ${hhmm(applyPart(+hh, part, ''), +(mm ?? 0))} ` : _));
  return t.replace(/\s{2,}/g, ' ').trim();
}

export function parseTime(text) {
  const t = normalizeTimeWords(text);
  let m = t.match(/(?:(?<![\p{L}\d_])в(?![\p{L}\d_])|(?<![\p{L}\d_])at(?![\p{L}\d_])|(?<![\p{L}\d_])to(?![\p{L}\d_])|(?<![\p{L}\d_])к(?![\p{L}\d_]))?\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?/ui);
  let h; let min;
  if (m) { h = +m[1]; min = +m[2]; if (/pm/ui.test(m[3] ?? '') && h < 12) h += 12; if (/am/ui.test(m[3] ?? '') && h === 12) h = 0; }
  else {
    m = t.match(/(?:(?<![\p{L}\d_])в(?![\p{L}\d_])|(?<![\p{L}\d_])at(?![\p{L}\d_])|(?<![\p{L}\d_])к(?![\p{L}\d_]))\s*(\d{1,2})\s*(am|pm|утра|вечера|дня|ночи)?(?!\d)/ui);
    if (!m) return null;
    h = +m[1]; min = 0; const p = (m[2] ?? '').toLowerCase();
    if ((p === 'pm' || p === 'вечера' || p === 'дня') && h < 12) h += 12;
    if ((p === 'am' || p === 'утра' || p === 'ночи') && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function parseDays(text) {
  const t = String(text);
  if (/(по\s+будн[\p{L}\d_]+|weekdays?|(?<![\p{L}\d_])mon(?:day)?\s*(?:-|to|до)\s*fri)/ui.test(t)) return [1, 2, 3, 4, 5];
  if (/(по\s+выходн[\p{L}\d_]+|weekends?)/ui.test(t)) return [6, 7];
  const named = DAY_NAMES.filter(([, re]) => re.test(t)).map(([n]) => n);
  return named.length && !/(каждый день|ежедневно|every\s*day|daily)/ui.test(t) ? named : ALL;
}

function titleOf(text) {
  return normalizeTimeWords(text)
    .replace(ONCE_WORDS, ' ').replace(CREATE, ' ').replace(/(?:(?<![\p{L}\d_])(?:в|at|к)(?![\p{L}\d_])\s*\d{1,2}(?:[:.]\d{2})?(?!\d)\s*(?:am|pm|утра|вечера|дня|ночи)?|(?<![\d.:])\d{1,2}[:.]\d{2}(?![\d])\s*(?:am|pm|утра|вечера|дня|ночи)?|(?<![\d.:])\d{1,2}\s*(?:am|pm|утра|вечера|дня|ночи)(?![\p{L}\d_]))/ugi, ' ')
    .replace(/(каждый день|ежедневно|every\s*day|daily|по\s+будн[\p{L}\d_]+|по\s+выходн[\p{L}\d_]+|weekdays?|weekends?|мне|please|пожалуйста|on)/ugi, ' ')
    .replace(/(?:^|\s)(?:о|об|про|что|to|about|that)\s+/ugi, ' ')
    .replace(/[,.!?]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Classify a message. Returns {type, ...} or null (falls through to the LLM chat). */
export function parseIntent(text) {
  const t = normalizeTimeWords(String(text ?? '').trim());
  if (!t || t.startsWith('/') && !/^\/reminders(?![\p{L}\d_])/ui.test(t) || t.length > 240) return null;
  if (LIST.test(t)) return { type: 'list' };
  if (DELETE.test(t)) return { type: 'delete', query: t.replace(DELETE, ' ').replace(/[,.!?]+/g, ' ').replace(/\s+/g, ' ').trim() };
  if (CREATE.test(t) && !LATER.test(t.replace(ONCE_WORDS, ' '))) return { type: 'create', time: parseTime(t), days: parseDays(t), title: titleOf(t) };
  if (t.includes('?')) return null; // questions go to the model
  if (LATER.test(t)) return { type: 'ack', status: 'snooze' };
  if (SKIP.test(t)) return { type: 'ack', status: 'skip' };
  if (TAKEN.test(t) && t.length <= 120) return { type: 'ack', status: 'taken' };
  return null;
}

const DAYS_EN = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const fmtDays = (d) => (!d || d.length === 7 ? 'daily' : d.join() === '1,2,3,4,5' ? 'weekdays' : d.map((x) => DAYS_EN[x]).join(', '));
export const fmtReminder = (r, i) => `${i + 1}. ${r.title} — ${r.time} ${r.date ? `once on ${r.date}` : fmtDays(r.days)} (${r.role})${r.enabled === false ? ' [off]' : ''}`;

const FILLER = new Set(['record', 'log', 'note', 'mark', 'save', 'that', 'this', 'just', 'already', 'today', 'now', 'thanks', 'thank', 'please', 'the', 'and', 'it', 'my', 'all', 'as', 'was', 'have', 'had', 'did', 'done', 'took', 'taken', 'finished', 'completed', 'ok', 'okay', 'yes', 'yep',
  'запиши', 'записать', 'отметь', 'что', 'это', 'уже', 'как', 'мои', 'мой', 'сегодня', 'принял', 'принята', 'готово', 'выполнено', 'сделал', 'выпил', 'съел', 'спасибо', 'пожалуйста', 'все', 'всё', 'да']);
/** True when the message names something that is clearly not the open check-in (e.g. a different supplement). */
export function mentionsOtherSubject(text, title) {
  const words = String(text).toLowerCase().match(/[\p{L}]{3,}/gu) ?? [];
  const extra = words.filter((w) => !FILLER.has(w));
  if (!extra.length) return false;
  const t = String(title).toLowerCase();
  return !extra.some((w) => t.includes(w.slice(0, 4)));
}

/** Execute an action intent. Returns { text, role? } or null when the text is not an action. */
export async function runIntent({ text, user, store, memory, settle, channel, enabled = [] }) {
  const it = parseIntent(text);
  if (!it) return null;
  if (it.type === 'ack') {
    const occ = await store.latestOpenOccurrence?.(user.id);
    if (!occ) return null; // nothing pending: let the model treat it as an ordinary message/fact
    if (it.status === 'taken' && mentionsOtherSubject(text, occ.title)) return null; // "took magnesium" must not close "drink water"
    const info = await store.ackOccurrence(occ.id, it.status === 'snooze' ? 'later' : it.status);
    if (info && settle) await settle({ ...info, status: it.status === 'snooze' ? 'later' : it.status, via: channel });
    const label = { taken: 'taken', skip: 'skipped', snooze: 'snoozed' }[it.status];
    if (it.status !== 'snooze' && memory) await memory.remember(user.id, `[check-in, ${channel}] "${occ.title}" (${occ.role}) -> ${label} (said in chat)`);
    return { text: it.status === 'snooze' ? `Okay, I will remind you about "${occ.title}" again later.` : `✓ Logged: "${occ.title}" — ${label}.`, role: occ.role };
  }
  if (it.type === 'list') {
    const list = (await store.listUserReminders?.(user.id)) ?? [];
    return { text: list.length ? `Your reminders:\n${list.map(fmtReminder).join('\n')}\n\nEdit or delete them in the dashboard, or say "delete reminder <name>".` : 'You have no reminders yet. Say e.g. "remind me to take vitamin D at 9:00 daily".' };
  }
  if (it.type === 'delete') {
    const list = (await store.listUserReminders?.(user.id)) ?? [];
    const n = it.query.match(/(?:№|#|(?<![\p{L}\d_]))(\d{1,2})(?![\p{L}\d_])/)?.[1];
    const q = it.query.toLowerCase().replace(/(?<![\p{L}\d_])(the|my|мое|моё|про|о)(?![\p{L}\d_])/g, '').trim();
    const hits = n ? list.filter((_, i) => i + 1 === +n) : list.filter((r) => q && r.title.toLowerCase().includes(q));
    if (hits.length !== 1) return { text: hits.length ? `Several match, say the number:\n${list.map(fmtReminder).join('\n')}` : `I could not find that reminder. Yours:\n${list.map(fmtReminder).join('\n') || '(none)'}` };
    await store.removeUserReminder(user.id, hits[0].id);
    return { text: `🗑 Deleted reminder "${hits[0].title}". Say "remind me…" to create it again.` };
  }
  // create
  if (!it.title) return { text: 'What should I remind you about? E.g. "remind me to take vitamin D at 9:00 daily".' };
  const once = resolveOnce(text, { tz: user.tz ?? 'UTC', time: it.time });
  if (once?.time) it.time = once.time; // "in 20 minutes"
  if (!it.time) return { text: `At what time? E.g. "remind me ${it.title} at 9:00 daily".` };
  const list = (await store.listUserReminders?.(user.id)) ?? [];
  if (list.length >= 50) return { text: 'You have reached the limit of 50 reminders. Delete some in the dashboard.' };
  const routed = route(it.title, { enabled, channel }).primary;
  const role = enabled.includes(routed) ? routed : enabled.includes(user.default_role) ? user.default_role : enabled[0];
  if (!role) return { text: 'No roles are enabled yet. Turn one on in the dashboard first.' };
  const dup = list.find((r) => r.title.toLowerCase() === it.title.toLowerCase() && r.time === it.time && (r.date ?? null) === (once?.date ?? null));
  if (dup) return { text: `You already have "${dup.title}" at ${dup.time}.`, role };
  await store.addUserReminder(user.id, { title: it.title, time: it.time, days: it.days, role, date: once?.date ?? null });
  if (memory) await memory.remember(user.id, `[schedule, ${channel}] reminder "${it.title}" at ${it.time} ${once ? `once on ${once.date}` : fmtDays(it.days)} (${role})`);
  return { text: `✓ Reminder created: "${it.title}" — ${it.time} ${once ? `once on ${once.date}` : fmtDays(it.days)}, role ${role}. It shows up in the dashboard under Reminders (edit/delete there or here).`, role };
}

/** Context block so the model can answer "what was that reminder?" instead of guessing. */
export function scheduleContext(reminders = [], lastOcc = null) {
  const parts = [];
  if (reminders.length) parts.push(`User's reminders: ${reminders.slice(0, 20).map((r) => `"${r.title}" ${r.time} ${r.date ? `once on ${r.date}` : fmtDays(r.days)} (${r.role})`).join('; ')}.`);
  if (lastOcc) parts.push(`Most recent reminder sent to the user: "${lastOcc.title}" (${lastOcc.role}), status ${lastOcc.status}.`);
  if (lastOcc && ['sent', 'escalated'].includes(lastOcc.status)) parts.push('That check-in is still open. If the user\'s message answers it (taken, skipped, later, a detail about it), treat it as the reply. If it is about something else, answer that topic and do not ask what they "took".');
  return parts.join(' ');
}

export async function loadSchedule(store, userId) {
  try { return scheduleContext((await store.listUserReminders?.(userId)) ?? [], (await store.lastReminderSent?.(userId)) ?? null); } catch { return ''; }
}
