'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useCallback, useEffect } from 'react'
import { mergeSidebarWithContent, sortToDisplayOrder, type SidebarConfigItem } from '@/lib/sidebar-order'

const SIDEBAR_DEFAULT_WIDTH_PX = 192
const SIDEBAR_MIN_WIDTH_PX = 160
const SIDEBAR_MAX_WIDTH_PX = 400

type SidebarConfigFolder = Extract<SidebarConfigItem, { type: 'folder' }>

function slugToLabel(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getLabel(path: string): string {
  const segment = path.split('/').pop() ?? path
  return slugToLabel(segment)
}

/** Right-pointing chevron; rotate 90deg when open for down. */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      aria-hidden
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type SidebarProps = {
  /** Initial width in px. Ignored after first user resize. */
  defaultWidthPx?: number
}

export default function Sidebar({ defaultWidthPx }: SidebarProps) {
  const pathname = usePathname()
  const [structure, setStructure] = useState<SidebarConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(() => new Set())
  const [widthPx, setWidthPx] = useState(defaultWidthPx ?? SIDEBAR_DEFAULT_WIDTH_PX)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!cancelled) {
        setLoading(true)
        setError(null)
      }
      try {
        const [contentRes, configRes] = await Promise.all([
          fetch('/api/content-structure', { cache: 'no-store' }),
          fetch('/api/sidebar-config', { cache: 'no-store' }),
        ])
        const contentData = await contentRes.json()
        const configData = await configRes.json()
        if (!contentRes.ok) {
          throw new Error(
            contentRes.status === 500 && contentData?.error ? contentData.error : contentRes.statusText
          )
        }
        if (!cancelled && Array.isArray(contentData.structure)) {
          const contentStructure = contentData.structure as SidebarConfigItem[]
          const configStructure = Array.isArray(configData.structure) ? configData.structure : []
          const merged = configStructure.length > 0
            ? mergeSidebarWithContent(contentStructure, configStructure as SidebarConfigItem[])
            : sortToDisplayOrder(contentStructure, true)
          setStructure(merged)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load sidebar')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const onContentSaved = () => load()
    const onSidebarConfigSaved = () => load()
    window.addEventListener('content-saved', onContentSaved)
    window.addEventListener('sidebar-config-saved', onSidebarConfigSaved)
    return () => {
      cancelled = true
      window.removeEventListener('content-saved', onContentSaved)
      window.removeEventListener('sidebar-config-saved', onSidebarConfigSaved)
    }
  }, [])

  const sortedStructure = structure.length > 0 ? sortToDisplayOrder(structure, true) : structure

  function collectFolderPaths(items: SidebarConfigItem[]): string[] {
    const paths: string[] = []
    for (const item of items) {
      if (item.type === 'folder' && item.path) {
        paths.push(item.path)
        paths.push(...collectFolderPaths(item.children))
      }
    }
    return paths
  }
  const allFolderPaths = collectFolderPaths(sortedStructure)
  const pathPrefix = pathname.startsWith('/content/') ? pathname.slice('/content/'.length) : ''
  const foldersToOpen = pathPrefix
    ? allFolderPaths.filter((p) => pathPrefix === p || pathPrefix.startsWith(p + '/'))
    : []
  const selectedFolderId =
    foldersToOpen.length > 0
      ? foldersToOpen.reduce((a, b) => (a.length >= b.length ? a : b), '')
      : null

  useEffect(() => {
    if (foldersToOpen.length > 0) {
      setOpenFolderIds(new Set(foldersToOpen))
    }
  }, [pathname])

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = widthPx
    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX
      setWidthPx((w) =>
        Math.min(SIDEBAR_MAX_WIDTH_PX, Math.max(SIDEBAR_MIN_WIDTH_PX, startWidth + delta))
      )
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [widthPx])

  function getParentPath(folderPath: string): string {
    return folderPath.includes('/') ? folderPath.replace(/\/[^/]+$/, '') : ''
  }

  function toggleFolder(folderPath: string) {
    setOpenFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(folderPath)) {
        next.delete(folderPath)
        return next
      }
      next.add(folderPath)
      let p = getParentPath(folderPath)
      while (p) {
        next.add(p)
        p = getParentPath(p)
      }
      const parent = getParentPath(folderPath)
      allFolderPaths.forEach((id) => {
        if (id !== folderPath && getParentPath(id) === parent) next.delete(id)
      })
      return next
    })
  }

  function renderItem(item: SidebarConfigItem, depth: number): React.ReactNode {
    if (item.type === 'divider') {
      return (
        <hr
          key={`divider-${depth}-${item.order ?? ''}`}
          className="my-2 border-gray-300"
          data-sidebar="divider"
        />
      )
    }
    if (item.type === 'page') {
      const href = `/content/${item.path}`
      const isPageSelected = pathname === href
      return (
        <Link
          key={item.path}
          href={href}
          data-sidebar="content-link"
          className={`block py-0.5 px-3 text-sm hover:bg-gray-200 rounded ${isPageSelected ? 'text-blue-500 font-medium' : ''}`}
        >
          {getLabel(item.path)}
        </Link>
      )
    }
    // folder
    const isFolderOpen = openFolderIds.has(item.path)
    const isSelected = selectedFolderId === item.path
    const folderLabelClass = isSelected
      ? 'font-medium text-black'
      : isFolderOpen
        ? 'font-bold text-black'
        : 'font-medium text-gray-700'
    const sortedChildren = sortToDisplayOrder(item.children)
    return (
      <div
        key={item.path}
        data-sidebar="folder-block"
        className={depth === 0 ? '' : 'mt-2'}
      >
        <button
          type="button"
          onClick={() => toggleFolder(item.path)}
          data-sidebar="folder-header"
          className={`flex w-full items-center gap-1 text-sm mb-0.5 py-0.5 px-0.5 rounded hover:bg-gray-300/80 ${folderLabelClass}`}
        >
          <span className="text-gray-500 select-none inline-flex shrink-0">
            <ChevronIcon open={isFolderOpen} />
          </span>
          <span>{getLabel(item.path)}</span>
        </button>
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: isFolderOpen ? '1fr' : '0fr' }}
        >
          <div
            data-sidebar="folder-contents"
            className="min-h-0 overflow-hidden pl-4"
          >
            {sortedChildren.map((child) => renderItem(child, depth + 1))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex shrink-0 relative"
      style={{ width: widthPx }}
    >
      <div className="w-full h-full bg-gray-100 overflow-auto">
        <div className="p-2.5 pt-20">
          <nav className="space-y-4">
            {loading && (
              <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
            )}
            {error && (
              <div className="px-3 py-2 text-sm text-red-600" role="alert">
                {error}
              </div>
            )}
            {!loading && !error && sortedStructure.map((item, index) => (
              <div
                key={item.type === 'divider' ? `divider-${index}` : (item as SidebarConfigFolder).path}
                className={index === 0 ? '' : 'mt-4'}
              >
                {renderItem(item, 0)}
              </div>
            ))}

            {/* Admin section (not from config) */}
            <div
              data-sidebar="admin-block"
              className="mt-6 pt-4 border-t border-gray-300"
            >
              <div className="font-semibold text-sm text-gray-600 mb-2">Admin</div>
              <Link
                href="/admin/sidebar"
                className="block py-2 px-3 text-sm hover:bg-gray-200 rounded"
              >
                Sidebar
              </Link>
              <Link
                href="/admin/trash"
                className="block py-2 px-3 text-sm hover:bg-gray-200 rounded"
              >
                Trash
              </Link>
              <Link
                href="/schemas"
                className="block py-2 px-3 text-sm hover:bg-gray-200 rounded"
              >
                Schemas
              </Link>
              <Link
                href="/validate"
                className="block py-2 px-3 text-sm hover:bg-gray-200 rounded"
              >
                Validation
              </Link>
            </div>
          </nav>
        </div>
      </div>
      <button
        type="button"
        aria-label="Resize sidebar"
        onMouseDown={startResize}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-gray-300 active:bg-gray-400"
      />
    </div>
  )
}
