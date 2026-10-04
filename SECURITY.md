# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Vow, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer directly
3. Include steps to reproduce

We aim to respond within 48 hours.

## Encryption

- **Seal encryption (MemWalManual):** All commitment data is encrypted client-side before reaching Walrus. The relay operator never sees plaintext. This is the default mode.
- **Fallback mode:** If MemWalManual proves unstable, relayer mode is available with explicit plaintext disclosure. This is opt-in only and shown in the UI.

## Access Control

- **RBAC on the bot server:** Roles determine who can read commitment history and settings.
- **Owner key** never stored on server; delegate key only.
- **Namespace isolation** per user, enforced by MemWalAccount separation.
- **Delegate keys:** Revoking the delegate key cuts access immediately.

## Data Stored

Commitment records, check-in logs, streak data, schedule entries, and user preferences. No health data is stored as structured medical records; the bot processes messages for responses only.

## Crypto-shredding

Delete the delegate and Seal key to make stored blobs unreadable. Blobs themselves are immutable on Walrus; only ciphertext exists. This supports GDPR Article 17 via crypto-erasure. What is erased: key access. What is not: ciphertext existence, blob IDs, timestamps.

## Architecture Security

- **Taint scan** on all recalled memory; injection attempts quarantined
- **Append-only** chain; no edit, no delete, only supersede
- **Rate limiting** on all API endpoints
- **CSP headers** on web responses
- **Input size bounds** enforced before model or Walrus spend
- **Secret scan** in CI pipeline
- **Log redaction** for API keys and delegate credentials

## Limitations

- Receipts prove storage, not truth.
- MemWal restore is bounded (newest N records).
- The default relayer sees plaintext unless MemWalManual is active.
- Semantic recall can miss records; truth comes from manifest enumeration.
- The server operator can see decrypted data in memory during processing. This is documented honestly.
