import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { getMonthTotalCents } from './expenses'
import { monthRange, formatMonthYear } from './summary'
import { localizedName } from './budget-shared'
import { t, type Locale } from '@/i18n'
import type { Member } from './types'

export type UpcomingItem = {
  icon: string
  title: string
  due: string
  amountCents: number
  status: 'pending' | 'upcoming'
}

export type HomeSummary = {
  monthLabel: string
  jointFund: {
    chPaid: boolean
    jcPaid: boolean
    contributedCents: number
    expectedThisMonthCents: number
    yearContributedCents: number
    yearExpectedCents: number
  }
  budget: { totalCents: number; spentCents: number }
  upcoming: UpcomingItem[]
}

function emptySummary(monthLabel: string): HomeSummary {
  return {
    monthLabel,
    jointFund: {
      chPaid: false,
      jcPaid: false,
      contributedCents: 0,
      expectedThisMonthCents: 0,
      yearContributedCents: 0,
      yearExpectedCents: 0,
    },
    budget: { totalCents: 0, spentCents: 0 },
    upcoming: [],
  }
}

/** Unwraps a Supabase response, logging on error and defaulting to an empty array. */
function rowsOf<T>(res: { data: T[] | null; error: { message: string } | null }, label: string): T[] {
  if (res.error) {
    console.error(`getHomeSummary: ${label} failed:`, res.error.message)
    return []
  }
  return res.data ?? []
}

export async function getHomeSummary(): Promise<HomeSummary> {
  const membership = await getMembership()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const locale: Locale = membership?.language ?? 'en'
  const monthLabel = formatMonthYear(year, month, locale)

  if (!membership) return emptySummary(monthLabel)

  const supabase = await createClient()
  const { startISO } = monthRange(year, month)
  const householdId = membership.householdId

  const [
    thisMonthContribRes,
    configRes,
    paidContribRes,
    budgetRes,
    commitmentsRes,
    investmentAssetsRes,
    spentCents,
  ] = await Promise.all([
    supabase
      .from('joint_fund_contributions')
      .select('member_code, amount_cents, status')
      .eq('household_id', householdId)
      .eq('period', startISO),
    supabase
      .from('joint_fund_config')
      .select('member_code, expected_monthly_cents, carry_forward_prev_year_cents')
      .eq('household_id', householdId),
    supabase
      .from('joint_fund_contributions')
      .select('amount_cents')
      .eq('household_id', householdId)
      .eq('status', 'paid')
      .gte('period', monthRange(year, 1).startISO)
      .lt('period', monthRange(year + 1, 1).startISO),
    supabase.from('budget_categories').select('total_cents').eq('household_id', householdId),
    supabase
      .from('monthly_commitments')
      .select('name_en, name_zh, amount_cents')
      .eq('household_id', householdId),
    supabase
      .from('assets')
      .select('id, name')
      .eq('household_id', householdId)
      .eq('type', 'investment'),
    getMonthTotalCents(year, month),
  ])

  type ContribRow = { member_code: Member; amount_cents: number; status: 'paid' | 'pending' }
  type ConfigRow = { member_code: Member; expected_monthly_cents: number; carry_forward_prev_year_cents: number }
  type PaidRow = { amount_cents: number }
  type BudgetRow = { total_cents: number }
  type CommitmentRow = { name_en: string; name_zh: string | null; amount_cents: number }
  type AssetRow = { id: string; name: string }

  const thisMonthContribs = rowsOf<ContribRow>(thisMonthContribRes, 'joint_fund_contributions (this month)')
  const configRows = rowsOf<ConfigRow>(configRes, 'joint_fund_config')
  const paidContribs = rowsOf<PaidRow>(paidContribRes, 'joint_fund_contributions (paid, this year)')
  const budgetRows = rowsOf<BudgetRow>(budgetRes, 'budget_categories')
  const commitmentRows = rowsOf<CommitmentRow>(commitmentsRes, 'monthly_commitments')
  const investmentAssets = rowsOf<AssetRow>(investmentAssetsRes, 'assets (investment)')

  const chRow = thisMonthContribs.find((r) => r.member_code === 'CH')
  const jcRow = thisMonthContribs.find((r) => r.member_code === 'JC')
  const chPaid = chRow?.status === 'paid'
  const jcPaid = jcRow?.status === 'paid'
  const contributedCents = thisMonthContribs
    .filter((r) => r.status === 'paid')
    .reduce((a, r) => a + r.amount_cents, 0)
  const expectedThisMonthCents = configRows.reduce((a, r) => a + r.expected_monthly_cents, 0)
  const yearContributedCents = paidContribs.reduce((a, r) => a + r.amount_cents, 0)
  const yearExpectedCents =
    configRows.reduce((a, r) => a + r.expected_monthly_cents, 0) * 12 +
    configRows.reduce((a, r) => a + r.carry_forward_prev_year_cents, 0)

  const totalCents = budgetRows.reduce((a, r) => a + r.total_cents, 0)

  // Next unsettled AIA scheduled payment across the household's investment assets.
  let aiaItem: UpcomingItem | null = null
  if (investmentAssets.length > 0) {
    const assetIds = investmentAssets.map((a) => a.id)
    const { data: aiaRows, error: aiaError } = await supabase
      .from('asset_transactions')
      .select('asset_id, amount_cents, date')
      .in('asset_id', assetIds)
      .eq('txn_type', 'scheduled_payment')
      .eq('settled', false)
      .order('date', { ascending: true })
      .limit(1)
    if (aiaError) {
      console.error('getHomeSummary: asset_transactions (aia) failed:', aiaError.message)
    } else if (aiaRows && aiaRows.length > 0) {
      const row = aiaRows[0] as { asset_id: string; amount_cents: number; date: string }
      const asset = investmentAssets.find((a) => a.id === row.asset_id)
      aiaItem = {
        icon: 'ShieldCheck',
        title: asset?.name ?? 'AIA',
        due: row.date,
        amountCents: row.amount_cents,
        status: 'upcoming',
      }
    }
  }

  const pendingContribItems: UpcomingItem[] = thisMonthContribs
    .filter((r) => r.status === 'pending')
    .map((r) => ({
      icon: 'HandCoins',
      title: `${r.member_code} · ${t(locale, 'home.jointFund')}`,
      due: startISO,
      amountCents: r.amount_cents,
      status: 'pending',
    }))

  const commitmentItems: UpcomingItem[] = commitmentRows.map((r) => ({
    icon: 'Zap',
    title: localizedName(r.name_en, r.name_zh, locale),
    due: t(locale, 'home.due'),
    amountCents: r.amount_cents,
    status: 'upcoming',
  }))

  const upcoming = [...pendingContribItems, ...commitmentItems, ...(aiaItem ? [aiaItem] : [])].slice(0, 3)

  return {
    monthLabel,
    jointFund: {
      chPaid,
      jcPaid,
      contributedCents,
      expectedThisMonthCents,
      yearContributedCents,
      yearExpectedCents,
    },
    budget: { totalCents, spentCents },
    upcoming,
  }
}
