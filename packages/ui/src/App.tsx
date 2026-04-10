import { type JSX, useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import MainMenu from './screens/MainMenu'
import NewGame from './screens/NewGame'
import LoadGame from './screens/LoadGame'
import Loading from './screens/Loading'
import Game from './screens/Game'
import Calendar from './screens/Calendar'
import SanctioningBodyPage from './screens/SanctioningBodyPage'
import VenuePage from './screens/VenuePage'
import EventFullPage from './screens/EventFullPage'
import DevDashboard from './screens/DevDashboard'

export default function App(): JSX.Element {
  const screen = useGameStore((s) => s.currentScreen)
  const worldState = useGameStore((s) => s.worldState)
  const setScreen = useGameStore((s) => s.setScreen)

  // Ctrl+Shift+D toggles the dev dashboard — only when a save is loaded.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        if (worldState !== null) {
          setScreen(screen === 'dev' ? 'game' : 'dev')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, [worldState, screen, setScreen])

  switch (screen) {
    case 'mainMenu':
      return <MainMenu />
    case 'newGame':
      return <NewGame />
    case 'loadGame':
      return <LoadGame />
    case 'loading':
      return <Loading />
    case 'game':
      return <Game />
    case 'calendar':
      return <Calendar />
    case 'sanctioningBody':
      return <SanctioningBodyPage />
    case 'venue':
      return <VenuePage />
    case 'eventFull':
      return <EventFullPage />
    case 'dev':
      return <DevDashboard />
  }
}
