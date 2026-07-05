-- === Expense catalog: user-managed Category / Vendor / Location ===
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index expense_categories_name_ci on expense_categories (household_id, lower(name));

create table vendors (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index vendors_name_ci on vendors (household_id, lower(name));

create table locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index locations_name_ci on locations (household_id, lower(name));

-- RLS: members get full CRUD, mirroring 0002_rls.sql
alter table expense_categories enable row level security;
alter table vendors            enable row level security;
alter table locations          enable row level security;
create policy ec_all  on expense_categories for all using (is_member(household_id)) with check (is_member(household_id));
create policy ven_all on vendors            for all using (is_member(household_id)) with check (is_member(household_id));
create policy loc_all on locations          for all using (is_member(household_id)) with check (is_member(household_id));

-- Link columns on expenses (nullable; unlink on delete)
alter table expenses
  add column category_id uuid references expense_categories(id) on delete set null,
  add column vendor_id   uuid references vendors(id)            on delete set null,
  add column location_id uuid references locations(id)          on delete set null;
create index expenses_household_category_idx on expenses (household_id, category_id);

-- Backfill vendors from distinct non-blank vendor text (skip '-')
insert into vendors (household_id, name)
  select distinct on (household_id, lower(trim(vendor))) household_id, trim(vendor)
  from expenses
  where vendor is not null and trim(vendor) <> '' and trim(vendor) <> '-'
  order by household_id, lower(trim(vendor));
update expenses e set vendor_id = v.id
  from vendors v
  where v.household_id = e.household_id and lower(v.name) = lower(trim(e.vendor));

-- Backfill locations (treat '-' as no location)
insert into locations (household_id, name)
  select distinct on (household_id, lower(trim(location))) household_id, trim(location)
  from expenses
  where location is not null and trim(location) <> '' and trim(location) <> '-'
  order by household_id, lower(trim(location));
update expenses e set location_id = l.id
  from locations l
  where l.household_id = e.household_id and lower(l.name) = lower(trim(e.location));

-- Category intentionally NOT seeded (Excel has none).

-- Drop replaced columns (Excel is the backup; keep `details` = the note)
alter table expenses drop column vendor, drop column location, drop column category;
