-- 003: occurrence grouping for escalation + snooze bookkeeping
alter table outbox add column if not exists occurrence_id uuid;
update outbox set occurrence_id = id where occurrence_id is null;
alter table outbox add column if not exists snoozed_at timestamptz;
alter table outbox add column if not exists channel text;
create index if not exists outbox_occ on outbox (occurrence_id);
create index if not exists outbox_escalate on outbox (escalate_at) where status = 'sent';
