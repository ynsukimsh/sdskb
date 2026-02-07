import Link from 'next/link'

export default function TopBar() {
  return (
    <div className="h-16 border-b flex items-center justify-between px-6 bg-blue-200">
      <Link href="/" className="text-xl font-bold hover:text-red-600">
        SDS KB Lets goooo
      </Link>
      
      <button className="px-4 py-2 border rounded hover:bg-gray-50">
        Login with Google
      </button>
    </div>
  )
}