import { useState, type JSX } from 'react'
import {
  HomeIcon,
  PersonIcon,
  EnvelopeClosedIcon,
  GlobeIcon,
  BarChartIcon,
  CalendarIcon,
} from '@radix-ui/react-icons'
import Icon from '../Icon'

import type { IconProps } from '@radix-ui/react-icons/dist/types'

type NavItem = {
  id: string
  label: string
  icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>
}

const NAV_ITEMS: NavItem[] = [
  { id: 'gym',      label: 'Gym',      icon: HomeIcon },
  { id: 'fighters', label: 'Fighters', icon: PersonIcon },
  { id: 'inbox',    label: 'Inbox',    icon: EnvelopeClosedIcon },
  { id: 'world',    label: 'World',    icon: GlobeIcon },
  { id: 'finances', label: 'Finances', icon: BarChartIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
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
        const iconColor = isActive
          ? 'var(--color-accent-amber)'
          : 'var(--color-text-muted)'
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
            <span style={{ flexShrink: 0, width: '18px', display: 'flex', justifyContent: 'center' }}>
              <Icon icon={item.icon} size="md" color={iconColor} />
            </span>
            {expanded && <span>{item.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
