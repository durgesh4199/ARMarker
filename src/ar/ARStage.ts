import * as THREE from 'three'
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js'

type ARStageEventMap = {
  targetFound: []
  targetLost: []
  error: [error: unknown]
}

type ARStageEvent = keyof ARStageEventMap

// Plain TS, no React. Owns the MindAR instance, the three.js
// renderer/scene/camera, the anchor group, the render loop, and the one
// hardcoded cube for this tracking spike. M2 replaces the hardcoded cube
// with the manifest-driven content renderers and grows start() to take a
// Bundle instead of a single image-target URL.
export class ARStage {
  private container: HTMLElement
  private mindar: MindARThree | null = null
  private renderLoopId: number | null = null
  private cubeMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshNormalMaterial> | null = null
  private resizeListener: EventListenerOrEventListenerObject | null = null
  private disposed = false
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

  async start(imageTargetSrc: string) {
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
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === 'resize') capturedResizeListener = listener
      return originalAddEventListener(type, listener, options)
    }) as typeof window.addEventListener

    let mindar: MindARThree
    try {
      mindar = new MindARThree({ container: this.container, imageTargetSrc })
    } finally {
      window.addEventListener = originalAddEventListener
    }
    this.mindar = mindar
    this.resizeListener = capturedResizeListener

    const anchor = mindar.addAnchor(0)
    const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6)
    const material = new THREE.MeshNormalMaterial()
    this.cubeMesh = new THREE.Mesh(geometry, material)
    this.cubeMesh.position.set(0, 0, 0.3)
    anchor.group.add(this.cubeMesh)

    anchor.onTargetFound = () => this.emit('targetFound')
    anchor.onTargetLost = () => this.emit('targetLost')

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

    const tick = () => {
      if (this.cubeMesh) this.cubeMesh.rotation.y += 0.02
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
    try {
      this.mindar?.stop()
    } catch {
      // stop() reaches into video.srcObject; if getUserMedia never
      // resolved there's no stream to stop, and that's fine.
    }
    this.cubeMesh?.geometry.dispose()
    this.cubeMesh?.material.dispose()
    this.cubeMesh = null
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
