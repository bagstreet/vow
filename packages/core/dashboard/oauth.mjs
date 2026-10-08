// Real "Sign in with Discord / Slack" (OAuth2 authorization-code flow). Pure: fetch and store injected.
// Flow: /api/dash/oauth-start?provider=X -> provider consent -> /api/dash/oauth-callback?code&state -> session cookie -> /dashboard.
import { randomBytes } from 'node:crypto';

export const PROVIDERS = {
  discord: { authorize: 'https://discord.com/oauth2/authorize', scope: 'identify' },
  slack: { authorize: 'https://slack.com/openid/connect/authorize', scope: 'openid profile' },
};

export function startUrl(provider, { clientId, redirectUri }) {
  const p = PROVIDERS[provider]; if (!p || !clientId) return null;
  const state = randomBytes(16).toString('base64url');
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: p.scope, state, ...(provider === 'slack' ? { team: process.env.SLACK_TEAM_ID || 'T0BA1NY055L' } : {}) });
  return { url: `${p.authorize}?${q}`, state };
}

const form = (o) => new URLSearchParams(o).toString();

/** Exchange code -> the provider-side account id we link on. Throws on any failure. */
export async function resolveIdentity(provider, code, { clientId, clientSecret, redirectUri, botToken }, fetchFn = globalThis.fetch) {
  const post = (url, body) => fetchFn(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form(body) }).then((r) => r.json());
  if (provider === 'discord') {
    const t = await post('https://discord.com/api/oauth2/token', { client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    if (!t.access_token) throw new Error('token_exchange_failed');
    const u = await fetchFn('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${t.access_token}` } }).then((r) => r.json());
    if (!u.id) throw new Error('no_identity');
    return { channel: 'discord', chat: String(u.id), name: u.global_name ?? u.username ?? null };
  }
  if (provider === 'slack') {
    const t = await post('https://slack.com/api/openid.connect.token', { client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    if (!t.ok || !t.access_token) throw new Error('token_exchange_failed');
    const u = await fetchFn('https://slack.com/api/openid.connect.userInfo', { headers: { authorization: `Bearer ${t.access_token}` } }).then((r) => r.json());
    const slackUser = u['https://slack.com/user_id'] ?? u.sub; if (!slackUser) throw new Error('no_identity');
    // The bot's DM id for this person is what channel_links stores for Slack, so resolve it.
    const o = await fetchFn('https://slack.com/api/conversations.open', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${botToken}` }, body: JSON.stringify({ users: slackUser }) }).then((r) => r.json());
    if (!o.ok) throw new Error('dm_open_failed');
    return { channel: 'slack', chat: o.channel.id, name: u.name ?? null };
  }
  throw new Error('unknown_provider');
}

/** Find the account for this identity or create one (sign-in with a messenger is also sign-up). */
export async function loginWithIdentity(store, id) {
  const found = await store.userByChat(id.chat, id.channel);
  if (found) { await store.touchChannel?.(id.chat, id.channel); return { userId: found.id, created: false }; }
  const c = await store.signUp(id.channel, id.chat, id.name);
  return { userId: c.id, created: true };
}
