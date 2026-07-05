-- 0004_name_zh_backfill.sql
-- One-time data backfill: populate name_zh for the seeded budget categories and
-- monthly commitments. Run manually in the Supabase SQL editor (see SETUP.md).
-- No DDL. Idempotent: re-running only overwrites name_zh with the same values.
-- Scoped to the seed household. If your household id differs, adjust the WHERE.

begin;

-- Budget categories (7)
update budget_categories set name_zh = '房贷 + 水电' where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'House';
update budget_categories set name_zh = '伙食'         where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Food';
update budget_categories set name_zh = '应急基金'      where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Emergency fund';
update budget_categories set name_zh = 'Leo 保险'      where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Leo insurance';
update budget_categories set name_zh = 'Leo 伙食 + 尿布' where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Leo Food + diapers';
update budget_categories set name_zh = 'Leo 衣物'      where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Leo Clothes';
update budget_categories set name_zh = 'Leo 医疗备用金' where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Leo fund in case sick';

-- Monthly commitments (8)
update monthly_commitments set name_zh = '房贷分期'    where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'House installment';
update monthly_commitments set name_zh = '房屋维护费'  where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'House maintenance';
update monthly_commitments set name_zh = 'LG 净水器'   where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'LG water purifier';
update monthly_commitments set name_zh = 'LG 空气净化器' where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'LG air purifier';
update monthly_commitments set name_zh = '户外滤水器'  where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Outdoor water filter';
update monthly_commitments set name_zh = 'Time 光纤网络' where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Time Fibre Internet';
update monthly_commitments set name_zh = '电费'        where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Electric Bill';
update monthly_commitments set name_zh = '水费'        where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Water Bill';

commit;
