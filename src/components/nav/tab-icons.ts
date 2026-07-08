import { Home, Receipt, HandCoins, LayoutGrid, MoreHorizontal, type LucideIcon } from 'lucide-react'
import type { TabId } from '@/lib/nav/nav-shared'

export const TAB_ICONS: Record<TabId, LucideIcon> = {
  home: Home,
  expenses: Receipt,
  fund: HandCoins,
  assets: LayoutGrid,
}

export const MORE_ICON: LucideIcon = MoreHorizontal
