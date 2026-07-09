-- === Asset transaction categories (user-managed, scoped per household + asset type) ===
create table asset_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  asset_type text not null check (asset_type in ('property','vehicle','investment','other')),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on asset_categories (household_id, asset_type, sort_order);

-- Link transactions to a category. ON DELETE SET NULL => deleting a category
-- moves its transactions to the "Other" (uncategorised) group.
alter table asset_transactions
  add column category_id uuid references asset_categories(id) on delete set null;
create index on asset_transactions (category_id);

-- RLS: household-scoped, same pattern as every other table.
alter table asset_categories enable row level security;
create policy ac_all on asset_categories
  for all using (is_member(household_id)) with check (is_member(household_id));

-- Backfill: one category per distinct (household, asset_type, txn_type); map transactions to it.
insert into asset_categories (household_id, asset_type, name, sort_order)
select distinct a.household_id, a.type,
       initcap(replace(t.txn_type, '_', ' ')) as name,
       0
from asset_transactions t
join assets a on a.id = t.asset_id
where t.txn_type is not null and t.txn_type <> '';

update asset_transactions t
set category_id = c.id
from assets a, asset_categories c
where t.asset_id = a.id
  and c.household_id = a.household_id
  and c.asset_type = a.type
  and c.name = initcap(replace(t.txn_type, '_', ' '))
  and t.txn_type is not null and t.txn_type <> '';
