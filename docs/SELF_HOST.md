# Run your own Vow bot

Everything runs on free tiers: Vercel (functions), Neon (Postgres), cron-job.org (per-minute tick), a Telegram bot.

1. **Fork or import the repo** into your GitHub account, then import it in Vercel (root: `apps/web`).
2. **Create a Neon project**, copy the pooled connection string. Apply migrations in order: `DATABASE_URL=<pooled-uri> node packages/db/apply.mjs` (idempotent — tracks what ran in `schema_migrations`, safe to re-run).
3. **Create a Telegram bot** with @BotFather. Copy the token. Set name, description and avatar there.
4. **Set Vercel environment variables** (Settings > Environment Variables):
   - `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `WEB_BASE_URL` (your Vercel URL)
   - `TELEGRAM_WEBHOOK_SECRET`, `TICK_SECRET` (any long random strings)
   - at least one LLM key: `GROQ_API_KEY` or `CEREBRAS_API_KEY` (more: `OPENROUTER_API_KEY`, ...). Routing: `LLM_PRIMARY`, `LLM_ROUTE_CHAT=a,b,c`.
   - optional, only if you also want Slack/Discord: `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET` (Slack app, Event Subscriptions + Interactivity both pointed at `<WEB_BASE_URL>/api/slack`), `DISCORD_PUBLIC_KEY` (+ `DISCORD_BOT_TOKEN` if you also want to manage the app via the Discord REST API) with the Interactions Endpoint URL set to `<WEB_BASE_URL>/api/discord`. Each channel works independently — skip the ones you don't need.
5. **Deploy**, then register the webhook:
   `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WEB_BASE_URL>/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>"`
6. **Reminders tick**: on cron-job.org create a job every minute: POST `<WEB_BASE_URL>/api/tick` with header `x-tick-secret: <TICK_SECRET>`. (`.github/workflows/tick.yml` is a 5-minute fallback.) Note: the tick only delivers to Telegram today — Slack/Discord receive commands but not yet proactive reminders.
7. **Link your chat**: sign in on the dashboard (creates a real account via `/api/account`), press "Get link code" on the Channels page, then either tap "Open bot" (deep link) or send `/link CODE` to your bot yourself. The dashboard polls and flips to "Connected" automatically once the bot confirms it.
8. **Optional backup**: add `DATABASE_URL_DIRECT` as a GitHub Actions secret; `backup.yml` dumps the DB weekly.

Never commit tokens. Check: `curl <WEB_BASE_URL>/api/health`.

## Creating and connecting each bot (and why they behave differently)

Vow talks to three chat platforms with three different interaction models. `/link CODE` and `/login` exist
on all three, but **how you reach the bot to type them** is platform-specific — this is a Discord/Slack
API constraint, not something Vow's code can paper over.

### Telegram — DM-first (the simplest one)
1. Talk to **@BotFather**, `/newbot`, copy the token into `TELEGRAM_BOT_TOKEN`. Set avatar/description with
   `/setuserpic` / `/setdescription` there too (no REST API for those two).
2. Register the webhook (step 5 above). The user presses **Start** in the bot's DM — Telegram bots can message
   first after that, so the dashboard's "Open bot" deep link (`t.me/<bot>?start=CODE`) lands the user straight
   in the DM with the code already typed.

### Slack — also DM-first, but needs an Events subscription
1. Create the Slack app (**"From a manifest"** is fastest; or **"Blank app"**, never the AI-agent/Starter
   templates — those add extra scaffolding you don't want).
2. Scopes (OAuth & Permissions > Bot Token Scopes): `chat:write`, `im:read`, `im:history`. Install the app to
   the workspace — **this is the step that mints `SLACK_BOT_TOKEN`** (`xoxb-...`); the Basic Information page's
   "Signing Secret" is `SLACK_SIGNING_SECRET` (different token, needed even before install, for request
   verification). The App Configuration Token (`xoxe.xoxp-...`) shown under "App-Level Tokens"/API tooling is
   neither of these — it's a short-lived, single-use credential for the `apps.manifest.*` config API, not for
   running the bot.
3. Event Subscriptions: Request URL `<WEB_BASE_URL>/api/slack`, subscribe to bot event `message.im`.
   Interactivity: same URL. **Both verification checks need `SLACK_SIGNING_SECRET` already set in Vercel and a
   deploy that has picked it up** — if you save the URL before that, Slack's challenge check fails with "Your
   URL didn't respond with the value of the challenge parameter," which just means the secret isn't live yet,
   not a code bug. Set the env var, redeploy, then save the URL again.
4. Avatar/description/tags: Basic Information > Display Information, in the Slack UI — the manifest API can
   update text fields but not the icon image, so this one is a manual step.
5. Using it: open a **DM with the app** in Slack (not a channel) and send `/link CODE` as a normal message —
   this isn't a registered Slack slash command, it's Vow parsing the leading `/` out of your DM text.

### Discord — slash-commands only, no DM-first, replies are private
Discord interactions here are pure HTTP request/response (`discord-webhook.mjs`) — there is no running
process holding a Gateway connection, so **the bot can never message you first**. Everything is a slash
command *you* invoke; Vow answers inline. All replies are ephemeral (`flags: 64` — visible only to you),
since `/link`/`/login` replies carry codes and one-time tokens.
1. Create the application at discord.com/developers/applications, grab the Public Key (`DISCORD_PUBLIC_KEY`)
   and a bot token (`DISCORD_BOT_TOKEN`, Bot tab > Reset Token).
2. Everything else — interactions endpoint URL, description, tags, icon, slash command registration — can be
   done over the REST API with the bot token once it's in Vercel env (see git history of this file / internal
   TASKS.md for the exact calls used). No portal UI steps are required beyond creating the app and the token.
3. Install scopes: `applications.commands` only, no `bot` scope, with **both** Guild Install and User Install
   enabled (`integration_types_config` 0 and 1). This intentionally keeps the footprint minimal — Vow never
   needs a message-reading bot member.
4. **How to actually use it** (this is the part that trips people up): adding the app to a server only lets you
   run its commands inside that server's channels (everyone there sees you ran it, replies are still private to
   you). To run commands anywhere — including a DM with yourself/a friend, with no server involved — install it
   via the **User Install** link instead: `https://discord.com/oauth2/authorize?client_id=<APP_ID>&integration_type=1&scope=applications.commands`.
   After that, type `/` in any channel or DM you're in and Vow's commands appear under "Apps", even though there
   is no traditional "message this bot directly" entry in your DM list — that UI doesn't exist for
   commands-only apps, by Discord's design.
