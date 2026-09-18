import { z } from 'zod'
import type { Bundle } from './types'

const vec3Schema = z.tuple([z.number(), z.number(), z.number()])

const contentItemSchema = z
  .object({
    type: z.enum(['model', 'video', 'dom', 'game']),
    src: z.string().optional(),
    animation: z.string().optional(),
    alpha: z.enum(['none', 'packed']).optional(),
    loop: z.boolean().optional(),
    component: z.string().optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    gameId: z.string().optional(),
    position: vec3Schema.optional(),
    rotation: vec3Schema.optional(),
    scale: z.union([z.number(), vec3Schema]).optional(),
    size: z.tuple([z.number(), z.number()]).optional(),
  })
  .superRefine((item, ctx) => {
    // A malformed entry should fail loudly at load time rather than
    // silently rendering nothing (CLAUDE.md section 3) — so the fields
    // each content type actually needs to render are required, not just
    // optional-and-hope.
    if (item.type === 'model' && !item.src) {
      ctx.addIssue({ code: 'custom', message: "content item of type 'model' requires 'src'", path: ['src'] })
    }
    if (item.type === 'video' && !item.src) {
      ctx.addIssue({ code: 'custom', message: "content item of type 'video' requires 'src'", path: ['src'] })
    }
    if (item.type === 'dom' && !item.component) {
      ctx.addIssue({ code: 'custom', message: "content item of type 'dom' requires 'component'", path: ['component'] })
    }
    if (item.type === 'game' && !item.gameId) {
      ctx.addIssue({ code: 'custom', message: "content item of type 'game' requires 'gameId'", path: ['gameId'] })
    }
  })

const targetEntrySchema = z.object({
  index: z.number().int().nonnegative(),
  name: z.string().min(1),
  content: z.array(contentItemSchema),
})

const bundleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  mindFile: z.string().min(1),
  targets: z.array(targetEntrySchema),
})

// Group 5-8 targets per .mind file (CLAUDE.md section 3) — a performance
// guideline, not a correctness constraint, so a bundle outside that range
// warns rather than fails validation. M1/M2 test bundles are intentionally
// smaller than 5.
function warnIfMisbundled(bundle: Bundle) {
  const count = bundle.targets.length
  if (count > 0 && (count < 5 || count > 8)) {
    console.warn(
      `Bundle "${bundle.id}" has ${count} targets; the brief's bundling rule recommends 5-8 per .mind file for tracking performance on mid-range Android.`,
    )
  }
}

export function parseBundle(data: unknown): Bundle {
  const result = bundleSchema.safeParse(data)
  if (!result.success) {
    throw new Error(`Invalid bundle manifest:\n${z.prettifyError(result.error)}`)
  }
  const bundle = result.data as Bundle
  warnIfMisbundled(bundle)
  return bundle
}
