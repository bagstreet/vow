// Local developer-demo bearer mapping. Not OAuth, not a wallet, not a MemWal key.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const FORBIDDEN_BODY_KEYS = ["viewer", "role", "principal", "token", "authorization", "access_token", "owner", "gm"];

export function assertDemoHttpAllowed(env) {
  if (env.NODE_ENV === "production") {
    throw new Error("Demo bearer HTTP is not a production auth boundary");
  }
}

export function loadPrincipalTable(env) {
  assertDemoHttpAllowed(env);
  const token = env.VOW_DEMO_TOKEN;
  if (!token) throw new Error("Set VOW_DEMO_TOKEN demo access token");
  const owner = env.VOW_OWNER || "sam";
  if (!/^[a-z0-9_-]+$/.test(owner)) throw new Error("VOW_OWNER must be a slug");
  return [{ token, principal: { id: owner, role: "owner", owner } }];
}

export function signingKey(env) {
  return env.VOW_DEMO_SIGNING_KEY || randomBytes(32).toString("base64url");
}

export function signPrincipal(principal, key) {
  const payload = JSON.stringify({ id: principal.id, role: principal.role, owner: principal.owner });
  const sig = createHmac("sha256", key).update(payload).digest("base64url");
  return { payload, sig, principal };
}

export function verifyPrincipal(signed, key) {
  if (!signed?.payload || !signed?.sig) return null;
  const expect = createHmac("sha256", key).update(signed.payload).digest("base64url");
  const a = Buffer.from(signed.sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const parsed = JSON.parse(signed.payload);
  if (parsed.owner !== signed.principal?.owner || parsed.role !== signed.principal?.role) return null;
  return signed.principal;
}

export function authenticate(header, table, key) {
  const raw = typeof header === "string" ? header : "";
  const m = raw.match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const presented = m[1];
  let match = null;
  for (const row of table) {
    const a = Buffer.from(presented);
    const b = Buffer.from(row.token);
    if (a.length === b.length && timingSafeEqual(a, b)) match = row.principal;
  }
  if (!match) return null;
  const signed = signPrincipal(match, key);
  return verifyPrincipal(signed, key);
}

export function rejectPrivilegeBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("JSON object body required");
    err.status = 400;
    throw err;
  }
  for (const k of FORBIDDEN_BODY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      const err = new Error(`Body cannot set ${k}; owner comes from the demo access token`);
      err.status = 400;
      throw err;
    }
  }
  return body;
}
