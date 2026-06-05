'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog, Notification } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Set app name before anything else so app.getPath('userData') uses 'Aegis' not 'aegis'
app.setName('Aegis');

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
    theme: 'dark',
    socPreset: 'single',
    startupPreset: false,
    justUpdated: false
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
let updater = null;

// Multi-window tracking
const detachedWindows = new Map(); // page → BrowserWindow
let miniRadarWindow = null;

// ─── DATABASE (in-memory + file, no native module needed) ─────
// We use electron-store for simplicity and zero native deps
const db = new Store({
  name: 'aegis-data',
  defaults: {
    ipHistory: [],
    networkScans: [],
    briefingHistory: [],
    incidents: [],
    radarReadings: [],
    chatHistory: [],
    cveExplanations: []
  }
});

// ─── WINDOW CREATION ──────────────────────────────────────────
function createWindow() {
  const bounds = store.get('windowBounds');

  // Always open on the primary display, ignoring any stale saved position
  const { screen } = require('electron');
  const primaryBounds = screen.getPrimaryDisplay().bounds;

  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width:  bounds.width,
    height: bounds.height,
    x: primaryBounds.x,
    y: primaryBounds.y,
    minWidth: 900,
    minHeight: 600,
    ...(isMac ? { titleBarStyle: 'hiddenInset' } : { frame: false, titleBarStyle: 'hidden' }),
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

  // Show as soon as the DOM is ready so the splash animation is visible.
  // ready-to-show waits for first paint (which includes font fetches) and
  // fires AFTER the ~3.3s splash animation completes, causing it to be
  // skipped. dom-ready fires right after DOMContentLoaded — scripts have
  // run, the splash interval has started, and backgroundColor:#020818
  // prevents any white flash before the first paint.
  mainWindow.webContents.once('dom-ready', () => {
    mainWindow.show();
    mainWindow.maximize();
    if (IS_DEV) mainWindow.webContents.openDevTools();

    // Apply startup preset if the user enabled it
    if (store.get('startupPreset')) {
      const preset = store.get('socPreset') || 'single';
      if (preset !== 'single') {
        setTimeout(() => applySocPreset(preset), 800);
      }
    }
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

  // Right-click context menu
  mainWindow.webContents.on('context-menu', (_, params) => {
    const template = [];
    if (params.isEditable) {
      template.push({ label: 'Cut', role: 'cut', enabled: params.selectionText.length > 0 });
    }
    template.push({ label: 'Copy', role: 'copy', enabled: params.selectionText.length > 0 });
    if (params.isEditable) {
      template.push({ label: 'Paste', role: 'paste' });
    }
    template.push({ type: 'separator' });
    template.push({ label: 'Select All', role: 'selectAll' });
    Menu.buildFromTemplate(template).popup({ window: mainWindow });
  });

  // When main window is restored from taskbar, also restore all detached windows
  mainWindow.on('restore', () => {
    detachedWindows.forEach(function(win) {
      if (win.isDestroyed()) return;
      if (win.isMinimized()) win.restore();
      win.show();
    });
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
    const managed = [mainWindow, ...Array.from(detachedWindows.values())
      .filter(w => !w.isDestroyed())];
    const allVisible = managed.every(w => w && w.isVisible() && !w.isMinimized());

    if (allVisible) {
      // All windows visible — minimize everything together
      managed.forEach(w => { if (w) w.minimize(); });
    } else {
      // Restore/show everything
      managed.forEach(w => {
        if (!w || w.isDestroyed()) return;
        if (w.isMinimized()) w.restore();
        w.show();
      });
      if (mainWindow) mainWindow.focus();
    }
  });
}

function updateTrayMenu(status = 'secure') {
  const statusLabels = { secure: '● SECURE', monitor: '● MONITORING', alert: '! ALERT' };
  const menu = Menu.buildFromTemplate([
    { label: 'AEGIS SECURITY', enabled: false },
    { label: statusLabels[status] || statusLabels.secure, enabled: false },
    { type: 'separator' },
    { label: 'Open Aegis', click: () => {
      const managed = [mainWindow, ...Array.from(detachedWindows.values()).filter(w => !w.isDestroyed())];
      managed.forEach(w => { if (!w || w.isDestroyed()) return; if (w.isMinimized()) w.restore(); w.show(); });
      if (mainWindow) mainWindow.focus();
    }},
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
  new Notification({ title, body, icon: path.join(ICON_PATH, 'icon.png'), silent: true }).show();
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
        showTrayNotification('IP Address Changed', `Your public IP changed to ${ip}`);
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

// Window controls — main window controls affect all tracked windows;
// detached window controls affect only that window.
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win === mainWindow) {
    mainWindow.minimize();
    detachedWindows.forEach(dw => { if (!dw.isDestroyed()) dw.minimize(); });
  } else {
    win.minimize();
  }
});
ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win === mainWindow) {
    const willMax = !mainWindow.isMaximized();
    willMax ? mainWindow.maximize() : mainWindow.unmaximize();
    detachedWindows.forEach(dw => {
      if (!dw.isDestroyed()) willMax ? dw.maximize() : dw.unmaximize();
    });
  } else {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  }
});
ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win === mainWindow) {
    mainWindow.hide();
    showTrayNotification('Aegis is still running', 'Aegis is monitoring in the background. Right-click the tray icon to quit.');
  } else {
    win.close();
  }
});
ipcMain.on('app-quit', () => {
  isQuitting = true;
  app.quit();
});
ipcMain.on('window-hide', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.hide();
});

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
ipcMain.handle('db-clear-briefings', () => { db.set('briefingHistory', []); return true; });

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
// Database: Radar Readings
ipcMain.handle('db-add-radar-reading', (_, reading) => {
  const readings = db.get('radarReadings');
  readings.push({ ...reading });
  if (readings.length > 1000) readings.splice(0, readings.length - 1000);
  db.set('radarReadings', readings);
  return true;
});
ipcMain.handle('db-get-radar-readings', (_, limit = 60) => {
  return db.get('radarReadings').slice(-limit);
});

