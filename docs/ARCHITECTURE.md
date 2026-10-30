# KMR Control — System Architecture & Technical Design

This document details the software architecture, process hierarchy, data flow, IPC contracts, and component responsibilities of **KMR Control**.

---

## 1. High-Level Architecture Overview

KMR Control is designed as a modular, sandboxed Windows desktop application leveraging Electron for the presentation layer and supervising native subprocesses (`adb.exe` and `kmr-engine.exe`) for Android device communication and video streaming.

```
+-----------------------------------------------------------------------------------+
|                                 WINDOWS HOST OS                                   |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                     ELECTRON DESKTOP APPLICATION SHELL                      |  |
|  |                                                                             |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  |  |           RENDERER PROCESS (Sandboxed Chromium UI Layer)             |  |  |
|  |  |                                                                       |  |  |
|  |  |   - Dashboard View (Live Telemetry & Battery Indicators)              |  |  |
|  |  |   - Wireless Connection Wizard (QR Code / 6-Digit PIN / Direct)       |  |  |
|  |  |   - Device Navigation & Media Controls                                |  |  |
|  |  |   - Recordings & Media Gallery                                        |  |  |
|  |  |   - Settings & Profile Management                                     |  |  |
|  |  |   - Redacted Diagnostics Stream View                                  |  |  |
|  |  |   - ISO/IEC 18004 Model 2 SVG QR Code Generator (qrcode.js)           |  |  |
|  |  +-----------------------------------|-----------------------------------+  |  |
|  |                                      |                                      |  |
|  |                      contextBridge (window.kmrApi)                          |  |
|  |                                      |                                      |  |
|  |  +-----------------------------------|-----------------------------------+  |  |
|  |  |              PRELOAD SCRIPT (src/preload/preload.js)                  |  |  |
|  |  |   - Strictly whitelist IPC channel invocations                        |  |  |
|  |  |   - Context Isolation: true | Node Integration: false                 |  |  |
|  |  +-----------------------------------|-----------------------------------+  |  |
|  |                                      | IPC (invoke / handle / send)         |  |
|  |  +-----------------------------------|-----------------------------------+  |  |
|  |  |            MAIN PROCESS (src/main/main.js & Core Services)            |  |  |
|  |  |                                                                       |  |  |
|  |  |   +-----------------------+     +----------------------------------+  |  |
|  |  |   |    ADB Manager        |     |     QR Pairing Service           |  |  |
|  |  |   |    (adb-manager.js)   |     |     (qr-pairing-service.js)      |  |  |
|  |  |   +-----------+-----------+     +-----------------+----------------+  |  |
|  |  |               |                                   |                   |  |
|  |  |   +-----------+-----------+     +-----------------+----------------+  |  |
|  |  |   |  Display Engine Supv  |     |     Diagnostics Service          |  |  |
|  |  |   | (kmr-engine-runner.js)|     |     (diagnostics-service.js)     |  |  |
|  |  |   +-----------+-----------+     +-----------------+----------------+  |  |
|  |  |               |                                   |                   |  |
|  |  |   +-----------+-----------------------------------+----------------+  |  |
|  |  |   |  Persistent Settings & Trusted Devices Store (settings-store)  |  |  |
|  |  |   +----------------------------------------------------------------+  |  |
|  |  +-----------------------|---------------------------|-------------------+  |  |
|  +--------------------------|---------------------------|----------------------+  |
|                             |                           |                         |
|           child_process.spawn(..., { shell: false })   child_process.spawn(...)   |
|                             |                           |                         |
|                             v                           v                         |
|                 +-----------------------+   +-----------------------+             |
|                 |     adb.exe Server    |   |     kmr-engine.exe    |             |
|                 |   (Android Platform   |   |   (High-Perf KMR      |             |
|                 |      Tools v37.0.1)   |   |    Display Engine)    |             |
|                 +-----------+-----------+   +-----------+-----------+             |
+-----------------------------|---------------------------|-------------------------+
                              | TCP (5555 / dynamic)      | Video stream over TCP
                              v                           v
                +-------------------------------------------------------+
                |                    ANDROID DEVICE                     |
                |               (Android 11+ via Wi-Fi)                 |
                |                                                       |
                |   - Wireless Debugging Server                         |
                |   - mDNS Service Discovery Advertisements             |
                |     * _adb-tls-pairing._tcp                           |
                |     * _adb-tls-connect._tcp                           |
                |   - scrcpy-server JAR execution                       |
                +-------------------------------------------------------+
```

---

## 2. Directory & Source Layout

