const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('displayHubPlayer', {
  getStatus: () => ipcRenderer.invoke('player:get-status'),
  refreshMonitors: () => ipcRenderer.invoke('player:refresh-monitors'),
  saveMappings: (mappings, settings) => ipcRenderer.invoke('player:save-mappings', mappings, settings),
  reset: () => ipcRenderer.invoke('player:reset'),
  startPairing: () => ipcRenderer.invoke('player:start-pairing'),
  pollPairing: (pairingId) => ipcRenderer.invoke('player:poll-pairing', pairingId),
  onMonitorsChanged: (callback) => {
    ipcRenderer.removeAllListeners('player:monitors-changed')
    ipcRenderer.on('player:monitors-changed', () => callback())
  },
})
