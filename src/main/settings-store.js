const fs = require('fs');
const path = require('path');
const os = require('os');

class SettingsStore {
  constructor() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    this.configDir = path.join(appData, 'KMR-Control');
    this.configFile = path.join(this.configDir, 'settings.json');
    this.legacyConfigDir = path.join(appData, 'KMR-Droid-Control');
    this.defaultSettings = {
      theme: 'system', // 'system' | 'light' | 'dark'
      mirroring: {
        maxResolution: 'auto',
        bitRate: '8M',
        maxFps: '60',
        fullscreen: false,
        alwaysOnTop: false,
        turnScreenOff: false,
        stayAwake: true,
        noAudio: false,
        showFps: false,
        windowTitle: 'KMR Control'
      },
      recordings: {
        outputDir: path.join(os.homedir(), 'Videos', 'KMR-Control'),
        format: 'mp4'
      },
      trustedDevices: [], // [{ id, alias, ip, port, lastSeen }] - NEVER store pairing PINs
      connectionHistory: [] // [{ timestamp, target, status, details }]
    };
    this.migrateLegacyIfNeeded();
    this.data = this.load();
  }

  migrateLegacyIfNeeded() {
    try {
      if (!fs.existsSync(this.configFile)) {
        const legacyFile = path.join(this.legacyConfigDir, 'settings.json');
        if (fs.existsSync(legacyFile)) {
          if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
          }
          fs.copyFileSync(legacyFile, this.configFile);
          console.log('[SettingsStore] Migrated settings from legacy KMR-Droid-Control to KMR-Control');
        }
      }
    } catch (e) {
      console.error('[SettingsStore] Migration check error:', e.message);
    }
  }

  load() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      if (fs.existsSync(this.configFile)) {
        const raw = fs.readFileSync(this.configFile, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          ...this.defaultSettings,
          ...parsed,
          mirroring: { ...this.defaultSettings.mirroring, ...(parsed.mirroring || {}) },
          recordings: { ...this.defaultSettings.recordings, ...(parsed.recordings || {}) }
        };
      }
    } catch (err) {
      console.error('[SettingsStore] Error loading settings:', err.message);
    }
    return JSON.parse(JSON.stringify(this.defaultSettings));
  }

  save() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      fs.writeFileSync(this.configFile, JSON.stringify(this.data, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('[SettingsStore] Error saving settings:', err.message);
      return false;
    }
  }

  get(key) {
    return key ? this.data[key] : this.data;
  }

  set(key, value) {
    this.data[key] = value;
    return this.save();
  }

  update(partial) {
    this.data = {
      ...this.data,
      ...partial,
      mirroring: { ...this.data.mirroring, ...(partial.mirroring || {}) },
      recordings: { ...this.data.recordings, ...(partial.recordings || {}) }
    };
    return this.save();
  }

  addTrustedDevice(device) {
    // Sanitize device object - ensure NO pairing PIN is ever stored
    const safeDevice = {
      id: device.id || `${device.ip}:${device.port}`,
      alias: String(device.alias || device.ip).trim(),
      ip: String(device.ip).trim(),
      port: parseInt(device.port, 10),
      lastSeen: new Date().toISOString()
    };
    const list = this.data.trustedDevices.filter(d => d.id !== safeDevice.id);
    list.unshift(safeDevice);
    this.data.trustedDevices = list.slice(0, 20); // Keep up to 20 devices
    this.save();
    return safeDevice;
  }

  removeTrustedDevice(id) {
    this.data.trustedDevices = this.data.trustedDevices.filter(d => d.id !== id);
    return this.save();
  }

  updateTrustedDevicePort(id, newPort) {
    const portNum = parseInt(newPort, 10);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) return false;
    const device = this.data.trustedDevices.find(d => d.id === id);
    if (device) {
      device.port = portNum;
      device.id = `${device.ip}:${portNum}`;
      device.lastSeen = new Date().toISOString();
      this.save();
      return device;
    }
    return null;
  }

  addHistory(entry) {
    const record = {
      timestamp: new Date().toISOString(),
      target: entry.target || 'Unknown',
      status: entry.status || 'INFO',
      details: entry.details || ''
    };
    this.data.connectionHistory = [record, ...this.data.connectionHistory.slice(0, 49)];
    this.save();
  }
}

module.exports = new SettingsStore();
