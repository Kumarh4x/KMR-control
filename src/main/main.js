const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const settingsStore = require('./settings-store');
const adbManager = require('./adb-manager');
const kmrEngineRunner = require('./kmr-engine-runner');
const diagnosticsService = require('./diagnostics-service');
const qrPairingService = require('./qr-pairing-service');

let mainWindow = null;

function createWindow() {
  // Load saved theme preference
  const savedTheme = settingsStore.get('theme') || 'system';
  nativeTheme.themeSource = savedTheme;

  const isDark = nativeTheme.shouldUseDarkColors;

  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 860,
    minHeight: 580,
    frame: false, // Custom modern Windows title bar
    titleBarStyle: 'hidden',
    backgroundColor: isDark ? '#121417' : '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // needed for preload to bridge securely
    },
    show: false // Graceful reveal after ready-to-show
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.argv.includes('--test-mode')) {
      console.log('[MAIN] Electron window created and ready in test mode. Exiting with code 0.');
      setTimeout(() => {
        app.quit();
      }, 800);
    }
  });

  // Handle external link clicks safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:state-changed', { isMaximized: false });
  });

  // Forward QR Pairing status updates to frontend
  qrPairingService.onStatus((status) => {
    mainWindow?.webContents.send('qrPairing:status-changed', status);
  });
}

// System theme change notification
nativeTheme.on('updated', () => {
  const currentPreference = settingsStore.get('theme') || 'system';
  if (currentPreference === 'system' && mainWindow) {
    const isDark = nativeTheme.shouldUseDarkColors;
    mainWindow.webContents.send('theme:changed', {
      mode: 'system',
      resolved: isDark ? 'dark' : 'light'
    });
  }
});

// Window controls IPC
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize-toggle', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow?.maximize();
    return true;
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Theme IPC
ipcMain.handle('theme:get', () => {
  const mode = settingsStore.get('theme') || 'system';
  const resolved = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  return { mode, resolved };
});

ipcMain.handle('theme:set', (event, mode) => {
  if (['system', 'light', 'dark'].includes(mode)) {
    settingsStore.set('theme', mode);
    nativeTheme.themeSource = mode;
    const resolved = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    mainWindow?.webContents.send('theme:changed', { mode, resolved });
    return { mode, resolved };
  }
  return { error: 'Invalid theme mode' };
});

// Settings IPC
ipcMain.handle('settings:get', (event, key) => {
  return settingsStore.get(key);
});

ipcMain.handle('settings:update', (event, updates) => {
  return settingsStore.update(updates);
});

// ADB & Device IPC (Phase 2 & Phase 3)
ipcMain.handle('adb:getDevices', async () => {
  return await adbManager.getDevices();
});

ipcMain.handle('adb:getDeviceInfo', async (event, serial) => {
  return await adbManager.getDeviceDetails(serial);
});

ipcMain.handle('adb:pair', async (event, { ip, port, code }) => {
  const result = await adbManager.pairDevice(ip, port, code);
  settingsStore.addHistory({
    target: `${ip}:${port}`,
    status: result.success ? 'PAIRED' : 'PAIR_FAILED',
    details: result.success ? 'Wireless pairing succeeded' : (result.error || 'Pairing failed')
  });
  return result;
});

ipcMain.handle('adb:connect', async (event, { ip, port, remember, alias }) => {
  const result = await adbManager.connectDevice(ip, port);
  if (result.success) {
    if (remember) {
      settingsStore.addTrustedDevice({
        ip,
        port,
        alias: alias || `${ip}:${port}`
      });
    }
    settingsStore.addHistory({
      target: `${ip}:${port}`,
      status: result.state === 'unauthorized' ? 'UNAUTHORIZED' : 'CONNECTED',
      details: result.state === 'unauthorized' ? 'Connected (Pending authorization on phone)' : 'Wireless connection established'
    });
  } else {
    settingsStore.addHistory({
      target: `${ip}:${port}`,
      status: 'CONN_FAILED',
      details: result.error || 'Connection failed'
    });
  }
  return result;
});

ipcMain.handle('adb:disconnect', async (event, serial) => {
  const result = await adbManager.disconnectDevice(serial);
  settingsStore.addHistory({
    target: serial || 'all',
    status: 'DISCONNECTED',
    details: 'User initiated disconnect'
  });
  return result;
});

// QR Pairing IPC (Phase 1 & Phase 3)
ipcMain.handle('qrPairing:start', async (event, options) => {
  return await qrPairingService.startSession(options);
});

ipcMain.handle('qrPairing:cancel', async () => {
  return await qrPairingService.cancelSession();
});

ipcMain.handle('qrPairing:status', () => {
  return qrPairingService.getStatus();
});

ipcMain.handle('adb:getMdnsServices', async () => {
  return await adbManager.getMdnsServices();
});

ipcMain.handle('devices:getTrusted', () => {
  return settingsStore.get('trustedDevices') || [];
});

ipcMain.handle('devices:saveTrusted', (event, device) => {
  return settingsStore.addTrustedDevice(device);
});

ipcMain.handle('devices:removeTrusted', (event, id) => {
  settingsStore.removeTrustedDevice(id);
  return settingsStore.get('trustedDevices');
});

ipcMain.handle('history:get', () => {
  return settingsStore.get('connectionHistory') || [];
});

ipcMain.handle('history:add', (event, entry) => {
  settingsStore.addHistory(entry);
  return settingsStore.get('connectionHistory');
});

