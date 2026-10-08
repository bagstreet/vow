// Dashboard API logic (pure; store/llm/memory injected so every branch is testable offline).
// One entry point: handleDash({ store, op, method, body, userId, deps }) -> { status, json, setCookie? }.
// Every op except login/magic-* requires a resolved session userId (resolved by the Vercel function).
import { ROLE_IDS } from '../../presets/roles/index.mjs';
import { chatReply, withRoleLabel, shouldRemember } from '../channels/chat.mjs';
import { hashToken, newToken } from './session.mjs';
import { manageTokens } from '../agent/agent.mjs';

export const CHANNELS = ['telegram', 'slack', 'discord'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const TONES = ['friendly', 'neutral', 'concise', 'strict'];
const LABEL_MODES = ['always', 'on_change', 'off'];
const ok = (json = {}, extra = {}) => ({ status: 200, json: { ok: true, ...json }, ...extra });
const err = (status, error) => ({ status, json: { ok: false, error } });

export function validTz(tz) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return typeof tz === 'string' && tz.length < 64; } catch { return false; } }

export function cleanReminder(b, { partial = false } = {}) {
  const o = {};
  if (!partial || b.title !== undefined) {
    const t = typeof b.title === 'string' ? b.title.trim() : '';
    if (!t || t.length > 80) return { error: 'bad_title' };
    o.title = t;
  }
  if (!partial || b.time !== undefined) {
    if (!TIME_RE.test(String(b.time ?? ''))) return { error: 'bad_time' };
    o.time = b.time;
  }
  if (!partial || b.days !== undefined) {
    const d = Array.isArray(b.days) ? [...new Set(b.days.map(Number))].sort() : [];
    if (!d.length || d.some((x) => !Number.isInteger(x) || x < 1 || x > 7)) return { error: 'bad_days' };
    o.days = d;
  }
  if (!partial || b.role !== undefined) {
    if (b.role !== undefined && !ROLE_IDS.includes(b.role)) return { error: 'bad_role' };
    if (b.role !== undefined) o.role = b.role;
  }
  if (b.channel !== undefined) {
    if (b.channel !== null && !CHANNELS.includes(b.channel)) return { error: 'bad_channel' };
    o.channel = b.channel;
  }
  if (b.enabled !== undefined) o.enabled = !!b.enabled;
  return { value: o };
}

export function cleanPrefs(b) {
  const o = {};
  if (b.tz !== undefined) { if (!validTz(b.tz)) return { error: 'bad_tz' }; o.tz = b.tz; }
  if (b.tone !== undefined) { if (!TONES.includes(b.tone)) return { error: 'bad_tone' }; o.tone = b.tone; }
  if (b.roleLabel !== undefined) { if (!LABEL_MODES.includes(b.roleLabel)) return { error: 'bad_role_label' }; o.roleLabel = b.roleLabel; }
  if (b.displayName !== undefined) { const n = String(b.displayName).trim(); if (!n || n.length > 80) return { error: 'bad_name' }; o.displayName = n; }
  if (b.ackMin !== undefined) { const n = Number(b.ackMin); if (!Number.isInteger(n) || n < 1 || n > 120) return { error: 'bad_ack' }; o.ackMin = n; }
  if (b.quiet !== undefined) {
    if (b.quiet === null) { o.quietStart = null; o.quietEnd = null; }
    else if (TIME_RE.test(b.quiet?.from) && TIME_RE.test(b.quiet?.to)) { o.quietStart = b.quiet.from; o.quietEnd = b.quiet.to; }
    else return { error: 'bad_quiet' };
  }
  if (b.priority !== undefined) {
    if (!Array.isArray(b.priority) || b.priority.some((c) => !CHANNELS.includes(c)) || new Set(b.priority).size !== b.priority.length) return { error: 'bad_priority' };
    o.priority = b.priority;
  }
  if (b.roles !== undefined) {
    if (!Array.isArray(b.roles) || !b.roles.length || b.roles.some((r) => !ROLE_IDS.includes(r))) return { error: 'bad_roles' };
    o.roles = [...new Set(b.roles)];
  }
  if (b.defaultRole !== undefined) { if (!ROLE_IDS.includes(b.defaultRole)) return { error: 'bad_role' }; o.defaultRole = b.defaultRole; }
  return { value: o };
}

