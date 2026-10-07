// Free-text chat: pick role (explicit prefix > default > first enabled), build prompt, ask router, return text.
import { ROLES, ROLE_IDS } from '../../presets/roles/index.mjs';

export function pickRole(text, enabled, def) {
  const m = String(text).match(/^\s*(?:role:|@)?\s*(\w+)\s*[:,]\s*(.+)$/is);
  if (m && ROLES[m[1].toLowerCase()] && enabled.includes(m[1].toLowerCase())) return { role: m[1].toLowerCase(), text: m[2].trim() };
  const role = enabled.includes(def) ? def : enabled[0] ?? null;
  return { role, text: String(text).trim() };
}

// Short-term dialog memory: history is prior turns for this user, oldest first,
// [{ direction: 'in'|'out', appRole: <coaching role this turn belongs to, or null>, content }].
// Only turns tagged with the currently active role are replayed as context (a role switch starts a
// fresh view so the model does not answer as the wrong coach); capped at MAX_HISTORY_TURNS so prompts
// stay small and old context cannot leak once the user has moved on.
export const MAX_HISTORY_TURNS = 6;

export function trimHistory(history, role) {
  if (!Array.isArray(history) || !role) return [];
  return history.filter((h) => h && h.content && (h.appRole === undefined || h.appRole === null || h.appRole === role)).slice(-MAX_HISTORY_TURNS * 2);
}

export async function chatReply({ text, enabled, def, llm, history }) {
  if (!enabled.length) return { text: 'No roles are enabled yet. Turn some on in the dashboard.', role: null };
  const { role, text: q } = pickRole(text, enabled, def);
  const system = `${ROLES[role].prompt}\nContext: enabled roles: ${enabled.filter((r) => ROLE_IDS.includes(r)).join(', ')}. Active role: ${role}. If asked who you are or what you can do, briefly say you are Vow, a reminder and coaching assistant, and describe what the active role helps with (do not name the underlying model); then invite a question in scope. Politely decline only unrelated topics.`;
  const prior = trimHistory(history, role).map((h) => ({ role: h.direction === 'out' ? 'assistant' : 'user', content: h.content }));
  const messages = [{ role: 'system', content: system }, ...prior, { role: 'user', content: q }];
  const out = await llm.complete({ task: 'chat', messages, maxTokens: 400 });
  return { text: out.text, role };
}

/** Role label: mode always | on_change | off. lastRole unknown => treated as a change. */
export function withRoleLabel(text, role, mode = 'always', lastRole = null) {
  if (!role || mode === 'off' || (mode === 'on_change' && role === lastRole)) return text;
  return `${ROLES[role].emoji} ${ROLES[role].label}\n${text}`;
}
