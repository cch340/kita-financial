import { notFound } from 'next/navigation'
import { getAsset } from '@/lib/data/assets'
import { EditTxnForm } from './EditTxnForm'

export default async function EditTxnPage({ params }: { params: Promise<{ id: string; txnId: string }> }) {
  const { id, txnId } = await params
  const result = await getAsset(id)
  if (!result) notFound()
  const txn = result.txns.find((t) => t.id === txnId)
  if (!txn) notFound()
  return <EditTxnForm assetId={id} txn={txn} assetType={result.asset.type} />
}
