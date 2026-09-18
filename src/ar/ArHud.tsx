import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { TargetEntry } from '../content/types'
import { usePrefersReducedMotion } from '../dom/usePrefersReducedMotion'
import { ScanMarkIcon } from '../dom/icons'
import type { ARStage } from './ARStage'

type HudState =
  | { kind: 'initializing' }
  | { kind: 'scanning' }
  | { kind: 'found-loading'; targetIndex: number; targetName: string; progress: number | null }
  | { kind: 'tracking'; targetIndex: number; targetName: string }
  | { kind: 'lost'; targetName: string }

// Grace period between a target being lost and the HUD actually switching
// to the "lost" state — marginal tracking flickers found/lost across a
// couple of frames sometimes, and re-showing "lost" for one frame before
// snapping back to "tracking" reads as broken, not accurate.
const LOST_GRACE_MS = 500

const FRAME_COLOR: Record<'scanning' | 'found' | 'lost', string> = {
  scanning: 'rgba(255, 255, 255, 0.4)',
  found: 'var(--accent)',
  lost: 'var(--status-lost)',
}

function CornerFrame({ tone }: { tone: 'scanning' | 'found' | 'lost' }) {
  const color = FRAME_COLOR[tone]
  return (
    <div
      style={{
        width: 'min(56vh, 78vw)',
        height: 'min(56vh, 78vw)',
        backgroundImage: [
          `linear-gradient(to right, ${color} 10px, transparent 10px)`,
          `linear-gradient(to right, ${color} 10px, transparent 10px)`,
          `linear-gradient(to left, ${color} 10px, transparent 10px)`,
          `linear-gradient(to left, ${color} 10px, transparent 10px)`,
          `linear-gradient(to bottom, ${color} 10px, transparent 10px)`,
          `linear-gradient(to bottom, ${color} 10px, transparent 10px)`,
          `linear-gradient(to top, ${color} 10px, transparent 10px)`,
          `linear-gradient(to top, ${color} 10px, transparent 10px)`,
        ].join(', '),
        backgroundPosition: '0 0, 0 100%, 100% 0, 100% 100%, 0 0, 100% 0, 0 100%, 100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '40px 40px',
        transition: 'background-image 200ms',
      }}
    />
  )
}

function StatusPill({ tone, children }: { tone: 'neutral' | 'found' | 'lost'; children: React.ReactNode }) {
  const colors = {
    neutral: { bg: 'rgba(0,0,0,0.55)', text: 'var(--text)' },
    found: { bg: 'var(--accent-bg)', text: 'var(--accent)' },
    lost: { bg: 'var(--status-lost-bg)', text: 'var(--status-lost)' },
  }[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
        borderRadius: 999,
        background: colors.bg,
        color: colors.text,
        fontSize: 13,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {children}
    </span>
  )
}

interface ArHudProps {
  stage: ARStage | null
}

// A real React overlay (see ARStage's uiScanning: 'no' — this fully
// replaces MindAR's own built-in scanning UI) reacting to ARStage's
// events: camera-initializing, scanning-for-a-marker, marker-found-but-
// content-still-loading, tracking-stable, and lost. Lives in the DOM
// overlay sibling layer, pointer-events: none throughout — it's all
// status, nothing here is a control.
export function ArHud({ stage }: ArHudProps) {
  const [hud, setHud] = useState<HudState>({ kind: 'initializing' })
  const reducedMotion = usePrefersReducedMotion()
  const lostTimerRef = useRef<number | null>(null)
  const readyTargetsRef = useRef(new Set<number>())

  useEffect(() => {
    if (!stage) return

    const handleReady = () => setHud({ kind: 'scanning' })

    const handleTargetFound = (target: TargetEntry) => {
      if (lostTimerRef.current !== null) {
        window.clearTimeout(lostTimerRef.current)
        lostTimerRef.current = null
      }
      if (readyTargetsRef.current.has(target.index)) {
        setHud({ kind: 'tracking', targetIndex: target.index, targetName: target.name })
      } else {
        setHud({ kind: 'found-loading', targetIndex: target.index, targetName: target.name, progress: 0 })
      }
    }

    const handleTargetLost = (target: TargetEntry) => {
      setHud((prev) => (prev.kind !== 'initializing' && prev.kind !== 'scanning' && 'targetIndex' in prev && prev.targetIndex === target.index ? { kind: 'lost', targetName: target.name } : prev))
      lostTimerRef.current = window.setTimeout(() => {
        setHud((prev) => (prev.kind === 'lost' ? { kind: 'scanning' } : prev))
      }, LOST_GRACE_MS)
    }

    const handleContentReady = (target: TargetEntry) => {
      readyTargetsRef.current.add(target.index)
      setHud((prev) =>
        prev.kind === 'found-loading' && prev.targetIndex === target.index
          ? { kind: 'tracking', targetIndex: target.index, targetName: target.name }
          : prev,
      )
    }

    const handleContentProgress = (target: TargetEntry, progress: number | null) => {
      setHud((prev) => (prev.kind === 'found-loading' && prev.targetIndex === target.index ? { ...prev, progress } : prev))
    }

    stage.on('ready', handleReady)
    stage.on('targetFound', handleTargetFound)
    stage.on('targetLost', handleTargetLost)
    stage.on('targetContentReady', handleContentReady)
    stage.on('targetContentProgress', handleContentProgress)

    return () => {
      stage.off('ready', handleReady)
      stage.off('targetFound', handleTargetFound)
      stage.off('targetLost', handleTargetLost)
      stage.off('targetContentReady', handleContentReady)
      stage.off('targetContentProgress', handleContentProgress)
      if (lostTimerRef.current !== null) window.clearTimeout(lostTimerRef.current)
    }
  }, [stage])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      {hud.kind === 'initializing' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <motion.div
            animate={reducedMotion ? undefined : { rotate: 360 }}
            transition={reducedMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: 'linear' }}
            style={{ color: 'var(--accent)' }}
          >
            <ScanMarkIcon width={56} height={56} />
          </motion.div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: 1, color: 'var(--text-secondary)', margin: 0 }}>
            INITIALIZING CAMERA...
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>This usually takes a few seconds</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {hud.kind === 'scanning' && (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'contents' }}>
            <CornerFrame tone="scanning" />
            <StatusPill tone="neutral">Point your camera at a marker</StatusPill>
          </motion.div>
        )}

        {hud.kind === 'found-loading' && (
          <motion.div
            key="found-loading"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
          >
            <StatusPill tone="found">MARKER FOUND</StatusPill>
            <CornerFrame tone="found" />
            <StatusPill tone="neutral">
              LOADING CONTENT{hud.progress !== null ? ` · ${Math.round(hud.progress * 100)}%` : '...'}
            </StatusPill>
          </motion.div>
        )}

        {hud.kind === 'tracking' && (
          <motion.div key="tracking" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ position: 'fixed', bottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
            <StatusPill tone="found">● TRACKING · STABLE</StatusPill>
          </motion.div>
        )}

        {hud.kind === 'lost' && (
          <motion.div key="lost" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'contents' }}>
            <CornerFrame tone="lost" />
            <StatusPill tone="lost">⊙ Lost track — move back into frame</StatusPill>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
