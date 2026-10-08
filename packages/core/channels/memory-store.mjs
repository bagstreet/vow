// Generic in-memory store for offline tests, shared by every channel adapter (Telegram/Slack/Discord).
// Same interface as createNeonStore; chat/channel ids are namespaced by channel so the same external id
// on two different channels never collides.
export function createMemoryStore() {
  const s = { seen: new Set(), codes: new Map(), chats: new Map(), roles: new Map(), acks: [], logins: [], quiet: new Map(), def: new Map(), history: new Map() };
  const key = (channel, chat) => `${channel}:${chat}`;
  return {
    _s: s,
    seenUpdate: async (id) => (s.seen.has(id) ? true : (s.seen.add(id), false)),
    registerLinkCode: (code, userId, channel = 'telegram') => { s.codes.set(code, { userId, channel }); },
    consumeLinkCode: async (c, channel = 'telegram') => {
      const r = s.codes.get(c);
      if (!r || (r.channel && r.channel !== channel)) return null;
      s.codes.delete(c);
      return { userId: r.userId };
    },
    linkChannel: async (userId, channel, chat) => { s.chats.set(key(channel, chat), { id: userId }); },
    userByChat: async (chat, channel = 'telegram') => s.chats.get(key(channel, chat)) ?? null,
    listRoles: async (u) => s.roles.get(u) ?? [],
    setDefaultRole: async (u, r) => { s.def.set(u, r); },
    setLastRole: async (u, r) => { s.def.set(`last:${u}`, r); },
    setQuiet: async (u, v) => { s.quiet.set(u, v); },
    setChannelPriority: async (u, l) => { s.prio = s.prio ?? new Map(); s.prio.set(u, l); },
    touchChannel: async () => {},
    ackOccurrence: async (id, reply) => { s.acks.push([id, reply]); },
    createLoginToken: async (u) => { const t = 'tok' + s.logins.length; s.logins.push([u, t]); return t; },
    getHistory: async (u, limit = 12) => (s.history.get(u) ?? []).slice(-limit),
    saveMessage: async (u, _channel, direction, content, role) => {
      const h = s.history.get(u) ?? []; h.push({ direction, appRole: role ?? null, content }); s.history.set(u, h);
    },
  };
}
