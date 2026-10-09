# Mainnet evidence (T10)

Status: **live and verified**, 2026-10-07. This replaces an earlier "not yet" state — see
`docs/planning/KNOWN_LIMITATIONS.md` for what changed and why.

## Agent / account identity
- MemWal account id (the "agent ID" for the DeepSurge submission form): `0xe18b76d1a19dcf5acf841d3b716f2e46d5beda539f09918611debb6a41512f12`
- Resolved owner address for this account's delegate key (seen in job status responses): `0x518e45b0ef30dab59ac87cf76f39c5e788596522a004035224db5584d4ab6f15`
- Relayer: `https://relayer.memory.walrus.xyz` (production MemWal relayer; `health()` returned `{"status":"ok","mode":"production","write_ready":true,"writes":"ok"}` on 2026-10-07)

## What gets written, and when
Code: `packages/core/memory/walrus-memory.mjs`, called from `apps/web/api/telegram.mjs` and
`apps/web/api/discord.mjs` via `packages/core/channels/{telegram,discord}-webhook.mjs`.
- Every free-text chat turn with a linked user → one `remember()` write (`[telegram] <text>` or
  `[discord] <text>`) into namespace `vow:mem:<userId>`.
- Every reminder check-in (Taken/Skipped/Snooze button) → one `remember()` write
  (`[check-in, <channel>] "<title>" (<role>) -> <status>`) into the same namespace.
- One namespace per app user, shared across every channel they've linked (Telegram, Discord, later Slack) —
  by design, the same person is one memory regardless of which door they write from.

## Verified sandbox test (pre-production smoke test, before any real user traffic)
Ran directly against the live mainnet relayer with the production credentials, in a disposable test
namespace (`vow:test:sandbox-verify`), to confirm the account can actually write and read before wiring it
into the live bot:

| job_id | status | blob_id | walruscan |
|---|---|---|---|
| `1b106669-e5d8-4c04-8e41-967dc8f95568` | done | `ZLTGkWnqyOh8fK2uCAP1lReHwNTWES-4IEo8ao__kDU` | https://walruscan.com/mainnet/blob/ZLTGkWnqyOh8fK2uCAP1lReHwNTWES-4IEo8ao__kDU |
| (earlier attempt, client timed out at 20s but the relayer finished the job server-side anyway) | done | `4s57p6BLsIgP7G1SS6IZqbWKBeCmJr0mLRAch5YBNb0` | https://walruscan.com/mainnet/blob/4s57p6BLsIgP7G1SS6IZqbWKBeCmJr0mLRAch5YBNb0 |

Both were found again via `recall({query: "vow-sandbox-verify", namespace: "vow:test:sandbox-verify"})`,
confirming round-trip write + read against mainnet.

## Real production blob count
The rule requires **at least 10 blobs on Mainnet at time of submission** (not 10 per user — see
`docs/audit/OFFICIAL_RULES.md`). The 2 sandbox-verification blobs above do not count toward that — they
predate the live wiring and used a disposable test namespace, not a real user's.

### First confirmed real production write (2026-10-07)
Sent a real message through the live `https://vow-livid.vercel.app/api/telegram` webhook for a disposable
test account (created via a direct DB insert to simulate a linked Telegram chat, same code path a real
`/link` would produce) and confirmed the resulting blob via `recall()` against the real mainnet account:

| channel | namespace | blob_id | walruscan |
|---|---|---|---|
| telegram (prod webhook) | `vow:mem:47b8a831-da8b-433a-af06-bf542c2acf75` | `-vw-SOe15vCCQgjVtP230cxEY4WvgOhHsmkBKtTONdI` | https://walruscan.com/mainnet/blob/-vw-SOe15vCCQgjVtP230cxEY4WvgOhHsmkBKtTONdI |

This confirms the full path works end-to-end in production: Telegram webhook -> `chatReply()` -> MemWal
`remember()` -> real Mainnet blob -> `recall()` finds it again. Two earlier attempts at this same test failed
for infrastructure reasons unrelated to MemWal itself, both now fixed and documented as learnings:
1. `@mysten-incubation/memwal` was only listed in the **monorepo root** `package.json` (under
   `optionalDependencies`), but Vercel's install (`npm ci`) runs against `apps/web`'s own
   `package.json`/lockfile — the root one is never installed by the deployed build. Fixed by adding it as a
   real dependency of `apps/web/package.json`.
2. Even after that, the shared module `packages/core/memory/walrus-memory.mjs` still silently got no SDK:
   it lives outside `apps/web` (the Vercel project/root directory), and Node's module resolution only walks
   **up** from the importing file's own directory to find `node_modules` — it never looks sideways into a
   sibling directory's `node_modules`. So a package installed under `apps/web/node_modules` is invisible to
   a bare `import` from `packages/core/...`. Fixed by constructing the MemWal SDK client inside
   `apps/web/lib/walrus-memory-client.mjs` (which *is* under the project root) and injecting it into the
   shared module, matching this codebase's existing dependency-injection pattern (store/tg/llm are all
   passed in, not imported deep in shared code).

