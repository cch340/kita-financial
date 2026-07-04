-- === Sharing / identity ===
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency text not null default 'MYR',
  created_at timestamptz not null default now()
);
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  language text not null default 'en' check (language in ('en','zh')),
  avatar_color text
);
create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  member_code text not null check (member_code in ('CH','JC')),
  primary key (household_id, user_id)
);

-- === Joint Fund ===
create table joint_fund_config (
  household_id uuid not null references households(id) on delete cascade,
  member_code text not null check (member_code in ('CH','JC')),
  expected_monthly_cents bigint not null,
  carry_forward_prev_year_cents bigint not null default 0,
  primary key (household_id, member_code)
);
create table joint_fund_contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_code text not null check (member_code in ('CH','JC')),
  period date not null,                         -- first of month
  amount_cents bigint not null,
  status text not null default 'pending' check (status in ('paid','pending')),
  notes text
);

-- === Budget ===
create table budget_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name_en text not null,
  name_zh text,
  jc_cents bigint not null default 0,
  ch_cents bigint not null default 0,
  total_cents bigint not null default 0,
  remark text,
  sort_order int not null default 0
);
create table monthly_commitments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name_en text not null,
  name_zh text,
  amount_cents bigint not null,
  remark text
);

-- === Expenses ===
create table expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  date date not null,
  vendor text,
  location text,
  details text,
  category text,
  amount_cents bigint not null,
  paid_by text check (paid_by in ('CH','JC')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- === Personal ledgers ===
create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_member_code text not null check (owner_member_code in ('CH','JC')),
  period date not null,
  entry_type text not null check (entry_type in ('income','expense')),
  description text not null,
  amount_cents bigint not null,
  remark text
);

-- === Assets (generic) ===
create table assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  type text not null check (type in ('property','vehicle','investment','other')),
  name text not null,
  owner_member_code text check (owner_member_code in ('CH','JC')),
  status text not null default 'active' check (status in ('active','closed')),
  opening_balance_cents bigint,
  metadata jsonb not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table asset_transactions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  date date not null,
  description text,
  amount_cents bigint not null,
  direction text not null check (direction in ('in','out')),
  txn_type text,
  settled boolean not null default false,
  seq int,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- === Notifications ===
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create table reminder_settings (
  user_id uuid not null references profiles(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('monthly_commitment','yearly_big_payment')),
  enabled boolean not null default true,
  primary key (user_id, reminder_type)
);

create index on joint_fund_contributions (household_id, period);
create index on expenses (household_id, date);
create index on ledger_entries (household_id, owner_member_code, period);
create index on asset_transactions (asset_id, date);
