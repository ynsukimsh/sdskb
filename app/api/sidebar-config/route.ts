import { NextResponse } from 'next/server'
import { getOctokit } from '@/lib/github-content'
import type { SidebarConfigItem } from '@/lib/sidebar-order'

const configPath = 'sidebar-config.json'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sidebar-config
 * Returns the current sidebar config from the repo (no cache).
 * Use this so the admin sidebar page always shows the latest config.
 */
export async function GET() {
  try {
    const octokit = await getOctokit()
    const owner = process.env.GITHUB_REPO_OWNER ?? process.env.GITHUB_OWNER ?? 'ynsukimsh'
    const repo = process.env.GITHUB_REPO_NAME ?? process.env.GITHUB_REPO ?? 'sdskb'

    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: configPath,
    })

    if (Array.isArray(data)) {
      return NextResponse.json(
        { error: 'sidebar-config.json is a directory' },
        { status: 500 }
      )
    }
    if (!('content' in data) || typeof data.content !== 'string') {
      return NextResponse.json(
        { error: 'File content missing or too large' },
        { status: 500 }
      )
    }

    const raw = Buffer.from(data.content, 'base64').toString('utf8')
    const parsed = JSON.parse(raw) as { structure?: unknown }
    if (!parsed || !Array.isArray(parsed.structure)) {
      return NextResponse.json(
        { error: 'Invalid sidebar config: expected { structure: [...] }' },
        { status: 500 }
      )
    }

    const structure = parsed.structure as SidebarConfigItem[]
    const headers = new Headers()
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

    return NextResponse.json({ structure }, { headers })
  } catch (err: unknown) {
    const status = err && typeof err === 'object' && 'status' in err
      ? (err as { status: number }).status
      : undefined
    if (status === 404) {
      return NextResponse.json(
        { structure: [], error: 'sidebar-config.json not found in repo' },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const message = err instanceof Error ? err.message : 'Failed to fetch sidebar config'
    console.error('sidebar-config API error:', err)
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
