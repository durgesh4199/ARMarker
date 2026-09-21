import * as THREE from 'three'
import type { ContentItem } from '../../content/types'
import { useGameSurfaceStore } from '../gameSurfaceStore'
import { createCanvasSurface } from './canvasSurface'
import type { ContentHandle } from './types'

const DOT_COLOR = '#22d3ee'
const BG_COLOR = 'rgba(10, 12, 20, 0.85)'
const DOT_RADIUS_FRACTION = 0.09
const MOVE_DURATION = 0.35 // seconds — matches TapGame's CSS transition

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

// The "true 3D" counterpart to the DOM overlay TapGame: a canvas-texture
// plane (see canvasSurface.ts) that's a real anchored Object3D, so unlike
// a screen-space-projected 'dom' item it tilts in perspective with the
// marker. That means it can't take real DOM pointer events, so it reuses
// the same raycast hit-testing ARStage already built for the model
// renderer's tap-to-interact, using the hit's uv to find the tap in
// canvas space. No text is drawn on the canvas (CLAUDE.md section 5.3 is
// specifically about UI text) — the score readout is a separate paired
// 'dom' item (SurfaceScore) reading the same gameId from
// gameSurfaceStore. A tap doesn't relocate the dot instantly — it eases
// to its new spot over MOVE_DURATION, redrawn each frame from update()
// (see the dot/fromDot/toDot/animating state below).
export function createGameSurfaceRenderer(item: ContentItem, anchor: THREE.Group): ContentHandle {
  if (!item.gameId) throw new Error("content item of type 'game' missing 'gameId' (the manifest schema should have caught this)")
  const gameId = item.gameId

  const surface = createCanvasSurface(item, anchor)
  const { ctx, canvasWidth, canvasHeight } = surface

  const dotRadius = canvasWidth * DOT_RADIUS_FRACTION

  function randomDot() {
    return {
      x: dotRadius + Math.random() * (canvasWidth - dotRadius * 2),
      y: dotRadius + Math.random() * (canvasHeight - dotRadius * 2),
    }
  }

  let dot = randomDot()
  // Tapping starts a lerp from dot (its current, possibly still-animating
  // position) to a new target — the canvas has no CSS transitions to lean
  // on like TapGame does, so the same easing has to be driven by hand,
  // once per frame, from ARStage's existing update() loop.
  const fromDot = { ...dot }
  const toDot = { ...dot }
  let animElapsed = 0
  let animating = false

  function draw() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    ctx.beginPath()
    ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2)
    ctx.fillStyle = DOT_COLOR
    ctx.fill()
    surface.markDirty()
  }
  draw()

  // Score starts at 0 once, when content loads at bundle start (see
  // ARStage's class doc comment) — not on every show(), which fires on
  // every re-find and would wipe the score on a momentary tracking
  // flicker rather than only at the start of a real play session.
  useGameSurfaceStore.getState().startGame(gameId)

  return {
    object: surface.mesh,
    // MindAR toggles the anchor group's own visibility on found/lost (see
    // ARStage's comment on why an invisible object naturally skips
    // raycasting) — nothing else needs to happen here, same as the video
    // renderer's plane mesh.
    show() {},
    hide() {},
    // uv.y is bottom-up in three.js's convention; canvas y is top-down.
    onInteract(uv) {
      if (!uv) return
      // Hit-test against `dot`, the currently *drawn* position — if a tap
      // lands mid-transition, that's the one that should register, not
      // wherever the previous or next target happens to be.
      const px = uv.x * canvasWidth
      const py = (1 - uv.y) * canvasHeight
      const dx = px - dot.x
      const dy = py - dot.y
      if (dx * dx + dy * dy > dotRadius * dotRadius) return
      fromDot.x = dot.x
      fromDot.y = dot.y
      const next = randomDot()
      toDot.x = next.x
      toDot.y = next.y
      animElapsed = 0
      animating = true
      useGameSurfaceStore.getState().increment(gameId)
    },
    update(deltaSeconds) {
      if (!animating) return
      animElapsed += deltaSeconds
      const t = Math.min(animElapsed / MOVE_DURATION, 1)
      const eased = easeOutCubic(t)
      dot = { x: fromDot.x + (toDot.x - fromDot.x) * eased, y: fromDot.y + (toDot.y - fromDot.y) * eased }
      draw()
      if (t >= 1) animating = false
    },
    dispose() {
      surface.dispose()
    },
  }
}
