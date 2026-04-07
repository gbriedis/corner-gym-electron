import { app, BrowserWindow } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { openDb } from './db.js'
import { setupIpc } from './ipc.js'

// ESM does not have __dirname — derive it from import.meta.url instead.
const __dirname = dirname(fileURLToPath(import.meta.url))

// /dev/shm has restrictive permissions on some Linux systems; /tmp is always writable.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-dev-shm-usage')
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.cjs'),
    },
  })

  // Open the database and register all IPC handlers before the window loads.
  // Registering here (not at app.whenReady) ensures win is available for
  // progress event emission via win.webContents.send during world generation.
  const db = openDb()
  setupIpc(db, win)

  if (process.env['NODE_ENV'] === 'development') {
    void win.loadURL('http://localhost:5173')
  } else {
    void win.loadFile(join(__dirname, '../ui/dist/index.html'))
  }
}

app.whenReady().then(createWindow).catch(console.error)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
