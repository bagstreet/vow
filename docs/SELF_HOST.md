# Run your own Vow bot

Everything runs on free tiers: Vercel (functions), Neon (Postgres), cron-job.org (per-minute tick), a Telegram bot.

1. **Fork or import the repo** into your GitHub account, then import it in Vercel (root: `apps/web`).
2. **Create a Neon project**, copy the pooled connection string. Apply `packages/db/migrations/*.sql` in order.
3. **Create a Telegram bot** with @BotFather. Copy the token. Set name, description and avatar there.
4. **Set Vercel environment variables** (Settings > Environment Variables):
   - `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `WEB_BASE_URL` (your Vercel URL)
   - `TELEGRAM_WEBHOOK_SECRET`, `TICK_SECRET` (any long random strings)
   - at least one LLM key: `GROQ_API_KEY` or `CEREBRAS_API_KEY` (more: `OPENROUTER_API_KEY`, ...). Routing: `LLM_PRIMARY`, `LLM_ROUTE_CHAT=a,b,c`.
5. **Deploy**, then register the webhook:
   `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WEB_BASE_URL>/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>"`
6. **Reminders tick**: on cron-job.org create a job every minute: POST `<WEB_BASE_URL>/api/tick` with header `x-tick-secret: <TICK_SECRET>`. (`.github/workflows/tick.yml` is a 5-minute fallback.)
7. **Link your chat**: get a code in the dashboard, send `/link CODE` to your bot.
8. **Optional backup**: add `DATABASE_URL_DIRECT` as a GitHub Actions secret; `backup.yml` dumps the DB weekly.

Never commit tokens. Check: `curl <WEB_BASE_URL>/api/health`.
