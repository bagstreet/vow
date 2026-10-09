# Security policy

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability") and include steps to reproduce. We aim to respond within 48 hours.

## What is protected

- **Memory** is stored through the MemWal relayer in a per-user Walrus Memory namespace. The server holds a delegate key, never the owner key.
- **Accounts** are separated by user id; every API call is scoped to the signed-in user. Agent API tokens are role-scoped and can be revoked.
- **Trusted contact** alerts carry only the fact that check-ins were missed, never memory contents or chat text.
- **Secrets** are read from environment variables. A secret scan runs in CI (`make secret-scan`).
- **Web** responses ship with security headers (see `apps/web/vercel.json`); long inputs are bounded before any model or Walrus call.

## Data stored

Reminders, check-in logs, linked channels, settings and the facts you tell the bot. A reminder title can reveal health information; Vow does no medical processing.

## Forget and delete

Forget hides a record from recall. Walrus Memory is append-only, so the blob stays until it expires. Deleting an account removes its database rows and trusted-contact links.

## Limitations

- The operator of a server can read data the server's delegate key decrypts. Self-host to own that boundary ([guide](docs/SELF_HOST.md)).
- Client-side encryption is on the [roadmap](docs/ROADMAP.md).
- Receipts prove storage, not truth.
- Reminder delivery depends on the channel provider; duplicates or drops are possible and no exactly-once delivery is promised.
