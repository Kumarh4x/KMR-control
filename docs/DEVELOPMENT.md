# KMR Control — Developer Guide & Setup Reference

This guide provides instructions for setting up a local development environment, running test suites, debugging, and packaging the standalone Windows application.

---

## 1. Prerequisites

Before getting started, ensure you have the following installed on your Windows development machine:

- **Operating System:** Windows 10 (64-bit) or Windows 11 (64-bit).
- **Node.js:** Node.js v20.x, v22.x, or v26.x.
- **npm:** npm v10.x or newer (bundled with Node.js).
- **Git:** Git for Windows (v2.30+).

### Verify Prerequisites
Open PowerShell and verify your installed versions:
```powershell
node --version
npm --version
git --version
```

---

## 2. Getting the Code & Installing Dependencies

1. Clone or download the repository:
   ```powershell
   git clone <repository-url>
   cd <repository-folder>
   ```
2. Install the required development dependencies:
   ```powershell
   npm install
   ```
   *Note: KMR Control maintains a minimal dependency tree. The only required dependency is `electron`.*

---

## 3. Running the Application in Development

To start the application in development mode with live window reloading and Node.js process supervision:
```powershell
npm start
```

### Running in Headless / Automated Test Mode
To verify that the Electron main process, preload bridge, and renderer window initialize cleanly without spawning an interactive UI window:
```powershell
npm start -- --test-mode
```
*Expected output:* `[MAIN] Electron window created and ready in test mode. Exiting with code 0.`

---

## 4. Running the Automated Test Suites

KMR Control includes a comprehensive automated test suite organized across 7 distinct verification phases:

### Run All Test Suites Sequentially (Recommended)
```powershell
npm run test:all
```

### Run Individual Test Suites
```powershell
# Phase 1: Smoke test (binary file checks, SettingsStore, license)
npm test
# or:
node test/smoke-test.js

# Phase 2: Dashboard telemetry & real ADB command execution
node test/phase2-dashboard-test.js

# Phase 3: Wireless wizard (IP/port/PIN validation & zero storage)
node test/phase3-wireless-wizard-test.js

# Phase 4: Display engine integration & argument vector generation
node test/phase4-scrcpy-test.js

# Phase 5: Diagnostics service, port update resilience & log redaction
node test/phase5-diagnostics-test.js

# Phase 6: End-to-end security audit, theme switching & view integrity
node test/phase6-e2e-test.js

# Phase 7: Native QR pairing protocol, mDNS audit & SVG decoding verification
node test/phase7-qr-pairing-test.js
```

---

## 5. Packaging the Standalone Windows Application

To build the standalone, portable Windows x64 distribution:
```powershell
npm run package
```

### Packaging Configuration & Output Paths
- **Default Output Folder:** `C:\Users\<USER>\Downloads\KMR Control\` (or `dist/KMR Control` if no user profile is detected).
- **Custom Output Folder:** You can specify a custom output directory using the `KMR_OUTPUT_DIR` environment variable:
  ```powershell
  $env:KMR_OUTPUT_DIR = "C:\Path\To\Custom\Build"
  npm run package
  ```

### Verifying the Packaged Application
Launch the newly built executable in test mode:
```powershell
& "C:\Users\<USER>\Downloads\KMR Control\KMR Control.exe" --test-mode
```

---

## 6. Project Scripts Summary

All commands are defined in [`package.json`](../package.json):

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm start` | `electron .` | Launches the interactive desktop application. |
| `npm test` | `node test/smoke-test.js` | Runs the Phase 1 smoke test suite. |
| `npm run test:all` | `node scripts/run-all-tests.js` | Runs all 7 test suites sequentially. |
| `npm run package` | `node scripts/package.js` | Packages the portable standalone application. |

---

## 7. Development Tips & Debugging

### Electron DevTools
To open Chromium DevTools inside the application window during development:
1. In `src/main/main.js`, add `mainWindow.webContents.openDevTools();` inside `createWindow()`.
2. Or press `Ctrl + Shift + I` inside the application window.

### Inspecting Local Settings
KMR Control stores user preferences and saved device endpoints at:
```powershell
Get-Content "$env:APPDATA\KMR-Control\settings.json" | ConvertFrom-Json
```
*(No passwords or pairing PINs are ever stored here).*

### Checking ADB Daemon Status
Check the status of running ADB background daemons and connected devices:
```powershell
.\adb.exe devices -l
.\adb.exe mdns services
```
To restart the local ADB server:
```powershell
.\adb.exe kill-server
.\adb.exe start-server
```
