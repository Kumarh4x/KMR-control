const assert = require('assert');
const path = require('path');
const fs = require('fs');
const scrcpyRunner = require('../src/main/scrcpy-runner');

console.log('--- Starting KMR Control Phase 4 (Engine Integration) Tests ---');

// 1. Verify scrcpy Executable Resolution
const scrcpyPath = scrcpyRunner.resolveScrcpyPath();
assert.ok(fs.existsSync(scrcpyPath), `scrcpy binary does not exist at ${scrcpyPath}`);
assert.ok(
  scrcpyPath.toLowerCase().endsWith('scrcpy.exe') || scrcpyPath.toLowerCase().endsWith('kmr-engine.exe'),
  'Resolved path does not end with scrcpy.exe or kmr-engine.exe'
);
console.log(`[PASS] scrcpy path resolved: ${scrcpyPath}`);

// 2. Test Settings Validation
console.log('[TEST] Testing Mirroring Settings Validation...');

// Test missing serial
const missingSerialVal = scrcpyRunner.validateSettings({});
assert.strictEqual(missingSerialVal.isValid, false, 'Expected validation to fail when serial is missing');
assert.ok(missingSerialVal.errors.some(e => e.includes('serial is required')));

// Test valid settings
const validSettings = {
  serial: '192.168.1.150:38421',
  maxResolution: '1920',
  bitRate: '8M',
  maxFps: '60',
  fullscreen: true,
  alwaysOnTop: true,
  turnScreenOff: false,
  stayAwake: true
};
const validVal = scrcpyRunner.validateSettings(validSettings);
assert.strictEqual(validVal.isValid, true, 'Valid settings failed validation');
assert.strictEqual(validVal.sanitized.maxResolution, 1920);
assert.strictEqual(validVal.sanitized.bitRate, '8M');
assert.strictEqual(validVal.sanitized.maxFps, 60);
assert.strictEqual(validVal.sanitized.fullscreen, true);
assert.strictEqual(validVal.sanitized.alwaysOnTop, true);
console.log('[PASS] Valid mirroring settings correctly parsed and sanitized');

// Test invalid resolution
const badResVal = scrcpyRunner.validateSettings({ serial: '192.168.1.10:5555', maxResolution: '100' });
assert.strictEqual(badResVal.isValid, false);
assert.ok(badResVal.errors.some(e => e.includes('resolution')));

// Test invalid bitrate
const badBrVal = scrcpyRunner.validateSettings({ serial: '192.168.1.10:5555', bitRate: 'fast' });
assert.strictEqual(badBrVal.isValid, false);
assert.ok(badBrVal.errors.some(e => e.includes('Bitrate')));

// Test invalid FPS
const badFpsVal = scrcpyRunner.validateSettings({ serial: '192.168.1.10:5555', maxFps: '5' });
assert.strictEqual(badFpsVal.isValid, false);
assert.ok(badFpsVal.errors.some(e => e.includes('FPS')));

// Test recording extension validation
const badExtVal = scrcpyRunner.validateSettings({ serial: '192.168.1.10:5555', recordPath: 'C:\\rec.exe' });
assert.strictEqual(badExtVal.isValid, false);
assert.ok(badExtVal.errors.some(e => e.includes('.mp4 or .mkv')));

const goodExtVal = scrcpyRunner.validateSettings({ serial: '192.168.1.10:5555', recordPath: 'C:\\rec.mp4' });
assert.strictEqual(goodExtVal.isValid, true);
console.log('[PASS] Invalid and valid bounds enforced for resolution, bitrate, FPS, and recording path');

// 3. Test Argument Vector Construction
console.log('[TEST] Testing CLI Argument Vector Generation (No shell string concatenation)...');
const args = scrcpyRunner.buildArgs(validVal.sanitized);
assert.ok(Array.isArray(args), 'Arguments must be an array');
assert.ok(args.includes('-s'), 'Missing -s flag');
assert.ok(args.includes('192.168.1.150:38421'), 'Missing serial argument');
assert.ok(args.includes('--max-size=1920'), 'Missing max resolution argument');
assert.ok(args.includes('--video-bit-rate=8M'), 'Missing bitrate argument');
assert.ok(args.includes('--max-fps=60'), 'Missing max-fps argument');
assert.ok(args.includes('--fullscreen'), 'Missing fullscreen argument');
assert.ok(args.includes('--always-on-top'), 'Missing always-on-top argument');
console.log(`[PASS] Argument array verified: [${args.join(', ')}]`);

(async () => {
  try {
    // 4. Test scrcpy Startup Failure Handling (Non-existent device)
    console.log('[TEST] Testing scrcpy Startup on unreachable device serial...');
    const failRes = await scrcpyRunner.startMirroring({
      serial: '127.0.0.2:59999',
      maxResolution: '1024'
    });
    assert.strictEqual(failRes.success, false, 'Expected start failure on invalid device');
    assert.ok(failRes.error, 'Expected start failure error message');
    console.log(`[PASS] scrcpy startup failure safely caught: "${failRes.error.trim().substring(0, 80)}..."`);

    // 5. Verify Process Cleanup & Status
    const status = scrcpyRunner.getStatus();
    assert.strictEqual(status.isMirroring, false, 'isMirroring should be false after exit');
    assert.strictEqual(status.activeSerial, null);
    console.log('[PASS] Process cleanup verified, status reset properly');

    // 6. Test stopMirroring when idle
    const stopIdle = scrcpyRunner.stopMirroring();
    assert.strictEqual(stopIdle.success, true);
    console.log('[PASS] stopMirroring() handles idle state safely');

    // 7. Test UI Bindings in index.html and renderer.js
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../src/renderer/index.html'), 'utf8');
    assert.ok(indexHtml.includes('btn-quick-screenshot'), 'Missing btn-quick-screenshot');
    assert.ok(indexHtml.includes('btn-quick-record'), 'Missing btn-quick-record');
    assert.ok(indexHtml.includes('btn-quick-fullscreen'), 'Missing btn-quick-fullscreen');
    assert.ok(indexHtml.includes('btn-control-key'), 'Missing btn-control-key');
    assert.ok(indexHtml.includes('media-library-list'), 'Missing media-library-list');
    console.log('[PASS] Frontend UI elements for Phase 4 verified');

    console.log('--- ALL PHASE 4 TESTS PASSED SUCCESSFULLY ---');
  } catch (err) {
    console.error('[FAIL] Phase 4 test failed:', err);
    process.exit(1);
  }
})();
