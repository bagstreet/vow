-- Where a reminder was created: the dashboard or the chat (shown as a badge in the UI).
alter table reminders add column if not exists source text not null default 'dashboard';
