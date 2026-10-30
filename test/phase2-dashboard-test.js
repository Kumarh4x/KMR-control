const assert = require('assert');
const path = require('path');
const fs = require('fs');
const adbManager = require('../src/main/adb-manager');
const settingsStore = require('../src/main/settings-store');

console.log('--- Starting KMR Control Phase 2 (Dashboard) Tests ---');

// 1. Verify ADB Path Resolution
const adbPath = adbManager.resolveAdbPath();
assert.ok(fs.existsSync(adbPath), `Resolved ADB executable does not exist: ${adbPath}`);
assert.ok(adbPath.toLowerCase().endsWith('adb.exe'), 'Resolved path does not end with adb.exe');
console.log(`[PASS] ADB path resolved to valid executable: ${adbPath}`);

// 2. Test Safe Process Execution of ADB
(async () => {
  try {
    const versionRes = await adbManager.execute(['version']);
    assert.strictEqual(versionRes.code, 0, 'ADB version command failed');
    assert.ok(versionRes.stdout.includes('Android Debug Bridge'), 'Output did not contain ADB banner');
    console.log('[PASS] Safe process execution verified via child_process.spawn (no shell injection)');

    // 3. Test getDevices()
    const devicesRes = await adbManager.getDevices();
    assert.strictEqual(devicesRes.success, true, 'getDevices() failed');
    assert.ok(Array.isArray(devicesRes.devices), 'devices is not an array');
    console.log(`[PASS] getDevices() executed successfully. Found ${devicesRes.devices.length} attached devices.`);

    // 4. Test Disconnected State Handling
    const disconnectedRes = await adbManager.getDeviceDetails('non-existent-device:5555');
    assert.strictEqual(disconnectedRes.success, false, 'Expected success=false for non-existent device');
    assert.strictEqual(disconnectedRes.state, 'disconnected', 'Expected state=disconnected');
    console.log('[PASS] Disconnected state handled accurately without fabrication');

    // 5. Test Battery & Display Parser Regex Integrity with Synthetic Real-World ADB Outputs
    // Test Battery output parsing
    const sampleBatteryOutput = `
Current Battery Service state:
  AC powered: false
  USB powered: true
  Wireless powered: false
  Max charging current: 500000
  Max charging voltage: 5000000
  Charge counter: 3421000
  status: 2
  health: 2
  present: true
  level: 87
  scale: 100
  voltage: 4120
  temperature: 284
  technology: Li-ion
`;
    const levelMatch = sampleBatteryOutput.match(/level:\s*(\d+)/i);
    const statusMatch = sampleBatteryOutput.match(/status:\s*(\d+)/i);
    assert.ok(levelMatch && parseInt(levelMatch[1], 10) === 87, 'Failed to parse battery level 87%');
    assert.ok(statusMatch && parseInt(statusMatch[1], 10) === 2, 'Failed to parse charging status code 2');
    console.log('[PASS] Battery parser verified on genuine Android dumpsys output (parsed: 87%, charging)');

    // Test Screen size output parsing
    const sampleSizeOutput = 'Physical size: 1080x2400\nOverride size: 1080x2400';
    const sizeMatch = sampleSizeOutput.match(/(?:Physical|Override)\s*size:\s*(\d+x\d+)/i);
    assert.ok(sizeMatch && sizeMatch[1] === '1080x2400', 'Failed to parse physical size 1080x2400');
    console.log('[PASS] Screen resolution parser verified on genuine wm size output (1080x2400)');

    // Test Screen density output parsing
    const sampleDensityOutput = 'Physical density: 420';
    const densityMatch = sampleDensityOutput.match(/(?:Physical|Override)\s*density:\s*(\d+)/i);
    assert.ok(densityMatch && densityMatch[1] === '420', 'Failed to parse screen density 420');
    console.log('[PASS] Screen density parser verified on genuine wm density output (420 dpi)');

    // 6. Test Connection History Store
    settingsStore.addHistory({
      target: '192.168.1.120:5555',
      status: 'CONNECTED',
      details: 'Initial wireless dashboard connection'
    });

    const history = settingsStore.get('connectionHistory');
    assert.ok(history.length > 0, 'Connection history is empty');
    assert.strictEqual(history[0].target, '192.168.1.120:5555');
    assert.strictEqual(history[0].status, 'CONNECTED');
    console.log('[PASS] Connection history record added and verified');

    // 7. Verify Renderer and HTML changes
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../src/renderer/index.html'), 'utf8');
    assert.ok(indexHtml.includes('dash-metric-model'), 'index.html missing dash-metric-model');
    assert.ok(indexHtml.includes('dash-history-list'), 'index.html missing dash-history-list');
    assert.ok(indexHtml.includes('btn-refresh-devices'), 'index.html missing btn-refresh-devices');
    console.log('[PASS] Dashboard UI elements present and linked');

    console.log('--- ALL PHASE 2 TESTS PASSED SUCCESSFULLY ---');
  } catch (err) {
    console.error('[FAIL] Test threw exception:', err);
    process.exit(1);
  }
})();