```
C:\Users\<USER>\Downloads\KMR Control\
├── .editorconfig                # Universal IDE code formatting rules
├── .gitattributes               # Cross-platform line endings and binary definitions
├── .gitignore                    # Exclusion rules for build artifacts, node_modules, logs
├── .github/
│   ├── workflows/ci.yml         # GitHub Actions automated test workflow
│   ├── ISSUE_TEMPLATE/          # Structured bug report & feature request templates
│   └── PULL_REQUEST_TEMPLATE.md # Quality checklist for pull requests
├── docs/                        # Complete documentation suite
│   ├── ARCHITECTURE.md          # This system architecture document
│   ├── DEVELOPMENT.md           # Developer onboarding & test commands
│   ├── USER_GUIDE.md            # Comprehensive end-user operational manual
│   ├── WIRELESS_PAIRING_GUIDE.md# Step-by-step wireless pairing walkthrough
│   ├── SECURITY_MODEL.md        # Cybersecurity, trust, and privacy controls
│   ├── TROUBLESHOOTING.md       # Diagnostic guide and known workarounds
│   ├── RELEASE_CHECKLIST.md     # Maintainer checklist for publishing releases
│   └── screenshots/README.md    # UI screenshot capture guidelines
├── scripts/
│   ├── package.js               # Standalone Windows packaging script
│   └── run-all-tests.js         # Automated test suite orchestrator
├── src/
│   ├── main/                    # Electron Main Process (Node.js runtime)
│   │   ├── main.js              # Application entry, window creation, IPC routing
│   │   ├── adb-manager.js       # ADB command spawning, output parsing, telemetry
│   │   ├── kmr-engine-runner.js # Engine lifecycle supervision & argument vectors
│   │   ├── scrcpy-runner.js     # Backward-compatible proxy to kmr-engine-runner
│   │   ├── qr-pairing-service.js# QR pairing state machine & mDNS watcher
│   │   ├── diagnostics-service.js# In-memory log stream & regex redaction engine
│   │   └── settings-store.js    # Persistent JSON storage for settings & devices
│   ├── preload/
│   │   └── preload.js           # Sandboxed context bridge (`window.kmrApi`)
│   └── renderer/                # Electron Renderer Process (Chromium UI)
│       ├── index.html           # Single-page application markup & navigation views
│       ├── styles/main.css      # Fluid responsive CSS grids & Windows 11 themes
│       └── scripts/
│           ├── renderer.js      # DOM events, view switching, status polling
│           ├── theme.js         # Theme switching (Light, Dark, Auto-System)
│           └── qrcode.js        # Pure JS ISO/IEC 18004 Model 2 QR generator
├── test/                        # Automated regression and unit test suites
│   ├── smoke-test.js            # Phase 1: Binary integrity & settings store
│   ├── phase2-dashboard-test.js # Phase 2: Telemetry parsing & process spawning
│   ├── phase3-wireless-wizard-test.js # Phase 3: Pairing validation & zero storage
│   ├── phase4-engine-test.js    # Phase 4: Engine CLI args & process management
│   ├── phase4-scrcpy-test.js    # Phase 4: Compatibility test runner wrapper
│   ├── phase5-diagnostics-test.js # Phase 5: Redaction engine & port update
│   ├── phase6-e2e-test.js       # Phase 6: E2E security audit & view integrity
│   ├── phase7-qr-pairing-test.js# Phase 7: QR protocol & independent decoding
│   └── helpers/                 # Test-only decoding helpers (jsQR, reference engines)
├── package.json                 # Project manifest, scripts, and dependencies
├── package-lock.json            # Deterministic dependency tree
└── LICENSE.txt                  # Apache License 2.0 terms
```

---

## 3. Core Component Responsibilities

### 3.1 Main Process (`src/main/main.js`)
- Initializes the Electron `BrowserWindow` with custom frameless window styling (`frame: false`), security sandboxing (`contextIsolation: true`, `nodeIntegration: false`), and default dimensions `1100x720` (minimum `860x580`).
- Dispatches and coordinates IPC requests received from the renderer via `ipcMain.handle`.
- Gracefully shuts down active display engine sessions (`kmr-engine.exe`) and cancels pending pairing listeners when the window closes.
- Manages command-line test flags (`--test-mode`) to facilitate headless automated CI verification.

### 3.2 ADB Manager (`src/main/adb-manager.js`)
- Resolves the bundled `adb.exe` executable across development paths (`./adb.exe`), packaged app roots (`path.dirname(process.execPath)`), and system paths.
- Executes native ADB commands using `child_process.spawn()` with strict array arguments:
  - `adb devices -l`: Parses attached devices, distinguishes wireless (`IP:port`) from USB transports, and identifies hardware models.
  - `adb pair <ip>:<port> <code>`: Executes single-use 6-digit wireless pairing.
  - `adb connect <ip>:<port>`: Establishes the wireless TCP connection.
  - `adb disconnect <ip>:<port>`: Cleans up the wireless socket.
  - `adb mdns services`: Enumerates active mDNS records (`_adb-tls-pairing._tcp` and `_adb-tls-connect._tcp`).
  - Shell queries: Queries `dumpsys battery` (parses real battery percentage and charging state), `wm size` (parses physical display resolution), and `wm density` (parses screen DPI).
- Implements device navigation triggers (`adb shell input keyevent ...` for Back, Home, Recents, Power, Volume, Mute, and Notifications).

### 3.3 QR Pairing Service (`src/main/qr-pairing-service.js`)
- Manages the lifecycle of QR-based wireless pairing sessions.
- Generates compliant Android DPP pairing payloads:
  ```text
  WIFI:T:ADB;S:kmr-<random_hex>;P:<random_6_digit_pin>;;
  ```
