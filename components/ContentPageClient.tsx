'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import yaml from 'js-yaml'

export type ContentInitial = {
  name: string
  description: string
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
}

export function ContentPageClient({ category, slug, initial }: Props) {
  const router = useRouter()
  const [isEditMode, setIsEditMode] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [form, setForm] = useState<ContentInitial>(initial)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<ContentInitial | null>(null)

  const display = lastSaved ?? initial
  const title = display.name || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
        router.push(`/content/${category}/${data.newSlug}`)
        return
      }
      setMessage({ type: 'success', text: 'Saved successfully' })
      setLastSaved({ ...form })
      setIsEditMode(false)
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  const updateForm = (updates: Partial<ContentInitial>) => {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  if (isEditMode) {
    return (
      <article className="max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Edit content</h2>
          {message && (
            <p
              className={`text-sm font-medium ${
                message.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {message.text}
            </p>
          )}
        </div>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>
          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>
          <div>
            <label htmlFor="figmaLink" className="mb-1 block text-sm font-medium text-gray-700">
              Figma link
            </label>
            <input
              id="figmaLink"
              type="url"
              value={form.figmaLink}
              onChange={(e) => updateForm({ figmaLink: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>
          <div>
            <label htmlFor="do" className="mb-1 block text-sm font-medium text-gray-700">
              Do
            </label>
            <textarea
              id="do"
              rows={2}
              value={form.do}
              onChange={(e) => updateForm({ do: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>
          <div>
            <label htmlFor="dont" className="mb-1 block text-sm font-medium text-gray-700">
              Don&apos;t
            </label>
            <textarea
              id="dont"
              rows={2}
              value={form.dont}
              onChange={(e) => updateForm({ dont: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>
          <div>
            <label htmlFor="body" className="mb-1 block text-sm font-medium text-gray-700">
              Content (Markdown)
            </label>
            <textarea
              id="body"
              rows={16}
              value={form.body}
              onChange={(e) => updateForm({ body: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </article>
    )
  }

  return (
    <article className="max-w-3xl relative">
      <div className="absolute top-0 right-0">
        <button
          type="button"
          onClick={startEdit}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Edit
        </button>
      </div>
      {message && (
        <p
          className={`mb-4 text-sm font-medium ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}
      <header className="mb-8 pr-24">
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
        {display.figmaLink && (
          <a
            href={display.figmaLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            View in Figma
            <span aria-hidden>→</span>
          </a>
        )}
      </header>

      {hasDoDont && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {display.do && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <h3 className="text-sm font-semibold text-green-800 mb-2">Do</h3>
              <p className="text-sm text-green-900">{display.do}</p>
            </div>
          )}
          {display.dont && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="text-sm font-semibold text-red-800 mb-2">Don&apos;t</h3>
              <p className="text-sm text-red-900">{display.dont}</p>
            </div>
          )}
        </div>
      )}

      <div className="content-markdown">
        <ReactMarkdown components={markdownComponents}>
          {(display.body || '').trim()}
        </ReactMarkdown>
      </div>
    </article>
  )
}
