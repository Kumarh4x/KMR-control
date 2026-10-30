const fs = require('fs');
const path = require('path');

console.log('--- Packaging KMR Control (Standalone Windows x64 Application) ---');

const rootDir = path.resolve(__dirname, '..');
const electronDist = path.join(rootDir, 'node_modules', 'electron', 'dist');
// Output directory: defaults to dist/KMR-Control to prevent overwriting the working root executable.
// Set KMR_OUTPUT_DIR explicitly to target an alternate destination.
const defaultOutputDir = path.join(rootDir, 'dist', 'KMR-Control');
const outputDir = process.env.KMR_OUTPUT_DIR || defaultOutputDir;

if (!fs.existsSync(electronDist)) {
  console.error('[ERROR] Electron distribution not found at:', electronDist);
  process.exit(1);
}

// 1. Prepare clean output directory
console.log(`[1/6] Preparing clean release directory at: ${outputDir}`);
try {
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 });
  }
  fs.mkdirSync(outputDir, { recursive: true });
} catch (err) {
  if (err.code === 'EPERM' || err.code === 'EBUSY') {
    console.error(`\n[ERROR] Unable to clean release directory at: ${outputDir}`);
    console.error(`[ERROR] An active instance of KMR Control or kmr-engine is currently running.`);
    console.error(`[ERROR] Please close the running application and re-run "npm run package".\n`);
    process.exit(1);
  }
  throw err;
}

// 2. Copy Standalone Electron Runtime
console.log('[2/6] Copying standalone Windows desktop runtime...');
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

copyRecursive(electronDist, outputDir);

// 3. Rename executable to "KMR Control.exe"
console.log('[3/6] Setting executable name to "KMR Control.exe"...');
const oldExe = path.join(outputDir, 'electron.exe');
const newExe = path.join(outputDir, 'KMR Control.exe');
if (fs.existsSync(oldExe)) {
  fs.renameSync(oldExe, newExe);
  console.log('[PASS] Created executable: KMR Control.exe');
} else {
  console.error('[ERROR] electron.exe not found in runtime copy');
  process.exit(1);
}

// 4. Bundle Application Code into resources/app
console.log('[4/6] Bundling application frontend & backend into resources/app...');
const appDir = path.join(outputDir, 'resources', 'app');
fs.mkdirSync(appDir, { recursive: true });

// Copy package.json with devDependencies removed
const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
delete pkgJson.devDependencies;
pkgJson.name = 'kmr-control';
pkgJson.description = 'KMR Control - Native Windows Desktop Application for Wireless Android Control';
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');

// Copy src directory
copyRecursive(path.join(rootDir, 'src'), path.join(appDir, 'src'));

// 5. Bundle Engine Components (Renaming executable to kmr-engine.exe)
console.log('[5/6] Bundling KMR Control Engine & ADB runtime libraries...');
const engineFiles = [
  { src: 'scrcpy.exe', dest: 'kmr-engine.exe' }, // Renamed safely to kmr-engine.exe
  { src: 'adb.exe', dest: 'adb.exe' },
  { src: 'scrcpy-server', dest: 'scrcpy-server' },
  { src: 'SDL3.dll', dest: 'SDL3.dll' },
  { src: 'avcodec-63.dll', dest: 'avcodec-63.dll' },
  { src: 'avformat-63.dll', dest: 'avformat-63.dll' },
  { src: 'avutil-61.dll', dest: 'avutil-61.dll' },
  { src: 'swresample-7.dll', dest: 'swresample-7.dll' },
  { src: 'libusb-1.0.dll', dest: 'libusb-1.0.dll' },
  { src: 'AdbWinApi.dll', dest: 'AdbWinApi.dll' },
  { src: 'AdbWinUsbApi.dll', dest: 'AdbWinUsbApi.dll' },
  { src: 'LICENSE.txt', dest: 'LICENSE.txt' }
];

for (const f of engineFiles) {
  const srcFile = path.join(rootDir, f.src);
  const destFile = path.join(outputDir, f.dest);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`[PASS] Bundled: ${f.src} -> ${f.dest}`);
  } else {
    console.error(`[ERROR] Missing core engine file: ${f.src}`);
    process.exit(1);
  }
}

