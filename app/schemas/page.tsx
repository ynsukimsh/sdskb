import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

export default function SchemasPage() {
  const schemasDir = path.join(process.cwd(), 'schemas')
  const schemaFiles = fs.readdirSync(schemasDir)
  
  const schemas = schemaFiles.map(file => {
    const content = fs.readFileSync(path.join(schemasDir, file), 'utf8')
    const schema = yaml.load(content)
    return { file, schema }
  })

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Schemas</h1>
      
      <div className="space-y-6">
        {schemas.map(({ file, schema }: any) => (
          <div key={file} className="border rounded p-4">
            <h2 className="text-xl font-semibold mb-2">{schema.name}</h2>
            <p className="text-sm text-gray-500 mb-4">Version: {schema.version}</p>
            
            <div className="space-y-2">
              <h3 className="font-semibold">Fields:</h3>
              {schema.fields.map((field: any) => (
                <div key={field.name} className="pl-4 text-sm">
                  <span className="font-mono">{field.name}</span>
                  <span className="text-gray-500"> ({field.type})</span>
                  {field.required && <span className="text-red-500"> *required</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