ipcMain.handle('db-get-storage-info', () => {
  const incidents = db.get('incidents').length;
  const ipHistory = db.get('ipHistory').length;
  const scans = db.get('networkScans').length;
  const briefings = db.get('briefingHistory').length;
  const radarReadings = db.get('radarReadings').length;
  const chatMessages = db.get('chatHistory').length;
  const cveExplanations = db.get('cveExplanations').length;
  return { incidents, ipHistory, scans, briefings, radarReadings, chatMessages, cveExplanations };
});
ipcMain.handle('db-clear-all', () => {
  db.set('ipHistory', []);
  db.set('networkScans', []);
  db.set('briefingHistory', []);
  db.set('incidents', []);
  db.set('radarReadings', []);
  db.set('chatHistory', []);
  db.set('cveExplanations', []);
  return true;
});
ipcMain.handle('db-export-incidents', () => db.get('incidents'));

// Database: Chat History (Security Toolkit — Ask Aegis)
ipcMain.handle('db-get-chat-history', () => db.get('chatHistory').slice(-50));
ipcMain.handle('db-save-chat-history', (_, messages) => {
  db.set('chatHistory', (messages || []).slice(-50));
  return true;
});
ipcMain.handle('db-clear-chat-history', () => { db.set('chatHistory', []); return true; });

// Database: CVE Explanations (Security Toolkit — CVE Explainer)
ipcMain.handle('db-get-cve-explanations', () => db.get('cveExplanations').slice(0, 10));
ipcMain.handle('db-save-cve-explanations', (_, items) => {
  db.set('cveExplanations', (items || []).slice(0, 10));
  return true;
});
ipcMain.handle('db-clear-cve-explanations', () => { db.set('cveExplanations', []); return true; });

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

