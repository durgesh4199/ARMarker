import { useEffect, useState } from 'react'

// CLAUDE.md section 7: respect prefers-reduced-motion with a reduced
// variant, not just disabling animation outright — components using this
// should still transition opacity/scale, just skip continuous/looping
// motion (spins, pulses).
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const listener = () => setReduced(query.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  return reduced
}
