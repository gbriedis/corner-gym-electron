// Preload runs in the renderer process with Node access before the page loads.
// contextBridge exposes a typed API surface to the renderer — the renderer never
// calls ipcRenderer directly, keeping a clear boundary between trusted and untrusted code.
//
// This file uses .cts extension (CommonJS TypeScript) so TypeScript compiles it to
// preload.cjs regardless of the package "type": "module" setting. Electron's preload
// context does not reliably support ESM imports; CJS is the safe choice here.

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

  getUpcomingEvents: (saveId: string, currentWeek: number, currentYear: number) =>
    ipcRenderer.invoke('get-upcoming-events', saveId, currentWeek, currentYear),

  getAllEvents: (saveId: string) =>
    ipcRenderer.invoke('get-all-events', saveId),
})
