import { useEffect, useRef } from 'react'
import { ARStage, type ARStageStartOptions } from './ARStage'

interface ARViewProps extends ARStageStartOptions {
  imageTargetSrc: string
  onTargetFound?: () => void
  onTargetLost?: () => void
  onError?: (error: unknown) => void
}

// Renders a single container div and nothing else. ARStage is instantiated
// imperatively in an effect with an empty dependency array and must never
// be re-created on prop/state changes — see CLAUDE.md section 4. The
// callback props are read once at mount time for the same reason; M2, which
// needs to swap bundles at runtime, will add imperative methods on ARStage
// instead of relying on effect deps here.
export function ARView({ imageTargetSrc, filterMinCF, filterBeta, onTargetFound, onTargetLost, onError }: ARViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const stage = new ARStage(container)
    if (onTargetFound) stage.on('targetFound', onTargetFound)
    if (onTargetLost) stage.on('targetLost', onTargetLost)
    if (onError) stage.on('error', onError)

    stage.start(imageTargetSrc, { filterMinCF, filterBeta }).catch((error: unknown) => onError?.(error))

    return () => {
      stage.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />
}