// 6. Generate Documentation, Third-Party Notices & Launch Instructions
console.log('[6/6] Generating README and Third-Party Notices...');
const readmeContent = `================================================================
                       KMR CONTROL (v1.0.0)
         Native Windows Desktop Application — Wireless Android Control
================================================================

HOW TO RUN:
Double-click "KMR Control.exe" in this folder.
No installation of Node.js, npm, or external runtimes is required.

FEATURES:
- Zero-USB Wireless Pairing for Android 11+
- Live Genuine Device Telemetry (Model, Android OS, Battery, Resolution)
- High-Performance Display Mirroring & Audio
- Fast Silent Screenshots (saved to Pictures\\KMR-Control)
- High-Quality Screen Video Recording (saved to Videos\\KMR-Control)
- Remote Navigation & Media Controls
- Dark, Light, and Windows Auto Theme Modes
- Searchable Diagnostics with Sensitive Data Redaction

HOW TO CONNECT WIRELESSLY (ANDROID 11+):

OPTION 1: PAIR WITH QR CODE (RECOMMENDED)
1. In KMR Control, go to "Wireless Connection" > "Pair with QR Code".
2. On your Android phone:
   - Settings > Developer options > Wireless debugging (Toggle ON).
   - Tap "Pair device with QR code".
3. Scan the QR code displayed on your PC screen.
4. KMR Control automatically authenticates and opens the Device Dashboard!

OPTION 2: PAIR WITH 6-DIGIT CODE
1. On your phone: Settings > Developer options > Wireless debugging > "Pair device with pairing code".
2. In KMR Control: Open "Wireless Connection" > "Pair with Pairing Code".
3. Enter the Phone IP, 6-digit Pairing Code, Pairing Port (from popup),
   and ADB Connection Port (from the main Wireless Debugging page).
4. Click "Pair & Connect Device".

OPTION 3: DIRECT CONNECT
If already paired previously, enter your Phone IP & Connection Port
in the "Direct Connect" tab to instantly connect!

CONFIGURATION & LOGS:
Settings and diagnostic logs are saved to:
%APPDATA%\\KMR-Control\\

================================================================
THIRD-PARTY NOTICES:
This application bundles and relies upon the following open-source projects:
- scrcpy & ADB (Android Debug Bridge): Apache License 2.0 (Genymobile)
  See LICENSE.txt in this folder for full license terms.
- Electron & Chromium: MIT License / BSD License (See LICENSES.chromium.html)
- SDL & FFmpeg: zlib / LGPL (Included unmodified)
================================================================
`;

fs.writeFileSync(path.join(outputDir, 'README.txt'), readmeContent, 'utf8');

const noticesContent = `KMR Control
Copyright (c) 2026 KMR Control Project

This application bundles the following third-party open-source components:

================================================================
1. scrcpy & Android Debug Bridge (ADB)
================================================================
License: Apache License, Version 2.0
Source & Attribution: Genymobile (https://github.com/Genymobile/scrcpy)
The binary 'kmr-engine.exe' is the official prebuilt scrcpy v5.0.1 binary,
renamed for application process namespace management without internal modification.
Full terms: See LICENSE.txt in this directory.

================================================================
2. Electron & Chromium
================================================================
License: MIT License / BSD License
Copyright (c) Electron contributors / The Chromium Authors
See LICENSE and LICENSES.chromium.html in this directory.

================================================================
3. FFmpeg & SDL
================================================================
avcodec-63.dll, avformat-63.dll, avutil-61.dll, swresample-7.dll, SDL3.dll
Included unmodified under their respective LGPL v2.1+ / zlib / Apache licenses.
`;

fs.writeFileSync(path.join(outputDir, 'THIRD_PARTY_NOTICES.txt'), noticesContent, 'utf8');

console.log('--- PACKAGING COMPLETED SUCCESSFULLY ---');
console.log(`Final release folder: ${outputDir}`);
console.log(`Executable: ${newExe}`);
