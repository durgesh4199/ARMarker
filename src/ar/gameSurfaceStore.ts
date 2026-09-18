import { create } from 'zustand'

// Bridges a game surface renderer (plain TS, outside React — see CLAUDE.md
// section 4) to a paired 'dom' SurfaceScore component reading the same
// gameId, the same way debugStore.ts bridges ARStage's own events to the
// debug overlay.
interface GameSurfaceState {
  scores: Record<string, number>
  startGame: (gameId: string) => void
  increment: (gameId: string) => void
}

export const useGameSurfaceStore = create<GameSurfaceState>((set) => ({
  scores: {},
  startGame: (gameId) => set((state) => ({ scores: { ...state.scores, [gameId]: 0 } })),
  increment: (gameId) => set((state) => ({ scores: { ...state.scores, [gameId]: (state.scores[gameId] ?? 0) + 1 } })),
}))
