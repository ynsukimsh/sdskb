import { NextRequest, NextResponse } from 'next/server'
import { getOctokit } from '@/lib/github-content'
import { isValidSlug } from '@/lib/slugify'

export const dynamic = 'force-dynamic'

const owner = process.env.GITHUB_REPO_OWNER ?? process.env.GITHUB_OWNER ?? 'ynsukimsh'
const repo = process.env.GITHUB_REPO_NAME ?? process.env.GITHUB_REPO ?? 'sdskb'
const configPath = 'sidebar-config.json'

type SidebarItem = { type: string; path?: string; order?: number; pinned?: boolean; children?: SidebarItem[] }

/** Replace folder path and all child paths in sidebar structure. */
function replaceFolderPathInSidebarStructure(
  structure: SidebarItem[],
  oldPath: string,
  newPath: string
): SidebarItem[] {
  return structure.map((item) => {
    const next = { ...item }
    if (next.path === oldPath) {
      next.path = newPath
    } else if (next.path?.startsWith(oldPath + '/')) {
      next.path = newPath + next.path.slice(oldPath.length)
    }
    if (Array.isArray(next.children)) {
      next.children = replaceFolderPathInSidebarStructure(next.children, oldPath, newPath)
    }
    return next
  })
}

type DirEntry = { name: string; path: string; sha: string; type: string }

async function listContentDir(
  octokit: Awaited<ReturnType<typeof getOctokit>>,
  contentDir: string
): Promise<DirEntry[]> {
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path: contentDir,
  })
  if (!Array.isArray(data)) {
    throw new Error('Path is not a directory.')
  }
  return data.map((e: { name: string; path?: string; sha?: string; type?: string }) => ({
    name: e.name,
    path: e.path ?? `${contentDir}/${e.name}`,
    sha: e.sha ?? '',
    type: e.type ?? 'file',
  }))
}

/**
 * POST /api/rename-content-folder
 * Renames a content folder in the repo (moves all files) and updates sidebar-config.json.
 * Body: { oldPath: string, newPath: string } — e.g. oldPath: "foundation", newPath: "foundations"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const oldPath = typeof body.oldPath === 'string' ? body.oldPath.trim() : ''
    const newPathRaw = typeof body.newPath === 'string' ? body.newPath.trim() : ''
    const newPath = newPathRaw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')

    if (!oldPath || !newPath) {
      return NextResponse.json(
        { success: false, error: 'oldPath and newPath are required.' },
        { status: 400 }
      )
    }
    if (newPath === oldPath) {
      return NextResponse.json(
        { success: false, error: 'New path is the same as current path.' },
        { status: 400 }
      )
    }
    if (!isValidSlug(newPath)) {
      return NextResponse.json(
        { success: false, error: 'Invalid new folder name: use only lowercase letters, numbers, and hyphens.' },
        { status: 400 }
      )
    }

    const octokit = await getOctokit()
    const contentDir = `content/${oldPath}`

    let entries: DirEntry[]
    try {
      entries = await listContentDir(octokit, contentDir)
    } catch (err: unknown) {
      const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : undefined
      if (status === 404) {
        return NextResponse.json(
          { success: false, error: 'Folder not found in repository.' },
          { status: 404 }
        )
      }
      if (err instanceof Error && err.message === 'Path is not a directory.') {
        return NextResponse.json(
          { success: false, error: 'Path is not a directory.' },
          { status: 400 }
        )
      }
      throw err
    }

    const newDir = `content/${newPath}`

    for (const entry of entries) {
      if (entry.type !== 'file') continue
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: entry.path,
      })
      if (Array.isArray(fileData) || !('content' in fileData) || typeof fileData.content !== 'string') continue
      const content = fileData.content
      const newFilePath = `${newDir}/${entry.name}`
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: newFilePath,
        message: `Move ${entry.path} to ${newFilePath} (rename folder ${oldPath} to ${newPath})`,
        content,
      })
      await octokit.repos.deleteFile({
        owner,
        repo,
        path: entry.path,
        message: `Remove file after move (rename folder ${oldPath} to ${newPath})`,
        sha: entry.sha,
      })
    }

    // Update sidebar-config.json: replace oldPath with newPath
    let sidebarSha: string | undefined
    let sidebarJson: { structure?: SidebarItem[] }
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: configPath,
      })
      if (Array.isArray(data) || !('content' in data)) {
        return NextResponse.json({
          success: true,
          path: newPath,
          message: `Folder renamed to ${newPath}. Sidebar config not found.`,
        })
      }
      const fileData = data as { sha: string; content: string }
      sidebarSha = fileData.sha
      const decoded = Buffer.from(fileData.content, 'base64').toString('utf8')
      sidebarJson = JSON.parse(decoded) as { structure?: SidebarItem[] }
    } catch {
      return NextResponse.json({
        success: true,
        path: newPath,
        message: `Folder renamed to ${newPath}. Sidebar config not updated (file missing).`,
      })
    }

    if (Array.isArray(sidebarJson.structure)) {
      const updatedStructure = replaceFolderPathInSidebarStructure(
        sidebarJson.structure,
        oldPath,
        newPath
      )
      const content = JSON.stringify({ ...sidebarJson, structure: updatedStructure }, null, 2)
      const contentBase64 = Buffer.from(content, 'utf8').toString('base64')
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: configPath,
        message: `Rename folder in sidebar config: ${oldPath} to ${newPath}`,
        content: contentBase64,
        ...(sidebarSha && { sha: sidebarSha }),
      })
    }

    return NextResponse.json({
      success: true,
      path: newPath,
      message: `Folder renamed to ${newPath}. Sidebar config updated.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
