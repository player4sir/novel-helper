// Preload script for future IPC communication
// Currently not needed but good to have for security

const { contextBridge } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Add any electron APIs you want to expose to the renderer
  platform: process.platform,
  version: process.versions.electron
});
