# Security Policy

Security and privacy are core engineering priorities for **KMR Control**. This document explains the security architecture, local data handling, network assumptions, known limitations, and how to report vulnerabilities responsibly.

---

## Supported Versions

Only the latest release and the current `main` branch receive security patches and updates.

| Version | Supported | Notes |
| :--- | :--- | :--- |
| `1.0.x` | Yes | Current active release branch. |
| `< 1.0.0` | No | Development / prototype builds. |

---

## Security Architecture & Safeguards

### 1. Electron Isolation Boundaries
- **Context Isolation:** Enabled (`contextIsolation: true`). The renderer script runs in an isolated context and cannot access Node.js execution environments.
- **Node Integration:** Disabled (`nodeIntegration: false`). Web pages cannot require native modules or access the underlying file system directly.
- **Sandboxed IPC Bridge:** The preload script ([src/preload/preload.js](src/preload/preload.js)) exposes a strictly curated `window.kmrApi` object via `contextBridge.exposeInMainWorld`. No raw `ipcRenderer` or process primitives are leaked to the DOM.
- **External Navigation Safeguard:** Window navigation events are intercepted; external links open exclusively via the operating system's default browser (`shell.openExternal`) rather than inside the application window.

### 2. Subprocess Execution & Shell Injection Prevention
- All ADB commands and engine executions are performed using Node.js `child_process.spawn()` with array arguments and `{ shell: false }`.
- Shell interpreters (`cmd.exe`, `powershell.exe`, or `sh`) are never invoked to execute external commands.
- All user inputs (IPv4 addresses, port numbers, pairing codes, bitrate flags, and file paths) are validated against strict whitelists and bounds before process invocation:
  - IPv4 addresses: strictly 4 numeric octets (0–255), excluding loopback and broadcast.
  - Ports: integer range bounded strictly between `1024` and `65535`.
  - Pairing PIN: strictly 6 numeric digits (`^\d{6}$`).

### 3. Credential Lifecycle & Zero Storage Policy
- **Temporary Pairing PINs:** Android Wireless Debugging pairing codes are single-use, transient numbers. KMR Control holds pairing PINs strictly in volatile memory during the active pairing call.
- **Zero Disk Persistence of Secrets:** Pairing PINs and QR pairing passwords are never written to `settings.json`, never stored in configuration files, and never logged.
- **Memory Scrubbing:** On session timeout, user cancellation, or successful pairing completion, transient credential properties are immediately overwritten with `null`.

### 4. Diagnostics Redaction Engine
- The in-app diagnostics service ([src/main/diagnostics-service.js](src/main/diagnostics-service.js)) processes all log messages through automated redaction filters before storing them in memory or displaying them in the UI:
  - 6-digit numeric codes matching pairing PIN patterns are replaced with `[REDACTED CODE]`.
  - QR payload strings (`WIFI:T:ADB;S:...;P:...;;`) and `;P:...;` tokens are sanitized to `[REDACTED]`.
  - Windows user account profile paths (`C:\Users\<username>\...`) are generalized to `C:\Users\<USER>\...`.
  - Device GUIDs and authentication tokens are masked.

---

## Local Data Storage & Privacy

| Data Element | Storage Location | Sensitivity | Notes |
| :--- | :--- | :--- | :--- |
| **Application Settings** | `%APPDATA%\KMR-Control\settings.json` | Low | Stores theme preference (`system`, `light`, `dark`) and mirroring defaults (max resolution, bitrate, FPS). |
| **Trusted Devices** | `%APPDATA%\KMR-Control\settings.json` | Low–Medium | Stores authorized device IP addresses, connection ports, and user-assigned aliases. **No pairing codes or private keys are stored.** |
| **Diagnostics Log** | In-memory buffer (capped at 200 entries) | Low | Holds redacted runtime events for troubleshooting during the active session. |
| **Media Captures** | `%USERPROFILE%\Pictures\KMR-Control\` and `%USERPROFILE%\Videos\KMR-Control\` | User Data | Captured screenshots (PNG) and screen recordings (MP4) initiated explicitly by the user. |

---

## Network Requirements & Trust Assumptions

- **Local Wi-Fi Boundary:** KMR Control communicates with Android devices over the local area network via TCP ports. It assumes the local Wi-Fi network is trusted.
- **Device Authorization:** Android's native Wireless Debugging protocol relies on ADB RSA key authentication. The user must explicitly confirm the RSA authorization prompt on the physical phone screen (*"Allow wireless debugging on this network?"*).
- **No Cloud Dependency:** KMR Control does not transmit telemetry, analytics, pairing secrets, or mirroring frames to any cloud servers or third-party endpoints. All communication remains strictly local between the Windows PC and the Android device.

---

## Known Security Limitations

1. **Unencrypted Local Wi-Fi Traffic on Older Android Versions:**
   While Android 11+ supports TLS-encrypted wireless debugging (`_adb-tls-connect._tcp`), older direct connections (`adb connect <ip>:<port>`) over plain TCP without TLS are unencrypted at the network layer. Users should operate wireless debugging only on trusted, password-protected private Wi-Fi networks.
2. **Local Machine Access:**
   Any process running with the user's Windows privileges that can access the local ADB server port (TCP 5037) can interact with connected ADB devices.

---

## Reporting a Security Vulnerability

If you discover a security vulnerability in KMR Control:
1. **Do not open a public GitHub issue.**
2. Report the vulnerability privately via **GitHub Private Vulnerability Reporting** on the repository page (under the **Security** tab > **Report a vulnerability**).
3. If private vulnerability reporting is unavailable, submit a minimal confidential advisory detailing:
   - Type of vulnerability (e.g. input validation, IPC exposure, redaction bypass).
   - Clear steps or proof-of-concept to reproduce the issue.
   - Potential impact on the host system or connected Android device.
4. Maintainers will review the submission, investigate the finding, and coordinate a fix prior to public disclosure.
