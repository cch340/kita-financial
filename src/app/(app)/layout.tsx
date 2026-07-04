import { BottomTabBar } from '@/components/nav/BottomTabBar'
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--paper)]">
      <div className="mx-auto max-w-[430px] px-[18px] pb-[96px] pt-4">{children}</div>
      <BottomTabBar />
    </div>
  )
}
