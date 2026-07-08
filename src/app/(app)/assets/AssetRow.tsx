'use client'
import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import type { Asset, AssetType, KeyFigure } from '@/lib/data/assets-shared'
import { IconTile } from '@/components/ui/IconTile'
import { MoneyText } from '@/components/ui/MoneyText'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { deleteAsset } from './actions'

const TYPE_ICON: Record<AssetType, string> = {
  property: 'Building',
  vehicle: 'Car',
  investment: 'ShieldCheck',
  other: 'PiggyBank',
}
const TYPE_TINT: Record<AssetType, string> = {
  property: 'var(--peach)',
  vehicle: 'var(--info-bg)',
  investment: 'var(--positive-bg)',
  other: 'var(--subtle)',
}

const REVEAL_WIDTH = 152 // px — two 76px action buttons behind each row

function assetMetaText(asset: Asset): string | null {
  const md = asset.metadata ?? {}
  if (asset.type === 'property') {
    return typeof md.address === 'string' && md.address.trim() ? md.address : null
  }
  if (asset.type === 'vehicle') {
    return typeof md.plate === 'string' && md.plate.trim() ? md.plate : null
  }
  if (asset.type === 'investment') {
    const years = md.years
    if (typeof years === 'number' && years > 0) return `${years}-year plan`
    return asset.ownerMemberCode
  }
  return typeof md.notes === 'string' && md.notes.trim() ? md.notes : null
}

export function AssetRow({ asset }: { asset: Asset & { key: KeyFigure } }) {
  const t = useT()
  const router = useRouter()
  const meta = assetMetaText(asset)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState(false)
  const dragState = useRef<{ startX: number; startDragX: number; moved: boolean } | null>(null)

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    dragState.current = { startX: e.clientX, startDragX: dragX, moved: false }
    setDragging(true)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const ds = dragState.current
    if (!ds) return
    const delta = e.clientX - ds.startX
    if (Math.abs(delta) > 8) ds.moved = true
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, ds.startDragX + delta))
    setDragX(next)
  }
  function onPointerUp() {
    const ds = dragState.current
    if (!ds) return
    dragState.current = null
    setDragging(false)
    // A tap (no real drag) on a closed row opens the asset detail page.
    if (!ds.moved && ds.startDragX === 0) {
      setDragX(0)
      router.push(`/assets/${asset.id}`)
      return
    }
    setDragX((x) => (x < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
  }
  function onPointerCancel() {
    const ds = dragState.current
    if (!ds) return
    dragState.current = null
    setDragging(false)
    setDragX((x) => (x < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-[16px]">
        {/* revealed actions, sit behind the row */}
        <div className="absolute inset-y-0 right-0 flex" style={{ width: REVEAL_WIDTH }}>
          <button
            type="button"
            onClick={() => {
              setDragX(0)
              router.push(`/assets/${asset.id}/edit`)
            }}
            className="pressable-opacity flex h-full flex-1 items-center justify-center text-sm font-bold text-white"
            style={{ background: 'var(--pending-text)' }}
          >
            {t('assets.edit')}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => setConfirmOpen(true)}
            className="pressable-opacity flex h-full flex-1 items-center justify-center text-sm font-bold text-white"
            style={{ background: 'var(--danger)' }}
          >
            {deleting ? <Spinner /> : t('assets.delete')}
          </button>
        </div>

        {/* foreground row — drag horizontally to reveal actions */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className="relative flex touch-pan-y items-center gap-3 rounded-[16px] bg-[var(--surface)] p-4 shadow-[0_3px_10px_oklch(0.5_0.05_45/.05)]"
          style={{ transform: `translateX(${dragX}px)`, transition: dragging ? 'none' : 'transform 160ms ease' }}
        >
          <IconTile name={TYPE_ICON[asset.type]} tint={TYPE_TINT[asset.type]} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--ink)]">{asset.name}</p>
            {meta && <p className="truncate text-xs text-[var(--muted)]">{meta}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <MoneyText cents={asset.key.amountCents} className="text-sm font-bold text-[var(--ink-head)]" />
            <span className="text-xs font-semibold text-[var(--muted)]">{t(`assets.key.${asset.key.label}`)}</span>
          </div>
          <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-[var(--faint)]" />
        </div>
      </div>
      {error && (
        <p role="alert" className="px-1 text-xs font-semibold text-[var(--danger)]">
          {t('error.delete_failed')}
        </p>
      )}
      {confirmOpen && (
        <ConfirmDialog
          message={t('assets.confirmDelete')}
          confirmLabel={t('assets.delete')}
          cancelLabel={t('common.cancel')}
          busy={deleting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            setDeleting(true)
            const res = await deleteAsset({ id: asset.id })
            if (!res.ok) {
              setDeleting(false)
              setConfirmOpen(false)
              setError(true)
            }
            // on success the row is removed by revalidatePath; this component unmounts
          }}
        />
      )}
    </>
  )
}
