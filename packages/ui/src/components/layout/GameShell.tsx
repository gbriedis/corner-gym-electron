import { useState, type JSX, type ReactNode } from 'react'
import TopNav from './TopNav'
import SideNav from './SideNav'

interface Props {
  children: ReactNode
  // activeNav and onNavigate allow callers to control navigation —
  // screens that handle cross-screen routing (e.g. Calendar) provide
  // their own values; screens that stay self-contained omit them.
  activeNav?: string
  onNavigate?: (id: string) => void
}

export default function GameShell({ children, activeNav: activeNavProp, onNavigate: onNavigateProp }: Props): JSX.Element {
  const [internalNav, setInternalNav] = useState('gym')

  const activeNav = activeNavProp ?? internalNav
  const handleNavigate = onNavigateProp ?? setInternalNav

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: 'var(--color-bg-dark)' }}>
      <TopNav />
      <SideNav activeItem={activeNav} onNavigate={handleNavigate} />

      {/* Main content area — offset from TopNav (48px) and SideNav (44px), scrollable */}
      <main
        style={{
          position: 'fixed',
          top: '48px',
          left: '44px',
          right: 0,
          bottom: 0,
          overflowY: 'auto',
          padding: 'var(--space-6)',
        }}
      >
        {children}
      </main>
    </div>
  )
}
