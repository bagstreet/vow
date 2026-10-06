// llm/openai-compat.mjs — one adapter for every OpenAI-compatible provider.
export const PROVIDERS = {
  groq:       { base: "https://api.groq.com/openai/v1",            key: "GROQ_API_KEY",       model: "openai/gpt-oss-120b" },
  cerebras:   { base: "https://api.cerebras.ai/v1",                key: "CEREBRAS_API_KEY",   model: "qwen-3.8-27b" },
  openrouter: { base: "https://openrouter.ai/api/v1",              key: "OPENROUTER_API_KEY", model: "nvidia/nemotron-3-ultra-550b-a55b:free" },
  zai:        { base: "https://api.z.ai/api/paas/v4",              key: "ZAI_API_KEY",        model: "glm-4.6" }, // needs paid balance (429 on free),
  gateway:    { base: "https://ai-gateway.vercel.sh/v1",           key: "AI_GATEWAY_API_KEY", model: "deepseek/deepseek-v4-flash" },
  nvidia:     { base: "https://integrate.api.nvidia.com/v1",       key: "NVIDIA_API_KEY",     model: "deepseek-ai/deepseek-v4.1-flash" },
};

export class OpenAICompatClient {
  constructor(id, env = process.env, fetchImpl = fetch) {
    const p = PROVIDERS[id];
    if (!p) throw new Error("unknown provider " + id);
    const U = id.toUpperCase();
    this.name = id;
    this.apiKey = env[p.key];
    this.model = env[U + "_MODEL"] || p.model;
    this.baseUrl = env[U + "_BASE_URL"] || p.base;
    this.timeoutMs = Number(env[U + "_TIMEOUT_MS"] || 20000);
    this.fetch = fetchImpl;
  }
  async complete({ messages, prompt, temperature = 0.3, maxTokens }) {
    if (!this.apiKey) throw new Error("no key for " + this.name);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetch(this.baseUrl + "/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + this.apiKey },
        body: JSON.stringify({ model: this.model, messages: messages || [{ role: "user", content: prompt || "" }], temperature, max_tokens: maxTokens, stream: false }),
        signal: ctrl.signal,
      });
      if (!res.ok) { const e = new Error(this.name + " " + res.status); e.status = res.status; throw e; }
      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error(this.name + " empty");
      return { text, provider: this.name, model: this.model };
    } finally { clearTimeout(t); }
  }
}
