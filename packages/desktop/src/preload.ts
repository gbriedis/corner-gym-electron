// Preload runs in the renderer process with Node access before the page loads.
// contextBridge exposes a typed API surface to the renderer — the renderer never
// calls ipcRenderer directly, keeping a clear boundary between trusted and untrusted code.

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getNewGameOptions: () => ipcRenderer.invoke('get-new-game-options'),

  generateAndSave: (config: unknown) => ipcRenderer.invoke('generate-and-save', config),

  loadSave: (saveId: string) => ipcRenderer.invoke('load-save', saveId),

  listSaves: () => ipcRenderer.invoke('list-saves'),

  deleteSave: (saveId: string) => ipcRenderer.invoke('delete-save', saveId),

  // onGenerationProgress registers a listener for live progress events emitted
  // during world generation. Returns an unsubscribe function so the loading screen
  // can clean up after the generation completes.
  onGenerationProgress: (callback: (data: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown): void => {
      callback(data)
    }
    ipcRenderer.on('generation-progress', listener)
    return (): void => {
      ipcRenderer.removeListener('generation-progress', listener)
    }
  },
})
