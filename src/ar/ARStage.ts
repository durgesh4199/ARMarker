import * as THREE from 'three'
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js'
import type { Bundle, TargetEntry } from '../content/types'
import { videoElementKey } from './prepareVideoElements'
import { createContentHandle } from './renderers/createContentHandle'
import type { ContentHandle } from './renderers/types'

type ARStageEventMap = {
  targetFound: [target: TargetEntry]
  targetLost: [target: TargetEntry]
  error: [error: unknown]
}

type ARStageEvent = keyof ARStageEventMap

export interface ARStageStartOptions {
  // Forwarded to MindARThree's OneEuroFilter, which smooths the raw pose
  // matrix every frame. minCutOff is the smoothing strength while roughly
  // still (lower = smoother but more lag); beta is how much a fast pose
  // change is allowed to cut through that smoothing (lower = smoother
  // during motion too, but more lag while moving). MindAR's own defaults
  // (minCutOff 0.001, beta 1000) are tuned loosely for its own demo
  // markers — leave unset to use them, or tune here once you can see the
  // effect live on a device: if content drifts/wobbles while the phone
  // and marker are both still, try a lower minCutOff first.
  filterMinCF?: number
  filterBeta?: number
  // Pre-created, already autoplay-unlocked <video> elements for this
  // bundle's video content items, keyed by videoElementKey(targetIndex,
  // contentIndex) — see prepareVideoElements.ts for why these can't be
  // created here instead (the unlock has to happen synchronously within
  // the user gesture that starts the session, before ARStage exists).
  videoElements?: Map<string, HTMLVideoElement>
}

interface TargetState {
  entry: TargetEntry
  handles: ContentHandle[]
}

// Plain TS, no React. Owns the MindAR instance, the three.js
// renderer/scene/camera, one anchor group per target in the bundle, the
// render loop, and every content renderer's resources. M3/M4 add the
// video and DOM renderers behind the same createContentHandle dispatch;
// M6 adds lazy per-target asset loading (everything here loads eagerly at
// bundle start, which is deliberately simpler and fine for a handful of
// targets — see the build order in CLAUDE.md).
export class ARStage {
  private container: HTMLElement
  private mindar: MindARThree | null = null
  private renderLoopId: number | null = null
  private resizeListener: EventListenerOrEventListenerObject | null = null
  private disposed = false
  private clock = new THREE.Clock()
  private targets = new Map<number, TargetState>()
  private raycaster = new THREE.Raycaster()
  private interactionCanvas: HTMLCanvasElement | null = null
  private pointerDownHandler: ((event: PointerEvent) => void) | null = null
  // True from the moment start() is called until mindar.start() has
  // settled (resolved or rejected). MindARThree.start() has no
  // cancellation support, so a dispose() that lands mid-flight (React 18
  // StrictMode's synchronous mount -> cleanup -> mount does this on every
  // dev render) can't abort it — it can only stop whatever camera stream
  // already landed and let the in-flight start() do the real teardown
  // once it resumes. This flag is how dispose() tells the two cases apart.
  private starting = false
  private listeners: { [K in ARStageEvent]: Set<(...args: ARStageEventMap[K]) => void> } = {
    targetFound: new Set(),
    targetLost: new Set(),
    error: new Set(),
  }

  constructor(container: HTMLElement) {
    this.container = container
  }

  on<K extends ARStageEvent>(event: K, cb: (...args: ARStageEventMap[K]) => void) {
    this.listeners[event].add(cb as (...args: unknown[]) => void)
  }

  off<K extends ARStageEvent>(event: K, cb: (...args: ARStageEventMap[K]) => void) {
    this.listeners[event].delete(cb as (...args: unknown[]) => void)
  }

  private emit<K extends ARStageEvent>(event: K, ...args: ARStageEventMap[K]) {
    for (const cb of this.listeners[event]) (cb as (...args: ARStageEventMap[K]) => void)(...args)
  }

