# Vow roadmap

Single task list for contributors and agents. Order = execution order: every task comes after the tasks it depends on, and cheap, high-value work comes first. `PRE` = required before the hackathon deadline, `POST` = planned after. Status: ✅ done, ⏳ open.

Conventions: English only in repo, docs and commits; commit message = emoji + text; commit author `bagstreet <bagstreet.by@gmail.com>`; `npm test` and `tsc --noEmit` (apps/web) must pass; test runs use the TEST MemWal account, only the final curated run uses the DEMO account.

## Phase 0 — Foundation (done)
| ID | Task | Status |
|---|---|---|
| T01 | Roles (fitness, medication, nutrition, health, study), router, role label modes | ✅ |
| T02 | Channels: Telegram, Slack, Discord; `/link` codes; priority, quiet hours, presence-aware delivery | ✅ |
| T03 | Reminders with button check-ins, escalation, snooze; tick endpoint driven by cron-job.org + GitHub Actions backup | ✅ |
| T04 | MemWal memory per user, `memory_log` with job id and blob id, Forget via tombstones | ✅ |
| T05 | Dashboard: settings, channels, history, export, AI chat, voice input | ✅ |
| T06 | Sign-in: Telegram, Discord and Slack OAuth, email magic link (Brevo), email attach/detach (5 per day) | ✅ |
| T07 | Agent API + MCP bridge with role-scoped tokens | ✅ |
| T08 | Admin role (`ADMIN_USER_IDS`, `ADMIN_EMAILS`), user list with masked email, block/unblock, memory write mode instant/digest, char counter | ✅ |
| T09 | Chat intents: create/list/delete reminders and text check-ins ("took it", "skipped") | ✅ |
| T10 | Account merge by one-time code (target stays; channels, roles, reminders, history, tokens move; memory namespace kept readable through aliases), migration 013 | ✅ |
| T11 | Long bot replies split per channel limit (Telegram 4096, Slack 3900, Discord 2000) | ✅ |

## Phase 1 — Bot and reminders polish (PRE, one commit)
| ID | Task | Depends | Notes |
|---|---|---|---|
| T12 | Reminder ↔ role link in the dashboard: role selector is mandatory, hint "a reminder belongs to a role"; marker `created_from` (`dashboard` / `chat`) shown in the list | T09 | Needs column `reminders.source`; chat-created reminders are editable and deletable in the dashboard like the rest (done) |
| T13 | Text reply to a reminder resolves the open occurrence even when the phrase is not in the intent list: pass the open occurrence (title, role) into the chat prompt as context and switch the active role to it | T09 | Cases: on-topic text, off-topic text (other role / unrelated fact → normal routing, occurrence stays open) (done) |
| T14 | "Remember now" button in the dashboard (op `memory-flush` exists) | T08 | Shows how many buffered facts will be written (done) |
| T15 | Save feedback on reminder PATCH (day, time, channel) and busy indicator on slow selects | — | Owner request from the first UX review (done) |
| T16 | Hover / focus / active / disabled states on every interactive element, no underline on buttons and cards | — | Audit every page, including admin (done) |
| T17 | Automated dashboard tests: add/remove channel, settings, export, blob links, AI chat, reminder save, merge, email attach | T10, T12 | API-level with the in-memory store plus a browser smoke test (done) |
| T18 | Real-token MCP round trip (install `@modelcontextprotocol/sdk` in `apps/mcp`, document `npx` usage) | T07 | Example config for desktop agents (done) |

## Phase 2 — Scenario matrix v5 (PRE)
| ID | Task | Depends | Notes |
|---|---|---|---|
| T19 | Multi-role critique of the matrix: product, QA, security, end user, judge, AI agent, answering model, athlete, healthy-lifestyle beginner, history-exam student, cycle and supplements tracker, admin | T12–T18 | Cheap model for drafts, one pass by the main model |
| T20 | Group P "account combinations": login via channel or email; email login without account; channel link to an account with email; last login method; two channels of different accounts; repeated `/link`; admin by id and by email; rights loss after detach; blocked user; admin deleting an account (forbidden); email change; merge with conflicts | T10, T19 | Every pair of user types × every mechanic | (done: group P, v5)
| T21 | Scripted dialogues per persona in `docs/testing/scripts/<persona>.md`: channel, role, user message, expected bot reply, expected side effect; no limits on length or duration | T19 | Includes delete, refusal, simultaneous writes from two channels (same message, conflicting facts), settings, contradiction check, abuse attempts, fast topic switching, every role | (done: docs/testing/scripts)
| T22 | Freeze the matrix | T20, T21 | Diagrams and the test run are built on the frozen version |

