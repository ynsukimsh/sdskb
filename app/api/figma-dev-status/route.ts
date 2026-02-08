import { NextRequest, NextResponse } from 'next/server'

const FIGMA_API_BASE = 'https://api.figma.com/v1'

export const dynamic = 'force-dynamic'

type FigmaNode = {
  id?: string
  devStatus?: { type?: string } | null
  dev_status?: { type?: string } | null
  children?: FigmaNode[]
}

type FigmaNodeResponse = {
  nodes?: Record<
    string,
    {
      document?: FigmaNode | null
    }
  >
}

function getNodeDevStatus(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null
  const n = node as Record<string, unknown>
  const status = (n.devStatus ?? n.dev_status) as { type?: string } | undefined
  const t = status?.type
  return typeof t === 'string' ? t : null
}

function findDevStatusInTree(
  node: FigmaNode | null | undefined,
  targetId: string,
  ancestorDevStatus: string | null = null
): string | null {
  if (!node) return null
  const id = (node as { id?: string }).id ?? ''
  const selfStatus = getNodeDevStatus(node) ?? null
  const statusHere = selfStatus ?? ancestorDevStatus
  if (id === targetId || id.replace(/-/g, ':') === targetId) {
    return statusHere
  }
  const children = (node as { children?: FigmaNode[] }).children
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findDevStatusInTree(child, targetId, selfStatus ?? ancestorDevStatus)
      if (found) return found
    }
  }
  return null
}

/** Recursively find any devStatus in an object (for debugging) */
function collectDevStatusInObject(obj: unknown, out: { path: string; type: string }[], path = ''): void {
  if (!obj || typeof obj !== 'object') return
  const o = obj as Record<string, unknown>
  const status = o.devStatus ?? o.dev_status
  if (status && typeof status === 'object' && status !== null && 'type' in status) {
    const t = (status as { type?: string }).type
    if (typeof t === 'string') out.push({ path: path || '(root)', type: t })
  }
  if (Array.isArray(o.children)) {
    o.children.forEach((child, i) => collectDevStatusInObject(child, out, path ? `${path}.children[${i}]` : `children[${i}]`))
  }
}

type FigmaFileResponse = {
  lastModified?: string | null
  name?: string
}

/**
 * GET /api/figma-dev-status?fileKey=...&nodeId=...
 * Fetches dev status for a Figma node and file last-modified time.
 * Returns JSON: { devStatus, lastModified }.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileKey = searchParams.get('fileKey')
  const nodeId = searchParams.get('nodeId')
  const debug = searchParams.get('debug') === '1' || searchParams.get('debug') === 'true'

  if (!fileKey?.trim()) {
    return NextResponse.json(
      { error: 'Missing or empty query parameter: fileKey' },
      { status: 400 }
    )
  }
  if (!nodeId?.trim()) {
    return NextResponse.json(
      { error: 'Missing or empty query parameter: nodeId' },
      { status: 400 }
    )
  }

  const token = process.env.FIGMA_ACCESS_TOKEN
  if (!token?.trim()) {
    return NextResponse.json(
      { error: 'FIGMA_ACCESS_TOKEN is not configured' },
      { status: 500 }
    )
  }

  const headers = { 'X-Figma-Token': token }
  const nodeIdForApi = nodeId.replace(/-/g, ':')
  const nodesUrl = `${FIGMA_API_BASE}/files/${encodeURIComponent(fileKey)}/nodes?ids=${encodeURIComponent(nodeIdForApi)}`
  // Request file with ids so we get a smaller document subtree (and can search for devStatus)
  const fileUrl = `${FIGMA_API_BASE}/files/${encodeURIComponent(fileKey)}?ids=${encodeURIComponent(nodeIdForApi)}`

  let nodesRes: Response
  let fileRes: Response
  try {
    [nodesRes, fileRes] = await Promise.all([
      fetch(nodesUrl, { method: 'GET', headers }),
      fetch(fileUrl, { method: 'GET', headers }),
    ])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Figma API request failed'
    console.error('figma-dev-status API fetch error:', err)
    return NextResponse.json(
      { error: message },
      { status: 502 }
    )
  }

  if (!nodesRes.ok) {
    const body = await nodesRes.text()
    let message = `Figma API error: ${nodesRes.status} ${nodesRes.statusText}`
    try {
      const json = JSON.parse(body) as { message?: string; err?: string }
      message = json.message ?? json.err ?? message
    } catch {
      if (body) message = body.slice(0, 200)
    }
    return NextResponse.json(
      { error: message },
      { status: nodesRes.status >= 500 ? 502 : nodesRes.status >= 400 ? 400 : 502 }
    )
  }

  let devStatus: string | null = null
  let lastModified: string | null = null
  const debugInfo: { nodeKeys?: string[]; statusFromNodes?: string | null; statusFromFile?: string | null; devStatusFoundInTree?: { path: string; type: string }[] } = {}

  try {
    const data = (await nodesRes.json()) as FigmaNodeResponse
    const nodes = data.nodes ?? {}
    if (debug) debugInfo.nodeKeys = Object.keys(nodes)
    const nodeIdWithColon = nodeId.replace(/-/g, ':')
    const entry = nodes[nodeId] ?? nodes[nodeIdWithColon]
    const doc = entry?.document as FigmaNode | undefined
    devStatus = getNodeDevStatus(doc) ?? null
    if (!devStatus && doc) {
      devStatus = findDevStatusInTree(doc, nodeIdWithColon) ?? findDevStatusInTree(doc, nodeId)
    }
    if (debug && doc) {
      const found: { path: string; type: string }[] = []
      collectDevStatusInObject(doc, found)
      debugInfo.devStatusFoundInTree = found.length ? found : undefined
    }
    debugInfo.statusFromNodes = devStatus
  } catch {
    devStatus = null
  }

  let fileData: FigmaFileResponse & { document?: FigmaNode } | null = null
  if (fileRes.ok) {
    try {
      fileData = (await fileRes.json()) as FigmaFileResponse & { document?: FigmaNode }
      lastModified = fileData.lastModified ?? null
      if (!devStatus && fileData.document) {
        const fromFile = findDevStatusInTree(fileData.document, nodeIdForApi) ?? findDevStatusInTree(fileData.document, nodeId)
        if (fromFile) {
          devStatus = fromFile
          debugInfo.statusFromFile = fromFile
        }
      }
    } catch {
      lastModified = null
    }
  }

  const body: { devStatus: string | null; lastModified: string | null; debug?: typeof debugInfo } = { devStatus, lastModified }
  if (debug) body.debug = debugInfo
  return NextResponse.json(body)
}
