import type { Bundle } from '../content/types'

// Keys a bundle's video content items by (target index, position within
// that target's content array) — not by src, since two items could share
// a src. ARStage looks videos up by this same key when building content
// handles, so the two must stay in sync.
export function videoElementKey(targetIndex: number, contentIndex: number): string {
  return `${targetIndex}:${contentIndex}`
}

// CLAUDE.md section 5.2: create every video element for the bundle up
// front, not on detection, with muted/playsinline/preload="auto"/
// crossorigin set before playback is ever attempted.
export function createVideoElements(bundle: Bundle): Map<string, HTMLVideoElement> {
  const elements = new Map<string, HTMLVideoElement>()
  for (const target of bundle.targets) {
    target.content.forEach((item, contentIndex) => {
      if (item.type !== 'video' || !item.src) return
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      video.crossOrigin = 'anonymous'
      video.loop = item.loop ?? false
      video.src = item.src
      elements.set(videoElementKey(target.index, contentIndex), video)
    })
  }
  return elements
}

// The iOS autoplay unlock: call play() then immediately pause() on every
// video element, synchronously within the single user gesture that starts
// the AR session (the "Start" button tap) — see CLAUDE.md section 5.2.
// This must be called directly from that click handler, before any await
// (including the bundle fetch — fetch the manifest ahead of time so
// nothing async sits between the click and this call). Without it, video
// works on Android and silently fails to autoplay on iOS.
export function unlockVideoElements(elements: Map<string, HTMLVideoElement>): void {
  for (const video of elements.values()) {
    video
      .play()
      .then(() => video.pause())
      .catch((error: unknown) => {
        console.warn(`autoplay-unlock failed for video "${video.src}" — it may fail to autoplay on marker detection`, error)
      })
  }
}
