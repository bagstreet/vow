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
