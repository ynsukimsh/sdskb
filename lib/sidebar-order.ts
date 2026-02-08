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

function getOrder(item: SidebarConfigItem | undefined): number {
  if (item == null) return 0
  return 'order' in item ? (item.order ?? 0) : 0
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
    const byOrder = [...items].sort((a, b) => getOrder(a) - getOrder(b))
    return byOrder.map((item) => {
      if (item.type === 'folder') {
        return { ...item, children: sortToDisplayOrder(item.children, false) }
      }
      return item
    })
  }

  const pinned = items
    .filter((i): i is SidebarConfigPage | SidebarConfigFolder => i.type !== 'divider' && isPinned(i))
    .sort((a, b) => getOrder(a) - getOrder(b))
  const dividers = items
    .filter((i): i is SidebarConfigDivider => i.type === 'divider')
    .sort((a, b) => ((a?.order) ?? 0) - ((b?.order) ?? 0))
  const unpinned = items
    .filter((i): i is SidebarConfigPage | SidebarConfigFolder => i.type !== 'divider' && !isPinned(i))
    .sort((a, b) => (a == null || b == null ? 0 : getItemPath(a).localeCompare(getItemPath(b), undefined, { sensitivity: 'base' })))

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

/** Collect all page and folder paths from a structure (for "what exists" or "what is in config"). */
export function getValidPathsFromContentStructure(items: SidebarConfigItem[]): Set<string> {
  const paths = new Set<string>()
  for (const item of items) {
    if (item.type === 'divider') continue
    if (item.type === 'page' && item.path) paths.add(item.path)
    else if (item.type === 'folder' && item.path) {
      paths.add(item.path)
      for (const child of item.children ?? []) {
        if (child.type === 'page' && child.path) paths.add(child.path)
      }
    }
  }
  return paths
}

/** Remove config entries whose paths don't exist in content (e.g. deleted files). */
export function filterConfigToExisting(
  config: SidebarConfigItem[],
  validPaths: Set<string>
): SidebarConfigItem[] {
  const result: SidebarConfigItem[] = []
  for (const item of config) {
    if (item.type === 'divider') result.push(item)
    else if (item.type === 'page' && item.path && validPaths.has(item.path)) result.push(item)
    else if (item.type === 'folder' && item.path && validPaths.has(item.path)) {
      const children = (item.children ?? []).filter(
        (c) => c.type === 'page' && !!c.path && validPaths.has(c.path)
      )
      result.push({ ...item, children })
    }
  }
  return result
}

/** Get max order value in a structure (for appending new items). */
function getMaxOrderInStructure(items: SidebarConfigItem[]): number {
  let max = 0
  for (const item of items) {
    if (item.type === 'divider') max = Math.max(max, (item as SidebarConfigDivider).order ?? 0)
    else if ('order' in item) max = Math.max(max, item.order)
    if (item.type === 'folder') max = Math.max(max, getMaxOrderInStructure(item.children))
  }
  return max
}

/**
 * Merge sidebar config with content structure for display.
 * - Uses config for order, dividers, pins, and folder grouping.
 * - Only includes items that exist in content.
 * - Appends any content items (pages/folders) that are not in config so new repo content appears.
 */
export function mergeSidebarWithContent(
  contentStructure: SidebarConfigItem[],
  configStructure: SidebarConfigItem[]
): SidebarConfigItem[] {
  const validPaths = getValidPathsFromContentStructure(contentStructure)
  const filteredConfig = filterConfigToExisting(configStructure, validPaths)
  const pathsInConfig = getValidPathsFromContentStructure(filteredConfig)
  let maxOrder = getMaxOrderInStructure(filteredConfig)

  const appended: SidebarConfigItem[] = []
  for (const item of contentStructure) {
    if (item.type === 'divider') continue
    if (item.type === 'page' && item.path && !pathsInConfig.has(item.path)) {
      pathsInConfig.add(item.path)
      appended.push({ type: 'page', path: item.path, order: ++maxOrder, pinned: false })
    } else if (item.type === 'folder' && item.path && !pathsInConfig.has(item.path)) {
      pathsInConfig.add(item.path)
      const children = (item.children ?? []).map((c, i) =>
        c.type === 'page' && c.path
          ? { type: 'page' as const, path: c.path, order: i + 1, pinned: false }
          : c
      )
      appended.push({
        type: 'folder',
        path: item.path,
        order: ++maxOrder,
        pinned: false,
        children,
      })
    }
  }

  const merged = [...filteredConfig, ...appended]
  return sortToDisplayOrder(merged, true)
}
