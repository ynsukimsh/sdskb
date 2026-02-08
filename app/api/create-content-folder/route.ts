import { NextRequest, NextResponse } from 'next/server'
import { getOctokit } from '@/lib/github-content'
import { isValidSlug } from '@/lib/slugify'

export const dynamic = 'force-dynamic'

/**
 * POST /api/create-content-folder
 * Creates a new folder under content/ in the repo by adding a .gitkeep file.
 * Body: { folderPath: string } — path (e.g. "my-folder" or "foundation/my-subfolder").
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const raw = typeof body.folderPath === 'string' ? body.folderPath.trim() : ''
    const segments = raw.split('/').map((s: string) => s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')).filter(Boolean)
    const folderPath = segments.join('/')

    if (!folderPath) {
      return NextResponse.json(
        { success: false, error: 'Folder name is required (letters, numbers, hyphens only).' },
        { status: 400 }
      )
    }
    for (const seg of segments) {
      if (!isValidSlug(seg)) {
        return NextResponse.json(
          { success: false, error: 'Invalid folder path: use only lowercase letters, numbers, and hyphens.' },
          { status: 400 }
        )
      }
    }

    const contentPath = `content/${folderPath}/.gitkeep`
    const octokit = await getOctokit()
    const owner = process.env.GITHUB_REPO_OWNER ?? process.env.GITHUB_OWNER ?? 'ynsukimsh'
    const repo = process.env.GITHUB_REPO_NAME ?? process.env.GITHUB_REPO ?? 'sdskb'

    try {
      await octokit.repos.getContent({
        owner,
        repo,
        path: `content/${folderPath}`,
      })
      return NextResponse.json(
        { success: false, error: 'A folder with this name already exists.' },
        { status: 409 }
      )
    } catch (err: unknown) {
      const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : undefined
      if (status !== 404) {
        const message = err instanceof Error ? err.message : 'Failed to check existing folder'
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        )
      }
    }

    const contentBase64 = Buffer.from('', 'utf8').toString('base64')
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: contentPath,
      message: `Create folder: ${folderPath}`,
      content: contentBase64,
    })

    return NextResponse.json({
      success: true,
      path: folderPath,
      message: `Folder ${folderPath} created`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
