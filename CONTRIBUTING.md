# Contributing to KMR Control

Thank you for your interest in contributing to **KMR Control**! This document provides guidelines for contributing code, reporting bugs, and proposing enhancements.

---

## Code of Conduct

All contributors and participants are expected to maintain a respectful, welcoming, and harassment-free environment for everyone. Please be constructive and civil in discussions, issue reports, and pull requests.

---

## How to Contribute

### 1. Reporting Bugs
Before filing a bug report:
- Check existing issues in the GitHub repository to verify the bug has not already been reported.
- Verify whether the issue persists across both wireless connection modes (QR pairing and 6-digit PIN pairing).
- Review [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) to check for common network and Android Wireless Debugging edge cases.

When submitting a bug report:
- Use the **Bug Report** template.
- Specify your exact Windows version, Android OS version, and phone model.
- Include sanitized logs from the in-app **Diagnostics & Troubleshooting** tab (using the **Copy Redacted Diagnostics** button).
- **Never include unredacted pairing codes, passwords, or personal credentials in issue reports.**

### 2. Suggesting Enhancements
- Use the **Feature Request** template.
- Describe the proposed feature, the use case it addresses, and any technical considerations for Android Wireless Debugging or the Windows desktop platform.

### 3. Submitting Code Changes
1. Fork the repository and create a descriptive branch:
   ```powershell
   git checkout -b feature/your-feature-name
   ```
2. Follow existing code style and architectural boundaries:
   - Use 2-space indentation (enforced via `.editorconfig`).
   - Use standard ES6+ JavaScript.
   - Maintain Electron security boundaries: never disable `contextIsolation`, never enable `nodeIntegration`, and never execute shell commands with string interpolation.
   - All child processes must use `child_process.spawn()` with array arguments and `{ shell: false }`.
   - Never store pairing codes, passwords, or temporary credentials on disk or in persistent settings.
   - Redact all sensitive tokens before passing strings to loggers.
3. Run all automated tests:
   ```powershell
   npm run test:all
   ```
   Ensure all test suites pass without regressions.
4. Verify application launch in test mode:
   ```powershell
   npm start -- --test-mode
   ```
5. Ensure packaging completes without error:
   ```powershell
   npm run package
   ```
6. Submit a pull request against the `main` branch using the provided PR template.

---

## Coding Standards & Architectural Guidelines

| Layer | Responsibility | Constraints |
| :--- | :--- | :--- |
| **Main Process (`src/main/`)** | Lifecycle, window creation, ADB process spawning, engine process supervision, file system access. | Must strictly validate all IPC arguments. Must use `{ shell: false }` for all subprocesses. |
| **Preload Bridge (`src/preload/`)** | Sandboxed context bridge (`window.kmrApi`). | Expose only specific, typed invoke/on channels. Never expose `require`, `process`, or full `ipcRenderer`. |
| **Renderer (`src/renderer/`)** | Fluent UI, event handling, view navigation, DOM updates, QR rendering. | Zero direct Node.js access. Must interact exclusively via `window.kmrApi`. |
| **Diagnostics (`src/main/diagnostics-service.js`)** | In-memory log buffer and search filtering. | All messages must pass through the redaction regex engine before storage or display. |

---

## Testing Policy

Every pull request must maintain or increase test coverage:
- If adding an ADB or process management feature, add corresponding automated unit/integration tests under `test/`.
- If modifying the QR code engine, verify matrix output with the independent QR decoder regression test (`test/phase7-qr-pairing-test.js`).
- Clearly distinguish simulated tests from tests requiring physical Android hardware.

---

## Development Roadmap

Current development priorities:
- [x] Android 11+ 6-digit wireless pairing wizard (USB-free setup).
- [x] Direct reconnection and trusted device management.
- [x] Real-time hardware telemetry (battery, OS, screen resolution/density).
- [x] Mirroring controls with persistent user profiles.
- [x] Silent screenshots and MP4 recording gallery.
- [x] In-app diagnostics stream with automated token redaction.
- [x] ISO/IEC 18004 Model 2 QR code wireless pairing engine.
- [ ] Physical device verification and multi-device switcher support.
- [ ] Keyboard shortcut customization for common navigation controls.
- [ ] Audio routing toggle options for supported Android 12+ devices.
