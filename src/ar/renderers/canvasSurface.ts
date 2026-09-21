import * as THREE from 'three'
import type { ContentItem } from '../../content/types'
import { applyTransform } from './applyTransform'

const CANVAS_WIDTH = 256

export interface CanvasSurface {
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  canvasHeight: number
  mesh: THREE.Mesh
  markDirty(): void
  dispose(): void
}

// Shared setup for every canvas-texture-plane 'game' variant (see
// gameSurfaceRenderer.ts and runnerGameRenderer.ts): a real anchored
// Object3D with a 2D canvas painted onto it via CanvasTexture, so it
// tilts in perspective with the marker like any other 3D content —
// unlike a 'dom' item's camera-facing screen-space overlay.
export function createCanvasSurface(item: ContentItem, anchor: THREE.Group): CanvasSurface {
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

  return {
    ctx,
    canvasWidth,
    canvasHeight,
    mesh,
    markDirty() {
      texture.needsUpdate = true
    },
    dispose() {
      texture.dispose()
      geometry.dispose()
      material.dispose()
      mesh.removeFromParent()
    },
  }
}
