# KMR Control — Wireless Pairing & Reconnection Guide

This guide explains how to pair and connect an Android device to KMR Control completely wirelessly, without requiring a USB cable at any point in the workflow.

---

## 1. Prerequisites

- **Android Version:** Android 11 or newer (features native Wireless Debugging with TLS pairing and DPP QR code support).
- **Network Requirement:** Both your Windows PC and your Android phone must be connected to the **same local Wi-Fi network**.
  - Dual-band routers: Ensure your PC and phone are on the same subnet (e.g. both on 2.4 GHz or both on 5 GHz, or guest network isolation is disabled).
  - VPN: Temporarily disconnect third-party VPNs on either device if local subnet routing is blocked.

---

## 2. Enabling Wireless Debugging on Android

1. Open **Settings** on your phone.
2. Tap **About Phone** (or *About Device*).
3. Find **Build Number** and tap it **7 times** consecutively until you see the confirmation: *"You are now a developer!"*.
4. Return to **Settings** > **System** > **Developer Options** (on Samsung devices, directly under *Settings* > *Developer Options*).
5. Scroll down to the **Debugging** section and toggle **Wireless Debugging** to **ON**.
6. When prompted with *"Allow wireless debugging on this network?"*, tap **Allow** (optionally check *"Always allow on this network"*).

---

## 3. Connection Methods

KMR Control provides four flexible connection tabs under the **Wireless Connection** view:

### Method A: Pair with QR Code (Recommended)

1. In KMR Control, click **Wireless Connection** and select the **Pair with QR Code** tab.
2. The application initiates a secure, transient pairing session and renders a high-contrast QR code with a 90-second countdown timer.
3. On your phone:
   - In *Developer Options*, tap the **text label** of **"Wireless Debugging"** to open its settings page.
   - Tap **"Pair device with QR code"**.
   - Point your phone camera at the QR code displayed on your PC screen.
4. Once scanned:
   - Android initiates the pairing handshake with KMR Control over local mDNS.
   - KMR Control automatically detects the device, pairs via ADB, establishes the wireless connection, and redirects to the active Dashboard!

*Note: While automated QR vector and raster decoding tests have verified 100% specification compliance, camera capture on physical hardware requires user verification with the target phone.*

---

### Method B: Pair with 6-Digit Pairing Code

Android separates the **Pairing Port** from the **Connection Port**. This manual method provides full transparency:

1. In *Developer Options*, tap the **text label** of **"Wireless Debugging"** to enter its full menu.
2. Tap **"Pair device with pairing code"**.
3. A popup dialog will appear displaying:
   - **Wi-Fi pairing code:** (e.g., `482910` — exactly 6 digits).
   - **IP address & Port:** (e.g., `192.168.1.150:41253`). This is your **Pairing Port**!
4. **Important:** Keep this popup open on your phone screen until pairing finishes!
5. In KMR Control, select the **Pair with Pairing Code** tab:
   - **Phone IP Address:** Enter the IP (e.g., `192.168.1.150`).
   - **Pairing Code:** Enter the 6 digits from the popup (e.g., `482910`).
   - **Pairing Port:** Enter the 5-digit port from the popup (e.g., `41253`).
   - **ADB Connection Port:** Enter the port shown on the *main* Wireless Debugging screen behind the popup (e.g., `38421`).
   - **Device Alias:** Give your phone a friendly name (e.g., `Galaxy M15`).
   - Ensure **Remember this device** is checked.
6. Click **"Pair & Connect Device"**.

The application will:
1. Execute `adb pair <ip>:<pair_port> <code>`.
2. Execute `adb connect <ip>:<connect_port>`.
3. Save the device to your Trusted Devices list.
4. Redirect you to the Dashboard with live telemetry!

---

### Method C: Direct Connect

For devices that have already been paired previously, you do **not** need to pair again:
1. In KMR Control, click the **Direct Connect** tab.
2. Enter your phone's current IP address and the active connection port shown on your phone's *Wireless Debugging* screen.
3. Click **Connect**.

---

### Method D: Trusted Devices & Dynamic Port Reconnection

Android assigns a new connection port every time Wi-Fi is toggled or the phone restarts:
1. In KMR Control, go to the **Trusted Devices** tab.
2. If your device's connection port changed:
   - Click the **Edit Port** button on your saved device card.
   - Enter the new 5-digit port shown on your phone.
   - Click **Save & Connect**.
3. KMR Control updates the endpoint and reconnects immediately **without requiring re-pairing**.

---

## 4. Safely Disconnecting Devices

To disconnect cleanly:
- On the **Dashboard**, click the red **Disconnect** button.
- KMR Control terminates the active wireless session and unbinds the ADB TCP socket.
- Your pairing keys remain safely stored on your phone for future one-click reconnection.

---

## 5. Wireless Troubleshooting Quick Reference

| Issue | Typical Cause | Solution |
| :--- | :--- | :--- |
| **"Connection Refused"** | The phone's dynamic port changed after restart or Wi-Fi reconnect. | Check the new port on your phone's Wireless Debugging screen and update it via **Edit Port** on the Trusted Devices tab. |
| **"Device Unauthorized"** | The phone has not accepted the computer's RSA key. | Unlock your phone, tap **"Always allow on this network"**, and tap **Allow**. |
| **QR Scan Does Not Trigger** | Camera glare, extreme display angle, or low screen brightness. | Increase screen brightness, center the QR code in the camera viewfinder, and ensure no light reflections glare off the monitor. |
| **mDNS Not Discovered** | Router AP isolation or multicast filtering enabled on the Wi-Fi router. | Disable "Client Isolation" or "AP Isolation" in your router settings, or use the **Pair with Pairing Code** tab. |
