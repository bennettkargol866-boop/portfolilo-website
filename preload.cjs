const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('portfolioDesktop', {
  loadCurrent: () => ipcRenderer.invoke('portfolio:load-current'),
  saveCurrent: portfolio => ipcRenderer.invoke('portfolio:save-current', portfolio),
  clearCurrent: () => ipcRenderer.invoke('portfolio:clear-current'),
  exportArchive: (portfolio, name) => ipcRenderer.invoke('portfolio:export-archive', portfolio, name),
  importArchive: () => ipcRenderer.invoke('portfolio:import-archive')
});