ipcMain.handle('history:clear', () => {
  settingsStore.set('connectionHistory', []);
  return [];
});

// KMR Display Engine Integration IPC (Phase 4)
const handleStartMirroring = async (event, customOptions = {}) => {
  const globalSettings = settingsStore.get('mirroring') || {};
  const mergedOptions = { ...globalSettings, ...customOptions };

  const onStatusChange = (status) => {
    mainWindow?.webContents.send('mirroring:status-changed', status);
  };

  const res = await kmrEngineRunner.startMirroring(mergedOptions, onStatusChange);
  if (res.success) {
    settingsStore.addHistory({
      target: mergedOptions.serial,
      status: 'MIRRORING',
      details: `Active KMR Control mirroring session (${mergedOptions.maxResolution || 'auto'}, ${mergedOptions.bitRate || '8M'})`
    });
  }
  return res;
};

const handleStopMirroring = () => {
  return kmrEngineRunner.stopMirroring();
};

const handleGetMirroringStatus = () => {
  return kmrEngineRunner.getStatus();
};

const handleTakeScreenshot = async (event, serial) => {
  const picturesDir = path.join(os.homedir(), 'Pictures', 'KMR-Control');
  const res = await kmrEngineRunner.takeScreenshot(serial, picturesDir);
  if (res.success) {
    settingsStore.addHistory({
      target: serial,
      status: 'SCREENSHOT',
      details: `Saved to ${res.filename}`
    });
  }
  return res;
};

const handleStartRecording = async (event, customOptions = {}) => {
  const videosDir = path.join(os.homedir(), 'Videos', 'KMR-Control');
  const onStatusChange = (status) => {
    mainWindow?.webContents.send('recording:status-changed', status);
  };
  const res = await kmrEngineRunner.startRecording({ ...customOptions, outputDir: videosDir }, onStatusChange);
  if (res.success) {
    settingsStore.addHistory({
      target: customOptions.serial,
      status: 'RECORDING',
      details: `Recording to ${res.filename}`
    });
  }
  return res;
};

const handleStopRecording = () => {
  return kmrEngineRunner.stopRecording();
};

// Primary KMR Engine IPC channels
ipcMain.handle('engine:start', handleStartMirroring);
ipcMain.handle('engine:stop', handleStopMirroring);
ipcMain.handle('engine:status', handleGetMirroringStatus);
ipcMain.handle('engine:screenshot', handleTakeScreenshot);
ipcMain.handle('engine:startRecording', handleStartRecording);
ipcMain.handle('engine:stopRecording', handleStopRecording);

// Legacy backward-compatibility aliases
ipcMain.handle('scrcpy:start', handleStartMirroring);
ipcMain.handle('scrcpy:stop', handleStopMirroring);
ipcMain.handle('scrcpy:status', handleGetMirroringStatus);
ipcMain.handle('scrcpy:screenshot', handleTakeScreenshot);
ipcMain.handle('scrcpy:startRecording', handleStartRecording);
ipcMain.handle('scrcpy:stopRecording', handleStopRecording);

// Media Library IPC
ipcMain.handle('media:list', () => {
  const picsDir = path.join(os.homedir(), 'Pictures', 'KMR-Control');
  const vidsDir = path.join(os.homedir(), 'Videos', 'KMR-Control');
  const items = [];

  try {
    if (fs.existsSync(picsDir)) {
      const files = fs.readdirSync(picsDir);
      for (const f of files) {
        if (f.endsWith('.png') || f.endsWith('.jpg')) {
          const full = path.join(picsDir, f);
          const stat = fs.statSync(full);
          items.push({
            name: f,
            type: 'screenshot',
            path: full,
            size: stat.size,
            mtime: stat.mtime.toISOString()
          });
        }
      }
    }
    if (fs.existsSync(vidsDir)) {
      const files = fs.readdirSync(vidsDir);
      for (const f of files) {
        if (f.endsWith('.mp4') || f.endsWith('.mkv')) {
          const full = path.join(vidsDir, f);
          const stat = fs.statSync(full);
          items.push({
            name: f,
            type: 'recording',
            path: full,
            size: stat.size,
            mtime: stat.mtime.toISOString()
          });
        }
      }
    }
  } catch (err) {
    console.error('[Media] Error reading media directory:', err);
  }

  return items.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
});

ipcMain.handle('media:openFolder', (event, type) => {
  const targetDir = type === 'video'
    ? path.join(os.homedir(), 'Videos', 'KMR-Control')
    : path.join(os.homedir(), 'Pictures', 'KMR-Control');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  shell.openPath(targetDir);
  return true;
});

ipcMain.handle('adb:sendKey', async (event, { serial, keycode }) => {
  return await adbManager.sendKeyEvent(serial, keycode);
});

// Diagnostics IPC (Phase 5)
ipcMain.handle('diagnostics:get', (event, filter) => {
  return diagnosticsService.getLogs(filter);
});

ipcMain.handle('diagnostics:clear', () => {
  return diagnosticsService.clearLogs();
});

ipcMain.handle('diagnostics:report', async () => {
  const devices = await adbManager.getDevices();
  const activeSerial = (devices.devices && devices.devices[0]) ? devices.devices[0].serial : null;
  const devDetails = activeSerial ? await adbManager.getDeviceDetails(activeSerial) : null;
  return diagnosticsService.generateSystemReport(devDetails);
});

ipcMain.handle('devices:updatePort', (event, { id, newPort }) => {
  return settingsStore.updateTrustedDevicePort(id, newPort);
});

// App Lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
