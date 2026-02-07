import fs from 'fs'
import path from 'path'

const CONTENT_DIR = 'content'
const CATEGORY_ORDER = ['foundations', 'components', 'uipattern']
const CATEGORY_LABELS: Record<string, string> = {
  foundations: 'Foundation',
  components: 'Component',
  uipattern: 'UI Pattern',
}

function slugToLabel(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export type ContentNavSection = {
  category: string
  label: string
  files: { slug: string; label: string }[]
}

export function getContentNav(): ContentNavSection[] {
  const contentPath = path.join(process.cwd(), CONTENT_DIR)
  if (!fs.existsSync(contentPath)) return []

  const entries = fs.readdirSync(contentPath, { withFileTypes: true })
  const categoryDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  const result: ContentNavSection[] = []

  for (const category of CATEGORY_ORDER) {
    if (!categoryDirs.includes(category)) continue
    const categoryPath = path.join(contentPath, category)
    const files = fs.readdirSync(categoryPath)
    const mdFiles = files.filter((f) => f.endsWith('.md')).sort()
    const items = mdFiles.map((file) => {
      const slug = file.replace(/\.md$/, '')
      return { slug, label: slugToLabel(slug) }
    })
    result.push({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      files: items,
    })
  }

  return result
}
