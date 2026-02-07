import Link from 'next/link'

export default function Sidebar() {
  return (
    <div className="w-64 border-r bg-green-200 overflow-auto">
      <div className="p-4">
        <nav className="space-y-2">
          {/* Foundation */}
          <div>
            <div className="font-semibold text-sm text-gray-600 mb-2">Foundation</div>
            <Link href="/content/foundation/color" className="block py-2 px-3 text-sm hover:bg-gray-200 rounded">
              Color
            </Link>
            <Link href="/content/foundation/typography" className="block py-2 px-3 text-sm hover:bg-gray-200 rounded">
              Typography
            </Link>
          </div>

          {/* Component */}
          <div className="mt-4">
            <div className="font-semibold text-sm text-gray-600 mb-2">Component</div>
            <Link href="/content/component/tab-bars-text" className="block py-2 px-3 text-sm hover:bg-gray-200 rounded">
              Tab Bars - Text
            </Link>
            <Link href="/content/component/tab-bars-chip" className="block py-2 px-3 text-sm hover:bg-gray-200 rounded">
              Tab Bars - Chip
            </Link>
            <Link href="/content/component/bottom-sheets" className="block py-2 px-3 text-sm hover:bg-gray-200 rounded">
              Bottom Sheets
            </Link>
          </div>

          {/* UI Pattern */}
          <div className="mt-4">
            <div className="font-semibold text-sm text-gray-600 mb-2">UI Pattern</div>
            <Link href="/content/uipattern/example-pattern" className="block py-2 px-3 text-sm hover:bg-gray-200 rounded">
              Example Pattern
            </Link>
          </div>

          {/* Admin */}
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