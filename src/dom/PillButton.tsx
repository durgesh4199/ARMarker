import type { ButtonHTMLAttributes } from 'react'

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
}

export function PillButton({ variant = 'primary', style, ...props }: PillButtonProps) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '16px 24px',
    borderRadius: 999,
    border: 'none',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 150ms, transform 150ms',
  } as const

  const variantStyle =
    variant === 'primary'
      ? { background: 'var(--accent)', color: '#0a0d0a' }
      : { background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border-strong)' }

  return (
    <button
      {...props}
      style={{
        ...base,
        ...variantStyle,
        ...(props.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : null),
        ...style,
      }}
    />
  )
}
