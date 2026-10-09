// Browser-extension channel. The extension pairs once with a dashboard code (like Telegram's /link), then polls for the
// reminders the delivery router addressed to it and answers them with the same quick-reply buttons as every other channel.
// Pure logic: store/memory/settle are injected. Routes: POST ?action=pair {code} | GET ?action=poll | POST ?action=reply {id, button}
import { createHash, randomBytes } from 'node:crypto';
import { selectButtons } from '../delivery/quickreply.mjs';

export const hashSecret = (s) => createHash('sha256').update(String(s)).digest('hex');
const ok = (json, status = 200) => ({ status, json: { ok: true, ...json } });
const err = (status, error) => ({ status, json: { ok: false, error } });
const CODE_RE = /^[A-Z0-9]{6,12}$/;

export async function handleExtension({ store, memory, settle, action, method, body = {}, bearer }) {
  if (action === 'pair' && method === 'POST') {
    const code = String(body.code ?? '').trim().toUpperCase();
    if (!CODE_RE.test(code)) return err(400, 'bad_code');
    const r = await store.consumeLinkCode(code, 'extension');
    if (!r) return err(400, 'invalid_or_expired_code');
    const secret = 'vowx_' + randomBytes(24).toString('base64url');
    await store.pairExtension(r.userId, hashSecret(secret));
    return ok({ secret }, 201);
  }
  if (!bearer || !bearer.startsWith('vowx_')) return err(401, 'unauthorized');
  const user = await store.userByChat(hashSecret(bearer), 'extension');
  if (!user) return err(401, 'unauthorized');
  if (user.blocked) return err(403, 'blocked');
  if (action === 'poll' && method === 'GET') {
    const rows = await store.extensionInbox(user.id);
    return ok({ items: rows.map((o) => ({ id: o.id, title: o.title, role: o.role, buttons: selectButtons(null, o.role) })) });
  }
  if (action === 'reply' && method === 'POST') {
    const id = String(body.id ?? ''), button = String(body.button ?? '');
    const item = (await store.extensionInbox(user.id)).find((o) => o.id === id);
    if (!item) return err(404, 'not_found');
    if (!selectButtons(null, item.role).some((b) => b.id === button)) return err(400, 'bad_button');
    const info = await store.ackOccurrence(id, button);
    if (!info) return err(404, 'not_found');
    await store.touchChannel?.(hashSecret(bearer), 'extension');
    if (settle) await settle({ ...info, status: button, via: 'browser extension' });
    if (memory) await memory.remember(user.id, `[check-in, extension] "${info.title}" (${info.role}) -> ${button}`);
    return ok({ status: button });
  }
  return err(404, 'unknown_action');
}
