// Discord delivery adapter (proactive DMs — reminders/escalations), complementing discord-webhook.mjs
// (which only answers slash commands). Discord has no persistent chat-id like Telegram: we only ever
// learn the user's Discord *user* id (captured by discord-webhook.mjs from interaction.member.user.id /
// interaction.user.id at /link time), so every send opens (or reuses) a DM channel via REST first.
// No Gateway needed: a bot can DM any user it shares a guild with purely over HTTP with its bot token.
const API = 'https://discord.com/api/v10';
const BUTTON_STYLE = 1; // primary

export function renderRoleTag(tag) {
  if (!tag) return '';
  const also = tag.alsoUsed?.length ? ` · also: ${tag.alsoUsed.join(', ')}` : '';
  return `\n\n_${tag.emoji ?? ''} ${tag.label}${also}_`;
}

export function createDiscordAdapter({ token, userId, fetchFn = globalThis.fetch, dmChannelCache = new Map() }) {
  if (!token || !userId) throw new TypeError('discord: token and userId required');
  const api = async (path, body) => {
    const r = await fetchFn(`${API}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bot ${token}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`discord ${path} failed: ${j.message ?? r.status}`);
    return j;
  };
  const dmChannelId = async () => {
    if (dmChannelCache.has(userId)) return dmChannelCache.get(userId);
    const ch = await api('/users/@me/channels', { recipient_id: userId });
    dmChannelCache.set(userId, ch.id);
    return ch.id;
  };
  return {
    id: 'discord', supportsButtons: true,
    presence() { return { state: 'unknown' }; }, // no Gateway connection, so no live presence signal
    async send(msg) {
      const channelId = await dmChannelId();
      const rows = msg.buttons?.length
        ? [{ type: 1, components: msg.buttons.slice(0, 5).map((b) => ({ type: 2, style: BUTTON_STYLE, label: b.label, custom_id: `${msg.occurrenceId}:${b.id}` })) }]
        : [];
      const content = msg.roleTag ? msg.text + renderRoleTag(msg.roleTag) : msg.text;
      return api(`/channels/${channelId}/messages`, { content, components: rows });
    },
  };
}
