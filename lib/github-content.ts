import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import type { SidebarConfigFolder, SidebarConfigItem, SidebarConfigPage } from './sidebar-order'

const owner =
  process.env.GITHUB_OWNER ?? process.env.GITHUB_REPO_OWNER ?? 'ynsukimsh'
const repo =
  process.env.GITHUB_REPO ?? process.env.GITHUB_REPO_NAME ?? 'sdskb'

export function getOctokit(): Promise<Octokit> {
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

/** Preferred category order for sidebar; others follow alphabetically. */
const CONTENT_CATEGORY_ORDER = ['foundation', 'components', 'uipattern']

/**
 * Fetches the content folder structure from GitHub (repos.getContent for 'content').
 * Returns a tree of categories (folders) and markdown files (pages), matching SidebarConfigItem[].
 * Filenames are converted to slugs (strip .md) and labels use slug-to-title conversion.
 */
export async function fetchContentStructureFromGitHub(): Promise<SidebarConfigItem[]> {
  const octokit = await getOctokit()

  const { data: contentEntries } = await octokit.repos.getContent({
    owner,
    repo,
    path: 'content',
  })

  if (!Array.isArray(contentEntries)) {
    return []
  }

  const categoryDirs = contentEntries
    .filter((e): e is { name: string; path: string; type: string } => e.type === 'dir')
    .map((e) => e.name)

  const orderedCategories = [...categoryDirs].sort((a, b) => {
    const ai = CONTENT_CATEGORY_ORDER.indexOf(a)
    const bi = CONTENT_CATEGORY_ORDER.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })

  const structure: SidebarConfigItem[] = []
  let order = 0

  for (const category of orderedCategories) {
    const { data: categoryEntries } = await octokit.repos.getContent({
      owner,
      repo,
      path: `content/${category}`,
    })

    if (!Array.isArray(categoryEntries)) continue

    const mdFiles = categoryEntries
      .filter((e): e is { name: string } => e.type === 'file' && e.name.endsWith('.md'))
      .map((e) => e.name.replace(/\.md$/, ''))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

    const children: SidebarConfigPage[] = mdFiles.map((slug, i) => ({
      type: 'page',
      path: `${category}/${slug}`,
      order: i + 1,
      pinned: false,
    }))

    const folder: SidebarConfigFolder = {
      type: 'folder',
      path: category,
      order: ++order,
      pinned: false,
      children,
    }
    structure.push(folder)
  }

  return structure
}
