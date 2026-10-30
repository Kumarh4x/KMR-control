# KMR Control — UI Screenshots & Visual Presentation Guide

This directory holds official screenshots of the KMR Control Windows desktop application for the repository `README.md` and user documentation.

---

## Screenshot Checklist

To maintain a professional, cohesive appearance across the documentation, capture screenshots using the following standard specifications:

| Screen / View | Suggested Filename | Recommended State / Context |
| :--- | :--- | :--- |
| **Connected Dashboard** | `01-dashboard-connected.png` | Active wireless connection with genuine device telemetry (Model, Battery, Resolution) and quick action buttons. |
| **Disconnected Dashboard** | `02-dashboard-disconnected.png` | Clean idle state showing the prominent "Connect Device" button and clear empty states. |
| **QR Code Pairing Wizard** | `03-wireless-qr-pairing.png` | Active QR pairing session showing the high-contrast scannable QR code and countdown badge. |
| **6-Digit PIN Pairing** | `04-wireless-pin-pairing.png` | Wizard view showing the IP address, pairing port, connection port, and 6-digit PIN input fields. |
| **Device Controls** | `05-device-controls.png` | Virtual navigation buttons (Back, Home, Recents, Power, Volume, Notifications). |
| **Recordings & Media** | `06-recordings-media.png` | Media library grid showing captured PNG screenshots and MP4 video recordings with folder shortcuts. |
| **Settings & Mirroring Profile** | `07-settings-profile.png` | Mirroring settings panel (Resolution limits, Bitrate, Target FPS, Fullscreen, Always on Top). |
| **Diagnostics & Troubleshooting** | `08-diagnostics-redacted.png` | Live log stream showing automatic redaction of pairing codes and system paths. |

---

## Capture Guidelines

1. **Resolution & Scaling:**
   - Window size: Launch at standard default size (`1100x720` or maximized on a 1080p display).
   - Display DPI: 100% or 125% Windows scaling for crisp text.
2. **Theme Consistency:**
   - Capture the primary screenshots in either **Dark Theme** or **Light Theme** consistently.
   - If showcasing theme support, capture side-by-side comparisons of the Dashboard in both themes.
3. **Privacy & Redaction:**
   - Do NOT display personal Wi-Fi network SSIDs, sensitive personal phone numbers, or unredacted system usernames in screenshot banners.
   - Device alias examples: `Pixel 8 Pro`, `Galaxy M15`, `Living Room Tablet`.
4. **Tooling:**
   - Use the built-in Windows Snipping Tool (`Win + Shift + S`) selecting the Window Snip option (`Alt + PrintScreen`) to capture clean window borders with drop shadows.
   - Save directly as lossless PNG into this directory (`docs/screenshots/`).

---

## Using Screenshots in Markdown

Once screenshots are saved into this folder, reference them using relative paths in `README.md` and docs:

```markdown
![KMR Control Dashboard](docs/screenshots/01-dashboard-connected.png)
```
*(Do not add relative image markdown links in `README.md` until the image files are physically placed in this folder).*
