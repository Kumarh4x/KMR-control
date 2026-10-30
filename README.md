# KMR Control

**Native Windows Desktop Application for Wireless Android Device Management, Screen Mirroring, and Remote Control**

---

## Overview

**KMR Control** is an open-source Windows desktop application designed to control, mirror, and manage Android devices completely wirelessly. Built with an Electron desktop interface supervising bundled native engines—including **Android Debug Bridge (ADB v37.0.1)** and the **scrcpy v5.0.1** display engine—KMR Control enables a **zero-USB** workflow from initial pairing to daily operation.

Traditional Android mirroring tools frequently require connecting a USB cable for initial ADB authorization before switching to TCP/IP. KMR Control eliminates this requirement by implementing native **Android 11+ Wireless Debugging**, supporting both **QR code pairing** and **6-digit PIN pairing** directly over local Wi-Fi.

---

## Feature Overview

| Capability | Technical Details | Verification Status |
| :--- | :--- | :--- |
| **QR Code Wireless Pairing** | Generates compliant Android DPP Wi-Fi pairing payloads (`WIFI:T:ADB;S:...;P:...;;`) with an on-screen ISO/IEC 18004 Model 2 SVG QR code and automated mDNS watcher. | **Implemented & Spec-Verified** *(Automated decoding tests passed; physical camera capture requires real-device test)* |
| **6-Digit PIN Pairing** | Native Android 11+ pairing wizard with strict separation of pairing port and connection port. | **Implemented & Verified** *(Automated tests passed & live hardware verified)* |
| **Direct Connect & Trusted Devices** | Connect to previously authorized devices by IP/port with one-click reconnection and dynamic port updating. | **Implemented & Verified** *(Automated tests passed & live hardware verified)* |
| **Live Hardware Telemetry** | Displays real-time device model, Android OS version, IP address, battery percentage, charging state, display resolution, and DPI. | **Implemented & Verified** *(Parsed from genuine `dumpsys` and `wm` outputs)* |
| **High-Performance Mirroring** | Low-latency screen mirroring with customizable resolution limits, video bitrates (4M–16M), target frame rates (30–60 FPS), fullscreen, and always-on-top. | **Implemented & Verified** *(Safe `child_process.spawn` argument vectors with `shell: false`)* |
| **Remote Device Controls** | Virtual navigation buttons for Back, Home, Recent Apps, Power toggle, Screen sleep, and Notification shade, plus volume and mute controls. | **Implemented & Verified** *(Triggered via native ADB keyevents)* |
| **Silent Media Capture & Gallery** | Instant high-resolution screenshots (PNG) and screen video recording (MP4) with an in-app media gallery and Windows File Explorer shortcuts. | **Implemented & Verified** *(Stored in user's Pictures and Videos directories)* |
| **Fluent UI & Theme Synchronization**| Clean Windows 11 interface with fluid responsive layouts (down to 860px) and seamless Light, Dark, and Auto-System theme switching. | **Implemented & Verified** *(CSS custom properties & responsive grid layout)* |
| **Redacted Diagnostics Stream** | Live in-memory log stream with an automated regex engine that sanitizes 6-digit PINs, QR tokens, user paths, and device GUIDs. | **Implemented & Verified** *(Automated redaction test suite passed)* |

---

## Feature Status Summary

- **Fully Implemented & Automated Tests Passed:**
  - 6-digit PIN wireless pairing wizard.
  - Direct connect and trusted devices management with dynamic port updating.
  - Live hardware telemetry (battery percentage, charging state, screen resolution, density).
  - Mirroring profile customization (resolution, bitrate, FPS, window pinning).
  - Virtual navigation controls and volume controls.
  - Media library for screenshots and MP4 video recordings.
  - Diagnostics logging and automated credential redaction.
  - Windows 11 Light, Dark, and System theme synchronization.
  - Standalone portable Windows x64 packaging.
- **Implemented & Verified via Automated Image Decoding:**
  - Native QR code pairing payload generator and mDNS background watcher.
  - QR SVG vector and raster decoding verified with independent standard decoders across multiple test vectors.
- **Requires Real-Device Hardware Verification:**
  - Physical camera optical scanning of the on-screen QR code from target Android smartphone hardware.

---

## Visual Presentation & Screenshots

A dedicated screenshot guidelines document is available at [docs/screenshots/README.md](docs/screenshots/README.md).

Maintainers and contributors can capture and add screenshots of:
1. **Connected Dashboard** (`docs/screenshots/01-dashboard-connected.png`)
2. **Disconnected Dashboard** (`docs/screenshots/02-dashboard-disconnected.png`)
3. **QR Code Pairing Wizard** (`docs/screenshots/03-wireless-qr-pairing.png`)
4. **6-Digit PIN Pairing Wizard** (`docs/screenshots/04-wireless-pin-pairing.png`)
5. **Device Navigation Controls** (`docs/screenshots/05-device-controls.png`)
6. **Recordings & Media Gallery** (`docs/screenshots/06-recordings-media.png`)
7. **Settings & Mirroring Profiles** (`docs/screenshots/07-settings-profile.png`)
8. **Redacted Diagnostics Log** (`docs/screenshots/08-diagnostics-redacted.png`)

---

## Installation & Getting Started

### Prerequisites
- **Computer:** Windows 10 (64-bit) or Windows 11 (64-bit).
- **Phone:** Android 11 or newer (for zero-USB wireless pairing).
- **Network:** PC and phone must be connected to the **same Wi-Fi network**.

### Option 1: Standalone Portable Application (When Packaged)
If you have built or obtained the standalone packaged Windows application:
1. Open the distribution directory (default: `%USERPROFILE%\Downloads\KMR Control\`).
2. Double-click **`KMR Control.exe`**.
3. No installation of Node.js, npm, or external drivers is required.

### Option 2: Running from Source
Follow the [Developer Setup](#developer-setup) instructions below to run the application from source using Node.js.

---

## How to Connect Your Device (Zero-USB Setup)

### Step 1: Enable Wireless Debugging on Android
1. On your phone, go to **Settings > About Phone**.
2. Tap **Build Number** 7 times until you see *"You are now a developer!"*.
3. Go to **Settings > System > Developer Options** (or directly under Settings on Samsung devices).
4. Scroll down to the **Debugging** section and toggle **Wireless Debugging** to **ON**.
5. When prompted, tap **"Allow"** (and check *"Always allow on this network"*).

### Step 2: Choose a Wireless Pairing Method

#### Method A: Pair with QR Code
1. In KMR Control, click **Wireless Connection** and open the **Pair with QR Code** tab.
2. A QR code with a 90-second countdown will appear.
3. On your phone, tap the text **"Wireless Debugging"** to enter its menu, then tap **"Pair device with QR code"**.
4. Scan the QR code on your PC screen with your phone's camera.
5. KMR Control detects the device via local mDNS, completes pairing, and redirects to the active Dashboard!

#### Method B: Pair with 6-Digit Pairing Code
1. On your phone's Wireless Debugging screen, tap **"Pair device with pairing code"**.
2. A popup displays a 6-digit **Wi-Fi pairing code** and an **IP address & Port** (this is your *Pairing Port*). Keep this popup open.
3. In KMR Control, open the **Pair with Pairing Code** tab:
   - Enter your phone's **IP Address**.
   - Enter the 6-digit **Pairing Code**.
   - Enter the **Pairing Port** from the popup.
   - Enter the **ADB Connection Port** shown on the screen behind the popup.
   - Enter a **Device Alias** (e.g. `Galaxy M15`).
4. Click **"Pair & Connect Device"**.

### Step 3: Reconnection (Direct Connect & Trusted Devices)
Android rotates dynamic connection ports whenever Wi-Fi reconnects or the phone restarts:
- Open the **Trusted Devices** tab in KMR Control.
- Click **Edit Port** on your saved device card, enter the new 5-digit port from your phone's Wireless Debugging screen, and click **Save & Connect**.
- **You do NOT need to pair again.**

### Step 4: Disconnecting Devices
To safely disconnect, click the **Disconnect** button on the Dashboard. KMR Control closes the wireless ADB socket cleanly without leaving lingering processes.

---

## Developer Setup

### 1. Verify Prerequisites
Ensure Node.js and npm are installed:
```powershell
node --version
npm --version
git --version
```
*Supported Node.js versions: v20.x, v22.x, or v26.x on 64-bit Windows.*

### 2. Install Dependencies
```powershell
npm install
```

### 3. Launch the Application in Development Mode
```powershell
npm start
```

### 4. Verify Headless Startup (Test Mode)
```powershell
npm start -- --test-mode
```
*Expected exit code: 0.*

### 5. Run the Automated Test Suites
Run the entire comprehensive test suite across all 7 verification phases:
```powershell
npm run test:all
```
Or run individual test suites:
```powershell
npm test                           # Phase 1: Smoke test & settings integrity
node test/phase2-dashboard-test.js # Phase 2: Telemetry & real ADB execution
node test/phase3-wireless-wizard-test.js # Phase 3: Pairing validation & security
node test/phase4-engine-test.js    # Phase 4: Engine args & process supervision
node test/phase5-diagnostics-test.js # Phase 5: Log redaction & resilience
node test/phase6-e2e-test.js       # Phase 6: E2E audit, themes & UI integrity
node test/phase7-qr-pairing-test.js# Phase 7: QR protocol & independent decoding
```

### 6. Package the Standalone Application
To compile and package the portable Windows x64 distribution:
```powershell
npm run package
```
*Build output: `%USERPROFILE%\Downloads\KMR Control\` (or path set by `$env:KMR_OUTPUT_DIR`).*

---

## Architecture

KMR Control utilizes a strict three-tier architecture:

```
[Renderer Process (Chromium)] <==> [Preload Context Bridge] <==> [Main Process (Node.js)]
                                    (window.kmrApi)                     ||
                                                                        v
                                                   child_process.spawn(..., { shell: false })
                                                                        ||
                                                   +--------------------+--------------------+
                                                   |                                         |
                                                   v                                         v
                                              [adb.exe]                              [kmr-engine.exe]
                                        (Android Debug Bridge)                    (KMR Display Engine)
```

- **Renderer (`src/renderer/`):** Pure HTML5/CSS3/JavaScript UI layer. Strictly sandboxed with zero direct access to Node.js APIs or file system primitives.
- **Preload (`src/preload/preload.js`):** Sandboxed context bridge using Electron's `contextBridge.exposeInMainWorld`. Exposes a strictly whitelisted `window.kmrApi` interface.
- **Main Process (`src/main/`):** Manages window lifecycles, supervises native subprocesses using `{ shell: false }`, validates all IPC inputs, runs the QR pairing state machine, and applies automated diagnostics redaction.
- **Engine Subprocesses:** Executes bundled native binaries (`adb.exe` and `kmr-engine.exe`) using array-based argument vectors passed directly to the operating system's `CreateProcessW` API.

For detailed architecture diagrams and data flows, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Security & Privacy Model

- **No Shell Injection:** Shell execution (`child_process.exec`) is strictly forbidden. Subprocesses are spawned exclusively via `child_process.spawn` with array arguments and `{ shell: false }`.
- **Zero Storage of Pairing Secrets:** Temporary 6-digit pairing PINs and QR pairing passwords exist strictly in volatile memory during the active pairing handshake. They are never written to disk, never logged, and are scrubbed with `null` upon session termination.
- **Automated Log Sanitization:** The diagnostics engine automatically redacts pairing PINs (`[REDACTED CODE]`), QR tokens (`[REDACTED]`), host Windows usernames (`C:\Users\<USER>\...`), and device GUIDs.
- **Electron Isolation:** Context isolation is enabled (`contextIsolation: true`) and Node integration is disabled (`nodeIntegration: false`).
- **No Cloud Dependency / Zero Telemetry:** The application contains zero remote telemetry, zero analytics tracking, and makes no network requests outside of local LAN communication with the Android device.
- **Local Storage Location:** User settings (theme, resolution, trusted device endpoints) are stored locally in `%APPDATA%\KMR-Control\settings.json`.

For the complete security specification, see [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) and [SECURITY.md](SECURITY.md).

---

## Licensing & Third-Party Notices

KMR Control is open-source software licensed under the **Apache License, Version 2.0**.

### Bundled Third-Party Components & Attributions

KMR Control bundles and interfaces with the following open-source technologies:

| Component | Upstream Project | License | Purpose |
| :--- | :--- | :--- | :--- |
| **Display Engine** | [scrcpy](https://github.com/Genymobile/scrcpy) by Genymobile | Apache License 2.0 | High-performance Android screen mirroring and video capture. |
| **Android Debug Bridge** | Android Open Source Project (AOSP) / Google | Apache License 2.0 | Device discovery, pairing, and wireless command transport. |
| **QR Code Engine** | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase | MIT License | ISO/IEC 18004 Model 2 QR Code generation and SVG rendering. |
| **Desktop Runtime** | [Electron](https://github.com/electron/electron) by OpenJS Foundation | MIT License | Cross-platform desktop windowing and sandboxed runtime. |
| **Media Codecs** | FFmpeg (avcodec, avformat, avutil, swresample) | LGPL / GPL | Video decoding and audio stream processing. |
| **Window & Input** | SDL (Simple DirectMedia Layer v3) | zlib License | Display window management and input handling. |

The complete text of the Apache License 2.0 is provided in [LICENSE.txt](LICENSE.txt). Third-party license notices are preserved in `THIRD_PARTY_NOTICES.txt` within the packaged release.

---

## Documentation Index

- [User Guide](docs/USER_GUIDE.md) — Comprehensive operational manual and interface walkthrough.
- [Wireless Pairing & Reconnection Guide](docs/WIRELESS_PAIRING_GUIDE.md) — Step-by-step wireless pairing walkthrough.
- [System Architecture](docs/ARCHITECTURE.md) — Technical component design and process hierarchy.
- [Developer Guide](docs/DEVELOPMENT.md) — Local development, test execution, and debugging.
- [Security Model & Privacy](docs/SECURITY_MODEL.md) — Threat boundaries, credential lifecycle, and sandboxing.
- [Troubleshooting & Diagnostics](docs/TROUBLESHOOTING.md) — Common connection errors and actionable workarounds.
- [Release Checklist](docs/RELEASE_CHECKLIST.md) — Maintainer guide for producing and publishing versioned releases.
- [Contributing Guidelines](CONTRIBUTING.md) — Code style, pull request policy, and contribution workflow.
- [Security Policy](SECURITY.md) — Vulnerability reporting policy and supported versions.
- [Changelog](CHANGELOG.md) — Full version history and release notes.

---

## Frequently Asked Questions (FAQ)

### Does KMR Control require a USB cable for initial setup?
**No.** If your device runs Android 11 or newer, initial pairing can be completed 100% wirelessly using either **Pair with QR Code** or **Pair with Pairing Code**. No USB cable is required at any time.

### Why does the port number change when my phone restarts?
Android's native Wireless Debugging allocates a random dynamic port on every Wi-Fi reconnect for security. In KMR Control, simply open **Trusted Devices**, click **Edit Port**, enter the new port shown on your phone, and click **Connect**. You do not need to pair again.

### What Android versions are supported?
- **Android 11 and newer:** Full support for Zero-USB wireless pairing (QR code and 6-digit PIN) and wireless mirroring.
- **Android 5.0 to 10:** Supports direct wireless mirroring (`adb connect <ip>:<port>`), but initial TCP/IP mode must first be enabled via standard ADB.

### Is root access required on the Android phone?
**No.** KMR Control uses standard Android Developer Options and the official Android Wireless Debugging protocol. No root access or system modifications are required.

### Can I record audio during screen mirroring?
On Android 12 and newer, the bundled engine forwards device audio natively over the wireless stream. On Android 11, audio forwarding is subject to vendor-specific audio capture policies.

### Where are screenshots and screen recordings saved?
- Screenshots (PNG): `%USERPROFILE%\Pictures\KMR-Control\`
- Screen Recordings (MP4): `%USERPROFILE%\Videos\KMR-Control\`
You can access and open them directly from the **Recordings & Media** tab in the application.

---

## Contributing & Roadmap

Contributions are welcome! Please review [CONTRIBUTING.md](CONTRIBUTING.md) before opening pull requests.

### Project Roadmap
- [x] Zero-USB Wireless Pairing Wizard (6-digit PIN & QR code).
- [x] Genuine real-time hardware telemetry dashboard.
- [x] Customizable mirroring settings & persistent user profiles.
- [x] Silent screenshot capture and MP4 screen recording gallery.
- [x] Windows 11 Light, Dark, and System theme synchronization.
- [x] Automated diagnostics log stream with sensitive token redaction.
- [ ] Multi-device switcher and concurrent connection management.
- [ ] User-customizable keyboard shortcuts for virtual navigation controls.
- [ ] Optional automated periodic Wi-Fi port auto-discovery for trusted devices.
