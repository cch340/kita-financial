export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--subtle)]" />
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--subtle)]" />
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--subtle)]" />
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--subtle)]" />
    </div>
  )
}
