'use client'
import { useRef, useState, useTransition } from 'react'
import { ArrowUp, ArrowDown, PanelBottom, PanelBottomDashed } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { MAX_BAR, TAB_DEFS, type NavLayout, type TabId } from '@/lib/nav/nav-shared'
import { TAB_ICONS } from '@/components/nav/tab-icons'
import { updateTabOrder } from './actions'

function labelFor(id: TabId): string {
  return TAB_DEFS.find((d) => d.id === id)!.i18nKey
}

export function NavOrderEditor({ initial }: { initial: NavLayout }) {
  const t = useT()
  const [layout, setLayout] = useState<NavLayout>(initial)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const genRef = useRef(0)

  function apply(next: NavLayout) {
    const prev = layout
    const gen = ++genRef.current
    setLayout(next) // optimistic
    setError(null)
    startTransition(async () => {
      const res = await updateTabOrder(next)
      // Only the latest in-flight save may roll back — this deliberately favors
      // "don't clobber a newer change" over "restore server truth" on failure.
      if (!res.ok && genRef.current === gen) {
        setLayout(prev) // rollback — only if no newer change superseded this one
        setError(`error.${res.error ?? 'save_failed'}`)
      }
    })
  }

  function move(list: 'bar' | 'more', index: number, dir: -1 | 1) {
    const arr = [...layout[list]]
    const j = index + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[index], arr[j]] = [arr[j], arr[index]]
    apply({ ...layout, [list]: arr })
  }

  function toMore(index: number) {
    if (layout.bar.length <= 1) return // keep at least one bar tab
    const bar = [...layout.bar]
    const [id] = bar.splice(index, 1)
    apply({ bar, more: [id, ...layout.more] })
  }

  function toBar(index: number) {
    if (layout.bar.length >= MAX_BAR) return
    const more = [...layout.more]
    const [id] = more.splice(index, 1)
    apply({ bar: [...layout.bar, id], more })
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-xs font-semibold text-[var(--danger)]">{t(error)}</p>}
      <p className="text-xs font-semibold text-[var(--muted)]">{t('settings.nav.desc')}</p>

      <Group title={t('settings.nav.inBar')}>
        {layout.bar.map((id, i) => (
          <Row key={id} id={id} label={t(labelFor(id))}>
            <IconBtn label={t('settings.nav.moveUp')} disabled={i === 0} onClick={() => move('bar', i, -1)}><ArrowUp size={16} /></IconBtn>
            <IconBtn label={t('settings.nav.moveDown')} disabled={i === layout.bar.length - 1} onClick={() => move('bar', i, 1)}><ArrowDown size={16} /></IconBtn>
            <IconBtn label={t('settings.nav.toMore')} disabled={layout.bar.length <= 1} onClick={() => toMore(i)}><PanelBottomDashed size={16} /></IconBtn>
          </Row>
        ))}
      </Group>

      <Group title={t('settings.nav.inMore')}>
        {layout.more.map((id, i) => (
          <Row key={id} id={id} label={t(labelFor(id))}>
            <IconBtn label={t('settings.nav.moveUp')} disabled={i === 0} onClick={() => move('more', i, -1)}><ArrowUp size={16} /></IconBtn>
            <IconBtn label={t('settings.nav.moveDown')} disabled={i === layout.more.length - 1} onClick={() => move('more', i, 1)}><ArrowDown size={16} /></IconBtn>
            <IconBtn label={t('settings.nav.toBar')} disabled={layout.bar.length >= MAX_BAR} onClick={() => toBar(i)}><PanelBottom size={16} /></IconBtn>
          </Row>
        ))}
      </Group>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--faint)]">{title}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function Row({ id, label, children }: { id: TabId; label: string; children: React.ReactNode }) {
  const Icon = TAB_ICONS[id]
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2">
      <Icon size={18} className="text-[var(--ink)]" />
      <span className="flex-1 text-sm font-bold text-[var(--ink)]">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  )
}

function IconBtn({ label, disabled, onClick, children }: {
  label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="pressable-opacity grid h-9 w-9 place-items-center rounded-lg border border-[var(--hairline)] text-[var(--muted)] disabled:opacity-30"
    >
      {children}
    </button>
  )
}
