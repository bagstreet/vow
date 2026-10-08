-- Email can be attached to an existing account: a magic token issued to a signed-in user carries user_id.
alter table magic_tokens add column if not exists user_id uuid references users(id) on delete cascade;
