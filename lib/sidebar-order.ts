/** Shared ordering for sidebar config: pinned (by order) → dividers (by order) → unpinned (alphabetical by path). */

export type SidebarConfigPage = { type: 'page'; path: string; order: number; pinned: boolean }
export type SidebarConfigFolder = {
  type: 'folder'
  path: string
  order: number
  pinned: boolean
  children: SidebarConfigItem[]
}
export type SidebarConfigDivider = { type: 'divider'; order?: number }
export type SidebarConfigItem = SidebarConfigPage | SidebarConfigFolder | SidebarConfigDivider

function getItemPath(item: SidebarConfigItem): string {
  if (item.type === 'divider') return ''
  return item.path
}

export function isPinned(item: SidebarConfigItem): boolean {
  if (item.type === 'divider') return false
  return item.pinned
}

/** Sort: at root level, all items use custom order; otherwise pinned (custom order), then dividers, then unpinned (alphabetical). Recurses into folder children. */
export function sortToDisplayOrder(
  items: SidebarConfigItem[],
  atRootLevel = false
): SidebarConfigItem[] {
  if (atRootLevel) {
    const byOrder = [...items].sort(
      (a, b) => ('order' in a ? a.order : 0) - ('order' in b ? b.order : 0)
    )
    return byOrder.map((item) => {
      if (item.type === 'folder') {
        return { ...item, children: sortToDisplayOrder(item.children, false) }
      }
      return item
    })
  }

  const pinned = items
    .filter((i): i is SidebarConfigPage | SidebarConfigFolder => i.type !== 'divider' && isPinned(i))
    .sort((a, b) => ('order' in a ? a.order : 0) - ('order' in b ? b.order : 0))
  const dividers = items
    .filter((i): i is SidebarConfigDivider => i.type === 'divider')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const unpinned = items
    .filter((i): i is SidebarConfigPage | SidebarConfigFolder => i.type !== 'divider' && !isPinned(i))
    .sort((a, b) => getItemPath(a).localeCompare(getItemPath(b), undefined, { sensitivity: 'base' }))

  const result: SidebarConfigItem[] = [...pinned, ...dividers, ...unpinned]

  return result.map((item) => {
    if (item.type === 'folder') {
      return { ...item, children: sortToDisplayOrder(item.children, false) }
    }
    return item
  })
}

/** Whether this item can be reordered. At depth 0 (root) all items are custom-ordered; otherwise only pinned items and dividers. */
export function canReorder(item: SidebarConfigItem, depth = 1): boolean {
  if (depth === 0) return true
  if (item.type === 'divider') return true
  return isPinned(item)
}