// ─── TRACEROUTE ───────────────────────────────────────────────
function parseTracerouteLine(line, isWin) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (isWin) {
    const hopMatch = trimmed.match(/^(\d+)\s+/);
    if (!hopMatch) return null;
    const hopNum = parseInt(hopMatch[1]);
    if (hopNum < 1 || hopNum > 30) return null;

    const ipMatch = trimmed.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    const ip = ipMatch ? ipMatch[1] : null;
    const isTimeout = !ip && trimmed.includes('*');

    const latencies = [];
    const latRe = /(?:<1|(\d+))\s+ms/gi;
    let m;
    while ((m = latRe.exec(trimmed)) !== null) {
      latencies.push(m[1] ? parseInt(m[1]) : 1);
    }
    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

    return { hopNum, ip, latency: avgLatency, timeout: isTimeout };
  } else {
    const hopMatch = trimmed.match(/^(\d+)\s+/);
    if (!hopMatch) return null;
    const hopNum = parseInt(hopMatch[1]);
    if (hopNum < 1 || hopNum > 30) return null;

    const ipMatch = trimmed.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    const ip = ipMatch ? ipMatch[1] : null;
    const isTimeout = !ip && (trimmed.includes('* * *') || trimmed.includes('!H') || trimmed.includes('!N'));

    const latencies = [];
    const latRe = /(\d+\.?\d*)\s+ms/gi;
    let m;
    while ((m = latRe.exec(trimmed)) !== null) {
      latencies.push(parseFloat(m[1]));
    }
    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

    return { hopNum, ip, latency: avgLatency, timeout: isTimeout };
  }
}

let tracerouteProcess = null;

ipcMain.on('start-traceroute', (event, target) => {
  if (tracerouteProcess) {
    try { tracerouteProcess.kill(); } catch (_) {}
    tracerouteProcess = null;
  }

  const { spawn } = require('child_process');
  const isWin = process.platform === 'win32';

  const launchTraceroute = (resolvedTarget) => {
    const cmd  = isWin ? 'tracert' : 'traceroute';
    const args = isWin
      ? ['-d', '-h', '20', '-w', '1000', resolvedTarget]
      : ['-m', '20', '-w', '2', '-q', '2', resolvedTarget];

    let buffer = '';

    tracerouteProcess = spawn(cmd, args, { shell: isWin });
    tracerouteProcess.stdout.setEncoding('utf8');

    function processChunk(chunk) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach(line => {
        const hop = parseTracerouteLine(line, isWin);
        if (hop) {
          try { event.sender.send('traceroute-hop', hop); } catch (_) {}
        }
      });
    }

    tracerouteProcess.stdout.on('data', processChunk);
    if (tracerouteProcess.stderr) {
      tracerouteProcess.stderr.setEncoding('utf8');
      tracerouteProcess.stderr.on('data', processChunk);
    }

    tracerouteProcess.on('close', (code) => {
      tracerouteProcess = null;
      try { event.sender.send('traceroute-done', { code }); } catch (_) {}
    });
    tracerouteProcess.on('error', (err) => {
      tracerouteProcess = null;
      try { event.sender.send('traceroute-done', { error: err.message }); } catch (_) {}
    });
  };

  const dns = require('dns').promises;
  dns.resolve4(target)
    .then(addresses => {
      if (addresses.length > 0) target = addresses[0];
    })
    .catch(() => {})
    .finally(() => launchTraceroute(target));
});

ipcMain.on('stop-traceroute', () => {
  if (tracerouteProcess) {
    try { tracerouteProcess.kill(); } catch (_) {}
    tracerouteProcess = null;
  }
});

