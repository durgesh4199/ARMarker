import { create } from 'zustand'

// Bridges a game surface renderer (plain TS, outside React — see CLAUDE.md
// section 4) to a paired 'dom' SurfaceScore component reading the same
// gameId, the same way debugStore.ts bridges ARStage's own events to the
// debug overlay. gameOver only the 'runner' variant uses (the 'dot'
// variant never sets it, so it just stays false/absent for those games).
interface GameSurfaceState {
  scores: Record<string, number>
  gameOver: Record<string, boolean>
  startGame: (gameId: string) => void
  increment: (gameId: string) => void
  setScore: (gameId: string, score: number) => void
  setGameOver: (gameId: string, over: boolean) => void
}

export const useGameSurfaceStore = create<GameSurfaceState>((set) => ({
  scores: {},
  gameOver: {},
  startGame: (gameId) =>
    set((state) => ({
      scores: { ...state.scores, [gameId]: 0 },
      gameOver: { ...state.gameOver, [gameId]: false },
    })),
  increment: (gameId) => set((state) => ({ scores: { ...state.scores, [gameId]: (state.scores[gameId] ?? 0) + 1 } })),
  setScore: (gameId, score) => set((state) => ({ scores: { ...state.scores, [gameId]: score } })),
  setGameOver: (gameId, over) => set((state) => ({ gameOver: { ...state.gameOver, [gameId]: over } })),
}))
