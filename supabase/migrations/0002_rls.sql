-- membership helper
create or replace function public.is_member(hh uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members m
    where m.household_id = hh and m.user_id = auth.uid()
  );
$$;

-- enable RLS
alter table households              enable row level security;
alter table profiles                enable row level security;
alter table household_members       enable row level security;
alter table joint_fund_config       enable row level security;
alter table joint_fund_contributions enable row level security;
alter table budget_categories       enable row level security;
alter table monthly_commitments     enable row level security;
alter table expenses                enable row level security;
alter table ledger_entries          enable row level security;
alter table assets                  enable row level security;
alter table asset_transactions      enable row level security;
alter table push_subscriptions      enable row level security;
alter table reminder_settings       enable row level security;

-- households: members can read; owner-only handled at app layer
create policy hh_read on households for select using (is_member(id));

-- household_members: a user sees rows of households they belong to
create policy hm_read on household_members for select using (is_member(household_id));

-- profiles: a user reads/updates own row, and reads co-members' profiles
create policy prof_self on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy prof_comembers on profiles for select using (
  exists (select 1 from household_members a
          join household_members b on a.household_id = b.household_id
          where a.user_id = auth.uid() and b.user_id = profiles.id)
);

-- generic household-scoped tables: full CRUD for members
create policy jfc_all  on joint_fund_config        for all using (is_member(household_id)) with check (is_member(household_id));
create policy jfcn_all on joint_fund_contributions for all using (is_member(household_id)) with check (is_member(household_id));
create policy bc_all   on budget_categories        for all using (is_member(household_id)) with check (is_member(household_id));
create policy mc_all   on monthly_commitments      for all using (is_member(household_id)) with check (is_member(household_id));
create policy exp_all  on expenses                 for all using (is_member(household_id)) with check (is_member(household_id));
create policy led_all  on ledger_entries           for all using (is_member(household_id)) with check (is_member(household_id));
create policy ast_all  on assets                   for all using (is_member(household_id)) with check (is_member(household_id));
create policy atx_all  on asset_transactions       for all using (is_member(household_id)) with check (is_member(household_id));

-- per-user notification tables
create policy push_self  on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rem_self   on reminder_settings  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- index for RLS lookup performance
create index if not exists household_members_user_id_idx on household_members (user_id);
