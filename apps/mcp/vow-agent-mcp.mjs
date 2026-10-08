#!/usr/bin/env node
// Vow Agent MCP bridge (stdio). Lets any MCP client (Claude, Cursor, other agents) read/write a user's Vow memory
// through the role-scoped Agent API. Config via env: VOW_AGENT_TOKEN (from Dashboard > Agents), VOW_API_URL.
const BASE = process.env.VOW_API_URL ?? 'https://vow-livid.vercel.app';
const TOKEN = process.env.VOW_AGENT_TOKEN;
if (!TOKEN) { console.error('[vow-mcp] VOW_AGENT_TOKEN is required (create one in the Vow dashboard under Agents).'); process.exit(1); }

const call = async (action, method, payload) => {
  const qs = method === 'GET' ? '?' + new URLSearchParams({ action, ...payload }) : `?action=${action}`;
  const r = await fetch(`${BASE}/api/agent${qs}`, { method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(payload) });
  return r.json();
};
const text = (o) => ({ content: [{ type: 'text', text: JSON.stringify(o) }] });

const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = await import('zod');
const server = new McpServer({ name: 'vow-agent', version: '0.1.0' });
server.tool('vow_whoami', 'Show which Vow roles this token may read and write.', {}, async () => text(await call('me', 'GET', {})));
server.tool('vow_remember', 'Store a VERIFIED fact for one allowed role in the user\'s Walrus memory. Set verified=true only if you checked it.',
  { role: z.string(), text: z.string().min(8).max(600), verified: z.boolean() }, async (a) => text(await call('remember', 'POST', a)));
server.tool('vow_recall', 'Search the user\'s memory, limited to the roles of this token.', { q: z.string() }, async (a) => text(await call('recall', 'GET', a)));
await server.connect(new StdioServerTransport());
