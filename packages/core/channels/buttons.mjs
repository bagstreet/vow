// Model-chosen quick buttons, restricted to a fixed catalog. Any failure falls back to the defaults.
export const BUTTON_CATALOG = {
  taken: 'Taken', skip: 'Skip', snooze: 'Remind later', done: 'Done', yes: 'Yes', no: 'No', cancel: 'Cancel',
};
export const DEFAULT_BUTTONS = ['taken', 'skip', 'snooze'];

export function sanitizeButtons(ids, max = 4) {
  const seen = [...new Set((Array.isArray(ids) ? ids : []).filter((i) => Object.hasOwn(BUTTON_CATALOG, i)))].slice(0, max);
  return seen.length >= 2 ? seen : DEFAULT_BUTTONS;
}

export async function pickButtons({ llm, role, reminderText }) {
  try {
    const sys = `Choose 2-4 quick-reply button ids for a ${role} reminder. Allowed ids: ${Object.keys(BUTTON_CATALOG).join(', ')}. Reply with a JSON array of ids only.`;
    const out = await llm.complete({ task: 'buttons', messages: [{ role: 'system', content: sys }, { role: 'user', content: String(reminderText).slice(0, 300) }], maxTokens: 40 });
    const m = String(out.text).match(/\[[^\]]*\]/);
    return sanitizeButtons(m ? JSON.parse(m[0]) : null);
  } catch { return DEFAULT_BUTTONS; }
}
