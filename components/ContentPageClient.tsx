'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import yaml from 'js-yaml'
import { slugToLabel } from '@/lib/slug-to-label'
import { FigmaPreview } from '@/components/FigmaPreview'

export type ContentInitial = {
  name: string
  description: string
  figma_url: string
  figmaLink: string
  do: string
  dont: string
  body: string
  heroImage?: string
}

const markdownComponents = {
  h1: ({ children, ...props }: React.ComponentPropsWithoutRef<'h1'>) => (
    <h1 className="text-2xl font-bold mt-8 mb-4 first:mt-0" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.ComponentPropsWithoutRef<'h2'>) => (
    <h2 className="text-xl font-semibold mt-6 mb-3" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.ComponentPropsWithoutRef<'h3'>) => (
    <h3 className="text-lg font-semibold mt-4 mb-2" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
    <p className="text-gray-700 mb-3 leading-relaxed" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
    <ul className="list-disc pl-6 mb-4 space-y-1 text-gray-700" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
    <ol className="list-decimal pl-6 mb-4 space-y-1 text-gray-700" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.ComponentPropsWithoutRef<'li'>) => (
    <li className="leading-relaxed" {...props}>{children}</li>
  ),
  a: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer" {...props}>
      {children}
    </a>
  ),
  code: ({ children, ...props }: React.ComponentPropsWithoutRef<'code'>) => (
    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
  ),
  pre: ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => (
    <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm mb-4" {...props}>{children}</pre>
  ),
  blockquote: ({ children, ...props }: React.ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 my-4 text-gray-600 italic" {...props}>
      {children}
    </blockquote>
  ),
}

type Props = {
  category: string
  slug: string
  initial: ContentInitial
  /** When true, content is pull-only from git; Edit is hidden and save is disabled. */
  contentReadOnly?: boolean
}

