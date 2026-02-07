import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import Link from 'next/link'

export default function ContentPage() {
  const contentDir = path.join(process.cwd(), 'content')
  const categories = fs.readdirSync(contentDir)
  
  const allContent = categories.flatMap(category => {
    const categoryPath = path.join(contentDir, category)
    const files = fs.readdirSync(categoryPath)
    
    return files.map(file => {
      const filePath = path.join(categoryPath, file)
      const fileContent = fs.readFileSync(filePath, 'utf8')
      const { data } = matter(fileContent)
      
      return {
        category,
        file: file.replace('.md', ''),
        data
      }
    })
  })

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Content</h1>
      
      <div className="space-y-6">
        {categories.map(category => (
          <div key={category}>
            <h2 className="text-2xl font-semibold mb-4 capitalize">{category}</h2>
            <div className="grid gap-4">
              {allContent
                .filter(item => item.category === category)
                .map(item => (
                  <div key={item.file} className="border rounded p-4">
                    <h3 className="text-lg font-semibold">{item.data.name}</h3>
                    <p className="text-sm text-gray-600">{item.data.description}</p>
                    {item.data.figmaLink && (
                      <a 
                        href={item.data.figmaLink} 
                        className="text-blue-500 text-sm"
                        target="_blank"
                      >
                        View in Figma →
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}