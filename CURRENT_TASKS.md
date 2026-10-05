# Vow: implementation tasks T00-T46 (authoritative plan, revised 2026-10-04 by fable-5.1 audit)

**Deadline:** 2026-10-09 14:00 UTC (17:00 Minsk). Day 0 = 2026-10-04. Every task lists: files, steps, tests, Definition of Done (DoD), dependencies. Do not start a task before its dependencies pass. Commit docs and code straight to `main` in small commits; run the test suite before each commit. Never commit secrets. Record each task status in `docs/audit/ACCEPTANCE_STATUS.md` as `planned / implemented-not-run / tested-offline / tested-integration / verified-mainnet / deployed-verified` with command, SHA, date. A fixture, mock, local hash or planned text is never "verified".

**Accepted product (owner decisions, latest wins):** one Commitment Steward with role modules (Core commitments, Schedule, Study). Required surfaces: **Tauri desktop app with Ollama local LLM** (T37/T38) plus the shared core; Telegram and web are complementary surfaces, not the critical path. Manual Seal (client-side) by default, RBAC on the bot server, universal LLM router with deterministic tail. Health/medication *advice* is out of scope forever; a user-defined reminder schedule (any item, may be a pill) is in scope with the safety/consent rules in `VOW_SCHEDULE.md`. The old `docs/PRESET_MEDICATION.md` / `docs/PRESET_NUTRIMIND.md` personas are superseded (see those files).

Read before coding: `START_HERE.md`, `PLATFORM_CONTRACTS.md`, `VALUE_AND_AI_DESIGN.md`, `PRIVACY_ACCESS_ROUTING.md`, `DURABILITY_AND_CONTEXT.md`, `VOW_SCHEDULE.md`, `VOW_STUDY.md`, `ADMIN_COMMANDS.md`, `VOICE_ROLE_PROMPTS.md`, then `docs/planning/PROJECT.md` and `docs/audit/ACCEPTED_SCOPE.md` (historical, reconciled headers tell what still applies).

Existing code note: the repo today contains an `.mjs` prototype (`ledger/`, `bin/`, `mcp/`, `src/presets/*`, `tests/*`). TASKS below name TypeScript targets under `src/`; the executor may keep `.mjs` if the pinned toolchain makes TS costly, but the module boundaries and tests are mandatory. `src/presets/medication.mjs` and `nutrimind.mjs` are legacy prototype code: do not extend; T39 replaces them with the Schedule role and T12 removes or quarantines them.

## Day plan and critical path
- Day 0 (10-04): T00, T44 spike (stop/go), T01, T02 start.
- Day 1 (10-05): T02 finish per T44 outcome, T03, T04 start, T41.
- Day 2 (10-06): T04, T05, T06, T43, T42 basic, T39 Schedule core.
- Day 3 (10-07): T37 desktop shell + Ollama adapter, T40 Study demo, T08, T17/T24, T45, T46.
- Day 4 (10-08): T10 Mainnet proof, T38 desktop demo, T07.1 web, T07.2 Telegram, T09 eval, T11 deploy, T12 README.
- Day 5 (10-09 until 12:00 UTC): T13, T14, T15, T16.
Critical path: T00 -> T44 -> T02 -> T03 -> T04 -> T05/T06 -> T39 -> T37 -> T10 -> T38 -> T12 -> T16. Telegram (T07.2) and web (T07.1) are complementary and come after the desktop demo works against the shared core.

## T00 Baseline (day 0)
Files: `docs/audit/ACCEPTANCE_STATUS.md`, `docs/audit/GRAPH_REPORT.md`.
Steps: run `npm test` on the current head and record the real pass/fail counts (replace the inherited "41 tests / 7/7" claims); run `graphify update .` (AST only, no LLM); list known blockers from `docs/planning/KNOWN_LIMITATIONS.md`.
DoD: baseline file committed with command output, SHA, date; no code change.

