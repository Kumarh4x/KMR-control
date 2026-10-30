const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const diagnosticsService = require('./diagnostics-service');

class AdbManager {
  constructor() {
    this.adbPath = this.resolveAdbPath();
    this.cachedDevices = [];
    this.activeDevice = null;
  }

  resolveAdbPath() {
    // 1. Check local directory
    const candidates = [
      path.join(__dirname, '../../adb.exe'),
      path.join(process.cwd(), 'adb.exe'),
      path.join(path.dirname(process.execPath), 'adb.exe'),
      path.join(process.resourcesPath || '', 'adb.exe')
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
    // Fallback to system adb if in PATH
    return 'adb.exe';
  }

  /**
   * Safely execute an ADB command using spawn with array arguments (no shell injection)
   */
  execute(args, timeoutMs = 8000) {
    return new Promise((resolve) => {
      let proc;
      try {
        proc = spawn(this.adbPath, args, {
          windowsHide: true,
          shell: false
        });
      } catch (err) {
        return resolve({
          code: -1,
          stdout: '',
          stderr: `Failed to spawn adb: ${err.message}`
        });
      }

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        try {
          proc.kill();
        } catch (e) {}
        resolve({
          code: -2,
          stdout,
          stderr: 'Command timed out'
        });
      }, timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({ code: -1, stdout, stderr: err.message });
      });
    });
  }

  // Input Validation Rules (Security Requirement)
  validateIp(ip) {
    if (!ip || typeof ip !== 'string') return { valid: false, error: 'IP address is required' };
    const trimmed = ip.trim();
    const ipv4Regex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
    if (!ipv4Regex.test(trimmed)) {
      return { valid: false, error: 'Invalid IPv4 address format (e.g. 192.168.1.150)' };
    }
    if (trimmed === '0.0.0.0' || trimmed === '255.255.255.255') {
      return { valid: false, error: 'Reserved or invalid broadcast IP address' };
    }
    return { valid: true, value: trimmed };
  }

  validatePort(port) {
    const num = parseInt(port, 10);
    if (isNaN(num) || num < 1024 || num > 65535) {
      return { valid: false, error: 'Port must be a number between 1024 and 65535' };
    }
    return { valid: true, value: num };
  }

  validatePairingCode(code) {
    if (!code || typeof code !== 'string') return { valid: false, error: 'Pairing code is required' };
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      return { valid: false, error: 'Pairing code must be exactly 6 digits (e.g. 482910)' };
    }
    return { valid: true, value: trimmed };
  }

  /**
   * Official Android 11+ Wireless Debugging Pairing
   * Note: The pairing code is used in-memory ONLY during this execution and NEVER saved or logged.
   */
  async pairDevice(ip, pairPort, pairingCode) {
    const ipVal = this.validateIp(ip);
    if (!ipVal.valid) return { success: false, error: ipVal.error };

    const portVal = this.validatePort(pairPort);
    if (!portVal.valid) return { success: false, error: portVal.error };

    const codeVal = this.validatePairingCode(pairingCode);
    if (!codeVal.valid) return { success: false, error: codeVal.error };

    const target = `${ipVal.value}:${portVal.value}`;
    diagnosticsService.log('INFO', 'ADB_PAIR', `Initiating wireless pairing with ${target}`);

    // adb pair <ip>:<port> <code_argument>
    const res = await this.execute(['pair', target, codeVal.value], 15000);

    const output = (res.stdout + '\n' + res.stderr).trim();
    if (res.code === 0 && output.toLowerCase().includes('successfully paired')) {
      diagnosticsService.log('INFO', 'ADB_PAIR', `Successfully paired with ${target}`);
      return {
        success: true,
        message: `Successfully paired with ${target}`,
        rawOutput: output
      };
    }

    // Parse actionable errors
    let errorMsg = 'Pairing failed. Ensure the pairing dialog is still visible on the phone.';
    if (output.includes('Wrong password') || output.includes('password')) {
      errorMsg = 'Incorrect pairing code. Verify the 6-digit code shown on the phone.';
    } else if (output.includes('Connection refused') || output.includes('actively refused')) {
      errorMsg = 'Connection refused. Ensure the pairing dialog is currently open on your phone.';
    } else if (output.includes('timed out') || res.code === -2) {
      errorMsg = 'Pairing timed out. Verify phone and PC are on the same Wi-Fi network.';
    } else if (output) {
      errorMsg = `Pairing failed: ${output}`;
    }

    diagnosticsService.log('WARN', 'ADB_PAIR', `Pairing failed for ${target}: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg
    };
  }

  /**
   * Connect to Android device over Wireless ADB TCP/IP connection port
   */
  async connectDevice(ip, connectPort) {
    const ipVal = this.validateIp(ip);
    if (!ipVal.valid) return { success: false, error: ipVal.error };

    const portVal = this.validatePort(connectPort);
    if (!portVal.valid) return { success: false, error: portVal.error };

    const target = `${ipVal.value}:${portVal.value}`;
    diagnosticsService.log('INFO', 'ADB_CONNECT', `Connecting to ${target}`);

    const res = await this.execute(['connect', target], 12000);
    const output = (res.stdout + '\n' + res.stderr).trim();

    if (output.toLowerCase().includes('connected to') || output.toLowerCase().includes('already connected')) {
      // Check authorization state
      const listRes = await this.getDevices();
      const dev = (listRes.devices || []).find(d => d.serial === target);

      if (dev && dev.state === 'unauthorized') {
        diagnosticsService.log('WARN', 'ADB_CONNECT', `Connected to ${target}, but device is unauthorized`);
        return {
          success: true,
          target,
          state: 'unauthorized',
          message: `Connected to ${target}, but authorization is pending. Accept prompt on phone screen.`
        };
      }

      diagnosticsService.log('INFO', 'ADB_CONNECT', `Connected successfully to ${target}`);
      return {
        success: true,
        target,
        state: 'connected',
        message: `Successfully connected to ${target}`
      };
    }

    let errorMsg = `Unable to connect to ${target}.`;
    if (output.includes('Connection refused') || output.includes('actively refused')) {
      errorMsg = `Connection refused at ${target}. Confirm that Wireless Debugging is enabled and port ${portVal.value} is correct.`;
    } else if (output.includes('timed out') || res.code === -2) {
      errorMsg = `Connection to ${target} timed out. Ensure the phone and PC are on the same Wi-Fi network and the phone is not sleeping.`;
    } else if (output) {
      errorMsg = output;
    }

    diagnosticsService.log('WARN', 'ADB_CONNECT', `Connection failed for ${target}: ${errorMsg}`);
    return {
      success: false,
      target,
      error: errorMsg
    };
  }

  /**
   * Send validated Android key event
   */
  async sendKeyEvent(serial, keycode) {
    const code = parseInt(keycode, 10);
    if (isNaN(code) || code < 1 || code > 350) {
      return { success: false, error: 'Invalid keycode' };
    }
    const res = await this.execute(['-s', serial, 'shell', 'input', 'keyevent', String(code)]);
    return { success: res.code === 0 };
  }

  /**
   * Disconnect from a wireless ADB device
   */
  async disconnectDevice(target) {
    if (!target) {
      // Disconnect all
      const res = await this.execute(['disconnect']);
      return { success: res.code === 0, message: res.stdout.trim() || 'Disconnected all devices' };
    }
    const res = await this.execute(['disconnect', target]);
    return { success: res.code === 0, message: res.stdout.trim() || `Disconnected from ${target}` };
  }

  /**
   * Start ADB server if not running
   */
  async startServer() {
    return await this.execute(['start-server']);
  }

  /**
   * Kill ADB server
   */
  async killServer() {
    return await this.execute(['kill-server']);
  }

  /**
   * List connected devices with their raw states
   */
  async getDevices() {
    const res = await this.execute(['devices', '-l']);
    if (res.code !== 0) {
      return { success: false, error: res.stderr || 'Failed to list devices', devices: [] };
    }

    const lines = res.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const devices = [];

    // Skip the first line: "List of devices attached"
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.startsWith('*')) continue;

      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const serial = parts[0];
        const state = parts[1]; // 'device', 'unauthorized', 'offline', etc.

        let model = null;
        let product = null;
        let transportId = null;

        for (let j = 2; j < parts.length; j++) {
          const item = parts[j];
          if (item.startsWith('model:')) model = item.replace('model:', '').replace(/_/g, ' ');
          if (item.startsWith('product:')) product = item.replace('product:', '');
          if (item.startsWith('transport_id:')) transportId = item.replace('transport_id:', '');
        }

        const isWireless = serial.includes(':');
        devices.push({
          serial,
          state,
          isWireless,
          model,
          product,
          transportId
        });
      }
    }

    this.cachedDevices = devices;
    return { success: true, devices };
  }

  /**
   * Fetch detailed genuine device properties without fabricating any data
   */
  async getDeviceDetails(serial) {
    if (!serial) {
      return { success: false, error: 'No serial provided' };
    }

    // Check device state first
    const listRes = await this.getDevices();
    const dev = (listRes.devices || []).find(d => d.serial === serial);

    if (!dev) {
      return {
        success: false,
        state: 'disconnected',
        error: 'Device not found in attached devices list'
      };
    }

    if (dev.state === 'unauthorized') {
      return {
        success: true,
        serial: dev.serial,
        state: 'unauthorized',
        isWireless: dev.isWireless,
        model: dev.model || 'Unauthorized Android Device',
        manufacturer: null,
        androidVersion: null,
        apiLevel: null,
        ipAddress: dev.isWireless ? dev.serial.split(':')[0] : null,
        battery: null,
        resolution: null,
        density: null,
        note: 'Please confirm USB/Wireless debugging authorization prompt on phone'
      };
    }

    if (dev.state !== 'device') {
      return {
        success: true,
        serial: dev.serial,
        state: dev.state,
        isWireless: dev.isWireless,
        model: dev.model || 'Android Device',
        manufacturer: null,
        androidVersion: null,
        apiLevel: null,
        ipAddress: null,
        battery: null,
        resolution: null,
        density: null,
        note: `Device is in ${dev.state} state`
      };
    }

    // Parallel fetch of device properties
    const [modelRes, mfgRes, verRes, sdkRes, battRes, sizeRes, densityRes, ipRes] = await Promise.all([
      this.execute(['-s', serial, 'shell', 'getprop', 'ro.product.model']),
      this.execute(['-s', serial, 'shell', 'getprop', 'ro.product.manufacturer']),
      this.execute(['-s', serial, 'shell', 'getprop', 'ro.build.version.release']),
      this.execute(['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk']),
      this.execute(['-s', serial, 'shell', 'dumpsys', 'battery']),
      this.execute(['-s', serial, 'shell', 'wm', 'size']),
      this.execute(['-s', serial, 'shell', 'wm', 'density']),
      this.execute(['-s', serial, 'shell', 'ip', '-f', 'inet', 'addr', 'show', 'wlan0'])
    ]);

    // Parse Model & Manufacturer
    const model = modelRes.stdout.trim() || dev.model || null;
    const manufacturer = mfgRes.stdout.trim() || null;
    const fullModel = (manufacturer && model && !model.toLowerCase().includes(manufacturer.toLowerCase()))
      ? `${manufacturer} ${model}`
      : (model || 'Android Device');

    // Parse OS Version
    const androidVersion = verRes.stdout.trim() || null;
    const apiLevel = sdkRes.stdout.trim() || null;

    // Parse Battery details
    let battery = null;
    if (battRes.stdout) {
      const levelMatch = battRes.stdout.match(/level:\s*(\d+)/i);
      const statusMatch = battRes.stdout.match(/status:\s*(\d+)/i);
      const acMatch = battRes.stdout.match(/AC powered:\s*(true|false)/i);
      const usbMatch = battRes.stdout.match(/USB powered:\s*(true|false)/i);
      const wirelessMatch = battRes.stdout.match(/Wireless powered:\s*(true|false)/i);

      if (levelMatch) {
        const level = parseInt(levelMatch[1], 10);
        const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 1;
        // Status code mappings: 2 = Charging, 3 = Discharging, 4 = Not charging, 5 = Full
        let statusText = 'Discharging';
        let isCharging = false;
        if (statusCode === 2) {
          statusText = 'Charging';
          isCharging = true;
        } else if (statusCode === 5) {
          statusText = 'Full';
          isCharging = true;
        } else if (acMatch && acMatch[1] === 'true') {
          isCharging = true;
        }

        battery = {
          level,
          isCharging,
          statusText
        };
      }
    }

    // Parse Screen Resolution
    let resolution = null;
    if (sizeRes.stdout) {
      const match = sizeRes.stdout.match(/(?:Physical|Override)\s*size:\s*(\d+x\d+)/i);
      if (match) {
        resolution = match[1];
      }
    }

    // Parse Screen Density
    let density = null;
    if (densityRes.stdout) {
      const match = densityRes.stdout.match(/(?:Physical|Override)\s*density:\s*(\d+)/i);
      if (match) {
        density = `${match[1]} dpi`;
      }
    }

    // Parse IP Address
    let ipAddress = null;
    if (dev.isWireless) {
      ipAddress = dev.serial.split(':')[0];
    } else if (ipRes.stdout) {
      const match = ipRes.stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        ipAddress = match[1];
      }
    }

    return {
      success: true,
      serial: dev.serial,
      state: 'connected',
      isWireless: dev.isWireless,
      model: fullModel,
      manufacturer,
      androidVersion: androidVersion ? `Android ${androidVersion}` : null,
      apiLevel,
      ipAddress,
      battery,
      resolution,
      density
    };
  }

  /**
   * List all discovered mDNS services (pairing and connect endpoints)
   */
  async getMdnsServices() {
    const res = await this.execute(['mdns', 'services'], 4000);
    if (res.code !== 0) return [];

    const lines = res.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const services = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes('discovered mdns services') || line.startsWith('*')) continue;

      const parts = line.split(/\t+/);
      if (parts.length >= 3) {
        const name = parts[0].trim();
        const type = parts[1].trim(); // '_adb-tls-pairing._tcp' or '_adb-tls-connect._tcp'
        const endpoint = parts[2].trim();
        const epParts = endpoint.split(':');
        const ip = epParts[0];
        const port = parseInt(epParts[1], 10);

        services.push({
          name,
          type,
          endpoint,
          ip,
          port
        });
      }
    }
    return services;
  }
}

module.exports = new AdbManager();
