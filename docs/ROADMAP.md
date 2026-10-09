# Roadmap

What Vow does today, and where it goes next.

## Shipped

- **Roles**: fitness, medication, nutrition, health and study, with a keyword router and a model classifier for ambiguous messages.
- **Channels**: Telegram, Slack and Discord, linked to one account with `/link` codes. Channel priority, quiet hours and presence-aware delivery.
- **Reminders**: one-time and recurring, button check-ins, snooze, escalation to the next channel. A tick endpoint is driven by cron-job.org with a GitHub Actions backup.
- **Memory**: one MemWal memory per user, recorded with job and blob ids, Forget through tombstones, instant or digest write mode, "Remember now".
- **Trusted Contact**: a second Vow user is told when check-ins are missed, under rules the contact chooses; consent on both sides, minimal disclosure ([design](TRUSTED_CONTACT.md)).
- **Dashboard**: settings, channels, history with blob links, export, AI chat, voice input, trusted contact, admin tools.
- **Sign-in**: Telegram, Discord, Slack OAuth and email magic link; account merge by one-time code.
- **Agent API and MCP bridge** with role-scoped tokens.
- **Self-hosting**: Vercel, Neon and free-tier cron, or Docker ([self-hosting guide](SELF_HOST.md)).

## Next

| Item | Idea |
|---|---|
| Bring your own MemWal account | The user supplies an account id and delegate key, stored encrypted with a server master key and never returned by any API. Rotation registers a new delegate key on chain. |
| Seal encryption | Client-side keys, so not even the operator can read memories. |
| Browser extension | Reminders and chat from the toolbar, with mute for a while or for good. |
| Desktop helper | Tray app: reminders, chat, mute controls, talking to the same API. |
| Trusted Contact, phase 2 | Richer conditions, quiet hours for guardians, an escalation chain. |
| Admin provider panel | API keys, model choice and routing managed in the UI instead of environment variables. |
| Chat admin role | Analyse users and logs by chat, admin only. |
| Push adapters | Mobile push and e-mail as further delivery channels. |
| Slack delayed events | Retry handling and an idempotency review. |
