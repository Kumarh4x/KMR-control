// KMR Control - Phase 7 QR Pairing & Responsive Layout Automated Test Suite
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const qrService = require('../src/main/qr-pairing-service');
const adbManager = require('../src/main/adb-manager');
const diagnostics = require('../src/main/diagnostics-service');
const qrGenerator = require('../src/renderer/scripts/qrcode');
const jsQR = require('./helpers/jsqr');

function decodeSvgToText(svgString) {
  const vbMatch = svgString.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!vbMatch) throw new Error('Invalid SVG: missing viewBox');
  const totalModules = parseInt(vbMatch[1], 10);

  const rectMatches = [...svgString.matchAll(/<rect x="(\d+)" y="(\d+)" width="1" height="1"\/>/g)];
  
  const scale = 8;
  const width = totalModules * scale;
  const height = totalModules * scale;
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255); // Pure white background

  for (const match of rectMatches) {
    const c = parseInt(match[1], 10);
    const r = parseInt(match[2], 10);
    for (let py = 0; py < scale; py++) {
      for (let px = 0; px < scale; px++) {
        const y = r * scale + py;
        const x = c * scale + px;
        const idx = (y * width + x) * 4;
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      }
    }
  }

  const result = jsQR(data, width, height);
  return result ? result.data : null;
}

