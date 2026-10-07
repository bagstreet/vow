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
