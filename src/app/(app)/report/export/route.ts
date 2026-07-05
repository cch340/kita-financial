import { NextResponse, type NextRequest } from 'next/server'
import { getMembership } from '@/lib/data/household'
import { getExpensesForYear, getLedgerForYear } from '@/lib/data/report'
import { getAsset } from '@/lib/data/assets'
import { toCsv, centsToDecimal, assetCsvFilename } from '@/lib/data/csv-shared'
import { categoryLabel } from '@/lib/categories'

// Export CSVs are always request-time, per-user (RLS-scoped) — never cache.
export const dynamic = 'force-dynamic'

/** UTF-8 BOM so Excel detects the encoding and renders Chinese text correctly. */
function csvResponse(filename: string, csv: string): NextResponse {
  return new NextResponse('﻿' + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function parseYear(raw: string | null): number | null {
  const y = Number(raw)
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : null
}

export async function GET(request: NextRequest) {
  const m = await getMembership()
  if (!m) return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const type = sp.get('type')

  if (type === 'expenses') {
    const year = parseYear(sp.get('year'))
    if (year == null) return NextResponse.json({ ok: false, error: 'invalid_year' }, { status: 400 })
    const rows = await getExpensesForYear(year)
    const csv = toCsv(
      ['Date', 'Vendor', 'Location', 'Details', 'Category', 'Amount', 'Paid By'],
      rows.map((r) => [
        r.date,
        r.vendor,
        r.location,
        r.details,
        r.category ? categoryLabel(r.category, 'en') : '',
        centsToDecimal(r.amount_cents),
        r.paid_by,
      ]),
    )
    return csvResponse(`kita-expenses-${year}.csv`, csv)
  }

  if (type === 'ledger') {
    const year = parseYear(sp.get('year'))
    const member = sp.get('member')
    if (year == null) return NextResponse.json({ ok: false, error: 'invalid_year' }, { status: 400 })
    if (member !== 'CH' && member !== 'JC') {
      return NextResponse.json({ ok: false, error: 'invalid_member' }, { status: 400 })
    }
    const rows = await getLedgerForYear(member, year)
    const csv = toCsv(
      ['Month', 'Type', 'Description', 'Amount', 'Remark'],
      rows.map((e) => [
        e.period.slice(0, 7),
        e.entryType,
        e.description,
        centsToDecimal(e.amountCents),
        e.remark,
      ]),
    )
    return csvResponse(`kita-ledger-${member}-${year}.csv`, csv)
  }

  if (type === 'asset') {
    const assetId = sp.get('id')
    if (!assetId) return NextResponse.json({ ok: false, error: 'invalid_asset' }, { status: 400 })
    const result = await getAsset(assetId)
    if (!result) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    const csv = toCsv(
      ['Date', 'Description', 'Txn Type', 'Direction', 'Amount', 'Settled', 'Notes'],
      result.txns.map((t) => [
        t.date,
        t.description,
        t.txnType,
        t.direction,
        centsToDecimal(t.amountCents),
        t.settled ? 'yes' : 'no',
        t.notes,
      ]),
    )
    return csvResponse(assetCsvFilename(result.asset.name, result.asset.id), csv)
  }

  return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })
}
