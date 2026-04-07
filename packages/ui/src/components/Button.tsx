import type { JSX, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface Props {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  children: ReactNode
}

const baseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color var(--transition-fast), color var(--transition-fast), opacity var(--transition-fast), border-color var(--transition-fast)',
  borderRadius: 'var(--radius-sm)',
  outline: 'none',
  whiteSpace: 'nowrap',
}

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { fontSize: '11px', padding: 'var(--space-1) var(--space-3)', height: '28px' },
  md: { fontSize: '12px', padding: 'var(--space-2) var(--space-4)', height: '36px' },
  lg: { fontSize: '13px', padding: 'var(--space-3) var(--space-8)', height: '44px' },
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--color-accent-amber)',
    color: 'var(--color-bg-dark)',
  },
  secondary: {
    backgroundColor: 'var(--color-bg-mid)',
    color: 'var(--color-text-primary)',
  },
  danger: {
    backgroundColor: 'var(--color-accent-red)',
    color: 'var(--color-text-primary)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--color-text-primary)',
    border: '1px solid rgba(218, 212, 201, 0.25)',
  },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  children,
}: Props): JSX.Element {
  const isDisabled = disabled || loading

  const style: React.CSSProperties = {
    ...baseStyle,
    ...sizeStyles[size],
    ...variantStyles[variant],
    opacity: isDisabled ? 0.35 : 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    // Loading: pulse animation via keyframes injected globally in theme.css
    animation: loading ? 'btn-pulse 1.2s ease-in-out infinite' : 'none',
  }

  return (
    <button
      type={type}
      style={style}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      onMouseEnter={(e) => {
        if (isDisabled) return
        const el = e.currentTarget
        if (variant === 'primary') el.style.backgroundColor = 'var(--color-accent-gold)'
        if (variant === 'secondary') el.style.opacity = '0.85'
        if (variant === 'danger') el.style.opacity = '0.85'
        if (variant === 'ghost') el.style.borderColor = 'rgba(218, 212, 201, 0.5)'
      }}
      onMouseLeave={(e) => {
        if (isDisabled) return
        const el = e.currentTarget
        if (variant === 'primary') el.style.backgroundColor = 'var(--color-accent-amber)'
        if (variant === 'secondary') el.style.opacity = '1'
        if (variant === 'danger') el.style.opacity = '1'
        if (variant === 'ghost') el.style.borderColor = 'rgba(218, 212, 201, 0.25)'
      }}
    >
      {children}
    </button>
  )
}
