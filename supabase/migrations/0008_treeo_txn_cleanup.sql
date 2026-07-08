-- 0008_treeo_txn_cleanup.sql
-- Rename the recurring commitment inflow and strip emoji from property txns.

update asset_transactions
  set description = 'Installment + Maintenance'
  where txn_type = 'monthly_commitment'
    and description like 'Monthly Commitment%';

update asset_transactions
  set description = btrim(
    replace(replace(replace(description, '💵', ''), '⚡', ''), '💧', '')
  )
  where description ~ '[💵⚡💧]';
