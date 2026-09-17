import { lazy, Suspense, useState } from 'react'
import { DebugOverlay } from './debug/DebugOverlay'
import { useDebugStore } from './debug/debugStore'
import { useDebugMode } from './debug/useDebugMode'

const M1_IMAGE_TARGET_SRC = '/targets/m1-spike.mind'

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

function App() {
  const debugMode = useDebugMode()
  const [arStarted, setArStarted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setTarget = useDebugStore((s) => s.setTarget)

  if (arStarted) {
    return (
      <>
        <Suspense fallback={<div style={{ padding: 24 }}>Loading AR runtime…</div>}>
          <ARView
            imageTargetSrc={M1_IMAGE_TARGET_SRC}
            onTargetFound={() => setTarget(0, 'm1-spike-cube')}
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
      <p>Milestone 1 tracking spike: one hardcoded marker, one cube.</p>
      <p>
        Print or display <code>targets/m1-spike/00-cube-marker.png</code> on another screen, then tap Start
        and point the camera at it.
      </p>
      <button type="button" onClick={() => setArStarted(true)}>
        Start AR
      </button>
      {debugMode && <DebugOverlay />}
    </main>
  )
}

export default App
