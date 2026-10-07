alter table users add column if not exists role_label text not null default 'always';
alter table users add column if not exists last_role text;
