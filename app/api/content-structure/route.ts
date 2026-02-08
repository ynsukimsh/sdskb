import { NextResponse } from 'next/server'
import { fetchContentStructureFromGitHub } from '@/lib/github-content'

export const dynamic = 'force-dynamic'

/**
 * GET /api/content-structure
 * Returns the content folder structure from GitHub (categories and markdown files)
 * for the sidebar. Refreshing the page will reflect add/rename/delete in the repo.
 */
export async function GET() {
  try {
    const structure = await fetchContentStructureFromGitHub()
    return NextResponse.json({ structure })
  } catch (err) {
    console.error('content-structure API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch content structure' },
      { status: 500 }
    )
  }
}
