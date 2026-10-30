# Changelog

All notable changes to **KMR Control** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-29

### Added
- **Zero-USB Wireless Pairing Wizard (Android 11+):**
  - 6-digit PIN pairing dialog supporting Android's separate pairing and connection ports.
  - Native QR code wireless pairing session generator adhering to the Android Wireless Debugging DPP specification (`WIFI:T:ADB;S:<service>;P:<password>;;`).
  - Automated mDNS watcher polling for `_adb-tls-pairing._tcp` and `_adb-tls-connect._tcp` service announcements.
  - Zero-storage credential lifecycle: pairing PINs and passwords are kept in volatile memory only and scrubbed immediately on completion, cancellation, or timeout.
- **Genuine Device Telemetry Dashboard:**
  - Real-time hardware information: device model, Android OS version, IP address, and connection transport.
  - Live battery percentage with dynamic charging state indicators parsed from `dumpsys battery`.
  - Display hardware metrics: physical resolution and density (DPI) parsed from `wm size` and `wm density`.
  - Disconnected and offline state handling without fabricated metrics.
- **Display Engine & Remote Controls:**
  - Integrated high-performance display engine based on scrcpy v5.0.1 and ADB v37.0.1.
  - Safe subprocess execution via `child_process.spawn` with array arguments and `{ shell: false }`.
  - Customizable mirroring settings: maximum resolution limits (e.g. 1080p, 1440p, native), video bitrates (4M–16M), target frame rates (30–60 FPS), fullscreen toggle, and always-on-top window pin.
  - Remote virtual hardware buttons: Back, Home, Recent Apps, Power toggle, Screen sleep, and Notification shade.
  - Audio and volume controls: Volume Up, Volume Down, and Mute toggles.
- **Media Library & Capture Gallery:**
  - Silent screenshot capture with automatic PNG saving to `%USERPROFILE%\Pictures\KMR-Control\`.
  - MP4 video screen recording with automatic saving to `%USERPROFILE%\Videos\KMR-Control\`.
  - Integrated in-app media gallery with thumbnail previews and one-click shortcuts to reveal captures in Windows File Explorer.
- **Theme & Desktop Integration:**
  - Windows 11 Fluent design with Light, Dark, and Auto-System theme synchronization.
  - Custom frameless title bar with native window controls (minimize, maximize, close).
  - Responsive CSS layout with fluid auto-fit grids adapting across desktop display sizes down to 860px.
- **Diagnostics & Security:**
  - In-memory event logger with real-time text stream and search filter.
  - Automated redaction engine replacing 6-digit pairing codes, QR secrets, system usernames, and device GUIDs with sanitized placeholder tokens.
  - One-click "Copy Redacted Diagnostics" action for safe troubleshooting submissions.
  - Context isolation (`contextIsolation: true`) and disabled Node integration (`nodeIntegration: false`) across renderer web pages.
- **Portable Packaging:**
  - Standalone portable Windows x64 build script bundling the Electron runtime, renamed engine (`kmr-engine.exe`), ADB, scrcpy-server, and required codec libraries.
  - Can be launched directly from the release folder without requiring Node.js or npm.
- **Unified Product Identity & Internal Architecture Standardization:**
  - Rebranded engine supervisor to `src/main/kmr-engine-runner.js` (`KmrEngineRunner`) with high-performance `kmr-engine.exe` binary execution while maintaining a backward-compatible proxy at `src/main/scrcpy-runner.js`.
  - Refactored IPC channels to `engine:*` with legacy `scrcpy:*` event handler aliases for full backward compatibility.
  - Standardized application package identity (`kmr-control`), window branding (`KMR Control`), logging categories, and test suite runner (`phase4-engine-test.js`).
  - Preserved all required open-source third-party legal notices and licenses (scrcpy under Apache 2.0, ADB under Apache 2.0, QR generator under MIT, Electron under MIT).

### Fixed
- Fixed QR code recognition failure on Android camera scanners by replacing the generator with a complete ISO/IEC 18004 Model 2 implementation featuring full 8-mask penalty calculations, Error Correction Level Medium (`'M'`), and high-contrast vector SVG output.
- Removed subpixel CSS hover scale distortion on the QR container to ensure module edges remain sharp on high-DPI Windows displays.
- Sanitized hardcoded username paths in packaging scripts to ensure reproducible builds across different development machines and CI environments.

### Verification Status
- **Automated Tests:** 100% passed across all 7 test suites (Smoke test, Dashboard telemetry, Wireless wizard, Display engine integration, Diagnostics redaction, E2E security audit, and QR vector decoding).
- **Physical Device QR Scanning:** Automated vector and raster decoding verified with independent QR decoders; physical camera capture requires real-device verification on target phone hardware.
