import { signIn } from './actions'
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <main className="min-h-dvh grid place-items-center px-6 bg-[var(--paper)]">
      <form action={signIn} className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 shadow">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">Kita.</h1>
        <input name="email" type="email" required placeholder="Email"
          className="mt-4 w-full rounded-xl border border-[var(--hairline)] px-4 py-3" />
        <input name="password" type="password" required placeholder="Password"
          className="mt-3 w-full rounded-xl border border-[var(--hairline)] px-4 py-3" />
        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
        <button className="mt-4 w-full rounded-xl bg-[var(--primary-btn)] py-3 font-semibold text-white">Sign in</button>
      </form>
    </main>
  )
}
