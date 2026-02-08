import React from 'react'
import Link from 'next/link'

export default function AdminTrashPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Trash</h1>
        <p className="text-sm text-gray-600 mb-4">
          Trash is a placeholder for removed content. Restore and permanent delete are not available
          in this version.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <Link
            href="/admin/sidebar"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            ← Sidebar config
          </Link>
        </div>

        <div className="rounded border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">Trash is empty.</p>
          <p className="text-xs text-gray-400 mt-1">
            Items removed from the sidebar would appear here when trash is enabled.
          </p>
        </div>
      </div>
    </div>
  )
}
