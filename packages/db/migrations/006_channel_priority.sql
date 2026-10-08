-- 006: user-chosen channel priority for reminder delivery (first = preferred). Empty = pick by most recent activity.
alter table users add column if not exists channel_priority text[] not null default '{}';
