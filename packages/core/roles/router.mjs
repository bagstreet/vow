// Rule-based role router (T49 step 3). Pure, no network. Model fallback is step 4.
import { ROLES, ROLE_IDS } from '../../presets/roles/index.mjs';

export const STICKY_MS = 30 * 60 * 1000;
const CRISIS = /\b(kill myself|suicide|want to die|self[- ]harm|overdose)\b/i;
const INJECTION = /ignore (all |your |previous )*(instructions|role|rules)|system prompt|you are now/i;
const OFFTOPIC = /\b(poem|joke|who won|weather|stock price|bitcoin price|write (me )?(code|a story|an essay))\b/i;
const MEDICAL_Q = /\b(headache|fever|diagnos|symptom of|what (drug|medicine) (should|for)|dosage for)\b/i;
const LEARNING = /\b(learning|learn|reading) about\b/i;
const STUDY_PLAN = /\b(study (block|plan|schedule)|plan my study|exam|homework|revise)\b/i;

const done = (o) => ({ primary: null, secondary: [], kind: 'log', confidence: 1, reason: '', outOfScope: false, needsModel: false, crisis: false, ...o });

export function route(text, ctx = {}) {
  const enabled = (ctx.enabled ?? ROLE_IDS).filter((r) => ROLES[r]);
  const t = String(text ?? '').trim();
  if (CRISIS.test(t)) return done({ primary: enabled.includes('sobriety') ? 'sobriety' : enabled[0] ?? null, crisis: true, reason: 'crisis wording' });
  // 2. occurrence context: role already known, no model call (even if role was later disabled)
  if (ctx.occurrenceRole) return done({ primary: ctx.occurrenceRole, reason: 'occurrence' });
  if (INJECTION.test(t)) return done({ outOfScope: true, reason: 'injection' });
  // 1. explicit command or named role
  // '@' only addresses a role on web; in Telegram/Slack/Discord '@' is a user/bot mention, so use /role, "role: text" or "ask the X".
  const atOk = !ctx.channel || ctx.channel === 'web';
  const prefix = atOk ? '[\\/@]' : '[\\/]';
  const cmd = t.match(new RegExp('^' + prefix + '(?:role\\s+)?(fitness|medication|sobriety|health|study)(?:@\\w+)?\\b', 'i'))
    || t.match(/^(fitness|medication|sobriety|health|study)\s*:\s*\S/i);
  if (cmd && enabled.includes(cmd[1].toLowerCase())) return done({ primary: cmd[1].toLowerCase(), reason: 'explicit' });
  const named = t.match(/\bask (?:the )?(fitness|medication|sobriety|health|study|nutrition)\b/i);
  if (named) { const id = named[1].toLowerCase() === 'nutrition' ? 'fitness' : named[1].toLowerCase(); if (enabled.includes(id)) return done({ primary: id, reason: 'named' }); }
  if (MEDICAL_Q.test(t) && !/\b(period|cycle)\b/i.test(t)) return done({ outOfScope: true, reason: 'medical-question', kind: 'log' });
  if (OFFTOPIC.test(t)) return done({ outOfScope: true, reason: 'off-topic' });
  // learning about a topic of another role is still study
  if (LEARNING.test(t) || STUDY_PLAN.test(t)) { if (enabled.includes('study')) return done({ primary: 'study', kind: 'study', reason: 'study wording' }); }
  // 4. keywords
  const low = t.toLowerCase();
  const scores = enabled.map((id) => [id, ROLES[id].keywords.filter((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(low)).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const sticky = ctx.sticky && ctx.now - ctx.sticky.at <= STICKY_MS && enabled.includes(ctx.sticky.role) ? ctx.sticky.role : null;
  if (scores.length) {
    const [top, ...rest] = scores;
    const tie = rest.length && rest[0][1] === top[1];
    if (tie && sticky && scores.some(([id]) => id === sticky)) return done({ primary: sticky, secondary: scores.map(([i]) => i).filter((i) => i !== sticky), reason: 'tie->sticky', confidence: 0.6 });
    return done({ primary: top[0], secondary: rest.map(([i]) => i), confidence: tie ? 0.5 : 0.8, reason: 'keywords', needsModel: !!tie });
  }
  // 3. sticky
  if (sticky) return done({ primary: sticky, reason: 'sticky', confidence: 0.6 });
  return done({ primary: null, reason: 'no match', confidence: 0, needsModel: true });
}

/** Role label policy (dashboard setting): 'always' | 'on_change' | 'off'. Pure. */
export function shouldShowRoleLabel(mode, role, lastRole) {
  if (mode === 'off') return false;
  if (mode === 'always') return true;
  return role !== lastRole;
}
