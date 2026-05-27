'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog, Notification } = require('electron');
const path = require('path');
const Store = require('electron-store');

// ─── CONSTANTS ───────────────────────────────────────────────
const IS_DEV = process.argv.includes('--dev');
const ICON_PATH = path.join(__dirname, '..', 'assets');

// ─── STORE (persistent settings) ─────────────────────────────
const store = new Store({
  defaults: {
    autoLaunch: false,
    monitorInterval: 5,
    notifications: {
      ipChange: true,
      vpnDrop: true,
      criticalCVE: true,
      anomaly: true
    },
    windowBounds: { width: 1400, height: 900 },
    theme: 'dark'
  }
});

// ─── STATE ────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let monitorTimer = null;
let lastKnownIP = null;
let lastVPNState = null;
let isQuitting = false;
let incidentLog = [];

// ─── DATABASE (in-memory + file, no native module needed) ─────
// We use electron-store for simplicity and zero native deps
const db = new Store({
  name: 'aegis-data',
  defaults: {
    ipHistory: [],
    networkScans: [],
    briefingHistory: [],
    incidents: []
  }
});

// ─── WINDOW CREATION ──────────────────────────────────────────
function createWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#020818',
    show: false,
    icon: path.join(ICON_PATH, process.platform === 'win32' ? 'icon.ico' : process.platform === 'darwin' ? 'icon.icns' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  // Show when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (IS_DEV) mainWindow.webContents.openDevTools();
  });

  // Save window size on resize
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  });

  // Minimize to tray on close
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      showTrayNotification('Aegis is still running', 'Aegis is monitoring in the background. Right-click the tray icon to quit.');
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── TRAY ─────────────────────────────────────────────────────
function createTray() {
  const iconFile = process.platform === 'win32' ? 'tray-icon.ico' : 'tray-icon.png';
  const iconPath = path.join(ICON_PATH, iconFile);

  try {
    tray = new Tray(iconPath);
  } catch (e) {
    // Fallback: create a minimal icon from nativeImage
    const img = nativeImage.createEmpty();
    tray = new Tray(img);
  }

  tray.setToolTip('Aegis Security Intelligence');
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

function updateTrayMenu(status = 'secure') {
  const statusLabels = { secure: '● SECURE', monitor: '● MONITORING', alert: '⚠ ALERT' };
  const menu = Menu.buildFromTemplate([
    { label: 'AEGIS SECURITY', enabled: false },
    { label: statusLabels[status] || statusLabels.secure, enabled: false },
    { type: 'separator' },
    { label: 'Open Aegis', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: 'Run Network Scan', click: () => { triggerNetworkScan(); } },
    { label: 'Check My IP', click: () => { openPageInApp('network'); } },
    { type: 'separator' },
    { label: 'Quit Aegis', click: () => { isQuitting = true; app.quit(); } }
  ]);
  if (tray) tray.setContextMenu(menu);
}

function setTrayIcon(status) {
  if (!tray) return;
  const icons = { secure: 'tray-icon.png', alert: 'tray-icon-alert.png', monitor: 'tray-icon-monitor.png' };
  const iconFile = icons[status] || icons.secure;
  try {
    tray.setImage(path.join(ICON_PATH, iconFile));
  } catch (e) {}
  updateTrayMenu(status);
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
function showTrayNotification(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body, icon: path.join(ICON_PATH, 'icon.png') }).show();
}

// ─── NETWORK MONITORING ───────────────────────────────────────
async function runBackgroundMonitor() {
  try {
    const { net } = require('electron');
    const online = net.isOnline();
    if (!online) {
      if (mainWindow) mainWindow.webContents.send('connectivity-change', false);
      return;
    }
    if (mainWindow) mainWindow.webContents.send('connectivity-change', true);

    // Check public IP via ipify (direct, not through proxy — small simple request)
    const https = require('https');
    const ip = await new Promise((resolve, reject) => {
      const req = https.get('https://api64.ipify.org?format=json', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data).ip); } catch { resolve(null); }
        });
      });
      req.on('error', reject);
      req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    });

    if (ip && lastKnownIP && ip !== lastKnownIP) {
      const incident = logIncident('IP_CHANGE', `Public IP changed: ${lastKnownIP} → ${ip}`, 'WARNING');
      if (store.get('notifications.ipChange')) {
        showTrayNotification('⚠ IP Address Changed', `Your public IP changed to ${ip}`);
        setTrayIcon('alert');
      }
      if (mainWindow) mainWindow.webContents.send('incident', incident);
    }

    if (ip) lastKnownIP = ip;

  } catch (e) {
    // Silent fail — background monitoring should never crash the app
  }
}

function startMonitoring() {
  if (monitorTimer) clearInterval(monitorTimer);
  const interval = (store.get('monitorInterval') || 5) * 60 * 1000;
  runBackgroundMonitor(); // run immediately
  monitorTimer = setInterval(runBackgroundMonitor, interval);
}

function stopMonitoring() {
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
}

function triggerNetworkScan() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('trigger-scan');
  }
}

