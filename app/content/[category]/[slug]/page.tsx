import matter from 'gray-matter'
import { notFound } from 'next/navigation'
import { ContentPageClient } from '@/components/ContentPageClient'
import { slugToLabel } from '@/lib/slug-to-label'
import { fetchContentFromGitHub } from '@/lib/github-content'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ category: string; slug: string }> }

export default async function ContentSlugPage({ params }: Props) {
  const { category, slug } = await params

  let raw: string
  try {
    raw = await fetchContentFromGitHub(category, slug)
  } catch (err: unknown) {
    const code = err instanceof Error && 'code' in err ? (err as Error & { code: string }).code : undefined
    const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : undefined
    if (code === 'CONTENT_NOT_FOUND' || status === 404) notFound()
    throw err
  }

  const { data, content } = matter(raw)
  const fileLabel = slugToLabel(slug)
  const initial = {
    name: (data?.name as string) ?? (data?.title as string) ?? fileLabel,
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
