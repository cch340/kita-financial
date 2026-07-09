import { redirect } from 'next/navigation'
import { getMembership } from '@/lib/data/household'
import { getAssetCategories } from '@/lib/data/asset-categories'
import { CategoriesManager } from './CategoriesManager'

export default async function CategoriesPage() {
  const [membership, categories] = await Promise.all([getMembership(), getAssetCategories()])
  if (!membership) redirect('/login')
  return <CategoriesManager categories={categories} />
}
