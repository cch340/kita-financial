'use client'
import { Spinner } from './Spinner'

/** Centered confirm modal (scrim + card). Danger-styled confirm button.
 *  Distinct from ConfirmButton (two-tap inline). Render it OUTSIDE any
 *  transformed/overflow-hidden ancestor so `fixed` is viewport-relative. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title?: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[320px] rounded-2xl bg-[var(--paper)] p-5 shadow-[0_10px_40px_oklch(0.4_0.05_45/.2)]"
      >
        {title && <h2 className="text-lg font-extrabold text-[var(--ink-head)]">{title}</h2>}
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{message}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="pressable flex-1 rounded-xl border border-[var(--hairline)] py-3 font-bold text-[var(--ink)] disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="pressable flex flex-1 items-center justify-center rounded-xl py-3 font-bold text-white disabled:opacity-60"
            style={{ background: 'var(--danger)' }}
          >
            {busy ? <Spinner /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
