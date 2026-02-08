import { NextRequest, NextResponse } from 'next/server'

const FIGMA_API_BASE = 'https://api.figma.com/v1'

export const dynamic = 'force-dynamic'

/**
 * GET /api/figma-image?fileKey=...&nodeId=...
 * Fetches the image URL for a Figma node via the Figma Images API.
 * Returns JSON with imageUrl (the S3 URL from Figma's response).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileKey = searchParams.get('fileKey')
  const nodeId = searchParams.get('nodeId')

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

  // Use colon format for Figma API; scale=2 for sharper preview
  const nodeIdForApi = nodeId.replace(/-/g, ':')
  const url = `${FIGMA_API_BASE}/images/${encodeURIComponent(fileKey)}?ids=${encodeURIComponent(nodeIdForApi)}&format=png&scale=2`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Figma-Token': token,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Figma API request failed'
    console.error('figma-image API fetch error:', err)
    return NextResponse.json(
      { error: message },
      { status: 502 }
    )
  }

  if (!res.ok) {
    const body = await res.text()
    let message = `Figma API error: ${res.status} ${res.statusText}`
    try {
      const json = JSON.parse(body) as { message?: string; err?: string }
      message = json.message ?? json.err ?? message
    } catch {
      if (body) message = body.slice(0, 200)
    }
    return NextResponse.json(
      { error: message },
      { status: res.status >= 500 ? 502 : res.status >= 400 ? 400 : 502 }
    )
  }

  let data: { err?: string | null; images?: Record<string, string> }
  try {
    data = (await res.json()) as { err?: string | null; images?: Record<string, string> }
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON response from Figma API' },
      { status: 502 }
    )
  }

  if (data.err) {
    return NextResponse.json(
      { error: data.err },
      { status: 400 }
    )
  }

  const images = data.images ?? {}
  const imageUrl = images[nodeIdForApi] ?? images[nodeId] ?? images[nodeId.replace(/-/g, ':')]

  if (!imageUrl) {
    return NextResponse.json(
      {
        error: 'Image not found for node',
        availableNodes: Object.keys(images),
      },
      { status: 404 }
    )
  }

  return NextResponse.json({ imageUrl })
}