**TODO before submission:** once more real users chat with the live Telegram/Discord bots (or a scripted
test pass simulating one — see `docs/audit/OFFICIAL_RULES.md` for the >=10 minimum and the owner's own
stretch target of 100+ from 3+ users), query the account for its real namespaces/blob count and paste the
real numbers here. Do not submit with only the evidence above — it proves the pipe works end-to-end, not
that real usage happened yet.


## DEMO run, 2026-10-09 (11 blobs, account above, real Telegram chats)
All jobs reported `done` by the relayer (`getRememberStatus`).

| # | job_id | blob_id | walruscan | what |
|---|---|---|---|---|
| 1 | `e4a7a118-01e5-4530-a28f-525120bd60d8` | `Gyhuhqv0oXhE4nD5xXxIY0mP9Pe5DRPGSVwFXJ3j8aU` | https://walruscan.com/mainnet/blob/Gyhuhqv0oXhE4nD5xXxIY0mP9Pe5DRPGSVwFXJ3j8aU | chat: magnesium |
| 2 | `4c068468-3bf0-42fa-9643-2d8fdeffc4ca` | `yj-kBg5CpdbIjvqjiYqS2aJcCwfoN0qSQBigwuM7xPg` | https://walruscan.com/mainnet/blob/yj-kBg5CpdbIjvqjiYqS2aJcCwfoN0qSQBigwuM7xPg | schedule: vitamin D |
| 3 | `323cb01f-6044-4a45-a034-61219c85c349` | `auAbtpiRgSsbFnk-vdO3hvlBYFzy65JnvLTcW_WQ2F0` | https://walruscan.com/mainnet/blob/auAbtpiRgSsbFnk-vdO3hvlBYFzy65JnvLTcW_WQ2F0 | chat: knee/stretching |
| 4 | `0cbe56a8-b0bc-4aea-812f-21c94751e2c8` | `DRv--0SaSJpR0Y5_P_I1jMj1UtDyBbnKvUfR2yNtWq0` | https://walruscan.com/mainnet/blob/DRv--0SaSJpR0Y5_P_I1jMj1UtDyBbnKvUfR2yNtWq0 | chat: Rust study |
| 5 | `b6560614-ff61-4f95-b5ab-19236f836118` | `iDTCNjmQjPyJ4IpRbXnE-h4K7DLILbO6dWeF2OBWk1s` | https://walruscan.com/mainnet/blob/iDTCNjmQjPyJ4IpRbXnE-h4K7DLILbO6dWeF2OBWk1s | chat: recall magnesium |
| 6 | `34437b89-5d15-43e6-8ab1-cc667c5f4e3f` | `rO5w22PwNA9yWGJtZSqad6U7PPPx2G7AZ8kUS5Rjtoo` | https://walruscan.com/mainnet/blob/rO5w22PwNA9yWGJtZSqad6U7PPPx2G7AZ8kUS5Rjtoo | chat: water goal |
| 7 | `8a1f33b1-258d-4fd3-a05e-2f8ca2707f45` | `MtqrgKm90VuJuCjxPmnP27z3rWB3Avahcg5nzknGxXk` | https://walruscan.com/mainnet/blob/MtqrgKm90VuJuCjxPmnP27z3rWB3Avahcg5nzknGxXk | schedule: dentist |
| 8 | `63bae2db-c866-4972-960a-acada38af60f` | `1Ar4WytL-Tj96Kt3tMwl0W6Psm9dFDfErm8BgZElC18` | https://walruscan.com/mainnet/blob/1Ar4WytL-Tj96Kt3tMwl0W6Psm9dFDfErm8BgZElC18 | chat: preferences |
| 9 | `6b8be30b-6787-4006-841e-415d028dbc77` | `ftrB1KA-7CNawvs7nnRJ8VJRCpubKaNl6CBdO5kzX0c` | https://walruscan.com/mainnet/blob/ftrB1KA-7CNawvs7nnRJ8VJRCpubKaNl6CBdO5kzX0c | chat: sleep goal |
| 10 | `10528319-944e-4c3e-bd77-4c10f2abaf72` | `jkI6Dv_O9MyunmMKoGaPTXYdcno99RvicDCMezom-OY` | https://walruscan.com/mainnet/blob/jkI6Dv_O9MyunmMKoGaPTXYdcno99RvicDCMezom-OY | chat: Mediterranean diet |
| 11 | `26f0c817-39a9-49e2-b619-561f85e744e2` | `yH-lB3UeXOkUGGrnM4sqTebWF1DQYVT4qtHr-RXdnnU` | https://walruscan.com/mainnet/blob/yH-lB3UeXOkUGGrnM4sqTebWF1DQYVT4qtHr-RXdnnU | chat: summary |
