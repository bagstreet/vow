-- 008: remember where each reminder copy was sent so other channels can be edited to "✓ handled"
alter table outbox add column if not exists msg_ref text;
