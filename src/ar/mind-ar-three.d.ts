// mind-ar ships no TypeScript types. This declares only the surface of
// MindARThree that ARStage.ts actually uses, taken from reading
// node_modules/mind-ar/src/image-target/three.js directly (mind-ar has no
// published docs for this API). Re-check this file against that source if
// mind-ar is ever upgraded.
declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from 'three'

  export interface MindARThreeAnchor {
    group: Group
    targetIndex: number
    onTargetFound: (() => void) | null
    onTargetLost: (() => void) | null
    onTargetUpdate: (() => void) | null
  }

  export interface MindARThreeOptions {
    container: HTMLElement
    imageTargetSrc: string
    maxTrack?: number
    uiLoading?: 'yes' | 'no'
    uiScanning?: 'yes' | 'no'
    uiError?: 'yes' | 'no'
    filterMinCF?: number | null
    filterBeta?: number | null
    warmupTolerance?: number | null
    missTolerance?: number | null
    userDeviceId?: string | null
    environmentDeviceId?: string | null
  }

  // Only the subset of three's CSS3DRenderer we call.
  export interface MindARCSSRenderer {
    domElement: HTMLElement
    render(scene: Scene, camera: PerspectiveCamera): void
    setSize(width: number, height: number): void
  }

  export class MindARThree {
    constructor(options: MindARThreeOptions)
    scene: Scene
    cssScene: Scene
    renderer: WebGLRenderer
    cssRenderer: MindARCSSRenderer
    camera: PerspectiveCamera
    video?: HTMLVideoElement
    start(): Promise<void>
    stop(): void
    addAnchor(targetIndex: number): MindARThreeAnchor
    addCSSAnchor(targetIndex: number): MindARThreeAnchor
    resize(): void
  }
}
