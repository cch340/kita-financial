import { redirect } from 'next/navigation'
import { listFundRecords } from '@/lib/data/fund'
import { listRecurringFunds } from '@/lib/data/recurring-funds'
import { monthOf, yearOf } from '@/lib/data/fund-shared'
import { FundRecordForm } from '../../FundRecordForm'
import { updateFundRecordAction } from '../../actions'

export default async function EditFundRecordPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const [records, recurringFunds] = await Promise.all([listFundRecords(), listRecurringFunds()])
  const rec = records.find((r) => r.id === id)
  if (!rec) redirect('/fund')
  return (
    <FundRecordForm
      mode="edit"
      action={updateFundRecordAction}
      error={error}
      recurringFunds={recurringFunds}
      initial={{
        id: rec.id, memberCode: rec.memberCode,
        year: yearOf(rec.periodISO), month: monthOf(rec.periodISO),
        amountCents: rec.amountCents, notes: rec.notes ?? '',
      }}
    />
  )
}
