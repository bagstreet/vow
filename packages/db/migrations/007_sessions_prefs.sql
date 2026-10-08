-- 007: server-side sessions, email magic links, server-side prefs, per-reminder channel override, memory log
create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz
);
create index if not exists sessions_user on sessions (user_id);
create table if not exists magic_tokens (
  token_hash text primary key,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table users add column if not exists email text;
create unique index if not exists users_email_uq on users (lower(email)) where email is not null;
alter table users add column if not exists ack_min smallint not null default 10;
alter table reminders add column if not exists channel_pref text;
create table if not exists memory_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  channel text not null,
  kind text not null default 'chat',
  preview text not null,
  job_id text,
  blob_id text,
  created_at timestamptz not null default now()
);
create index if not exists memory_log_user on memory_log (user_id, created_at desc);