## Phase 3 — Trusted Contact (PRE)
| ID | Task | Depends | Notes |
|---|---|---|---|
| T23 | Migration 015: `guardian_links` (rules stored on the link), `notices` (done) | T22 | Design: `docs/design/TRUSTED_CONTACT.md`. The trusted contact must be a Vow user |
| T24 | API ops: invite, accept, set rules (missed check-ins N, silence N hours), list watched accounts, leave (done) | T23 | Confirmation by the invited user |
| T25 | Alert engine in tick: evaluates rules, notifies the guardian through their own channel priority, de-duplicates alerts (done) | T24 | |
| T26 | Notifications and dashboard updates when the guardian leaves or deletes the account (done) | T24 | Full deletion = account row removed; all links drop automatically, the watched user is notified |
| T27 | Tests N18–N21 plus deletion of the guardian account and of the watched account (done) | T25, T26 | |

## Phase 4 — Verification run (PRE)
| ID | Task | Depends | Notes |
|---|---|---|---|
| T28 | Run the frozen matrix on the TEST account with AI agents over all channels; logs in `docs/testing/runs/<date>/` | T22, T27 | Telegram via the test user account, Slack signed events, Discord interactions |
| T29 | Fix every defect found; re-run the failed scenarios only | T28 | |

## Phase 5 — Documentation (PRE)
| ID | Task | Depends | Notes |
|---|---|---|---|
| T30 | README and SELF_HOST: table of every service and the settings to make (Vercel, GitHub, Neon, Brevo, cron-job.org, Slack, Discord, Telegram, MemWal), free-stack rationale, cron design, Docker alternative | T29 | Note that Slack/Discord sign-in works only inside the installer's own workspace | (done: docs/SERVICES.md)
| T31 | Mechanics reference: account merge rules, admin role and first-admin setup, email and channel linking, write modes, Agent API, MCP, Forget | T29 | Text plus diagram for each (done: docs/MECHANICS.md) (done: docs/MECHANICS.md) |
| T32 | Diagrams (Mermaid): account life cycles, login/link/merge flows, sequence diagrams, ER and class diagrams, reminder and trusted-contact state machines, user/admin roles, notification mechanic | T22 | Drawn after the freeze |
| T33 | Roadmap and vision sections: this file plus post-hackathon items | — | |
| T34 | Clean `internal/agent-pack/TASKS.md` (archive), remove outdated notes | T29 | |
| T35 | One strong-model review of code and docs for contradictions and leftovers | T30–T34 | Warn the owner before running |

## Phase 6 — Final demo run (PRE)
| ID | Task | Depends | Notes |
|---|---|---|---|
| T36 | Curated run on the DEMO account: at least 10 meaningful mainnet blobs from about 3 users, verified with `recall()`; ids in `docs/MAINNET_EVIDENCE.md`; test users deleted | T35 | Keep a credit reserve for this step |

## Phase 7 — Last block (handled by another agent)
Article (before/after of AI-agent testing), demo video in the landing style, submission with post, bug-bounty issue. Inputs: `docs/testing/`, `docs/MAINNET_EVIDENCE.md`, this roadmap.

## Post-hackathon
| ID | Task | Depends | Notes |
|---|---|---|---|
| T37 | Bring-your-own MemWal account: user supplies account id and delegate key, stored encrypted with a server master key, never returned by any API; rotation = register new delegate key on chain, switch, remove the old one (an account holds up to 20 delegate keys; a delegate can only read and write memory) | T35 | Honest limit: the operator can technically read a server-held key |
| T38 | Seal-based encryption (decision T44) and client-side keys so not even the operator can read | T37 | |
| T39 | Chat ADMIN role: manage providers, analyse users and logs by chat | T08 | Admin-only; decide how it uses memory |
| T40 | Admin provider panel: API keys, model choice, routing | T08 | Keys currently only in Vercel env |
| T41 | Trusted Contact phase B: richer conditions, quiet hours for guardians, escalation chain | T27 | |
| T42 | Per-channel presence UI; desktop helper and browser extension; push adapters | T25 | |
| T43 | Delayed events and retry handling for Slack (enabled), idempotency review | — | |
| T44 | Rotate every secret shared during development | — | After the hackathon |

## Changelog
- Phase 1 closed: reminder role selector and `from chat` badge (migration 014), open check-in hint in the chat prompt, Remember now button, curated time zone list (one entry per UTC offset, key cities), suspended-account behaviour (notice in each bot, no reminders, dashboard sign-in refused with a message), MCP round-trip test, CI installs the MCP SDK.

- 2026-10-09: Trusted Contact implemented (T23–T27): migration 015, `packages/core/guardian/`, dashboard page "Trusted contact", tick step for alerts and notice delivery, 10 unit tests (invite, accept, limits, rules, leave, N18–N21, breach rules, notice delivery). Not yet in the first version: Telegram deep link and `/guardian` chat command, "share role names", acknowledgement buttons for the guardian, merge of guardian links on account merge (links of the absorbed account are dropped).
