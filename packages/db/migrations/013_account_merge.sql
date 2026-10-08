-- Account merge: the memory namespace of a merged-away account stays readable (Walrus blobs are immutable).
create table if not exists user_aliases (
  alias_id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  merged_at timestamptz not null default now()
);
create index if not exists user_aliases_user on user_aliases (user_id);