function openPageInApp(page) {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('navigate-to', page);
  }
}

// ─── INCIDENT LOG ─────────────────────────────────────────────
function logIncident(type, description, severity = 'INFO') {
  const incident = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type,
    description,
    severity
  };
  const incidents = db.get('incidents');
  incidents.unshift(incident);
  if (incidents.length > 500) incidents.splice(500);
  db.set('incidents', incidents);
  return incident;
}

// ─── IPC HANDLERS ─────────────────────────────────────────────

// Window controls
ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow && mainWindow.close());
ipcMain.on('window-hide', () => mainWindow && mainWindow.hide());

// Settings
ipcMain.handle('get-setting', (_, key) => store.get(key));
ipcMain.handle('set-setting', (_, key, value) => {
  store.set(key, value);
  if (key === 'monitorInterval') startMonitoring();
  return true;
});
ipcMain.handle('get-all-settings', () => store.store);

// Auto-launch
ipcMain.handle('set-auto-launch', async (_, enabled) => {
  store.set('autoLaunch', enabled);
  try {
    const AutoLaunch = require('auto-launch');
    const launcher = new AutoLaunch({ name: 'Aegis', path: app.getPath('exe') });
    enabled ? await launcher.enable() : await launcher.disable();
    return true;
  } catch (e) {
    return false;
  }
});

// Database: IP History
ipcMain.handle('db-get-ip-history', () => db.get('ipHistory').slice(0, 50));
ipcMain.handle('db-add-ip-history', (_, entry) => {
  const history = db.get('ipHistory').filter(h => h.query !== entry.query);
  history.unshift({ ...entry, savedAt: new Date().toISOString() });
  if (history.length > 50) history.splice(50);
  db.set('ipHistory', history);
  return true;
});
ipcMain.handle('db-clear-ip-history', () => { db.set('ipHistory', []); return true; });

// Database: Briefing History
ipcMain.handle('db-get-briefings', () => db.get('briefingHistory').slice(0, 10));
ipcMain.handle('db-add-briefing', (_, entry) => {
  const history = db.get('briefingHistory');
  history.unshift({ ...entry, savedAt: new Date().toISOString() });
  if (history.length > 10) history.splice(10);
  db.set('briefingHistory', history);
  return true;
});

// Database: Incidents
ipcMain.handle('db-get-incidents', (_, limit = 100) => db.get('incidents').slice(0, limit));
ipcMain.handle('db-log-incident', (_, type, description, severity) => logIncident(type, description, severity));
ipcMain.handle('db-clear-incidents', () => { db.set('incidents', []); return true; });

// Database: Network Scans
ipcMain.handle('db-add-network-scan', (_, scan) => {
  const scans = db.get('networkScans');
  scans.unshift({ ...scan, savedAt: new Date().toISOString() });
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const pruned = scans.filter(s => new Date(s.savedAt).getTime() > thirtyDaysAgo);
  db.set('networkScans', pruned);
  return true;
});
ipcMain.handle('db-get-network-scans', (_, limit = 200) => db.get('networkScans').slice(0, limit));

// Data management
ipcMain.handle('db-get-storage-info', () => {
  const incidents = db.get('incidents').length;
  const ipHistory = db.get('ipHistory').length;
  const scans = db.get('networkScans').length;
  const briefings = db.get('briefingHistory').length;
  return { incidents, ipHistory, scans, briefings };
});
ipcMain.handle('db-clear-all', () => {
  db.set('ipHistory', []);
  db.set('networkScans', []);
  db.set('briefingHistory', []);
  db.set('incidents', []);
  return true;
});
ipcMain.handle('db-export-incidents', () => db.get('incidents'));

// App info
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-app-path', () => app.getPath('userData'));
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

// Notifications
ipcMain.handle('send-notification', (_, title, body) => showTrayNotification(title, body));

// Tray status
ipcMain.handle('set-tray-status', (_, status) => setTrayIcon(status));

// Monitor control
ipcMain.handle('restart-monitor', () => { startMonitoring(); return true; });

// Window state
ipcMain.handle('is-maximized', () => mainWindow ? mainWindow.isMaximized() : false);

// ─── APP EVENTS ───────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  startMonitoring();

  // Wire up maximize events now that mainWindow exists
  if (mainWindow) {
    mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximized', true));
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximized', false));
  }

  // Auto-updater (only in production builds)
  if (!IS_DEV) {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.checkForUpdatesAndNotify();
      autoUpdater.on('update-available', () => {
        if (mainWindow) mainWindow.webContents.send('update-available');
      });
    } catch (e) { /* silent — updater not critical */ }
  }

  // Keyboard shortcuts (global)
  const { globalShortcut } = require('electron');
  // F11 fullscreen toggle
  globalShortcut.register('F11', () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running in tray even with no windows
  if (process.platform !== 'darwin') {
    // Don't quit — just hide to tray
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopMonitoring();
});

app.on('will-quit', () => {
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});

// Handle second instance (single instance lock)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}
