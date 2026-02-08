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

/** Collect all page and folder paths from a structure (recurses into nested folders). */
export function getValidPathsFromContentStructure(items: SidebarConfigItem[]): Set<string> {
  const paths = new Set<string>()
  function walk(list: SidebarConfigItem[]) {
    for (const item of list) {
      if (item.type === 'divider') continue
      if (item.type === 'page' && item.path) paths.add(item.path)
      else if (item.type === 'folder' && item.path) {
        paths.add(item.path)
        walk(item.children ?? [])
      }
    }
  }
  walk(items)
  return paths
}

/** Remove config entries whose paths don't exist in content (recurses into nested folders). */
export function filterConfigToExisting(
  config: SidebarConfigItem[],
  validPaths: Set<string>
): SidebarConfigItem[] {
  const result: SidebarConfigItem[] = []
  for (const item of config) {
    if (item.type === 'divider') result.push(item)
    else if (item.type === 'page' && item.path && validPaths.has(item.path)) result.push(item)
    else if (item.type === 'folder' && item.path && validPaths.has(item.path)) {
      const children = (item.children ?? [])
        .filter(
          (c) =>
            (c.type === 'page' && !!c.path && validPaths.has(c.path)) ||
            (c.type === 'folder' && !!c.path && validPaths.has(c.path))
        )
        .map((c) => (c.type === 'folder' ? { ...c, children: filterConfigToExisting(c.children ?? [], validPaths) } : c))
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
 * Recursively merge config list with content list so that:
 * - Config provides order/pins for items that exist in both.
 * - Every page/folder from content is included (content-only items are appended with default order).
 * - Folder children are merged recursively so nested folders from content appear even when parent exists in config.
 */
function mergeChildrenLists(
  configList: SidebarConfigItem[],
  contentList: SidebarConfigItem[],
  maxOrderRef: { current: number }
): SidebarConfigItem[] {
  const contentByPath = new Map<string, SidebarConfigItem>()
  for (const item of contentList) {
    if (item.type !== 'divider' && item.path) contentByPath.set(item.path, item)
  }
  const result: SidebarConfigItem[] = []
  for (const configItem of configList) {
    if (configItem.type === 'divider') {
      result.push(configItem)
    } else if (configItem.type === 'page') {
      result.push(configItem)
    } else if (configItem.type === 'folder' && configItem.path) {
      const contentFolder = contentByPath.get(configItem.path)
      const children =
        contentFolder?.type === 'folder'
          ? mergeChildrenLists(configItem.children ?? [], contentFolder.children ?? [], maxOrderRef)
          : configItem.children ?? []
      result.push({ ...configItem, children })
    }
  }
  for (const contentItem of contentList) {
    if (contentItem.type === 'divider') continue
    if (!contentItem.path) continue
    if (result.some((r) => r.type !== 'divider' && r.path === contentItem.path)) continue
    if (contentItem.type === 'page') {
      result.push({ ...contentItem, order: ++maxOrderRef.current, pinned: false })
    } else if (contentItem.type === 'folder') {
      result.push({
        ...contentItem,
        order: ++maxOrderRef.current,
        pinned: false,
        children: mergeChildrenLists([], contentItem.children ?? [], maxOrderRef),
      })
    }
  }
  return result
}

/**
 * Merge sidebar config with content structure for display.
 * - Uses config for order, dividers, pins, and folder grouping.
 * - Only includes items that exist in content.
 * - Content-only items (including nested folders) are merged in so everything from the repo appears.
 */
export function mergeSidebarWithContent(
  contentStructure: SidebarConfigItem[],
  configStructure: SidebarConfigItem[]
): SidebarConfigItem[] {
  const validPaths = getValidPathsFromContentStructure(contentStructure)
  const filteredConfig = filterConfigToExisting(configStructure, validPaths)
  const maxOrderRef = { current: getMaxOrderInStructure(filteredConfig) }
  const merged = mergeChildrenLists(filteredConfig, contentStructure, maxOrderRef)
  return sortToDisplayOrder(merged, true)
}
