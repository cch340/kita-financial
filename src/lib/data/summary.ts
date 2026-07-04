import type { ExpenseRow, DayGroup } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function monthRange(year: number, month1to12: number) {
  const startISO = `${year}-${pad(month1to12)}-01`
  const ny = month1to12 === 12 ? year + 1 : year
  const nm = month1to12 === 12 ? 1 : month1to12 + 1
  const endISO = `${ny}-${pad(nm)}-01`
  return { startISO, endISO }
}

export const monthKey = (dateISO: string) => dateISO.slice(0, 7)

export const sumCents = (rows: { amount_cents: number }[]) =>
  rows.reduce((acc, r) => acc + r.amount_cents, 0)

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']

/** Localized "July 2026" (en) / "2026年7月" (zh) month-year label. */
export function formatMonthYear(year: number, month1to12: number, locale: 'en' | 'zh'): string {
  if (locale === 'zh') return `${year}年${month1to12}月`
  return `${MONTHS_LONG[month1to12 - 1]} ${year}`
}

function shortLabel(dateISO: string) {
  const [, m, d] = dateISO.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}`
}
function daysBetween(aISO: string, bISO: string) {
  const a = Date.parse(aISO + 'T00:00:00Z')
  const b = Date.parse(bISO + 'T00:00:00Z')
  return Math.round((a - b) / 86400000)
}

export function groupByDay(rows: ExpenseRow[], todayISO: string): DayGroup[] {
  const byDate = new Map<string, ExpenseRow[]>()
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, [])
    byDate.get(r.date)!.push(r)
  }
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1)) // newest first
  return dates.map((date) => {
    const diff = daysBetween(todayISO, date)
    const label = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : shortLabel(date)
    const dayRows = byDate.get(date)!
    return { date, label, totalCents: sumCents(dayRows), rows: dayRows }
  })
}
