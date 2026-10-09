-- One-time reminders: when set, the reminder fires once on this local date at time_local, then turns itself off.
alter table reminders add column if not exists once_date date;
