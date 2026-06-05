'use strict';

// ─── DESKTOP INTEGRATION ─────────────────────────────────────
// This file wires Electron APIs into the existing app.
// It runs AFTER main.js and ping.js, so all existing functions
// are already defined when this executes.

const IS_ELECTRON = typeof window !== 'undefined' && !!window.aegis;

// ─── TITLE BAR ───────────────────────────────────────────────
(function initTitleBar() {
  if (!IS_ELECTRON) {
    // Hide title bar in browser; it only makes sense in Electron
    const tb = document.getElementById('title-bar');
    if (tb) tb.style.display = 'none';
    return;
  }

  document.body.classList.add('has-titlebar');

  if (window.aegisPlatform === 'darwin') {
    document.body.classList.add('macos');
  }

  // Keep title bar page name in sync with sidebar navigation
  const origNavHandler = window._navHandler;
  const titleBarPage = document.getElementById('title-bar-page');

  function syncTitleBar(pageKey) {
    const titles = {
      dashboard: 'Security Dashboard',
      'network-intelligence': 'Network Intelligence',
      password: 'Password Health',
      ip: 'IP Investigator',
      cve: 'CVE Threat Feed',
      briefing: 'AI Briefing',
      news: 'Security News',
      network: 'Network Monitor',
      'security-toolkit': 'Security Toolkit',
      'network-toolkit': 'Network Toolkit',
      settings: 'Settings'
    };
    if (titleBarPage) titleBarPage.textContent = titles[pageKey] || pageKey;
  }

  // Listen for maximize/restore to update button icon
  window.aegis.onWindowMaximized((isMax) => {
    const btn = document.getElementById('tb-max-btn');
    if (btn) btn.innerHTML = isMax ? '&#10064;' : '&#9633;';
  });
})();

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────
document.addEventListener('keydown', function(e) {
  const ctrl = e.ctrlKey || e.metaKey;

  if (ctrl && !e.shiftKey) {
    const pageMap = { '1': 'dashboard', '2': 'network-intelligence', '3': 'password', '4': 'ip', '5': 'cve', '6': 'briefing', '7': 'news', '8': 'network', '9': 'security-toolkit', '0': 'network-toolkit' };
    if (pageMap[e.key]) {
      e.preventDefault();
      navigateTo(pageMap[e.key]);
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      refreshCurrentPage();
      return;
    }
    if (e.key === 'q' || e.key === 'Q') {
      e.preventDefault();
      if (IS_ELECTRON) window.aegis.hide();
      return;
    }
  }

  if (ctrl && e.shiftKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    navigateTo('network');
    setTimeout(runNetworkScan, 200);
  }
});

function refreshCurrentPage() {
  const active = document.querySelector('.nav-item.active');
  if (!active) return;
  const page = active.dataset.page;
  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'cve': loadCVEFeed(); break;
    case 'news': loadSecurityNews(); break;
    case 'network': runNetworkScan(); break;
  }
}

// ─── OFFLINE DETECTION ────────────────────────────────────────
const offlineBanner = document.getElementById('offline-banner');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

function setOnlineStatus(online) {
  if (offlineBanner) offlineBanner.style.display = online ? 'none' : 'block';
  if (statusDot) {
    statusDot.style.background = online ? 'var(--success)' : '#ef4444';
    statusDot.style.boxShadow = online ? '0 0 10px var(--success)' : '0 0 10px #ef4444';
  }
  if (statusText) {
    statusText.textContent = online ? 'SYSTEM ONLINE' : 'OFFLINE';
    statusText.style.color = online ? 'var(--success)' : '#ef4444';
  }
}

// Browser online/offline events (works in both Electron and browser)
window.addEventListener('online', () => setOnlineStatus(true));
window.addEventListener('offline', () => setOnlineStatus(false));
setOnlineStatus(navigator.onLine);

// Also listen to Electron main process connectivity events
if (IS_ELECTRON) {
  window.aegis.onConnectivityChange((online) => setOnlineStatus(online));
}

