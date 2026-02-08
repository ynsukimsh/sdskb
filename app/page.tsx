import { redirect } from 'next/navigation'
import sidebarConfig from '@/sidebar-config.json'
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

export default function HomePage() {
  const structure = sidebarConfig.structure as SidebarConfigItem[]
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
