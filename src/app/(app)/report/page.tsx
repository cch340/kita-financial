import { getYearReport } from '@/lib/data/report'
import { getMembership } from '@/lib/data/household'
import { ReportView } from './ReportView'

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string }>
}) {
  const { y } = await searchParams
  const now = new Date()
  const parsedYear = Number(y)
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : now.getFullYear()

  const [membership, report] = await Promise.all([getMembership(), getYearReport(year)])
  const locale = membership?.language ?? 'en'

  return <ReportView report={report} locale={locale} />
}
