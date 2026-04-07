import { app, BrowserWindow } from 'electron'
import path from 'path'

import { openDb } from './db.js'
import { setupIpc } from './ipc.js'

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
      preload: path.join(__dirname, 'preload.js'),
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
    void win.loadFile(path.join(__dirname, '../ui/dist/index.html'))
  }
}

app.whenReady().then(createWindow).catch(console.error)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
