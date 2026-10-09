// Browser extension channel endpoint. Routes: POST /api/ext?action=pair | GET ?action=poll | POST ?action=reply
import { createSql } from '../../../packages/db/neon.mjs';
import { createNeonStore } from '../../../packages/core/channels/neon-store.mjs';
import { createSettler } from '../../../packages/core/delivery/handled.mjs';
import { handleExtension } from '../../../packages/core/channels/extension.mjs';
import { buildMemory } from '../lib/memory-stack.mjs';

const settle = createSettler({ telegram: process.env.TELEGRAM_BOT_TOKEN, slack: process.env.SLACK_BOT_TOKEN, discord: process.env.DISCORD_BOT_TOKEN });

export default async function handler(req, res) {
  try {
    const store = createNeonStore(createSql());
    const bearer = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const r = await handleExtension({ store, memory: req.query?.action === 'reply' ? buildMemory(store, 'extension') : null, settle, action: String(req.query?.action ?? ''), method: req.method, body, bearer });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(r.status).json(r.json);
  } catch (e) {
    console.error('ext', e.message);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