// Active connections — returns [{ip, process, pid}] for public ESTABLISHED connections.
// Windows: netstat -n -o (PIDs, no admin) + tasklist /FO CSV /NH (names, no admin).
// macOS/Linux: netstat -n -p tcp (no process names available without root).
ipcMain.handle('get-active-connections', () => {
  const { exec } = require('child_process');
  const isWin = process.platform === 'win32';

  const isPrivate = (ip) =>
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|0\.0\.0\.0|169\.254\.|::1$|fe80:)/i.test(ip);

  if (!isWin) {
    return new Promise((resolve) => {
      exec('netstat -n -p tcp', { timeout: 8000 }, (err, stdout) => {
        if (err && !stdout) { resolve([]); return; }
        const results = [];
        const seen = new Set();
        (stdout || '').split('\n').forEach((line) => {
          if (!line.includes('ESTABLISHED')) return;
          const parts = line.trim().split(/\s+/);
          const remoteRaw = parts[4];
          if (!remoteRaw) return;
          const i = remoteRaw.lastIndexOf('.');
          const ip = i > 0 ? remoteRaw.slice(0, i) : null;
          if (!ip || isPrivate(ip) || ip.includes(':') || seen.has(ip)) return;
          seen.add(ip);
          results.push({ ip, process: '', pid: '' });
        });
        resolve(results);
      });
    });
  }

  // Run netstat and tasklist in parallel — neither requires admin
  const runNetstat  = () => new Promise(r => exec('netstat -n -o',       { timeout: 8000 },  (_, s) => r(s || '')));
  const runTasklist = () => new Promise(r => exec('tasklist /FO CSV /NH', { timeout: 8000 },  (_, s) => r(s || '')));

  return Promise.all([runNetstat(), runTasklist()]).then(([netstatOut, tasklistOut]) => {
    // Build PID → process name from tasklist CSV: "chrome.exe","5432","Console","1","150,000 K"
    const pidMap = {};
    (tasklistOut || '').split('\n').forEach((line) => {
      const m = line.match(/^"([^"]+)","(\d+)"/);
      if (m) pidMap[m[2]] = m[1];
    });

    // Parse netstat -n -o: TCP  local:port  remote:port  ESTABLISHED  PID
    const results = [];
    const seen = new Set();
    (netstatOut || '').split('\n').forEach((line) => {
      if (!line.includes('ESTABLISHED')) return;
      const parts = line.trim().split(/\s+/);
      const remoteRaw = parts[2];
      const pid = parts[4] || '';
      if (!remoteRaw) return;
      const col = remoteRaw.lastIndexOf(':');
      const ip  = col > 0 ? remoteRaw.slice(0, col) : null;
      if (!ip || isPrivate(ip) || ip.includes(':') || seen.has(ip)) return;
      seen.add(ip);
      results.push({ ip, process: pidMap[pid] || '', pid: String(pid) });
    });

    return results;
  });
});

// Local port scanner — uses Node's net module, no external API
ipcMain.handle('scan-local-ports', () => {
  const net = require('net');
  const PORTS = [
    { port: 21,   service: 'FTP' },
    { port: 22,   service: 'SSH' },
    { port: 23,   service: 'Telnet' },
    { port: 25,   service: 'SMTP' },
    { port: 80,   service: 'HTTP' },
    { port: 443,  service: 'HTTPS' },
    { port: 3389, service: 'RDP' },
    { port: 4444, service: 'Metasploit' },
    { port: 5900, service: 'VNC' },
    { port: 6881, service: 'BitTorrent' },
    { port: 8080, service: 'HTTP Alt' },
    { port: 8443, service: 'HTTPS Alt' }
  ];

  const scanPort = (port) => new Promise((resolve) => {
    const socket = new net.Socket();
    let open = false;
    socket.setTimeout(500);
    socket.on('connect', () => { open = true; socket.destroy(); });
    socket.on('timeout', () => { socket.destroy(); });
    socket.on('error',   () => { socket.destroy(); });
    socket.on('close',   () => { resolve(open); });
    socket.connect(port, '127.0.0.1');
  });

  return Promise.all(PORTS.map(async ({ port, service }) => ({
    port, service, open: await scanPort(port)
  })));
});

