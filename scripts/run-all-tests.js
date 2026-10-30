// KMR Control - Full Test Suite Runner
const { spawnSync } = require('child_process');
const path = require('path');

const testSuites = [
  'test/smoke-test.js',
  'test/phase2-dashboard-test.js',
  'test/phase3-wireless-wizard-test.js',
  'test/phase4-engine-test.js',
  'test/phase5-diagnostics-test.js',
  'test/phase6-e2e-test.js',
  'test/phase7-qr-pairing-test.js'
];

console.log('=== KMR Control Comprehensive Automated Test Suite Runner ===\n');

let allPassed = true;

for (const suite of testSuites) {
  const fullPath = path.resolve(__dirname, '..', suite);
  console.log(`>>> Running: ${suite}`);
  const result = spawnSync(process.execPath, [fullPath], {
    stdio: 'inherit',
    env: process.env
  });

  if (result.status !== 0) {
    console.error(`\n[FAIL] Test suite failed: ${suite} (exit code ${result.status})\n`);
    allPassed = false;
    process.exit(result.status || 1);
  }
  console.log(`[PASS] ${suite} completed successfully.\n`);
}

console.log('=== ALL AUTOMATED TEST SUITES PASSED SUCCESSFULLY ===');
