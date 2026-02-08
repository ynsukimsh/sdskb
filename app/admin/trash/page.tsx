'use client'

import React, { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'

type TrashItem = { trashPath: string; originalPath: string }

export default function AdminTrashPage() {
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchTrash = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/trash')
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'err', text: data.error ?? 'Failed to load trash' })
        setItems([])
        return
      }
      setItems(data.items ?? [])
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Request failed' })
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrash()
  }, [fetchTrash])

  const restore = useCallback(async (trashPath: string) => {
    setRestoring(trashPath)
    setMessage(null)
    try {
      const res = await fetch('/api/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', trashPath }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'err', text: data.error ?? 'Failed to restore' })
        return
      }
      setMessage({ type: 'ok', text: `Restored to ${data.originalPath}` })
      await fetchTrash()
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setRestoring(null)
    }
  }, [fetchTrash])

  const deletePermanently = useCallback(async (trashPath: string) => {
    if (!window.confirm(`Permanently delete "${trashPath}"? This cannot be undone.`)) return
    setDeleting(trashPath)
    setMessage(null)
    try {
      const res = await fetch('/api/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', trashPath }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'err', text: data.error ?? 'Failed to delete' })
        return
      }
      setMessage({ type: 'ok', text: 'Permanently deleted.' })
      await fetchTrash()
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setDeleting(null)
    }
  }, [fetchTrash])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Trash</h1>
        <p className="text-sm text-gray-600 mb-4">
          Files removed from the sidebar are stored in{' '}
          <code className="bg-gray-200 px-1 rounded">content/trash</code>. Restore to put them back in
          content, or delete permanently.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <Link
            href="/admin/sidebar"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            ← Sidebar config
          </Link>
        </div>

        {message && (
          <p
            className={`mb-4 text-sm ${message.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}
          >
            {message.text}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">Trash is empty.</p>
            <p className="text-xs text-gray-400 mt-1">
              Items deleted from the sidebar appear here.
            </p>
          </div>
        ) : (
          <ul className="rounded border border-gray-200 bg-white divide-y divide-gray-200">
            {items.map((it) => (
              <li
                key={it.trashPath}
                className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 px-3 hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" title={it.trashPath}>
                    {it.trashPath.replace(/^content\/trash\//, '')}
                  </p>
                  <p className="text-xs text-gray-500 truncate" title={it.originalPath}>
                    Restore to: {it.originalPath.replace(/^content\//, '')}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => restore(it.trashPath)}
                    disabled={restoring !== null}
                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {restoring === it.trashPath ? 'Restoring…' : 'Restore'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePermanently(it.trashPath)}
                    disabled={deleting !== null}
                    className="rounded border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {deleting === it.trashPath ? 'Deleting…' : 'Delete permanently'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