async function runTests() {
  console.log('--- Starting KMR Control Phase 7 (QR Pairing & Responsive UI) Tests ---');

  // TEST 1: QR Payload Protocol Format
  console.log('[TEST 1] Verifying Native Android Wireless Debugging QR Payload Protocol...');
  const session = await qrService.startSession({ timeoutSeconds: 60 });
  assert.ok(session.success, 'Session start must succeed');
  assert.ok(session.qrPayload, 'Session must generate a qrPayload');
  
  // Format regex: WIFI:T:ADB;S:<service>;P:<password>;;
  const qrRegex = /^WIFI:T:ADB;S:kmr-[a-f0-9]+;P:\d{6};;$/;
  assert.ok(
    qrRegex.test(session.qrPayload),
    `qrPayload "${session.qrPayload}" must match native Android Wireless Debugging specification: WIFI:T:ADB;S:<service>;P:<password>;;`
  );
  console.log(`[PASS] Native QR payload verified: "${session.qrPayload}"`);

  // TEST 2: Pure JavaScript QR Code Generator
  console.log('[TEST 2] Verifying Pure JavaScript SVG QR Code Generator...');
  const svg = qrGenerator.toSvg(session.qrPayload, 4);
  assert.ok(typeof svg === 'string', 'toSvg must return a string');
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), 'SVG must be properly enclosed in <svg> tags');
  assert.ok(svg.includes('viewBox="0 0 37 37"') || svg.includes('viewBox="0 0 41 41"'), 'viewBox must match standard QR Version 3 or 4 dimensions with 4-module quiet zone');
  assert.ok(svg.includes('fill="#ffffff"'), 'SVG must provide white high-contrast background');
  assert.ok(svg.includes('fill="#000000"'), 'SVG must provide crisp black modules');
  console.log(`[PASS] Pure JS QR Code Generator verified (generated valid crisp SVG, length: ${svg.length} chars)`);

  // TEST 3: Mathematical Accuracy of Galois Field & Reed-Solomon Parity
  console.log('[TEST 3] Verifying Galois Field GF(256) & Reed-Solomon Error Correction Code...');
  // Standard official test vector: 16 data codewords with 10 EC codewords
  const testData = [0x10, 0x20, 0x0C, 0x56, 0x61, 0x80, 0xEC, 0x11, 0xEC, 0x11, 0xEC, 0x11, 0xEC, 0x11, 0xEC, 0x11];
  const calculatedRem = qrGenerator.rsComputeRemainder(testData, 10);
  const expectedRem = [165, 36, 212, 193, 237, 54, 199, 135, 44, 85];
  assert.deepStrictEqual(
    Array.from(calculatedRem),
    expectedRem,
    'Reed-Solomon generator polynomial and polynomial division must exactly match official QR code spec'
  );
  console.log('[PASS] Reed-Solomon error correction mathematically validated against official ISO/IEC test vector');

  // TEST 4: Concurrency Protection (Prevent Multiple Active Sessions)
  console.log('[TEST 4] Verifying Concurrent Session Prevention...');
  const session1Id = qrService.getStatus().sessionId;
  const session2 = await qrService.startSession({ timeoutSeconds: 30 });
  const session2Id = qrService.getStatus().sessionId;
  assert.notStrictEqual(session1Id, session2Id, 'New session must supersede old session');
  console.log('[PASS] Concurrency protection verified: previous session cleanly replaced by new session');

  // TEST 5: Clean Cancellation and In-Memory Secret Scrubbing
  console.log('[TEST 5] Verifying Session Cancellation & Zero-Storage Memory Scrubbing...');
  const cancelRes = await qrService.cancelSession();
  assert.ok(cancelRes.success, 'cancelSession must return success: true');
  const cancelledStatus = qrService.getStatus();
  assert.strictEqual(cancelledStatus.status, 'idle', 'Status after cancellation must be idle');
  assert.strictEqual(qrService.activeSession, null, 'Active session object must be completely nullified');
  console.log('[PASS] Session cancellation and zero-storage secret scrubbing verified');

  // TEST 6: Session Timeout Watchdog
  console.log('[TEST 6] Verifying Session Timeout Handling...');
  // Start short 1-second timeout session
  await qrService.startSession({ timeoutSeconds: 1 });
  console.log('[INFO] Waiting 1.4s for timeout trigger...');
  await new Promise(r => setTimeout(r, 1400));
  const timeoutStatus = qrService.getStatus();
  assert.strictEqual(timeoutStatus.status, 'timeout', 'Session must transition to timeout state when time expires');
  assert.strictEqual(qrService.activeSession.password, null, 'Temporary pairing code must be purged from memory on timeout');
  console.log(`[PASS] Session timeout verified: ${timeoutStatus.message}`);
  await qrService.cancelSession();

  // TEST 7: Diagnostics Log Redaction for QR Secrets
  console.log('[TEST 7] Verifying Redaction of QR Pairing Secrets & Payload Tokens...');
  const sampleLog = 'User scanned payload: WIFI:T:ADB;S:kmr-test99;P:654321;; with raw code ;P:654321;';
  const redacted = diagnostics.redact(sampleLog);
  assert.ok(!redacted.includes('654321'), 'Pairing code 654321 must not appear in redacted output');
  assert.ok(redacted.includes('WIFI:T:ADB;S:[REDACTED];P:[REDACTED];;'), 'QR payload must be sanitized');
  assert.ok(redacted.includes(';P:[REDACTED];'), 'P: parameter must be sanitized');
  console.log(`[PASS] Redaction verified: "${sampleLog}" -> "${redacted}"`);

  // TEST 8: Responsive Layout & UI Component Integrity Audit
  console.log('[TEST 8] Auditing Responsive Layout & UI Templates...');
  const htmlPath = path.join(__dirname, '../src/renderer/index.html');
  const cssPath = path.join(__dirname, '../src/renderer/styles/main.css');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Check 4 tabs in Wireless Connection
  assert.ok(html.includes('id="wizard-tab-qr"'), 'index.html must include wizard-tab-qr');
  assert.ok(html.includes('id="wizard-tab-pair"'), 'index.html must include wizard-tab-pair');
  assert.ok(html.includes('id="wizard-tab-direct"'), 'index.html must include wizard-tab-direct');
  assert.ok(html.includes('id="wizard-tab-trusted"'), 'index.html must include wizard-tab-trusted');

  // Check 4 views in Wireless Connection
  assert.ok(html.includes('id="wizard-view-qr"'), 'index.html must include wizard-view-qr');
  assert.ok(html.includes('id="wizard-view-pair"'), 'index.html must include wizard-view-pair');
  assert.ok(html.includes('id="wizard-view-direct"'), 'index.html must include wizard-view-direct');
  assert.ok(html.includes('id="wizard-view-trusted"'), 'index.html must include wizard-view-trusted');

  // Check QR elements
  assert.ok(html.includes('id="qr-code-svg-container"'), 'index.html must include qr-code-svg-container');
  assert.ok(html.includes('id="qr-timer-badge"'), 'index.html must include qr-timer-badge');
  assert.ok(html.includes('id="btn-cancel-qr"'), 'index.html must include btn-cancel-qr');
  assert.ok(html.includes('id="btn-refresh-qr"'), 'index.html must include btn-refresh-qr');
  assert.ok(html.includes('scripts/qrcode.js'), 'index.html must import scripts/qrcode.js');

  // Check Responsive CSS
  assert.ok(css.includes('repeat(auto-fit, minmax('), 'main.css must use fluid auto-fit grids');
  assert.ok(css.includes('@media (max-width: 1024px)'), 'main.css must include 1024px responsive breakpoint');
  assert.ok(css.includes('@media (max-width: 860px)'), 'main.css must include 860px responsive breakpoint');
  assert.ok(css.includes('::-webkit-scrollbar'), 'main.css must define sleek custom scrollbars');
  assert.ok(css.includes('.qr-box-wrapper'), 'main.css must define .qr-box-wrapper');
  console.log('[PASS] Responsive CSS layout and HTML template integrity verified');

  // TEST 9: Real Device & mDNS Service Discovery Audit
  console.log('[TEST 9] Auditing Native ADB mDNS Service Discovery...');
  const mdnsServices = await adbManager.getMdnsServices();
  console.log(`[INFO] Detected ${mdnsServices.length} active mDNS service(s) on local network:`, mdnsServices);
  assert.ok(Array.isArray(mdnsServices), 'getMdnsServices must return an array');
  console.log('[PASS] ADB mDNS service discovery engine operational');

  // TEST 10: Independent End-to-End QR Image & SVG Decoding Verification
  console.log('[TEST 10] Verifying End-to-End QR SVG Decoding with Independent QR Decoder...');
  const testPayloads = [
    session.qrPayload,
    'WIFI:T:ADB;S:kmr-test1234;P:654321;;',
    'WIFI:T:ADB;S:kmr-alpha;P:112233;;',
    'WIFI:T:ADB;S:kmr-samsung-galaxy-m15;P:998877;;',
    'WIFI:T:ADB;S:kmr-dpp-node-0987654321;P:543210;;'
  ];

  for (const expectedText of testPayloads) {
    const generatedSvg = qrGenerator.toSvg(expectedText, 4);
    const decodedText = decodeSvgToText(generatedSvg);
    assert.strictEqual(
      decodedText,
      expectedText,
      `Decoded text "${decodedText}" must exactly match expected payload "${expectedText}"`
    );
  }
  console.log(`[PASS] Independent QR decoding verified across ${testPayloads.length} test vectors (all decoded with 100% fidelity)`);

  console.log('--- ALL PHASE 7 (QR PAIRING & RESPONSIVE UI) TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch(err => {
  console.error('[FAIL] Test failed with error:', err);
  process.exit(1);
});
