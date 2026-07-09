-- Enforce a unique category name per household + asset type (case-insensitive),
-- mirroring expense_categories_name_ci (0005). IF NOT EXISTS so it can be applied
-- safely whether or not 0009 was already run.
create unique index if not exists asset_categories_name_ci
  on asset_categories (household_id, asset_type, lower(name));
