<div align="center">

# ◎ vow

**Make a commitment. Keep an honest record.**

Vow is a Commitment Steward: one assistant that helps you confirm a commitment, check in, correct the record without rewriting history, keep a schedule of reminders you define, and study material you upload. Its memory is designed to live in your own Walrus Memory account as encrypted, append-only records.

**Status (2026-10-04): working draft before implementation.** Nothing in this repository is a verified Mainnet-persistent service yet. Statuses below are honest; counts are re-measured before being quoted.

[![CI](https://github.com/bagstreet/vow/actions/workflows/ci.yml/badge.svg)](https://github.com/bagstreet/vow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Live app](https://vow-livid.vercel.app) · [Docs](docs/) · [Discord](https://discord.com/invite/walrusprotocol)

</div>

---

## Navigation

| You are a... | Start here |
|---|---|
| User or judge wanting the idea | [What Vow does](#what-vow-does-accepted-scope), [Trusted contact](#trusted-contact) |
| Developer or agent builder | [docs/API.md](docs/API.md) (Agent API, MCP bridge, SDK) |
| Anyone who wants the mechanics | [docs/MECHANICS.md](docs/MECHANICS.md) and [docs/DIAGRAMS.md](docs/DIAGRAMS.md) (diagrams plus rules) |
| Self-hoster | [docs/SELF_HOST.md](docs/SELF_HOST.md) and [docs/SERVICES.md](docs/SERVICES.md) |
| Tester | [docs/testing/SCENARIOS.md](docs/testing/SCENARIOS.md) |
| Project status and plan | [docs/STATUS.md](docs/STATUS.md), [docs/ROADMAP.md](docs/ROADMAP.md) |
| Security reviewer | [SECURITY.md](SECURITY.md), [Access and privacy](#access-and-privacy) |

## What Vow does (accepted scope)

One Steward, one ledger, three engine modules and five user-facing roles ([Roles and Routing](internal/agent-pack/ROLES_AND_ROUTING.md): Health & Fitness, Medication, Nutritionist, Health Companion, Study & Exam; several can be enabled at once, the AI routes each message and shows which role answered):

| Role | What it does | What it never does |
|---|---|---|
| **Core commitments** | create a confirmed commitment, check in (`done`/`skipped`), append a correction, audit, export, propose a feasible next step without shame | rewrite or delete history |
| **Schedule** ([spec](internal/agent-pack/VOW_SCHEDULE.md)) | you type items and times (pills, water, anything); Vow reminds you and records what *you* confirm: `taken` / `skipped` / `snoozed` (never counted as taken) or `unacknowledged`; at most two reminders per occurrence across all your devices; pause/resume; weekly counts | suggest or change doses, name medicines, check interactions, interpret symptoms, or treat silence as "skipped". Medical questions get a fixed refusal: *"I only keep the schedule you set. For medical questions ask a doctor or pharmacist."* |
| **Study** ([spec](internal/agent-pack/VOW_STUDY.md)) | owner uploads `.txt`/`.md`/text `.pdf` (<= 200 KB text) -> up to 10 lessons generated and **owner-approved** -> MCQ quiz graded by code -> mastery computed deterministically -> progress view. Vision (RAG, SM-2, exams, cohorts) is roadmap, labelled planned | grade by LLM alone, write raw documents to Walrus, follow instructions found inside uploaded text |

Surfaces: **Telegram, Slack, Discord and the web dashboard are live**; the Agent API / MCP is available for other agents. A desktop helper (reminders and chat, optional local LLM) is on the roadmap and not built yet ([plan](docs/DESKTOP_HELPER.md)). Slash commands and plain text map to the same typed operations: `/vow new`, `/checkin done|skipped`, `/correct <id>`, `/audit`, `/next`, `/export`, `/pause`, `/schedule add`, `/study upload` (full registry: `internal/agent-pack/DOMAIN_CONTRACT.md` §11, proposed).

## How memory works (design, to be verified in T02/T10)

```mermaid
flowchart LR
    U[User on desktop / Telegram / web] -->|typed operation| C[Shared core]
    C -->|event: id, device, seq, prev_hash, sig| O[(Local durable outbox)]
    O -->|ciphertext only| W[(Walrus Memory)]
    W -->|receipt: pending -> stored blob_id| O
    O -->|saved locally / stored on Walrus / failed| U
    W -->|inventory by manifest, not top-k| R[Cold recovery + deterministic merge]
    R -->|conflicts shown, never hidden| U
```

- Every record is an **event** with a stable id, a per-device sequence and a hash link to the same device's previous event; devices sync by a deterministic merge; a signed checkpoint lists every branch head. Conflicting check-ins or corrections are shown as **conflicts** and resolved by a new correction, never silently. Details: `DURABILITY_AND_CONTEXT.md` section 9; exact proposed schema `DOMAIN_CONTRACT.md`. A fresh device restoring from Walrus sees a verified snapshot and says when its currentness is unknown; it never claims to have seen events an offline device has not yet synced.
- Only ciphertext is written to Walrus (client-side Seal "Manual" mode by default; if the day-0 spike T44 fails, a disclosed fallback encrypts at the app layer before the relayer). The UI always shows the active mode.
- The user is acknowledged only after the record is in the local write-ahead outbox; "stored on Walrus" appears only after the blob id is confirmed.

> **What is actually deployed today (2026-10-07):** the hash-chain/event-sourcing/Seal design above is the
> target architecture, not yet built against the live relayer (`packages/core/companion.mjs` is an unused
> prototype — see `docs/planning/KNOWN_LIMITATIONS.md`). What *is* live, verified against the real mainnet
> relayer: `packages/core/memory/walrus-memory.mjs`, called from the Telegram and Discord webhooks
> (`apps/web/api/{telegram,discord}.mjs`). Every chat turn and reminder check-in is written as a MemWal
> `remember()` call (relayer-encrypted at rest, not client-side Seal yet) into one namespace per app user
> (`vow:mem:<userId>`, shared across every channel they've linked — one memory, many doors in); the next chat
> turn recalls relevant past memories before the model replies. See `docs/MAINNET_EVIDENCE.md` for real blob
> ids. Slack is not wired to memory yet (Slack is also single-tenant today, see `docs/SELF_HOST.md`).

## Access and privacy

- **Stored:** your commitments, schedule labels and times, check-ins, corrections, consent records, Study lessons and progress; all as encrypted records in your Walrus Memory account (or the workspace account with roles).
- **Sensitive by inference:** a schedule label can reveal health. Vow treats schedule data as sensitive: encryption, roles, labels never in logs or summaries by default, no medical processing. Vow does not claim this is "not health data" and gives no legal guarantee; wording is reviewed by the owner.
- **Consent:** before the first reminder and the first Study upload you accept a short versioned consent text; withdrawing stops that processing and pauses the role. Pausing or withdrawing on one device takes effect on another device only once it syncs; an offline desktop cannot see a pause made in Telegram until it reconnects.
- **Roles:** owner / editor / viewer plus role modules, enforced on the bot server. Honest limit: the operator of a shared server can read what the server's delegate key decrypts; per-user accounts are a real cryptographic boundary and are the default for personal schedules.
- **Memory off:** no read, no write, no recall on any path; the reply says "memory off".
- **Revoke, forget, delete are different things** ([details](internal/agent-pack/PRIVACY_ACCESS_ROUTING.md#3-revoke-deactivate-forget-delete-four-different-operations-readme-section-required)): revoking a device or server stops new decryptions but does not recall copies already produced; `forget` hides records from recall but blobs persist until they expire or are deleted; permanent deletion of tracked blobs is an owner-wallet action (Walrus Memory Security Delete), executed per blob with per-item outcomes, and does not reach exports or texts already sent to an LLM provider you enabled. We do not use the words "crypto-shredding" or "GDPR compliant".
- **Local LLM:** on desktop, parsing and tone use Ollama; cloud providers run only if you enable them, and the UI says which one answered.

## Services and configuration

The whole stack runs on free tiers by design. Every service, its limit and the settings to make are listed in [docs/SERVICES.md](docs/SERVICES.md); step-by-step setup is in [docs/SELF_HOST.md](docs/SELF_HOST.md).

## Trusted contact

Name another Vow user as a trusted contact. If you miss N check-ins or stay silent for N hours, they get a short alert that a miss happened (never message or memory content). The contact sets the conditions, you see every change and can remove them at any time, and either side can leave. One account can watch up to 10 others. Flow and rules: [docs/MECHANICS.md](docs/MECHANICS.md#6-trusted-contact).

## Agents, MCP and SDK

Role-scoped tokens let external AI agents write verified facts into a user's memory and read them back, limited to the roles the user allowed. REST, a stdio MCP bridge (`apps/mcp`) and a zero-dependency JavaScript client (`packages/sdk`) are described in [docs/API.md](docs/API.md).

## Delivery routing

A reminder goes to the channel where you were active most recently (or the one you picked for it), falls back to your other linked channels on failure, honours quiet hours, and carries Taken / Skip / Later buttons. Scheduling uses cron-job.org every minute plus a GitHub Actions tick as a backup: see [docs/SERVICES.md](docs/SERVICES.md).

## Repository layout

```
apps/web/          landing, dashboard and serverless API (Vite + React, Vercel)
apps/cli/          `vow` command-line client
apps/mcp/          MCP bridge to the Agent API
packages/core/     channels, memory, scheduler, trusted contact, admin, agent API
packages/db/       Neon migrations
packages/presets/  role presets
packages/sdk/      JavaScript client for the Agent API
docs/              mechanics, diagrams, services, API, testing, roadmap
```

## Quick start

```bash
git clone https://github.com/bagstreet/vow && cd vow
npm install
npm test
```
Deployment on free tiers: [docs/SELF_HOST.md](docs/SELF_HOST.md). Planned desktop helper: [docs/DESKTOP_HELPER.md](docs/DESKTOP_HELPER.md).

## Verification policy

| Claim | Where it is proven | Current state |
|---|---|---|
| Tests pass, coverage | `docs/audit/ACCEPTANCE_STATUS.md` after `npm test` on the current head | not re-measured since the audit; inherited numbers removed |
| Records stored on Walrus Mainnet | `docs/MAINNET_EVIDENCE.md`: blob ids, explorer links, agent/account id | yes — verified 2026-10-07 against the live mainnet relayer; see the doc for current blob count |
| Cold recovery | T06 test + desktop demo (T38) | not yet |
| Seal active | active-mode indicator + T44 spike log in `docs/audit/FRICTION.md` | not yet |
| Badges | generated from CI/eval output only | CI badge only |

## Why Walrus Memory and why an LLM

Memory is justified because commitments, check-ins, corrections, schedules and consent must survive device loss and be recoverable cold with an honest receipt state; a plain note would not change a later decision. The LLM is used only where judgement or parsing is needed (free-text reminder parsing with user confirmation, lesson generation with owner approval, tone of summaries); counting, scheduling, grading MCQs, mastery and audit are deterministic. Full argument: `VALUE_AND_AI_DESIGN.md`.

## Contributing and security

See [`CONTRIBUTING.md`](CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md) and the hard rules in `internal/agent-pack/START_HERE.md`. Never commit secrets; never claim a live or verified state that `ACCEPTANCE_STATUS.md` does not record.

---

Built for [Walrus Session 8: Chatbots That Remember](https://www.deepsurge.xyz/hackathons/c0141a4a-21be-4009-bc63-7c168608c849). Rules snapshot: `docs/audit/OFFICIAL_RULES.md`. LLM disclosure: local Ollama model on desktop; cloud providers only when enabled (listed in the health endpoint). Memory: [MemWal](https://github.com/MystenLabs/MemWal) (version pinned in `package.json`; Mainnet status per `MAINNET_EVIDENCE.md`).
