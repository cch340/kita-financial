import { notFound } from 'next/navigation'
import { getAsset } from '@/lib/data/assets'
import { EditAssetForm } from './EditAssetForm'

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getAsset(id)
  if (!result) notFound()
  return <EditAssetForm asset={result.asset} />
}
