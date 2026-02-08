import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { notFound } from 'next/navigation'
import { ContentPageClient } from '@/components/ContentPageClient'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ category: string; slug: string }> }

export default async function ContentSlugPage({ params }: Props) {
  const { category, slug } = await params
  const filePath = path.join(process.cwd(), 'content', category, `${slug}.md`)
  if (!fs.existsSync(filePath)) notFound()

  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  const initial = {
    name: (data?.name as string) ?? (data?.title as string) ?? '',
    description: (data?.description as string) ?? '',
    figmaLink: (data?.figmaLink as string) ?? '',
    do: (data?.do as string) ?? '',
    dont: (data?.dont as string) ?? '',
    body: content?.trim() ?? '',
    heroImage: (data?.image as string) ?? '',
  }

  return (
    <ContentPageClient
      category={category}
      slug={slug}
      initial={initial}
    />
  )
}