// ─── INCIDENT LOG ────────────────────────────────────────────
async function loadIncidentLog() {
  const container = document.getElementById('incident-log-content');
  if (!container) return;

  if (!IS_ELECTRON) {
    container.innerHTML = '<p class="placeholder-text" style="font-size:12px;">Incident log is available in the desktop app.</p>';
    return;
  }

  const incidents = await window.aegis.getIncidents(100);

  if (!incidents || incidents.length === 0) {
    container.innerHTML = '<p class="placeholder-text">No incidents recorded yet. Incidents are logged automatically by background monitoring.</p>';
    return;
  }

  const severityColors = { INFO: '#64748b', WARNING: '#f59e0b', CRITICAL: '#ef4444' };
  const typeLabels = {
    IP_CHANGE: 'IP CHANGE',
    VPN_DROP: 'VPN DROP',
    LATENCY_SPIKE: 'LATENCY',
    DNS_CHANGE: 'DNS',
    WEBRTC_LEAK: 'WEBRTC',
    SCAN_COMPLETE: 'SCAN',
    MANUAL: 'MANUAL'
  };

  container.innerHTML = incidents.map(function(inc) {
    const color = severityColors[inc.severity] || '#64748b';
    const label = typeLabels[inc.type] || inc.type;
    const dt = new Date(inc.timestamp);
    const timeStr = dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return '<div class="incident-item">' +
      '<span class="incident-badge" style="background:' + color + '22; border:1px solid ' + color + '; color:' + color + ';">' + label + '</span>' +
      '<span class="incident-time">' + timeStr + '</span>' +
      '<span class="incident-desc">' + inc.description + '</span>' +
      '</div>';
  }).join('');
}

async function clearIncidentLog() {
  if (!IS_ELECTRON) return;
  if (!confirm('Clear all incident records?')) return;
  await window.aegis.clearIncidents();
  loadIncidentLog();
}

