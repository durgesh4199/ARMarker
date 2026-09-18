import { z } from 'zod'
import type { IconName } from '../dom/iconRegistry'

export interface BundleCatalogEntry {
  id: string
  title: string
  description: string
  icon: IconName
  manifestUrl: string
  markerCount: number
  badge?: string
}

// Lightweight picker metadata, distinct from a bundle's own full manifest
// (content/types.ts's Bundle) — this is only what the picker screen needs
// to render cards without fetching every bundle's full content up front.
const catalogEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  icon: z.enum(['layers', 'cube', 'play', 'tag']),
  manifestUrl: z.string().min(1),
  markerCount: z.number().int().positive(),
  badge: z.string().optional(),
})

const catalogSchema = z.array(catalogEntrySchema)

export function parseCatalog(data: unknown): BundleCatalogEntry[] {
  const result = catalogSchema.safeParse(data)
  if (!result.success) {
    throw new Error(`Invalid bundle catalog:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
