import { app, BrowserWindow } from 'electron';
import path from 'path';

// /dev/shm has restrictive permissions on some Linux systems; /tmp is always writable.
// --no-sandbox must be passed to the electron binary directly (not here) to take
// effect before the zygote process is created.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-dev-shm-usage');
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
