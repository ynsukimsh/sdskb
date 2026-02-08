/**
 * Parses a Figma URL and returns fileKey and nodeId for the Images API.
 * Supports design URLs: .../design/{fileKey}/...?node-id=X-Y or node-id=X:Y
 */

/**
 * Extracts fileKey, nodeId, and linkType from a Figma URL.
 * - fileKey from path: /design/{fileKey}/ or /file/{fileKey}/
 * - nodeId from query: ?node-id=X-Y or node-id=X:Y (colon format normalized to dash)
 * - linkType: "design" | "file" from path, or null
 *
 * @param url - Figma URL string (e.g. design or file URL)
 * @returns { fileKey, nodeId, linkType } with string values if found, null for invalid/missing parts
 */
export function parseFigmaUrl(url: string | null | undefined): {
  fileKey: string | null
  nodeId: string | null
  linkType: 'design' | 'file' | null
} {
  if (url == null || typeof url !== 'string') {
    return { fileKey: null, nodeId: null, linkType: null }
  }

  const trimmed = url.trim()
  if (!trimmed) return { fileKey: null, nodeId: null, linkType: null }

  let parsed: URL
  try {
    const href = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    parsed = new URL(href)
  } catch {
    return { fileKey: null, nodeId: null, linkType: null }
  }

  const host = parsed.hostname.toLowerCase()
  if (!host.includes('figma.com')) {
    return { fileKey: null, nodeId: null, linkType: null }
  }

  // Path: /design/{fileKey}/... or /file/{fileKey}/...
  const pathMatch = parsed.pathname.match(/\/(design|file)\/([^/]+)/)
  const linkType = (pathMatch?.[1] === 'design' || pathMatch?.[1] === 'file' ? pathMatch[1] : null) as 'design' | 'file' | null
  const fileKey = pathMatch?.[2]?.trim() ?? null
  if (!fileKey) return { fileKey: null, nodeId: null, linkType: null }

  // Query: node-id=X-Y or node-id=X:Y (Figma uses colon in IDs; URL often uses dash)
  const nodeIdParam = parsed.searchParams.get('node-id')
  const nodeId = normalizeNodeId(nodeIdParam)

  return { fileKey, nodeId, linkType }
}

/**
 * Normalize node-id: allow "X-Y" or "X:Y", return dash form for consistency.
 */
function normalizeNodeId(value: string | null): string | null {
  if (value == null || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.replace(':', '-')
}
