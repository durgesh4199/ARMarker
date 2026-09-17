import * as THREE from 'three'
import type { ContentItem } from '../../content/types'

// position is metres relative to the marker centre, rotation is radians,
// scale is a uniform number or a per-axis Vec3 (CLAUDE.md section 3).
export function applyTransform(object: THREE.Object3D, item: ContentItem) {
  if (item.position) object.position.set(...item.position)
  if (item.rotation) object.rotation.set(...item.rotation)
  if (item.scale !== undefined) {
    if (typeof item.scale === 'number') object.scale.setScalar(item.scale)
    else object.scale.set(...item.scale)
  }
}
