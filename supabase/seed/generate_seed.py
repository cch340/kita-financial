#!/usr/bin/env python3
"""Generate seed.sql from the household spreadsheet.

Reads tmp/Financial Report 2026.xlsx and emits INSERT statements for the Kita
schema. Money is stored as integer cents. Auth user references are left as
:CH_UID / :JC_UID placeholders, substituted at apply time once the Supabase
auth users exist.
"""
import openpyxl, datetime

HH = '00000000-0000-0000-0000-0000000000aa'  # fixed household id
wb = openpyxl.load_workbook('tmp/Financial Report 2026.xlsx', data_only=True)
out = []


def c(v):  # to cents; non-numeric -> 0
    if v is None:
        return 0
    try:
        return round(float(v) * 100)
    except (TypeError, ValueError):
        return 0


def s(v):  # sql string literal or NULL
    return 'NULL' if v is None else "'" + str(v).replace("'", "''") + "'"


def d(v):  # date literal or NULL
    if isinstance(v, (datetime.datetime, datetime.date)):
        return "'" + v.strftime('%Y-%m-%d') + "'"
    return 'NULL'


out.append(f"insert into households(id,name) values ('{HH}','Chong Family');")
out.append(f"insert into household_members(household_id,user_id,role,member_code) values"
           f" ('{HH}',:CH_UID,'owner','CH'),('{HH}',:JC_UID,'member','JC');")

# Joint Fund config: CH expected 2270/mo, JC 2470/mo; JC carry-forward 1338.53
out.append(f"insert into joint_fund_config(household_id,member_code,expected_monthly_cents,carry_forward_prev_year_cents) values"
           f" ('{HH}','CH',227000,0),('{HH}','JC',247000,133853);")

# Joint Fund contributions — two column groups in 'Joint Fund' sheet
jf = wb['Joint Fund']
for col_date, col_amt, col_status, member in [(1, 2, 3, 'CH'), (7, 8, 9, 'JC')]:
    for r in range(3, 15):
        dt = jf.cell(r, col_date).value
        amt = jf.cell(r, col_amt).value
        st = jf.cell(r, col_status).value
        if dt is None or amt is None:
            continue
        status = 'paid' if st is True else 'pending'
        out.append(f"insert into joint_fund_contributions(household_id,member_code,period,amount_cents,status) "
                   f"values ('{HH}','{member}',{d(dt)},{c(amt)},'{status}');")

# Budget categories — 'Money breakdown' rows 2..8 (Category, JC, CH, Total, Remark)
mb = wb['Money breakdown']
order = 0
for r in range(2, 9):
    name = mb.cell(r, 1).value
    if not name:
        continue
    order += 1
    out.append(f"insert into budget_categories(household_id,name_en,jc_cents,ch_cents,total_cents,remark,sort_order) "
               f"values ('{HH}',{s(name)},{c(mb.cell(r, 2).value)},{c(mb.cell(r, 3).value)},"
               f"{c(mb.cell(r, 4).value)},{s(mb.cell(r, 5).value)},{order});")

# Monthly commitments — 'Money breakdown' second table rows 2..9 (cols 7,8,9)
for r in range(2, 10):
    name = mb.cell(r, 7).value
    amt = mb.cell(r, 8).value
    if not name or amt is None:
        continue
    out.append(f"insert into monthly_commitments(household_id,name_en,amount_cents,remark) "
               f"values ('{HH}',{s(name)},{c(amt)},{s(mb.cell(r, 9).value)});")

# Expenses — 'Expenses' sheet (Date,Vendor,Location,Details,Amount)
# expenses.date is NOT NULL; the sheet leaves some rows undated (they belong to
# the same period as the dated row above). Forward-fill the last seen date so no
# row is dropped and each stays in the correct month.
ex = wb['Expenses']
last_date = None
for r in range(2, ex.max_row + 1):
    amt = ex.cell(r, 5).value
    if amt is None:
        continue
    dt = ex.cell(r, 1).value
    if isinstance(dt, (datetime.datetime, datetime.date)):
        last_date = dt
    out.append(f"insert into expenses(household_id,date,vendor,location,details,amount_cents,paid_by) "
               f"values ('{HH}',{d(last_date)},{s(ex.cell(r, 2).value)},{s(ex.cell(r, 3).value)},"
               f"{s(ex.cell(r, 4).value)},{c(amt)},NULL);")

# Assets: TreeO (property), Myvi/Alza (vehicle), AIA-CH/AIA-JC (investment)
A_TREEO = '00000000-0000-0000-0000-0000000000b1'
A_MYVI = '00000000-0000-0000-0000-0000000000b2'
A_ALZA = '00000000-0000-0000-0000-0000000000b3'
A_AIACH = '00000000-0000-0000-0000-0000000000b4'
A_AIAJC = '00000000-0000-0000-0000-0000000000b5'


def asset(idlit, typ, name, owner, opening):
    owner_sql = 'NULL' if owner is None else f"'{owner}'"
    open_sql = 'NULL' if opening is None else str(opening)
    out.append(f"insert into assets(id,household_id,type,name,owner_member_code,opening_balance_cents) "
               f"values ('{idlit}','{HH}','{typ}',{s(name)},{owner_sql},{open_sql});")


# TreeO opening balance = carry-forward from 2025 (TreeO sheet R2 = 46013.81)
asset(A_TREEO, 'property', 'TreeO', None, 4601381)
asset(A_MYVI, 'vehicle', 'Myvi PQC 9059', None, None)
asset(A_ALZA, 'vehicle', 'Alza PNM 9059', None, None)
asset(A_AIACH, 'investment', 'AIA — CH', 'CH', None)
asset(A_AIAJC, 'investment', 'AIA — JC', 'JC', None)

# TreeO transactions — 'TreeO' sheet rows 3..18 (Date,Details,Amount,Transferred)
to = wb['TreeO']
for r in range(3, 19):
    det = to.cell(r, 2).value
    amt = to.cell(r, 3).value
    if amt is None:
        continue
    transferred = to.cell(r, 4).value is True
    direction = 'in' if 'Commitment' in str(det) else 'out'
    txn_type = 'monthly_commitment' if direction == 'in' else 'bill'
    out.append(f"insert into asset_transactions(asset_id,household_id,date,description,amount_cents,direction,txn_type,settled) "
               f"values ('{A_TREEO}','{HH}',{d(to.cell(r, 1).value)},{s(det)},{c(amt)},'{direction}','{txn_type}',{str(transferred).lower()});")

# AIA schedules — 'AIA Investment' rows 3..12 (seq col1, CH date/amt col2/3, JC date/amt col5/6)
aia = wb['AIA Investment']
for r in range(3, 13):
    seq = aia.cell(r, 1).value
    if seq is None:
        continue
    seq = int(seq)
    for dcol, acol, aid in [(2, 3, A_AIACH), (5, 6, A_AIAJC)]:
        amt = aia.cell(r, acol).value
        if amt is None:
            continue
        out.append(f"insert into asset_transactions(asset_id,household_id,date,description,amount_cents,direction,txn_type,settled,seq) "
                   f"values ('{aid}','{HH}',{d(aia.cell(r, dcol).value)},'AIA payment',{c(amt)},'out','scheduled_payment',true,{seq});")

print('\n'.join(out))
