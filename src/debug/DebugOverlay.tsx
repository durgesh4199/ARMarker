import { useEffect, useRef } from 'react'
import { useDebugStore } from './debugStore'
import styles from './DebugOverlay.module.css'

export function DebugOverlay() {
  const fpsRef = useRef<HTMLSpanElement>(null)
  const currentTargetIndex = useDebugStore((s) => s.currentTargetIndex)
  const currentTargetName = useDebugStore((s) => s.currentTargetName)
  const assetLoadState = useDebugStore((s) => s.assetLoadState)

  useEffect(() => {
    let frameCount = 0
    let lastSampleTime = performance.now()
    let rafId: number

    const tick = () => {
      frameCount += 1
      const now = performance.now()
      const elapsed = now - lastSampleTime
      if (elapsed >= 500) {
        const fps = Math.round((frameCount * 1000) / elapsed)
        if (fpsRef.current) fpsRef.current.textContent = String(fps)
        frameCount = 0
        lastSampleTime = now
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div className={styles.overlay}>
      <div>
        FPS: <span ref={fpsRef}>—</span>
      </div>
      <div>
        Target: {currentTargetIndex ?? '—'} {currentTargetName ? `(${currentTargetName})` : ''}
      </div>
      <div>Assets: {assetLoadState}</div>
    </div>
  )
}
