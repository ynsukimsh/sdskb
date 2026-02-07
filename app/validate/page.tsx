import fs from 'fs'
import path from 'path'
import * as yaml from 'js-yaml'
import matter from 'gray-matter'

export default function ValidatePage() {
  const schemasDir = path.join(process.cwd(), 'schemas')
  const contentDir = path.join(process.cwd(), 'content')
  
  // Load schemas
  const schemas = new Map()
  fs.readdirSync(schemasDir).forEach(file => {
    const content = fs.readFileSync(path.join(schemasDir, file), 'utf8')
    const schema: any = yaml.load(content)
    schemas.set(schema.name, schema)
  })
  
  // Validate content
  const issues: any[] = []
  const categories = fs.readdirSync(contentDir)
  
  categories.forEach(category => {
    const schema = schemas.get(category)
    if (!schema) return
    
    const categoryPath = path.join(contentDir, category)
    const files = fs.readdirSync(categoryPath)
    
    files.forEach(file => {
      const filePath = path.join(categoryPath, file)
      const fileContent = fs.readFileSync(filePath, 'utf8')
      const { data } = matter(fileContent)
      
      schema.fields.forEach((field: any) => {
        if (field.required && !data[field.name]) {
          issues.push({
            file: `${category}/${file}`,
            field: field.name,
            issue: 'Missing required field'
          })
        }
      })
    })
  })

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Validation Report</h1>
      
      {issues.length === 0 ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          ✅ All content validates successfully!
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            ⚠️ {issues.length} issue(s) found
          </div>
          
          {issues.map((issue, i) => (
            <div key={i} className="border rounded p-4">
              <p className="font-semibold">{issue.file}</p>
              <p className="text-sm text-red-600">
                {issue.issue}: <span className="font-mono">{issue.field}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
