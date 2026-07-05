'use client'
import { useEffect, useState } from 'react'

/** Two-tap delete confirm, no modal. First tap arms (shows `confirmLabel`);
 *  second tap within 3s calls `onConfirm`. Auto-disarms after the timeout. */
export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel,
  disabled,
  className,
}: {
  onConfirm: () => void
  label: string
  confirmLabel: string
  disabled?: boolean
  className?: string
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(id)
  }, [armed])

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={armed}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
      className={className}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
