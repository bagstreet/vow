-- 001_init: core schema (users, channel links, reminders, outbox/escalation, role settings, idempotency)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  tz text not null default 'UTC',
  tone text not null default 'friendly',
  role_label text not null default 'on_change' check (role_label in ('always','on_change','off')),
  default_role text,
  quiet_start time, quiet_end time,
  created_at timestamptz not null default now()
);
create table if not exists user_roles (
  user_id uuid references users(id) on delete cascade,
  role text not null check (role in ('fitness','medication','nutrition','health','study')),
  enabled boolean not null default true,
  primary key (user_id, role)
);
create table if not exists channel_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  channel text not null check (channel in ('telegram','slack','discord','web','push')),
  external_id text not null,
  enabled boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (channel, external_id)
);
create table if not exists link_codes (
  code text primary key,
  user_id uuid not null references users(id) on delete cascade,
  channel text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role text not null,
  title text not null,
  time_local time not null,
  days smallint[] not null default '{1,2,3,4,5,6,7}',
  enabled boolean not null default true,
  next_fire_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reminders_due on reminders (next_fire_at) where enabled;
create table if not exists outbox (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid references reminders(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  channel_link_id uuid references channel_links(id),
  step smallint not null default 0,
  status text not null default 'pending' check (status in ('pending','sent','acked','escalated','failed','expired')),
  buttons text[] ,
  send_at timestamptz not null default now(),
  escalate_at timestamptz,
  attempts smallint not null default 0,
  last_error text
);
create index if not exists outbox_due on outbox (send_at) where status = 'pending';
create table if not exists idempotency (
  key text primary key,
  created_at timestamptz not null default now()
);
create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now());
