'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ContentNavSection } from '@/lib/content-nav'

type SidebarProps = { nav: ContentNavSection[] }

export default function Sidebar({ nav }: SidebarProps) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set(nav.map((s) => s.category)))

  function toggle(category: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  return (
    <div className="w-64 border-r bg-green-200 overflow-auto">
      <div className="p-4">
        <nav className="space-y-2">
          {nav.map((section) => {
            const isOpen = openCategories.has(section.category)
            return (
              <div key={section.category} className={section.category === 'foundations' ? '' : 'mt-4'}>
                <button
                  type="button"
                  onClick={() => toggle(section.category)}
                  className="flex w-full items-center justify-between font-semibold text-sm text-gray-600 mb-2 py-1 px-2 rounded hover:bg-gray-300/80"
                >
                  <span>{section.label}</span>
                  <span className="text-gray-500 select-none" aria-hidden>
                    {isOpen ? '▼' : '▶'}
                  </span>
                </button>
                {isOpen && (
                  <div className="pl-1">
                    {section.files.map((file) => (
                      <Link
                        key={file.slug}
                        href={`/content/${section.category}/${file.slug}`}
                        className="block py-2 px-3 text-sm hover:bg-gray-200 rounded"
                      >
                        {file.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div className="mt-6 pt-4 border-t">
            <div className="font-semibold text-sm text-gray-600 mb-2">Admin</div>
            <Link href="/schemas" className="block py-2 px-3 text-sm hover:bg-gray-200 rounded">
              Schemas
            </Link>
            <Link href="/validate" className="block py-2 px-3 text-sm hover:bg-gray-200 rounded">
              Validation
            </Link>
          </div>
        </nav>
      </div>
    </div>
  )
}
