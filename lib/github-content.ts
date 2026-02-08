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
 * Fetches markdown file content from GitHub.
 * pathSegments: e.g. ['solid'] → content/solid.md; ['foundation','colors','primary'] → content/foundation/colors/primary.md.
 */
export async function fetchContentByPath(pathSegments: string[]): Promise<string> {
  if (pathSegments.length === 0) throw new Error('Invalid path')
  const path = `content/${pathSegments.join('/')}.md`
  const octokit = await getOctokit()
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path })
    if (Array.isArray(data)) throw new Error(`Path is a directory, not a file: ${path}`)
    if (data.type !== 'file') throw new Error(`Unexpected content type: ${(data as { type?: string }).type}`)
    if (!('content' in data) || typeof data.content !== 'string') throw new Error('File content missing or too large')
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

/**
 * Fetches markdown file content from GitHub (category + slug form).
 * When category is null, fetches content/${slug}.md (root-level). Otherwise content/${category}/${slug}.md.
 */
export async function fetchContentFromGitHub(
  category: string | null,
  slug: string
): Promise<string> {
  const path = category ? `content/${category}/${slug}.md` : `content/${slug}.md`
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

/** Preferred category order for sidebar (root-level only); others follow alphabetically. */
const CONTENT_CATEGORY_ORDER = ['foundation', 'components', 'uipattern']

/**
 * Recursively fetches one folder's contents. relativePath is the path under content/ (e.g. "" for content/, "foundation" for content/foundation/).
 * Returns pages (path = relativePath/slug) and folders (path = relativePath/subdir, children from recursive call).
 */
async function fetchFolderStructure(
  octokit: Octokit,
  relativePath: string
): Promise<SidebarConfigItem[]> {
  const contentPath = relativePath ? `content/${relativePath}` : 'content'
  const { data: entries } = await octokit.repos.getContent({
    owner,
    repo,
    path: contentPath,
  })

  if (!Array.isArray(entries)) return []

  const files = entries.filter((e) => e.type === 'file' && e.name.endsWith('.md'))
  const dirs = entries.filter((e) => e.type === 'dir')
  const mdSlugs = files.map((e) => e.name.replace(/\.md$/, '')).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  const dirNames = [...dirs].map((d) => d.name).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  const items: SidebarConfigItem[] = []
  let order = 0

  for (const slug of mdSlugs) {
    const path = relativePath ? `${relativePath}/${slug}` : slug
    items.push({ type: 'page', path, order: ++order, pinned: false })
  }

  for (const dirName of dirNames) {
    const folderRelativePath = relativePath ? `${relativePath}/${dirName}` : dirName
    const children = await fetchFolderStructure(octokit, folderRelativePath)
    items.push({
      type: 'folder',
      path: folderRelativePath,
      order: ++order,
      pinned: false,
      children,
    })
  }

  return items
}

const CONTENT_PREFIX = 'content/'

/**
 * Fetches the full content structure using the Git Tree API (recursive).
 * Returns every file and folder under content/ without the 1000-item-per-directory limit.
 * Falls back to getContent-based fetch if tree is truncated or fails.
 */
export async function fetchContentStructureFromGitHub(): Promise<SidebarConfigItem[]> {
  const octokit = await getOctokit()

  try {
    const structure = await fetchContentStructureFromTree(octokit)
    if (structure.length > 0 || (await contentDirExists(octokit))) return structure
  } catch (err) {
    console.warn('fetchContentStructureFromTree failed, falling back to getContent:', err)
  }

  return fetchContentStructureFromGetContent(octokit)
}

async function contentDirExists(octokit: Octokit): Promise<boolean> {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: 'content' })
    return Array.isArray(data) ? true : true
  } catch {
    return false
  }
}

type TreeEntry = { path?: string; type?: string }

