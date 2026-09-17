import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import type { ContentItem } from '../../content/types'
import { applyTransform } from './applyTransform'
import type { ContentHandle } from './types'

// DRACO/KTX2 decoders are loaded once and shared across every model in a
// bundle rather than per content item — they own their own wasm/worker
// state and there's no reason to duplicate that per mesh.
let sharedDracoLoader: DRACOLoader | null = null
let sharedKtx2Loader: KTX2Loader | null = null

function getGLTFLoader(renderer: THREE.WebGLRenderer): GLTFLoader {
  sharedDracoLoader ??= new DRACOLoader().setDecoderPath('/decoders/draco/gltf/')
  sharedKtx2Loader ??= new KTX2Loader().setTranscoderPath('/decoders/basis/')
  sharedKtx2Loader.detectSupport(renderer)

  const loader = new GLTFLoader()
  loader.setDRACOLoader(sharedDracoLoader)
  loader.setKTX2Loader(sharedKtx2Loader)
  return loader
}

function hasColor(material: THREE.Material): material is THREE.Material & { color: THREE.Color } {
  return (material as { color?: unknown }).color instanceof THREE.Color
}

// Deliberately excludes the placeholder's own blue (0x2f7de1) — the first
// tap needs to look different immediately, not cycle back to the color
// that was already there.
const TAP_PALETTE = [0xe15c4f, 0x4fe17d, 0xe1c94f, 0xb14fe1]
const PUNCH_DURATION = 0.35

// GLTFLoader.load() is async and there's no reason to block the render
// loop on it — the handle is usable immediately, and any show()/hide()
// called before the model finishes loading is remembered and applied once
// it does.
export function createModelRenderer(item: ContentItem, anchor: THREE.Group, renderer: THREE.WebGLRenderer): ContentHandle {
  if (!item.src) throw new Error("model content item missing 'src' (the manifest schema should have caught this)")

  const group = new THREE.Group()
  applyTransform(group, item)
  const baseScale = group.scale.clone()
  anchor.add(group)

  let disposed = false
  let visible = false
  let mixer: THREE.AnimationMixer | null = null
  let action: THREE.AnimationAction | null = null
  const disposableMaterials = new Set<THREE.Material>()
  const disposableGeometries = new Set<THREE.BufferGeometry>()
  const colorMaterials: (THREE.Material & { color: THREE.Color })[] = []
  let tapColorIndex = -1
  let punchElapsed = -1 // -1 means no punch in progress

  getGLTFLoader(renderer).load(
    item.src,
    (gltf) => {
      if (disposed) return

      group.add(gltf.scene)
      group.visible = visible

      gltf.scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return
        disposableGeometries.add(obj.geometry)
        for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
          disposableMaterials.add(material)
          if (hasColor(material)) colorMaterials.push(material)
        }
      })

      if (item.animation) {
        const clip = gltf.animations.find((c) => c.name === item.animation)
        if (!clip) {
          console.warn(`model "${item.src}" has no animation clip named "${item.animation}"`)
        } else {
          mixer = new THREE.AnimationMixer(gltf.scene)
          action = mixer.clipAction(clip)
          action.paused = !visible
          action.play()
        }
      }
    },
    undefined,
    (error) => console.error(`failed to load model "${item.src}"`, error),
  )

  return {
    object: group,
    show() {
      visible = true
      group.visible = true
      if (action) action.paused = false
    },
    hide() {
      visible = false
      group.visible = false
      if (action) action.paused = true
    },
    // Demo interaction, just to prove tap-to-object hit-testing works end
    // to end (raycasting is ARStage's job — see its pointerdown handling):
    // cycle the material through a small palette and give it a quick
    // scale punch. Not manifest-driven; if per-content interactivity ends
    // up being a real feature rather than a one-off check, it belongs as
    // a ContentItem field, not hardcoded here.
    onInteract() {
      if (colorMaterials.length > 0) {
        tapColorIndex = (tapColorIndex + 1) % TAP_PALETTE.length
        for (const material of colorMaterials) material.color.setHex(TAP_PALETTE[tapColorIndex])
      }
      punchElapsed = 0
    },
    update(deltaSeconds) {
      mixer?.update(deltaSeconds)

      if (punchElapsed >= 0) {
        punchElapsed += deltaSeconds
        if (punchElapsed >= PUNCH_DURATION) {
          punchElapsed = -1
          group.scale.copy(baseScale)
        } else {
          const t = punchElapsed / PUNCH_DURATION
          const bump = Math.sin(t * Math.PI) * 0.4
          group.scale.copy(baseScale).multiplyScalar(1 + bump)
        }
      }
    },
    dispose() {
      disposed = true
      mixer?.stopAllAction()
      for (const geometry of disposableGeometries) geometry.dispose()
      for (const material of disposableMaterials) material.dispose()
      group.removeFromParent()
    },
  }
}
