import { useEffect, useRef, type RefObject } from 'react'
import type { Bundle, TargetEntry } from '../content/types'
import { ARStage, type ARStageStartOptions } from './ARStage'

interface ARViewProps extends ARStageStartOptions {
  bundle: Bundle
  // Owned by whoever mounts ARView, not by ARView itself — CLAUDE.md
  // section 4 requires ARView to render "a single div ref container and
  // nothing else"; the DOM overlay layer is a *sibling* layer above the
  // canvas, rendered by the parent. A ref object (not the raw element) is
  // passed so the parent's ref attaches during the same commit ARView's
  // own effect runs after — reading element.current directly as a prop
  // would freeze whatever it was at render time, which is unreliable.
  domOverlayRef: RefObject<HTMLElement | null>
  onTargetFound?: (target: TargetEntry) => void
  onTargetLost?: (target: TargetEntry) => void
  onError?: (error: unknown) => void
}

// Renders a single container div and nothing else. ARStage is instantiated
// imperatively in an effect with an empty dependency array and must never
// be re-created on prop/state changes — see CLAUDE.md section 4. The
// bundle/callback props are read once at mount time for the same reason;
// swapping bundles at runtime (M5's bundle picker) will need an imperative
// method on ARStage instead of relying on effect deps here.
export function ARView({ bundle, filterMinCF, filterBeta, videoElements, domOverlayRef, onTargetFound, onTargetLost, onError }: ARViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const domOverlayContainer = domOverlayRef.current
    if (!container || !domOverlayContainer) return

    const stage = new ARStage(container, domOverlayContainer)
    if (onTargetFound) stage.on('targetFound', onTargetFound)
    if (onTargetLost) stage.on('targetLost', onTargetLost)
    if (onError) stage.on('error', onError)

    stage.start(bundle, { filterMinCF, filterBeta, videoElements }).catch((error: unknown) => onError?.(error))

    return () => {
      stage.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />
}
