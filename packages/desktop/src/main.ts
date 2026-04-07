import { app, BrowserWindow } from 'electron';
import path from 'path';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env['NODE_ENV'] === 'development') {
    void win.loadURL('http://localhost:5173');
  } else {
    void win.loadFile(path.join(__dirname, '../ui/dist/index.html'));
  }
}

app.whenReady().then(createWindow).catch(console.error);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
