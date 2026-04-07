import { useState, useEffect, useRef, type JSX } from 'react'

export interface DropdownOption {
  value: string
  label: string
}

interface Props {
  label?: string
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export default function Dropdown({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
}: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder
  const hasValue = value !== ''

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (open && focusedIndex >= 0) {
        onChange(options[focusedIndex].value)
        setOpen(false)
        setFocusedIndex(-1)
      } else {
        setOpen((o) => !o)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((i) => Math.min(i + 1, options.length - 1))
      if (!open) setOpen(true)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((i) => Math.max(i - 1, 0))
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {label !== undefined && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-text-muted)',
            marginBottom: 'var(--space-1)',
          }}
        >
          {label}
        </div>
      )}

      {/* Trigger */}
      <div
        role="combobox"
        aria-expanded={open}
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
        onKeyDown={handleKeyDown}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          backgroundColor: 'var(--color-bg-dark)',
          color: hasValue ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          border: open
            ? '1px solid var(--color-accent-amber)'
            : '1px solid var(--color-bg-mid)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-2) var(--space-3)',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color var(--transition-fast)',
          outline: 'none',
          userSelect: 'none',
        }}
      >
        <span>{selectedLabel}</span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {/* Options list */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-1))',
            left: 0,
            right: 0,
            backgroundColor: 'var(--color-bg-dark)',
            border: '1px solid var(--color-accent-amber)',
            borderRadius: 'var(--radius-sm)',
            zIndex: 100,
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {options.map((option, i) => {
            const isSelected = option.value === value
            const isFocused = i === focusedIndex
            return (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                  setFocusedIndex(-1)
                }}
                onMouseEnter={() => setFocusedIndex(i)}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  padding: 'var(--space-2) var(--space-3)',
                  cursor: 'pointer',
                  backgroundColor: isSelected
                    ? 'var(--color-accent-amber)'
                    : isFocused
                      ? 'var(--color-bg-mid)'
                      : 'transparent',
                  color: isSelected ? 'var(--color-bg-dark)' : 'var(--color-text-primary)',
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                {option.label}
              </div>
            )
          })}
          {options.length === 0 && (
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                padding: 'var(--space-2) var(--space-3)',
                color: 'var(--color-text-muted)',
              }}
            >
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  )
}
