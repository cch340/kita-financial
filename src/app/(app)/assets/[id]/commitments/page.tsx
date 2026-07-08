import { notFound } from 'next/navigation'
import { getAsset } from '@/lib/data/assets'
import { getCommitmentsRaw } from '@/lib/data/commitments'
import { CommitmentsManager } from './CommitmentsManager'

export default async function CommitmentsManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const asset = await getAsset(id)
  if (!asset) notFound()
  const commitments = await getCommitmentsRaw(id)
  return <CommitmentsManager assetId={id} commitments={commitments} />
}
