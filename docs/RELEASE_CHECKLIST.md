# KMR Control — Release Checklist

This checklist defines the steps required by maintainers to validate, package, and publish a new versioned release of KMR Control for Windows x64.

---

## 1. Pre-Release Verification

- [ ] **Run Full Automated Test Suite:**
  ```powershell
  npm run test:all
  ```
  Ensure all 7 test suites pass with exit code `0`.
- [ ] **Verify Test Mode App Startup:**
  ```powershell
  npm start -- --test-mode
  ```
  Ensure the Electron window initializes, creates the sandboxed preload bridge, and exits cleanly with code `0`.
- [ ] **Physical Android Hardware Smoke Test:**
  - [ ] Test 6-digit PIN pairing from a physical Android 11+ phone.
  - [ ] Test QR code scan from Android Settings > Developer options > Wireless debugging.
  - [ ] Verify Direct Connect to an already-paired device.
  - [ ] Start mirroring session and verify video streaming, controls, and audio forwarding.
  - [ ] Capture a screenshot and take a short screen recording; verify files in `Pictures/KMR-Control` and `Videos/KMR-Control`.
  - [ ] Test graceful disconnection.
- [ ] **Security & Privacy Audit:**
  - [ ] Verify no secrets, passwords, or pairing PINs exist in `settings.json` or `diagnostics.log`.
  - [ ] Verify `npm run test:all` confirms redacted output for all sensitive tokens.
  - [ ] Check Git diff for any accidental local paths or credentials:
    ```powershell
    git diff
    git status
    ```

---

## 2. Version Bump & Changelog

- [ ] Update version number in `package.json`:
  ```json
  "version": "1.0.0"
  ```
- [ ] Update `CHANGELOG.md` with:
  - Version header and release date.
  - Summary of additions, improvements, bug fixes, and security enhancements.
  - Known limitations or items requiring real-device testing.

---

## 3. Package the Standalone Application

- [ ] Build the standalone Windows distributable:
  ```powershell
  npm run package
  ```
- [ ] Verify the packaged output directory:
  - Default: `C:\Users\<USER>\Downloads\KMR Control\` (or path set by `KMR_OUTPUT_DIR`).
  - Required files present:
    - `KMR Control.exe`
    - `kmr-engine.exe` (renamed scrcpy v5.0.1 engine)
    - `adb.exe` (Android platform-tools)
    - `scrcpy-server`
    - `SDL3.dll`, `avcodec-63.dll`, `avformat-63.dll`, `avutil-61.dll`, `swresample-7.dll`, `libusb-1.0.dll`, `AdbWinApi.dll`, `AdbWinUsbApi.dll`
    - `LICENSE.txt` and `THIRD_PARTY_NOTICES.txt`
    - `README.txt`
- [ ] Launch packaged executable in test mode:
  ```powershell
  & "C:\Users\<USER>\Downloads\KMR Control\KMR Control.exe" --test-mode
  ```
  Confirm it exits with code `0`.

---

## 4. Archive & Asset Preparation

- [ ] Compress the release folder into a zip archive for distribution:
  ```powershell
  Compress-Archive -Path "C:\Users\<USER>\Downloads\KMR Control\*" -DestinationPath "KMR-Control-v1.0.0-windows-x64.zip"
  ```
- [ ] Generate SHA256 checksum:
  ```powershell
  Get-FileHash -Algorithm SHA256 "KMR-Control-v1.0.0-windows-x64.zip"
  ```

---

## 5. Git Tag & GitHub Release

- [ ] Stage and commit changes:
  ```powershell
  git add .
  git commit -m "Release v1.0.0"
  ```
- [ ] Tag the release:
  ```powershell
  git tag -a v1.0.0 -m "KMR Control v1.0.0"
  ```
- [ ] Push commits and tags:
  ```powershell
  git push origin main
  git push origin v1.0.0
  ```
- [ ] Draft a new Release on GitHub:
  - Select tag `v1.0.0`.
  - Title: `KMR Control v1.0.0 — Native Wireless Android Control`
  - Paste release notes from `CHANGELOG.md`.
  - Include the SHA256 checksum in the release description.
  - Attach `KMR-Control-v1.0.0-windows-x64.zip` as a binary asset.
