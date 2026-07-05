import { getPersonalLedger } from '@/lib/data/personal'
import { getMembership } from '@/lib/data/household'
import { pickCopySourceMonth } from '@/lib/data/personal-shared'
import { PersonalView } from './PersonalView'

export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; y?: string; m?: string }>
}) {
  const params = await searchParams
  const membership = await getMembership()

  const member: 'CH' | 'JC' =
    params.member === 'CH' || params.member === 'JC' ? params.member : (membership?.memberCode ?? 'CH')

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const parsedYear = Number(params.y)
  const parsedMonth = Number(params.m)
  const explicitMonth =
    Number.isInteger(parsedYear) &&
    Number.isInteger(parsedMonth) &&
    parsedYear >= 2000 &&
    parsedYear <= 2100 &&
    parsedMonth >= 1 &&
    parsedMonth <= 12

  // Probe the member's ledger for the current month first — this also gives us
  // `availableMonths`, which we need to pick a default month when none is in the URL.
  const probe = await getPersonalLedger(member, currentYear, currentMonth)

  let year = currentYear
  let month = currentMonth
  if (explicitMonth) {
    year = parsedYear
    month = parsedMonth
  } else if (probe.availableMonths.length > 0) {
    const [y, m] = probe.availableMonths[0].split('-').slice(0, 2).map(Number)
    year = y
    month = m
  }

  const ledger = year === currentYear && month === currentMonth ? probe : await getPersonalLedger(member, year, month)

  const pad = (n: number) => String(n).padStart(2, '0')
  const targetPeriod = `${year}-${pad(month)}-01`
  const canCopyLastMonth = pickCopySourceMonth(ledger.availableMonths, targetPeriod) !== null

  return (
    <PersonalView
      member={member}
      year={year}
      month={month}
      ledger={ledger}
      canCopyLastMonth={canCopyLastMonth}
    />
  )
}