## T44 Day-0 Seal/Manual decrypt spike (stop/go for T02) depends T00
Files: `docs/audit/FRICTION.md` (new), `spikes/seal_manual_spike.md` (notes; no production code).
Steps: on the pinned `@mysten-incubation/memwal` version, attempt in a throwaway script: create an account on testnet or a dedicated mainnet test account, write one record with `MemWalManual` (client-side Seal), read it back from a *new process* with the same delegate, then from a process *without* the key (expect failure). Record SDK version, exact calls, errors, timings.
Context: Hippo SPIKES (lines 505-523) report Manual decrypt via API-key provider working since 2026-10-02; the Matrix N failure is historical. The spike confirms it on OUR pinned version; it does not assume it.
Outcomes (write the chosen one in FRICTION.md and PRIVACY_ACCESS_ROUTING.md section 1):
- GO-Manual: decrypt works -> T02 implements Manual Seal as default.
- GO-Fallback: Manual fails or is unstable -> T02 implements relayer mode + app-layer AES-GCM encryption before `remember()` so the relayer still sees only ciphertext; UI shows mode `app-encrypted (relayer)`; this is a disclosed change, never silent.
- STOP: neither works -> escalate to owner; no "Seal active" claim anywhere.
Tests: none in CI (spike), but the spike log must contain the real command output or state "not executed". A non-executed spike is allowed as an engineering plan and must be labelled `not executed`; no fabricated output.
DoD: FRICTION.md entry with verdict GO-Manual / GO-Fallback / STOP; T02 may start only after this entry exists.

## T01 Universal LLM module (day 0-1) depends T00
Files: `src/llm/{types,client,chain,breaker,deterministic}.ts`, `src/llm/providers/{openai_compat,anthropic,gemini,ollama}.ts`, `llm.config.ts`.
Steps: implement `PLATFORM_CONTRACTS.md` section 3. Providers via env keys only: Ollama (local, `OLLAMA_URL`, required for desktop), Groq, Cerebras, OpenRouter, Mistral, DeepSeek (openai_compat with base URL), Anthropic, Gemini. Task tiers: router / extract / answer. Circuit breaker, per-task policy, deterministic tail that never throws. Ollama is a first-class provider, not a fallback-only path.
Tests (fake provider): failover on 429/5xx/timeout; breaker opens after N failures and half-opens; deterministic tail never throws; same typed result shape across providers; no key in logs; injection text in recalled memory stays data; Ollama adapter speaks `/api/chat` with JSON mode and respects `MODEL_REGISTRY` context size.
DoD: `npm test` green offline; one manual smoke with one real provider recorded as `tested-integration` only if actually run.

## T02 Memory port and Walrus adapter (day 0-1) depends T00, T44
Files: `src/memory/{port,memwal,manual_seal,receipts,manifest,events}.ts`.
Steps: pin `@mysten-incubation/memwal`; write an installed-module contract test first (fixes the SDK adapter P0 in KNOWN_LIMITATIONS). Implement `MemoryPort` with receipt states `queued -> pending -> stored(blob_id) | failed | dead` (never "saved" before `stored`). Seal mode per T44 verdict. Event model and head manifest per `DURABILITY_AND_CONTEXT.md` section 9 (event ids, per-device sequence, hash branches, signed checkpoint, conflicts). Complete enumeration via manifest, not top-k recall. Env: `MEMWAL_ACCOUNT_ID`, `MEMWAL_SERVER_URL`, `MEMWAL_PRIVATE_KEY` (delegate), env only. Known SDK facts to code around: issue #1083 (30-minute bucket duplicate boundary -> dedupe by event id, not by time bucket), #1108 (`restore()` may silently truncate -> treat restore as hint, enumerate by manifest and verify count), #1043 (no delete method in SDK; deletion is the owner-wallet Security Delete API, see PRIVACY_ACCESS_ROUTING section 3).
Tests: injected failure -> `failed` surfaced; null/short restore -> flagged `incomplete`, not success; cross-principal read denied; recall absence never implies absence in history; memory off -> no read or write on any path; dedupe by event id across a simulated 30-minute boundary.
DoD: contract test + offline suite green; integration run with the dedicated test account recorded separately with SDK version.

