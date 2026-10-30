const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const diagnosticsService = require('../src/main/diagnostics-service');
const settingsStore = require('../src/main/settings-store');
const adbManager = require('../src/main/adb-manager');

console.log('--- Starting KMR Control Phase 5 (Diagnostics & Resilience) Tests ---');

// 1. Test Sensitive Data Redaction
console.log('[TEST] Testing Diagnostics Redaction Engine...');

// Test pairing code redaction
const rawPairCommand = 'Executing: adb pair 192.168.1.150:41253 482910 for client initialization';
const redactedPair = diagnosticsService.redact(rawPairCommand);
assert.ok(!redactedPair.includes('482910'), 'Pairing code 482910 was NOT redacted!');
assert.ok(redactedPair.includes('[REDACTED CODE]'), 'Missing [REDACTED CODE] marker');
console.log(`[PASS] Pairing code redacted: "${rawPairCommand}" -> "${redactedPair}"`);

// Test PIN keyword redaction
const rawPinLog = 'Device reported pairing pin: 123456';
const redactedPin = diagnosticsService.redact(rawPinLog);
assert.ok(!redactedPin.includes('123456'), 'PIN 123456 was NOT redacted!');
assert.ok(redactedPin.includes('[REDACTED CODE]'), 'Missing [REDACTED CODE] in PIN string');
console.log(`[PASS] PIN keyword redacted: "${rawPinLog}" -> "${redactedPin}"`);

// Test Username Path Redaction
const currentUsername = os.userInfo().username;
const rawPath = `C:\\Users\\${currentUsername}\\Downloads\\scrcpy-win64-v5.0.1\\adb.exe`;
const redactedPath = diagnosticsService.redact(rawPath);
assert.ok(!redactedPath.includes(currentUsername), `Username ${currentUsername} was NOT redacted!`);
assert.ok(redactedPath.includes('<USER>'), 'Missing <USER> placeholder in path');
console.log(`[PASS] Username path redacted: "${rawPath}" -> "${redactedPath}"`);

// Test GUID Redaction
const rawGuid = 'Device paired successfully guid=4f2a9c1e-8b3d-4e5f-a6b7-c8d9e0f1a2b3';
const redactedGuid = diagnosticsService.redact(rawGuid);
assert.ok(!redactedGuid.includes('4f2a9c1e-8b3d-4e5f-a6b7-c8d9e0f1a2b3'), 'GUID was NOT redacted!');
assert.ok(redactedGuid.includes('guid=[REDACTED]'), 'Missing guid=[REDACTED]');
console.log(`[PASS] GUID redacted: "${rawGuid}" -> "${redactedGuid}"`);

// 2. Test Logging and Filter Search
console.log('[TEST] Testing Diagnostics Logger & Filter Engine...');
diagnosticsService.clearLogs();
diagnosticsService.log('INFO', 'TEST_NET', 'Testing network interface connectivity');
diagnosticsService.log('WARN', 'TEST_ADB', 'Device connection refused on port 38421');
diagnosticsService.log('ERROR', 'TEST_SCR', 'Failed to initialize video decoder');

const allLogs = diagnosticsService.getLogs();
assert.strictEqual(allLogs.length, 4); // 1 from clearLogs() + 3 logged above

const filteredAdb = diagnosticsService.getLogs('38421');
assert.strictEqual(filteredAdb.length, 1);
assert.strictEqual(filteredAdb[0].level, 'WARN');

const filteredScr = diagnosticsService.getLogs('decoder');
assert.strictEqual(filteredScr.length, 1);
assert.strictEqual(filteredScr[0].level, 'ERROR');
console.log('[PASS] Logging and search filter verified');

// 3. Test Reconnection Resilience & Port Updates
console.log('[TEST] Testing Reconnection Port Update Resilience...');
const testDev = settingsStore.addTrustedDevice({
  ip: '192.168.1.188',
  port: 38421,
  alias: 'Samsung S22 Office'
});
assert.strictEqual(testDev.port, 38421);

// Phone rebooted: connection port changed to 43912
const updatedDev = settingsStore.updateTrustedDevicePort(testDev.id, 43912);
assert.ok(updatedDev, 'Failed to update device port');
assert.strictEqual(updatedDev.port, 43912);
assert.strictEqual(updatedDev.id, '192.168.1.188:43912');

// Verify invalid port is rejected
const invalidUpdate = settingsStore.updateTrustedDevicePort(updatedDev.id, 99999);
assert.strictEqual(invalidUpdate, false);

// Clean up test device
settingsStore.removeTrustedDevice('192.168.1.188:43912');
console.log('[PASS] Reconnection resilience & port update verified without requiring re-pairing');

// 4. Test System Diagnostic Report Generation
console.log('[TEST] Testing System Diagnostic Report Generation...');
const report = diagnosticsService.generateSystemReport({
  model: 'Google Pixel 8',
  androidVersion: 'Android 14',
  state: 'connected'
});
assert.ok(report.includes('KMR CONTROL — SYSTEM DIAGNOSTIC REPORT'));
assert.ok(report.includes('Google Pixel 8'));
assert.ok(report.includes('RECENT DIAGNOSTIC LOGS'));
assert.ok(!report.includes(currentUsername), 'Report contained unredacted username!');
console.log('[PASS] System diagnostic report generated and verified clean of sensitive data');

// 5. Test UI & Troubleshooting Guide Elements
const indexHtml = fs.readFileSync(path.resolve(__dirname, '../src/renderer/index.html'), 'utf8');
assert.ok(indexHtml.includes('btn-copy-diagnostics'), 'Missing btn-copy-diagnostics');
assert.ok(indexHtml.includes('btn-export-report'), 'Missing btn-export-report');
assert.ok(indexHtml.includes('diag-search-input'), 'Missing diag-search-input');
assert.ok(indexHtml.includes('Connection Refused'), 'Missing troubleshooting guide content');
console.log('[PASS] Diagnostics UI and In-App Troubleshooting Guide validated');

console.log('--- ALL PHASE 5 TESTS PASSED SUCCESSFULLY ---');
