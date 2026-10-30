const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kmrApi', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize-toggle'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onWindowStateChanged: (callback) => {
    ipcRenderer.on('window:state-changed', (_event, value) => callback(value));
  },

  // Theme controls
  getTheme: () => ipcRenderer.invoke('theme:get'),
  setTheme: (mode) => ipcRenderer.invoke('theme:set', mode),
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme:changed', (_event, value) => callback(value));
  },

  // Settings
  getSettings: (key) => ipcRenderer.invoke('settings:get', key),
  updateSettings: (updates) => ipcRenderer.invoke('settings:update', updates),

  // ADB & Device (Phase 2)
  getDevices: () => ipcRenderer.invoke('adb:getDevices'),
  getDeviceInfo: (serial) => ipcRenderer.invoke('adb:getDeviceInfo', serial),
  getHistory: () => ipcRenderer.invoke('history:get'),
  addHistory: (entry) => ipcRenderer.invoke('history:add', entry),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  sendKeyEvent: (serial, keycode) => ipcRenderer.invoke('adb:sendKey', { serial, keycode }),
  pairDevice: (ip, port, code) => ipcRenderer.invoke('adb:pair', { ip, port, code }),
  connectDevice: (ip, port, remember, alias) => ipcRenderer.invoke('adb:connect', { ip, port, remember, alias }),
  disconnectDevice: (serial) => ipcRenderer.invoke('adb:disconnect', serial),
  getTrustedDevices: () => ipcRenderer.invoke('devices:getTrusted'),
  saveTrustedDevice: (device) => ipcRenderer.invoke('devices:saveTrusted', device),
  removeTrustedDevice: (id) => ipcRenderer.invoke('devices:removeTrusted', id),
  updateTrustedPort: (id, newPort) => ipcRenderer.invoke('devices:updatePort', { id, newPort }),

  // QR Pairing (Phase 1 & Phase 3)
  startQrPairing: (options) => ipcRenderer.invoke('qrPairing:start', options),
  cancelQrPairing: () => ipcRenderer.invoke('qrPairing:cancel'),
  getQrPairingStatus: () => ipcRenderer.invoke('qrPairing:status'),
  onQrPairingStatusChanged: (callback) => {
    ipcRenderer.on('qrPairing:status-changed', (_event, value) => callback(value));
  },
  getMdnsServices: () => ipcRenderer.invoke('adb:getMdnsServices'),

  // Scrcpy (Phase 4)
  startMirroring: (options) => ipcRenderer.invoke('scrcpy:start', options),
  stopMirroring: () => ipcRenderer.invoke('scrcpy:stop'),
  getMirroringStatus: () => ipcRenderer.invoke('scrcpy:status'),
  takeScreenshot: (serial) => ipcRenderer.invoke('scrcpy:screenshot', serial),
  startRecording: (options) => ipcRenderer.invoke('scrcpy:startRecording', options),
  stopRecording: () => ipcRenderer.invoke('scrcpy:stopRecording'),
  onMirroringStatusChanged: (callback) => {
    ipcRenderer.on('mirroring:status-changed', (_event, value) => callback(value));
  },
  onRecordingStatusChanged: (callback) => {
    ipcRenderer.on('recording:status-changed', (_event, value) => callback(value));
  },

  // Media Library
  getMediaList: () => ipcRenderer.invoke('media:list'),
  openMediaFolder: (type) => ipcRenderer.invoke('media:openFolder', type),

  // Diagnostics (Phase 5)
  getDiagnostics: (filter) => ipcRenderer.invoke('diagnostics:get', filter),
  clearLogs: () => ipcRenderer.invoke('diagnostics:clear'),
  getDiagnosticsReport: () => ipcRenderer.invoke('diagnostics:report')
});
