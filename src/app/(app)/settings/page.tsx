import { redirect } from 'next/navigation'
import { getSettingsData } from '@/lib/data/settings'
import { SettingsView } from './SettingsView'

export default async function SettingsPage() {
  const data = await getSettingsData()
  if (!data) redirect('/login')
  return <SettingsView data={data} />
}
