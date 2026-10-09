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

// Tone only changes phrasing; it never overrides role scope or safety wording.
export const TONE_HINT = { friendly: 'Tone: warm, encouraging, a little informal.', neutral: '', concise: 'Tone: shortest possible replies, no filler.', strict: 'Tone: direct accountability language, no fluff.' };

export async function chatReply({ text, enabled, def, llm, history, remembered, tone, schedule }) {
  if (!enabled.length) return { text: 'No roles are enabled yet. Turn some on in the dashboard.', role: null };
  const { role, text: q } = pickRole(text, enabled, def);
  const memoryBlock = Array.isArray(remembered) && remembered.length
    ? `\nLong-term memory about this user (from past sessions/channels, most relevant first): ${remembered.map((m) => `"${m}"`).join('; ')}. Use it only if relevant; never invent memories that are not listed here. If what the user now says conflicts with a remembered fact (for example a different dose, weight, diet or allergy), do NOT silently pick one: name both versions, say which is newer if known, and ask which is correct before treating either as final.`
    : '';
  const system = `${ROLES[role].prompt}\nContext: enabled roles: ${enabled.filter((r) => ROLE_IDS.includes(r)).join(', ')}. Active role: ${role}. If asked who you are or what you can do, briefly say you are Vow, a reminder and coaching assistant, and describe what the active role helps with (do not name the underlying model); then invite a question in scope. Politely decline only unrelated topics. Grounding rule: you only know what is in this conversation, the long-term memory list and the reminder list given here. Never claim or imply past activity, habits, streaks, progress, doses or earlier conversations that are not listed there. If asked about something with no record, say plainly that you have no record of it and offer to note it now.${TONE_HINT[tone] ? `\n${TONE_HINT[tone]} Safety and crisis wording are never changed by tone.` : ''}${memoryBlock}${schedule ? `\n${schedule} If the user asks about one of their reminders, answer from this list; never say you have no information about a reminder that appears here. Reminders are created, listed and deleted by the user saying so in chat or in the dashboard.` : ''}`;
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

// Memory-write filter: only durable, on-topic facts go to Walrus (every blob costs gas and is immutable).
const SMALL_TALK = /^(ping|test|hi|hello|hey|yo|hello there|hi there|hey there|good (morning|evening|night|day)|how are you|what'?s up|got it|cool|nice|great|lol|ok thanks|thanks a lot|добрый (день|вечер|утро)|доброе утро|как дела|понял|ясно|круто|отлично|ok|okay|thanks|thank you|thx|спасибо|привет|здравствуй(те)?|ок|хорошо|да|нет|yes|no|bye|пока|\?+|\.+)[\s!.?,]*$/i;
export function shouldRemember(text, role) {
  const t = String(text ?? '').trim();
  if (!role) return false;            // off-topic / refused: no role matched
  if (t.length < 8) return false;     // too short to carry a fact
  if (t.startsWith('/')) return false; // commands
  if (SMALL_TALK.test(t)) return false;
  return true;
}

/** Per-channel outbound limits (characters): Telegram 4096, Discord 2000, Slack ~4000 per message. */
export const CHANNEL_LIMITS = { telegram: 4096, discord: 2000, slack: 3900, web: 8000 };

/** Split a long reply into chunks within `max`, preferring paragraph, then line, then word boundaries. */
export function splitMessage(text, max = 4000) {
  const out = []; let rest = String(text ?? '');
  while (rest.length > max) {
    const win = rest.slice(0, max);
    let cut = Math.max(win.lastIndexOf('\n\n'), win.lastIndexOf('\n'), win.lastIndexOf(' '));
    if (cut < max * 0.5) cut = max;
    out.push(rest.slice(0, cut).trimEnd()); rest = rest.slice(cut).trimStart();
  }
  if (rest || !out.length) out.push(rest);
  return out;
}
