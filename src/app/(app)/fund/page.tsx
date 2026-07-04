import { getFundOverview } from '@/lib/data/fund'
import { getMembership } from '@/lib/data/household'
import { FundView } from './FundView'

export default async function FundPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [overview, membership] = await Promise.all([getFundOverview(year), getMembership()])
  const locale = membership?.language ?? 'en'

  return <FundView overview={overview} locale={locale} month={month} />
}