  async start(bundle: Bundle, options: ARStageStartOptions = {}) {
    if (this.mindar || this.disposed) return
    this.starting = true

    // MindARThree registers a 'resize' listener on window in its
    // constructor and never removes it (see three.js:46 in mind-ar's
    // source). We capture the exact listener function here so
    // teardownMindAR() can remove it — otherwise every start()/dispose()
    // cycle leaks one window listener holding the whole controller/
    // renderer graph alive.
    let capturedResizeListener: EventListenerOrEventListenerObject | null = null
    const originalAddEventListener = window.addEventListener.bind(window)
    window.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      addOptions?: boolean | AddEventListenerOptions,
    ) => {
      if (type === 'resize') capturedResizeListener = listener
      return originalAddEventListener(type, listener, addOptions)
    }) as typeof window.addEventListener

    let mindar: MindARThree
    try {
      mindar = new MindARThree({
        container: this.container,
        imageTargetSrc: bundle.mindFile,
        filterMinCF: options.filterMinCF ?? null,
        filterBeta: options.filterBeta ?? null,
      })
    } finally {
      window.addEventListener = originalAddEventListener
    }
    this.mindar = mindar
    this.resizeListener = capturedResizeListener

    // MindAR's scene ships with zero lights (see mind-ar's three.js
    // source — it only ever calls `new Scene()`). MeshStandardMaterial
    // (what the model renderer's GLTF assets use, and what real PBR export
    // pipelines like Blender's glTF exporter produce) renders pure black
    // with no light to shade it — model content silently looked like a
    // black silhouette with no visible shading, which also makes a
    // rotating near-symmetric shape (an icosahedron) look motionless even
    // while its animation genuinely advances. A plain ambient + directional
    // light is enough for AR content composited over a camera feed; this
    // isn't meant to be the final lighting design.
    mindar.scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(0.5, 1, 0.8)
    mindar.scene.add(keyLight)

    for (const target of bundle.targets) {
      const anchor = mindar.addAnchor(target.index)
      const handles = target.content.map((item, contentIndex) =>
        createContentHandle(item, anchor.group, mindar.renderer, options.videoElements?.get(videoElementKey(target.index, contentIndex))),
      )
      this.targets.set(target.index, { entry: target, handles })

      anchor.onTargetFound = () => {
        for (const handle of handles) handle.show()
        this.emit('targetFound', target)
      }
      anchor.onTargetLost = () => {
        for (const handle of handles) handle.hide()
        this.emit('targetLost', target)
      }
    }

    // Tap-to-interact: any content handle that exposes both `object` and
    // `onInteract` gets hit-tested on pointerdown. Raycasting an invisible
    // object (marker not currently found) naturally intersects nothing —
    // three.js's Raycaster skips objects with visible === false — so
    // there's no need to separately check whether a target is anchored.
    const canvas = mindar.renderer.domElement
    const pointer = new THREE.Vector2()
    const onPointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      this.raycaster.setFromCamera(pointer, mindar.camera)

      const objectToHandle = new Map<THREE.Object3D, ContentHandle>()
      const interactiveObjects: THREE.Object3D[] = []
      for (const { handles } of this.targets.values()) {
        for (const handle of handles) {
          if (handle.object && handle.onInteract) {
            interactiveObjects.push(handle.object)
            objectToHandle.set(handle.object, handle)
          }
        }
      }
      if (interactiveObjects.length === 0) return

      const hit = this.raycaster.intersectObjects(interactiveObjects, true)[0]
      if (!hit) return

      // The raycast hits a leaf mesh, not necessarily the root object
      // registered above, so walk up to find which handle it belongs to.
      let node: THREE.Object3D | null = hit.object
      while (node) {
        const handle = objectToHandle.get(node)
        if (handle) {
          handle.onInteract?.()
          return
        }
        node = node.parent
      }
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    this.interactionCanvas = canvas
    this.pointerDownHandler = onPointerDown

    try {
      await mindar.start()
    } catch (error) {
      this.starting = false
      this.emit('error', error)
      this.teardownMindAR()
      return
    }
    this.starting = false

    // dispose() may have run while we were awaiting camera permission and
    // target-file loading. Tear down instead of starting the render loop
    // on a stage that's already meant to be gone.
    if (this.disposed) {
      this.teardownMindAR()
      return
    }

    this.clock.start()
    const tick = () => {
      const delta = this.clock.getDelta()
      for (const { handles } of this.targets.values()) {
        for (const handle of handles) handle.update?.(delta)
      }
      mindar.renderer.render(mindar.scene, mindar.camera)
      mindar.cssRenderer.render(mindar.cssScene, mindar.camera)
      this.renderLoopId = requestAnimationFrame(tick)
    }
    tick()
  }

  private teardownMindAR() {
    if (this.renderLoopId !== null) {
      cancelAnimationFrame(this.renderLoopId)
      this.renderLoopId = null
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener)
      this.resizeListener = null
    }
    if (this.interactionCanvas && this.pointerDownHandler) {
      this.interactionCanvas.removeEventListener('pointerdown', this.pointerDownHandler)
      this.interactionCanvas = null
      this.pointerDownHandler = null
    }
    try {
      this.mindar?.stop()
    } catch {
      // stop() reaches into video.srcObject; if getUserMedia never
      // resolved there's no stream to stop, and that's fine.
    }
    for (const { handles } of this.targets.values()) {
      for (const handle of handles) handle.dispose()
    }
    this.targets.clear()
    this.mindar?.renderer.dispose()
    this.mindar = null
  }

  stop() {
    this.teardownMindAR()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true

    if (this.starting) {
      // start() is still awaiting mindar.start(); it will notice
      // `disposed` once that settles and call teardownMindAR() itself
      // (see the check above). Nulling this.mindar here would make that
      // later call a no-op and leak whatever it's holding, so leave full
      // teardown to it — just stop the camera immediately if the stream
      // already landed, so it's not left running for however much longer
      // the rest of setup takes.
      const stream = this.mindar?.video?.srcObject
      if (stream instanceof MediaStream) {
        for (const track of stream.getTracks()) track.stop()
      }
    } else {
      this.teardownMindAR()
    }

    this.container.replaceChildren()
  }
}
