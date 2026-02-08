import matter from 'gray-matter'
import { notFound } from 'next/navigation'
import { ContentPageClient } from '@/components/ContentPageClient'
import { slugToLabel } from '@/lib/slug-to-label'
import { fetchContentFromGitHub } from '@/lib/github-content'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ path: string[] }> }

/**
 * Handles both root-level (e.g. /content/solid) and category (e.g. /content/foundation/color) content.
 * path = ['solid'] → content/solid.md; path = ['foundation', 'color'] → content/foundation/color.md
 * /content with no segments is handled by ../page.tsx
 */
export default async function ContentPage({ params }: Props) {
  const { path: pathSegments } = await params

  if (pathSegments.length !== 1 && pathSegments.length !== 2) {
    notFound()
  }

  const category = pathSegments.length === 2 ? pathSegments[0] : null
  const slug = pathSegments.length === 2 ? pathSegments[1]! : pathSegments[0]!

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
      category={category ?? ''}
      slug={slug}
      initial={initial}
    />
  )
}
