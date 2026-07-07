import { listRecurringFunds } from '@/lib/data/recurring-funds'
import { FundRecordForm } from '../FundRecordForm'
import { addFundRecordAction } from '../actions'

export default async function AddFundRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const recurringFunds = await listRecurringFunds()
  const now = new Date()
  return (
    <FundRecordForm
      mode="add"
      action={addFundRecordAction}
      error={error}
      recurringFunds={recurringFunds}
      initial={{ memberCode: null, year: now.getFullYear(), month: now.getMonth() + 1, amountCents: 0, notes: '' }}
    />
  )
}
