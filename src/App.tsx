import { lazy, Suspense, useState } from 'react'
import { parseBundle } from './content/schema'
import type { Bundle } from './content/types'
import { DebugOverlay } from './debug/DebugOverlay'
import { useDebugStore } from './debug/debugStore'
import { useDebugMode } from './debug/useDebugMode'

const M2_BUNDLE_URL = '/bundles/m2-demo.json'

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
  const [loadingBundle, setLoadingBundle] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setTarget = useDebugStore((s) => s.setTarget)

  const handleStart = async () => {
    setLoadingBundle(true)
    setError(null)
    try {
      const response = await fetch(M2_BUNDLE_URL)
      if (!response.ok) throw new Error(`failed to fetch ${M2_BUNDLE_URL}: HTTP ${response.status}`)
      setBundle(parseBundle(await response.json()))
    } catch (err) {
      // A malformed manifest or a failed fetch must fail loudly in the UI,
      // not render nothing (CLAUDE.md section 10).
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingBundle(false)
    }
  }

  if (bundle) {
    return (
      <>
        <Suspense fallback={<div style={{ padding: 24 }}>Loading AR runtime…</div>}>
          <ARView
            bundle={bundle}
            filterMinCF={filterMinCF}
            filterBeta={filterBeta}
            onTargetFound={(target) => setTarget(target.index, target.name)}
            onTargetLost={() => setTarget(null, null)}
            onError={(err) => setError(err instanceof Error ? err.message : String(err))}
          />
        </Suspense>
        {error && <div style={errorBannerStyle}>AR failed to start: {error}</div>}
        {debugMode && <DebugOverlay />}
      </>
    )
  }

  return (
    <main style={{ padding: 24, textAlign: 'center' }}>
      <h1>ARMarker</h1>
      <p>Milestone 2: manifest-driven bundle, two markers, model renderer.</p>
      <p>
        Print or display <code>targets/m2-demo/00-spin.png</code> and{' '}
        <code>targets/m2-demo/01-static.png</code>, then tap Start and point the camera at either — a
        spinning icosahedron on the first, a static one on the second.
      </p>
      <button type="button" onClick={handleStart} disabled={loadingBundle}>
        {loadingBundle ? 'Loading…' : 'Start AR'}
      </button>
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {debugMode && <DebugOverlay />}
    </main>
  )
}

export default App
