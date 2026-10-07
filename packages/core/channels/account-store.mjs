// Account + channel-link store for the dashboard-facing API (T54, DASHBOARD_UX_AUDIT §C).
// Separate from neon-store.mjs (bot message/webhook store) because callers and auth model differ:
// these are called by Vercel API routes the browser hits directly, never by the Telegram webhook.
import { randomInt } from 'node:crypto';

// Avoid visually ambiguous characters (0/O, 1/I/L) since humans type this manually as /link CODE.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 8;
const CODE_TTL_MINUTES = 10;
const LOGIN_TOKEN_TTL_MINUTES = 10;

function genCode() {
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export function createAccountStore(sql) {
  return {
    // Stand-in for real OAuth/email sign-in (out of scope for this pass): creates a bare account row.
    async createUser({ displayName } = {}) {
      const r = await sql('insert into users(display_name) values ($1) returning id, display_name, tz, tone', [displayName ?? null]);
      return r[0];
    },

    async getUser(userId) {
      const r = await sql('select id, display_name, tz, tone from users where id = $1', [userId]);
      return r[0] ?? null;
    },

    // One code can be outstanding per (user, channel); issuing a new one retires the old ones.
    async createLinkCode({ userId, channel }) {
      await sql('delete from link_codes where user_id = $1 and channel = $2 and used_at is null', [userId, channel]);
      let code = genCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const r = await sql(
          "insert into link_codes(code, user_id, channel, expires_at) values ($1,$2,$3, now() + interval '10 minutes') on conflict (code) do nothing returning code, expires_at",
          [code, userId, channel],
        );
        if (r[0]) return { code: r[0].code, expiresAt: r[0].expires_at, ttlMinutes: CODE_TTL_MINUTES };
        code = genCode(); // extremely unlikely collision; retry with a fresh code
      }
      throw new Error('could not allocate a unique link code');
    },

    async isChannelLinked({ userId, channel }) {
      const r = await sql('select 1 from channel_links where user_id = $1 and channel = $2 and enabled limit 1', [userId, channel]);
      return r.length > 0;
    },

    // Reverse path: bot's /login command issued a token (neon-store.mjs createLoginToken); the web /login
    // page exchanges it here, one-time, short TTL.
    async consumeLoginToken(token) {
      const r = await sql('update login_tokens set used_at = now() where token = $1 and used_at is null and expires_at > now() returning user_id', [token]);
      if (!r[0]) return null;
      return this.getUser(r[0].user_id);
    },
  };
}

export const LINK_CODE_TTL_MINUTES = CODE_TTL_MINUTES;
export const LOGIN_TOKEN_TTL_MINUTES_EXPORT = LOGIN_TOKEN_TTL_MINUTES;
