import { useCallback, useEffect, useRef, useState } from 'react'

const WIDTH = 220
const HEIGHT = 160
const DOT_SIZE = 40
const COLOR_CYCLE_MS = 550
const MISS_FLASH_MS = 200
const PALETTE = ['#22d3ee', '#f472b6', '#facc15', '#4ade80'] as const
const PALETTE_NAMES = ['Cyan', 'Pink', 'Yellow', 'Green'] as const

function randomDotPosition() {
  return {
    x: Math.random() * (WIDTH - DOT_SIZE),
    y: Math.random() * (HEIGHT - DOT_SIZE),
  }
}

function randomPaletteIndex(exclude: number) {
  let i = Math.floor(Math.random() * PALETTE.length)
  while (i === exclude) i = Math.floor(Math.random() * PALETTE.length)
  return i
}

// A Simon-says variant of TapGame, same DOM-overlay/transform-transition
// technique (see that file's doc comment for why transform+CSS transition,
// not left/top). The dot cycles through a fixed palette on a timer; a tap
// only scores — and relocates the dot with the usual smooth transition —
// when the dot's current color matches the round's target color (shown in
// the header). A wrong-color tap doesn't move the dot or advance the
// round, just flashes a red ring, so mashing taps isn't a viable strategy.
export function ColorMatchGame() {
  const [score, setScore] = useState(0)
  const [dot, setDot] = useState(randomDotPosition)
  const [targetIndex, setTargetIndex] = useState(() => randomPaletteIndex(-1))
  const [colorIndex, setColorIndex] = useState(0)
  const [missFlash, setMissFlash] = useState(false)
  const missTimeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const id = window.setInterval(() => setColorIndex((i) => (i + 1) % PALETTE.length), COLOR_CYCLE_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    return () => {
      if (missTimeoutRef.current !== undefined) window.clearTimeout(missTimeoutRef.current)
    }
  }, [])

  const handleTap = useCallback(() => {
    if (colorIndex === targetIndex) {
      setScore((s) => s + 1)
      setDot(randomDotPosition())
      setTargetIndex((prev) => randomPaletteIndex(prev))
      return
    }
    setMissFlash(true)
    if (missTimeoutRef.current !== undefined) window.clearTimeout(missTimeoutRef.current)
    missTimeoutRef.current = window.setTimeout(() => setMissFlash(false), MISS_FLASH_MS)
  }, [colorIndex, targetIndex])

  return (
    <div
      style={{
        position: 'relative',
        width: WIDTH,
        height: HEIGHT,
        background: 'rgba(0, 0, 0, 0.65)',
        borderRadius: 12,
        overflow: 'hidden',
        pointerEvents: 'auto',
        touchAction: 'manipulation',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 8,
          right: 8,
          display: 'flex',
          justifyContent: 'space-between',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span>Score: {score}</span>
        <span>
          Tap: <span style={{ color: PALETTE[targetIndex] }}>{PALETTE_NAMES[targetIndex]}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={handleTap}
        aria-label="Color match target"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: '50%',
          background: PALETTE[colorIndex],
          border: missFlash ? '3px solid #ef4444' : '3px solid transparent',
          padding: 0,
          transform: `translate(${dot.x}px, ${dot.y}px)`,
          transition: 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1), background-color 120ms linear',
        }}
      />
    </div>
  )
}
