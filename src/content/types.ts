// The content manifest — data, not code (CLAUDE.md section 3/rule 5).
// Adding a marker should only ever mean a JSON edit under public/bundles/
// plus an asset drop, never a code change.
export type Vec3 = [number, number, number]

export interface ContentItem {
  type: 'model' | 'video' | 'dom' | 'game'
  // model
  src?: string
  animation?: string
  // video
  alpha?: 'none' | 'packed'
  loop?: boolean
  // dom
  component?: string
  props?: Record<string, unknown>
  // game — a tappable canvas-texture plane anchored in 3D (tilts with the
  // marker), unlike a 'dom' item's camera-facing screen-space overlay.
  // gameId keys its score in gameSurfaceStore; pair it with a 'dom' item
  // using the SurfaceScore component and the same gameId to display it.
  gameId?: string
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
