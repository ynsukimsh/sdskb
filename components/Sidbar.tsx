'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useCallback, useEffect } from 'react'
import sidebarConfig from '@/sidebar-config.json'

const SIDEBAR_DEFAULT_WIDTH_PX = 192
const SIDEBAR_MIN_WIDTH_PX = 160
const SIDEBAR_MAX_WIDTH_PX = 400

type SidebarConfigPage = { type: 'page'; path: string; order: number; pinned: boolean }
type SidebarConfigFolder = {
  type: 'folder'
  path: string
  order: number
  pinned: boolean
  children: SidebarConfigItem[]
}
type SidebarConfigDivider = { type: 'divider'; order?: number }
type SidebarConfigItem = SidebarConfigPage | SidebarConfigFolder | SidebarConfigDivider

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

function sortItems(items: SidebarConfigItem[]): SidebarConfigItem[] {
  return [...items].sort((a, b) => {
    if (a.type === 'divider' && b.type === 'divider') return (a.order ?? 0) - (b.order ?? 0)
    if (a.type === 'divider') return 1
    if (b.type === 'divider') return -1
    const aPinned = 'pinned' in a && a.pinned ? 1 : 0
    const bPinned = 'pinned' in b && b.pinned ? 1 : 0
    if (bPinned !== aPinned) return bPinned - aPinned
    return ('order' in a ? a.order : 0) - ('order' in b ? b.order : 0)
  })
}

function sortFolderChildren(children: SidebarConfigItem[]): SidebarConfigItem[] {
  return sortItems(children)
}

const sortedStructure = sortItems(sidebarConfig.structure as SidebarConfigItem[])

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
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(() => new Set())
  const [widthPx, setWidthPx] = useState(defaultWidthPx ?? SIDEBAR_DEFAULT_WIDTH_PX)

  const selectedFolderId = sortedStructure.some(
    (item) => item.type === 'folder' && pathname.startsWith(`/content/${item.path}`)
  )
    ? (sortedStructure.find(
        (item) => item.type === 'folder' && pathname.startsWith(`/content/${item.path}`)
      ) as SidebarConfigFolder | undefined)?.path ?? null
    : null

  useEffect(() => {
    if (selectedFolderId) {
      setOpenFolderIds(new Set([selectedFolderId]))
    }
  }, [selectedFolderId])

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

  function toggleFolder(folderPath: string) {
    setOpenFolderIds((prev) => {
      if (prev.has(folderPath)) {
        const next = new Set(prev)
        next.delete(folderPath)
        return next
      }
      return new Set([folderPath])
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
    const sortedChildren = sortFolderChildren(item.children)
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
            {sortedStructure.map((item, index) => (
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
