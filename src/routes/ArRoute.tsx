import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { ARStage } from '../ar/ARStage'
import { ArHud } from '../ar/ArHud'
import { takeArSession } from '../ar/arSessionStore'
import { useFilterParams } from '../ar/useFilterParams'
import type { Bundle } from '../content/types'
import { DebugOverlay } from '../debug/DebugOverlay'
import { useDebugStore } from '../debug/debugStore'
import { useDebugMode } from '../debug/useDebugMode'

// mind-ar pulls in tfjs and its own CV pipeline (~1.5MB) — defer loading
// it until this route actually mounts, instead of paying for it on every
// page load.
const ARView = lazy(() => import('../ar/ARView').then((m) => ({ default: m.ARView })))

const errorBannerStyle = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '12px 16px',
  background: 'var(--status-lost)',
  color: '#1a1200',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
  zIndex: 3,
} as const

export function ArRoute() {
  const { bundleId } = useParams<{ bundleId: string }>()
  const navigate = useNavigate()
  const debugMode = useDebugMode()
  const { filterMinCF, filterBeta } = useFilterParams()
  const setTarget = useDebugStore((s) => s.setTarget)
  const domOverlayRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<ARStage | null>(null)
  // A one-shot value handed off by HowToScan's "Got it" tap — read via a
  // lazy initializer so it's taken exactly once, at mount, not something
  // this route re-derives on every render.
  const [session] = useState(() => takeArSession())

  useEffect(() => {
    if (!session) {
      // Reached directly (refresh, deep link, back/forward) without going
      // through the gesture that unlocks video autoplay — there's no way
      // to recover that here, so send them back to redo it.
      navigate(bundleId ? `/how-to-scan/${bundleId}` : '/bundles', { replace: true })
    }
  }, [bundleId, navigate, session])

  const handleStage = useCallback(
    (newStage: ARStage) => {
      newStage.on('targetFound', (target) => setTarget(target.index, target.name))
      newStage.on('targetLost', () => setTarget(null, null))
      newStage.on('error', (err) => setError(err instanceof Error ? err.message : String(err)))
      setStage(newStage)
    },
    [setTarget],
  )

  if (!session) return null

  const bundle: Bundle = session.bundle

  return (
    <>
      <Suspense fallback={<div style={{ padding: 24 }}>Loading AR runtime…</div>}>
        <ARView
          bundle={bundle}
          filterMinCF={filterMinCF}
          filterBeta={filterBeta}
          videoElements={session.videoElements}
          domOverlayRef={domOverlayRef}
          onStage={handleStage}
        />
      </Suspense>
      <div ref={domOverlayRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2 }} />
      <ArHud stage={stage} />
      {error && <div style={errorBannerStyle}>AR failed to start: {error}</div>}
      {debugMode && <DebugOverlay />}
    </>
  )
}
