import { useState, type JSX } from 'react'

type NavItem = {
  id: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'gym',      label: 'Gym',      icon: '⬡' },
  { id: 'fighters', label: 'Fighters', icon: '◈' },
  { id: 'inbox',    label: 'Inbox',    icon: '◻' },
  { id: 'world',    label: 'World',    icon: '◎' },
  { id: 'finances', label: 'Finances', icon: '◇' },
]

interface Props {
  activeItem?: string
  onNavigate?: (id: string) => void
}

export default function SideNav({ activeItem, onNavigate }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const width = expanded ? '140px' : '44px'

  return (
    <div
      style={{
        position: 'fixed',
        top: '44px',        // below TopBar
        left: 0,
        bottom: 0,
        width,
        backgroundColor: 'var(--color-bg-dark)',
        borderRight: 'var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        transition: 'width var(--transition-base)',
        overflow: 'hidden',
      }}
    >
      {/* Expand/collapse toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        title={expanded ? 'Collapse' : 'Expand'}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10px',
          color: 'var(--color-text-muted)',
          padding: 'var(--space-3)',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: expanded ? 'flex-end' : 'center',
          borderBottom: 'var(--border-subtle)',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          transition: 'color var(--transition-fast)',
          width: '100%',
        }}
      >
        {expanded ? '◂' : '▸'}
      </button>

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeItem
        return (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: isActive ? 'var(--color-accent-amber)' : 'var(--color-text-muted)',
              backgroundColor: 'transparent',
              border: 'none',
              // Left accent bar for active item
              borderLeft: isActive
                ? '3px solid var(--color-accent-amber)'
                : '3px solid transparent',
              padding: `0 var(--space-3)`,
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              cursor: 'pointer',
              transition: 'color var(--transition-fast)',
              whiteSpace: 'nowrap',
              width: '100%',
            }}
          >
            <span style={{ fontSize: '14px', flexShrink: 0, width: '18px', textAlign: 'center' }}>
              {item.icon}
            </span>
            {expanded && <span>{item.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