// ─── NETWORK DEVICES SCAN ────────────────────────────────────
ipcMain.handle('scan-network-devices', async () => {
  const { exec } = require('child_process');
  const net = require('net');
  const dns = require('dns').promises;

  // Detect own IP and gateway — platform-aware
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  let ownIP = null;
  let gatewayIP = null;

  const isPrivateIP = (ip) =>
    !ip.startsWith('127.') && (
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    );

  if (isWin) {
    const ipconfigOut = await new Promise(r =>
      exec('ipconfig', { timeout: 5000 }, (_, s) => r(s || ''))
    );
    const ipMatches = [...ipconfigOut.matchAll(/IPv4[^:]+:\s*([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})/gi)];
    ownIP = (ipMatches.map(m => m[1]).find(isPrivateIP)) || null;
    const gwMatch = ipconfigOut.match(/Default Gateway[.\s]+:\s*(\d+\.\d+\.\d+\.\d+)/);
    gatewayIP = gwMatch ? gwMatch[1] : null;
  } else if (isMac) {
    const ifOut = await new Promise(r => exec('ifconfig', { timeout: 5000 }, (_, s) => r(s || '')));
    const inetMatches = [...ifOut.matchAll(/inet\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g)];
    ownIP = (inetMatches.map(m => m[1]).find(isPrivateIP)) || null;
    const gwOut = await new Promise(r => exec('netstat -rn', { timeout: 5000 }, (_, s) => r(s || '')));
    const gwMatch = gwOut.match(/(?:via\s+|default\s+)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    gatewayIP = gwMatch ? gwMatch[1] : null;
  } else {
    // Linux — try ip addr first, fall back to ifconfig
    const ifOut = await new Promise(r =>
      exec('ip addr show 2>/dev/null || ifconfig -a 2>/dev/null', { timeout: 5000 }, (_, s) => r(s || ''))
    );
    const inetMatches = [...ifOut.matchAll(/inet\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g)];
    ownIP = (inetMatches.map(m => m[1]).find(isPrivateIP)) || null;
    const gwOut = await new Promise(r =>
      exec('ip route 2>/dev/null || netstat -rn 2>/dev/null', { timeout: 5000 }, (_, s) => r(s || ''))
    );
    const gwMatch = gwOut.match(/(?:via\s+|default\s+)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    gatewayIP = gwMatch ? gwMatch[1] : null;
  }

  if (!ownIP) return { success: false, error: 'Could not detect local subnet' };
  const subnetBase = ownIP.split('.').slice(0, 3).join('.');
  if (!gatewayIP) gatewayIP = subnetBase + '.1';

  // TCP probe all 254 hosts (triggers ARP cache population, detects alive hosts)
  const probeHost = (ip) => new Promise((resolve) => {
    const s = net.createConnection({ host: ip, port: 80, timeout: 300 });
    let alive = false;
    s.on('connect', () => { alive = true; s.destroy(); });
    s.on('error', (err) => { if (err.code === 'ECONNREFUSED') alive = true; s.destroy(); });
    s.on('timeout', () => s.destroy());
    s.on('close', () => resolve({ ip, alive }));
  });

  const allIPs = Array.from({ length: 254 }, (_, i) => `${subnetBase}.${i + 1}`);
  const tcpAlive = new Set();

  // Process in batches of 50 to avoid overwhelming the event loop
  for (let i = 0; i < allIPs.length; i += 50) {
    const batch = allIPs.slice(i, i + 50);
    const results = await Promise.all(batch.map(probeHost));
    results.forEach(r => { if (r.alive) tcpAlive.add(r.ip); });
  }

  // Read ARP table — ground truth for all devices seen on the LAN
  const arpOut = await new Promise(r =>
    exec('arp -a', { timeout: 5000 }, (_, s) => r(s || ''))
  );
  const arpMap = {};

  if (isWin) {
    // Windows: "192.168.x.x    xx-xx-xx-xx-xx-xx    dynamic"
    const winRe = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+([\da-f]{2}-[\da-f]{2}-[\da-f]{2}-[\da-f]{2}-[\da-f]{2}-[\da-f]{2})/gi;
    for (const m of arpOut.matchAll(winRe)) {
      const ip = m[1];
      const mac = m[2].toUpperCase().replace(/-/g, ':');
      if (ip.startsWith(subnetBase + '.') && mac !== 'FF:FF:FF:FF:FF:FF') arpMap[ip] = mac;
    }
  } else {
    // macOS BSD: "? (192.168.x.x) at aa:bb:cc:dd:ee:ff on en0 ..."
    const bsdRe = /\((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\)\s+at\s+([\da-f]{2}:[\da-f]{2}:[\da-f]{2}:[\da-f]{2}:[\da-f]{2}:[\da-f]{2})/gi;
    // Linux: "192.168.x.x    ether    aa:bb:cc:dd:ee:ff    C    eth0"
    const linuxRe = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+\w+\s+([\da-f]{2}:[\da-f]{2}:[\da-f]{2}:[\da-f]{2}:[\da-f]{2}:[\da-f]{2})/gim;
    for (const re of [bsdRe, linuxRe]) {
      for (const m of arpOut.matchAll(re)) {
        const ip = m[1];
        const mac = m[2].toUpperCase();
        if (ip.startsWith(subnetBase + '.') && mac !== 'FF:FF:FF:FF:FF:FF' && !arpMap[ip]) arpMap[ip] = mac;
      }
    }
  }

  // Only include IPs that have a confirmed MAC in the ARP table OR responded to a TCP probe
  const found = new Set([...tcpAlive, ...Object.keys(arpMap)]);
  found.add(ownIP);
  if (gatewayIP.startsWith(subnetBase + '.')) found.add(gatewayIP);

  // Resolve hostnames in parallel (3 s timeout each)
  const devices = await Promise.all(
    Array.from(found).map(async (ip) => {
      let hostname = '';
      try {
        const names = await Promise.race([
          dns.reverse(ip),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
        ]);
        hostname = names[0] || '';
      } catch (_) {}
      return {
        ip,
        mac: arpMap[ip] || '',
        hostname,
        isOwnDevice: ip === ownIP,
        isGateway: ip === gatewayIP,
        status: 'ACTIVE'
      };
    })
  );

  devices.sort((a, b) => {
    if (a.isOwnDevice) return -1;
    if (b.isOwnDevice) return 1;
    if (a.isGateway) return -1;
    if (b.isGateway) return 1;
    return parseInt(a.ip.split('.')[3]) - parseInt(b.ip.split('.')[3]);
  });

  return { success: true, devices, ownIP, gatewayIP, subnet: subnetBase + '.0/24' };
});

ipcMain.handle('block-device', (_, ip) => {
  const { exec } = require('child_process');
  const safe = ip.replace(/[^0-9.]/g, '');
  const name = `Aegis Block ${safe}`;
  const cmd = `netsh advfirewall firewall add rule name="${name}" dir=in action=block remoteip=${safe} protocol=any`;
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (err) => {
      if (err) resolve({ success: false, error: err.message });
      else resolve({ success: true });
    });
  });
});

