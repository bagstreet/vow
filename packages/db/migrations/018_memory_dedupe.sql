-- Cross-instance write dedupe: one row per (user, normalized text hash); a write is allowed only when the row is new or older than the window.
create table if not exists memory_dedupe (
  user_id uuid not null,
  h text not null,
  at timestamptz not null default now(),
  primary key (user_id, h)
);