## T03 Identity and authorisation (day 1) depends T02
Files: `src/auth/{challenge,session,principal,namespace}.ts`, `src/auth/device_link.ts`.
Steps: signed-challenge sign-in (wallet or Ed25519 device key), single-use nonce, short session (<= 24 h, refresh), principal bound to account; no public id as authority; canonical ids; namespace = full SHA-256 digest of `(account_id, principal, scope)`. Device link for desktop: desktop generates an Ed25519 key, the owner approves it from an already-authenticated surface (QR or 8-word code), approval record `DEVICE_LINKED{device_id, pubkey, approved_by, at}` is written to memory; revoke writes `DEVICE_REVOKED`.
Tests: attacker with victim's public id and no key is denied read/write/export/summary/push; replayed nonce rejected; revoked device cannot write; namespace collision test with 1e5 random ids.
DoD: suite green; auth flows documented in `docs/audit/SECURITY_AUTH_ADR.md` header (reconciled to this task).

## T04 Domain core (day 1-2) depends T02, T03
Files: `src/core/{state,ops,commitment,checkin,correction,audit,next_step}.ts`.
Steps: implement the typed operations table in `VALUE_AND_AI_DESIGN.md` section 3 as a pure core with the state machine `draft -> confirmed -> active -> (kept | missed | paused | abandoned | completed)`, corrections append (`CORRECTION{target_event_id, field, old, new, reason}`) and never rewrite. All adapters call only this core.
Tests: product tests in VALUE_AND_AI_DESIGN section 6; a correction never deletes the original; audit lists both; `next_step` never shames (forbidden phrase list).
DoD: core has no I/O imports; coverage report committed.

## T05 Domain pack, intent gate, scope guard (day 2) depends T01, T04
Files: `domain/{scope.yaml,glossary.yaml,safety.md,examples.jsonl}`, `domain/playbooks/*.md`, `src/gate/{topic,router,postcheck}.ts`.
Steps: deterministic allowlist first, LLM only for borderline; fixed refusals (off-topic, medical question, legal/financial advice); post-check that cited record ids exist. Glossary: `cycle` = review cycle of the user's schedule, never biological; role switches vocabulary.
Tests: `PLATFORM_CONTRACTS.md` section 6; medical dose/interaction/symptom questions -> fixed refusal, main model not called; `cycle` resolves via glossary on cold start.
DoD: gate tests green; refusal copy reviewed against `VOICE_ROLE_PROMPTS.md`.

