import './styles/theme.css'
import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const root = document.getElementById('root')
if (root === null) {
  throw new Error('Root element not found — check index.html has <div id="root">')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
