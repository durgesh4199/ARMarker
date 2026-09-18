import type { Bundle } from '../content/types'

// HTMLVideoElement instances aren't safely passable through react-router's
// navigation `state` (it isn't guaranteed structured-cloneable the way
// history.pushState's own persisted state must be), so the autoplay-
// unlocked video elements created on the HowToScan "Got it" tap are handed
// to the AR route through plain in-memory module state instead — it
// survives a client-side route change (nothing reloads the page) without
// going anywhere near serialization.
interface ArSession {
  bundle: Bundle
  videoElements: Map<string, HTMLVideoElement>
}

let current: ArSession | null = null

export function setArSession(session: ArSession) {
  current = session
}

// One-shot: each "Got it" tap creates a fresh session (fresh unlocked
// video elements); a stale session from a previous visit shouldn't be
// replayed if the AR route is somehow reached again without going through
// that gesture first.
export function takeArSession(): ArSession | null {
  const session = current
  current = null
  return session
}
