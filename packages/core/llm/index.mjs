// llm/index.mjs — build the router from env. A provider joins when its key is set.
// LLM_PRIMARY=<id> moves one provider to the front of every route; LLM_ROUTE_<TASK>=a,b,c overrides a route.
import { OpenAICompatClient, PROVIDERS } from "./openai-compat.mjs";
import { DeterministicClient } from "./deterministic.mjs";
import { ChainedLlmClient } from "./chained.mjs";
import { LlmRouter, DEFAULT_ROUTES } from "./router.mjs";
import { GroqClient } from "./groq.mjs";
import { CerebrasClient } from "./cerebras.mjs";

export function buildLlmClient(env = process.env) {
  const clients = {};
  for (const id of Object.keys(PROVIDERS)) if (env[PROVIDERS[id].key]) clients[id] = new OpenAICompatClient(id, env);
  const routes = {};
  for (const task of Object.keys(DEFAULT_ROUTES)) {
    let r = (env["LLM_ROUTE_" + task.toUpperCase()] || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!r.length) r = [...DEFAULT_ROUTES[task]];
    const p = (env.LLM_PRIMARY || "").toLowerCase();
    if (task === "chat" && p && r.includes(p)) r = [p, ...r.filter((x) => x !== p)];
    routes[task] = r;
  }
  return new LlmRouter(clients, { routes, tail: new DeterministicClient() });
}
export { LlmRouter, ChainedLlmClient, DeterministicClient, GroqClient, CerebrasClient, OpenAICompatClient, PROVIDERS };
