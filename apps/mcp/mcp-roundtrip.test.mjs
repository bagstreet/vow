// Round trip: real MCP client -> stdio bridge -> stub Agent API. Skipped when the MCP SDK is not installed (cd apps/mcp && npm install).
import test from 'node:test'; import assert from 'node:assert/strict';
import http from 'node:http'; import { fileURLToPath } from 'node:url'; import { existsSync } from 'node:fs';

const dir = fileURLToPath(new URL('.', import.meta.url));
const hasSdk = existsSync(new URL('./node_modules/@modelcontextprotocol/sdk', import.meta.url));

test('MCP bridge: whoami, remember and recall reach the Agent API with the bearer token', { skip: !hasSdk && 'MCP SDK not installed' }, async () => {
  const seen = [];
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      const u = new URL(req.url, 'http://x'); seen.push({ action: u.searchParams.get('action'), auth: req.headers.authorization, body: b ? JSON.parse(b) : null });
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, action: u.searchParams.get('action'), roles: ['fitness'] }));
    });
  });
  await new Promise((r) => srv.listen(0, r));
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const transport = new StdioClientTransport({ command: process.execPath, args: [dir + 'vow-agent-mcp.mjs'], env: { ...process.env, VOW_AGENT_TOKEN: 'tok_test', VOW_API_URL: `http://127.0.0.1:${srv.address().port}` } });
  const client = new Client({ name: 'test', version: '0' });
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    assert.deepEqual(tools, ['vow_recall', 'vow_remember', 'vow_whoami']);
    await client.callTool({ name: 'vow_whoami', arguments: {} });
    await client.callTool({ name: 'vow_remember', arguments: { role: 'fitness', text: 'Ran 5 km on Monday', verified: true } });
    await client.callTool({ name: 'vow_recall', arguments: { q: 'run' } });
    assert.deepEqual(seen.map((s) => s.action), ['me', 'remember', 'recall']);
    assert.ok(seen.every((s) => s.auth === 'Bearer tok_test'));
    assert.equal(seen[1].body.verified, true);
  } finally { await client.close().catch(() => {}); srv.close(); }
});
