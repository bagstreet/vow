// llm/chained.mjs — walk the chain; never reject.

export class ChainedLlmClient {
  constructor(clients) {
    if (!clients || !clients.length) throw new Error("ChainedLlmClient needs at least one client");
    this.clients = clients;
    this.name = "chain(" + clients.map((c) => c.name).join(">") + ")";
  }
  async complete(req) {
    let lastErr;
    for (const c of this.clients) {
      try {
        const out = await c.complete(req);
        if (out && out.text) return out;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("empty chain");
  }
}
