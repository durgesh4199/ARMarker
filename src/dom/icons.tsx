import type { SVGProps } from 'react'

// Small stroke-style icon set for the bundle picker, matching the
// corner-bracket line-art look used throughout the AR HUD. Deliberately
// inline SVG rather than an icon library dependency — four icons doesn't
// justify one.
type IconProps = SVGProps<SVGSVGElement>

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// The corner-bracket "viewfinder" mark — reused as the app's logo (Home)
// and inside the camera-initializing spinner, matching the AR scan
// frame's own motif so the whole app reads as one system.
export function ScanMarkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8V5a1 1 0 0 1 1-1h3" />
      <path d="M16 4h3a1 1 0 0 1 1 1v3" />
      <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
      <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function LayersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 21 8 12 13 3 8Z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 18l9 5 9-5" />
    </svg>
  )
}

export function CubeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 20 7.5v9L12 21 4 16.5v-9Z" />
      <path d="M12 3v9M12 21v-9M4 7.5l8 4.5 8-4.5" />
    </svg>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M10 9l6 3-6 3Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TagIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3h6a2 2 0 0 1 2 2v6l-9 9-8-8 9-9Z" />
      <circle cx="16" cy="7" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

