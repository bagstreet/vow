// When a reminder is answered in one channel, every copy of it sent to other channels is edited to "✓ handled" (not deleted).
// A message ref is "<chatOrChannelId>:<messageId>" captured at send time (outbox.msg_ref).
const split = (ref) => { const i = String(ref).indexOf(':'); return i < 1 ? null : [ref.slice(0, i), ref.slice(i + 1)]; };
const LABEL = { taken: 'taken', done: 'done', skip: 'skipped', skipped: 'skipped', snooze: 'snoozed', later: 'snoozed' };

export function handledText(title, status, via) {
  return `✓ ${title}: ${LABEL[status] ?? status}${via ? ` (answered in ${via})` : ''}`;
}

/** tokens: {telegram?, slack?, discord?}. Returns a function settle({title,status,via,messages:[{channel,ref}]}) that never throws. */
export function createSettler(tokens, fetchFn = globalThis.fetch) {
  const post = (url, headers, method, body) => fetchFn(url, { method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const editors = {
    telegram: async (ref, text) => { const p = split(ref); if (!p) return;
      await post(`https://api.telegram.org/bot${tokens.telegram}/editMessageText`, {}, 'POST', { chat_id: p[0], message_id: Number(p[1]), text, reply_markup: { inline_keyboard: [] } }); },
    slack: async (ref, text) => { const p = split(ref); if (!p) return;
      await post('https://slack.com/api/chat.update', { authorization: `Bearer ${tokens.slack}` }, 'POST', { channel: p[0], ts: p[1], text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }] }); },
    discord: async (ref, text) => { const p = split(ref); if (!p) return;
      await post(`https://discord.com/api/v10/channels/${p[0]}/messages/${p[1]}`, { authorization: `Bot ${tokens.discord}` }, 'PATCH', { content: text, components: [] }); },
  };
  return async function settle({ title, status, via, messages = [] }) {
    const text = handledText(title, status, via);
    const done = [];
    for (const m of messages) {
      if (!m.ref || !tokens[m.channel] || !editors[m.channel]) continue;
      try { await editors[m.channel](m.ref, text); done.push(m.channel); } catch { /* best effort: an edit failure must never block the ack */ }
    }
    return done;
  };
}
