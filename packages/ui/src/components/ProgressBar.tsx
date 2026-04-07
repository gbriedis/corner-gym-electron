import type { JSX } from 'react'

interface Props {
  value: number       // 0–100
  label?: string
  showPercent?: boolean
  animated?: boolean
}

export default function ProgressBar({
  value,
  label,
  showPercent = false,
  animated = true,
}: Props): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div style={{ width: '100%' }}>
      {(label !== undefined || showPercent) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-2)',
          }}
        >
          {label !== undefined && (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-muted)',
              }}
            >
              {label}
            </span>
          )}
          {showPercent && (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
              }}
            >
              {clamped}%
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        style={{
          width: '100%',
          height: '4px',
          backgroundColor: 'var(--color-bg-mid)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
        }}
      >
        {/* Fill — animated width transition makes the bar feel alive as values change */}
        <div
          style={{
            height: '100%',
            width: `${clamped}%`,
            backgroundColor: 'var(--color-accent-green)',
            borderRadius: 'var(--radius-sm)',
            transition: animated ? 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          }}
        />
      </div>
    </div>
  )
}
