// Vow Agent SDK: a thin, dependency-free client for the role-scoped Agent API.
export class VowAgentError extends Error {
  constructor(status, body) { super(body?.error ?? `http_${status}`); this.status = status; this.body = body; }
}

export class VowAgent {
  /** @param {{token: string, baseUrl?: string, fetch?: typeof fetch}} opts */
  constructor({ token, baseUrl = 'https://vow-livid.vercel.app', fetch: f = globalThis.fetch } = {}) {
    if (!token) throw new Error('token is required (create one in the dashboard under Agents)');
    this.token = token; this.baseUrl = baseUrl.replace(/\/$/, ''); this.f = f;
  }
  async #call(action, method, payload = {}) {
    const qs = method === 'GET' ? '?' + new URLSearchParams({ action, ...payload }) : `?action=${action}`;
    const r = await this.f(`${this.baseUrl}/api/agent${qs}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(payload),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new VowAgentError(r.status, body);
    return body;
  }
  /** Roles this token may read and write. */
  whoami() { return this.#call('me', 'GET'); }
  /** Store a verified fact for one allowed role. */
  remember(role, text, { verified = true } = {}) { return this.#call('remember', 'POST', { role, text, verified }); }
  /** Search memory limited to the token's roles. */
  recall(q) { return this.#call('recall', 'GET', { q }); }
}
