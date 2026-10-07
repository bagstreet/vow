// Model-chosen quick buttons. The model only PICKS ids from the closed catalog in delivery/quickreply.mjs
// (single source of truth, so callbacks always resolve). Any failure falls back to the defaults.
import { BUTTON_CATALOG, DEFAULT_BUTTON_IDS, selectButtons } from '../delivery/quickreply.mjs';

export { BUTTON_CATALOG };
export const DEFAULT_BUTTONS = DEFAULT_BUTTON_IDS;

/** Validates ids; returns button objects {id,label}. */
export function sanitizeButtons(ids) { return selectButtons(ids); }

export async function pickButtons({ llm, role, reminderText }) {
  try {
    const sys = `Choose 2-4 quick-reply button ids for a ${role} reminder. Allowed ids: ${Object.keys(BUTTON_CATALOG).join(', ')}. Always include taken and one snooze option. Reply with a JSON array of ids only.`;
    const out = await llm.complete({ task: 'buttons', messages: [{ role: 'system', content: sys }, { role: 'user', content: String(reminderText).slice(0, 300) }], maxTokens: 40 });
    const m = String(out.text).match(/\[[^\]]*\]/);
    return selectButtons(m ? JSON.parse(m[0]) : null);
  } catch { return selectButtons(null); }
}
