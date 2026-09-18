import type * as THREE from 'three'

// Each content renderer takes a ContentItem and an anchor THREE.Group and
// returns a handle like this (CLAUDE.md section 5). update() is optional —
// only renderers that need per-frame work (the model renderer's
// AnimationMixer) implement it; ARStage calls it on every handle each tick
// regardless. object/onInteract are also optional — a renderer that wants
// its content to respond to a tap exposes the object to hit-test against
// and the callback to run on a hit; ARStage owns the actual raycasting
// (see its pointerdown handling), not any individual renderer.
export interface ContentHandle {
  show(): void
  hide(): void
  dispose(): void
  update?(deltaSeconds: number): void
  object?: THREE.Object3D
  onInteract?(): void
  // Omit both for content with no meaningful loading phase (dom renders
  // synchronously; video is already preloaded by the autoplay-unlock
  // step) — ARStage treats a handle without isLoading as always ready.
  // While isLoading() returns true, loadProgress() is a 0-1 fraction, or
  // null if indeterminate (e.g. no Content-Length to compute one from).
  isLoading?(): boolean
  loadProgress?(): number | null
}
