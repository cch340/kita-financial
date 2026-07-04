'use client'
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useT, useLocale } from '@/i18n/LocaleProvider'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import type { SettingsData } from '@/lib/data/settings-shared'
import { urlBase64ToUint8Array, serializeSubscription } from '@/lib/push/push-shared'
import {
  updateLanguage, updateReminderSetting, inviteMember, signOutAction,
  subscribeToPush, unsubscribeFromPush,
} from './actions'

export function SettingsView({ data }: { data: SettingsData }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [monthly, setMonthly] = useState(data.reminders.monthly)
  const [yearly, setYearly] = useState(data.reminders.yearly)
  const [email, setEmail] = useState('')
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; key: string } | null>(null)

  const [pushOn, setPushOn] = useState(data.pushSubscribed)
  const [supported, setSupported] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window)
    setIsIOS(/ipad|iphone|ipod/i.test(navigator.userAgent))
    setStandalone(window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true)
  }, [])

  async function onPush(next: boolean) {
    if (!supported) return
    try {
      const reg = await navigator.serviceWorker.ready
      if (next) {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
        })
        const res = await subscribeToPush(serializeSubscription(sub))
        setPushOn(res.ok)
      } else {
        const sub = await reg.pushManager.getSubscription()
        if (sub) { await unsubscribeFromPush(sub.endpoint); await sub.unsubscribe() }
        setPushOn(false)
      }
    } catch { setPushOn(false) }
  }

  function onLanguage(lang: 'en' | 'zh') {
    if (lang === locale) return
    startTransition(async () => {
      await updateLanguage(lang)
      router.refresh()
    })
  }
  function onMonthly(next: boolean) {
    setMonthly(next)
    startTransition(() => { updateReminderSetting('monthly_commitment', next) })
  }
  function onYearly(next: boolean) {
    setYearly(next)
    startTransition(() => { updateReminderSetting('yearly_big_payment', next) })
  }
  async function onInvite() {
    const res = await inviteMember(email)
    if (res.ok) { setInviteMsg({ ok: true, key: 'settings.inviteAdded' }); setEmail(''); router.refresh() }
    else setInviteMsg({ ok: false, key: `error.${res.error}` })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-10 pt-4">
        {/* header */}
        <div className="flex items-center gap-1 py-2">
          <Link href="/" aria-label={t('common.back')} className="grid h-11 w-11 place-items-center -ml-2 text-[var(--muted)]">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-lg font-extrabold text-[var(--ink-head)]">{t('settings.title')}</h1>
        </div>

        {/* Members */}
        <Section title={t('settings.members')}>
          <div className="flex flex-col gap-3">
            {data.members.map((mem) => (
              <div key={mem.code} className="flex items-center gap-3">
                <MemberAvatar member={mem.code} size={36} />
                <div className="flex-1">
                  <p className="text-sm font-bold text-[var(--ink)]">{mem.displayName}</p>
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    {mem.role === 'owner' ? `${t('settings.you')} · ${t('settings.admin')}` : t('settings.partner')}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              type="email" value={email} onChange={(e) => { setEmail(e.target.value); setInviteMsg(null) }}
              placeholder={t('settings.invitePlaceholder')}
              className="flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--faint)]"
            />
            <button onClick={onInvite} disabled={!email.trim()}
              className="rounded-xl bg-[var(--primary-btn)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {t('settings.invite')}
            </button>
          </div>
          {inviteMsg && (
            <p className={`mt-2 text-xs font-semibold ${inviteMsg.ok ? 'text-[var(--positive-text)]' : 'text-[var(--danger)]'}`}>
              {t(inviteMsg.key)}
            </p>
          )}
        </Section>

        {/* Language */}
        <Section title={t('settings.language')}>
          <div className="flex gap-2">
            {(['en', 'zh'] as const).map((lang) => {
              const active = locale === lang
              return (
                <button key={lang} onClick={() => onLanguage(lang)}
                  className="flex-1 rounded-xl border py-2.5 text-sm font-bold"
                  style={{
                    borderColor: active ? 'var(--primary)' : 'var(--hairline)',
                    background: active ? 'var(--primary)' : 'var(--surface)',
                    color: active ? 'white' : 'var(--ink)',
                  }}>
                  {lang === 'en' ? 'English' : '中文'}
                </button>
              )
            })}
          </div>
        </Section>

        {/* Notifications */}
        <Section title={t('settings.notifications')}>
          <SwitchRow label={t('settings.notif.monthly')} desc={t('settings.notif.monthlyDesc')} checked={monthly} onChange={onMonthly} />
          <SwitchRow label={t('settings.notif.yearly')} desc={t('settings.notif.yearlyDesc')} checked={yearly} onChange={onYearly} />
          <SwitchRow
            label={t('settings.notif.push')}
            desc={supported ? t('settings.notif.pushDesc') : t('push.notSupported')}
            checked={pushOn}
            onChange={onPush}
            disabled={!supported}
          />
        </Section>

        {/* Install card — only when not already installed */}
        {!standalone && (
          <section className="mt-5">
            <div className="rounded-2xl bg-[var(--hero-grad,var(--primary))] p-4 text-white"
              style={{ background: 'linear-gradient(135deg, var(--primary), oklch(0.58 0.14 35))' }}>
              <p className="text-sm font-extrabold">{t('settings.install.title')}</p>
              <p className="mt-1 text-xs font-semibold opacity-90">{t('settings.install.desc')}</p>
              {isIOS
                ? <p className="mt-3 text-xs font-semibold opacity-90">{t('settings.install.iosHint')}</p>
                : <button disabled className="mt-3 rounded-lg bg-white/20 px-4 py-2 text-sm font-bold">
                    {t('settings.install.button')}
                  </button>}
            </div>
          </section>
        )}

        <div className="flex-1" />

        <button onClick={() => startTransition(() => { signOutAction() })}
          className="mt-6 w-full rounded-xl border border-[var(--danger)] py-3 text-sm font-bold text-[var(--danger)]">
          {t('settings.signOut')}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{title}</h2>
      <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">{children}</div>
    </section>
  )
}

export function SwitchRow({
  label, desc, checked, onChange, disabled,
}: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-bold text-[var(--ink)]">{label}</p>
        {desc && <p className="text-xs font-semibold text-[var(--muted)]">{desc}</p>}
      </div>
      <button
        role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40"
        style={{ background: checked ? 'var(--primary)' : 'var(--hairline)' }}>
        <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? '22px' : '2px' }} />
      </button>
    </div>
  )
}
