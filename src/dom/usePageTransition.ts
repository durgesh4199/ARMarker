import { usePrefersReducedMotion } from './usePrefersReducedMotion'

// Shared enter/exit for the Home -> Bundles -> HowToScan flow. Transform
// + opacity only (CLAUDE.md section 7 — anything that triggers layout
// drops frames while the CV engine is running, even off the AR route).
// The reduced-motion variant keeps the opacity fade but drops the slide,
// per the brief's "provide a reduced variant, don't just disable" rule.
export function usePageTransition() {
  const reduced = usePrefersReducedMotion()
  const offset = reduced ? 0 : 24
  return {
    initial: { opacity: 0, x: offset },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -offset },
    transition: { duration: reduced ? 0.15 : 0.25, ease: 'easeOut' as const },
  }
}
