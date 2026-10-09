# packages/db
SQL migrations for Neon Postgres (free tier). `node packages/db/apply.mjs` applies pending files in `migrations/` over Neon's HTTP SQL endpoint (needs `DATABASE_URL` or `DATABASE_URL_DIRECT`).
Tables: users, user_roles, channel_links, link_codes, reminders, outbox, idempotency. Backup plan: scheduled `pg_dump` + storage interface to swap to Turso.
