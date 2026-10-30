const crypto = require('crypto');
const adbManager = require('./adb-manager');
const diagnosticsService = require('./diagnostics-service');
const settingsStore = require('./settings-store');

class QrPairingService {
  constructor() {
    this.activeSession = null;
    this.pollInterval = null;
    this.statusListeners = [];
  }

  /**
   * Start a new QR pairing session.
   * Cancels any active session first to prevent concurrent conflicts.
   */
  async startSession(options = {}) {
    // 1. Cleanly cancel previous active session if running
    if (this.activeSession) {
      await this.cancelSession();
    }

    // 2. Generate random credentials (transient in-memory only)
    const serviceName = `kmr-${crypto.randomBytes(4).toString('hex')}`;
    const password = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit numeric PIN
    const qrPayload = `WIFI:T:ADB;S:${serviceName};P:${password};;`;

    const timeoutSeconds = options.timeoutSeconds || 90;
    const expiresAt = Date.now() + timeoutSeconds * 1000;

    this.activeSession = {
      id: crypto.randomBytes(6).toString('hex'),
      serviceName,
      password, // Transient secret: cleaned up when session ends
      qrPayload,
      status: 'waiting_scan', // 'waiting_scan' | 'pairing' | 'connecting' | 'connected' | 'timeout' | 'cancelled' | 'error'
      message: 'Ready to pair. Open Android Wireless Debugging and scan the QR code.',
      startedAt: Date.now(),
      expiresAt,
      remainingSeconds: timeoutSeconds,
      device: null,
      error: null
    };

    // Redacted log
    diagnosticsService.log('INFO', 'QR_PAIR', `Started QR pairing session (${serviceName}). Waiting for scan.`);

    // 3. Start mDNS watcher and countdown
    this.startWatcher();

    // 4. Return safe session details to caller
    return {
      success: true,
      sessionId: this.activeSession.id,
      qrPayload: this.activeSession.qrPayload,
      serviceName: this.activeSession.serviceName,
      timeoutSeconds,
      remainingSeconds: timeoutSeconds,
      status: this.activeSession.status,
      message: this.activeSession.message
    };
  }