ipcMain.handle('unblock-all-devices', () => {
  const { exec } = require('child_process');
  const cmd = `powershell -NoProfile -Command "Get-NetFirewallRule | Where-Object {$_.DisplayName -like 'Aegis Block*'} | Remove-NetFirewallRule"`;
  return new Promise((resolve) => {
    exec(cmd, { timeout: 20000 }, (err) => {
      resolve({ success: !err, error: err ? err.message : null });
    });
  });
});

ipcMain.handle('get-gateway-ip', () => {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec('ipconfig', { timeout: 5000 }, (err, stdout) => {
      if (err && !stdout) { resolve(null); return; }
      const m = (stdout || '').match(/Default Gateway[.\s]+:\s*(\d+\.\d+\.\d+\.\d+)/);
      resolve(m ? m[1] : null);
    });
  });
});

// ─── SSL CERTIFICATE CHECKER ──────────────────────────────────
ipcMain.handle('check-ssl', (_, domain) => {
  const tls  = require('tls');
  const host = (domain || '').replace(/^https?:\/\//i, '').replace(/[/?#:].*/,'').trim();
  if (!host) return { success: false, error: 'No domain provided' };

  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => { if (!done) { done = true; resolve(result); } };

    const timer = setTimeout(() => {
      socket.destroy();
      finish({ success: false, error: 'Connection timed out (10 s)' });
    }, 10000);

    const socket = tls.connect(
      { host, port: 443, servername: host, rejectUnauthorized: false },
      () => {
        clearTimeout(timer);
        try {
          const cert       = socket.getPeerCertificate(true);
          const protocol   = socket.getProtocol ? socket.getProtocol() : 'Unknown';
          const authorized = socket.authorized;
          const authError  = socket.authorizationError || null;
          socket.destroy();

          if (!cert || !Object.keys(cert).length) {
            return finish({ success: false, error: 'Server returned no certificate' });
          }

          const validFrom = new Date(cert.valid_from);
          const validTo   = new Date(cert.valid_to);
          const daysLeft  = Math.floor((validTo - Date.now()) / 86400000);

          const sans = cert.subjectaltname
            ? cert.subjectaltname.split(', ')
                .filter(s => s.startsWith('DNS:') || s.startsWith('IP Address:'))
                .map(s => s.replace(/^DNS:|^IP Address:/i, '').trim())
            : [];

          const subjectCN = (cert.subject && cert.subject.CN) || '';
          const issuerCN  = (cert.issuer  && cert.issuer.CN)  || '';
          const issuerO   = (cert.issuer  && cert.issuer.O)   || '';

          const h = host.toLowerCase();
          const domainMatches = authorized || [subjectCN, ...sans].some(name => {
            const n = name.toLowerCase();
            if (n === h) return true;
            if (n.startsWith('*.')) {
              const parts = h.split('.');
              return parts.length >= 2 && parts.slice(1).join('.') === n.slice(2);
            }
            return false;
          });

          let sigAlg = 'Unknown';
          if (cert.asn1Curve) sigAlg = 'ECDSA (' + cert.asn1Curve + ')';
          else if (cert.bits)  sigAlg = 'RSA-' + cert.bits;

          finish({
            success: true,
            host,
            validFrom:    cert.valid_from,
            validTo:      cert.valid_to,
            daysLeft,
            isExpired:    daysLeft < 0,
            subject:      subjectCN || JSON.stringify(cert.subject || {}),
            issuer:       issuerCN  || issuerO,
            issuerOrg:    issuerO,
            sans,
            serial:       cert.serialNumber || '',
            fingerprint:  cert.fingerprint256 || cert.fingerprint || '',
            sigAlg,
            protocol,
            authorized,
            authError,
            domainMatches
          });
        } catch (err) {
          socket.destroy();
          finish({ success: false, error: err.message });
        }
      }
    );

    socket.on('error', (err) => { clearTimeout(timer); finish({ success: false, error: err.message }); });
  });
});

