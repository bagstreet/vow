// llm/cerebras.mjs — Vow's hosted fallback (open-weights Qwen on Cerebras).

export class CerebrasClient {
  constructor(env = process.env) {
    this.name = "cerebras";
    this.apiKey = env.CEREBRAS_API_KEY;
    this.model = env.CEREBRAS_MODEL || "qwen-3.8-27b";
    this.baseUrl = "https://api.cerebras.ai/v1";
    this.timeoutMs = Number(env.CEREBRAS_TIMEOUT_MS || 20_000);
  }
  async complete({ messages, prompt }) {
    if (!this.apiKey) throw new Error("no CEREBRAS_API_KEY");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, messages: messages || [{ role: "user", content: prompt || "" }], temperature: 0.3, stream: false }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`cerebras ${res.status}`);
      const json = await res.json();
      const msg = json?.choices?.[0]?.message || {};
      const text = (msg.content || msg.reasoning || "").trim();
      if (!text) throw new Error("cerebras empty");
      return { text, provider: "cerebras", model: this.model };
    } finally {
      clearTimeout(timer);
    }
  }
}
