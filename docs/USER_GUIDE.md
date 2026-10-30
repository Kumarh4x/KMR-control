# KMR Control — User Guide

**Native Windows Desktop Application for Wireless Android Device Management**

---

## 1. Introduction
**KMR Control** is a high-performance Windows desktop application designed to control, mirror, and manage Android devices completely wirelessly. It integrates a dedicated display engine and **ADB v37.0.1** inside a clean, modern Windows Fluent dashboard.

---

## 2. Launching the Application

### Standalone Executable (Recommended)
Navigate to the release folder:
`%USERPROFILE%\Downloads\KMR Control\` (or your custom install directory)

Double-click:
**`KMR Control.exe`**

*Note: No installation of Node.js, npm, or external developer tools is required.*

---

## 3. Interface & Navigation

### 3.1 Custom Windows Title Bar
- **App Title & Active Status Badge:** Displays the currently connected device model/endpoint or `No Device Connected`.
- **Window Controls:** Custom Minimize, Maximize/Restore, and Close buttons.

### 3.2 Sidebar Navigation
1. **Dashboard:**
   - Real-time device metrics: Device Model, Android OS version, IP address, and Connection Transport.
   - Dynamic battery percentage with charging indicators (parsed from live hardware telemetry).
   - Display hardware specs: Physical resolution and Screen density (DPI).
   - Quick Action buttons: Start Mirroring, Take Screenshot, Record Screen, Fullscreen Mirror, Disconnect.
   - Recent Connection Activity log.
2. **Wireless Connection:**
   - 4-tab connection wizard:
     - **Pair with QR Code:** Instant pairing by scanning an on-screen QR code from your phone's Wireless Debugging settings.
     - **Pair with Pairing Code:** Manual 6-digit PIN pairing with independent pairing and connection port fields.
     - **Direct Connect:** Quick connection to an already-paired device IP and active port.
     - **Trusted Devices:** List of remembered devices with one-click reconnect and quick port editing.
3. **Device Controls:**
   - Virtual hardware navigation: Back, Home, Recent Apps, Power toggle, Sleep Screen, Notification shade.
   - Audio & Media controls: Volume Up, Volume Down, Mute toggle, Play/Pause.
4. **Recordings & Media:**
   - Interactive media library displaying captured PNG screenshots and MP4 video recordings.
   - One-click shortcuts to open captures directly or reveal their folders in Windows File Explorer (`Pictures\KMR-Control` and `Videos\KMR-Control`).
5. **Settings:**
   - Customize engine parameters: Maximum Resolution Limit (1080p, 1440p, Native), Video Bitrate (4M–16M), Target FPS (30–60), Always on Top, and Fullscreen.
   - Settings automatically persist across application restarts.
6. **Diagnostics & Troubleshooting:**
   - Live stream of redacted ADB and engine events.
   - Search filter and "Copy Redacted Diagnostics" action for safe bug reporting.
   - In-app interactive troubleshooting knowledge base.

### 3.3 Theme System
At the bottom of the sidebar, choose between:
- **Light:** Clean white and soft-gray surfaces with dark text and subtle borders.
- **Dark:** Charcoal surfaces with comfortable contrast and restrained blue accents.
- **Auto (System):** Dynamically synchronizes with your Windows system theme in real-time.

---

## 4. Quick Actions Reference

| Action | Description | Destination |
| :--- | :--- | :--- |
| **Start Mirroring** | Launches the display window with your chosen resolution and bitrate. | Native display window |
| **Take Screenshot** | Silently captures high-resolution screen without interrupting mirroring. | Saved to `%USERPROFILE%\Pictures\KMR-Control` |
| **Record Screen** | Captures MP4 video of the device screen. | Saved to `%USERPROFILE%\Videos\KMR-Control` |
| **Fullscreen Mirror** | Launches mirroring in fullscreen display mode. | Native monitor fullscreen |
| **Disconnect** | Safely severs the wireless ADB link and resets the dashboard. | ADB daemon disconnection |

---

## 5. Safely Disconnecting Devices

To disconnect a wirelessly connected Android device:
1. On the **Dashboard**, click the **Disconnect** button.
2. Or on the **Wireless Connection** tab, click **Disconnect Active Device**.
3. The wireless socket is closed cleanly via ADB, and the active session resets to idle without lingering background processes.
