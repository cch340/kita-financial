import { redirect } from 'next/navigation'
import { getMembership } from '@/lib/data/household'
import { getCategories } from '@/lib/data/categories'
import { CategoriesManager } from './CategoriesManager'

export default async function CategoriesPage() {
  const [membership, categories] = await Promise.all([getMembership(), getCategories()])
  if (!membership) redirect('/login')
  return <CategoriesManager categories={categories} />
}
