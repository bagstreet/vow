// llm/router.mjs — task-aware routing with circuit breaker and cooldown.
// Tasks: chat (companion voice), buttons (tiny picks), classify (role router).
import { guardReply } from "./guard.mjs";

export const DEFAULT_ROUTES = {
  chat:     ["groq", "cerebras", "openrouter", "zai", "gateway", "nvidia"],
  buttons:  ["cerebras", "groq", "nvidia", "openrouter"],
  classify: ["cerebras", "groq", "nvidia", "openrouter"],
};

export class LlmRouter {
  /** clients: {id: client}; opts: {routes, failLimit, cooldownMs, now, tail} */
  constructor(clients, opts = {}) {
    this.clients = clients;
    this.routes = opts.routes || DEFAULT_ROUTES;
    this.failLimit = opts.failLimit ?? 3;
    this.cooldownMs = opts.cooldownMs ?? 60_000;
    this.now = opts.now || Date.now;
    this.tail = opts.tail || null;
    this.state = {}; // id -> {fails, openUntil}
    this.name = "router";
  }
  isOpen(id) { const s = this.state[id]; return !!s && s.openUntil > this.now(); }
  record(id, ok, status) {
    const s = (this.state[id] ||= { fails: 0, openUntil: 0 });
    if (ok) { s.fails = 0; s.openUntil = 0; return; }
    s.fails += 1;
    if (status === 401 || status === 403) s.openUntil = this.now() + 10 * this.cooldownMs; // bad key: back off long
    else if (status === 429) s.openUntil = this.now() + this.cooldownMs; // rate limit: cool down at once
    else if (s.fails >= this.failLimit) s.openUntil = this.now() + this.cooldownMs;
  }
  async complete(req) {
    const task = req.task || "chat";
    const ids = (this.routes[task] || this.routes.chat).filter((id) => this.clients[id]);
    const tried = [];
    for (const id of ids) {
      if (this.isOpen(id)) { tried.push(id + ":open"); continue; }
      try {
        const out = await this.clients[id].complete(req);
        if (out?.text) { this.record(id, true); return { ...out, text: task === "chat" ? guardReply(out.text) : out.text, tried }; }
        this.record(id, false); tried.push(id + ":empty");
      } catch (e) { this.record(id, false, e.status); tried.push(id + ":" + (e.status || "err")); }
    }
    if (this.tail) { const o = await this.tail.complete(req); return { ...o, tried }; }
    throw new Error("all providers failed: " + tried.join(","));
  }
}
