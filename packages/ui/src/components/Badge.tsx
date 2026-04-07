import type { JSX } from 'react'

export type BadgeVariant = 'easy' | 'normal' | 'hard' | 'extreme' | 'gift' | 'flaw' | 'neutral'

interface Props {
  variant?: BadgeVariant
  label: string
  selected?: boolean
  onClick?: () => void
}

const variantColors: Record<BadgeVariant, { bg: string; text: string; selectedBg: string }> = {
  easy:    { bg: 'rgba(85, 146, 127, 0.15)',  text: 'var(--color-accent-green)',       selectedBg: 'var(--color-accent-green)' },
  normal:  { bg: 'rgba(90, 139, 222, 0.15)',  text: 'var(--color-accent-blue)',        selectedBg: 'var(--color-accent-blue)' },
  hard:    { bg: 'rgba(238, 178, 74, 0.15)',  text: 'var(--color-accent-amber)',       selectedBg: 'var(--color-accent-amber)' },
  extreme: { bg: 'rgba(220, 98, 80, 0.15)',   text: 'var(--color-accent-red)',         selectedBg: 'var(--color-accent-red)' },
  gift:    { bg: 'rgba(184, 156, 233, 0.15)', text: 'var(--color-accent-purple)',      selectedBg: 'var(--color-accent-purple)' },
  flaw:    { bg: 'rgba(132, 71, 144, 0.15)',  text: 'var(--color-accent-purple-dark)', selectedBg: 'var(--color-accent-purple-dark)' },
  neutral: { bg: 'rgba(218, 212, 201, 0.08)', text: 'var(--color-text-muted)',         selectedBg: 'var(--color-bg-mid)' },
}

export default function Badge({
  variant = 'neutral',
  label,
  selected = false,
  onClick,
}: Props): JSX.Element {
  const colors = variantColors[variant]
  const isInteractive = onClick !== undefined

  return (
    <span
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-body)',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: 'var(--space-1) var(--space-3)',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: selected ? colors.selectedBg : colors.bg,
        color: selected ? 'var(--color-bg-dark)' : colors.text,
        border: `1px solid ${selected ? colors.selectedBg : colors.text}`,
        cursor: isInteractive ? 'pointer' : 'default',
        transition: 'background-color var(--transition-fast), color var(--transition-fast)',
        outline: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
