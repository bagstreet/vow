export const QUICK_REPLIES = Object.freeze([
  { id: 'taken', label: 'Taken', alias: 'yes' },
  { id: 'skipped', label: 'Skipped', alias: 'no' },
  { id: 'snooze', label: 'Snooze', alias: 'later' },
]);

// The reminder text never gives medical advice: only the user's own label and time.
const ADVICE = /\b(dose|dosage|prescri\w*|diagnos\w*|mg|ml|increase|decrease|you should take|recommend\w*)\b/i;

export function buildReminder(occurrence, { text } = {}) {
  const label = String(text ?? occurrence.label ?? 'your reminder').slice(0, 120);
  if (ADVICE.test(label)) throw new Error('reminder text must not contain medical advice or dosage');
  return {
    occurrenceId: occurrence.id,
    text: `Reminder: ${label}`,
    buttons: QUICK_REPLIES.map(({ id, label: l }) => ({ id, label: l })),
  };
}

export function replyToCheckin(reply, occurrence, now = Date.now()) {
  const q = QUICK_REPLIES.find(r => r.id === reply || r.alias === String(reply).toLowerCase());
  if (!q) throw new Error(`unknown quick reply: ${reply}`);
  return { type: 'CHECKIN', occurrenceId: occurrence.id, status: q.id, at: now };
}

// AI-selected buttons (T47): the model may only PICK ids from this closed catalog; it never invents labels or actions.
export const BUTTON_CATALOG = Object.freeze({
  taken:      { label: 'Taken',        status: 'taken' },
  skipped:    { label: 'Skip',         status: 'skipped' },
  snooze:     { label: 'Remind later', status: 'snooze' },
  snooze_1h:  { label: 'In 1 hour',    status: 'snooze', snoozeMin: 60 },
  cancel:     { label: 'Cancel series', status: 'skipped', stopSeries: true },
});
export const DEFAULT_BUTTON_IDS = Object.freeze(['taken', 'skipped', 'snooze']);

// Validates a model suggestion: unknown ids dropped, dupes removed, max 4, must keep an
// answer ('taken'|'skipped') and a deferral ('snooze'*); otherwise falls back to the default set.
export function selectButtons(suggested) {
  const ids = [...new Set(Array.isArray(suggested) ? suggested.filter(i => typeof i === 'string' && Object.hasOwn(BUTTON_CATALOG, i)) : [])].slice(0, 4);
  const ok = ids.some(i => i === 'taken') && ids.some(i => BUTTON_CATALOG[i].status === 'snooze');
  const final = ok ? ids : DEFAULT_BUTTON_IDS;
  return final.map(id => ({ id, label: BUTTON_CATALOG[id].label }));
}

export function checkinFromButton(buttonId, occurrence, now = Date.now()) {
  const b = BUTTON_CATALOG[buttonId];
  if (!b) return replyToCheckin(buttonId, occurrence, now);
  const { label, ...rest } = b;
  return { type: 'CHECKIN', occurrenceId: occurrence.id, at: now, ...rest };
}
