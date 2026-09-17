// The content manifest — data, not code (CLAUDE.md section 3/rule 5).
// Adding a marker should only ever mean a JSON edit under public/bundles/
// plus an asset drop, never a code change.
export type Vec3 = [number, number, number]

export interface ContentItem {
  type: 'model' | 'video' | 'dom'
  // model
  src?: string
  animation?: string
  // video
  alpha?: 'none' | 'packed'
  loop?: boolean
  // dom
  component?: string
  props?: Record<string, unknown>
  // common
  position?: Vec3
  rotation?: Vec3
  scale?: number | Vec3
  size?: [number, number]
}

export interface TargetEntry {
  // MUST match the image order in the .mind file — see the note on
  // targets/<bundle-id>/ naming in the README. Nothing here can validate
  // that mapping automatically; it's a manual-authoring invariant.
  index: number
  name: string
  content: ContentItem[]
}

export interface Bundle {
  id: string
  title: string
  mindFile: string
  targets: TargetEntry[]
}
