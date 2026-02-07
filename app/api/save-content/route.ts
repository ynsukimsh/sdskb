import { NextRequest, NextResponse } from 'next/server'
import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'

const appId = process.env.GITHUB_APP_ID
const privateKey = process.env.GITHUB_PRIVATE_KEY
const installationId = process.env.GITHUB_INSTALLATION_ID
const owner = process.env.GITHUB_REPO_OWNER ?? 'ynsukimsh'
const repo = process.env.GITHUB_REPO_NAME ?? 'sdskb'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { category, slug, content } = body

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

    const path = `content/${category}/${slug}.md`
    const message = `Update ${slug}`
    const contentBase64 = Buffer.from(content, 'utf8').toString('base64')

    const octokit = await getOctokit()

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
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
