'use client'

import React, { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { flushSync } from 'react-dom'
import sidebarConfig from '@/sidebar-config.json'
import { sortToDisplayOrder, canReorder, isPinned, type SidebarConfigItem } from '@/lib/sidebar-order'

function getLabel(item: SidebarConfigItem): string {
  if (item.type === 'divider') return '— Divider —'
  const segment = item.path.split('/').pop() ?? item.path
  return segment
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function getMaxOrder(items: SidebarConfigItem[]): number {
  let max = 0
  for (const item of items) {
    if (item.type === 'divider') max = Math.max(max, item.order ?? 0)
    else if ('order' in item) max = Math.max(max, item.order)
    if (item.type === 'folder') max = Math.max(max, getMaxOrder(item.children))
  }
  return max
}

function normalizeOrders(items: SidebarConfigItem[]): SidebarConfigItem[] {
  let order = 1
  return items.map((item) => {
    if (item.type === 'divider') return { ...item, order: order++ }
    if (item.type === 'folder') {
      return { ...item, order: order++, children: normalizeOrders(item.children) }
    }
    return { ...item, order: order++ }
  })
}

function getArrayAtPath(structure: SidebarConfigItem[], path: number[]): SidebarConfigItem[] {
  if (path.length === 0) return structure
  let current: SidebarConfigItem[] = structure
  for (let i = 0; i < path.length - 1; i++) {
    const item = current[path[i]]
    if (item?.type !== 'folder') return current
    current = item.children
  }
  return current
}

function setArrayAtPath(
  structure: SidebarConfigItem[],
  path: number[],
  newArr: SidebarConfigItem[]
): SidebarConfigItem[] {
  if (path.length === 0) return normalizeOrders(newArr)
  const [idx, ...rest] = path
  const item = structure[idx]
  if (item?.type !== 'folder') return structure
  const next = [...structure]
  next[idx] = { ...item, children: setArrayAtPath(item.children, rest, newArr) }
  return next
}

const initialStructure = sortToDisplayOrder(
  (sidebarConfig as { structure: SidebarConfigItem[] }).structure,
  true
)

function pathEquals(a: number[] | null, b: number[]): boolean {
  if (!a || a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

function getItemAtPath(structure: SidebarConfigItem[], path: number[]): SidebarConfigItem | null {
  if (path.length === 0) return null
  let current: SidebarConfigItem[] = structure
  for (let i = 0; i < path.length - 1; i++) {
    const item = current[path[i]]
    if (item?.type !== 'folder') return null
    current = item.children
  }
  const item = current[path[path.length - 1]]
  return item ?? null
}

export default function AdminSidebarPage() {
  const [structure, setStructure] = useState<SidebarConfigItem[]>(initialStructure)
  const [openFolderPath, setOpenFolderPath] = useState<number[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const toggleFolder = useCallback((path: number[]) => {
    setOpenFolderPath((prev) => (pathEquals(prev, path) ? null : path))
  }, [])

  const getSiblingArray = useCallback(
    (path: number[]) => {
      if (path.length === 0) return structure
      const parentPath = path.slice(0, -1)
      return getArrayAtPath(structure, parentPath)
    },
    [structure]
  )

  const updateSiblingArray = useCallback(
    (path: number[], updater: (arr: SidebarConfigItem[]) => SidebarConfigItem[]) => {
      const parentPath = path.length === 0 ? [] : path.slice(0, -1)
      setStructure((prev) =>
        setArrayAtPath(prev, parentPath, updater(getArrayAtPath(prev, path)))
      )
    },
    []
  )

  const runWithTransition = useCallback((fn: () => void) => {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      ;(document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
        flushSync(fn)
      })
    } else {
      fn()
    }
  }, [])

  const [dragPath, setDragPath] = useState<number[] | null>(null)
  const [dropTarget, setDropTarget] = useState<{ pathPrefix: number[]; index: number } | null>(null)
  const dragPreviewRef = useRef<HTMLElement | null>(null)

  const moveByDrag = useCallback(
    (path: number[], dropIndex: number) => {
      const fromIdx = path[path.length - 1]
      if (fromIdx === dropIndex) return
      const finalToIdx = dropIndex > fromIdx ? dropIndex - 1 : dropIndex
      runWithTransition(() => {
        updateSiblingArray(path, (arr) => {
          const item = arr[fromIdx]
          const next = arr.filter((_, i) => i !== fromIdx)
          next.splice(finalToIdx, 0, item)
          return normalizeOrders(next)
        })
        setDragPath(null)
        setDropTarget(null)
      })
    },
    [updateSiblingArray, runWithTransition]
  )

  const removeFromStructure = useCallback(
    (path: number[]) => {
      updateSiblingArray(path, (arr) => {
        const idx = path[path.length - 1]
        return normalizeOrders(arr.filter((_, i) => i !== idx))
      })
    },
    [updateSiblingArray]
  )

  const deleteItem = useCallback(
    (path: number[]) => {
      const item = getItemAtPath(structure, path)
      if (!item) return
      if (item.type === 'folder' && item.children.length > 0) {
        window.alert('Folders should have no contents to be deleted.')
        return
      }
      if (!window.confirm('Remove this item from the sidebar?')) return
      removeFromStructure(path)
      setMessage({ type: 'ok', text: 'Removed from sidebar. Click Save to update config.' })
    },
    [structure, removeFromStructure]
  )

  const togglePin = useCallback((path: number[]) => {
    runWithTransition(() => {
      setStructure((prev) => {
        const clone = (items: SidebarConfigItem[], p: number[]): SidebarConfigItem[] => {
          if (p.length === 0) return items
          const [i, ...rest] = p
          const item = items[i]
          if (!item || item.type === 'divider') return items
          const next = [...items]
          if (rest.length === 0) {
            if ('pinned' in next[i]) next[i] = { ...next[i], pinned: !(next[i] as { pinned: boolean }).pinned }
            return next
          }
          if (item.type === 'folder') next[i] = { ...item, children: clone(item.children, rest) }
          return next
        }
        return sortToDisplayOrder(clone(prev, path), true)
      })
    })
  }, [runWithTransition])

  const insertDivider = useCallback(() => {
    const maxOrder = getMaxOrder(structure)
    setStructure((prev) => sortToDisplayOrder([...prev, { type: 'divider', order: maxOrder + 1 }], true))
  }, [structure])

  const createFolder = useCallback(() => {
    const name = window.prompt('Folder name (path segment):')
    if (!name?.trim()) return
    const path = name.trim().toLowerCase().replace(/\s+/g, '-')
    const maxOrder = getMaxOrder(structure)
    setStructure((prev) =>
      sortToDisplayOrder([...prev, { type: 'folder', path, order: maxOrder + 1, pinned: false, children: [] }], true)
    )
  }, [structure])

  const save = useCallback(async () => {
    setSaving(true)
    setMessage(null)
    try {
      const toSave = normalizeOrders(structure)
      const res = await fetch('/api/save-sidebar-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structure: toSave }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'err', text: data.error ?? 'Save failed' })
        return
      }
      setMessage({ type: 'ok', text: 'Saved to repo.' })
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setSaving(false)
    }
  }, [structure])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Sidebar config</h1>
        <p className="text-sm text-gray-600 mb-4">Edit order, pin, and structure. Save writes to GitHub.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          <Link
            href="/admin/trash"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Trash
          </Link>
          <button
            type="button"
            onClick={insertDivider}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Insert Divider
          </button>
          <button
            type="button"
            onClick={createFolder}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Create Folder
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {message && (
          <p
            className={`mb-4 text-sm ${message.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}
          >
            {message.text}
          </p>
        )}

        <ul className="rounded border border-gray-200 bg-white divide-y divide-gray-200">
          <ItemList
            items={structure}
            pathPrefix={[]}
            openFolderPath={openFolderPath}
            toggleFolder={toggleFolder}
            getSiblingArray={getSiblingArray}
            moveByDrag={moveByDrag}
            dragPath={dragPath}
            setDragPath={setDragPath}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
            dragPreviewRef={dragPreviewRef}
            draggedItem={dragPath ? getItemAtPath(structure, dragPath) : null}
            deleteItem={deleteItem}
            togglePin={togglePin}
          />
        </ul>
      </div>
    </div>
  )
}

function StarIcon({ pinned }: { pinned: boolean }) {
  const starPath = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path
        fill={pinned ? '#e6b422' : 'currentColor'}
        className={pinned ? '' : 'text-gray-400'}
        d={starPath}
      />
    </svg>
  )
}

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-gray-400" aria-hidden>
      <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
    </svg>
  )
}

const DRAG_HANDLE_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z"/></svg>'

function setDragPreview(
  e: React.DragEvent,
  label: string,
  previewRef: React.MutableRefObject<HTMLElement | null>
) {
  // Required for drag to work in Firefox and some other browsers
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', label)
  const el = document.createElement('div')
  el.setAttribute('role', 'presentation')
  el.style.cssText =
    'position:fixed;left:-9999px;top:0;display:flex;align-items:center;gap:8px;padding:8px 12px;background:#fff;border:2px solid #d1d5db;border-radius:6px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);width:max-content;max-width:280px;pointer-events:none;'
  const handle = document.createElement('span')
  handle.style.cssText = 'flex-shrink:0;color:#9ca3af;'
  handle.innerHTML = DRAG_HANDLE_SVG
  const text = document.createElement('span')
  text.style.cssText = 'font-size:14px;color:#111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
  text.textContent = label
  el.appendChild(handle)
  el.appendChild(text)
  document.body.appendChild(el)
  previewRef.current = el
  e.dataTransfer.setDragImage(el, 12, 16)
}


function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  )
}

function sameZone(a: SidebarConfigItem, b: SidebarConfigItem): boolean {
  if (a.type === 'divider' && b.type === 'divider') return true
  if (a.type !== 'divider' && b.type !== 'divider') return isPinned(a) === isPinned(b)
  return false
}

function pathPrefixEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/** Stable id for view-transition-name so reordered items animate smoothly */
function getItemTransitionName(item: SidebarConfigItem, pathPrefix: number[]): string {
  const prefix = pathPrefix.length ? pathPrefix.join('-') + '-' : ''
  if (item.type === 'divider') return prefix + 'div-' + ((item as { order?: number }).order ?? 0)
  return prefix + (item.path ?? 'item')
}

function ItemList({
  items,
  pathPrefix,
  openFolderPath,
  toggleFolder,
  getSiblingArray,
  moveByDrag,
  dragPath,
  setDragPath,
  dropTarget,
  setDropTarget,
  dragPreviewRef,
  draggedItem,
  deleteItem,
  togglePin,
}: {
  items: SidebarConfigItem[]
  pathPrefix: number[]
  openFolderPath: number[] | null
  toggleFolder: (path: number[]) => void
  getSiblingArray: (path: number[]) => SidebarConfigItem[]
  moveByDrag: (path: number[], dropIndex: number) => void
  dragPath: number[] | null
  setDragPath: (path: number[] | null) => void
  dropTarget: { pathPrefix: number[]; index: number } | null
  setDropTarget: (v: { pathPrefix: number[]; index: number } | null) => void
  dragPreviewRef: React.MutableRefObject<HTMLElement | null>
  draggedItem: SidebarConfigItem | null
  deleteItem: (path: number[]) => void
  togglePin: (path: number[]) => void
}) {
  const isDragging = (path: number[]) =>
    dragPath && path.length === dragPath.length && path.every((v, i) => v === dragPath[i])

  const showDropIndicatorHere = (index: number) =>
    dropTarget && pathPrefixEqual(dropTarget.pathPrefix, pathPrefix) && dropTarget.index === index

  const isSameListAsDragged = dragPath && pathPrefix.length === dragPath.length - 1 && pathPrefix.every((v, idx) => v === dragPath[idx])
  const canDropAtEnd = isSameListAsDragged && draggedItem && items.length > 0 && sameZone(draggedItem, items[items.length - 1])
  const showDropAtEnd = dropTarget && pathPrefixEqual(dropTarget.pathPrefix, pathPrefix) && dropTarget.index === items.length

  return (
    <>
      {items.map((item, i) => {
        const path = [...pathPrefix, i]
        const depth = pathPrefix.length
        const siblingArr = getSiblingArray(path)
        const showHandle = canReorder(item, depth)
        const canPin = item.type !== 'divider' && depth > 0
        const isFolderWithContents = item.type === 'folder' && item.children.length > 0
        const isFolderOpen = item.type === 'folder' && pathEquals(openFolderPath, path)
        const canDrop = showHandle && draggedItem && sameZone(draggedItem, item) && !isDragging(path)

        const handleDragOver = (e: React.DragEvent) => {
          if (canDrop) {
            e.preventDefault()
            setDropTarget({ pathPrefix, index: i })
          }
        }
        const handleDrop = () => {
          if (canDrop && dragPath) moveByDrag(dragPath, i)
        }
        const handleDragStart = (e: React.DragEvent) => {
          setDragPath(path)
          setDragPreview(e, getLabel(item), dragPreviewRef)
        }
        const handleDragEnd = () => {
          if (dragPreviewRef.current?.parentNode) {
            dragPreviewRef.current.remove()
            dragPreviewRef.current = null
          }
          setDragPath(null)
          setDropTarget(null)
        }

        const rowContent = (
          <>
            {showHandle ? (
              <span
                draggable
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                className="flex shrink-0 w-6 h-6 items-center justify-center cursor-grab active:cursor-grabbing rounded hover:bg-gray-200 touch-none"
                aria-label="Drag to reorder"
                title="Drag to reorder"
              >
                <DragHandleIcon />
              </span>
            ) : (
              <span className="w-6 shrink-0" aria-hidden />
            )}
            {item.type === 'folder' ? (
              <button
                type="button"
                onClick={() => toggleFolder(path)}
                className="flex shrink-0 w-6 h-6 items-center justify-center text-gray-500 hover:bg-gray-200 rounded"
                aria-expanded={isFolderOpen}
                aria-label={isFolderOpen ? 'Collapse folder' : 'Expand folder'}
              >
                <span
                  className={`inline-block transition-transform duration-200 ${isFolderOpen ? 'rotate-90' : ''}`}
                  aria-hidden
                >
                  ▶
                </span>
              </button>
            ) : (
              <span className="w-6 shrink-0" aria-hidden />
            )}
            <span
              className="flex-1 min-w-0 text-sm text-gray-900 truncate"
              style={{ paddingLeft: pathPrefix.length * 12 }}
            >
              {item.type === 'folder' && (
                <span className="text-gray-500 mr-1" aria-hidden>📁</span>
              )}
              {getLabel(item)}
              {item.type !== 'divider' && (
                <span className="text-gray-400 font-normal ml-1">({item.path})</span>
              )}
            </span>
            {canPin && (
              <button
                type="button"
                onClick={() => togglePin(path)}
                title={(item as { pinned?: boolean }).pinned ? 'Unpin' : 'Pin'}
                className="rounded p-1.5 text-gray-600 hover:bg-gray-100 inline-flex items-center justify-center"
                aria-label={(item as { pinned?: boolean }).pinned ? 'Unpin' : 'Pin'}
              >
                <StarIcon pinned={!!(item as { pinned?: boolean }).pinned} />
              </button>
            )}
            <button
              type="button"
              onClick={() => deleteItem(path)}
              className={`rounded p-1.5 inline-flex items-center justify-center ${isFolderWithContents ? 'text-red-300 opacity-60' : 'text-red-600 hover:bg-red-50'}`}
              aria-label="Remove from sidebar"
              title={isFolderWithContents ? 'Folders should have no contents to be deleted' : 'Remove from sidebar'}
            >
              <TrashIcon />
            </button>
          </>
        )

        return (
          <React.Fragment key={path.join('-')}>
            {showDropIndicatorHere(i) && (
              <li className="list-none py-0.5" aria-hidden>
                <div
                  className="h-[2px] rounded-full bg-blue-500 flex-shrink-0"
                  style={{ marginLeft: 8 + pathPrefix.length * 12, marginRight: 8 }}
                />
              </li>
            )}
            {item.type === 'folder' ? (
              <li
                className={isDragging(path) ? 'opacity-25 bg-gray-200' : ''}
                style={{ viewTransitionName: isDragging(path) ? 'none' : `vt-${getItemTransitionName(item, pathPrefix)}` }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div
                  className={`flex items-center gap-2 py-2 px-3 ${isFolderOpen ? 'bg-green-50 rounded-t-lg' : 'hover:bg-gray-50'}`}
                >
                  {rowContent}
                </div>
                <div
                  className="grid transition-[grid-template-rows] duration-200 ease-out"
                  style={{ gridTemplateRows: isFolderOpen ? '1fr' : '0fr' }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <ul className="divide-y divide-gray-200 border-l border-gray-200 ml-4 mr-3 px-3 py-2 bg-green-50 rounded-b-lg overflow-hidden mb-3">
                      <ItemList
                        items={item.children}
                        pathPrefix={path}
                        openFolderPath={openFolderPath}
                        toggleFolder={toggleFolder}
                        getSiblingArray={getSiblingArray}
                        moveByDrag={moveByDrag}
                        dragPath={dragPath}
                        setDragPath={setDragPath}
                        dropTarget={dropTarget}
                        setDropTarget={setDropTarget}
                        dragPreviewRef={dragPreviewRef}
                        draggedItem={draggedItem}
                        deleteItem={deleteItem}
                        togglePin={togglePin}
                      />
                    </ul>
                  </div>
                </div>
              </li>
            ) : (
              <li
                className={`flex items-center gap-2 py-2 px-3 ${isDragging(path) ? 'opacity-25 bg-gray-200' : pathPrefix.length > 0 ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'}`}
                style={{ viewTransitionName: isDragging(path) ? 'none' : `vt-${getItemTransitionName(item, pathPrefix)}` }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {rowContent}
              </li>
            )}
          </React.Fragment>
        )
      })}
      {showDropAtEnd && (
        <li className="list-none py-0.5" aria-hidden>
          <div
            className="h-[2px] rounded-full bg-blue-500 flex-shrink-0"
            style={{ marginLeft: 8 + pathPrefix.length * 12, marginRight: 8 }}
          />
        </li>
      )}
      {canDropAtEnd && (
        <li
          className="min-h-[20px] list-none -my-1"
          onDragOver={(e) => {
            e.preventDefault()
            setDropTarget({ pathPrefix, index: items.length })
          }}
          onDrop={() => {
            if (dragPath) moveByDrag(dragPath, items.length)
          }}
          aria-hidden
        />
      )}
    </>
  )
}
