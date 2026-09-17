import * as THREE from 'three'
import type { ContentItem } from '../../content/types'
import { createModelRenderer } from './modelRenderer'
import type { ContentHandle } from './types'
import { createVideoRenderer } from './videoRenderer'

const noopHandle: ContentHandle = { show() {}, hide() {}, dispose() {} }

// 'dom' is a real manifest type (see content/types.ts) but its renderer
// lands in M4 per the build order — a bundle that references it today
// gets a loud console warning and a no-op handle rather than a crash.
export function createContentHandle(
  item: ContentItem,
  anchor: THREE.Group,
  renderer: THREE.WebGLRenderer,
  videoElement?: HTMLVideoElement,
): ContentHandle {
  switch (item.type) {
    case 'model':
      return createModelRenderer(item, anchor, renderer)
    case 'video':
      if (!videoElement) {
        console.warn('video content item has no pre-created <video> element — the autoplay-unlock step must have missed it; skipping', item)
        return noopHandle
      }
      return createVideoRenderer(item, anchor, videoElement)
    case 'dom':
      console.warn(`content type "dom" has no renderer yet (lands in M4) — skipping`, item)
      return noopHandle
  }
}