export function ContentPageClient({ category, slug, initial, contentReadOnly }: Props) {
  const router = useRouter()
  const [isEditMode, setIsEditMode] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [form, setForm] = useState<ContentInitial>(initial)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<ContentInitial | null>(null)

  const display = lastSaved ?? initial
  const title = slugToLabel(slug)
  const hasDoDont = display.do || display.dont

  const startEdit = () => {
    setForm(display)
    setMessage(null)
    setIsEditMode(true)
  }

  const cancelEdit = () => {
    setIsEditMode(false)
    setMessage(null)
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const frontmatter: Record<string, string> = {
        name: form.name,
        description: form.description,
        figma_url: form.figma_url,
        figmaLink: form.figmaLink,
        do: form.do,
        dont: form.dont,
      }
      if (form.heroImage) frontmatter.image = form.heroImage
      const fmString = yaml.dump(frontmatter, { lineWidth: -1 }).trim()
      const fullContent = `---\n${fmString}\n---\n\n${form.body.trimStart()}\n`
      const res = await fetch('/api/save-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          slug,
          content: fullContent,
          name: form.name,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to save' })
        return
      }
      if (data.renamed && data.newSlug) {
        setMessage({ type: 'success', text: 'Saved and renamed. Redirecting…' })
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('content-saved'))
        }
        router.push(category ? `/content/${category}/${data.newSlug}` : `/content/${data.newSlug}`)
        return
      }
      setMessage({ type: 'success', text: 'Saved successfully' })
      setLastSaved({ ...form })
      setIsEditMode(false)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('content-saved'))
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  const updateForm = (updates: Partial<ContentInitial>) => {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    if (!isEditMode) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditMode])

  const inputBase =
    'w-full rounded-xl border-0 bg-white/80 px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors'
  const labelClass = 'text-[13px] font-medium text-gray-500 uppercase tracking-wide mb-2 block'

  if (isEditMode) {
    return (
      <div className="min-h-full bg-gray-100 -m-8 -mt-24 pt-24 px-8 pb-8">
        <article className="max-w-2xl mx-auto font-[family-name:var(--font-sans,-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Segoe_UI',sans-serif)]">
        {/* Bar: Title left, Cancel / Save right */}
        <div className="sticky shadow-xl shadow-gray-800/5 top-0 z-10 -mx-2 flex items-center justify-between gap-4 rounded-2xl bg-gray-100/40 px-4 py-3 backdrop-blur-xl">
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateForm({ name: e.target.value })}
            placeholder="Untitled"
            className="min-w-0 flex-1 ml-3 rounded-none border-0 border-b border-transparent bg-transparent py-0.5 text-[17px] font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-0"
            id="edit-name"
            aria-label="Content name"
          />
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="text-[17px] font-light text-gray-900 hover:opacity-70 active:opacity-60 disabled:opacity-50 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="text-[17px] font-semibold text-blue-500 hover:opacity-80 active:opacity-70 disabled:opacity-50 focus:outline-none"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 rounded-2xl px-4 py-3 text-[15px] ${
              message.type === 'success'
                ? 'bg-[#e8f5e9] text-[#1b5e20]'
                : 'bg-[#ffebee] text-[#b71c1c]'
            }`}
          >
            {message.text}
          </div>
        )}

        <form
          className="mt-6 space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {/* Group: Basic info — iOS inset group style */}
          <div className="rounded-2xl bg-[#f2f2f7] p-2">
            <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <label htmlFor="description" className={labelClass}>
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                className={`${inputBase} resize-none`}
              />
            </div>
          </div>

          {/* Group: Figma */}
          <div className="rounded-2xl bg-[#f2f2f7] p-2">
            <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <label htmlFor="figma_url" className={labelClass}>
                Figma component link
              </label>
              <input
                id="figma_url"
                type="url"
                value={form.figma_url}
                onChange={(e) => updateForm({ figma_url: e.target.value })}
                placeholder="https://www.figma.com/design/...?node-id=..."
                className={inputBase}
              />
            </div>
          </div>

          {/* Group: Do / Don't */}
          <div className="rounded-2xl bg-[#f2f2f7] p-2">
            <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <label htmlFor="do" className={labelClass}>
                Do
              </label>
              <textarea
                id="do"
                rows={2}
                value={form.do}
                onChange={(e) => updateForm({ do: e.target.value })}
                className={`${inputBase} resize-none`}
              />
            </div>
            <div className="mt-2 rounded-xl bg-white px-4 py-3 shadow-sm">
              <label htmlFor="dont" className={labelClass}>
                Don&apos;t
              </label>
              <textarea
                id="dont"
                rows={2}
                value={form.dont}
                onChange={(e) => updateForm({ dont: e.target.value })}
                className={`${inputBase} resize-none`}
              />
            </div>
          </div>

          {/* Group: Content */}
          <div className="rounded-2xl bg-[#f2f2f7] p-2">
            <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <label htmlFor="body" className={labelClass}>
                Content (Markdown)
              </label>
              <textarea
                id="body"
                rows={16}
                value={form.body}
                onChange={(e) => updateForm({ body: e.target.value })}
                className={`${inputBase} font-mono text-[14px] resize-none`}
              />
            </div>
          </div>
        </form>
        </article>
      </div>
    )
  }

  return (
    <article className="max-w-3xl mx-auto relative">
      {!contentReadOnly && (
        <div className="absolute top-0 right-0">
          <button
            type="button"
            onClick={startEdit}
            className="rounded-xl bg-[#f2f2f7] px-4 py-2.5 text-[15px] font-medium text-blue-500 hover:bg-[#e5e5ea] active:bg-[#d1d1d6] focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
          >
            Edit
          </button>
        </div>
      )}
      {message && (
        <p
          className={`mb-4 text-sm font-medium ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}
      <header className={`mb-8 ${contentReadOnly ? '' : 'pr-24'}`}>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
        {display.heroImage && (
          <div className="mt-4 mb-6 -mx-0 overflow-hidden rounded-xl">
            <Image
              src={display.heroImage}
              alt=""
              width={800}
              height={400}
              className="w-full h-auto object-cover"
              priority
            />
          </div>
        )}
        {display.description && (
          <p className="text-lg text-gray-600 leading-relaxed">{display.description}</p>
        )}
        {(display.figma_url || display.figmaLink) && (
          <div className="mt-4">
            <FigmaPreview
              figmaUrl={display.figma_url || display.figmaLink}
              alt={display.name}
            />
          </div>
        )}
      </header>

      {hasDoDont && (
        <div className="flex flex-col gap-6 mb-8">
          {display.do && (
            <div>
              <h3 className="text-2xl font-semibold text-green-600 mb-2">Do</h3>
              <p className="text-base text-gray-700 whitespace-pre-line leading-relaxed">{display.do}</p>
            </div>
          )}
          {display.dont && (
            <div>
              <h3 className="text-2xl font-semibold text-red-600 mb-2">Don&apos;t</h3>
              <p className="text-base text-gray-700 whitespace-pre-line leading-relaxed">{display.dont}</p>
            </div>
          )}
        </div>
      )}

      <div className="content-markdown border-t border-gray-200 pt-6 mt-2">
        <ReactMarkdown remarkPlugins={[remarkBreaks]} components={markdownComponents}>
          {(display.body || '').trim()}
        </ReactMarkdown>
      </div>
    </article>
  )
}
