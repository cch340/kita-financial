import { NextResponse, type NextRequest } from 'next/server'
import { runReminderScan } from '@/lib/data/reminders'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const todayISO = new Date().toISOString().slice(0, 10)
  const result = await runReminderScan(todayISO)
  return NextResponse.json({ ok: true, ...result })
}
