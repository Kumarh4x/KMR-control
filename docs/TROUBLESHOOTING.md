# KMR Control — Troubleshooting & Diagnostics Guide

Comprehensive diagnostic steps for common Android Wireless Debugging, network routing, and display engine issues.

---

## 1. "Connection Refused" Error

### Cause
Android assigns a new dynamic connection port each time:
- The phone restarts.
- The phone toggles Wi-Fi off and on.
- Wireless Debugging is disabled and re-enabled.

### Solution
1. On your phone, open **Settings > Developer Options > Wireless Debugging**.
2. Note the new 5-digit port under **"IP address & Port"** (e.g. `192.168.1.150:41295`).
3. In KMR Control:
   - Go to the **Trusted Devices** tab.
   - Click **Edit Port** on your saved device, enter the new port, and click **Save & Connect**.
   - Alternatively, open the **Direct Connect** tab, enter the IP and new port, and click **Connect**.
4. **You do NOT need to pair again!**

---

## 2. "Device Unauthorized" Error

### Cause
The phone has not authorized your computer's ADB cryptographic RSA key, or previous authorizations were revoked.

### Solution
1. Unlock your phone screen.
2. Check for the system prompt: *"Allow wireless debugging on this network?"*.
3. Check the box **"Always allow on this network"** and tap **Allow**.
4. In KMR Control, click **Refresh** on the Dashboard.

### If the authorization prompt does not appear:
1. On your phone, navigate to **Settings > Developer Options**.
2. Scroll down to the debugging section and tap **"Revoke USB debugging authorizations"**.
3. Toggle **Wireless Debugging** OFF, wait 5 seconds, and toggle it back **ON**.
4. Retry the connection from KMR Control.

---

## 3. QR Code Scanning Troubleshooting

### Symptom: Phone Camera Scanner Does Not Read the On-Screen QR Code
1. **Monitor Reflections & Glare:** Ensure overhead lights or lamps are not reflecting off your monitor screen directly over the QR code.
2. **Display Brightness:** Ensure your PC monitor is set to normal or high brightness. Dark screens can prevent phone cameras from resolving black-to-white module contrast.
3. **Distance & Framing:** Hold your phone approximately 6 to 12 inches (15–30 cm) from the monitor so the QR code fills the on-screen viewfinder box.
4. **Night Light / Blue-Light Filters:** Heavy orange display tinting (Windows Night Light or f.lux) can reduce optical contrast. Temporarily toggle Night Light off if scanning is sluggish.

### Symptom: Phone Scans the Code, but KMR Control Shows "Waiting for scan..."
1. **Router Client Isolation:** Many guest Wi-Fi networks and corporate routers enable "AP Isolation" or "Client Isolation", which blocks peer-to-peer packets between Wi-Fi devices. Ensure your PC and phone are on a private home network.
2. **mDNS Multicast Filtering:** Wireless Debugging pairing utilizes mDNS announcements (`_adb-tls-pairing._tcp`). If your router blocks multicast traffic:
   - Switch to the **Pair with Pairing Code** tab in KMR Control and use the 6-digit PIN method. Manual PIN pairing uses direct unicast TCP and works even on routers that block multicast.
3. **Windows Firewall:** Ensure Windows Defender Firewall has allowed `adb.exe` on Private networks.

---

## 4. "Connection Timed Out" / Cannot Reach Phone IP

### Cause
Your PC and Android phone cannot route TCP packets to each other over your local network.

### Solution
1. **Confirm IP Address:** On your phone, check **Settings > Developer Options > Wireless Debugging** and confirm the phone's current local IP address (e.g. `192.168.1.x`).
2. **Ping Test:** Open PowerShell on your PC and run:
   ```powershell
   Test-Connection -TargetName <phone-ip> -Count 2
   ```
   If packets fail to return, check your router's wireless settings.
3. **Disable VPNs:** If a VPN is active on either your PC or your Android phone, local LAN traffic might be redirected through the VPN tunnel. Temporarily disconnect VPNs.
4. **Battery Optimization:** Ensure battery saver mode is disabled on the phone while Wireless Debugging is in use, as aggressive power profiles may sleep the Wi-Fi radio.

---

## 5. Display Engine Exit Codes Reference

| Exit Code | Classification | Cause & Actionable Fix |
| :--- | :--- | :--- |
| **Code 0** | Clean Exit | The display window was closed normally by the user. |
| **Code 1** | Startup Failure | The requested video configuration (e.g. extreme resolution or unsupported bitrate) was rejected by the phone's hardware encoder. In KMR Control Settings, lower the resolution limit to `1080p` and set bitrate to `8M`. |
| **Code 2** | Connection Lost | The Wi-Fi connection was dropped mid-session, or the phone was moved out of range. Check Wi-Fi signal and click **Direct Connect**. |

---

## 6. How to Export Redacted Diagnostics for Support

If an issue persists:
1. Open KMR Control and navigate to the **Diagnostics & Troubleshooting** tab.
2. Review the live log stream. All pairing PINs, passwords, and user paths are automatically masked.
3. Click the **Copy Redacted Diagnostics** button to copy the sanitized log to your clipboard.
4. Paste the log into a GitHub Issue report using the provided **Bug Report** template.
