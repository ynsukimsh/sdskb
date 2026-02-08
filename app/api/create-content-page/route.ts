import { NextRequest, NextResponse } from 'next/server'
import { getOctokit } from '@/lib/github-content'
import { isValidSlug, nameToSlug } from '@/lib/slugify'

export const dynamic = 'force-dynamic'

/** Slug to display name: "my-page" -> "My Page" */
function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * POST /api/create-content-page
 * Creates a new markdown file under content/ with frontmatter (name, description, etc.).
 * Body: { path: string, name?: string }
 *   - path: "slug" (root) or "folder/slug"
 *   - name: optional display name for frontmatter (defaults to slug-to-title)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const pathInput = typeof body.path === 'string' ? body.path.trim() : ''
    const segments = pathInput.split('/').map((s: string) => s.trim()).filter(Boolean)
    if (segments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Path is required (e.g. "my-page" or "foundation/my-page").' },
        { status: 400 }
      )
    }
    const slug = segments[segments.length - 1] ?? ''
    const slugNormalized = nameToSlug(slug) || slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!isValidSlug(slugNormalized)) {
      return NextResponse.json(
        { success: false, error: 'Invalid page slug: use only lowercase letters, numbers, and hyphens.' },
        { status: 400 }
      )
    }
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]!.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      if (!isValidSlug(seg)) {
        return NextResponse.json(
          { success: false, error: `Invalid folder segment: ${segments[i]}` },
          { status: 400 }
        )
      }
    }

    const category = segments.length > 1 ? segments.slice(0, -1).join('/') : ''
    const contentPath = category ? `content/${category}/${slugNormalized}.md` : `content/${slugNormalized}.md`
    const displayName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : slugToTitle(slugNormalized)
    const nameYaml = displayName.includes(':') || displayName.includes('\n') || displayName.includes("'") ? `"${displayName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : displayName

    const frontmatter = `---
name: ${nameYaml}
description: ''
figmaLink: ''
do: ''
dont: ''
---
`

    const fullContent = `${frontmatter}\n\n`
    const contentBase64 = Buffer.from(fullContent, 'utf8').toString('base64')

    const octokit = await getOctokit()
    const owner = process.env.GITHUB_REPO_OWNER ?? process.env.GITHUB_OWNER ?? 'ynsukimsh'
    const repo = process.env.GITHUB_REPO_NAME ?? process.env.GITHUB_REPO ?? 'sdskb'

    try {
      await octokit.repos.getContent({
        owner,
        repo,
        path: contentPath,
      })
      const sidebarPath = category ? `${category}/${slugNormalized}` : slugNormalized
      return NextResponse.json(
        { success: false, error: `A page already exists at ${sidebarPath}.` },
        { status: 409 }
      )
    } catch (err: unknown) {
      const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : undefined
      if (status !== 404) {
        const message = err instanceof Error ? err.message : 'Failed to check existing file'
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        )
      }
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: contentPath,
      message: `Create page: ${category ? `${category}/` : ''}${slugNormalized}`,
      content: contentBase64,
    })

    const sidebarPath = category ? `${category}/${slugNormalized}` : slugNormalized
    return NextResponse.json({
      success: true,
      path: contentPath,
      sidebarPath,
      slug: slugNormalized,
      name: displayName,
      message: `Page ${sidebarPath} created`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
