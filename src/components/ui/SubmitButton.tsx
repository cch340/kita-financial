'use client'
import { useFormStatus } from 'react-dom'
import { Spinner } from './Spinner'

export function SubmitButton({
  children,
  className,
  disabled,
}: {
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={`pressable relative ${className ?? ''}`}
    >
      <span
        className="flex items-center justify-center gap-2 transition-opacity"
        style={{ opacity: pending ? 0 : 1 }}
      >
        {children}
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center transition-opacity"
        style={{ opacity: pending ? 1 : 0 }}
      >
        <Spinner />
      </span>
    </button>
  )
}