async function exportIncidents() {
  if (!IS_ELECTRON) return;
  const incidents = await window.aegis.exportIncidents();
  const json = JSON.stringify(incidents, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aegis-incidents-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── SETTINGS PAGE ───────────────────────────────────────────
let currentSettings = {};

async function loadSettings() {
  if (!IS_ELECTRON) {
    // Use localStorage as fallback in browser
    currentSettings = {
      autoLaunch: false,
      monitorInterval: 5,
      notifications: { ipChange: true, vpnDrop: true, criticalCVE: true, anomaly: true },
      sounds: { ui: true, alert: true, briefing: true },
      socPreset: 'single',
      startupPreset: false
    };
  } else {
    currentSettings = await window.aegis.getAllSettings();
  }

  const el = (id) => document.getElementById(id);

  if (el('setting-autolaunch')) el('setting-autolaunch').checked = !!currentSettings.autoLaunch;
  if (el('setting-interval')) el('setting-interval').value = currentSettings.monitorInterval || 5;

  const notifs = currentSettings.notifications || {};
  if (el('setting-notif-ip')) el('setting-notif-ip').checked = notifs.ipChange !== false;
  if (el('setting-notif-vpn')) el('setting-notif-vpn').checked = notifs.vpnDrop !== false;
  if (el('setting-notif-cve')) el('setting-notif-cve').checked = notifs.criticalCVE !== false;
  if (el('setting-notif-anomaly')) el('setting-notif-anomaly').checked = notifs.anomaly !== false;

  if (typeof updateSocPresetButtons === 'function') {
    updateSocPresetButtons(currentSettings.socPreset || 'single');
  }
  if (el('setting-startup-preset')) {
    el('setting-startup-preset').checked = !!currentSettings.startupPreset;
  }

  // About section
  if (IS_ELECTRON) {
    const version = await window.aegis.getVersion();
    if (el('about-version')) el('about-version').textContent = version + ' — Stable Release';
    let platformName = navigator.platform || '';
    if (/Win/i.test(platformName)) platformName = 'Windows';
    else if (/Mac/i.test(platformName)) platformName = 'macOS';
    else platformName = 'Linux';
    if (el('about-platform')) el('about-platform').textContent = platformName + ' (Desktop)';
    if (el('about-builddate')) el('about-builddate').textContent = '2026-05-28';
    if (el('splash-version')) el('splash-version').textContent = 'v' + version + ' · AEGIS PLATFORM · 2026';
  }

  await loadStorageInfo();
}

async function loadStorageInfo() {
  const container = document.getElementById('storage-info');
  if (!container) return;

  if (!IS_ELECTRON) {
    container.innerHTML = 'Storage info available in desktop app.';
    return;
  }

  const info = await window.aegis.getStorageInfo();
  container.innerHTML =
    'IP SEARCH HISTORY: <span style="color:var(--text-primary);">' + info.ipHistory + ' entries</span><br>' +
    'NETWORK SCANS: <span style="color:var(--text-primary);">' + info.scans + ' scans (last 30 days)</span><br>' +
    'AI BRIEFINGS: <span style="color:var(--text-primary);">' + info.briefings + ' saved</span><br>' +
    'INCIDENT LOG: <span style="color:var(--text-primary);">' + info.incidents + ' events</span>';
}

function saveSetting(key, value) {
  currentSettings[key] = value;
  if (IS_ELECTRON) {
    window.aegis.setSetting(key, value);
  } else {
    localStorage.setItem('aegis_' + key, JSON.stringify(value));
  }
}


function saveNotifSetting(key, value) {
  if (!currentSettings.notifications) currentSettings.notifications = {};
  currentSettings.notifications[key] = value;
  if (IS_ELECTRON) {
    window.aegis.setSetting('notifications.' + key, value);
  }
}

function saveStartupPresetSetting(enabled) {
  currentSettings.startupPreset = !!enabled;
  saveSetting('startupPreset', !!enabled);
  const confirm = document.getElementById('startup-preset-confirm');
  if (!confirm) return;
  if (enabled) {
    const names = { single: 'SINGLE MONITOR', dual: 'DUAL MONITOR', triple: 'TRIPLE MONITOR' };
    const preset = currentSettings.socPreset || 'single';
    confirm.innerHTML = '&#10003; Aegis will launch in ' + (names[preset] || preset.toUpperCase()) + ' mode on next start';
    confirm.style.display = 'block';
  } else {
    confirm.style.display = 'none';
  }
}

async function clearAllData() {
  if (!confirm('This will clear ALL stored data including IP history, scan logs, and briefings. This cannot be undone. Continue?')) return;
  if (IS_ELECTRON) {
    await window.aegis.clearAllData();
    await loadStorageInfo();
    alert('All data cleared.');
  }
}

async function exportAllData() {
  if (!IS_ELECTRON) return;
  const incidents = await window.aegis.exportIncidents();
  const info = await window.aegis.getStorageInfo();
  const exportData = {
    exportDate: new Date().toISOString(),
    storageInfo: info,
    incidents: incidents
  };
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aegis-export-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PERSISTENT IP HISTORY (survives restarts) ────────────────
// Override the in-memory addToHistory from main.js with one
// that also persists to Electron store when available.
const _origAddToHistory = window.addToHistory || function() {};

async function persistIPHistoryEntry(query, threat, color) {
  if (IS_ELECTRON) {
    await window.aegis.addIPHistory({ query, threat, color });
  }
}

// Load persisted IP history on startup
async function loadPersistedIPHistory() {
  if (!IS_ELECTRON) return;
  const saved = await window.aegis.getIPHistory();
  if (saved && saved.length > 0) {
    // ipSearchHistory is declared in main.js; inject saved entries
    if (typeof ipSearchHistory !== 'undefined') {
      saved.forEach(function(h) {
        if (!ipSearchHistory.find(function(e) { return e.query === h.query; })) {
          ipSearchHistory.push({ query: h.query, threat: h.threat, color: h.color });
        }
      });
      renderIPHistory();
    }
  }
}

// ─── PERSISTENT BRIEFING HISTORY ─────────────────────────────
async function loadPersistedBriefings() {
  if (!IS_ELECTRON) return;
  const saved = await window.aegis.getBriefings();
  if (saved && saved.length > 0 && typeof briefingHistory !== 'undefined') {
    saved.forEach(function(b) { if (!briefingHistory.find(function(e) { return e.timestamp === b.timestamp; })) briefingHistory.push(b); });
    renderBriefingHistory();
  }
}

// ─── INCIDENT LISTENER (from background monitor) ─────────────
if (IS_ELECTRON) {
  window.aegis.onIncident(function(incident) {
    // Refresh incident log if on network page
    const activePage = document.querySelector('.nav-item.active');
    if (activePage && activePage.dataset.page === 'network') {
      loadIncidentLog();
    }
  });

  // Handle navigation commands from tray
  window.aegis.onNavigateTo(function(page) {
    navigateTo(page);
  });

  // Handle scan trigger from tray
  window.aegis.onTriggerScan(function() {
    navigateTo('network');
    setTimeout(runNetworkScan, 200);
  });
}

// ─── PATCH navigateTo to sync title bar ──────────────────────
// Wrap the existing navigateTo function to also update title bar
const _origNavigateTo = window.navigateTo;
window.navigateTo = function(page) {
  _origNavigateTo(page);
  const titleBarPage = document.getElementById('title-bar-page');
  if (titleBarPage) {
    const titles = {
      dashboard: 'Security Dashboard', 'network-intelligence': 'Network Intelligence',
      password: 'Password Health', ip: 'IP Investigator', cve: 'CVE Threat Feed',
      briefing: 'AI Briefing', news: 'Security News', network: 'Network Monitor',
      'security-toolkit': 'Security Toolkit', 'network-toolkit': 'Network Toolkit', settings: 'Settings'
    };
    titleBarPage.textContent = titles[page] || page;
  }
  if (page === 'settings') { loadSettings(); loadStorageInfo(); }
  if (page === 'network') { setTimeout(loadIncidentLog, 500); }
  if (page === 'network-intelligence') { setTimeout(function() { if (typeof initNetworkIntelligence === 'function') initNetworkIntelligence(); }, 100); }
  if (page === 'security-toolkit') { setTimeout(function() { if (typeof initSecurityToolkit === 'function') initSecurityToolkit(); }, 150); }
  if (page === 'network-toolkit') { setTimeout(function() { if (typeof initNetworkToolkit === 'function') initNetworkToolkit(); }, 150); }
};

// ─── PATCH network scan to also persist to DB ────────────────
const _origRunNetworkScan = window.runNetworkScan;
window.runNetworkScan = async function() {
  await _origRunNetworkScan();
  if (IS_ELECTRON) {
    const scanEntry = {
      timestamp: new Date().toISOString(),
      type: 'MANUAL_SCAN'
    };
    window.aegis.addNetworkScan(scanEntry);
    window.aegis.logIncident('SCAN_COMPLETE', 'Manual network scan completed', 'INFO');
  }
};

// ─── PATCH IP search to persist history ──────────────────────
const _origAddToHistoryFn = window.addToHistory;
window.addToHistory = function(query, threat, color) {
  if (typeof _origAddToHistoryFn === 'function') {
    _origAddToHistoryFn(query, threat, color);
  }
  persistIPHistoryEntry(query, threat, color);
};

// ─── PATCH briefing to persist ────────────────────────────────
// We hook into renderBriefingHistory to auto-save after generate
const _origRenderBriefingHistory = window.renderBriefingHistory;
window.renderBriefingHistory = function() {
  if (typeof _origRenderBriefingHistory === 'function') {
    _origRenderBriefingHistory();
  }
  // Persist the latest briefing
  if (IS_ELECTRON && typeof briefingHistory !== 'undefined' && briefingHistory.length > 0) {
    window.aegis.addBriefing(briefingHistory[0]);
  }
};

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Nothing needed here — init happens via splash screen callbacks
});

// Called after splash screen completes (we hook into loadDashboard)
const _origLoadDashboard = window.loadDashboard;
window.loadDashboard = async function() {
  // Populate currentSettings before UI code runs (notifications, SOC preset, etc.).
  await loadSettings();
  if (typeof _origLoadDashboard === 'function') {
    await _origLoadDashboard();
  }
  // On first dashboard load, restore persisted data
  await loadPersistedIPHistory();
  await loadPersistedBriefings();
  // Show post-update banner exactly once after a successful update
  if (IS_ELECTRON) {
    try {
      const justUpdated = await window.aegis.getSetting('justUpdated');
      if (justUpdated) {
        await window.aegis.setSetting('justUpdated', false);
        showUpdateSuccessBanner();
      }
    } catch (_) {}
  }
};

// Patch nav item clicks to sync title bar
document.querySelectorAll('.nav-item').forEach(function(item) {
  item.addEventListener('click', function() {
    const page = item.dataset.page;
    const titleBarPage = document.getElementById('title-bar-page');
    if (titleBarPage) {
      const titles = {
        dashboard: 'Security Dashboard', 'network-intelligence': 'Network Intelligence',
        password: 'Password Health', ip: 'IP Investigator', cve: 'CVE Threat Feed',
        briefing: 'AI Briefing', news: 'Security News', network: 'Network Monitor',
        'security-toolkit': 'Security Toolkit', 'network-toolkit': 'Network Toolkit', settings: 'Settings'
      };
      titleBarPage.textContent = titles[page] || page;
    }
    if (page === 'settings') setTimeout(function() { loadSettings(); loadStorageInfo(); }, 100);
    if (page === 'network') setTimeout(loadIncidentLog, 600);
    if (page === 'network-intelligence') setTimeout(function() { if (typeof initNetworkIntelligence === 'function') initNetworkIntelligence(); }, 100);
    if (page === 'security-toolkit') setTimeout(function() { if (typeof initSecurityToolkit === 'function') initSecurityToolkit(); }, 150);
    if (page === 'network-toolkit') setTimeout(function() { if (typeof initNetworkToolkit === 'function') initNetworkToolkit(); }, 150);
  });
});

// ─── AUTO-UPDATER UI ──────────────────────────────────────────
function showUpdateSuccessBanner() {
  const banner = document.createElement('div');
  banner.id = 'update-success-banner';
  banner.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:8999;' +
    'background:#065f46;border-bottom:1px solid #10b981;' +
    "color:#d1fae5;font-family:'IBM Plex Mono',monospace;" +
    'font-size:12px;letter-spacing:2px;text-align:center;' +
    'padding:8px;font-weight:bold;transition:opacity 0.6s ease;';
  banner.innerHTML = '&#10003; AEGIS UPDATED SUCCESSFULLY';
  document.body.appendChild(banner);
  setTimeout(function() {
    banner.style.opacity = '0';
    setTimeout(function() { if (banner.parentNode) banner.remove(); }, 600);
  }, 5000);
}

function showUpdateBanner(version) {
  const banner = document.getElementById('update-banner');
  const versionEl = document.getElementById('update-version');
  if (!banner) return;
  if (versionEl) versionEl.textContent = 'Aegis v' + version;
  banner.style.display = 'flex';
}

function dismissUpdateBanner() {
  const banner = document.getElementById('update-banner');
  if (banner) banner.style.display = 'none';
}

async function updateNow() {
  if (!IS_ELECTRON || !window.aegis.installUpdate) return;
  const btn = document.querySelector('#update-banner button');
  if (btn) btn.textContent = 'DOWNLOADING...';
  // Set flag before install so it survives the restart
  await window.aegis.setSetting('justUpdated', true);
  window.aegis.installUpdate();
}

// Tracks the 10-second no-response timeout for a manual update check
let _updateCheckTimer = null;

function _clearUpdateCheckTimer() {
  if (_updateCheckTimer) { clearTimeout(_updateCheckTimer); _updateCheckTimer = null; }
}

async function checkForUpdatesManual() {
  if (!IS_ELECTRON) return;
  const btn = document.getElementById('check-updates-btn');
  const statusEl = document.getElementById('about-update-status');

  _clearUpdateCheckTimer();

  // Checking state
  if (btn) { btn.innerHTML = 'CHECKING...'; btn.disabled = true; btn.style.color = ''; }
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--text-dim);">Checking for updates...</span>';

  // Arm timeout BEFORE the async call so it fires even if checkForUpdates() hangs
  _updateCheckTimer = setTimeout(function() {
    _updateCheckTimer = null;
    const s = document.getElementById('about-update-status');
    if (s) s.innerHTML = '<span style="color:#ef4444;">Unable to check for updates. Try again later.</span>';
    const b = document.getElementById('check-updates-btn');
    if (b) {
      b.disabled = false; b.style.color = '#ef4444'; b.innerHTML = 'CHECK FAILED — TRY AGAIN';
      setTimeout(function() { b.textContent = 'CHECK FOR UPDATES'; b.style.color = ''; }, 3000);
    }
  }, 10000);

  const result = await window.aegis.checkForUpdates();

  // Dev build — immediate result, no IPC events will fire
  if (result && result.dev) {
    _clearUpdateCheckTimer();
    if (statusEl) statusEl.innerHTML = '<span style="color:#64748b;">Running in dev mode — updates disabled</span>';
    if (btn) { btn.textContent = 'CHECK FOR UPDATES'; btn.disabled = false; btn.style.color = ''; }
  }
  // Non-dev: timeout above covers no-response; onUpdateAvailable/onUpdateNotAvailable cover success
}

