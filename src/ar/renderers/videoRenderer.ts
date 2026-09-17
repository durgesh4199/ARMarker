import * as THREE from 'three'
import type { ContentItem } from '../../content/types'
import { applyTransform } from './applyTransform'
import type { ContentHandle } from './types'

// alpha: 'packed' (RGB-left/alpha-right recombined via a custom shader) is
// a real manifest option (CLAUDE.md section 5.2) but none of the current
// content needs it (see CLAUDE.md's answers), and the brief explicitly
// says to skip it entirely in M3 when that's the case. A manifest that
// asks for it anyway gets a loud warning and the plain path, rather than
// silently doing nothing or crashing on an unimplemented feature.
export function createVideoRenderer(item: ContentItem, anchor: THREE.Group, video: HTMLVideoElement): ContentHandle {
  if (item.alpha === 'packed') {
    console.warn(
      `content item "${item.src}" requests alpha: 'packed', but the alpha-packed shader isn't implemented (skipped per CLAUDE.md's answers — no video needs transparency) — rendering opaque`,
    )
  }

  const texture = new THREE.VideoTexture(video)
  texture.colorSpace = THREE.SRGBColorSpace

  const [width, height] = item.size ?? [1, 1]
  const geometry = new THREE.PlaneGeometry(width, height)
  const material = new THREE.MeshBasicMaterial({ map: texture })

  const mesh = new THREE.Mesh(geometry, material)
  applyTransform(mesh, item)
  anchor.add(mesh)

  return {
    show() {
      // Resume, not restart — CLAUDE.md section 5.2 says pause on
      // targetLost and resume on targetFound, not replay from the top.
      video.play().catch((error: unknown) => console.warn(`failed to resume video "${item.src}" on targetFound`, error))
    },
    hide() {
      video.pause()
    },
    dispose() {
      video.pause()
      texture.dispose()
      geometry.dispose()
      material.dispose()
      mesh.removeFromParent()
      // Deliberately does not touch video.src or call video.load(): this
      // <video> element is owned by whoever created it for the autoplay-
      // unlock step (prepareVideoElements.ts), not by this handle, and the
      // same element can be reused across ARStage instances (e.g. React 18
      // StrictMode's dev-mode double-mount reuses the same bundle's video
      // elements for its second, real mount). Fully releasing the element
      // is that owner's job once a bundle is torn down for good — no UI
      // path does that yet (M5's bundle picker will need one).
    },
  }
}