## T06 Cold recovery and export (day 2) depends T04
Files: `src/recovery/{restore,export,import}.ts`, `bin/vow.mjs` (export/restore/audit subcommands).
Steps: restart with empty local state; rebuild from manifest enumeration (complete inventory) then verify hash branches; export = JSONL of events + `manifest.json` + `sha256sum` file; import round trip; honest labels `stored` vs `pending` vs `local-only`.
Tests: cold restore reproduces the same head hash; export->import->export is byte-identical; truncated restore (#1108 simulation) is detected and reported as `incomplete`.
DoD: `vow export|restore|audit` work offline against the mock and the recorded fixture.

## T39 Schedule role (day 2-3) depends T04, T05, T41
Files: `src/roles/schedule/{model,scheduler,parse,ack,summary}.ts`, `domain/playbooks/schedule.md`, `tests/schedule.test.*`.
Steps: implement `VOW_SCHEDULE.md`: item model (`SCHEDULE_ITEM{item_id, label(opaque), times[], recurrence, tz, created_by, consent_id}`), scheduler fires `REMINDER_SENT{item_id, due_at, channel}`, acknowledgement `CHECKIN{item_id, due_at, result: taken|skipped|snoozed, ack_at, source}`; `delivered != acknowledged`; silence is `unacknowledged`, never `skipped`. Free text "remind me at 9 and 21" -> LLM parse -> user confirms -> save. Pause/resume items and whole role; weekly summary = deterministic counts. Consent record required before the first reminder (see VOW_SCHEDULE section "Sensitive data, consent, minimisation").
Tests: dose / interaction / symptom questions -> fixed refusal; missed ack stays `unacknowledged` after window; pause stops reminders and is recorded; parse+confirm never saves without confirm; summary counts match events; label treated as opaque (no lookup, no normalisation); no-medical-claims lint over README/site copy.
DoD: all tests green; desktop notification path wired in T37; copy approved per VOW_SCHEDULE legal note.

## T37 Tauri desktop app with Ollama (day 3-4) depends T01, T03, T39, T41
Files: `desktop/src-tauri/{tauri.conf.json,src/main.rs,src/notify.rs,src/keystore.rs}`, `desktop/src/{App.tsx,pages/*,lib/core_bridge.ts}`, `src/llm/providers/ollama.ts` (from T01).
Steps: Tauri 2 shell; local SQLite outbox (T41) in the app data dir; native notifications for Schedule reminders with "Taken / Skipped / Snooze" actions mapped to `CHECKIN`; Ollama as default provider when `OLLAMA_URL` reachable, router falls back to cloud providers only if the user enabled them (setting default: local-only, shown in UI); device-link auth (T03); memory-off switch honoured; delegate key in OS keystore, never in plain files.
Tests: Rust unit tests for notification action -> event mapping; TS tests for core bridge with the fake provider; offline run (no network) still schedules, notifies, records locally and shows `saved locally`; Ollama unreachable -> clear banner, no silent cloud call.
DoD: `cargo tauri build` succeeds on one OS in CI (artifact uploaded) and a signed screenshot/recording of a reminder -> ack -> ledger entry is recorded in `docs/audit/ACCEPTANCE_STATUS.md` with date; or the status honestly says `implemented-not-run`.

## T38 Desktop demo and privacy note (day 4) depends T37, T10
Files: `docs/DESKTOP_DEMO.md`, `desktop/README.md`.
Steps: scripted demo: create schedule item -> native reminder -> ack -> cold restart -> history recovered; privacy note: local LLM, what leaves the device (only ciphertext to Walrus, nothing to cloud LLM unless enabled), no medical advice, revoke vs erase.
Tests: demo script run recorded with timestamps; links to blob ids from T10.
DoD: demo doc has real output or `not run` labels; no fabricated screenshots.

## T40 Study role: simple demo plus vision (day 3-4) depends T04, T05, T43, T17
Files: `src/roles/study/{upload,lessons,quiz,mastery,progress}.ts`, `domain/playbooks/study.md`, `tests/study.test.*`, admin section in web/desktop settings (visible only when Study is enabled).
Steps: implement `VOW_STUDY.md` section 2 MVP exactly: upload (`.txt`, `.md`, text-extractable `.pdf`; 200 KB text cap; see VOW_STUDY "File rules") -> LLM split into <= 10 lessons (JSON schema, temp 0) -> owner approves/edits -> MCQ quiz graded by code -> deterministic mastery (2 correct on different days) -> admin progress view. Records `MATERIAL, LESSON, HIT, MISS, MASTERED, PROGRESS` in `study/<material_id>`.
Tests: injection in uploaded text does not change behaviour; 10-lesson cap; MCQ grading deterministic; two correct on one day do not master; cold restore rebuilds progress; provider failover keeps quiz state; oversize/forbidden file rejected with a clear message; raw document never written to Walrus.
DoD: tests green; vision roadmap stays in VOW_STUDY section 3 and is labelled planned.

## T07 Complementary surfaces (day 4) depends T04, T05, T37
Build on the shared core; each adapter is thin. Order: T07.1 web, T07.2 Telegram, then the rest only if time remains.
- T07.1 `web`: chat + ledger + export + settings (mode, roles, memory-off). Tests: signed ingress, linked principal, same typed ops, receipt state shown, fake-provider test.
- T07.2 `telegram`: reminders and inline check-ins as a complementary channel (desktop is primary). Tests: secret-token ingress verification, linked principal, retry/dedupe by event id, receipt state shown.
- T07.3 `discord`, T07.4 `api`, T07.5 `sdk`, T07.6 `calendar-reminders` (ICS; delivered != acknowledged), T07.7 `cli-export-restore` (done in T06): optional after the above.
Shared UX per `docs/audit/CHATBOT_UX_CONTRACT.md`: first useful action, truthful unavailable badge, model error separate from storage status, tool status only from verified output. Web design per `docs/DESIGN-SYSTEM.md`; do not touch `web/` landing files owned by landing agents without pulling first.

## T08 Security and consent (day 3) depends T03
Files: `tests/security/*.test.*`, `docs/audit/THREAT_MODEL.md` (new, short).
Steps: rate limits and budgets before model/Walrus spend; input size bounds (message 4 KB, Study upload per VOW_STUDY); ingress signature verification (Telegram secret token, Discord signature); secret scan in CI; log redaction (labels, item names, tokens); consent records for Schedule and Study; memory-off and deletion semantics documented honestly (revoke != erase); prompt injection suite (T43 corpus); SSRF guard on any URL input; role isolation.
Tests: each item above has a failing-then-passing test; redaction test proves item labels never appear in logs.
DoD: THREAT_MODEL.md lists each threat -> control -> test file.

## T09 Evaluation (day 4) depends T05, T06, T39
Files: `eval/{personas,cases,run.ts,report.md}`.
Steps: paired memory ON/OFF cold-session tasks with exact-match rubrics; off-topic suite; medical-refusal suite; cold-start ambiguity ("cycle"); provider failover drill; Ollama vs cloud parity on 10 golden prompts.
DoD: `eval/report.md` with real numbers or `not run` per row.

## T10 Mainnet proof (day 4) depends T02, T06
Files: `docs/MAINNET_EVIDENCE.md`.
Steps: dedicated Sessions wallet and MemWal account (not the owner's personal wallet); >= 10 real blobs; agent id and count; blob ids verified on a Walrus explorer; cold-client recall from a new process; manifest checkpoint hash recorded.
DoD: evidence file with ids, dates, SDK version, explorer links; mock or local hash is not evidence.

## T11 Deploy (day 4) depends T07.1, T08
Steps: web/API on Vercel/Render with a persistent volume (ephemeral disks called out as unsafe in docs); secrets in platform env; health endpoint reporting model chain, storage status, outbox pending/dead counts.
DoD: public setup docs; health endpoint output pasted in ACCEPTANCE_STATUS.

## T12 README, docs, diagrams (day 4) depends T10, T38
Steps: rewrite README from actual state (what works, planned, how to run desktop/CLI/web, how to verify); architecture diagram from graphify AST + Mermaid; remove or quarantine `src/presets/*` legacy, mark superseded docs; keep KNOWN_LIMITATIONS current; badges only from CI/eval output.
DoD: README passes the role review in `AUDIT_BRIEF.md` criterion F; no unverified count or "Live" claim.

## T13 Real-world use sessions (day 4-5) depends T38
Record consented sessions (task, success/failure, cold recall) in `docs/REAL_USE.md`; label team testers.

## T14 Article (day 4-5), T15 Script and video (day 5): see `ARTICLE_SCRIPT_VIDEO_PLAN.md`; before/after must come from real runs.
## T16 Submission (by 2026-10-09 12:00 UTC)
Re-read official rules (`docs/audit/OFFICIAL_RULES.md` snapshot); checklist: Mainnet blobs and agent id/count, public source and setup, disclosed LLM (Ollama local + any cloud used), dedicated wallet, article with before/after and real-use evidence, friction feedback (FRICTION.md), Discord, X share with the required tag. Delete `internal/agent-pack/` only during public cleanup after secrets and provenance review.

## T17-T28 (platform hardening, authoritative with T00-T16)
- T17 Account modes + RBAC: `ACCOUNT_MODE=shared|per_user`; `domain/roles.yaml` (owner/editor/viewer + role modules schedule/study); role check before recall; tests: cross-role read denied, viewer cannot write, role change effective next turn; Seal on all records; docs page "Access and privacy". depends T03
- T18 Recall pipeline: message + profile query, distance threshold 0.7 (configurable), dedupe 0.25, pending bridge ~30 min, `pending` until job completes; restore is a hint, manifest is truth (#1108). Tests with fake relayer incl. delay and top-k noise. depends T02
- T19 Memory panel (web/desktop) + export + memory-off switch honoured on every path; shows recalled items, distances, blob links, receipt status. depends T18
- T20 `eval/` personas and FRICTION.md with filed MemWal issues; write queue backoff (merged into T41). depends T09
- T21 Digest operation (weekly/on demand) built only from stored records. depends T04
- T22 LLM router env-driven providers + breaker + per-task policy + deterministic tail (merged into T01); topic gate + domain pack + safety in code (T05).
- T23 Seal mode switch + active-mode indicator + tests (default Manual; fallback disclosed per T44). depends T02
- T24 RBAC middleware + `ACCOUNT_MODE` + tests (= T17 implementation detail). depends T17
- T25 Revoke / rotate / delete flow + UI + README section with honest copy (revoke != erase; owner-only Security Delete dry-run if available; see PRIVACY_ACCESS_ROUTING section 3) with tests. depends T02, T03
- T26 Site: Privacy & Security section, nav auth buttons, footer metric badges from CI/eval (landing agents own `web/`).
- T27 Provider-parity eval and tone guard (in T09). depends T01
- T28 `prompts/` directory (persona, domain_pack, glossary, safety), topic gate, tone tests per `VOICE_ROLE_PROMPTS.md`. depends T05
- T36 Admin/settings slash commands per `ADMIN_COMMANDS.md` with role matrix tests (includes `/pause`, `/consent`, `/mode`, `/memory off`). depends T17

## T41-T43 (DURABILITY_AND_CONTEXT.md)
- T41 Durable outbox + worker + reconcile + kill-9 tests; event ids and per-device sequence per section 9; desktop SQLite local-first; server SQLite on a persistent volume. depends T02. MVP.
- T42 Context compaction + domain pack assembly + provider-parity test (basic in MVP). depends T01, T05.
- T43 Prompt escaping module + injection corpus (>= 20 strings). depends T01. MVP.

## T45-T46 (Matrix N, Hippo spikes)
- T45 Recall wrapper: retry/backoff, sequential, concurrency 2, drop-event log; correction path with tag recall, `created_at` ordering, correction-only dedupe; eval assertion "old value never returned without its correction". depends T18
- T46 Honest forget/erase copy and test: revoke -> recall fails from the server; ciphertext remains on Walrus until epochs expire or the owner runs the Security Delete API; copies already disclosed (exports, cached summaries, chat transcripts) are not recalled by revocation; `/export` with sha256 manifest. depends T25, T06

## Cut line (does not cut accepted scope)
If behind schedule on day 3: cut first T07.3-T07.6 (Discord, API, SDK, calendar), then web polish (T07.1 to minimal), then T21 digest, then Study post-hackathon extras. Never cut: T00, T44, T02, T03, T04, T05, T06, T39 Schedule, T37 desktop with Ollama, T40 Study MVP (upload -> approve -> MCQ -> mastery), T41, T43, T10, scope guard, cold-recovery demo, honest README (T12). Owner decision 2026-10-04: Schedule, Study simple demo plus vision, and desktop are accepted scope and are not sacrificed to the deadline; if time runs out, the honest status in ACCEPTANCE_STATUS says `implemented-not-run`.
