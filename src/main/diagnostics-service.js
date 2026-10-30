const fs = require('fs');
const path = require('path');
const os = require('os');

class DiagnosticsService {
  constructor() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    this.logDir = path.join(appData, 'KMR-Control');
    this.logFile = path.join(this.logDir, 'diagnostics.log');
    this.maxMemoryLogs = 500;
    this.logs = [];

    // Redaction patterns
    this.username = os.userInfo().username;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      this.log('INFO', 'SYSTEM', 'KMR Control Diagnostics Service initialized.');
    } catch (e) {
      console.error('[DiagnosticsService] Init error:', e.message);
    }
  }

  /**
   * Strictly redacts sensitive credentials, pairing PINs, and personal paths
   */
  redact(text) {
    if (typeof text !== 'string') return String(text);
    let sanitized = text;

    // 1. Redact temporary pairing codes (6 numeric digits following pair/code/password/pin)
    sanitized = sanitized.replace(/(pair(?:ing)?(?:\s+code|\s+pin)?\s*[:=]?\s*)\b\d{6}\b/gi, '$1[REDACTED CODE]');
    sanitized = sanitized.replace(/(\badb\s+pair\s+[^\s]+\s+)\b\d{6}\b/gi, '$1[REDACTED CODE]');
    sanitized = sanitized.replace(/\b(code|pin|password)\s*[:=]\s*\d+/gi, '$1:[REDACTED]');

    // 1b. Redact QR code payload secrets & service credentials
    sanitized = sanitized.replace(/(;P:)[^;]+/gi, '$1[REDACTED]');
    sanitized = sanitized.replace(/WIFI:T:ADB;S:[^;]+;P:[^;]+;;/gi, 'WIFI:T:ADB;S:[REDACTED];P:[REDACTED];;');

    // 2. Redact Windows username from paths
    if (this.username) {
      const userRegex = new RegExp(`\\\\Users\\\\${this.username}\\b`, 'gi');
      sanitized = sanitized.replace(userRegex, '\\Users\\<USER>');
      const slashRegex = new RegExp(`/Users/${this.username}\\b`, 'gi');
      sanitized = sanitized.replace(slashRegex, '/Users/<USER>');
    }

    // 3. Redact ADB authentication tokens / GUIDs
    sanitized = sanitized.replace(/guid=[a-f0-9-]+/gi, 'guid=[REDACTED]');
    sanitized = sanitized.replace(/auth_key=[^\s&]+/gi, 'auth_key=[REDACTED]');

    return sanitized;
  }

  log(level, tag, message) {
    const timestamp = new Date().toISOString();
    const redactedMsg = this.redact(message);
    const entry = {
      timestamp,
      level: level.toUpperCase(),
      tag: tag.toUpperCase(),
      message: redactedMsg
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxMemoryLogs) {
      this.logs.shift();
    }

    // Append to file safely
    try {
      const line = `[${timestamp}] [${entry.level}] [${entry.tag}] ${redactedMsg}\n`;
      fs.appendFileSync(this.logFile, line, 'utf8');
    } catch (err) {}

    return entry;
  }

  getLogs(filter = '') {
    const f = filter.toLowerCase().trim();
    if (!f) return this.logs;
    return this.logs.filter(l => 
      l.message.toLowerCase().includes(f) ||
      l.tag.toLowerCase().includes(f) ||
      l.level.toLowerCase().includes(f)
    );
  }

  clearLogs() {
    this.logs = [];
    try {
      if (fs.existsSync(this.logFile)) {
        fs.writeFileSync(this.logFile, '', 'utf8');
      }
    } catch (e) {}
    this.log('INFO', 'SYSTEM', 'Diagnostics logs cleared by user.');
    return true;
  }

  generateSystemReport(deviceInfo = null, adbVersion = '37.0.1', engineVersion = '5.0.1') {
    const timestamp = new Date().toISOString();
    const lines = [
      '================================================================',
      '             KMR CONTROL — SYSTEM DIAGNOSTIC REPORT             ',
      '================================================================',
      `Generated: ${timestamp}`,
      `Application: KMR Control v1.0.0`,
      `Engine: KMR Control Engine (ADB v${adbVersion})`,
      `Host OS: ${os.type()} ${os.release()} (${os.arch()})`,
      `Node.js: ${process.version}`,
      '----------------------------------------------------------------',
      'ACTIVE DEVICE STATUS:',
      deviceInfo ? JSON.stringify(deviceInfo, null, 2) : 'No active device connected',
      '----------------------------------------------------------------',
      'RECENT DIAGNOSTIC LOGS (REDACTED):'
    ];

    for (const l of this.logs.slice(-50)) {
      lines.push(`[${l.timestamp}] [${l.level}] [${l.tag}] ${l.message}`);
    }

    lines.push('================================================================');
    return lines.join('\n');
  }
}

module.exports = new DiagnosticsService();
