import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">SDS Knowledge Base</h1>
      
      <div className="space-y-4">
        <Link 
          href="/schemas" 
          className="block p-4 border rounded hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold">Schema Editor</h2>
          <p className="text-gray-600">Manage your content schemas</p>
        </Link>
        
        <Link 
          href="/content" 
          className="block p-4 border rounded hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold">Content Browser</h2>
          <p className="text-gray-600">View all documentation</p>
        </Link>
        
        <Link 
          href="/validate" 
          className="block p-4 border rounded hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold">Validation Dashboard</h2>
          <p className="text-gray-600">Check for schema mismatches</p>
        </Link>
      </div>
    </div>
  )
}