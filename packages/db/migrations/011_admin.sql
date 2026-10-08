-- Admin: block flag, runtime settings, digest buffer for memory writes.
alter table users add column if not exists blocked_at timestamptz;
create table if not exists app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
create table if not exists memory_buffer (id bigserial primary key, user_id uuid not null references users(id) on delete cascade, text text not null, created_at timestamptz not null default now());
create index if not exists memory_buffer_user on memory_buffer(user_id, created_at);
