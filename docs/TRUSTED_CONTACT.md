# Trusted Contact ("Guardian")

**One line:** a user names another Vow user as a trusted contact; if the user goes silent under rules *the contact chooses*, Vow notifies the contact. Two accounts, one link, consent on both sides.

## Principles
1. **Mutual consent, nothing silent.** The watched person is told who watches them and under which rules, at invite time and on every rule change.
2. **The guardian owns the rules** (thresholds), the watched person owns the link (can revoke any time).
3. **Minimal disclosure.** The guardian is told *that* a check-in was missed ("Anna missed 2 check-ins in 24h, last reply 9 Oct 08:12"), never memory contents or chat text. Role names are shown only if the watched user ticks "share role names".
4. **Not an emergency service.** Wording in UI and docs: Vow is not a medical alert system. Crisis wording in chat keeps its own safe-response path; it does not auto-notify a guardian unless the user opted in to "share crisis flags" (default off).
5. **No spam.** One alert per breach, then a cool-down; escalates only if the guardian also does not acknowledge.

## Data model (migration 015)
- `guardian_links(id, watched_user_id, guardian_user_id, status[pending|active|revoked|declined], created_at, accepted_at, revoked_at, revoked_by[watched|guardian], share_roles bool default false)`
- `guardian_rules(link_id, kind[missed_checkins|silence_hours|unanswered_messages], threshold int, window_hours int, enabled bool)` — set by guardian.
- `guardian_alerts(id, link_id, rule_kind, fired_at, ack_at, ack_channel, cooldown_until)`
- `guardian_invites(code, watched_user_id, contact_hint, expires_at, used_at)` — 10 min, one use, same pattern as link codes.
- Limits: a user has at most 3 guardians; a guardian can watch at most 10 accounts. No self-link; no duplicate pair; no cycles needed (A↔B is allowed: both are watched and guardian).

## Flow
1. **Invite.** Watched user: Dashboard → Trusted contact → "Add" → gets a code and deep links (`t.me/<bot>?start=g_CODE`, Slack/Discord command `/guardian CODE`). The invite can also be sent as a link by the user themselves. Vow never contacts the invitee on its own initiative (no unsolicited messages to non-users).
2. **Accept.** Invitee (must already be a Vow user, or signs up via the same link) sends the code. Vow shows: *"Anna asks you to be her trusted contact. You will get alerts only when she misses check-ins. Accept / Decline."* Accept → link `active`; Anna gets "Boris accepted".
3. **Configure.** Guardian picks rules in dashboard or chat (`/guardian rules`): missed check-ins (N in a row), silence (N hours with no reply to Vow's messages), unanswered Vow messages (N). Defaults suggested: 2 missed in a row, 24 h silence. The watched user sees the rules read-only.
4. **Detect.** The existing 1-minute tick evaluates active links: counts `outbox` rows by status (`expired`/`escalated` without ack = missed), last inbound `chat_messages.created_at`, unanswered outbound count. Quiet hours of the *watched* user pause the silence clock.
5. **Alert.** Delivered with the same channel-choice logic as reminders (priority > presence > last seen), buttons **I'll check on her** / **Snooze 6h** / **Stop watching**. Acked in one channel → copies in other channels edited to "✓ handled" (reuses `handled.mjs`).
6. **Resolve.** When the watched user replies/acks, the guardian gets a short "Anna is back" (optional, default on).
7. **Leave.** Guardian: dashboard "Stop watching" or `/guardian leave` → status `revoked`, watched user is notified immediately ("Boris stopped being your trusted contact") and their dashboard card updates. Watched user can revoke too; guardian is notified. Account deletion of either side revokes all its links and notifies the other side.

## UX requirements
- Two dashboard cards: **"People who watch over me"** (status, rules read-only, revoke) and **"People I watch over"** (per-person rules editor, last-seen-as-of, leave). Empty states explain the feature in one sentence.
- Every state visible: pending (with code countdown), active, declined, revoked.
- Alert text is neutral and actionable, never alarming; no health details.

## Edge cases
Guardian deletes account (see Deletion semantics); both are the same person on two channels (reject: same user id); invite code leaked (guardian must be a different, logged-in user; code one-use, 10 min); guardian never answers (second alert after 2× window, then stop and show "unreachable" on the watched user's card); watched user changes timezone/quiet hours; rapid revoke/accept; duplicate alerts on tick retry (idempotency key = link+rule+window); guardian on a channel that is later unlinked (fall back to remaining channels, else mark link "guardian unreachable").

## Scope
Built: tables, invite/accept/revoke, rule `missed_checkins` + `silence_hours`, alert delivery with buttons, both dashboard cards, notifications on revoke, tests. Planned ([roadmap](ROADMAP.md)): `unanswered_messages`, crisis-flag opt-in, "Anna is back".

## Guardian must be a Vow user
A guardian is always a registered Vow user (accepts the invite from their own logged-in session). No anonymous guardians.

## Deletion semantics
- **Full deletion** = `DELETE /account` executed (users row gone; channels, tokens, links cascade). Unlinking or disabling every channel is NOT deletion: the link stays, the guardian card shows "unreachable for delivery" and the watched user gets a warning.
- **Guardian deleted**: in one transaction collect all watched users, drop all links, then notify each watched user: "Trusted contact <name> deleted their account; protection is off, choose a new one." Dashboard card updates.
- **Watched user deleted**: all links drop; each guardian is notified that they no longer watch that person.
- **Guardian only leaves** (revokes): same notification, account stays.
- Active alert during deletion is cancelled; simultaneous mutual deletion must leave no orphan links or crashes.
- Scenarios: N18 guardian deleted with N watched users, N19 watched user deleted, N20 deletion during active alert, N21 two simultaneous mutual deletions.
