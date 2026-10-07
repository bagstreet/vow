// Free-text chat: pick role (explicit prefix > default > first enabled), build prompt, ask router, return text.
import { ROLES, ROLE_IDS } from '../../presets/roles/index.mjs';

export function pickRole(text, enabled, def) {
  const m = String(text).match(/^\s*(?:role:|@)?\s*(\w+)\s*[:,]\s*(.+)$/is);
  if (m && ROLES[m[1].toLowerCase()] && enabled.includes(m[1].toLowerCase())) return { role: m[1].toLowerCase(), text: m[2].trim() };
  const role = enabled.includes(def) ? def : enabled[0] ?? null;
  return { role, text: String(text).trim() };
}

export async function chatReply({ text, enabled, def, llm }) {
  if (!enabled.length) return { text: 'No roles are enabled yet. Turn some on in the dashboard.', role: null };
  const { role, text: q } = pickRole(text, enabled, def);
  const system = `${ROLES[role].prompt}\nContext: enabled roles: ${enabled.filter((r) => ROLE_IDS.includes(r)).join(', ')}. Active role: ${role}.`;
  const out = await llm.complete({ task: 'chat', messages: [{ role: 'system', content: system }, { role: 'user', content: q }], maxTokens: 400 });
  return { text: out.text, role };
}
