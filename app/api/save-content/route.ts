import { NextRequest, NextResponse } from 'next/server'
import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import { nameToSlug, isValidSlug } from '@/lib/slugify'

const appId = process.env.GITHUB_APP_ID
const privateKey = process.env.GITHUB_PRIVATE_KEY
const installationId = process.env.GITHUB_INSTALLATION_ID
const owner = process.env.GITHUB_REPO_OWNER ?? 'ynsukimsh'
const repo = process.env.GITHUB_REPO_NAME ?? 'sdskb'
const sidebarConfigPath = 'sidebar-config.json'

async function getOctokit(): Promise<Octokit> {
  if (!appId || !privateKey || !installationId) {
    throw new Error(
      'Missing GitHub App env: GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID'
    )
  }
  const auth = createAppAuth({
    appId,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  })
  const installationAuth = await auth({
    type: 'installation',
    installationId: Number(installationId),
  })
  const token = installationAuth.token
  if (!token) throw new Error('Failed to get installation token')
  return new Octokit({ auth: token })
}

type SidebarItem = { type: string; path?: string; children?: SidebarItem[] }

function replacePathInSidebarStructure(
  structure: SidebarItem[],
  oldPath: string,
  newPath: string
): SidebarItem[] {
  return structure.map((item) => {
    const next = { ...item }
    if (next.path === oldPath) {
      next.path = newPath
    }
    if (Array.isArray(next.children)) {
      next.children = replacePathInSidebarStructure(next.children, oldPath, newPath)
    }
    return next
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { category, slug, content, name } = body

    if (!category || typeof category !== 'string' || !slug || typeof slug !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid category or slug' },
        { status: 400 }
      )
    }
    if (content === undefined || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid content' },
        { status: 400 }
      )
    }

    const octokit = await getOctokit()
    const contentBase64 = Buffer.from(content, 'utf8').toString('base64')

    // If name is provided and differs from current slug, rename file
    const newSlug =
      name != null && String(name).trim() !== ''
        ? nameToSlug(String(name))
        : slug

    if (newSlug !== slug) {
      if (!isValidSlug(newSlug)) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Invalid name: use only letters, numbers, and spaces (spaces become hyphens).',
          },
          { status: 400 }
        )
      }

      const oldPath = `content/${category}/${slug}.md`
      const newPath = `content/${category}/${newSlug}.md`

      // Check if new filename already exists
      try {
        await octokit.repos.getContent({
          owner,
          repo,
          path: newPath,
        })
        return NextResponse.json(
          { success: false, error: 'A page with this name already exists.' },
          { status: 409 }
        )
      } catch (err: unknown) {
        const status =
          (err && typeof err === 'object' && 'status' in err
            ? (err as { status: number }).status
            : undefined) ??
          (err && typeof err === 'object' && 'response' in err && (err as { response?: { status?: number } }).response
            ? (err as { response: { status?: number } }).response.status
            : undefined)
        if (status !== 404) {
          const message = err instanceof Error ? err.message : 'Failed to check existing file'
          return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
          )
        }
      }

      // Get old file sha for delete
      let oldSha: string | undefined
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: oldPath,
        })
        if (!Array.isArray(data) && 'sha' in data) {
          oldSha = data.sha
        }
      } catch {
        return NextResponse.json(
          { success: false, error: 'Current file not found in repository.' },
          { status: 404 }
        )
      }

      // Create new file
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: newPath,
        message: `Rename ${slug} to ${newSlug}`,
        content: contentBase64,
      })

      // Delete old file
      if (oldSha) {
        await octokit.repos.deleteFile({
          owner,
          repo,
          path: oldPath,
          message: `Remove old file after rename to ${newSlug}`,
          sha: oldSha,
        })
      }

      // Update sidebar config: replace old path with new path
      const oldSidebarPath = `${category}/${slug}`
      const newSidebarPath = `${category}/${newSlug}`

      let sidebarSha: string | undefined
      let sidebarJson: { structure?: SidebarItem[] }
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: sidebarConfigPath,
        })
        if (Array.isArray(data) || !('content' in data)) {
          return NextResponse.json({
            success: true,
            path: newPath,
            newSlug,
            renamed: true,
          })
        }
        sidebarSha = data.sha
        const decoded = Buffer.from(data.content, 'base64').toString('utf8')
        sidebarJson = JSON.parse(decoded) as { structure?: SidebarItem[] }
      } catch {
        // No sidebar config or invalid; still return success for rename
        return NextResponse.json({
          success: true,
          path: newPath,
          newSlug,
          renamed: true,
        })
      }

      if (Array.isArray(sidebarJson.structure)) {
        const updatedStructure = replacePathInSidebarStructure(
          sidebarJson.structure,
          oldSidebarPath,
          newSidebarPath
        )
        const sidebarContent = JSON.stringify(
          { ...sidebarJson, structure: updatedStructure },
          null,
          2
        )
        const sidebarBase64 = Buffer.from(sidebarContent, 'utf8').toString('base64')
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: sidebarConfigPath,
          message: `Update sidebar: rename ${oldSidebarPath} to ${newSidebarPath}`,
          content: sidebarBase64,
          ...(sidebarSha && { sha: sidebarSha }),
        })
      }

      return NextResponse.json({
        success: true,
        path: newPath,
        newSlug,
        renamed: true,
      })
    }

    // Normal update in place
    const path = `content/${category}/${slug}.md`
    const message = `Update ${slug}`

    let sha: string | undefined
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      })
      if (!Array.isArray(data) && 'sha' in data) {
        sha = data.sha
      }
    } catch {
      // File may not exist yet; create new file (no sha)
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: contentBase64,
      ...(sha && { sha }),
    })

    return NextResponse.json({
      success: true,
      path,
      message,
      renamed: false,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
