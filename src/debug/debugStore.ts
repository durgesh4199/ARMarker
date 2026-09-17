import { create } from 'zustand'

interface DebugState {
  currentTargetIndex: number | null
  currentTargetName: string | null
  assetLoadState: string
  setTarget: (index: number | null, name: string | null) => void
  setAssetLoadState: (state: string) => void
}

export const useDebugStore = create<DebugState>((set) => ({
  currentTargetIndex: null,
  currentTargetName: null,
  assetLoadState: 'idle',
  setTarget: (index, name) => set({ currentTargetIndex: index, currentTargetName: name }),
  setAssetLoadState: (state) => set({ assetLoadState: state }),
}))
