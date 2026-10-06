// llm/groq.mjs — Vow's primary companion voice (open-weights Llama on Groq).

export class GroqClient {
  constructor(env = process.env) {
    this.name = "groq";
    this.apiKey = env.GROQ_API_KEY;
    this.model = env.GROQ_MODEL || "llama-3.3-70b-versatile";
    this.baseUrl = "https://api.groq.com/openai/v1";
    this.timeoutMs = Number(env.GROQ_TIMEOUT_MS || 20_000);
  }
  async complete({ messages, prompt }) {
    if (!this.apiKey) throw new Error("no GROQ_API_KEY");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, messages: messages || [{ role: "user", content: prompt || "" }], temperature: 0.3, stream: false }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`groq ${res.status}`);
      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("groq empty");
      return { text, provider: "groq", model: this.model };
    } finally {
      clearTimeout(timer);
    }
  }
}