export async function handleDash({ store, op, method, body = {}, userId, deps = {}, now = Date.now() }) {
  // ---- unauthenticated ops
  if (op === 'login' && method === 'POST') {
    const u = await store.consumeLoginToken(String(body.token ?? ''));
    if (!u) return err(401, 'invalid_or_expired');
    const token = newToken(); await store.createSession(u.id, hashToken(token));
    return ok({ userId: u.id }, { setSession: token });
  }
  if (op === 'magic-request' && method === 'POST') {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return err(400, 'bad_email');
    if (await store.countRecentMagic(email) >= 3) return err(429, 'too_many_requests');
    const token = newToken(); await store.createMagic(email, hashToken(token));
    if (deps.sendMagic) await deps.sendMagic(email, token); // same answer whether or not the email is known
    return ok({ sent: true });
  }
  if (op === 'magic-verify' && method === 'POST') {
    const email = await store.consumeMagic(hashToken(String(body.token ?? '')));
    if (!email) return err(401, 'invalid_or_expired');
    const u = await store.findOrCreateByEmail(email);
    const token = newToken(); await store.createSession(u.id, hashToken(token));
    return ok({ userId: u.id }, { setSession: token });
  }
  if (op === 'logout' && method === 'POST') return ok({}, { clearSession: true });

  // ---- authenticated ops
  if (!userId) return err(401, 'unauthorized');

  if (op === 'me' && method === 'GET') {
    const p = await store.getProfile(userId); if (!p) return err(401, 'unauthorized');
    const [channels, roles] = await Promise.all([store.listChannels(userId), store.listRoles(userId)]);
    return ok({ profile: p, channels, roles });
  }
  if (op === 'link-code' && method === 'POST') {
    if (!CHANNELS.includes(body.channel)) return err(400, 'bad_channel');
    const c = await store.createLinkCode({ userId, channel: body.channel });
    const deepLink = body.channel === 'telegram' && deps.telegramBot ? await deps.telegramBot().then((u) => (u ? `https://t.me/${u}?start=${c.code}` : undefined)) : undefined;
    return ok({ code: c.code, expiresAt: c.expiresAt, ttlMinutes: c.ttlMinutes, deepLink });
  }
  if (op === 'link-status' && method === 'GET') {
    if (!CHANNELS.includes(body.channel)) return err(400, 'bad_channel');
    return ok({ linked: await store.isChannelLinked({ userId, channel: body.channel }) });
  }
  if (op === 'prefs' && method === 'PATCH') {
    const c = cleanPrefs(body); if (c.error) return err(400, c.error);
    const v = c.value;
    if (v.roles) {
      await store.setRoles(userId, v.roles);
      const p = await store.getProfile(userId);
      if (!v.defaultRole && !v.roles.includes(p.default_role)) v.defaultRole = v.roles[0];
    }
    if (v.defaultRole && !(await store.listRoles(userId)).includes(v.defaultRole)) return err(400, 'default_role_not_enabled');
    await store.updateProfile(userId, v);
    return ok({ profile: await store.getProfile(userId), roles: await store.listRoles(userId) });
  }
  if (op === 'channels' && method === 'DELETE') {
    const list = await store.listChannels(userId);
    const target = list.find((c) => c.id === body.id); if (!target) return err(404, 'not_found');
    const profile = await store.getProfile(userId);
    if (list.filter((c) => c.enabled).length <= 1 && !profile.email) return err(409, 'last_login_method');
    await store.unlinkChannel(userId, target.id);
    return ok({});
  }
  if (op === 'reminders') {
    if (method === 'GET') return ok({ reminders: await store.listReminders(userId) });
    if (method === 'POST') {
      const c = cleanReminder(body); if (c.error) return err(400, c.error);
      const roles = await store.listRoles(userId);
      const role = c.value.role ?? roles[0]; if (!role || !roles.includes(role)) return err(400, 'role_not_enabled');
      if ((await store.listReminders(userId)).length >= 50) return err(409, 'limit_reached');
      return ok({ reminder: await store.createReminder(userId, { ...c.value, role }) });
    }
    if (method === 'PATCH') {
      const c = cleanReminder(body, { partial: true }); if (c.error) return err(400, c.error);
      const r = await store.updateReminder(userId, String(body.id), c.value); return r ? ok({ reminder: r }) : err(404, 'not_found');
    }
    if (method === 'DELETE') return (await store.deleteReminder(userId, String(body.id))) ? ok({}) : err(404, 'not_found');
  }
  if (op === 'history' && method === 'GET') {
    const memory = await store.listMemoryLog(userId, 100);
    await resolveBlobIds(memory, store, deps.memory);
    return ok({ messages: await store.listMessages(userId, 100), memory });
  }
  if (op === 'agent-tokens') return manageTokens({ store, method, body, userId });
  if (op === 'memory-forget' && method === 'POST') {
    const id = String(body.id ?? ''); if (!id) return err(400, 'id_required');
    return (await store.forgetMemory(userId, id)) ? ok({ forgotten: true, note: 'Hidden from future answers. The Walrus blob is immutable and stays on the network.' }) : err(404, 'not_found');
  }
  if (op === 'chat' && method === 'POST') {
    const text = String(body.text ?? '').trim();
    if (!text) return err(400, 'empty'); if (text.length > 2000) return err(400, 'too_long');
    const profile = await store.getProfile(userId);
    const enabled = await store.listRoles(userId);
    const [history, remembered] = await Promise.all([store.getHistory(userId, 12), deps.memory ? deps.memory.recall(userId, text) : []]);
    const r = await chatReply({ text, enabled, def: profile.default_role, llm: deps.llm, history, remembered, tone: profile.tone });
    const reply = withRoleLabel(r.text, r.role, profile.role_label === 'change' ? 'on_change' : profile.role_label, profile.last_role);
    await store.saveMessage(userId, 'web', 'in', text, r.role); await store.saveMessage(userId, 'web', 'out', r.text, r.role);
    if (r.role) await store.setLastRole(userId, r.role);
    let jobId = null;
    if (deps.memory && shouldRemember(text, r.role)) {
      jobId = await deps.memory.remember(userId, `[web/${r.role}] user: ${text}`);
      await store.logMemory(userId, { channel: 'web', kind: 'chat', preview: text.slice(0, 160), jobId });
    }
    return ok({ reply: r.text, labelled: reply, role: r.role, remembered: remembered.length, memoryJob: jobId });
  }
  if (op === 'transcribe' && method === 'POST') {
    const audio = String(body.audio ?? ''); if (!audio) return err(400, 'empty');
    if (audio.length > 4_000_000) return err(413, 'too_long');
    if (!deps.transcribe) return err(501, 'stt_unavailable');
    try { const text = await deps.transcribe(audio, String(body.mime ?? 'audio/webm')); return text ? ok({ text }) : err(422, 'no_speech'); }
    catch { return err(502, 'stt_failed'); }
  }
  if (op === 'export' && method === 'GET') return ok({ exportedAt: new Date(now).toISOString(), data: await store.exportAll(userId) });
  if (op === 'account' && method === 'DELETE') {
    if (body.confirm !== 'DELETE') return err(400, 'confirm_required');
    await store.deleteAccount(userId);
    return ok({}, { clearSession: true });
  }
  return err(404, 'unknown_op');
}

/** Fill in blob_id for recent writes whose Walrus upload has finished (MemWal's remember only returns a job_id). Best effort, bounded. */
export async function resolveBlobIds(rows, store, memory, max = 8) {
  if (!memory?.jobStatus || !store.setBlobId) return;
  const pending = rows.filter((m) => m.job_id && !m.blob_id).slice(0, max);
  await Promise.all(pending.map(async (m) => {
    const { blobId } = await memory.jobStatus(m.job_id);
    if (blobId) { m.blob_id = blobId; try { await store.setBlobId(m.id, blobId); } catch (e) { console.error('setBlobId failed', e.message); } }
  }));
}
