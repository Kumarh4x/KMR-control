const assert = require('assert');
const path = require('path');
const fs = require('fs');
const adbManager = require('../src/main/adb-manager');
const settingsStore = require('../src/main/settings-store');

console.log('--- Starting KMR Control Phase 3 (Wireless Wizard) Tests ---');

// 1. Test IP Validation
console.log('[TEST] Running IP Address Validation Tests...');
assert.strictEqual(adbManager.validateIp('192.168.1.150').valid, true);
assert.strictEqual(adbManager.validateIp('10.0.0.1').valid, true);
assert.strictEqual(adbManager.validateIp('172.16.0.254').valid, true);
assert.strictEqual(adbManager.validateIp('999.168.1.1').valid, false);
assert.strictEqual(adbManager.validateIp('192.168.1').valid, false);
assert.strictEqual(adbManager.validateIp('192.168.1.1.1').valid, false);
assert.strictEqual(adbManager.validateIp('0.0.0.0').valid, false);
assert.strictEqual(adbManager.validateIp('255.255.255.255').valid, false);
assert.strictEqual(adbManager.validateIp('not-an-ip').valid, false);
console.log('[PASS] IP validation verified: All valid IPs accepted, invalid and broadcast IPs rejected');

// 2. Test Port Validation
console.log('[TEST] Running Port Validation Tests...');
assert.strictEqual(adbManager.validatePort('1024').valid, true);
assert.strictEqual(adbManager.validatePort('5555').valid, true);
assert.strictEqual(adbManager.validatePort('41253').valid, true);
assert.strictEqual(adbManager.validatePort('65535').valid, true);
assert.strictEqual(adbManager.validatePort('1023').valid, false, 'Port 1023 should be rejected (< 1024)');
assert.strictEqual(adbManager.validatePort('80').valid, false, 'Port 80 should be rejected (< 1024)');
assert.strictEqual(adbManager.validatePort('0').valid, false);
assert.strictEqual(adbManager.validatePort('65536').valid, false, 'Port 65536 should be rejected (> 65535)');
assert.strictEqual(adbManager.validatePort('-50').valid, false);
assert.strictEqual(adbManager.validatePort('port').valid, false);
console.log('[PASS] Port validation verified: 1024-65535 enforced strictly');

// 3. Test Pairing Code Validation
console.log('[TEST] Running Pairing Code Validation Tests...');
assert.strictEqual(adbManager.validatePairingCode('123456').valid, true);
assert.strictEqual(adbManager.validatePairingCode('000000').valid, true);
assert.strictEqual(adbManager.validatePairingCode('987654').valid, true);
assert.strictEqual(adbManager.validatePairingCode('12345').valid, false, '5 digits should fail');
assert.strictEqual(adbManager.validatePairingCode('1234567').valid, false, '7 digits should fail');
assert.strictEqual(adbManager.validatePairingCode('abcdef').valid, false, 'Non-digits should fail');
assert.strictEqual(adbManager.validatePairingCode('12 345').valid, false, 'Spaces should fail');
assert.strictEqual(adbManager.validatePairingCode('').valid, false, 'Empty should fail');
console.log('[PASS] Pairing code validation verified: Exactly 6 numeric digits enforced');

(async () => {
  try {
    // 4. Test Pairing Error Case (Unreachable Endpoint)
    console.log('[TEST] Testing Pair Failure Handling with unreachable endpoint...');
    const pairResult = await adbManager.pairDevice('127.0.0.2', '59998', '111222');
    assert.strictEqual(pairResult.success, false, 'Expected pairDevice to fail on dummy endpoint');
    assert.ok(pairResult.error, 'Expected error message to be provided');
    console.log(`[PASS] Pair failure safely caught with actionable message: "${pairResult.error}"`);

    // 5. Test Connection Error Case (Unreachable Endpoint)
    console.log('[TEST] Testing Connection Failure Handling with unreachable endpoint...');
    const connResult = await adbManager.connectDevice('127.0.0.2', '59999');
    assert.strictEqual(connResult.success, false, 'Expected connectDevice to fail on dummy endpoint');
    assert.ok(connResult.error, 'Expected error message to be provided');
    console.log(`[PASS] Connect failure safely caught with actionable message: "${connResult.error}"`);

    // 6. Test Disconnect
    console.log('[TEST] Testing Disconnect execution...');
    const discResult = await adbManager.disconnectDevice('127.0.0.2:59999');
    assert.ok(discResult.message, 'Expected disconnect response');
    console.log(`[PASS] Disconnect executed safely: "${discResult.message}"`);

    // 7. Test Security Constraint: Pairing PIN Never Persisted in Trusted Devices
    console.log('[TEST] Verifying Zero-Storage of Temporary Pairing Codes...');
    const trustedPayload = {
      ip: '192.168.1.200',
      port: 39512,
      alias: 'Pixel Test Wireless',
      pairingCode: '654321', // Malicious or accidental attempt to supply pairing code
      pin: '654321'
    };
    const saved = settingsStore.addTrustedDevice(trustedPayload);
    assert.strictEqual(saved.pairingCode, undefined, 'SECURITY ERROR: pairingCode stored!');
    assert.strictEqual(saved.pin, undefined, 'SECURITY ERROR: pin stored!');

    const retrievedList = settingsStore.get('trustedDevices');
    const item = retrievedList.find(d => d.id === '192.168.1.200:39512');
    assert.ok(item, 'Failed to find saved trusted device');
    assert.strictEqual(item.pairingCode, undefined);
    assert.strictEqual(item.pin, undefined);
    assert.strictEqual(item.alias, 'Pixel Test Wireless');
    assert.strictEqual(item.port, 39512);

    // Clean up
    settingsStore.removeTrustedDevice('192.168.1.200:39512');
    const afterDelete = settingsStore.get('trustedDevices');
    assert.ok(!afterDelete.find(d => d.id === '192.168.1.200:39512'), 'Failed to remove trusted device');
    console.log('[PASS] Zero-knowledge credential security verified: Temporary codes are strictly excluded');

    // 8. Verify UI Elements
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../src/renderer/index.html'), 'utf8');
    assert.ok(indexHtml.includes('pair-ip'), 'index.html missing pair-ip');
    assert.ok(indexHtml.includes('pair-code'), 'index.html missing pair-code');
    assert.ok(indexHtml.includes('pair-port'), 'index.html missing pair-port');
    assert.ok(indexHtml.includes('connect-port'), 'index.html missing connect-port');
    assert.ok(indexHtml.includes('trusted-devices-list'), 'index.html missing trusted-devices-list');
    console.log('[PASS] Wireless Wizard UI components present and validated');

    console.log('--- ALL PHASE 3 TESTS PASSED SUCCESSFULLY ---');
  } catch (err) {
    console.error('[FAIL] Phase 3 test failed:', err);
    process.exit(1);
  }
})();
