import { notFound } from 'next/navigation'
import { getAsset } from '@/lib/data/assets'
import { getCommitmentsRaw } from '@/lib/data/commitments'
import { CommitmentsManager } from './CommitmentsManager'

export default async function CommitmentsManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getAsset(id)
  if (!result || result.asset.type !== 'property') notFound()
  const commitments = await getCommitmentsRaw(id)
  return <CommitmentsManager assetId={id} commitments={commitments} />
}
