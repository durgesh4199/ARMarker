import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { setArSession } from '../ar/arSessionStore'
import { createVideoElements, unlockVideoElements } from '../ar/prepareVideoElements'
import { parseCatalog } from '../content/catalog'
import { parseBundle } from '../content/schema'
import type { Bundle } from '../content/types'
import { PillButton } from '../dom/PillButton'
import { ScanMarkIcon } from '../dom/icons'
import { usePageTransition } from '../dom/usePageTransition'

const CATALOG_URL = '/bundles/catalog.json'

// Resolves a bundle's manifest URL. BundlePicker already knows it and
// passes it via router state (cheap, avoids a second fetch); a direct
// visit to this route (refresh, deep link) has no state, so fall back to
// looking the id up in the catalog.
async function resolveManifestUrl(bundleId: string, stateManifestUrl: unknown): Promise<string> {
  if (typeof stateManifestUrl === 'string') return stateManifestUrl
  const response = await fetch(CATALOG_URL)
  if (!response.ok) throw new Error(`failed to fetch ${CATALOG_URL}: HTTP ${response.status}`)
  const entry = parseCatalog(await response.json()).find((e) => e.id === bundleId)
  if (!entry) throw new Error(`no bundle "${bundleId}" in the catalog`)
  return entry.manifestUrl
}

export function HowToScan() {
  const { bundleId } = useParams<{ bundleId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const pageTransition = usePageTransition()
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bundleId) return
    let cancelled = false
    resolveManifestUrl(bundleId, (location.state as { manifestUrl?: unknown } | null)?.manifestUrl)
      .then((manifestUrl) => fetch(manifestUrl))
      .then((response) => {
        if (!response.ok) throw new Error(`failed to fetch bundle manifest: HTTP ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (!cancelled) setBundle(parseBundle(data))
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
    // location.state is only read on the initial resolve; re-running this
    // on every state identity change isn't needed for a route that's
    // entered once per navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleId])

  // The single user gesture that starts the AR session — see
  // prepareVideoElements.ts. Everything here must run synchronously, no
  // awaits before the unlock, so the browser still attributes it to this
  // tap by the time it reaches getUserMedia inside ARStage.
  const handleGotIt = () => {
    if (!bundle || !bundleId) return
    const videoElements = createVideoElements(bundle)
    unlockVideoElements(videoElements)
    setArSession({ bundle, videoElements })
    navigate(`/ar/${bundleId}`)
  }

  return (
    <motion.main
      {...pageTransition}
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 24px calc(24px + env(safe-area-inset-bottom))',
        textAlign: 'center',
      }}
    >
      <div style={{ flex: 1 }} />

      <div
        style={{
          position: 'relative',
          width: 220,
          height: 220,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 130,
            height: 190,
            borderRadius: 16,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            transform: 'translate(-28px, 10px) rotate(-8deg)',
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 140,
            height: 210,
            borderRadius: 20,
            background: 'var(--bg-elevated-hover)',
            border: '1px solid var(--border-strong)',
            transform: 'rotate(6deg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ScanMarkIcon width={64} height={64} style={{ color: 'var(--accent)' }} />
        </div>
      </div>

      <h1 style={{ fontSize: 24, margin: '32px 0 8px' }}>Frame the marker to begin</h1>
      <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 320 }}>
        Hold your phone steady and keep the marker card inside the guide.
      </p>
      <p style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 1, color: 'var(--text-tertiary)' }}>
        WORKS BEST IN GOOD LIGHTING
      </p>

      {error && <p style={{ color: 'var(--status-lost)' }}>{error}</p>}

      <div style={{ flex: 1 }} />

      <PillButton onClick={handleGotIt} disabled={!bundle}>
        {bundle ? 'Got it' : 'Loading…'}
      </PillButton>
    </motion.main>
  )
}
