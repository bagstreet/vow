-- 005_chat_history: short-term dialog memory for free-text chat (last N turns per user)
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  channel text not null,
  direction text not null check (direction in ('in','out')),
  role text,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_recent on chat_messages (user_id, created_at desc);
