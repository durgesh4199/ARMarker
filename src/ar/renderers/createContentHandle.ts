import * as THREE from 'three'
import type { ContentItem } from '../../content/types'
import { createModelRenderer } from './modelRenderer'
import type { ContentHandle } from './types'

const noopHandle: ContentHandle = { show() {}, hide() {}, dispose() {} }

// 'video' and 'dom' are real manifest types (see content/types.ts) but
// their renderers land in M3/M4 per the build order — a bundle that
// references them today gets a loud console warning and a no-op handle
// rather than a crash, so M2's multi-target/model-renderer work isn't
// blocked on renderers that don't exist yet.
export function createContentHandle(item: ContentItem, anchor: THREE.Group, renderer: THREE.WebGLRenderer): ContentHandle {
  switch (item.type) {
    case 'model':
      return createModelRenderer(item, anchor, renderer)
    case 'video':
    case 'dom':
      console.warn(`content type "${item.type}" has no renderer yet (lands in M3/M4) — skipping`, item)
      return noopHandle
  }
}
