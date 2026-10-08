-- 009: tombstone "forget" — Walrus blobs are immutable, so we hide a memory from recall instead of deleting it
alter table memory_log add column if not exists forgotten_at timestamptz;
