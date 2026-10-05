> **HISTORICAL INPUT, reconciled 2026-10-04 (fable-5.1).** Product definition is now `internal/agent-pack/PRODUCT_BRIEF.md` + `VALUE_AND_AI_DESIGN.md`; roles in `VOW_SCHEDULE.md` and `VOW_STUDY.md`. What still holds from this file: the job ("portable commitment history with receipted check-ins and explicit corrections"), the user, append-only corrections, honest receipts. What changed: one Steward with Core/Schedule/Study roles (no presets, no NutriMind); desktop with Ollama is the primary surface, Telegram/web complementary; Seal Manual by default with disclosed fallback (T44); revoke/forget/delete are four different operations (PRIVACY_ACCESS_ROUTING section 3); per-device event branches with deterministic merge and explicit conflicts replace a single linear hash chain (DURABILITY section 9). Provider names, counts and "live" statuses below are historical.

# Vow — product specification

Owner: bagstreet.

**Job:** Portable commitment history with receipted check-ins and explicit corrections.

**User:** A person with a specific commitment who returns after a session reset.

**Problem:** Self-reported progress can be silently rewritten or becomes inaccessible after leaving the app.

**Distinct promise:** An audit explains which check-ins counted, corrections remain visible, and the owner can recover/export their record.

**Primary surface:** Public accountability chat plus personal commitment ledger and export; one calendar/reminder option only if core is stable.

**Demo:** Make a vow and two check-ins. Reset the session. Audit the recovered history. Attempt to alter a prior entry: detect it. Append an honest correction: history stays inspectable and the summary updates.

**Domain states:** intact / tampered / unproven / empty. Validate labels against actual implementation before changing APIs.

**Specific engineering risks:** A receipt proves storage, not that a task was done. Hash chains do not prevent omitted records or multi-writer forks without a trusted head and complete enumeration. Avoid coercive shame or high-stakes behavior advice.

**Non-goals / corrections:** Walrus Promise already has an accountability experience. Do not call a chat reset, Seal or a blob receipt unique. Differentiate visible correction/audit and recovery at comparable UX quality.

**Integration acceptance:** Demonstrate cold restoration and owner-controlled export; safe timezone/day boundaries.

## Sources and precedence
Current authority is FINAL/09_naming-and-brand.md plus this project's README/PROMPT and verified changes. FINAL/02 is an older functional proposal, not permission to override final identity. Read FINAL/08 reproduced failures and master/spec/article skeletons before changing core. Source project: FINAL/projects/vow-bagstreet. Latest Drive work is not automatically main; record provenance and inspect/test before import. Existing logos are not yet copied into this repo.

## Required release package (not an implementation claim)
- A deployed usable chatbot in at least one actual channel, with the project integration wired end to end.
- Landing and real product screens: chat, owner workflow, settings and honest empty/loading/error/offline states.
- Unique brand assets: approved logo SVG/PNG, wordmark, favicon, social preview and coherent accessible tokens. Respect approved prior assets; do not silently redesign.
- Reproducible local demo, recorded live persistence evidence, and independently accessible setup.
- Published technical article in the participant's voice, source-linked figures, and a demo/presentation video with captions.
- Clean source, tests, examples, documentation, CI, release manifest and limitations. No unrelated team materials or credentials.
- Exact official eligibility/prize checklist rechecked from primary rules before submission. The FINAL 09 document records >=10 Mainnet blobs, agent identification, public setup, disclosed LLM and separate Sessions wallet; verify current wording rather than blindly treating every internal suggestion as a rule.

## Truth and authorship
A planning document is not proof of implementation. Statuses: planned, implemented-not-run, tested-offline, tested-integration, verified-mainnet, deployed-verified. Each completed item links command, commit SHA, date, result and artifact. Test count is not coverage. A local hash is not a Walrus receipt. Receipt proves persistence, not truth. Preserve actual author and committer identities; do not fabricate participant commits or disguise agent assistance. Transfer/mirror can preserve existing authorship; later participant commits use their own identity. Private-fork availability depends on account settings; repository transfer requires explicit owner approval.

## Quality gates
Measure full code coverage of safety-critical policy branches and negative cases; proposed target 100% policy branch coverage with documented unreachable exceptions, >=90% application line coverage. Also run mutation/property tests, auth isolation, pagination/completeness, concurrent writes, retries, restore and e2e. Do not publish thresholds as achieved until measured. Deterministic mutation tests prove code branches, not that a hosted LLM obeys a prompt.

All chat generation happens AFTER deterministic policy/authorization checks. Bound input/output, rate limits, budgets and retries. Keep owner secrets out of server/browser artifacts as specified by actual SDK trust model. Semantic recall is candidate retrieval, not a complete transaction inventory; do not decide complete history from top-k absence. Define an authoritative head/manifest, enumeration/pagination and conflict protocol.

## Execution handoff
One agent owns one project; another reviews its findings. Load only project specification, current task, relevant style profile and one stage skill. Cache source by commit SHA; update changed files only. Use a read manifest to distinguish downloaded, inspected, tested and blocked. Keep graph AST edges separate from inferred design edges. Never mark a folder reviewed because its listing was retrieved.

The worktree may retain research/style instructions; the public release contains only product-facing docs. Product PROMPT.md is a shipped chatbot contract, not assistant configuration. Keep preparation STYLE_GUIDE.md in the workshop; reconcile release exclusions before publishing final participant repo. License selection needs the owner's approval, not an invented MIT claim.

## Official rules checked directly — 2026-10-01 Minsk
Primary source: https://thewalrussessions.wal.app/chatbots/index.html . Deadline 2026-10-09 14:00 UTC / 17:00 Minsk.

- User confirms shared research/tooling is permitted and each participant selected/corrected their own idea and independently reviews their result. Preserve individual responsibility and truthful provenance; official one-submission-per-person/team wording remains recorded, not an unresolved repeated initialization question.
- Deployed working chatbot with Walrus Memory on Mainnet; at least 10 blobs, agent ID and count; public source/setup; disclose LLM; dedicated Sessions wallet.
- Medium/Inkray article must show before/after and evidence of real use; feedback needs a bug/friction point and improvement idea; Discord membership; share article on X with the required tag/hashtag. Track exact completion per participant.
- Real-World Use is explicitly judged. Run actual user sessions, record consent, task, successful/failed journeys, cold-session recall and the user's result. Autotests do not establish usability or demand. Team testers should be labeled as such; external target users strengthen evidence but are not a quota invented by this plan.
- Beyond the Big Two is based on the primary model/provider and documented runtime friction; do not repeat the earlier unsupported model-origin exclusion. Cite the current actual clause.
- A separate video, dashboard and landing are the team's requested complete product package; this page does not mandate all of them or a 60-second runtime.

## Accepted required scope — 2026-10-01
Required platforms: web, telegram, api, sdk, discord, calendar-reminders, cli-export-restore. Specialized adapters must be implemented. Authenticated web chat + individual dashboard + authoritative blob history + namespace settings are mandatory. See [accepted architecture](docs/ACCEPTED_SCOPE.md), [explicit connector tasks](docs/CONNECTOR_TASKS.md), [upstream research gates](docs/UPSTREAM_RESEARCH.md). Desktop macOS and Chrome extension are conditional tracks, not forgotten requirements. All previous optional language about these listed platforms is superseded. Auth/hosting choice is recommended pending architecture approval and deployment credentials.
