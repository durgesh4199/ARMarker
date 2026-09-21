import { useGameSurfaceStore } from '../../ar/gameSurfaceStore'

interface SurfaceScoreProps {
  gameId: string
}

// Pairs with a 'game' content item sharing the same gameId: that renderer
// lives outside React (CLAUDE.md section 4) and draws no text onto its
// canvas texture (section 5.3), so the score — and, for the 'runner'
// variant, the game-over/restart prompt — is read here instead, via the
// store the two sides share. The 'dot' variant never sets gameOver, so
// this line just never appears for those games.
export function SurfaceScore({ gameId }: SurfaceScoreProps) {
  const score = useGameSurfaceStore((s) => s.scores[gameId] ?? 0)
  const gameOver = useGameSurfaceStore((s) => s.gameOver[gameId] ?? false)

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
      {gameOver && <span style={{ color: '#f87171' }}> · Game Over — tap to restart</span>}
    </div>
  )
}