async function fetchContentStructureFromTree(octokit: Octokit): Promise<SidebarConfigItem[]> {
  const repoInfo = await octokit.repos.get({ owner, repo })
  const defaultBranch = repoInfo.data.default_branch ?? 'main'
  const branch = await octokit.repos.getBranch({ owner, repo, branch: defaultBranch })
  const commitSha = branch.data.commit.sha
  const commit = await octokit.git.getCommit({ owner, repo, commit_sha: commitSha })
  const treeSha = commit.data.tree.sha
  const tree = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: '1',
  })

  if (tree.data.truncated) {
    throw new Error('Repository tree is truncated; too many entries')
  }

  const entries = (tree.data.tree ?? []) as TreeEntry[]
  const underContent = entries.filter(
    (e) => e.path && e.path !== CONTENT_PREFIX && e.path.startsWith(CONTENT_PREFIX)
  )

  const dirMap = new Map<string, { files: string[]; dirs: string[] }>()
  function ensureDir(relativeDir: string) {
    if (!dirMap.has(relativeDir)) dirMap.set(relativeDir, { files: [], dirs: [] })
    return dirMap.get(relativeDir)!
  }

  for (const e of underContent) {
    const path = e.path!
    const relative = path.slice(CONTENT_PREFIX.length)
    const parts = relative.split('/')
    if (e.type === 'blob') {
      if (!relative.endsWith('.md')) continue
      const slug = parts[parts.length - 1]!.replace(/\.md$/, '')
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
      ensureDir(dir).files.push(slug)
    } else if (e.type === 'tree') {
      if (parts.length === 1) {
        ensureDir('').dirs.push(parts[0]!)
      } else {
        const parentDir = parts.slice(0, -1).join('/')
        const name = parts[parts.length - 1]!
        if (!ensureDir(parentDir).dirs.includes(name)) ensureDir(parentDir).dirs.push(name)
      }
    }
  }

  const root = ensureDir('')
  root.files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  root.dirs.sort((a, b) => {
    const ai = CONTENT_CATEGORY_ORDER.indexOf(a)
    const bi = CONTENT_CATEGORY_ORDER.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })

  let order = 0
  function buildItems(relativeDir: string): SidebarConfigItem[] {
    const { files, dirs } = ensureDir(relativeDir)
    const items: SidebarConfigItem[] = []
    for (const slug of files) {
      const path = relativeDir ? `${relativeDir}/${slug}` : slug
      items.push({ type: 'page', path, order: ++order, pinned: false })
    }
    for (const dirName of dirs) {
      const folderPath = relativeDir ? `${relativeDir}/${dirName}` : dirName
      const childEntries = ensureDir(folderPath)
      childEntries.files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      childEntries.dirs.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      const children = buildItems(folderPath)
      items.push({
        type: 'folder',
        path: folderPath,
        order: ++order,
        pinned: false,
        children,
      })
    }
    return items
  }

  return buildItems('')
}

async function fetchContentStructureFromGetContent(octokit: Octokit): Promise<SidebarConfigItem[]> {
  const { data: contentEntries } = await octokit.repos.getContent({
    owner,
    repo,
    path: 'content',
  })

  if (!Array.isArray(contentEntries)) return []

  const rootMdFiles = contentEntries
    .filter((e) => e.type === 'file' && e.name.endsWith('.md'))
    .map((e) => e.name.replace(/\.md$/, ''))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  const rootDirs = contentEntries
    .filter((e) => e.type === 'dir')
    .map((e) => e.name)

  const orderedDirs = [...rootDirs].sort((a, b) => {
    const ai = CONTENT_CATEGORY_ORDER.indexOf(a)
    const bi = CONTENT_CATEGORY_ORDER.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })

  const structure: SidebarConfigItem[] = []
  let order = 0

  for (const slug of rootMdFiles) {
    structure.push({ type: 'page', path: slug, order: ++order, pinned: false })
  }

  for (const dir of orderedDirs) {
    const children = await fetchFolderStructure(octokit, dir)
    structure.push({
      type: 'folder',
      path: dir,
      order: ++order,
      pinned: false,
      children,
    })
  }

  return structure
}