// Auto-updates
ipcMain.handle('check-for-updates', () => {
  if (!updater) return { dev: true };
  try {
    updater.checkForUpdates().catch((err) => {
      if (mainWindow) mainWindow.webContents.send('update-error', err.message || 'Update check failed');
    });
    return true;
  } catch (err) {
    if (mainWindow) mainWindow.webContents.send('update-error', err.message || 'Update check failed');
    return false;
  }
});
ipcMain.handle('install-update', () => {
  if (!updater) return false;
  try {
    updater.downloadUpdate().then(() => { store.set('justUpdated', true); updater.quitAndInstall(false, true); }).catch(() => {});
    return true;
  } catch (e) { return false; }
});

// ─── MULTI-WINDOW ─────────────────────────────────────────────
function createDetachedWindow(page, opts = {}) {
  const { width = 1000, height = 700, alwaysOnTop = false, x, y } = opts;
  const isMacDW = process.platform === 'darwin';
  const winOpts = {
    width, height,
    ...(isMacDW ? { titleBarStyle: 'hiddenInset' } : { frame: false, titleBarStyle: 'hidden' }),
    backgroundColor: '#020818',
    alwaysOnTop,
    show: false,
    icon: path.join(ICON_PATH, process.platform === 'win32' ? 'icon.ico' : process.platform === 'darwin' ? 'icon.icns' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  };
  if (x !== undefined) winOpts.x = Math.round(x);
  if (y !== undefined) winOpts.y = Math.round(y);

  const { maximizeOnOpen = false } = opts;

  const win = new BrowserWindow(winOpts);
  win.loadFile(path.join(__dirname, '..', 'index.html'), { query: { page } });
  win.once('ready-to-show', () => {
    win.show();
    if (maximizeOnOpen) win.maximize();
  });
  win.on('closed', () => {
    if (page === 'mini-radar') { miniRadarWindow = null; }
    else { detachedWindows.delete(page); }
  });
  return win;
}

ipcMain.handle('open-detached-window', (_, page) => {
  if (detachedWindows.has(page)) {
    const existing = detachedWindows.get(page);
    if (!existing.isDestroyed()) { existing.show(); existing.focus(); return true; }
    detachedWindows.delete(page);
  }
  let x, y;
  if (mainWindow) { const b = mainWindow.getBounds(); x = b.x + 50; y = b.y + 50; }
  const win = createDetachedWindow(page, { x, y });
  detachedWindows.set(page, win);
  return true;
});

// Extracted so it can be called both from the IPC handler and on startup.
function applySocPreset(preset) {
  store.set('socPreset', preset);

  // Close all existing detached windows before opening the new layout
  const toClose = Array.from(detachedWindows.values());
  detachedWindows.clear();
  toClose.forEach(function(win) { if (!win.isDestroyed()) win.close(); });

  const { screen } = require('electron');
  const primary  = screen.getPrimaryDisplay();
  // Sort: primary first, remaining by id so order is deterministic
  const displays = [primary, ...screen.getAllDisplays()
    .filter(d => d.id !== primary.id)
    .sort((a, b) => a.id - b.id)];

  function displayOpts(i) {
    if (i < displays.length) {
      const d = displays[i];
      return { x: d.bounds.x, y: d.bounds.y, maximizeOnOpen: true };
    }
    const base = mainWindow ? mainWindow.getBounds() : { x: 100, y: 100 };
    return { x: base.x + i * 100, y: base.y + i * 100, maximizeOnOpen: false };
  }

  if (preset === 'single') {
    if (mainWindow) mainWindow.maximize();
    return;
  }

  if (mainWindow) mainWindow.maximize();

  if (preset === 'dual' || preset === 'triple') {
    const opts2 = displayOpts(1);
    const win2  = createDetachedWindow('network-intelligence', opts2);
    detachedWindows.set('network-intelligence', win2);
  }

  if (preset === 'triple') {
    const opts3 = displayOpts(2);
    const win3  = createDetachedWindow('network', opts3);
    detachedWindows.set('network', win3);
  }
}

ipcMain.handle('set-soc-preset', (_, preset) => {
  applySocPreset(preset);
  return true;
});

ipcMain.handle('open-mini-radar', () => {
  if (miniRadarWindow && !miniRadarWindow.isDestroyed()) {
    miniRadarWindow.show(); miniRadarWindow.focus(); return true;
  }
  let x, y;
  if (mainWindow) {
    const b = mainWindow.getBounds();
    x = b.x + b.width - 340;
    y = b.y + 50;
  }
  miniRadarWindow = createDetachedWindow('mini-radar', { width: 320, height: 380, alwaysOnTop: true, x, y });
  return true;
});

// ─── APP EVENTS ───────────────────────────────────────────────
app.whenReady().then(() => {
  // Log all detected displays to help debug multi-monitor positioning
  try {
    const { screen } = require('electron');
    const pri = screen.getPrimaryDisplay();
    const all = screen.getAllDisplays();
    console.log(`[Aegis] Displays detected: ${all.length}`);
    all.forEach((d, i) => {
      const tag = d.id === pri.id ? ' [PRIMARY]' : '';
      console.log(`  [${i}] id=${d.id}${tag} bounds=${JSON.stringify(d.bounds)} workArea=${JSON.stringify(d.workArea)} scaleFactor=${d.scaleFactor}`);
    });
  } catch (e) {
    console.log('[Aegis] Could not enumerate displays:', e.message);
  }

  createWindow();
  createTray();
  startMonitoring();

  // Wire up maximize events now that mainWindow exists
  if (mainWindow) {
    mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximized', true));
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximized', false));
  }

  // Auto-updater — only runs in packaged builds; gracefully skipped when running unpackaged
  if (app.isPackaged) {
    try {
      const { autoUpdater: au } = require('electron-updater');
      updater = au;
      updater.autoDownload = false;
      updater.on('update-available', (info) => {
        if (mainWindow) mainWindow.webContents.send('update-available', info.version);
      });
      updater.on('update-not-available', () => {
        if (mainWindow) mainWindow.webContents.send('update-not-available');
      });
      updater.on('error', (err) => {
        if (mainWindow) mainWindow.webContents.send('update-error', err.message || 'Update check failed');
      });
      setTimeout(() => { try { updater.checkForUpdates(); } catch (_) {} }, 5000);
      setInterval(() => { try { updater.checkForUpdates(); } catch (_) {} }, 4 * 60 * 60 * 1000);
    } catch (e) {}
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
  if (app.isReady()) {
    const { globalShortcut } = require('electron');
    globalShortcut.unregisterAll();
  }
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
