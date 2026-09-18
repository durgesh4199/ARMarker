import { useGameSurfaceStore } from '../../ar/gameSurfaceStore'

interface SurfaceScoreProps {
  gameId: string
}

// Pairs with a 'game' content item sharing the same gameId: that renderer
// lives outside React (CLAUDE.md section 4) and draws no text onto its
// canvas texture (section 5.3), so the score is read here instead, via
// the store the two sides share.
export function SurfaceScore({ gameId }: SurfaceScoreProps) {
  const score = useGameSurfaceStore((s) => s.scores[gameId] ?? 0)

  return (
    <div
      style={{
        background: 'rgba(0, 0, 0, 0.75)',
        color: '#fff',
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: 13,
        fontFamily: 'system-ui, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      Score: {score}
    </div>
  )
}
