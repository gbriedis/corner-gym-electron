import type { JSX, ReactNode } from 'react'

export type CardVariant = 'default' | 'active' | 'muted'
export type CardPadding = 'sm' | 'md' | 'lg'

interface Props {
  variant?: CardVariant
  padding?: CardPadding
  children: ReactNode
  style?: React.CSSProperties
}

const paddingMap: Record<CardPadding, string> = {
  sm: 'var(--space-3)',
  md: 'var(--space-4)',
  lg: 'var(--space-6)',
}

export default function Card({
  variant = 'default',
  padding = 'md',
  children,
  style,
}: Props): JSX.Element {
  const isActive = variant === 'active'
  const isMuted = variant === 'muted'

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-mid)',
        border: 'var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: paddingMap[padding],
        // Active variant: left accent bar in amber
        borderLeft: isActive ? '3px solid var(--color-accent-amber)' : undefined,
        opacity: isMuted ? 0.6 : 1,
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
