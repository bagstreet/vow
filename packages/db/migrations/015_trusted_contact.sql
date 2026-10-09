-- 015_trusted_contact: guardian links between two Vow accounts, plus a small notice queue delivered by the tick.
create table if not exists guardian_links (
  id uuid primary key default gen_random_uuid(),
  watched_user_id uuid not null references users(id) on delete cascade,
  guardian_user_id uuid references users(id) on delete cascade,
  code text unique,
  code_expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending','active')),
  missed_checkins int not null default 2,
  silence_hours int not null default 24,
  last_alert_at timestamptz,
  created_at timestamptz not null default now(),
  check (guardian_user_id is null or guardian_user_id <> watched_user_id)
);
create unique index if not exists guardian_pair on guardian_links (watched_user_id, guardian_user_id) where guardian_user_id is not null;
create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists notices_unsent on notices (created_at) where sent_at is null;
