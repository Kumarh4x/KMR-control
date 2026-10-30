# KMR Control — Security Model & Privacy Architecture

This document details the cybersecurity controls, threat boundaries, and privacy safeguards engineered into KMR Control.

---

## 1. Zero Shell String Injection Architecture

Traditional desktop wrappers frequently construct command-line strings and execute them through Windows `cmd.exe` or PowerShell:
```javascript
// DANGEROUS PATTERN (STRICTLY PROHIBITED):
child_process.exec(`adb pair ${userIp}:${userPort} ${userCode}`); // Highly vulnerable to shell injection
```

**KMR Control Enforced Standard:**
All ADB commands and engine executions use Node.js `child_process.spawn()` with strict array arguments and `{ shell: false }`:
```javascript
// SECURE PATTERN ENFORCED ACROSS ENTIRE APPLICATION:
child_process.spawn(this.enginePath, ['pair', `${ip}:${port}`, code], { shell: false });
```
Arguments are passed directly to the operating system's native process creation API (`CreateProcessW`), entirely eliminating subshell invocation, argument chaining, and command injection vectors.

---

## 2. Zero-Knowledge Credential Lifecycle

### 2.1 Temporary 6-Digit Pairing Codes
- Android Wireless Debugging pairing PINs are single-use, transient tokens valid only while the pairing dialog remains open on the phone.
- **Never Persisted:** Pairing PINs are held in-memory strictly for the duration of the pairing function call. They are never written to disk, never stored in `settings.json`, and never serialized into application state.

### 2.2 QR Pairing Credentials
- QR pairing sessions generate randomized DPP tokens (`WIFI:T:ADB;S:kmr-...;P:...;;`) with 6-digit cryptographic PINs.
- **In-Memory Volatility:** Secrets are retained in volatile heap memory during the active 90-second pairing countdown.
- **Memory Scrubbing:** On session timeout, user cancellation, or successful connection establishment, all credential properties are immediately overwritten with `null`.

### 2.3 Automated Log Redaction
The in-app Diagnostics Service intercepts all stdout/stderr strings and applies regex redaction before storing or rendering:
- 6-digit numeric sequences matching pairing PINs are replaced with `[REDACTED CODE]`.
- QR payloads matching `WIFI:T:ADB;S:...;P:...;;` are masked with `[REDACTED]`.
- Specific pairing parameter tokens (`;P:[^;]+`) are sanitized.
- Windows user account profile paths (`C:\Users\<username>\...`) are generalized to `C:\Users\<USER>\...`.
- Device GUIDs and authentication tokens are masked.

---

## 3. Strict Input Validation & Bounds Enforcement

Before any command is executed, user inputs are validated against strict formatting constraints:
- **IPv4 Address:** Quad-octet format (`^([0-9]{1,3}\.){3}[0-9]{1,3}$`). Out-of-range octets (> 255), loopback (`0.0.0.0`), and broadcast (`255.255.255.255`) addresses are strictly rejected.
- **Port Bounds:** Integer bounds enforced between `1024` and `65535`. Privileged system ports (`< 1024`) and out-of-bounds numbers are disallowed.
- **Pairing PIN:** Strictly 6 numeric digits (`^\d{6}$`). Non-numeric characters or lengths not equal to 6 are rejected immediately.
- **Bitrate:** Sanitized to integer plus unit suffix (`4M`, `8M`, `16M`).
- **File Paths:** Recording destinations are constrained to user-approved directories (`Videos/KMR-Control` and `Pictures/KMR-Control`) with strict `.mp4` / `.png` extensions.

---

## 4. Electron Desktop Sandboxing & IPC Isolation

- **Context Isolation:** Enabled (`contextIsolation: true`). The renderer UI executes in an isolated JavaScript execution context.
- **Node Integration:** Disabled (`nodeIntegration: false`). Web pages cannot access Node.js primitives or native modules directly.
- **Controlled API Surface:** The renderer communicates solely through the exposed `window.kmrApi` context bridge object. No raw IPC channels or process handles are exposed.
- **Safe External Navigation:** Links to external sites are intercepted and delegated exclusively to the default system browser via `shell.openExternal`, denying renderer frame navigation.

---

## 5. Privacy & Zero-Telemetry Commitment

- **No Remote Telemetry:** The application contains zero analytical trackers, zero telemetry endpoints, and zero crash reporting beacons.
- **No Background Persistence:** The application does not install background Windows services, scheduled tasks, or startup registry keys.
- **No Remote APK Deployment:** The application never silently pushes unwanted APK packages or modifies Android device security policies.
- **Local Logs Only:** Diagnostic logs remain on your local computer in volatile memory during the active session.
