'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose platform so the renderer can apply platform-specific styling (e.g. macOS traffic lights)
contextBridge.exposeInMainWorld('aegisPlatform', process.platform);

// Expose a safe, limited API to the renderer process
contextBridge.exposeInMainWorld('aegis', {

  // ── Window controls ──────────────────────────────────────────
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  quitApp: () => ipcRenderer.send('app-quit'),
  hide: () => ipcRenderer.send('window-hide'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),

  // ── Settings ─────────────────────────────────────────────────
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
  getAllSettings: () => ipcRenderer.invoke('get-all-settings'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),

  // ── Database: IP History ──────────────────────────────────────
  getIPHistory: () => ipcRenderer.invoke('db-get-ip-history'),
  addIPHistory: (entry) => ipcRenderer.invoke('db-add-ip-history', entry),
  clearIPHistory: () => ipcRenderer.invoke('db-clear-ip-history'),

  // ── Database: Briefings ───────────────────────────────────────
  getBriefings: () => ipcRenderer.invoke('db-get-briefings'),
  addBriefing: (entry) => ipcRenderer.invoke('db-add-briefing', entry),
  clearBriefings: () => ipcRenderer.invoke('db-clear-briefings'),

  // ── Database: Incidents ───────────────────────────────────────
  getIncidents: (limit) => ipcRenderer.invoke('db-get-incidents', limit),
  logIncident: (type, description, severity) => ipcRenderer.invoke('db-log-incident', type, description, severity),
  clearIncidents: () => ipcRenderer.invoke('db-clear-incidents'),
  exportIncidents: () => ipcRenderer.invoke('db-export-incidents'),

  // ── Database: Network Scans ───────────────────────────────────
  addNetworkScan: (scan) => ipcRenderer.invoke('db-add-network-scan', scan),
  getNetworkScans: (limit) => ipcRenderer.invoke('db-get-network-scans', limit),

  // ── Storage info ──────────────────────────────────────────────
  getStorageInfo: () => ipcRenderer.invoke('db-get-storage-info'),
  clearAllData: () => ipcRenderer.invoke('db-clear-all'),

  // ── App info ──────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  getDataPath: () => ipcRenderer.invoke('get-app-path'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // ── Notifications & tray ─────────────────────────────────────
  notify: (title, body) => ipcRenderer.invoke('send-notification', title, body),
  setTrayStatus: (status) => ipcRenderer.invoke('set-tray-status', status),

  // ── Monitor ───────────────────────────────────────────────────
  restartMonitor: () => ipcRenderer.invoke('restart-monitor'),

  // ── Local port scanner ────────────────────────────────────────
  scanLocalPorts: () => ipcRenderer.invoke('scan-local-ports'),

  // ── Active connections ────────────────────────────────────────
  getActiveConnections: () => ipcRenderer.invoke('get-active-connections'),

  // ── Radar readings ────────────────────────────────────────────
  addRadarReading: (reading) => ipcRenderer.invoke('db-add-radar-reading', reading),
  getRadarReadings: (limit) => ipcRenderer.invoke('db-get-radar-readings', limit),

  // ── Database: Chat History (Security Toolkit) ────────────────
  getChatHistory: () => ipcRenderer.invoke('db-get-chat-history'),
  saveChatHistory: (messages) => ipcRenderer.invoke('db-save-chat-history', messages),
  clearChatHistory: () => ipcRenderer.invoke('db-clear-chat-history'),

  // ── Database: CVE Explanations (Security Toolkit) ────────────
  getCVEExplanations: () => ipcRenderer.invoke('db-get-cve-explanations'),
  saveCVEExplanations: (items) => ipcRenderer.invoke('db-save-cve-explanations', items),
  clearCVEExplanations: () => ipcRenderer.invoke('db-clear-cve-explanations'),

  // ── Traceroute ────────────────────────────────────────────────
  startTraceroute: (target) => ipcRenderer.send('start-traceroute', target),
  stopTraceroute: () => ipcRenderer.send('stop-traceroute'),
  onTracerouteHop: (callback) => ipcRenderer.on('traceroute-hop', (_, hop) => callback(hop)),
  onTracerouteDone: (callback) => ipcRenderer.on('traceroute-done', (_, result) => callback(result)),

  // ── Multi-window ─────────────────────────────────────────────
  openDetachedWindow: (page) => ipcRenderer.invoke('open-detached-window', page),
  setSocPreset: (preset) => ipcRenderer.invoke('set-soc-preset', preset),
  openMiniRadar: () => ipcRenderer.invoke('open-mini-radar'),

  // ── Events FROM main → renderer ───────────────────────────────
  onConnectivityChange: (callback) => {
    ipcRenderer.on('connectivity-change', (_, online) => callback(online));
  },
  onIncident: (callback) => {
    ipcRenderer.on('incident', (_, incident) => callback(incident));
  },
  onTriggerScan: (callback) => {
    ipcRenderer.on('trigger-scan', () => callback());
  },
  onNavigateTo: (callback) => {
    ipcRenderer.on('navigate-to', (_, page) => callback(page));
  },
  onWindowMaximized: (callback) => {
    ipcRenderer.on('window-maximized', (_, isMax) => callback(isMax));
  },

  // ── Auto-updates ──────────────────────────────────────────────
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_, version) => callback(version)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', () => callback())
});
