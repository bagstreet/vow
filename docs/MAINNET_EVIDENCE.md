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

**TODO before submission:** once real users chat with the live Telegram/Discord bots (or a scripted test
pass simulating one — see `docs/audit/OFFICIAL_RULES.md` for the >=10 minimum and the owner's own stretch
target of 100+ from 3+ users), query the account for its real namespaces/blob count and paste the real
numbers and blob ids here. Do not submit with only the sandbox-verification numbers above — they prove the
pipe works, not that it was used.