if (IS_ELECTRON && window.aegis.onUpdateAvailable) {
  window.aegis.onUpdateAvailable(function(version) {
    _clearUpdateCheckTimer();
    showUpdateBanner(version);
    const statusEl = document.getElementById('about-update-status');
    if (statusEl) statusEl.innerHTML = '<span style="color:#f59e0b;">&#8635; Update available: v' + version + ' — <a onclick="showUpdateBanner(\'' + version + '\')" style="color:#f59e0b;cursor:pointer;text-decoration:underline;">Show banner</a></span>';
    const btn = document.getElementById('check-updates-btn');
    if (btn && btn.disabled) { btn.disabled = false; btn.style.color = '#f59e0b'; btn.innerHTML = 'UPDATE AVAILABLE'; }
  });
}

if (IS_ELECTRON && window.aegis.onUpdateNotAvailable) {
  window.aegis.onUpdateNotAvailable(function() {
    _clearUpdateCheckTimer();
    const statusEl = document.getElementById('about-update-status');
    if (statusEl) statusEl.innerHTML = '<span style="color:#10b981;">&#10003; Up to date</span>';
    const btn = document.getElementById('check-updates-btn');
    if (btn) {
      btn.disabled = false; btn.style.color = '#10b981'; btn.innerHTML = '&#10003; UP TO DATE';
      setTimeout(function() { btn.textContent = 'CHECK FOR UPDATES'; btn.style.color = ''; }, 3000);
    }
  });
}

if (IS_ELECTRON && window.aegis.onUpdateError) {
  window.aegis.onUpdateError(function() {
    _clearUpdateCheckTimer();
    const btn = document.getElementById('check-updates-btn');
    if (btn && btn.disabled) {
      const statusEl = document.getElementById('about-update-status');
      if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Unable to check for updates. Try again later.</span>';
      btn.disabled = false; btn.style.color = '#ef4444'; btn.innerHTML = 'CHECK FAILED &#8212; TRY AGAIN';
      setTimeout(function() { btn.textContent = 'CHECK FOR UPDATES'; btn.style.color = ''; }, 3000);
    }
  });
}

console.log('Aegis Desktop Integration loaded. Electron:', IS_ELECTRON);
