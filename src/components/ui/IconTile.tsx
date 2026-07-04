import {
  Utensils,
  ShoppingCart,
  Car,
  Home,
  Baby,
  CookingPot,
  Plug,
  HeartPulse,
  Tag,
  HandCoins,
  Zap,
  Droplet,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

export const ICONS: Record<string, LucideIcon> = {
  Utensils,
  ShoppingCart,
  Car,
  Home,
  Baby,
  CookingPot,
  Plug,
  HeartPulse,
  Tag,
  HandCoins,
  Zap,
  Droplet,
  ShieldCheck,
}

export function IconTile({ name, tint }: { name: string; tint: string }) {
  const Icon = ICONS[name] ?? Tag
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]"
      style={{ background: tint }}
    >
      <Icon size={20} strokeWidth={2} className="text-[var(--ink)]" />
    </div>
  )
}
