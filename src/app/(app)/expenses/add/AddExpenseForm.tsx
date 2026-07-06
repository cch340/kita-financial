'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useT } from '@/i18n/LocaleProvider'
import { formatRM, pushDigit, pushDoubleZero, backspace } from '@/lib/money'
import type { CatalogItem } from '@/lib/data/catalog-shared'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { Combobox } from '@/components/ui/Combobox'
import { addExpenseAction } from './actions'
import { createVendorAction, createLocationAction } from './catalog-actions'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'] as const
const MEMBERS = ['CH', 'JC'] as const

export function AddExpenseForm({
  error, categories, vendors, locations,
}: {
  error?: string
  categories: CatalogItem[]
  vendors: CatalogItem[]
  locations: CatalogItem[]
}) {
  const t = useT()
  const [cents, setCents] = useState(0)
  const [payer, setPayer] = useState<'CH' | 'JC' | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [vendorId, setVendorId] = useState<string | null>(null)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  function pressKey(key: (typeof KEYS)[number]) {
    if (key === '⌫') return setCents((c) => backspace(c))
    if (key === '00') return setCents((c) => pushDoubleZero(c))
    setCents((c) => pushDigit(c, Number(key)))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--paper)]">
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col px-[18px] pb-6 pt-4">
        {/* header */}
        <div className="flex items-center justify-between py-2">
          <Link href="/expenses" aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">‹</Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('add.title')}</h1>
          <Link href="/expenses" aria-label={t('common.close')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">×</Link>
        </div>

        <form action={addExpenseAction} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="amountCents" value={cents} />
          <input type="hidden" name="categoryId" value={categoryId ?? ''} />
          <input type="hidden" name="vendorId" value={vendorId ?? ''} />
          <input type="hidden" name="locationId" value={locationId ?? ''} />
          <input type="hidden" name="paidBy" value={payer ?? ''} />
          <input type="hidden" name="note" value={note} />
          <input type="hidden" name="dateISO" value={date} />

          {/* scrollable middle */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
            {/* category chips: 2 rows tall, scroll horizontally when overflowing */}
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('expenses.category')}</p>
              {categories.length === 0 ? (
                <Link href="/manage" className="text-sm font-semibold text-[var(--primary)]">
                  {t('add.noCategories')}
                </Link>
              ) : (
                <div className="grid grid-flow-col grid-rows-2 gap-2 overflow-x-auto pb-1"
                  style={{ gridAutoColumns: 'max-content' }}>
                  {categories.map((c) => {
                    const selected = categoryId === c.id
                    return (
                      <button type="button" key={c.id}
                        onClick={() => setCategoryId((cur) => (cur === c.id ? null : c.id))}
                        className="pressable flex min-h-[44px] items-center rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
                        style={{
                          borderColor: selected ? 'var(--primary)' : 'var(--hairline)',
                          background: selected ? 'var(--primary)' : 'var(--surface)',
                          color: selected ? 'white' : 'var(--ink)',
                        }}>
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('add.note')}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />

            <Combobox label={t('add.vendor')} placeholder={t('add.selectVendor')} items={vendors}
              valueId={vendorId} onChange={setVendorId} onCreate={createVendorAction} />
            <Combobox label={t('add.location')} placeholder={t('add.selectLocation')} items={locations}
              valueId={locationId} onChange={setLocationId} onCreate={createLocationAction} />

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--muted)]">{t('add.date')}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none" />
            </label>

            {error && <p className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}
          </div>

          {/* bottom cluster: numpad -> amount -> who-paid -> save */}
          <div className="flex shrink-0 flex-col gap-3 pt-2">
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <button key={k} type="button" onClick={() => pressKey(k)}
                  className="pressable rounded-xl bg-[var(--surface)] text-lg font-semibold text-[var(--ink)]"
                  style={{ height: 52 }}>{k}</button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-1 text-[32px] leading-none font-extrabold text-[var(--ink-head)]">
              {formatRM(cents)}
              <span className="ml-1 inline-block h-7 w-[3px] animate-pulse bg-[var(--primary)]" />
            </div>

            <div className="flex gap-2">
              {MEMBERS.map((mem) => {
                const selected = payer === mem
                const memberColor = mem === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
                return (
                  <button type="button" key={mem} onClick={() => setPayer((p) => (p === mem ? null : mem))}
                    className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
                    style={{
                      borderColor: selected ? memberColor : 'var(--hairline)',
                      background: selected ? memberColor : 'var(--surface)',
                      color: selected ? 'white' : 'var(--ink)',
                    }}>
                    <MemberAvatar member={mem} size={24} />{mem}
                  </button>
                )
              })}
            </div>

            <SubmitButton disabled={cents <= 0}
              className="w-full rounded-xl bg-[var(--primary-btn)] py-3.5 font-bold text-white disabled:opacity-40">
              {t('add.save')}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  )
}
