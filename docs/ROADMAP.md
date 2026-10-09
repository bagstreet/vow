# Product roadmap

Vow connects a commitment, a reminder and a recorded response across the places people already use. The next stage is to make that continuity easier to own, easier to reach and more useful to the people supporting each other.

This is a direction of travel, not a release-date commitment. Features below are planned unless listed under **Available today**.

## Available today

- Telegram, Slack, Discord and web chat share one account and Walrus-backed memory.
- A browser extension delivers reminders, opens Taken / Skip / Later controls in its popup, and supports mute and channel priority.
- One-time and recurring reminders support quiet hours, presence-aware delivery, escalation and recorded check-ins.
- Five optional roles cover fitness, medication reminders, nutrition, health support and study.
- Trusted contacts receive minimal-disclosure alerts under visible, revocable rules.
- The dashboard manages reminders, channels, memory history and receipts, exports, role-scoped agent tokens and account settings.
- REST Agent API, stdio MCP bridge and JavaScript SDK connect other tools to the same memory.
- Self-hosting instructions document deployment, configuration and service boundaries.

## Own your continuity

**Goal:** make a person's memory portable without making the application operator the permanent point of trust.

- Bring your own MemWal account and delegated access, with key rotation.
- Guided recovery and migration to a fresh deployment, including memory receipts and account mapping.
- Client-side encryption with Seal, so plaintext access can stay with the user.
- A hash-linked event history for inspecting corrections and the relationship between events.

## Reach Vow where you work

**Goal:** fewer context switches between making a commitment and answering a reminder.

- Chat and memory search in the browser extension, alongside its existing reminders.
- A desktop tray companion with chat, reminders and mute controls.
- Additional delivery adapters, including mobile push and email.
- More integration examples built on the Agent API, MCP bridge and SDK.

## Support people without watching everything

**Goal:** give trusted contacts clearer, quieter signals while preserving consent and minimal disclosure.

- A follow-up when the person responds again.
- Contact-specific quiet hours and richer threshold conditions.
- An optional escalation chain when the first contact cannot respond.

## Make self-hosting easier to operate

**Goal:** make a small deployment understandable without editing service configuration for every change.

- A provider-management panel for model selection and routing.
- Clearer operational diagnostics for delivery, memory writes and service availability.
- Administrative summaries with explicit access boundaries.

For current mechanics, see [MECHANICS.md](MECHANICS.md). For integration contracts, see [API.md](API.md). For deployment, see [SELF_HOST.md](SELF_HOST.md).
