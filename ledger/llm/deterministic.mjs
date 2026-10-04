// llm/deterministic.mjs — the guaranteed tail of the chain.
//
// No key, no network: it narrates the audit it is handed, chosen from the state so it can
// never contradict the ledger. It never decides — the audit is code. Vow is the one truly
// conversational project of the six, so the tone is a warm, honest companion.

export class DeterministicClient {
  constructor() {
    this.name = "deterministic";
  }
  async complete({ messages = [], prompt = "" }) {
    const t = (prompt || messages.map((m) => m.content).join("\n")).toLowerCase();
    let line;
    if (t.includes("tampered") || t.includes("link-broken") || t.includes("content-edited") || t.includes("seq-out") || t.includes("untrusted")) {
      line = "The ledger doesn't verify: an entry was changed or reordered. Corrections happen by adding a new check-in, never by editing the past.";
    } else if (t.includes("unproven") || t.includes("claim-without-receipt")) {
      line = "One check-in claims done but has no receipt yet, so it isn't counted. Keep the receipt and it will be.";
    } else if (t.includes("empty") || t.includes("no-checkins")) {
      line = "No check-ins yet. Make the first one and keep the receipt.";
    } else if (t.includes("intact") || t.includes("verified")) {
      line = "Verified. Your streak is real, backed by receipts you own, and nobody can quietly change it.";
    } else {
      line = "Ledger checked deterministically from the chain.";
    }
    return { text: line, provider: "deterministic", model: "canned" };
  }
}
