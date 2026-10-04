// llm/index.mjs — build Vow's provider chain from the environment.
//
// Groq (Llama) → Cerebras (Qwen) → deterministic tail. A provider joins only when its key
// is set; the tail always resolves. Flip with LLM_PRIMARY=cerebras. The model is the
// companion's voice; it never decides what the ledger says.

import { GroqClient } from "./groq.mjs";
import { CerebrasClient } from "./cerebras.mjs";
import { DeterministicClient } from "./deterministic.mjs";
import { ChainedLlmClient } from "./chained.mjs";

export function buildLlmClient(env = process.env) {
  const primary = (env.LLM_PRIMARY || "groq").toLowerCase();
  const groq = env.GROQ_API_KEY ? new GroqClient(env) : null;
  const cerebras = env.CEREBRAS_API_KEY ? new CerebrasClient(env) : null;

  const order = primary === "cerebras" ? [cerebras, groq] : [groq, cerebras];
  const chain = order.filter(Boolean);
  chain.push(new DeterministicClient());
  return new ChainedLlmClient(chain);
}

export { ChainedLlmClient, DeterministicClient, GroqClient, CerebrasClient };
