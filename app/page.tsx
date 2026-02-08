import { redirect } from 'next/navigation'
import { fetchContentStructureFromGitHub } from '@/lib/github-content'
import { sortToDisplayOrder, type SidebarConfigItem } from '@/lib/sidebar-order'

/** Returns the path of the first page in display order (e.g. "information/solid"). Skips dividers. */
function getFirstPagePath(items: SidebarConfigItem[]): string | null {
  for (const item of items) {
    if (item.type === 'divider') continue
    if (item.type === 'page') return item.path
    if (item.type === 'folder' && item.children.length > 0) {
      const nested = getFirstPagePath(item.children)
      if (nested) return nested
    }
  }
  return null
}

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const structure = await fetchContentStructureFromGitHub()
  const sorted = sortToDisplayOrder(structure, true)
  const firstPath = getFirstPagePath(sorted)

  if (firstPath) {
    redirect(`/content/${firstPath}`)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">SOLID Design</h1>
      <p className="text-gray-600">
        Select an item from the sidebar to view documentation.
      </p>
    </div>
  )
}
