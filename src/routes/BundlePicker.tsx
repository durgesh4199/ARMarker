import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { parseCatalog, type BundleCatalogEntry } from '../content/catalog'
import { icons } from '../dom/iconRegistry'
import { PillButton } from '../dom/PillButton'
import { usePageTransition } from '../dom/usePageTransition'

const CATALOG_URL = '/bundles/catalog.json'

export function BundlePicker() {
  const navigate = useNavigate()
  const pageTransition = usePageTransition()
  const [catalog, setCatalog] = useState<BundleCatalogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(CATALOG_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`failed to fetch ${CATALOG_URL}: HTTP ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (cancelled) return
        const entries = parseCatalog(data)
        setCatalog(entries)
        setSelectedId(entries[0]?.id ?? null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selected = catalog?.find((entry) => entry.id === selectedId)

  const handleContinue = () => {
    if (!selected) return
    navigate(`/how-to-scan/${selected.id}`, { state: { manifestUrl: selected.manifestUrl } })
  }

  return (
    <motion.main
      {...pageTransition}
      style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', padding: '24px 20px calc(24px + env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        onClick={() => navigate('/')}
        aria-label="Back"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          border: '1px solid var(--border-strong)',
          background: 'var(--bg-elevated)',
          color: 'var(--text)',
          fontSize: 18,
          cursor: 'pointer',
        }}
      >
        ←
      </button>

      <h1 style={{ fontSize: 28, margin: '20px 0 4px' }}>Choose a Bundle</h1>
      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Select a set of markers to scan in AR</p>

      {error && <p style={{ color: 'var(--status-lost)' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 24 }}>
        {catalog?.map((entry) => {
          const Icon = icons[entry.icon]
          const isSelected = entry.id === selectedId
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedId(entry.id)}
              style={{
                position: 'relative',
                textAlign: 'left',
                padding: 16,
                borderRadius: 16,
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'var(--bg-elevated-hover)',
                  color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Icon width={20} height={20} />
              </div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{entry.title}</div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {entry.markerCount} MARKERS
                </span>
                {entry.badge && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'var(--accent)',
                      color: '#0a0d0a',
                    }}
                  >
                    {entry.badge}
                  </span>
                )}
              </div>
              {isSelected && (
                <span
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: '#0a0d0a',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✓
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1 }} />
      <PillButton onClick={handleContinue} disabled={!selected}>
        Continue
      </PillButton>
    </motion.main>
  )
}
