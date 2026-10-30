// KMR Control - Renderer Script

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Theme Manager
  if (window.ThemeManager) {
    await window.ThemeManager.init();
  }

  // 2. Window Controls Binding
  const btnMinimize = document.getElementById('btn-minimize');
  const btnMaximize = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');

  if (btnMinimize && window.kmrApi) {
    btnMinimize.addEventListener('click', () => window.kmrApi.minimizeWindow());
  }
  if (btnMaximize && window.kmrApi) {
    btnMaximize.addEventListener('click', () => window.kmrApi.maximizeWindow());
  }
  if (btnClose && window.kmrApi) {
    btnClose.addEventListener('click', () => window.kmrApi.closeWindow());
  }

  // 3. Navigation Tab Switching
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  function switchToTab(tabId) {
    navItems.forEach(nav => {
      if (nav.getAttribute('data-tab') === tabId) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === tabId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    if (tabId === 'tab-dashboard') {
      refreshDashboard();
    } else if (tabId === 'tab-wireless') {
      startQrPairingFlow();
      renderTrustedDevices();
    } else if (tabId === 'tab-media') {
      renderMediaLibrary();
    } else if (tabId === 'tab-diagnostics') {
      renderDiagnosticsLogs();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTabId = item.getAttribute('data-tab');
      switchToTab(targetTabId);
    });
  });

  // 4. Load & Bind Settings
  if (window.kmrApi && window.kmrApi.getSettings) {
    try {
      const settings = await window.kmrApi.getSettings();
      if (settings && settings.mirroring) {
        const resEl = document.getElementById('setting-resolution');
        const bitEl = document.getElementById('setting-bitrate');
        const fpsEl = document.getElementById('setting-fps');
        const aotEl = document.getElementById('setting-always-on-top');
        const fsEl = document.getElementById('setting-fullscreen');

        if (resEl) resEl.value = settings.mirroring.maxResolution || 'auto';
        if (bitEl) bitEl.value = settings.mirroring.bitRate || '8M';
        if (fpsEl) fpsEl.value = settings.mirroring.maxFps || '60';
        if (aotEl) aotEl.checked = !!settings.mirroring.alwaysOnTop;
        if (fsEl) fsEl.checked = !!settings.mirroring.fullscreen;

        const cfgRes = document.getElementById('dash-cfg-res');
        const cfgBitrate = document.getElementById('dash-cfg-bitrate');
        const cfgFps = document.getElementById('dash-cfg-fps');
        if (cfgRes) cfgRes.textContent = settings.mirroring.maxResolution || 'Auto';
        if (cfgBitrate) cfgBitrate.textContent = settings.mirroring.bitRate || '8 Mbps';
        if (cfgFps) cfgFps.textContent = `${settings.mirroring.maxFps || 60} FPS`;

        const saveMirrorSettings = async () => {
          await window.kmrApi.updateSettings({
            mirroring: {
              maxResolution: resEl ? resEl.value : 'auto',
              bitRate: bitEl ? bitEl.value : '8M',
              maxFps: fpsEl ? fpsEl.value : '60',
              alwaysOnTop: aotEl ? aotEl.checked : false,
              fullscreen: fsEl ? fsEl.checked : false
            }
          });
          if (cfgRes) cfgRes.textContent = resEl.value;
          if (cfgBitrate) cfgBitrate.textContent = bitEl.value;
          if (cfgFps) cfgFps.textContent = `${fpsEl.value} FPS`;
        };

        if (resEl) resEl.addEventListener('change', saveMirrorSettings);
        if (bitEl) bitEl.addEventListener('change', saveMirrorSettings);
        if (fpsEl) fpsEl.addEventListener('change', saveMirrorSettings);
        if (aotEl) aotEl.addEventListener('change', saveMirrorSettings);
        if (fsEl) fsEl.addEventListener('change', saveMirrorSettings);
      }
    } catch (err) {
      console.error('[Renderer] Failed to load settings:', err);
    }
  }

  // 5. Dashboard State & ADB Telemetry
  let selectedDeviceSerial = null;

  async function refreshDashboard() {
    if (!window.kmrApi || !window.kmrApi.getDevices) return;

    try {
      const res = await window.kmrApi.getDevices();
      const deviceSelect = document.getElementById('dash-device-select');
      const devices = res.devices || [];

      if (devices.length === 0) {
        selectedDeviceSerial = null;
        if (deviceSelect) deviceSelect.style.display = 'none';
        renderDisconnectedState();
      } else {
        if (!selectedDeviceSerial || !devices.find(d => d.serial === selectedDeviceSerial)) {
          selectedDeviceSerial = devices[0].serial;
        }

        if (devices.length > 1 && deviceSelect) {
          deviceSelect.style.display = 'inline-block';
          deviceSelect.innerHTML = devices.map(d => 
            `<option value="${d.serial}" ${d.serial === selectedDeviceSerial ? 'selected' : ''}>${d.model || d.serial} (${d.state})</option>`
          ).join('');
        } else if (deviceSelect) {
          deviceSelect.style.display = 'none';
        }

        const details = await window.kmrApi.getDeviceInfo(selectedDeviceSerial);
        renderDeviceDetails(details);
      }

      await renderConnectionHistory();
    } catch (err) {
      console.error('[Dashboard] Refresh error:', err);
      renderDisconnectedState();
    }
  }

  function renderDisconnectedState() {
    const titlebarBadge = document.getElementById('titlebar-status-badge');
    const dot = document.getElementById('dash-status-dot');
    const title = document.getElementById('dash-device-title');
    const badge = document.getElementById('dash-status-badge');
    const model = document.getElementById('dash-metric-model');
    const version = document.getElementById('dash-metric-version');
    const ip = document.getElementById('dash-metric-ip');
    const battery = document.getElementById('dash-metric-battery');
    const res = document.getElementById('dash-spec-resolution');
    const density = document.getElementById('dash-spec-density');
    const protocol = document.getElementById('dash-spec-protocol');
    const auth = document.getElementById('dash-spec-auth');
    const footerConn = document.getElementById('footer-connection-status');

    if (titlebarBadge) {
      titlebarBadge.textContent = 'No Device Connected';
      titlebarBadge.className = 'titlebar-badge';
    }
    if (dot) dot.style.backgroundColor = 'var(--status-neutral)';
    if (title) title.textContent = 'No Android Device Connected';
    if (badge) {
      badge.textContent = 'Disconnected';
      badge.className = 'status-pill disconnected';
    }

    if (model) { model.textContent = 'Unavailable'; model.style.color = 'var(--text-muted)'; }
    if (version) { version.textContent = 'Unavailable'; version.style.color = 'var(--text-muted)'; }
    if (ip) { ip.textContent = 'Unavailable'; ip.style.color = 'var(--text-muted)'; }
    if (battery) { battery.textContent = 'Unavailable'; battery.style.color = 'var(--text-muted)'; }
    if (res) { res.textContent = 'Unavailable'; res.style.color = 'var(--text-muted)'; }
    if (density) { density.textContent = 'Unavailable'; density.style.color = 'var(--text-muted)'; }
    if (protocol) { protocol.textContent = 'Disconnected'; protocol.style.color = 'var(--text-muted)'; }
    if (auth) { auth.textContent = 'None'; auth.style.color = 'var(--text-muted)'; }
    if (footerConn) footerConn.textContent = 'No active connection';

    setDashboardActionsEnabled(false);
  }

  function renderDeviceDetails(info) {
    const titlebarBadge = document.getElementById('titlebar-status-badge');
    const dot = document.getElementById('dash-status-dot');
    const title = document.getElementById('dash-device-title');
    const badge = document.getElementById('dash-status-badge');
    const model = document.getElementById('dash-metric-model');
    const version = document.getElementById('dash-metric-version');
    const ip = document.getElementById('dash-metric-ip');
    const battery = document.getElementById('dash-metric-battery');
    const res = document.getElementById('dash-spec-resolution');
    const density = document.getElementById('dash-spec-density');
    const protocol = document.getElementById('dash-spec-protocol');
    const auth = document.getElementById('dash-spec-auth');
    const footerConn = document.getElementById('footer-connection-status');

    if (!info || !info.success) {
      renderDisconnectedState();
      return;
    }

    if (info.state === 'unauthorized') {
      if (dot) dot.style.backgroundColor = 'var(--status-warning)';
      if (title) title.textContent = info.model || info.serial;
      if (badge) {
        badge.textContent = 'Unauthorized';
        badge.className = 'status-pill warning';
      }
      if (titlebarBadge) {
        titlebarBadge.textContent = 'Device Unauthorized';
        titlebarBadge.className = 'titlebar-badge';
      }
      if (model) { model.textContent = info.model || 'Android Device'; model.style.color = 'var(--text-primary)'; }
      if (version) { version.textContent = 'Unavailable (Unauthorized)'; version.style.color = 'var(--status-warning)'; }
      if (ip) { ip.textContent = info.ipAddress || 'Unavailable'; }
      if (battery) { battery.textContent = 'Unavailable'; battery.style.color = 'var(--text-muted)'; }
      if (res) { res.textContent = 'Unavailable'; res.style.color = 'var(--text-muted)'; }
      if (density) { density.textContent = 'Unavailable'; density.style.color = 'var(--text-muted)'; }
      if (protocol) { protocol.textContent = info.isWireless ? 'ADB over TCP/IP (Wireless)' : 'USB'; protocol.style.color = 'var(--text-primary)'; }
      if (auth) { auth.textContent = 'Pending Authorization'; auth.style.color = 'var(--status-warning)'; }
      if (footerConn) footerConn.textContent = `${info.serial} (Unauthorized)`;

      setDashboardActionsEnabled(false);
      return;
    }

    if (dot) dot.style.backgroundColor = 'var(--status-success)';
    if (title) title.textContent = info.model || info.serial;
    if (badge) {
      badge.textContent = 'Connected';
      badge.className = 'status-pill connected';
    }
    if (titlebarBadge) {
      titlebarBadge.textContent = info.model || info.serial;
      titlebarBadge.className = 'titlebar-badge';
    }

    if (model) {
      model.textContent = info.model || 'Android Device';
      model.style.color = 'var(--text-primary)';
    }
    if (version) {
      version.textContent = info.androidVersion ? `${info.androidVersion}${info.apiLevel ? ` (API ${info.apiLevel})` : ''}` : 'Unavailable';
      version.style.color = info.androidVersion ? 'var(--text-primary)' : 'var(--text-muted)';
    }
    if (ip) {
      ip.textContent = info.ipAddress || 'Unavailable';
      ip.style.color = info.ipAddress ? 'var(--text-primary)' : 'var(--text-muted)';
    }
    if (battery) {
      if (info.battery && typeof info.battery.level === 'number') {
        battery.textContent = `${info.battery.level}% (${info.battery.statusText})`;
        battery.style.color = 'var(--text-primary)';
      } else {
        battery.textContent = 'Unavailable';
        battery.style.color = 'var(--text-muted)';
      }
    }
    if (res) {
      res.textContent = info.resolution || 'Unavailable';
      res.style.color = info.resolution ? 'var(--text-primary)' : 'var(--text-muted)';
    }
    if (density) {
      density.textContent = info.density || 'Unavailable';
      density.style.color = info.density ? 'var(--text-primary)' : 'var(--text-muted)';
    }
    if (protocol) {
      protocol.textContent = info.isWireless ? 'ADB over TCP/IP (Wireless)' : 'USB Connection';
      protocol.style.color = 'var(--text-primary)';
    }
    if (auth) {
      auth.textContent = 'Authorized';
      auth.style.color = 'var(--status-success)';
    }
    if (footerConn) {
      footerConn.textContent = `${info.model || info.serial} (${info.isWireless ? 'Wireless' : 'USB'})`;
    }

    setDashboardActionsEnabled(true);
  }

  function setDashboardActionsEnabled(enabled) {
    const mirrorBtn = document.getElementById('dash-btn-mirror');
    const screenshotBtn = document.getElementById('btn-quick-screenshot');
    const recordBtn = document.getElementById('btn-quick-record');
    const fullscreenBtn = document.getElementById('btn-quick-fullscreen');
    const disconnectBtn = document.getElementById('btn-quick-disconnect');

    if (mirrorBtn) mirrorBtn.disabled = !enabled;
    if (screenshotBtn) screenshotBtn.disabled = !enabled;
    if (recordBtn) recordBtn.disabled = !enabled;
    if (fullscreenBtn) fullscreenBtn.disabled = !enabled;
    if (disconnectBtn) disconnectBtn.disabled = !enabled;

    document.querySelectorAll('.btn-control-key').forEach(btn => {
      btn.disabled = !enabled;
    });
  }

  async function renderConnectionHistory() {
    const listEl = document.getElementById('dash-history-list');
    if (!listEl || !window.kmrApi || !window.kmrApi.getHistory) return;

    const history = await window.kmrApi.getHistory();
    if (!history || history.length === 0) {
      listEl.innerHTML = '<div style="font-size: 13px; color: var(--text-muted); font-style: italic; padding: 6px 0;">No connection activity recorded yet.</div>';
      return;
    }

    listEl.innerHTML = history.slice(0, 10).map(entry => {
      const date = new Date(entry.timestamp);
      const timeStr = isNaN(date.getTime()) ? entry.timestamp : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      let badgeClass = 'disconnected';
      if (entry.status === 'CONNECTED' || entry.status === 'PAIRED') badgeClass = 'connected';
      else if (entry.status === 'UNAUTHORIZED' || entry.status === 'WARNING' || entry.status.includes('FAIL')) badgeClass = 'warning';

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background-color: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); font-size: 12.5px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="status-pill ${badgeClass}" style="font-size: 11px; padding: 2px 7px;">${entry.status}</span>
            <span style="font-weight: 500;">${entry.target}</span>
            <span style="color: var(--text-muted);">${entry.details || ''}</span>
          </div>
          <span style="color: var(--text-muted); font-family: monospace;">${timeStr}</span>
        </div>
      `;
    }).join('');
  }

  // Bind Dashboard Refresh & Clear History buttons
  const btnRefresh = document.getElementById('btn-refresh-devices');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => refreshDashboard());
  }

  const btnClearHistory = document.getElementById('btn-clear-history');
  if (btnClearHistory && window.kmrApi && window.kmrApi.clearHistory) {
    btnClearHistory.addEventListener('click', async () => {
      await window.kmrApi.clearHistory();
      await renderConnectionHistory();
    });
  }

  const deviceSelect = document.getElementById('dash-device-select');
  if (deviceSelect) {
    deviceSelect.addEventListener('change', async (e) => {
      selectedDeviceSerial = e.target.value;
      if (selectedDeviceSerial && window.kmrApi && window.kmrApi.getDeviceInfo) {
        const details = await window.kmrApi.getDeviceInfo(selectedDeviceSerial);
        renderDeviceDetails(details);
      }
    });
  }

  // Quick Disconnect
  const btnDisconnect = document.getElementById('btn-quick-disconnect');
  if (btnDisconnect && window.kmrApi && window.kmrApi.disconnectDevice) {
    btnDisconnect.addEventListener('click', async () => {
      await window.kmrApi.disconnectDevice(selectedDeviceSerial);
      selectedDeviceSerial = null;
      await refreshDashboard();
    });
  }

  // ==========================================
  // 6. WIRELESS PAIRING WIZARD (PHASE 1 & PHASE 3)
  // ==========================================
  const wizardTabQr = document.getElementById('wizard-tab-qr');
  const wizardTabPair = document.getElementById('wizard-tab-pair');
  const wizardTabDirect = document.getElementById('wizard-tab-direct');
  const wizardTabTrusted = document.getElementById('wizard-tab-trusted');
  const wizardViewQr = document.getElementById('wizard-view-qr');
  const wizardViewPair = document.getElementById('wizard-view-pair');
  const wizardViewDirect = document.getElementById('wizard-view-direct');
  const wizardViewTrusted = document.getElementById('wizard-view-trusted');

  let activeQrSession = null;

  async function startQrPairingFlow() {
    if (!window.kmrApi || !window.kmrApi.startQrPairing) return;

    const qrContainer = document.getElementById('qr-code-svg-container');
    const statusText = document.getElementById('qr-status-text');
    const statusDot = document.getElementById('qr-status-dot');
    const timerBadge = document.getElementById('qr-timer-badge');
    const serviceNameEl = document.getElementById('qr-service-name');
    const alertEl = document.getElementById('qr-status-alert');

    if (alertEl) alertEl.style.display = 'none';
    if (statusText) statusText.textContent = 'Generating pairing QR code...';
    if (statusDot) {
      statusDot.style.backgroundColor = 'var(--accent-primary)';
      statusDot.className = 'status-dot status-dot-pulse';
    }

    try {
      const res = await window.kmrApi.startQrPairing({ timeoutSeconds: 90 });
      if (!res.success) {
        if (statusText) statusText.textContent = 'Failed to start pairing session';
        return;
      }

      activeQrSession = res;
      if (serviceNameEl) serviceNameEl.textContent = res.serviceName || 'kmr-ready';
      if (timerBadge) {
        timerBadge.textContent = `Expires in: ${res.remainingSeconds || 90}s`;
        timerBadge.className = 'status-pill warning';
      }
      if (statusText) statusText.textContent = 'Waiting for device to scan...';

      // Render QR code using pure JS generator
      if (window.SimpleQrCode && qrContainer && res.qrPayload) {
        const svg = window.SimpleQrCode.toSvg(res.qrPayload, 4);
        qrContainer.innerHTML = svg;
      }
    } catch (err) {
      console.error('[QR] Error starting QR session:', err);
      if (statusText) statusText.textContent = 'Error starting QR session';
    }
  }

  async function cancelQrPairingFlow() {
    if (window.kmrApi && window.kmrApi.cancelQrPairing) {
      await window.kmrApi.cancelQrPairing();
    }
    const statusText = document.getElementById('qr-status-text');
    const statusDot = document.getElementById('qr-status-dot');
    const timerBadge = document.getElementById('qr-timer-badge');
    if (statusText) statusText.textContent = 'Pairing cancelled';
    if (statusDot) {
      statusDot.style.backgroundColor = 'var(--status-neutral)';
      statusDot.className = 'status-dot';
    }
    if (timerBadge) {
      timerBadge.textContent = 'Cancelled';
      timerBadge.className = 'status-pill disconnected';
    }
  }

  // Bind QR Pairing Buttons
  const btnRefreshQr = document.getElementById('btn-refresh-qr');
  if (btnRefreshQr) {
    btnRefreshQr.addEventListener('click', () => startQrPairingFlow());
  }

  const btnCancelQr = document.getElementById('btn-cancel-qr');
  if (btnCancelQr) {
    btnCancelQr.addEventListener('click', () => cancelQrPairingFlow());
  }

  const btnSwitchToPin = document.getElementById('btn-switch-to-pin');
  if (btnSwitchToPin) {
    btnSwitchToPin.addEventListener('click', () => {
      cancelQrPairingFlow();
      setWizardSubtab(wizardTabPair);
    });
  }

  // Listen to live QR pairing updates from main process
  if (window.kmrApi && window.kmrApi.onQrPairingStatusChanged) {
    window.kmrApi.onQrPairingStatusChanged((status) => {
      const statusText = document.getElementById('qr-status-text');
      const statusDot = document.getElementById('qr-status-dot');
      const timerBadge = document.getElementById('qr-timer-badge');
      const alertEl = document.getElementById('qr-status-alert');

      if (!status) return;

      if (status.status === 'waiting_scan') {
        if (statusText) statusText.textContent = 'Waiting for device to scan...';
        if (statusDot) {
          statusDot.style.backgroundColor = 'var(--accent-primary)';
          statusDot.className = 'status-dot status-dot-pulse';
        }
        if (timerBadge && typeof status.remainingSeconds === 'number') {
          timerBadge.textContent = `Expires in: ${status.remainingSeconds}s`;
          timerBadge.className = 'status-pill warning';
        }
      } else if (status.status === 'pairing') {
        if (statusText) statusText.textContent = status.message || 'Device detected! Pairing...';
        if (statusDot) {
          statusDot.style.backgroundColor = 'var(--status-warning)';
          statusDot.className = 'status-dot status-dot-pulse';
        }
      } else if (status.status === 'connecting') {
        if (statusText) statusText.textContent = status.message || 'Connecting to device...';
        if (statusDot) {
          statusDot.style.backgroundColor = 'var(--accent-primary)';
          statusDot.className = 'status-dot status-dot-pulse';
        }
      } else if (status.status === 'connected') {
        if (statusText) statusText.textContent = 'Connected successfully!';
        if (statusDot) {
          statusDot.style.backgroundColor = 'var(--status-success)';
          statusDot.className = 'status-dot';
        }
        if (timerBadge) {
          timerBadge.textContent = 'Connected';
          timerBadge.className = 'status-pill connected';
        }
        if (alertEl) {
          alertEl.style.display = 'block';
          alertEl.style.backgroundColor = 'var(--status-success-bg)';
          alertEl.style.color = 'var(--status-success)';
          alertEl.style.border = '1px solid var(--status-success)';
          alertEl.innerHTML = `<b>Pairing &amp; Connection Successful!</b><br>Device ${status.device ? status.device.serial : ''} is now connected. Opening Dashboard...`;
        }
        setTimeout(() => {
          switchToTab('tab-dashboard');
        }, 1200);
      } else if (status.status === 'timeout') {
        if (statusText) statusText.textContent = 'Session Timed Out';
        if (statusDot) {
          statusDot.style.backgroundColor = 'var(--status-neutral)';
          statusDot.className = 'status-dot';
        }
        if (timerBadge) {
          timerBadge.textContent = 'Timed Out';
          timerBadge.className = 'status-pill disconnected';
        }
        if (alertEl) {
          alertEl.style.display = 'block';
          alertEl.style.backgroundColor = 'var(--status-warning-bg)';
          alertEl.style.color = 'var(--status-warning)';
          alertEl.style.border = '1px solid var(--status-warning)';
          alertEl.innerHTML = `<b>QR Pairing Timed Out:</b><br>${status.message || 'Could not discover phone. Ensure PC and phone are on the same Wi-Fi and AP isolation is off.'}<br><button id="alert-btn-retry" class="btn btn-secondary btn-sm" style="margin-top: 8px;">Retry QR Pairing</button>`;
          const retryBtn = document.getElementById('alert-btn-retry');
          if (retryBtn) retryBtn.addEventListener('click', () => startQrPairingFlow());
        }
      } else if (status.status === 'error') {
        if (statusText) statusText.textContent = 'Pairing Failed';
        if (statusDot) {
          statusDot.style.backgroundColor = 'var(--status-danger)';
          statusDot.className = 'status-dot';
        }
        if (alertEl) {
          alertEl.style.display = 'block';
          alertEl.style.backgroundColor = 'var(--status-danger-bg)';
          alertEl.style.color = 'var(--status-danger)';
          alertEl.style.border = '1px solid var(--status-danger)';
          alertEl.innerHTML = `<b>Pairing Error:</b> ${status.error || status.message || 'An error occurred.'}<br>Make sure the QR scanning camera is active on the phone.`;
        }
      } else if (status.status === 'cancelled') {
        if (statusText) statusText.textContent = 'Pairing Cancelled';
        if (statusDot) {
          statusDot.style.backgroundColor = 'var(--status-neutral)';
          statusDot.className = 'status-dot';
        }
        if (timerBadge) {
          timerBadge.textContent = 'Cancelled';
          timerBadge.className = 'status-pill disconnected';
        }
      }
    });
  }

  function setWizardSubtab(activeTab) {
    [wizardTabQr, wizardTabPair, wizardTabDirect, wizardTabTrusted].forEach(btn => {
      if (!btn) return;
      if (btn === activeTab) {
        btn.className = 'btn btn-primary btn-sm';
      } else {
        btn.className = 'btn btn-secondary btn-sm';
      }
    });

    if (activeTab === wizardTabQr) {
      if (wizardViewQr) wizardViewQr.style.display = 'block';
      if (wizardViewPair) wizardViewPair.style.display = 'none';
      if (wizardViewDirect) wizardViewDirect.style.display = 'none';
      if (wizardViewTrusted) wizardViewTrusted.style.display = 'none';
      startQrPairingFlow();
    } else if (activeTab === wizardTabPair) {
      if (wizardViewQr) wizardViewQr.style.display = 'none';
      if (wizardViewPair) wizardViewPair.style.display = 'block';
      if (wizardViewDirect) wizardViewDirect.style.display = 'none';
      if (wizardViewTrusted) wizardViewTrusted.style.display = 'none';
    } else if (activeTab === wizardTabDirect) {
      if (wizardViewQr) wizardViewQr.style.display = 'none';
      if (wizardViewPair) wizardViewPair.style.display = 'none';
      if (wizardViewDirect) wizardViewDirect.style.display = 'block';
      if (wizardViewTrusted) wizardViewTrusted.style.display = 'none';
    } else if (activeTab === wizardTabTrusted) {
      if (wizardViewQr) wizardViewQr.style.display = 'none';
      if (wizardViewPair) wizardViewPair.style.display = 'none';
      if (wizardViewDirect) wizardViewDirect.style.display = 'none';
      if (wizardViewTrusted) wizardViewTrusted.style.display = 'block';
      renderTrustedDevices();
    }
  }

  if (wizardTabQr) wizardTabQr.addEventListener('click', () => setWizardSubtab(wizardTabQr));
  if (wizardTabPair) wizardTabPair.addEventListener('click', () => setWizardSubtab(wizardTabPair));
  if (wizardTabDirect) wizardTabDirect.addEventListener('click', () => setWizardSubtab(wizardTabDirect));
  if (wizardTabTrusted) wizardTabTrusted.addEventListener('click', () => setWizardSubtab(wizardTabTrusted));

  // Validation Helpers
  function validateIpv4(ip) {
    if (!ip) return 'IP address is required';
    const regex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
    if (!regex.test(ip.trim())) return 'Invalid IPv4 address (e.g. 192.168.1.150)';
    if (ip.trim() === '0.0.0.0' || ip.trim() === '255.255.255.255') return 'Reserved IP address';
    return null;
  }

  function validatePortNum(port) {
    const num = parseInt(port, 10);
    if (isNaN(num) || num < 1024 || num > 65535) return 'Port must be between 1024 and 65535';
    return null;
  }

  function validateCode6(code) {
    if (!code) return '6-digit pairing code is required';
    if (!/^\d{6}$/.test(code.trim())) return 'Pairing code must be exactly 6 digits';
    return null;
  }

  function setInlineError(elementId, errorMsg) {
    const el = document.getElementById(elementId);
    if (el) {
      if (errorMsg) {
        el.textContent = errorMsg;
        el.style.display = 'block';
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    }
  }

  function showStatusAlert(alertElementId, type, message) {
    const el = document.getElementById(alertElementId);
    if (!el) return;
    el.style.display = 'block';
    if (type === 'error') {
      el.style.backgroundColor = 'var(--status-danger-bg)';
      el.style.color = 'var(--status-danger)';
      el.style.border = '1px solid var(--status-danger)';
    } else if (type === 'success') {
      el.style.backgroundColor = 'var(--status-success-bg)';
      el.style.color = 'var(--status-success)';
      el.style.border = '1px solid var(--status-success)';
    } else {
      el.style.backgroundColor = 'var(--status-warning-bg)';
      el.style.color = 'var(--status-warning)';
      el.style.border = '1px solid var(--status-warning)';
    }
    el.innerHTML = message;
  }

  // Execute Pairing Wizard (Stage C & D)
  const btnExecutePairing = document.getElementById('btn-execute-pairing');
  const btnResetPairing = document.getElementById('btn-reset-pairing');
  const pairingSpinner = document.getElementById('pairing-spinner');

  if (btnExecutePairing) {
    btnExecutePairing.addEventListener('click', async () => {
      const ip = document.getElementById('pair-ip').value.trim();
      const code = document.getElementById('pair-code').value.trim();
      const pairPort = document.getElementById('pair-port').value.trim();
      const connectPort = document.getElementById('connect-port').value.trim();
      const alias = document.getElementById('pair-alias').value.trim();
      const remember = document.getElementById('pair-remember').checked;

      // Reset inline errors
      setInlineError('err-pair-ip', null);
      setInlineError('err-pair-code', null);
      setInlineError('err-pair-port', null);
      setInlineError('err-connect-port', null);
      const alertEl = document.getElementById('pair-status-alert');
      if (alertEl) alertEl.style.display = 'none';

      // Validate inputs
      const ipErr = validateIpv4(ip);
      const codeErr = validateCode6(code);
      const pairPortErr = validatePortNum(pairPort);
      const connectPortErr = validatePortNum(connectPort);

      let hasError = false;
      if (ipErr) { setInlineError('err-pair-ip', ipErr); hasError = true; }
      if (codeErr) { setInlineError('err-pair-code', codeErr); hasError = true; }
      if (pairPortErr) { setInlineError('err-pair-port', pairPortErr); hasError = true; }
      if (connectPortErr) { setInlineError('err-connect-port', connectPortErr); hasError = true; }

      if (hasError) return;

      if (pairPort === connectPort) {
        showStatusAlert('pair-status-alert', 'warning', '<b>Notice:</b> Pairing Port and Connection Port are identical. On Android 11+, the pairing code dialog displays a distinct temporary port separate from the main Wireless Debugging connection port.');
      }

      // Start execution
      btnExecutePairing.disabled = true;
      if (pairingSpinner) pairingSpinner.style.display = 'inline';
      showStatusAlert('pair-status-alert', 'warning', `<b>Step 1 of 2:</b> Pairing with phone at ${ip}:${pairPort}... (Keep dialog open on phone)`);

      try {
        // Step 1: Pair
        const pairResult = await window.kmrApi.pairDevice(ip, pairPort, code);

        if (!pairResult.success) {
          showStatusAlert('pair-status-alert', 'error', `<b>Pairing Failed:</b> ${pairResult.error}<br><small style="margin-top: 4px; display: block;">Troubleshooting: Ensure the pairing popup remains visible on the phone and the 6-digit code was entered correctly.</small>`);
          btnExecutePairing.disabled = false;
          if (pairingSpinner) pairingSpinner.style.display = 'none';
          return;
        }

        // Step 2: Connect
        showStatusAlert('pair-status-alert', 'warning', `<b>Step 2 of 2:</b> Pairing successful! Connecting to ADB service at ${ip}:${connectPort}...`);

        const connectResult = await window.kmrApi.connectDevice(ip, connectPort, remember, alias);

        if (!connectResult.success) {
          showStatusAlert('pair-status-alert', 'warning', `<b>Paired, but connection pending:</b> ${connectResult.error}<br><small>Your phone is paired! You can connect to it using the Direct Connect tab.</small>`);
        } else {
          showStatusAlert('pair-status-alert', 'success', `<b>Success!</b> ${connectResult.message}. Redirecting to Dashboard...`);
          // Clear sensitive code immediately from input
          document.getElementById('pair-code').value = '';

          setTimeout(() => {
            switchToTab('tab-dashboard');
          }, 1200);
        }
      } catch (err) {
        showStatusAlert('pair-status-alert', 'error', `Unexpected error: ${err.message}`);
      } finally {
        btnExecutePairing.disabled = false;
        if (pairingSpinner) pairingSpinner.style.display = 'none';
      }
    });
  }

  if (btnResetPairing) {
    btnResetPairing.addEventListener('click', () => {
      document.getElementById('pair-ip').value = '';
      document.getElementById('pair-code').value = '';
      document.getElementById('pair-port').value = '';
      document.getElementById('connect-port').value = '';
      document.getElementById('pair-alias').value = '';
      setInlineError('err-pair-ip', null);
      setInlineError('err-pair-code', null);
      setInlineError('err-pair-port', null);
      setInlineError('err-connect-port', null);
      const alertEl = document.getElementById('pair-status-alert');
      if (alertEl) alertEl.style.display = 'none';
    });
  }

  // Direct Connect Button
  const btnDirectConnect = document.getElementById('btn-execute-direct-connect');
  const btnResetDirect = document.getElementById('btn-reset-direct');

  if (btnDirectConnect) {
    btnDirectConnect.addEventListener('click', async () => {
      const ip = document.getElementById('direct-ip').value.trim();
      const port = document.getElementById('direct-port').value.trim();
      const alias = document.getElementById('direct-alias').value.trim();

      const ipErr = validateIpv4(ip);
      const portErr = validatePortNum(port);

      if (ipErr || portErr) {
        showStatusAlert('direct-status-alert', 'error', ipErr || portErr);
        return;
      }

      btnDirectConnect.disabled = true;
      showStatusAlert('direct-status-alert', 'warning', `Connecting to ${ip}:${port}...`);

      try {
        const res = await window.kmrApi.connectDevice(ip, port, true, alias);
        if (res.success) {
          showStatusAlert('direct-status-alert', 'success', `Connected to ${ip}:${port}! Redirecting to Dashboard...`);
          setTimeout(() => {
            switchToTab('tab-dashboard');
          }, 1000);
        } else {
          showStatusAlert('direct-status-alert', 'error', `Connection failed: ${res.error}`);
        }
      } catch (err) {
        showStatusAlert('direct-status-alert', 'error', err.message);
      } finally {
        btnDirectConnect.disabled = false;
      }
    });
  }

  if (btnResetDirect) {
    btnResetDirect.addEventListener('click', () => {
      document.getElementById('direct-ip').value = '';
      document.getElementById('direct-port').value = '';
      document.getElementById('direct-alias').value = '';
      const alertEl = document.getElementById('direct-status-alert');
      if (alertEl) alertEl.style.display = 'none';
    });
  }

  // Trusted Devices Rendering & Controls
  async function renderTrustedDevices() {
    const listEl = document.getElementById('trusted-devices-list');
    if (!listEl || !window.kmrApi || !window.kmrApi.getTrustedDevices) return;

    const devices = await window.kmrApi.getTrustedDevices();
    if (!devices || devices.length === 0) {
      listEl.innerHTML = '<div style="font-size: 13px; color: var(--text-muted); font-style: italic; padding: 6px 0;">No saved devices found. Use the "Pair New Device" wizard to pair and save your phone.</div>';
      return;
    }

    listEl.innerHTML = devices.map(d => {
      const lastSeenDate = new Date(d.lastSeen);
      const lastSeenStr = isNaN(lastSeenDate.getTime()) ? d.lastSeen : lastSeenDate.toLocaleString();
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background-color: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">${d.alias || d.ip}</div>
            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">${d.ip}:${d.port}</div>
            <div style="font-size: 11px; color: var(--text-muted);">Last connected: ${lastSeenStr}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-sm btn-reconnect-trusted" data-ip="${d.ip}" data-port="${d.port}" data-alias="${d.alias}">
              Connect
            </button>
            <button class="btn btn-secondary btn-sm btn-edit-port-trusted" data-id="${d.id}" data-current="${d.port}" data-alias="${d.alias}">
              Edit Port
            </button>
            <button class="btn btn-danger btn-sm btn-forget-trusted" data-id="${d.id}">
              Forget
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Bind Reconnect buttons
    document.querySelectorAll('.btn-reconnect-trusted').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ip = btn.getAttribute('data-ip');
        const port = btn.getAttribute('data-port');
        const alias = btn.getAttribute('data-alias');
        btn.disabled = true;
        btn.textContent = 'Connecting...';
        try {
          const res = await window.kmrApi.connectDevice(ip, port, true, alias);
          if (res.success) {
            switchToTab('tab-dashboard');
          } else {
            alert(`Failed to connect to ${ip}:${port}: ${res.error}\n\nNote: If the phone reconnected to Wi-Fi, the connection port may have changed in Wireless Debugging settings.`);
          }
        } catch (e) {
          alert(`Error: ${e.message}`);
        } finally {
          btn.disabled = false;
          btn.textContent = 'Connect';
        }
      });
    });

    // Bind Edit Port buttons
    document.querySelectorAll('.btn-edit-port-trusted').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const currentPort = btn.getAttribute('data-current');
        const alias = btn.getAttribute('data-alias');
        const newPort = prompt(`Update Wireless Debugging connection port for "${alias}" (Current: ${currentPort}):`, currentPort);
        if (newPort && newPort.trim() !== currentPort) {
          const num = parseInt(newPort.trim(), 10);
          if (isNaN(num) || num < 1024 || num > 65535) {
            alert('Port must be a valid number between 1024 and 65535.');
            return;
          }
          await window.kmrApi.updateTrustedPort(id, num);
          await renderTrustedDevices();
        }
      });
    });

    // Bind Forget buttons
    document.querySelectorAll('.btn-forget-trusted').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Forget this device from your saved devices?')) {
          await window.kmrApi.removeTrustedDevice(id);
          await renderTrustedDevices();
        }
      });
    });
  }

  const btnRefreshTrusted = document.getElementById('btn-refresh-trusted');
  if (btnRefreshTrusted) {
    btnRefreshTrusted.addEventListener('click', () => renderTrustedDevices());
  }

  // ==========================================
  // 7. KMR CONTROL MIRRORING & MEDIA (PHASE 4)
  // ==========================================
  let isCurrentlyMirroring = false;
  let isCurrentlyRecording = false;

  const mirrorBtn = document.getElementById('dash-btn-mirror');
  const screenshotBtn = document.getElementById('btn-quick-screenshot');
  const recordBtn = document.getElementById('btn-quick-record');
  const fullscreenBtn = document.getElementById('btn-quick-fullscreen');

  // Mirror Button toggle
  if (mirrorBtn && window.kmrApi) {
    mirrorBtn.addEventListener('click', async () => {
      if (!selectedDeviceSerial) return;

      if (!isCurrentlyMirroring) {
        mirrorBtn.disabled = true;
        mirrorBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Launching...';

        const res = await window.kmrApi.startMirroring({ serial: selectedDeviceSerial });
        mirrorBtn.disabled = false;

        if (res.success) {
          isCurrentlyMirroring = true;
          mirrorBtn.className = 'btn btn-danger btn-sm';
          mirrorBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"/></svg> Stop Mirroring';
        } else {
          isCurrentlyMirroring = false;
          mirrorBtn.className = 'btn btn-primary btn-sm';
          mirrorBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Mirroring';
          alert(`Failed to launch display mirroring: ${res.error}`);
        }
      } else {
        await window.kmrApi.stopMirroring();
        isCurrentlyMirroring = false;
        mirrorBtn.className = 'btn btn-primary btn-sm';
        mirrorBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Mirroring';
      }
    });
  }

  // Fullscreen mirror
  if (fullscreenBtn && window.kmrApi) {
    fullscreenBtn.addEventListener('click', async () => {
      if (!selectedDeviceSerial) return;
      await window.kmrApi.startMirroring({ serial: selectedDeviceSerial, fullscreen: true });
    });
  }

  // Listen for background display engine status changes (e.g. user closed mirror window or device disconnected)
  if (window.kmrApi && window.kmrApi.onMirroringStatusChanged) {
    window.kmrApi.onMirroringStatusChanged((status) => {
      if (!status.active) {
        isCurrentlyMirroring = false;
        if (mirrorBtn) {
          mirrorBtn.className = 'btn btn-primary btn-sm';
          mirrorBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Mirroring';
        }
        if (status.code === 2) {
          // Device disconnected while mirroring
          refreshDashboard();
        }
      }
    });
  }

  // Quick Screenshot
  if (screenshotBtn && window.kmrApi) {
    screenshotBtn.addEventListener('click', async () => {
      if (!selectedDeviceSerial) return;
      screenshotBtn.disabled = true;
      const originalText = screenshotBtn.innerHTML;
      screenshotBtn.innerHTML = 'Capturing...';

      try {
        const res = await window.kmrApi.takeScreenshot(selectedDeviceSerial);
        if (res.success) {
          alert(`Screenshot saved successfully:\n${res.filePath}`);
          await renderMediaLibrary();
        } else {
          alert(`Screenshot failed: ${res.error}`);
        }
      } catch (e) {
        alert(`Screenshot error: ${e.message}`);
      } finally {
        screenshotBtn.disabled = false;
        screenshotBtn.innerHTML = originalText;
      }
    });
  }

  // Quick Recording
  if (recordBtn && window.kmrApi) {
    recordBtn.addEventListener('click', async () => {
      if (!selectedDeviceSerial) return;

      if (!isCurrentlyRecording) {
        recordBtn.disabled = true;
        const res = await window.kmrApi.startRecording({ serial: selectedDeviceSerial });
        recordBtn.disabled = false;

        if (res.success) {
          isCurrentlyRecording = true;
          recordBtn.className = 'btn btn-danger';
          recordBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"/></svg> Stop Recording';
        } else {
          alert(`Failed to start screen recording: ${res.error}`);
        }
      } else {
        const res = await window.kmrApi.stopRecording();
        isCurrentlyRecording = false;
        recordBtn.className = 'btn btn-secondary';
        recordBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg> Record Screen';

        if (res.success && res.filePath) {
          alert(`Recording saved successfully:\n${res.filePath}`);
          await renderMediaLibrary();
        }
      }
    });
  }

  if (window.kmrApi && window.kmrApi.onRecordingStatusChanged) {
    window.kmrApi.onRecordingStatusChanged((status) => {
      if (!status.active) {
        isCurrentlyRecording = false;
        if (recordBtn) {
          recordBtn.className = 'btn btn-secondary';
          recordBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg> Record Screen';
        }
      }
    });
  }

  // Device Remote Control Buttons
  document.querySelectorAll('.btn-control-key').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!selectedDeviceSerial || !window.kmrApi) return;
      const keycode = btn.getAttribute('data-key');
      await window.kmrApi.sendKeyEvent(selectedDeviceSerial, keycode);
    });
  });

  // Media Library Rendering
  async function renderMediaLibrary() {
    const listEl = document.getElementById('media-library-list');
    if (!listEl || !window.kmrApi || !window.kmrApi.getMediaList) return;

    const items = await window.kmrApi.getMediaList();
    if (!items || items.length === 0) {
      listEl.innerHTML = '<div style="font-size: 13px; color: var(--text-muted); font-style: italic; padding: 6px 0;">No media captures found. Take a screenshot or record a video using Quick Actions.</div>';
      return;
    }

    listEl.innerHTML = items.map(item => {
      const date = new Date(item.mtime);
      const timeStr = isNaN(date.getTime()) ? item.mtime : date.toLocaleString();
      const sizeKb = Math.round(item.size / 1024);
      const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
      const isVideo = item.type === 'recording';

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background-color: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="padding: 6px; border-radius: var(--radius-sm); background-color: ${isVideo ? 'var(--status-danger-bg)' : 'var(--status-success-bg)'}; color: ${isVideo ? 'var(--status-danger)' : 'var(--status-success)'};">
              ${isVideo 
                ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>'
                : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
              }
            </div>
            <div>
              <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${item.name}</div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${sizeStr} • Captured ${timeStr}</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm btn-open-media-file" data-path="${item.path}">
            Open File
          </button>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.btn-open-media-file').forEach(btn => {
      btn.addEventListener('click', () => {
        const filePath = btn.getAttribute('data-path');
        if (filePath && window.kmrApi) {
          window.kmrApi.openMediaFolder(filePath.endsWith('.mp4') ? 'video' : 'screenshot');
        }
      });
    });
  }

  const btnOpenScreenshots = document.getElementById('btn-open-screenshots-folder');
  const btnOpenRecordings = document.getElementById('btn-open-recordings-folder');
  const btnRefreshMedia = document.getElementById('btn-refresh-media');

  if (btnOpenScreenshots && window.kmrApi) {
    btnOpenScreenshots.addEventListener('click', () => window.kmrApi.openMediaFolder('screenshot'));
  }
  if (btnOpenRecordings && window.kmrApi) {
    btnOpenRecordings.addEventListener('click', () => window.kmrApi.openMediaFolder('video'));
  }
  if (btnRefreshMedia) {
    btnRefreshMedia.addEventListener('click', () => renderMediaLibrary());
  }

  // ==========================================
  // 8. DIAGNOSTICS & REDACTED LOGGING (PHASE 5)
  // ==========================================
  async function renderDiagnosticsLogs(filter = '') {
    const box = document.getElementById('diagnostics-log-box');
    if (!box || !window.kmrApi || !window.kmrApi.getDiagnostics) return;

    const logs = await window.kmrApi.getDiagnostics(filter);
    if (!logs || logs.length === 0) {
      box.innerHTML = '<div style="color: var(--text-muted); font-style: italic;">No diagnostic logs matching criteria.</div>';
      return;
    }

    box.innerHTML = logs.map(l => {
      const time = new Date(l.timestamp).toLocaleTimeString([], { hour12: false });
      let badgeStyle = 'color: #38bdf8; background: rgba(56, 189, 248, 0.1);';
      if (l.level === 'WARN') badgeStyle = 'color: #f59e0b; background: rgba(245, 158, 11, 0.1);';
      if (l.level === 'ERROR') badgeStyle = 'color: #ef4444; background: rgba(239, 68, 68, 0.1);';

      return `
        <div style="display: flex; gap: 8px; align-items: flex-start; padding: 2px 0;">
          <span style="color: var(--text-muted); font-size: 11px;">[${time}]</span>
          <span style="padding: 1px 5px; border-radius: 3px; font-weight: 600; font-size: 10px; ${badgeStyle}">[${l.level}]</span>
          <span style="color: var(--text-secondary); font-size: 11px;">[${l.tag}]</span>
          <span style="color: var(--text-primary); flex: 1; word-break: break-all;">${l.message}</span>
        </div>
      `;
    }).join('');

    box.scrollTop = box.scrollHeight;
  }

  const diagSearchInput = document.getElementById('diag-search-input');
  if (diagSearchInput) {
    diagSearchInput.addEventListener('input', (e) => {
      renderDiagnosticsLogs(e.target.value);
    });
  }

  const btnRefreshDiag = document.getElementById('btn-refresh-diag');
  if (btnRefreshDiag) {
    btnRefreshDiag.addEventListener('click', () => {
      const searchVal = diagSearchInput ? diagSearchInput.value : '';
      renderDiagnosticsLogs(searchVal);
    });
  }

  const btnCopyDiag = document.getElementById('btn-copy-diagnostics');
  if (btnCopyDiag && window.kmrApi && window.kmrApi.getDiagnostics) {
    btnCopyDiag.addEventListener('click', async () => {
      const logs = await window.kmrApi.getDiagnostics();
      if (!logs || logs.length === 0) {
        alert('No logs to copy.');
        return;
      }
      const text = logs.map(l => `[${l.timestamp}] [${l.level}] [${l.tag}] ${l.message}`).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        const originalText = btnCopyDiag.textContent;
        btnCopyDiag.textContent = 'Copied to Clipboard!';
        setTimeout(() => btnCopyDiag.textContent = originalText, 1800);
      } catch (err) {
        alert(`Failed to copy: ${err.message}`);
      }
    });
  }

  const btnExportReport = document.getElementById('btn-export-report');
  if (btnExportReport && window.kmrApi && window.kmrApi.getDiagnosticsReport) {
    btnExportReport.addEventListener('click', async () => {
      const report = await window.kmrApi.getDiagnosticsReport();
      try {
        await navigator.clipboard.writeText(report);
        alert('System Diagnostic Report copied to clipboard!\n\nYou can paste it directly for troubleshooting.');
      } catch (e) {
        alert(report);
      }
    });
  }

  const btnClearDiag = document.getElementById('btn-clear-diagnostics');
  if (btnClearDiag && window.kmrApi && window.kmrApi.clearLogs) {
    btnClearDiag.addEventListener('click', async () => {
      if (confirm('Clear all local diagnostic logs?')) {
        await window.kmrApi.clearLogs();
        await renderDiagnosticsLogs();
      }
    });
  }

  // Initial load
  await refreshDashboard();
});
