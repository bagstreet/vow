-- 002: one-time web login tokens issued by the bot (/login) + occurrence replies
create table if not exists login_tokens (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table outbox add column if not exists reply text;
alter table outbox add column if not exists acked_at timestamptz;
