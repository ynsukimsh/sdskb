import { NextRequest, NextResponse } from 'next/server'
import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'

const appId = process.env.GITHUB_APP_ID
const privateKey = process.env.GITHUB_PRIVATE_KEY
const installationId = process.env.GITHUB_INSTALLATION_ID
const owner = process.env.GITHUB_REPO_OWNER ?? 'ynsukimsh'
const repo = process.env.GITHUB_REPO_NAME ?? 'sdskb'
const TRASH_PREFIX = 'content/trash/'
const CONTENT_PREFIX = 'content/'

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

/** Recursively list all file paths under content/trash */
async function listTrashFiles(
  octokit: Octokit,
  dirPath: string
): Promise<string[]> {
  const out: string[] = []
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: dirPath,
    })
    const entries = Array.isArray(data) ? data : [data]
    for (const entry of entries) {
      if (entry.type === 'file') {
        out.push(entry.path)
      } else if (entry.type === 'dir') {
        const sub = await listTrashFiles(octokit, entry.path)
        out.push(...sub)
      }
    }
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? (err as { response?: { status?: number } })?.response?.status
    if (status === 404) return []
    throw err
  }
  return out
}

/** GET: list files in content/trash */
export async function GET() {
  try {
    const octokit = await getOctokit()
    const files = await listTrashFiles(octokit, 'content/trash')
    const items = files.map((path) => ({
      trashPath: path,
      originalPath: path.startsWith(TRASH_PREFIX)
        ? CONTENT_PREFIX + path.slice(TRASH_PREFIX.length)
        : path,
    }))
    return NextResponse.json({ success: true, items })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

/** POST: body { action: 'move' | 'restore', contentPath?: string, trashPath?: string }
 *  move: contentPath = content-relative path e.g. "foundation/colors.md" -> move to content/trash/...
 *  restore: trashPath = full path e.g. "content/trash/foundation/colors.md" -> move back to content/...
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, contentPath, trashPath } = body

    if (action === 'move') {
      if (!contentPath || typeof contentPath !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Missing or invalid contentPath' },
          { status: 400 }
        )
      }
      const sourcePath = contentPath.startsWith(CONTENT_PREFIX)
        ? contentPath
        : `${CONTENT_PREFIX}${contentPath}`
      const destPath = `${TRASH_PREFIX}${sourcePath.slice(CONTENT_PREFIX.length)}`

      const octokit = await getOctokit()
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: sourcePath,
      })
      if (Array.isArray(fileData) || !('content' in fileData)) {
        return NextResponse.json(
          { success: false, error: 'Source is not a file' },
          { status: 400 }
        )
      }
      const content = Buffer.from(fileData.content, 'base64').toString('utf8')
      const contentBase64 = Buffer.from(content, 'utf8').toString('base64')

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: destPath,
        message: `Move to trash: ${sourcePath}`,
        content: contentBase64,
      })

      await octokit.repos.deleteFile({
        owner,
        repo,
        path: sourcePath,
        message: `Remove (moved to trash): ${sourcePath}`,
        sha: fileData.sha,
      })

      return NextResponse.json({
        success: true,
        trashPath: destPath,
        message: `Moved to ${destPath}`,
      })
    }

    if (action === 'restore') {
      if (!trashPath || typeof trashPath !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Missing or invalid trashPath' },
          { status: 400 }
        )
      }
      if (!trashPath.startsWith(TRASH_PREFIX)) {
        return NextResponse.json(
          { success: false, error: 'Invalid trash path' },
          { status: 400 }
        )
      const originalPath =
        CONTENT_PREFIX + trashPath.slice(TRASH_PREFIX.length)

      const octokit = await getOctokit()
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: trashPath,
      })
      if (Array.isArray(fileData) || !('content' in fileData)) {
        return NextResponse.json(
          { success: false, error: 'Trash item is not a file' },
          { status: 400 }
        )
      }
      const content = Buffer.from(fileData.content, 'base64').toString('utf8')
      const contentBase64 = Buffer.from(content, 'utf8').toString('base64')

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: originalPath,
        message: `Restore from trash: ${trashPath}`,
        content: contentBase64,
      })

      await octokit.repos.deleteFile({
        owner,
        repo,
        path: trashPath,
        message: `Remove from trash (restored): ${trashPath}`,
        sha: fileData.sha,
      })

      return NextResponse.json({
        success: true,
        originalPath,
        message: `Restored to ${originalPath}`,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action; use "move" or "restore"' },
      { status: 400 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
