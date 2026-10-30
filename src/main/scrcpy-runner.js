const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const adbManager = require('./adb-manager');
const diagnosticsService = require('./diagnostics-service');

class ScrcpyRunner {
  constructor() {
    this.scrcpyPath = this.resolveScrcpyPath();
    this.activeProcess = null;
    this.activeSerial = null;
    this.isMirroring = false;
    this.isRecording = false;
    this.recordingProcess = null;
    this.recordingPath = null;
  }

  resolveScrcpyPath() {
    const candidates = [
      // 1. Look for rebranded kmr-engine executable
      path.join(__dirname, '../../kmr-engine.exe'),
      path.join(process.cwd(), 'kmr-engine.exe'),
      path.join(path.dirname(process.execPath), 'kmr-engine.exe'),
      path.join(process.resourcesPath || '', 'kmr-engine.exe'),
      // 2. Fallback to original scrcpy executable in dev/legacy directory
      path.join(__dirname, '../../scrcpy.exe'),
      path.join(process.cwd(), 'scrcpy.exe'),
      path.join(path.dirname(process.execPath), 'scrcpy.exe'),
      path.join(process.resourcesPath || '', 'scrcpy.exe')
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
    return 'kmr-engine.exe';
  }

  /**
   * Validate user-supplied mirroring settings (Security & Correctness)
   */
  validateSettings(options = {}) {
    const errors = [];
    const sanitized = {};

    // 1. Device Serial
    if (!options.serial || typeof options.serial !== 'string') {
      errors.push('Target device serial is required');
    } else {
      sanitized.serial = options.serial.trim();
    }

    // 2. Max Resolution
    if (options.maxResolution && options.maxResolution !== 'auto') {
      const res = parseInt(options.maxResolution, 10);
      if (isNaN(res) || res < 320 || res > 7680) {
        errors.push('Max resolution must be "auto" or an integer between 320 and 7680');
      } else {
        sanitized.maxResolution = res;
      }
    } else {
      sanitized.maxResolution = 'auto';
    }

    // 3. Video Bitrate
    if (options.bitRate) {
      const br = String(options.bitRate).trim().toUpperCase();
      if (!/^\d+[KM]?$/.test(br)) {
        errors.push('Bitrate must be a number optionally suffixed with K or M (e.g. 8M, 4M)');
      } else {
        sanitized.bitRate = br;
      }
    } else {
      sanitized.bitRate = '8M';
    }

    // 4. Max FPS
    if (options.maxFps) {
      const fps = parseInt(options.maxFps, 10);
      if (isNaN(fps) || fps < 10 || fps > 240) {
        errors.push('Max FPS must be an integer between 10 and 240');
      } else {
        sanitized.maxFps = fps;
      }
    } else {
      sanitized.maxFps = 60;
    }

    // 5. Booleans
    sanitized.fullscreen = Boolean(options.fullscreen);
    sanitized.alwaysOnTop = Boolean(options.alwaysOnTop);
    sanitized.turnScreenOff = Boolean(options.turnScreenOff);
    sanitized.stayAwake = options.stayAwake !== false; // default true
    sanitized.noAudio = Boolean(options.noAudio);
    sanitized.showFps = Boolean(options.showFps);
    sanitized.windowTitle = options.windowTitle
      ? String(options.windowTitle).replace(/["\\]/g, '').substring(0, 50)
      : `KMR Control - ${sanitized.serial}`;

    // 6. Record path
    if (options.recordPath) {
      const recPath = path.resolve(String(options.recordPath).trim());
      const ext = path.extname(recPath).toLowerCase();
      if (!['.mp4', '.mkv'].includes(ext)) {
        errors.push('Recording file must end with .mp4 or .mkv');
      } else {
        sanitized.recordPath = recPath;
      }
    }

    sanitized.noPlayback = Boolean(options.noPlayback);

    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Build scrcpy argument array (No shell concatenation)
   */
  buildArgs(sanitized) {
    const args = ['-s', sanitized.serial];

    // Title
    args.push(`--window-title=${sanitized.windowTitle}`);

    // Resolution
    if (sanitized.maxResolution && sanitized.maxResolution !== 'auto') {
      args.push(`--max-size=${sanitized.maxResolution}`);
    }

    // Bitrate
    if (sanitized.bitRate) {
      args.push(`--video-bit-rate=${sanitized.bitRate}`);
    }

    // Max FPS
    if (sanitized.maxFps) {
      args.push(`--max-fps=${sanitized.maxFps}`);
    }

    // Window options
    if (sanitized.fullscreen) args.push('--fullscreen');
    if (sanitized.alwaysOnTop) args.push('--always-on-top');
    if (sanitized.turnScreenOff) args.push('--turn-screen-off');
    if (sanitized.stayAwake) args.push('--stay-awake');
    if (sanitized.noAudio) args.push('--no-audio');
    if (sanitized.showFps) args.push('--print-fps');

    // Recording options
    if (sanitized.recordPath) {
      args.push(`--record=${sanitized.recordPath}`);
    }
    if (sanitized.noPlayback) {
      args.push('--no-playback');
    }

    return args;
  }

  /**
   * Start scrcpy mirroring session
   */
  async startMirroring(options, onStatusChange) {
    if (this.isMirroring && this.activeProcess) {
      return { success: false, error: 'A mirroring session is already active.' };
    }

    const validation = this.validateSettings(options);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join('; ') };
    }

    // Verify device is attached and authorized in ADB before launching scrcpy
    const devList = await adbManager.getDevices();
    const dev = (devList.devices || []).find(d => d.serial === validation.sanitized.serial);
    if (!dev) {
      return {
        success: false,
        error: `Device ${validation.sanitized.serial} is not currently attached. Please pair or connect first.`
      };
    }
    if (dev.state === 'unauthorized') {
      return {
        success: false,
        error: `Device ${validation.sanitized.serial} is unauthorized. Accept the debugging prompt on your phone.`
      };
    }

    const args = this.buildArgs(validation.sanitized);
    diagnosticsService.log('INFO', 'SCRCPY', `Launching scrcpy for ${validation.sanitized.serial} (${validation.sanitized.maxResolution || 'auto'}, ${validation.sanitized.bitRate || '8M'})`);

    return new Promise((resolve) => {
      let proc;
      try {
        proc = spawn(this.scrcpyPath, args, {
          windowsHide: false, // scrcpy needs its own SDL window
          shell: false
        });
      } catch (err) {
        return resolve({ success: false, error: `Failed to spawn scrcpy: ${err.message}` });
      }

      this.activeProcess = proc;
      this.activeSerial = validation.sanitized.serial;
      this.isMirroring = true;

      let hasResolved = false;
      let startupError = '';

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        console.log(`[scrcpy:stdout] ${text.trim()}`);
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        console.log(`[scrcpy:stderr] ${text.trim()}`);
        startupError += text;
      });

      proc.on('close', (code) => {
        console.log(`[ScrcpyRunner] Process exited with code ${code}`);
        const wasMirroring = this.isMirroring;
        this.isMirroring = false;
        this.activeProcess = null;
        this.activeSerial = null;

        let reason = 'Normal exit';
        if (code === 1) reason = 'scrcpy start failure (check device connection or arguments)';
        if (code === 2) reason = 'Device disconnected while mirroring';

        if (!hasResolved) {
          hasResolved = true;
          return resolve({
            success: false,
            error: startupError.trim() || `scrcpy failed with exit code ${code} (${reason})`
          });
        }

        if (onStatusChange) {
          onStatusChange({
            active: false,
            code,
            reason,
            wasRunning: wasMirroring
          });
        }
      });

      // Give scrcpy 1.5s to verify startup
      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          if (this.isMirroring && this.activeProcess) {
            resolve({
              success: true,
              pid: proc.pid,
              serial: validation.sanitized.serial,
              message: 'Mirroring session started successfully.'
            });
            if (onStatusChange) {
              onStatusChange({ active: true, serial: validation.sanitized.serial });
            }
          } else {
            resolve({
              success: false,
              error: startupError.trim() || 'scrcpy process terminated immediately.'
            });
          }
        }
      }, 1500);
    });
  }

  /**
   * Stop active mirroring session
   */
  stopMirroring() {
    if (!this.activeProcess || !this.isMirroring) {
      return { success: true, message: 'No active mirroring session.' };
    }

    try {
      this.activeProcess.kill('SIGTERM');
      this.isMirroring = false;
      this.activeProcess = null;
      this.activeSerial = null;
      return { success: true, message: 'Mirroring session stopped.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  getStatus() {
    return {
      isMirroring: this.isMirroring,
      activeSerial: this.activeSerial,
      isRecording: this.isRecording,
      recordingPath: this.recordingPath
    };
  }

  /**
   * Take screenshot of the wirelessly connected device
   * Uses adb exec-out screencap -p for fast, silent capture
   */
  async takeScreenshot(serial, outputDir) {
    if (!serial) {
      return { success: false, error: 'Target device serial is required' };
    }

    const dir = outputDir || path.join(os.homedir(), 'Pictures', 'KMR-Control');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `kmr_capture_${serial.replace(/[:.]/g, '_')}_${timestamp}.png`;
    const filePath = path.join(dir, filename);

    return new Promise((resolve) => {
      const adbExe = adbManager.resolveAdbPath();
      const proc = spawn(adbExe, ['-s', serial, 'exec-out', 'screencap', '-p'], {
        shell: false
      });

      const writeStream = fs.createWriteStream(filePath);
      proc.stdout.pipe(writeStream);

      let stderr = '';
      proc.stderr.on('data', d => stderr += d.toString());

      proc.on('close', (code) => {
        writeStream.close();
        if (code === 0 && fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
          resolve({
            success: true,
            filePath,
            filename,
            size: fs.statSync(filePath).size
          });
        } else {
          try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
          resolve({
            success: false,
            error: stderr.trim() || 'Failed to capture screenshot from device.'
          });
        }
      });

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Start Screen Recording (scrcpy --record=file.mp4)
   */
  async startRecording(options, onStatusChange) {
    if (this.isRecording) {
      return { success: false, error: 'A recording session is already in progress.' };
    }

    const dir = options.outputDir || path.join(os.homedir(), 'Videos', 'KMR-Control');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `kmr_recording_${(options.serial || 'device').replace(/[:.]/g, '_')}_${timestamp}.mp4`;
    const filePath = path.join(dir, filename);

    const recordingOptions = {
      ...options,
      recordPath: filePath,
      noPlayback: options.noPlayback !== false // default true for clean recording
    };

    const validation = this.validateSettings(recordingOptions);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join('; ') };
    }

    const args = this.buildArgs(validation.sanitized);

    return new Promise((resolve) => {
      let proc;
      try {
        proc = spawn(this.scrcpyPath, args, {
          windowsHide: false,
          shell: false
        });
      } catch (err) {
        return resolve({ success: false, error: err.message });
      }

      this.recordingProcess = proc;
      this.isRecording = true;
      this.recordingPath = filePath;

      proc.on('close', (code) => {
        this.isRecording = false;
        this.recordingProcess = null;
        if (onStatusChange) {
          onStatusChange({ active: false, code, filePath });
        }
      });

      setTimeout(() => {
        if (this.isRecording) {
          resolve({
            success: true,
            filePath,
            filename,
            message: 'Recording started successfully.'
          });
          if (onStatusChange) {
            onStatusChange({ active: true, filePath });
          }
        } else {
          resolve({ success: false, error: 'Recording process exited immediately.' });
        }
      }, 1000);
    });
  }

  /**
   * Stop Screen Recording
   */
  stopRecording() {
    if (!this.recordingProcess || !this.isRecording) {
      return { success: true, message: 'No recording in progress.' };
    }

    const filePath = this.recordingPath;
    try {
      this.recordingProcess.kill('SIGTERM');
      this.isRecording = false;
      this.recordingProcess = null;
      this.recordingPath = null;
      return { success: true, filePath, message: 'Recording stopped and saved successfully.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new ScrcpyRunner();
