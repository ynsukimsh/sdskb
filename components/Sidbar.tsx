'use client'

import Link from 'next/link'
import { useState, useCallback } from 'react'
import type { ContentNavSection } from '@/lib/content-nav'

const SIDEBAR_DEFAULT_WIDTH_PX = 192
const SIDEBAR_MIN_WIDTH_PX = 160
const SIDEBAR_MAX_WIDTH_PX = 400

type SidebarProps = {
  nav: ContentNavSection[]
  /** Initial width in px. Ignored after first user resize. */
  defaultWidthPx?: number
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

export default function Sidebar({ nav, defaultWidthPx }: SidebarProps) {
  // Which top-level folders are expanded (e.g. "foundations", "components")
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(() => new Set())
  // Sidebar width in px; controllable via resize handle or defaultWidthPx
  const [widthPx, setWidthPx] = useState(defaultWidthPx ?? SIDEBAR_DEFAULT_WIDTH_PX)

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

  function toggleFolder(folderId: string) {
    setOpenFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  return (
    <div
      className="flex shrink-0 relative"
      style={{ width: widthPx }}
    >
      <div
        className="
          w-full
          h-full
          bg-gray-100
          overflow-auto
        "
      >
      <div
        className="
          p-2.5
          pt-20
        "
      >
        {/* space-y-8 = more gap between folder blocks */}
        <nav className="space-y-4">
          {/* Top-level folders (e.g. Foundation, Component, UI Pattern) */}
          {nav.map((folder) => {
            const isFolderOpen = openFolderIds.has(folder.category)
            return (
              <div
                key={folder.category}
                data-sidebar="folder-block"
                className={
                  folder.category === 'foundations'
                    ? ''
                    : 'mt-4'
                    
                }
              >
                {/* Folder header: click to expand/collapse */}
                <button
                  type="button"
                  onClick={() => toggleFolder(folder.category)}
                  data-sidebar="folder-header"
                  className="
                    flex
                    w-full
                    items-center
                    gap-1
                    font-semibold
                    text-sm
                    text-black
                    mb-0.5
                    py-0.5
                    px-0.5
                    rounded
                    hover:bg-gray-300/80
                  "
                >
                  <span
                    className="
                      text-gray-500
                      select-none
                      inline-flex
                      shrink-0
                    "
                  >
                    <ChevronIcon open={isFolderOpen} />
                  </span>
                  <span>{folder.label}</span>
                </button>
                {/* Contents under this folder (e.g. Color, Typography under Foundation) */}
                {isFolderOpen && (
                  <div
                    data-sidebar="folder-contents"
                    className="
                      pl-4
                    "
                  >
                    {folder.files.map((contentItem) => (
                      <Link
                        key={contentItem.slug}
                        href={`/content/${folder.category}/${contentItem.slug}`}
                        data-sidebar="content-link"
                        className="
                          block
                          py-0.5
                          px-3
                          text-sm
                          hover:bg-gray-200
                          rounded
                        "
                      >
                        {contentItem.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Admin section (not a content folder) */}
          <div
            data-sidebar="admin-block"
            className="
              mt-6
              pt-4
              border-t
            "
          >
            <div
              className="
                font-semibold
                text-sm
                text-gray-600
                mb-2
              "
            >
              Admin
            </div>
            <Link
              href="/schemas"
              className="
                block
                py-2
                px-3
                text-sm
                hover:bg-gray-200
                rounded
              "
            >
              Schemas
            </Link>
            <Link
              href="/validate"
              className="
                block
                py-2
                px-3
                text-sm
                hover:bg-gray-200
                rounded
              "
            >
              Validation
            </Link>
          </div>
        </nav>
      </div>
      </div>
      {/* Resize handle: drag to change sidebar width */}
      <button
        type="button"
        aria-label="Resize sidebar"
        onMouseDown={startResize}
        className="
          absolute
          right-0
          top-0
          bottom-0
          w-1.5
          cursor-col-resize
          hover:bg-gray-300
          active:bg-gray-400
        "
      />
    </div>
  )
}
