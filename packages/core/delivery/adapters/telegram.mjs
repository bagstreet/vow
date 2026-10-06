// Telegram adapter (T47). Bot API via injectable fetch; no live calls without a bot token.
// Status: implemented, tested offline with mock fetch. NOT tested live.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** RoleTag {id, emoji, label, alsoUsed[]} -> last small italic line (Telegram has no footer). */
export function renderRoleTag(tag) {
  if (!tag) return '';
  const also = tag.alsoUsed?.length ? ` · also: ${tag.alsoUsed.join(', ')}` : '';
  return `\n\n<i>${esc(tag.emoji ?? '')} ${esc(tag.label)}${esc(also)}</i>`;
}

export function createTelegramAdapter({ token, chatId, fetchFn = globalThis.fetch, lastSeen = () => null, now = Date.now, onlineWindowMs = 5 * 60_000 }) {
  if (!token || !chatId) throw new TypeError('telegram: token and chatId required');
  const api = async (method, body) => {
    const r = await fetchFn(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(`telegram ${method} failed: ${j.description ?? r.status}`);
    return j.result;
  };
  return {
    id: 'telegram', supportsButtons: true,
    presence() {
      const ts = lastSeen();
      if (ts == null) return { state: 'unknown' };
      return now() - ts <= onlineWindowMs ? { state: 'online', ts } : { state: 'last_seen', ts };
    },
    send(msg) {
      const rows = [msg.buttons.map(b => ({ text: b.label, callback_data: `${msg.occurrenceId}:${b.id}` }))];
      if (msg.roleTag) rows.push([{ text: '🔁 Role', callback_data: `${msg.occurrenceId}:role` }]);
      const body = { chat_id: chatId, text: msg.roleTag ? esc(msg.text) + renderRoleTag(msg.roleTag) : msg.text, reply_markup: { inline_keyboard: rows } };
      if (msg.roleTag) body.parse_mode = 'HTML';
      return api('sendMessage', body);
    },
    // Feed callback_query updates here; returns {occurrenceId, reply} or null. Caller passes it to bus.ack.
    parseUpdate(update) {
      const cq = update?.callback_query;
      if (!cq || String(cq.message?.chat?.id) !== String(chatId)) return null;
      const i = String(cq.data ?? '').lastIndexOf(':');
      if (i < 1) return null;
      return { occurrenceId: cq.data.slice(0, i), reply: cq.data.slice(i + 1), callbackId: cq.id };
    },
    ackCallback: id => api('answerCallbackQuery', { callback_query_id: id }),
  };
}
