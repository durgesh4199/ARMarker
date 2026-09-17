import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createVideoElements, unlockVideoElements } from './ar/prepareVideoElements'
import { parseBundle } from './content/schema'
import type { Bundle } from './content/types'
import { DebugOverlay } from './debug/DebugOverlay'
import { useDebugStore } from './debug/debugStore'
import { useDebugMode } from './debug/useDebugMode'

const BUNDLE_URL = '/bundles/m2-demo.json'

// mind-ar pulls in tfjs and its own CV pipeline (~1.5MB) — defer loading it
// until the user actually taps Start, instead of paying for it on every
// page load.
const ARView = lazy(() => import('./ar/ARView').then((m) => ({ default: m.ARView })))

const errorBannerStyle = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '12px 16px',
  background: '#b91c1c',
  color: '#fff',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
} as const

// Reads ?filterMinCF=&filterBeta= so MindAR's pose-smoothing filter (see
// ARStage's ARStageStartOptions doc comment) can be tuned live from a
// phone, without a redeploy per guess.
function useFilterParams() {
  const params = new URLSearchParams(window.location.search)
  const minCF = params.get('filterMinCF')
  const beta = params.get('filterBeta')
  return {
    filterMinCF: minCF !== null ? Number(minCF) : undefined,
    filterBeta: beta !== null ? Number(beta) : undefined,
  }
}

function App() {
  const debugMode = useDebugMode()
  const { filterMinCF, filterBeta } = useFilterParams()
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [arStarted, setArStarted] = useState(false)
  const [videoElements, setVideoElements] = useState<Map<string, HTMLVideoElement>>()
  const [error, setError] = useState<string | null>(null)
  const setTarget = useDebugStore((s) => s.setTarget)
  // The DOM-overlay sibling layer CLAUDE.md section 4 calls for — rendered
  // here (ARView's parent), not inside ARView, which must stay "a single
  // div ref container and nothing else." pointer-events: none by default;
  // an individual overlay component opts in with its own pointer-events:
  // auto if it actually needs clicks.
  const domOverlayRef = useRef<HTMLDivElement>(null)

  // Fetched ahead of the Start tap (not inside its click handler) so that
  // handleStart can unlock video autoplay synchronously within the user
  // gesture — see prepareVideoElements.ts. A network round-trip between
  // the click and the play()/pause() unlock calls risks losing the
  // gesture's "transient activation" window, especially on iOS Safari.
  useEffect(() => {
    let cancelled = false
    fetch(BUNDLE_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`failed to fetch ${BUNDLE_URL}: HTTP ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (!cancelled) setBundle(parseBundle(data))
      })
      .catch((err: unknown) => {
        // A malformed manifest or a failed fetch must fail loudly in the
        // UI, not render nothing (CLAUDE.md section 10).
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleStart = () => {
    if (!bundle) return
    const elements = createVideoElements(bundle)
    unlockVideoElements(elements)
    setVideoElements(elements)
    setArStarted(true)
  }

  if (arStarted && bundle) {
    return (
      <>
        <Suspense fallback={<div style={{ padding: 24 }}>Loading AR runtime…</div>}>
          <ARView
            bundle={bundle}
            filterMinCF={filterMinCF}
            filterBeta={filterBeta}
            videoElements={videoElements}
            domOverlayRef={domOverlayRef}
            onTargetFound={(target) => setTarget(target.index, target.name)}
            onTargetLost={() => setTarget(null, null)}
            onError={(err) => setError(err instanceof Error ? err.message : String(err))}
          />
        </Suspense>
        <div ref={domOverlayRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }} />
        {error && <div style={errorBannerStyle}>AR failed to start: {error}</div>}
        {debugMode && <DebugOverlay />}
      </>
    )
  }

  return (
    <main style={{ padding: 24, textAlign: 'center' }}>
      <h1>ARMarker</h1>
      <p>Milestone 3: manifest-driven bundle with model and video renderers.</p>
      <p>
        Print or display <code>targets/m2-demo/00-spin.png</code>,{' '}
        <code>targets/m2-demo/01-static.png</code>, and <code>targets/m2-demo/02-video.png</code>, then
        tap Start and point the camera at any of them — a spinning icosahedron, a static one, and a
        looping test-pattern video, respectively.
      </p>
      <button type="button" onClick={handleStart} disabled={!bundle}>
        {bundle ? 'Start AR' : 'Loading…'}
      </button>
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {debugMode && <DebugOverlay />}
    </main>
  )
}

export default App
