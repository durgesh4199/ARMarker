import { useCallback, useState } from 'react'

const WIDTH = 220
const HEIGHT = 160
const DOT_SIZE = 36

function randomDotPosition() {
  return {
    x: Math.random() * (WIDTH - DOT_SIZE),
    y: Math.random() * (HEIGHT - DOT_SIZE),
  }
}

// A DOM overlay content item like Label, but interactive — CLAUDE.md
// section 5.3 already routes taps to real DOM elements here, so unlike the
// model renderer's tap-to-interact this needs no raycasting: opting into
// pointerEvents: 'auto' on the root (Label's own doc comment) is enough.
//
// The dot's position is a CSS transform (not left/top), animated with a
// plain CSS transition rather than re-triggered on every render — CLAUDE.md
// section 7's "animate transform/opacity only, nothing that triggers
// layout" applies here too: this overlay renders every frame the AR
// content underneath is live, so a layout-triggering left/top animation
// would compete with that render loop for frame budget.
export function TapGame() {
  const [score, setScore] = useState(0)
  const [dot, setDot] = useState(randomDotPosition)

  const handleTap = useCallback(() => {
    setScore((s) => s + 1)
    setDot(randomDotPosition())
  }, [])

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
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Score: {score}
      </div>
      <button
        type="button"
        onClick={handleTap}
        aria-label="Tap target"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: '50%',
          background: '#22d3ee',
          border: 'none',
          padding: 0,
          transform: `translate(${dot.x}px, ${dot.y}px)`,
          transition: 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  )
}
