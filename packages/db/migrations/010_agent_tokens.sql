-- 010: role-scoped agent tokens (external AI agents / MCP write only verified facts for the roles the user allowed)
create table if not exists agent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  label text not null,
  roles text[] not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists agent_tokens_user on agent_tokens(user_id);
