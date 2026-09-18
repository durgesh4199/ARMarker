import { motion } from 'motion/react'
import { useNavigate } from 'react-router'
import { PillButton } from '../dom/PillButton'
import { ScanMarkIcon } from '../dom/icons'
import { usePageTransition } from '../dom/usePageTransition'
import { usePrefersReducedMotion } from '../dom/usePrefersReducedMotion'

export function Home() {
  const navigate = useNavigate()
  const pageTransition = usePageTransition()
  const reducedMotion = usePrefersReducedMotion()

  return (
    <motion.main
      {...pageTransition}
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 24px calc(24px + env(safe-area-inset-bottom))',
        textAlign: 'center',
        gap: 16,
      }}
    >
      <motion.div
        animate={reducedMotion ? undefined : { scale: [1, 1.06, 1] }}
        transition={reducedMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ color: 'var(--accent)' }}
      >
        <ScanMarkIcon width={72} height={72} />
      </motion.div>
      <h1 style={{ fontSize: 32, margin: '8px 0 0' }}>ARMarker</h1>
      <p style={{ margin: 0, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: 2 }}>
        POINT · SCAN · DISCOVER
      </p>

      <div style={{ flex: 1 }} />

      <div style={{ width: '100%', maxWidth: 360 }}>
        <PillButton onClick={() => navigate('/bundles')}>Start Scanning →</PillButton>
        <p style={{ marginTop: 12, color: 'var(--text-tertiary)', fontSize: 13 }}>
          No app download · scans right in your browser
        </p>
      </div>
    </motion.main>
  )
}