- Starts a 90-second countdown timer and polls ADB mDNS discovery every 1,200 ms.
- When `_adb-tls-pairing._tcp` is detected:
  1. Invokes `adb pair <phone_ip>:<pairing_port> <password>`.
  2. Waits for the phone to transition to `_adb-tls-connect._tcp`.
  3. Invokes `adb connect <phone_ip>:<connect_port>`.
  4. Automatically records the device in the trusted devices list.
  5. Scrubs the temporary pairing password from memory and transitions session state to `connected`.

### 3.4 Display Engine Supervisor (`src/main/kmr-engine-runner.js`)
- Supervises the high-performance screen mirroring binary (`kmr-engine.exe`, packaged from the scrcpy v5.0.1 core display engine). Preserves a backward-compatible proxy at `src/main/scrcpy-runner.js`.
- Converts persistent user settings into sanitized CLI argument vectors without shell concatenation:
  - `--max-size=<resolution>`
  - `--video-bit-rate=<bitrate>`
  - `--max-fps=<fps>`
  - `--fullscreen` / `--always-on-top`
- Monitors engine process exit codes, stdout, and stderr.
- Handles media capture flags:
  - Instant screenshots via `kmr-engine.exe --no-playback --record=<timestamp>.png`.
  - Screen recording sessions via `kmr-engine.exe --record=<timestamp>.mp4`.

### 3.5 Diagnostics Service (`src/main/diagnostics-service.js`)
- Implements an in-memory ring buffer (capped at 200 entries) capturing timestamped events from ADB, the engine, and the QR pairing service.
- Filters every message through a multi-pass regex redaction pipeline before insertion:
  - Replaces 6-digit pairing PINs with `[REDACTED CODE]`.
  - Sanitizes QR payloads (`WIFI:T:ADB;S:...;P:...;;`) with `[REDACTED]`.
  - Masks host Windows user directories (`C:\Users\<username>\...` -> `C:\Users\<USER>\...`).
  - Redacts authentication tokens and device GUIDs.

### 3.6 Preload Context Bridge (`src/preload/preload.js`)
- Exposes `window.kmrApi` to the renderer via `contextBridge.exposeInMainWorld`.
- Strictly controls the exposed API surface:
  - Device queries: `getDevices()`, `getDeviceDetails(serial)`.
  - Connection actions: `pairDevice(...)`, `connectDevice(...)`, `disconnectDevice(...)`.
  - QR session triggers: `startQrPairing(...)`, `cancelQrPairing()`, `onQrPairingStatus(callback)`.
  - Mirroring actions: `startMirroring(serial, opts)`, `stopMirroring()`, `getMirroringStatus()`.
  - Device input actions: `sendKeyEvent(key)`, `sendVolumeEvent(action)`.
  - Media actions: `takeScreenshot(serial)`, `startRecording(serial, opts)`, `stopRecording()`, `getMediaList()`, `openMediaFile(filePath)`, `revealMediaFile(filePath)`.
  - Settings: `getSettings()`, `saveSettings(settings)`, `addTrustedDevice(...)`, `removeTrustedDevice(...)`.
  - Diagnostics: `getDiagnostics(filter)`, `copyDiagnostics()`, `onDiagnosticEntry(callback)`.
  - Window management: `minimizeWindow()`, `maximizeWindow()`, `closeWindow()`.

### 3.7 Renderer UI & QR Generator (`src/renderer/`)
- Pure HTML5/CSS3/JavaScript single-page application without heavy third-party front-end frameworks.
- [`src/renderer/scripts/qrcode.js`](../src/renderer/scripts/qrcode.js): Standalone pure-JavaScript ISO/IEC 18004 Model 2 QR Code generator implementing all 8 mask penalty calculations, Error Correction Level Medium (`'M'`), 4-module quiet zone, and high-contrast SVG vector rendering.
- Seamless Light, Dark, and System theme synchronization with instant CSS custom property transitions.
- Responsive layout adapting gracefully from high-resolution multi-monitor displays down to `860px` compact laptop screens.

---

## 4. Packaging & Distribution Pipeline (`scripts/package.js`)

The standalone packaging script compiles the source and binaries into a portable Windows x64 distribution:
1. Copies the standalone Electron Windows runtime (`node_modules/electron/dist`) to the target distribution folder.
2. Renames `electron.exe` to `KMR Control.exe`.
3. Packages application source files (`package.json` with devDependencies stripped, `src/`) into `resources/app/`.
4. Bundles the native engine components:
   - `scrcpy.exe` -> renamed to `kmr-engine.exe`.
   - `adb.exe` (platform-tools).
   - `scrcpy-server` (Android server JAR).
   - Codec & system libraries: `SDL3.dll`, `avcodec-63.dll`, `avformat-63.dll`, `avutil-61.dll`, `swresample-7.dll`, `libusb-1.0.dll`, `AdbWinApi.dll`, `AdbWinUsbApi.dll`.
   - License and third-party notices: `LICENSE.txt`, `THIRD_PARTY_NOTICES.txt`, and `README.txt`.
5. The resulting folder is fully portable and requires no installation, administrator rights, Node.js, or external dependencies to run.