  startWatcher() {
    this.stopWatcher();

    this.pollInterval = setInterval(async () => {
      if (!this.activeSession) {
        this.stopWatcher();
        return;
      }

      // Check timeout
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((this.activeSession.expiresAt - now) / 1000));
      this.activeSession.remainingSeconds = remaining;

      if (remaining <= 0) {
        this.activeSession.status = 'timeout';
        this.activeSession.message = 'Pairing session timed out. Verify your Wi-Fi network and tap Retry.';
        this.activeSession.password = null; // Memory scrub
        diagnosticsService.log('WARN', 'QR_PAIR', 'QR pairing session timed out.');
        this.notifyStatus();
        this.stopWatcher();
        return;
      }

      // If already in middle of pairing or connecting, skip polling tick
      if (this.activeSession.status === 'pairing' || this.activeSession.status === 'connecting') {
        this.notifyStatus();
        return;
      }

      // Query active mDNS services via ADB
      try {
        const services = await adbManager.getMdnsServices();

        // 1. Look for _adb-tls-pairing._tcp
        const pairingService = services.find(s => s.type === '_adb-tls-pairing._tcp');
        if (pairingService && this.activeSession.status === 'waiting_scan') {
          await this.handlePairingServiceDetected(pairingService);
          return;
        }

        this.notifyStatus();
      } catch (err) {
        diagnosticsService.log('WARN', 'QR_PAIR', `Error polling mDNS: ${err.message}`);
      }
    }, 1200);
  }

  async handlePairingServiceDetected(service) {
    if (!this.activeSession || this.activeSession.status !== 'waiting_scan') return;

    this.activeSession.status = 'pairing';
    this.activeSession.message = `Phone detected at ${service.endpoint}. Authenticating...`;
    diagnosticsService.log('INFO', 'QR_PAIR', `Detected pairing service ${service.name} at ${service.endpoint}. Executing adb pair.`);
    this.notifyStatus();

    // Call adb pair with transient password
    const pairResult = await adbManager.pairDevice(service.ip, service.port, this.activeSession.password);

    if (!pairResult.success) {
      diagnosticsService.log('WARN', 'QR_PAIR', `adb pair failed: ${pairResult.error}`);
      this.activeSession.status = 'error';
      this.activeSession.error = pairResult.error;
      this.activeSession.message = `Pairing failed: ${pairResult.error}`;
      this.activeSession.password = null; // Memory scrub
      this.notifyStatus();
      this.stopWatcher();
      return;
    }

    // Successfully paired! Transition to connecting
    this.activeSession.status = 'connecting';
    this.activeSession.message = 'Pairing successful! Establishing wireless connection...';
    diagnosticsService.log('INFO', 'QR_PAIR', `Pairing successful for ${service.ip}. Waiting for connect service...`);
    this.notifyStatus();

    // Poll for _adb-tls-connect._tcp for up to 8 seconds
    let connected = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise(r => setTimeout(r, 1000));
      if (!this.activeSession) return;

      const services = await adbManager.getMdnsServices();
      const connectService = services.find(s => s.ip === service.ip && s.type === '_adb-tls-connect._tcp');

      if (connectService) {
        diagnosticsService.log('INFO', 'QR_PAIR', `Connecting to ${connectService.endpoint}`);
        const connRes = await adbManager.connectDevice(connectService.ip, connectService.port);
        if (connRes.success) {
          connected = true;
          this.activeSession.status = 'connected';
          this.activeSession.device = {
            serial: connectService.endpoint,
            ip: connectService.ip,
            port: connectService.port
          };
          this.activeSession.message = `Connected wirelessly to ${connectService.endpoint}!`;

          // Remember device in trusted devices
          settingsStore.addTrustedDevice({
            ip: connectService.ip,
            port: connectService.port,
            alias: `Wireless Device (${connectService.ip})`
          });

          diagnosticsService.log('INFO', 'QR_PAIR', `Device connected successfully: ${connectService.endpoint}`);
          break;
        }
      }
    }

    // Check device list as fallback if already connected
    if (!connected) {
      const devList = await adbManager.getDevices();
      const attachedDev = (devList.devices || []).find(d => d.serial.startsWith(`${service.ip}:`));
      if (attachedDev && attachedDev.state === 'device') {
        connected = true;
        this.activeSession.status = 'connected';
        this.activeSession.device = attachedDev;
        this.activeSession.message = `Connected wirelessly to ${attachedDev.serial}!`;
      }
    }

    if (connected) {
      this.activeSession.password = null; // Clean up secret immediately
      this.notifyStatus();
      this.stopWatcher();
    } else {
      this.activeSession.status = 'error';
      this.activeSession.message = 'Pairing completed, but connection timed out. You can use Direct Connect to establish the connection.';
      this.activeSession.password = null;
      this.notifyStatus();
      this.stopWatcher();
    }
  }

  async cancelSession() {
    this.stopWatcher();
    if (this.activeSession) {
      this.activeSession.status = 'cancelled';
      this.activeSession.message = 'QR pairing session cancelled by user.';
      this.activeSession.password = null; // Scrub secret
      diagnosticsService.log('INFO', 'QR_PAIR', 'QR pairing session cancelled.');
      this.notifyStatus();
      this.activeSession = null;
    }
    return { success: true };
  }

  stopWatcher() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getStatus() {
    if (!this.activeSession) {
      return { status: 'idle', message: 'No active pairing session.' };
    }
    return {
      status: this.activeSession.status,
      sessionId: this.activeSession.id,
      serviceName: this.activeSession.serviceName,
      remainingSeconds: this.activeSession.remainingSeconds,
      message: this.activeSession.message,
      error: this.activeSession.error,
      device: this.activeSession.device
    };
  }

  onStatus(callback) {
    this.statusListeners.push(callback);
  }

  notifyStatus() {
    const status = this.getStatus();
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (e) {}
    }
  }
}

module.exports = new QrPairingService();
