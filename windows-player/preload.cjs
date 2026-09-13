const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('displayHubPlayer', {
  getStatus: () => ipcRenderer.invoke('player:get-status'),
  saveDisplayUrl: (displayUrl) => ipcRenderer.invoke('player:save-display-url', displayUrl),
  reset: () => ipcRenderer.invoke('player:reset'),
})
