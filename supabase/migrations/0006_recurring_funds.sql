-- Recurring funds: per-member contribution templates that suggest the amount
-- when adding a joint-fund contribution record. One row per member.
create table recurring_funds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_code text not null check (member_code in ('CH','JC')),
  name text not null,
  amount_cents bigint not null default 0,
  remark text,
  sort_order int not null default 0
);

alter table recurring_funds enable row level security;

create policy rf_all on recurring_funds
  for all using (is_member(household_id)) with check (is_member(household_id));
