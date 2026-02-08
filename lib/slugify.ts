/**
 * Convert a display name to a URL-safe filename slug.
 * - Lowercase, spaces to hyphens, only letters numbers and hyphens.
 */
export function nameToSlug(name: string): string {
  if (typeof name !== 'string') return ''
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Validate slug: non-empty, only lowercase letters, numbers, hyphens. */
export function isValidSlug(slug: string): boolean {
  return typeof slug === 'string' && slug.length > 0 && SLUG_REGEX.test(slug)
}
