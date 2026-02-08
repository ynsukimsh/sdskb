/** Converts a path segment/slug to sidebar-style label (e.g. "bottom-sheets" → "Bottom Sheets"). Safe for client and server. */
export function slugToLabel(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
