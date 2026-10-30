const assert = require('assert');
const path = require('path');
const fs = require('fs');
const kmrEngineRunner = require('../src/main/kmr-engine-runner');

console.log('--- Starting KMR Control Phase 4 (Engine Integration) Tests ---');

// 1. Verify Engine Executable Resolution
const enginePath = kmrEngineRunner.resolveEnginePath();
assert.ok(fs.existsSync(enginePath), `KMR engine binary does not exist at ${enginePath}`);
assert.ok(
  enginePath.toLowerCase().endsWith('kmr-engine.exe') || enginePath.toLowerCase().endsWith('scrcpy.exe'),
  'Resolved path does not end with kmr-engine.exe or scrcpy.exe'
);
console.log(`[PASS] KMR engine path resolved: ${enginePath}`);

// 2. Test Settings Validation
console.log('[TEST] Testing Mirroring Settings Validation...');

// Test missing serial
const missingSerialVal = kmrEngineRunner.validateSettings({});
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
const validVal = kmrEngineRunner.validateSettings(validSettings);
assert.strictEqual(validVal.isValid, true, 'Valid settings failed validation');
assert.strictEqual(validVal.sanitized.maxResolution, 1920);
assert.strictEqual(validVal.sanitized.bitRate, '8M');
assert.strictEqual(validVal.sanitized.maxFps, 60);
assert.strictEqual(validVal.sanitized.fullscreen, true);
assert.strictEqual(validVal.sanitized.alwaysOnTop, true);
console.log('[PASS] Valid mirroring settings correctly parsed and sanitized');

// Test invalid resolution
const badResVal = kmrEngineRunner.validateSettings({ serial: '192.168.1.10:5555', maxResolution: '100' });
assert.strictEqual(badResVal.isValid, false);
assert.ok(badResVal.errors.some(e => e.includes('resolution')));

// Test invalid bitrate
const badBrVal = kmrEngineRunner.validateSettings({ serial: '192.168.1.10:5555', bitRate: 'fast' });
assert.strictEqual(badBrVal.isValid, false);
assert.ok(badBrVal.errors.some(e => e.includes('Bitrate')));

// Test invalid FPS
const badFpsVal = kmrEngineRunner.validateSettings({ serial: '192.168.1.10:5555', maxFps: '5' });
assert.strictEqual(badFpsVal.isValid, false);
assert.ok(badFpsVal.errors.some(e => e.includes('FPS')));

// Test recording extension validation
const badExtVal = kmrEngineRunner.validateSettings({ serial: '192.168.1.10:5555', recordPath: 'C:\\rec.exe' });
assert.strictEqual(badExtVal.isValid, false);
assert.ok(badExtVal.errors.some(e => e.includes('.mp4 or .mkv')));

const goodExtVal = kmrEngineRunner.validateSettings({ serial: '192.168.1.10:5555', recordPath: 'C:\\rec.mp4' });
assert.strictEqual(goodExtVal.isValid, true);
console.log('[PASS] Invalid and valid bounds enforced for resolution, bitrate, FPS, and recording path');

// 3. Test Argument Vector Construction
console.log('[TEST] Testing CLI Argument Vector Generation (No shell string concatenation)...');
const args = kmrEngineRunner.buildArgs(validVal.sanitized);
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
    // 4. Test Engine Startup Failure Handling (Non-existent device)
    console.log('[TEST] Testing KMR display engine startup on unreachable device serial...');
    const failRes = await kmrEngineRunner.startMirroring({
      serial: '127.0.0.2:59999',
      maxResolution: '1024'
    });
    assert.strictEqual(failRes.success, false, 'Expected start failure on invalid device');
    assert.ok(failRes.error, 'Expected start failure error message');
    console.log(`[PASS] Display engine startup failure safely caught: "${failRes.error.trim().substring(0, 80)}..."`);

    // 5. Verify Process Cleanup & Status
    const status = kmrEngineRunner.getStatus();
    assert.strictEqual(status.isMirroring, false, 'isMirroring should be false after exit');
    assert.strictEqual(status.activeSerial, null);
    console.log('[PASS] Process cleanup verified, status reset properly');

    // 6. Test stopMirroring when idle
    const stopIdle = kmrEngineRunner.stopMirroring();
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
