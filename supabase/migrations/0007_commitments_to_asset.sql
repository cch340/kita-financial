-- 0007_commitments_to_asset.sql
-- Move monthly commitments onto the property they belong to, consolidate the
-- bilingual name into a single free-text name, and retire budget categories.

-- 1. Attach each commitment to an asset (household_id kept for RLS/home query).
alter table monthly_commitments
  add column asset_id uuid references assets(id) on delete cascade;

update monthly_commitments mc set asset_id = (
  select a.id from assets a
  where a.household_id = mc.household_id and a.type = 'property'
  order by a.sort_order limit 1
) where asset_id is null;

alter table monthly_commitments alter column asset_id set not null;

-- 2. Consolidate name_en/name_zh -> single free-text name.
alter table monthly_commitments add column name text;
update monthly_commitments
  set name = coalesce(nullif(btrim(name_en), ''), name_zh, '');
alter table monthly_commitments alter column name set not null;
alter table monthly_commitments drop column name_en, drop column name_zh;

-- 3. Retire budget categories (superseded by recurring funds). Drops its RLS policy too.
drop table if exists budget_categories cascade;
