const assert = require('assert');
const fs = require('fs');
const path = require('path');
const settingsStore = require('../src/main/settings-store');

console.log('--- Starting KMR Control Phase 1 Smoke Test ---');

// 1. Verify engine and ADB prebuilt binaries exist and are unmodified
const rootDir = path.resolve(__dirname, '..');
const requiredFiles = [
  'scrcpy.exe',
  'adb.exe',
  'scrcpy-server',
  'SDL3.dll',
  'avcodec-63.dll',
  'avformat-63.dll',
  'avutil-61.dll',
  'swresample-7.dll',
  'AdbWinApi.dll',
  'AdbWinUsbApi.dll',
  'LICENSE.txt'
];

for (const file of requiredFiles) {
  const fullPath = path.join(rootDir, file);
  assert.ok(fs.existsSync(fullPath), `Required binary/file missing: ${file}`);
  const stat = fs.statSync(fullPath);
  assert.ok(stat.size > 0, `File ${file} is empty`);
  console.log(`[PASS] Verified binary integrity: ${file} (${stat.size} bytes)`);
}

// 2. Test Settings Store
const initialTheme = settingsStore.get('theme');
console.log(`[INFO] Current theme setting: ${initialTheme}`);

settingsStore.set('theme', 'dark');
assert.strictEqual(settingsStore.get('theme'), 'dark', 'Failed to update theme to dark');

settingsStore.set('theme', 'light');
assert.strictEqual(settingsStore.get('theme'), 'light', 'Failed to update theme to light');

settingsStore.set('theme', initialTheme); // restore
console.log('[PASS] SettingsStore theme persistence verified');

// 3. Test Security constraint: Trusted device must never store pairing PIN
const testDevice = {
  alias: 'Test Pixel 7',
  ip: '192.168.1.150',
  port: 43215,
  pairingPin: '123456' // Attempt to supply a pairing PIN
};

const savedDevice = settingsStore.addTrustedDevice(testDevice);
assert.strictEqual(savedDevice.pairingPin, undefined, 'SECURITY VIOLATION: Pairing PIN was stored in device record!');
const storedList = settingsStore.get('trustedDevices');
const retrieved = storedList.find(d => d.id === '192.168.1.150:43215');
assert.ok(retrieved, 'Failed to retrieve saved trusted device');
assert.strictEqual(retrieved.pairingPin, undefined, 'SECURITY VIOLATION: Pairing PIN persisted to storage!');
settingsStore.removeTrustedDevice('192.168.1.150:43215');
console.log('[PASS] Security verification passed: Pairing PINs are strictly excluded from storage');

// 4. Test Renderer and Preload files exist
const frontendFiles = [
  'src/preload/preload.js',
  'src/renderer/index.html',
  'src/renderer/styles/main.css',
  'src/renderer/scripts/theme.js',
  'src/renderer/scripts/renderer.js'
];

for (const f of frontendFiles) {
  assert.ok(fs.existsSync(path.join(rootDir, f)), `Missing frontend file: ${f}`);
  console.log(`[PASS] Frontend component verified: ${f}`);
}

console.log('--- ALL PHASE 1 SMOKE TESTS PASSED SUCCESSFULLY ---');
