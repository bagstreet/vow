// Agent API: role-scoped tokens let external AI agents (and the MCP bridge) write verified facts and read back their roles.
// Routes: GET /api/agent?action=me | GET ?action=recall&q=... | POST ?action=remember {role,text,verified:true}
import { createSql } from '../../../packages/db/neon.mjs';
import { createNeonDashStore } from '../../../packages/core/dashboard/neon-dash-store.mjs';
import { createWalrusMemory, withMemoryLog, withForgetFilter } from '../../../packages/core/memory/walrus-memory.mjs';
import { buildMemory } from '../lib/memory-stack.mjs';
import { buildMemwalSdk } from '../lib/walrus-memory-client.mjs';
import { handleAgent } from '../../../packages/core/agent/agent.mjs';

export default async function handler(req, res) {
  try {
    const store = createNeonDashStore(createSql());
    const bearer = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const body = req.method === 'GET' ? { ...req.query } : (typeof req.body === 'object' && req.body ? req.body : {});
    const memory = buildMemory(store, 'agent');
    const r = await handleAgent({ store, memory, action: String(req.query?.action ?? ''), method: req.method, body, bearer });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(r.status).json(r.json);
  } catch (e) {
    console.error('agent', e.message);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
