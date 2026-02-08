import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'

const owner =
  process.env.GITHUB_OWNER ?? process.env.GITHUB_REPO_OWNER ?? 'ynsukimsh'
const repo =
  process.env.GITHUB_REPO ?? process.env.GITHUB_REPO_NAME ?? 'sdskb'

function getOctokit(): Promise<Octokit> {
  const token = process.env.GITHUB_TOKEN
  if (token) {
    return Promise.resolve(new Octokit({ auth: token }))
  }
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_PRIVATE_KEY
  const installationId = process.env.GITHUB_INSTALLATION_ID
  if (!appId || !privateKey || !installationId) {
    throw new Error(
      'Missing GitHub auth: set GITHUB_TOKEN or (GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID)'
    )
  }
  const auth = createAppAuth({
    appId,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  })
  return auth({
    type: 'installation',
    installationId: Number(installationId),
  }).then((installationAuth) => {
    const t = installationAuth.token
    if (!t) throw new Error('Failed to get installation token')
    return new Octokit({ auth: t })
  })
}

/**
 * Fetches markdown file content from GitHub for the given category and slug.
 * Uses repos.getContent for content/${category}/${slug}.md.
 * @returns Decoded file content as UTF-8 string
 * @throws Not found or API errors (caller can use notFound() on 404)
 */
export async function fetchContentFromGitHub(
  category: string,
  slug: string
): Promise<string> {
  const path = `content/${category}/${slug}.md`
  const octokit = await getOctokit()

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    })

    if (Array.isArray(data)) {
      throw new Error(`Path is a directory, not a file: ${path}`)
    }
    if (data.type !== 'file') {
      throw new Error(`Unexpected content type: ${(data as { type?: string }).type}`)
    }
    if (!('content' in data) || typeof data.content !== 'string') {
      throw new Error('File content missing or too large (use raw endpoint)')
    }

    return Buffer.from(data.content, 'base64').toString('utf8')
  } catch (err: unknown) {
    const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : undefined
    if (status === 404) {
      const notFoundError = new Error('CONTENT_NOT_FOUND') as Error & { code: string }
      notFoundError.code = 'CONTENT_NOT_FOUND'
      throw notFoundError
    }
    if (err instanceof Error) throw err
    throw new Error(String(err))
  }
}
