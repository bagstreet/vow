# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Vow, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Contact the maintainer privately (a reporting address is **not yet published** in this snapshot; open gap — see packet UNRESOLVED)
3. Include steps to reproduce

We aim to respond within 48 hours.

## Encryption

Status: planned controls, **not verified** in this snapshot (see `docs/audit/ACCEPTANCE_STATUS.md`; T44/T02 not executed). Exact contract: `internal/agent-pack/DOMAIN_CONTRACT.md` (proposed) and `PRIVACY_ACCESS_ROUTING.md`.


- **Seal encryption (MemWalManual):** designed so data is encrypted client-side before reaching Walrus and the relay operator sees only ciphertext. This is the default mode.
- **Fallback mode:** only after a recorded T44 GO-Fallback verdict: relayer mode with app-layer AES-GCM before `remember()`, so the relayer still sees ciphertext. Explicit, disclosed in UI/README/FRICTION.md, never automatic. Plaintext relayer mode is not part of the accepted data path.

## Access Control

- **RBAC on the bot server:** Roles determine who can read commitment history and settings.
- **Owner key** never stored on server; delegate key only.
- **Account separation** (`ACCOUNT_MODE=per-user`) is the cryptographic boundary; a namespace is a filter, not a boundary.
- **Delegate keys:** revoking a delegate stops it from obtaining new keys; it does not recall session keys, cached ciphertext, decrypted copies, exports or logs already produced, and offline devices learn of it only when they sync.

## Data Stored

Commitment records, check-in logs, streak data, schedule entries, and user preferences. Schedule labels may name medication and are treated as sensitive by inference; Vow does no medical processing and does not claim this is "not health data".

## Revoke, forget, delete

Four different operations (see `PRIVACY_ACCESS_ROUTING.md` section 3): revoke delegate (stops new key issuance; copies not recalled), deactivate (reversible freeze), forget (hides from recall; blobs persist until deleted or expired), owner-wallet Security Delete (selected eligible blobs only, per-item outcomes). Vow makes no erasure or legal-compliance guarantee and does not use the term "crypto-shredding".

## Architecture Security

- **Taint scan** on all recalled memory; injection attempts quarantined
- **Append-only** signed per-device branches; no edit, only supersede; conflicts and equivocation are shown, not hidden
- **Rate limiting** on all API endpoints
- **CSP headers** on web responses
- **Input size bounds** enforced before model or Walrus spend
- **Secret scan** in CI pipeline
- **Log redaction** for API keys and delegate credentials

## Limitations

- Receipts prove storage, not truth.
- MemWal restore is bounded and its ordering is unspecified; recovery enumerates the manifest and reports `currentness unknown` when it cannot prove freshness.
- The default upstream relayer would see plaintext; Vow's accepted modes never send it plaintext.
- Semantic recall can miss records; truth comes from manifest enumeration.
- The server operator can see decrypted data in memory during processing. This is documented honestly.


## Reminder delivery limitations
An unavailable assigned sender can miss reminders; there is no automatic takeover. Pause, withdrawal and revocation stop each device when observed; an offline sender may continue under its last allowed state until sync. Show controls-last-synced and device-may-still-send notices. Provider duplicates/drops are possible; unknown outcomes consume permits; no exactly-once delivery or instantaneous remote revocation is promised. DOMAIN_CONTRACT §§8–10 define the executable specification. Implementation and runtime gates remain unrun.
