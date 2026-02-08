'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { parseFigmaUrl } from '@/lib/parseFigmaUrl'

type DevStatus = 'READY_FOR_DEV' | 'WORK_IN_PROGRESS' | null

type Props = {
  figmaUrl: string
  alt?: string
}

export function FigmaPreview({ figmaUrl, alt }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [devStatus, setDevStatus] = useState<DevStatus>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const parsed = parseFigmaUrl(figmaUrl)

  useEffect(() => {
    if (!parsed.fileKey || !parsed.nodeId) {
      setError('Invalid Figma URL')
      setLoading(false)
      return
    }

    let cancelled = false
    setError(null)
    setLoading(true)
    setDevStatus(null)

    const params = new URLSearchParams({
      fileKey: parsed.fileKey,
      nodeId: parsed.nodeId,
    })

    // Image first: show preview as soon as we have it (don't wait for dev status)
    fetch(`/api/figma-image?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
          setImageUrl(null)
        } else if (data.imageUrl) {
          setImageUrl(data.imageUrl)
          setError(null)
        } else {
          setError('No image URL in response')
          setImageUrl(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load Figma image')
          setImageUrl(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    // Dev status in background: header updates when it arrives
    fetch(`/api/figma-dev-status?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (!data.error) {
          if (data.devStatus === 'READY_FOR_DEV' || data.devStatus === 'WORK_IN_PROGRESS') {
            setDevStatus(data.devStatus)
          } else {
            setDevStatus(null)
          }
        }
      })
      .catch(() => {
        if (!cancelled) setDevStatus(null)
      })

    return () => {
      cancelled = true
    }
  }, [parsed.fileKey, parsed.nodeId])

  if (!parsed.fileKey || !parsed.nodeId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Invalid Figma link
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-6 py-8 text-sm text-gray-500">
        Loading Figma preview…
      </div>
    )
  }

  if (error || !imageUrl) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Invalid Figma link
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <span className="text-sm font-medium text-gray-700">Figma Preview</span>
        <span className="text-xs font-medium shrink-0">
          {devStatus === 'READY_FOR_DEV' ? (
            <span className="text-green-600">✓ Ready for Dev</span>
          ) : devStatus === 'WORK_IN_PROGRESS' ? (
            <span className="text-orange-600">✓ Ready for Dev</span>
          ) : (
            <span className="text-gray-500">Ready for Dev ✗</span>
          )}
        </span>
      </div>
      <a
        href={figmaUrl}
        target="_blank"
        rel="noreferrer"
        className="block focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      >
        <Image
          src={imageUrl}
          alt={alt ?? 'Figma component preview'}
          width={800}
          height={400}
          className="w-full h-auto object-contain"
          unoptimized
        />
      </a>
    </div>
  )
}
