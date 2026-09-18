import * as THREE from 'three'
import type { ContentItem } from '../../content/types'
import { useGameSurfaceStore } from '../gameSurfaceStore'
import { applyTransform } from './applyTransform'
import type { ContentHandle } from './types'

const CANVAS_WIDTH = 256
const DOT_COLOR = '#22d3ee'
const BG_COLOR = 'rgba(10, 12, 20, 0.85)'
const DOT_RADIUS_FRACTION = 0.09

// The "true 3D" counterpart to the DOM overlay TapGame: a canvas-texture
// plane that's a real anchored Object3D, so unlike a screen-space-
// projected 'dom' item it tilts in perspective with the marker. That
// means it can't take real DOM pointer events, so it reuses the same
// raycast hit-testing ARStage already built for the model renderer's
// tap-to-interact, using the hit's uv to find the tap in canvas space.
// No text is drawn on the canvas (CLAUDE.md section 5.3 is specifically
// about UI text) — the score readout is a separate paired 'dom' item
// (SurfaceScore) reading the same gameId from gameSurfaceStore.
export function createGameSurfaceRenderer(item: ContentItem, anchor: THREE.Group): ContentHandle {
  if (!item.gameId) throw new Error("content item of type 'game' missing 'gameId' (the manifest schema should have caught this)")
  const gameId = item.gameId

  const [width, height] = item.size ?? [1, 1]
  const canvasWidth = CANVAS_WIDTH
  const canvasHeight = Math.round(CANVAS_WIDTH * (height / width))

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for game surface')

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  const geometry = new THREE.PlaneGeometry(width, height)
  const material = new THREE.MeshBasicMaterial({ map: texture })
  const mesh = new THREE.Mesh(geometry, material)
  applyTransform(mesh, item)
  anchor.add(mesh)

  const dotRadius = canvasWidth * DOT_RADIUS_FRACTION

  function randomDot() {
    return {
      x: dotRadius + Math.random() * (canvasWidth - dotRadius * 2),
      y: dotRadius + Math.random() * (canvasHeight - dotRadius * 2),
    }
  }

  let dot = randomDot()

  function draw() {
    ctx!.clearRect(0, 0, canvasWidth, canvasHeight)
    ctx!.fillStyle = BG_COLOR
    ctx!.fillRect(0, 0, canvasWidth, canvasHeight)
    ctx!.beginPath()
    ctx!.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2)
    ctx!.fillStyle = DOT_COLOR
    ctx!.fill()
    texture.needsUpdate = true
  }
  draw()

  // Score starts at 0 once, when content loads at bundle start (see
  // ARStage's class doc comment) — not on every show(), which fires on
  // every re-find and would wipe the score on a momentary tracking
  // flicker rather than only at the start of a real play session.
  useGameSurfaceStore.getState().startGame(gameId)

  return {
    object: mesh,
    // MindAR toggles the anchor group's own visibility on found/lost (see
    // ARStage's comment on why an invisible object naturally skips
    // raycasting) — nothing else needs to happen here, same as the video
    // renderer's plane mesh.
    show() {},
    hide() {},
    // uv.y is bottom-up in three.js's convention; canvas y is top-down.
    onInteract(uv) {
      if (!uv) return
      const px = uv.x * canvasWidth
      const py = (1 - uv.y) * canvasHeight
      const dx = px - dot.x
      const dy = py - dot.y
      if (dx * dx + dy * dy > dotRadius * dotRadius) return
      dot = randomDot()
      draw()
      useGameSurfaceStore.getState().increment(gameId)
    },
    dispose() {
      texture.dispose()
      geometry.dispose()
      material.dispose()
      mesh.removeFromParent()
    },
  }
}
