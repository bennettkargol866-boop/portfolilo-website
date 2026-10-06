const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('portfolioDesktop', {
  loadCurrent: () => ipcRenderer.invoke('portfolio:load-current'),
  saveCurrent: portfolio => ipcRenderer.invoke('portfolio:save-current', portfolio),
  saveFile: payload => ipcRenderer.invoke('portfolio:save-file', payload),
  readFile: fileRef => ipcRenderer.invoke('portfolio:read-file', fileRef),
  removeFile: fileRef => ipcRenderer.invoke('portfolio:remove-file', fileRef),
  clearCurrent: () => ipcRenderer.invoke('portfolio:clear-current'),
  exportArchive: (portfolio, name) => ipcRenderer.invoke('portfolio:export-archive', portfolio, name),
  importArchive: () => ipcRenderer.invoke('portfolio:import-archive')
});
