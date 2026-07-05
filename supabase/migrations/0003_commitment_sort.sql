-- Phase 7: allow reordering monthly commitments.
alter table monthly_commitments add column if not exists sort_order int not null default 0;
