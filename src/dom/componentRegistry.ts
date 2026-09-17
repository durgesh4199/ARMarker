import type { ComponentType } from 'react'
import { Label } from './components/Label'

// Maps a manifest ContentItem's `component` string to an actual React
// component, so the manifest itself never contains JSX (CLAUDE.md
// section 5.3). `props` is typed loosely here deliberately — the JSON
// manifest can't carry component-specific prop types, so validating a
// given component's props against its own interface happens inside that
// component, not at this dispatch boundary.
export const componentRegistry: Record<string, ComponentType<any>> = {
  Label,
}
