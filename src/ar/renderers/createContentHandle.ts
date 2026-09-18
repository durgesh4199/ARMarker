import * as THREE from 'three'
import type { ContentItem } from '../../content/types'
import { createDomRenderer } from './domRenderer'
import { createGameSurfaceRenderer } from './gameSurfaceRenderer'
import { createModelRenderer } from './modelRenderer'
import type { ContentHandle } from './types'
import { createVideoRenderer } from './videoRenderer'

const noopHandle: ContentHandle = { show() {}, hide() {}, dispose() {} }

export function createContentHandle(
  item: ContentItem,
  anchor: THREE.Group,
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  domOverlayContainer: HTMLElement | null,
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
      if (!domOverlayContainer) {
        console.warn('dom content item has no overlay container to render into — skipping', item)
        return noopHandle
      }
      return createDomRenderer(item, anchor, camera, domOverlayContainer)
    case 'game':
      return createGameSurfaceRenderer(item, anchor)
  }
}
