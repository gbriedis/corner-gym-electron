import { useState, type JSX, type ReactNode } from 'react'
import TopBar from './TopBar'
import SideNav from './SideNav'

interface Props {
  title?: string
  children: ReactNode
}

export default function GameShell({ title = '', children }: Props): JSX.Element {
  const [activeNav, setActiveNav] = useState('gym')

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: 'var(--color-bg-dark)' }}>
      <TopBar title={title} />
      <SideNav activeItem={activeNav} onNavigate={setActiveNav} />

      {/* Main content area — offset from TopBar and SideNav, scrollable */}
      <main
        style={{
          position: 'fixed',
          top: '44px',       // TopBar height
          left: '44px',      // SideNav collapsed width
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
