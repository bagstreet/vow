// Agent API logic (pure; store/memory injected). External AI agents (and the MCP bridge) talk to Vow with a
// role-scoped token: they may only write VERIFIED facts for roles the user allowed, and read back only those roles.
import { ROLE_IDS } from '../../presets/roles/index.mjs';
import { hashToken, newToken } from '../dashboard/session.mjs';

export const AGENT_LIMITS = { tokensPerUser: 5, writesPerHour: 30, textMax: 600, textMin: 8 };
const ok = (json, status = 200) => ({ status, json: { ok: true, ...json } });
const err = (status, error) => ({ status, json: { ok: false, error } });
const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim();

/** Dashboard side: create / list / revoke tokens. The raw token is returned exactly once. */
export async function manageTokens({ store, method, body, userId }) {
  if (method === 'GET') return ok({ tokens: await store.listAgentTokens(userId) });
  if (method === 'POST') {
    const label = clean(body.label).slice(0, 40);
    const roles = [...new Set(Array.isArray(body.roles) ? body.roles.map(String) : [])];
    if (!label) return err(400, 'label_required');
    if (!roles.length || roles.some((r) => !ROLE_IDS.includes(r))) return err(400, 'invalid_roles');
    if ((await store.listAgentTokens(userId)).filter((t) => !t.revoked_at).length >= AGENT_LIMITS.tokensPerUser) return err(409, 'token_limit');
    const raw = 'vow_' + newToken();
    const t = await store.createAgentToken(userId, { hash: hashToken(raw), label, roles });
    return ok({ token: raw, id: t.id, label, roles, note: 'Shown once. Store it in your agent; it can only write verified facts for these roles.' }, 201);
  }
  if (method === 'DELETE') return (await store.revokeAgentToken(userId, String(body.id ?? ''))) ? ok({}) : err(404, 'not_found');
  return err(405, 'method');
}

/** Agent side. action: me | remember | recall. */
export async function handleAgent({ store, memory, action, method, body, bearer }) {
  if (!bearer || !bearer.startsWith('vow_')) return err(401, 'unauthorized');
  const tok = await store.agentTokenByHash(hashToken(bearer));
  if (!tok || tok.revoked_at) return err(401, 'unauthorized');
  await store.touchAgentToken(tok.id);
  if (action === 'me' && method === 'GET') return ok({ label: tok.label, roles: tok.roles, limits: AGENT_LIMITS });
  if (action === 'remember' && method === 'POST') {
    const role = String(body.role ?? '');
    if (!tok.roles.includes(role)) return err(403, 'role_not_allowed');
    if (body.verified !== true) return err(400, 'verified_required'); // the agent must assert it checked the fact
    const text = clean(body.text);
    if (text.length < AGENT_LIMITS.textMin) return err(400, 'text_too_short');
    if (text.length > AGENT_LIMITS.textMax) return err(400, 'text_too_long');
    if ((await store.countAgentWrites(tok.user_id, tok.label)) >= AGENT_LIMITS.writesPerHour) return err(429, 'rate_limited');
    if (!memory) return err(503, 'memory_unavailable');
    const jobId = await memory.remember(tok.user_id, `[agent:${tok.label}][${role}] ${text}`);
    return ok({ stored: Boolean(jobId), jobId: jobId ?? null }, 201);
  }
  if (action === 'recall' && method === 'GET') {
    const q = clean(body.q); if (!q) return err(400, 'q_required');
    if (!memory) return err(503, 'memory_unavailable');
    const hits = await memory.recall(tok.user_id, q, { limit: 6 });
    // role scoping: only snippets tagged with an allowed role, or untagged chat memory is NOT shared with agents
    const allowed = hits.filter((h) => tok.roles.some((r) => String(h).includes(`[${r}]`)));
    return ok({ results: allowed });
  }
  return err(404, 'unknown_action');
}
