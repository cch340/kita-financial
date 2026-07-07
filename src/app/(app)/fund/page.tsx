import { listFundRecords } from '@/lib/data/fund'
import { getMembership } from '@/lib/data/household'
import { FundView } from './FundView'

export default async function FundPage() {
  const currentYear = new Date().getFullYear()
  const [records, membership] = await Promise.all([listFundRecords(), getMembership()])
  const locale = membership?.language ?? 'en'
  return <FundView records={records} currentYear={currentYear} locale={locale} />
}
