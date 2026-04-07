import { useState, type JSX } from 'react'

interface Props {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  disabled?: boolean
  type?: 'text' | 'number' | 'password'
  id?: string
}

export default function Input({
  label,
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  type = 'text',
  id,
}: Props): JSX.Element {
  const [focused, setFocused] = useState(false)

  const borderColor = error !== undefined && error !== ''
    ? 'var(--color-accent-red)'
    : focused
      ? 'var(--color-accent-amber)'
      : 'var(--color-bg-mid)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {label !== undefined && (
        <label
          htmlFor={id}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-text-muted)',
          }}
        >
          {label}
        </label>
      )}

      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          fontWeight: 400,
          backgroundColor: 'var(--color-bg-dark)',
          color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-2) var(--space-3)',
          height: '36px',
          width: '100%',
          outline: 'none',
          transition: 'border-color var(--transition-fast)',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />

      {error !== undefined && error !== '' && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: 'var(--color-accent-red)',
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}
