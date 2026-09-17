import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import * as THREE from 'three'
import type { ContentItem } from '../../content/types'
import { componentRegistry } from '../../dom/componentRegistry'
import { applyTransform } from './applyTransform'
import type { ContentHandle } from './types'

const noopHandle: ContentHandle = { show() {}, hide() {}, dispose() {} }

// Per CLAUDE.md section 5.3: no WebGL text. A plain (invisible)
// Object3D carries the manifest's position/rotation/scale purely so its
// world position can be tracked; the actual visuals are a real React
// component rendered into a DOM node placed by direct style mutation
// each frame (never setState) — no React re-render is on the hot path.
export function createDomRenderer(item: ContentItem, anchor: THREE.Group, camera: THREE.Camera, overlayContainer: HTMLElement): ContentHandle {
  const Component = item.component ? componentRegistry[item.component] : undefined
  if (!item.component || !Component) {
    console.warn(`dom content item references component "${item.component}", which isn't in the registry — skipping`, item)
    return noopHandle
  }

  const trackedObject = new THREE.Object3D()
  applyTransform(trackedObject, item)
  anchor.add(trackedObject)

  const wrapper = document.createElement('div')
  wrapper.style.position = 'absolute'
  wrapper.style.left = '0'
  wrapper.style.top = '0'
  wrapper.style.display = 'none'
  overlayContainer.appendChild(wrapper)

  const root: Root = createRoot(wrapper)
  root.render(createElement(Component, item.props))

  let found = false
  const worldPosition = new THREE.Vector3()
  const projected = new THREE.Vector3()

  return {
    show() {
      found = true
    },
    hide() {
      found = false
      wrapper.style.display = 'none'
    },
    update() {
      if (!found) return

      trackedObject.updateWorldMatrix(true, false)
      worldPosition.setFromMatrixPosition(trackedObject.matrixWorld)
      projected.copy(worldPosition).project(camera)

      // Behind the camera (or past the far plane) — CLAUDE.md section 5.3
      // says to hide in this case even though the target is still found
      // (e.g. an extreme viewing angle can put an offset anchor point
      // behind the camera even while the marker itself is barely in view).
      if (projected.z > 1) {
        wrapper.style.display = 'none'
        return
      }

      const width = overlayContainer.clientWidth
      const height = overlayContainer.clientHeight
      const x = (projected.x * 0.5 + 0.5) * width
      const y = (-projected.y * 0.5 + 0.5) * height

      wrapper.style.display = ''
      wrapper.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
    },
    dispose() {
      root.unmount()
      wrapper.remove()
    },
  }
}
