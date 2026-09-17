// Each content renderer takes a ContentItem and an anchor THREE.Group and
// returns a handle like this (CLAUDE.md section 5). update() is optional —
// only renderers that need per-frame work (the model renderer's
// AnimationMixer) implement it; ARStage calls it on every handle each tick
// regardless.
export interface ContentHandle {
  show(): void
  hide(): void
  dispose(): void
  update?(deltaSeconds: number): void
}
