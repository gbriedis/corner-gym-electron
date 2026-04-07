import type { JSX } from 'react'
import { useGameStore } from './store/gameStore'
import MainMenu from './screens/MainMenu'
import NewGame from './screens/NewGame'
import LoadGame from './screens/LoadGame'
import Loading from './screens/Loading'
import Game from './screens/Game'

export default function App(): JSX.Element {
  const screen = useGameStore((s) => s.currentScreen)

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
  }
}
