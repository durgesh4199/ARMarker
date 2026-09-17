interface LabelProps {
  text: string
}

// Not interactive, so it deliberately leaves pointer-events at its
// inherited 'none' (the DOM overlay layer's default per CLAUDE.md
// section 4) rather than opting in. A component that does need clicks
// should set pointerEvents: 'auto' on its own root element.
export function Label({ text }: LabelProps) {
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
      {text}
    </div>
  )
}
