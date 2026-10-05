> **HISTORICAL INPUT, reconciled section by section 2026-10-04 (fable-5.1).** Authoritative plan: `internal/agent-pack/TASKS.md`. Mapping:
> - "Critical product loop", "Criticism and strengthening": **reused** as PRODUCT_BRIEF product test and T04 core tests.
> - "Signature wow-effect": **replaced** by the desktop reminder -> ack -> cold recovery demo (T37/T38) and visible corrections/audit; not "memory survives reset" alone.
> - "Proposed HTTP endpoints", "Proposed technical baseline and contracts", "API / SDK acceptance": **partly reused**: the shared core and REST stay (T04, T07.4) but auth is signed-challenge + device link (T03), storage states are `queued/pending/stored/failed/dead` (DURABILITY section 9), and endpoints are generated from the typed operations table, not from this list.
> - "Self-host and installation contract": **reused** in T11 with the persistent-volume requirement added.
> - "Tests beyond human validation", "Full line-by-line review gate": **reused** as T09 eval and AUDIT_BRIEF criteria E/G.
> - "Complete per-owner release checklist": **reused** in T16.
> - "Order and cut line": **superseded** by the TASKS cut line (accepted scope Schedule/Study/desktop is never cut).
> - "Accepted required scope", "Product consensus", "Approved product enhancements", "Pinned competitor response", "Approved presets and competitor-first gate" (PSET-UX, PSET-PRIVACY, prototype PR #1 with "14 preset tests"): **superseded**: no presets; PSET-PRIVACY requirements (consent, export, deletion contract, job cancellation, fail-closed restore) were generalised into PRIVACY_ACCESS_ROUTING sections 3 and 7 and T25/T46; the preset test count is historical and not a current claim.

# Vow — final implementation plan

Individual owner: bagstreet. Goal: professional competitive submission with a genuine before/after memory benefit, not a guarantee of a prize. The owner independently approves and verifies this release; shared research/tooling is permitted as stated by the user, and individual authorship/provenance remains truthful. Human testers already selected; add execution evidence instead of restarting recruitment.

## Critical product loop
Make a vow and two check-ins. Reset the session. Audit the recovered history. Attempt to alter a prior entry: detect it. Append an honest correction: history stays inspectable and the summary updates.

### Minimum complete capabilities
- [ ] capture a specific commitment
- [ ] append receipted self-report check-in
- [ ] explicit correction without erasure
- [ ] calendar-aware summary and audit
- [ ] owner recovery/export and cold-session continuity

## Criticism and strengthening
**Weak point:** Walrus Promise already has smooth accountability, Seal and fresh-session memory. Hash-chain terminology alone adds little user value and receipts do not prove a task was done.

**Strengthen:** Win on transparent correction, migration and trustworthy summaries without shame. Compare same commitment story and cold-session recovery at equal UX quality; distinguish self-report vs corroborated evidence and collect tester feedback.

## Signature wow-effect, after core correctness
Receipt rewind: attempt an edit, see audit refuse; append correction and watch the timeline keep both claims. Export and reopen in a fresh client with a trusted manifest/head.

**Widget:** Warm receipt timeline, calendar-aware streak and gentle correction UI; never claim stored self-report proves completion.

**P2 only:** One reminder/calendar ICS export. No staking, punishment or finance integrations.

## Proposed HTTP endpoints
- `POST /v1/vows`
- `POST /v1/vows/{id}/checkins`
- `POST /v1/checkins/{id}/corrections`
- `GET /v1/vows/{id}/summary`
- `GET /v1/ledger/export`

**TS SDK:** VowClient.makeVow / checkIn / correct / audit / export / restore; idempotency key mandatory for appends.

## Proposed technical baseline and contracts
These are implementation choices for the next stage, not claims about deployed software. Preserve existing ES-module policy and tests until intentionally migrated; expose pure policy through a small TypeScript Node service, schema validation (Zod), versioned HTTP JSON and an OpenAPI document. React/Vite for usable product and landing; Tailwind with per-project tokens. Node test runner for existing policy, Playwright for browser e2e, property/mutation regressions and contract tests against pinned installed SDK. Pin MemWal 0.1.8 or another independently verified version and its lockfile; root client/auth contract must be tested. Hosted model configured via server environment with bounded calls and explicit provider/model name; model proposes/narrates, policy authorizes.

Walrus remains durable memory source. Runtime SQLite/cache may accelerate access but is not the only durable memory copy; rebuild it from a Walrus-stored signed manifest/head and directly enumerated references. Semantic recall finds candidates, not ledger completeness. Include owner/namespace/version/last-head/previous-head in authoritative manifests; single-writer expected-head guard + idempotency for MVP, explicit conflict/fork detection on restore. No claim of secure multi-device concurrent writes until atomic authoritative coordination is verified. Fail incomplete rather than fabricate a current ledger.

Single-node self-host contract first. Separate authenticated write actions from public/demo reads; role and scope derived from trusted principal, CSRF protections for cookie actions, request size/timeout/rate limits, redacted logs, safe origin/CORS, bounded source fetch, scoped delegate key rotation/revocation and strict secret isolation. No owner private key in browser or repository. Production cannot silently select a mock. A local syntax-only change is not Mainnet validation.

## API / SDK acceptance
Publish OpenAPI schemas, typed client package in sdk/ (initially in-repo, not falsely claimed as npm published), stable errors with reason codes, request correlation id, explicit mode and evidence status. Streaming chatbot endpoint uses bounded SSE and returns final structured decision plus citations; abort cancels expensive work. Required: auth, tenant/role isolation, invalid JSON/schema, pagination, timeout, retry exhaustion, idempotent duplicates, 429 and model refusal tests. Add API versioning, examples and a five-minute local quickstart. Keep one maintained TS SDK, not six language implementations. Product-specific methods differ even if transport utilities are shared.

## Self-host and installation contract
Provide .env.example with placeholders, scripts/setup.sh (checks pinned Node/container runtime, dependencies and build), Dockerfile, docker-compose.yml and scripts/doctor.mjs. Setup is explicit and inspectable: no curl-pipe-shell, no key generation/upload without user action, no auto Mainnet spend. `--demo` uses labeled fixtures; `--real` fails without correct credentials. Document dev/test/start and one-command container launch, health/readiness, persistence volumes, backup/restore, reverse-proxy TLS, upgrade/migration and teardown. Run setup in a clean container/checkout, not only developer worktree. Wallet funding and production provider secret bindings are separate authorized tasks.

## Tests beyond human validation
Humans already selected by the owner; do not substitute synthetic agents for them. Build scenario matrix mapping every requirement to unit, property, mutation, API contract, integration, browser e2e and owner-run test. AI scenario agents execute real interfaces using isolated fixtures, not simply rate screenshots: baseline vs memory-aware, fresh-session recall, missing evidence, revocation/drift, conflicting updates, unauthorized owner/role, injection in stored/source data, retries, concurrent check-ins, history omissions, mobile keyboard flows and deployment recovery. Model/provider matrix only after deterministic coverage; cap requests/credit budget and preserve output. Independent agent reviewer reruns tests from a fresh checkout and records inspected/uninspected paths. Actual users test meaningful tasks with consent and report friction; participation and independent review recorded per owner. No prize prediction from test metrics.

## Full line-by-line review gate
Every tracked text file is assigned a reviewer and status (unread / reviewed / regression-needed / verified / generated-dependency). Record path, Git SHA, line count, purpose, inputs/outputs, trust boundary, defect/task and verification command. Review all application, test, build, deployment, config, documentation and example source; generated minified dependencies are identified separately, not called human-reviewed source. Binary logos/media require rendering and approval. No broad downloaded=reviewed claim. Subsequent changes invalidate reviewed status for changed SHA only.

## Complete per-owner release checklist
- [ ] Fix all reproduced P0 regressions; review returned patch, old vs new tests and negative cases before acceptance.
- [ ] Migrate only this owner's code, approved logos/media and relevant docs. Preserve authentic history when possible; no fabricated authorship.
- [ ] Deploy working chat + integration + domain owner panel + landing, with no simulated live state.
- [ ] Execute clean self-host setup, API/SDK examples and restore.
- [ ] Owner's testers complete positive/negative fresh-session scenarios; independent AI review validates every mandatory scenario.
- [ ] Explain why the remembered information changed an actual result; comparable competitor assessment is scoped and evidence-backed.
- [ ] Draft article from verified release evidence in this author's distinct voice; no copied outline, anecdote or claims.
- [ ] Record demo/presentation video from release, including negative refusal and successful recovery, readable captions and accurate mode.
- [ ] Unique landing composition, typography, motion rhythm, logo and product workflow pass responsive/accessibility review.
- [ ] Update README, limitations, architecture diagram, API docs, examples, changelog/security and roadmap with exact current SHA and results.
- [ ] Owner independently opens public repo/app/article/video/evidence, completes official Mainnet/blob/feedback/model/wallet/X submission gates.

## Order and cut line
Follow ROADMAP.md stages P0-P7. Finish core plus one primary integration first; API/TS client and install scripts support portability; a second connector, browser extension or 3D hero must not delay real user flow, safety or article/video. Substantive scope changes require this participant's approval.

## Latest verified execution status
Core repaired source and regression report published: https://github.com/aleksgleams-pixel/vow/commit/bd31eddc21fc1a8f9ce86e97f045f30d54ca0ce9. Live Mainnet and deployed UI remain unverified. See docs/P0_REPAIR_STATUS.json and docs/P0_REPAIR_REPORT.md; residual gaps are not marked fixed.

## Accepted required scope — 2026-10-01
Required platforms: web, telegram, api, sdk, discord, calendar-reminders, cli-export-restore. Specialized adapters must be implemented. Authenticated web chat + individual dashboard + authoritative blob history + namespace settings are mandatory. See [accepted architecture](docs/ACCEPTED_SCOPE.md), [explicit connector tasks](docs/CONNECTOR_TASKS.md), [upstream research gates](docs/UPSTREAM_RESEARCH.md). Desktop macOS and Chrome extension are conditional tracks, not forgotten requirements. All previous optional language about these listed platforms is superseded. Auth/hosting choice is recommended pending architecture approval and deployment credentials.

## Final preparation decision — 2026-10-01
Provider-neutral first verified login and explicit linked identities; managed memory default with declared server trust, separate cryptographic/tenant/role authorization, advanced user-owned delegation only after feasibility proof. Never request wallet seed. Security/auth and search/encryption feasibility gates: [SECURITY_AUTH_ADR.md](docs/SECURITY_AUTH_ADR.md). Conceptual value scenario: [VALUE_SIMULATION.md](docs/VALUE_SIMULATION.md), not real-use evidence. Successor entry point: [HANDOFF.md](docs/HANDOFF.md). Current live credential access returns401: [access status](docs/MEMWAL_ACCESS_STATUS.md). Whole-code/source-reuse audits remain unfinished gates; controlled implementation handoff is possible, not all preparation/release completion.

## Product consensus checkpoint — 2026-10-01
Read [product strengthening](docs/PRODUCT_ENHANCEMENT_CONSENSUS.md) and [agreements/dissent](docs/CONSENSUS_DECISIONS.md). Existing core/platforms remain mandatory. New additions are owner-review proposals, not implemented scope. A useful full outcome loop and explicit repair step precede ornamental wow/brand changes. Renewed credentials allow scoped read; terminalwrite/coldretrieve still unconfirmed, see access status.

## Approved product enhancements — 2026-10-01
The user accepted consensus strengthening. Complete [approved delivery tasks](docs/APPROVED_ENHANCEMENT_TASKS.md) and the existing signature outcome, not only refusal infrastructure. Status is approved-to-implement, not deployed/tested feature. Further roles/brand concepts are explicitly proposed where not approved. Required platforms unchanged. Priority competitor snapshots Walcoach42d98e4e and Intercallf4c45ca5 are undergoing deep evidence review, not assumed weaknesses.

## Pinned competitor implementation response
Walcoach and Intercall code audits complete within recorded boundaries; see [project response tasks](docs/PRIORITY_COMPETITOR_RESPONSE.md) and shared master audits. Approved enhancement tasks stay mandatory. Structured helpful cards and cross-mode continuity must preserve domain policy/auth/consent; avatars alone are not new roles. Build a runnable individual product next, not another generic plan.

## Approved presets and competitor-first gate — 2026-10-03
User approved two Vow presets (not a seventh product): medication reminders and NutriMind. This decision is now part of required scope, not an optional brainstorm. Existing required platforms stay mandatory.

**Sequence:** complete pinned competitor analysis and six-product strategy reconciliation BEFORE further product implementation or merge. Current PR1 is an unmerged prototype, not strategic acceptance. Do not implement more presets merely to match a feature count.

- RX-01 medication: user-confirmed schedule, IANA timezone/DST, due-without-report distinct from self-reported taken/skipped, snooze, pause/stop, quiet hours, consent-based bounded escalation. Only explicit user acknowledgements create self-reports. No diagnosis/dose/treatment recommendations.
- RX-02 Telegram/Discord/Slack/push: verified account linking, authorized callbacks, unique occurrence IDs, cross-channel dedupe, retries/cancel/quiet-hours, audit of delivery versus acknowledgement. Universal online presence and guaranteed reach are NOT assumed.
- NM-01 NutriMind: food/hydration/preference diary, user-set goals, confirmed long-term preferences, corrections and returning-user context. No invented nutritional diagnosis or medical/supplement prescriptions.
- PSET-UX: distinct preset onboarding/action cards/dashboard, actual persistent state and source/provenance, not only persona change. Final UX follows competitor analysis and approved design direction.
- PSET-PRIVACY: consent, export, application-copy deletion/crypto-erasure contract, scheduled job cancellation, fail-closed restore after deletion; verified storage/keys required.
- PSET-EVAL: timezone/DST, multi-dose, duplicates, missed-vs-unreported, downtime, stop, access isolation, real-channel e2e, human same-task comparison. No mock counts as live integration.

Prototype evidence: PR https://github.com/aleksgleams-pixel/vow/pull/1, commit d8eb5f97f80fa1057264011d17489bd5ab9fc5c3; parent independently ran14preset tests0fail and reproduced2distinct due intents/no invented missed checkin. No UI, durable scheduler or live channel adapters. Full existing suite/CI not independently verified. PR UNMERGED and on hold pending strategy. Documentation decision only; not a release claim.

Candidate enhancements shared across products remain proposals pending competitor evidence/consensus: typed action cards; confirmed extracted facts; explicit pending/stored/failed receipt lifecycle; portable cold continuation; per-domain presets; deletion lifecycle. Each strategy maps evidence to specific domain acceptance tests, not six recolored templates.
