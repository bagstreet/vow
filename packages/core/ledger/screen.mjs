// ledger/screen.mjs — a check-in note is a record, never a command.
//
// A check-in can carry a free-text note. A note that tries to instruct the companion, or
// that pastes a secret, is untrusted content in the ledger; the audit flags it. Vow's own
// screen (re-authored, habit/commitment domain).

function* strings(node) {
  if (node == null) return;
  if (typeof node === "string") yield node;
  else if (Array.isArray(node)) for (const x of node) yield* strings(x);
  else if (typeof node === "object") for (const k of Object.keys(node)) yield* strings(node[k]);
}

const DIRECTIVES = [
  /\b(?:ignore|rewrite|edit|delete)\b.{0,24}\b(?:the\s+)?(?:ledger|streak|receipt|past|history|entry)\b/i,
  /\b(?:mark|set|count)\b.{0,20}\b(?:this|it|me)\b.{0,16}\b(?:as\s+)?(?:done|kept|complete)\b.{0,16}\b(?:anyway|regardless|without)\b/i,
  /\b(?:add|give)\b.{0,16}\b(?:a\s+)?(?:fake|extra)\b.{0,12}\b(?:streak|day|receipt)\b/i,
  /\b(?:rm\s+-rf|curl\s|\|\s*sh\b|eval\()/i,
];
const SECRETS = [
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsuiprivkey1[a-z0-9]{20,}\b/i,
  /-----BEGIN(?:\s+[A-Z]+)?\s+PRIVATE\s+KEY-----/,
];

// Returns null when clean, else a short reason.
export function screen(entry) {
  for (const s of strings(entry)) {
    for (const re of DIRECTIVES) if (re.test(s)) return "directive";
    for (const re of SECRETS) if (re.test(s)) return "secret";
  }
  return null;
}
