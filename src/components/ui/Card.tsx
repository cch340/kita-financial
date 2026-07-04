import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[16px] bg-[var(--surface)] p-4 shadow-[0_3px_10px_oklch(0.5_0.05_45/.05)] ${className}`}
    >
      {children}
    </div>
  )
}

export function HeroCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[26px] p-5 text-white ${className}`}
      style={{ background: 'var(--hero-grad)' }}
    >
      {children}
    </div>
  )
}
