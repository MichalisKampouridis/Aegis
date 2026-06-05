# Aegis — Technical Documentation

> Version 1.0.11 · Electron Desktop Application

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [File Structure](#file-structure)
4. [API Integrations](#api-integrations)
5. [Electron IPC Bridge](#electron-ipc-bridge)
6. [Persistent Storage](#persistent-storage)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Security Considerations](#security-considerations)

---

## Architecture Overview

Aegis follows the standard Electron two-process model: a privileged **Main Process** that owns the OS integration layer and a sandboxed **Renderer Process** that runs the UI. All communication between them goes through a strictly typed IPC bridge exposed via Electron's `contextBridge`.

```
┌─────────────────────────────────────────────────────────────────────┐
│  RENDERER PROCESS  (sandboxed, contextIsolation: true)              │
│                                                                     │
│  index.html  ──loads──►  js/main.js         (core UI + features)   │
│                          js/radar.js         (live network radar)   │
│                          js/network-intelligence.js  (analytics)   │
│                          js/network-toolkit.js  (net tools)        │
│                          js/security-toolkit.js  (sec tools)       │
│                          js/desktop.js       (Electron glue)       │
│                          js/ping.js / js/sounds.js                 │
│                                                                     │
│              window.aegis  ◄──contextBridge──►                     │
├─────────────────────────────────────────────────────────────────────┤
│  MAIN PROCESS  (Node.js, full OS access)                            │
│                                                                     │
│  electron/main.js     BrowserWindow · Tray · IPC handlers          │
│                        Background monitor · Port scanner            │
│                        Traceroute · ARP scan · SSL checker          │
│                        electron-store (settings + data)             │
│                                                                     │
│  electron/preload.js  contextBridge surface (window.aegis API)     │
└─────────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
  Cloudflare Workers proxy           OS / system tools
  (CORS gateway for all              (netstat, tracert/traceroute,
   external APIs)                     arp, ipconfig/ip addr)
```

Renderer-facing external calls (Claude API, NVD API, ip-geolocation, RSS feeds) go through a Cloudflare Worker that adds the necessary CORS and authentication headers, keeping credentials out of the renderer bundle. A small number of calls that require the machine's real IP (ipify, DNS DoH checks) bypass the proxy by design.

### Multi-Window Architecture

Aegis supports spawning any page into a separate `BrowserWindow` (detached windows). All windows share the same `index.html` entry point; the detached window receives a `?page=<name>` query parameter that the renderer intercepts at startup to skip the splash screen and navigate directly to the requested page. A `detachedWindows` Map in the main process tracks all open secondary windows so minimize/restore commands on the tray can affect all windows together.

**SOC Presets** — one-click multi-monitor layouts:
- `single` — main window maximised on primary display
- `dual` — main window + Network Intelligence on secondary display
- `triple` — adds Network Monitor on a third display

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| App framework | Electron | ^33.0.0 | Cross-platform desktop shell |
| Runtime | Node.js | 22 (CI) | Main process environment |
| Frontend | Vanilla HTML/CSS/JS | — | No framework, zero build step |
| Persistence | electron-store | ^8.1.0 | JSON key-value store on disk |
| Auto-update | electron-updater | ^6.3.0 | GitHub Releases delta updates |
| Auto-launch | auto-launch | ^5.0.6 | OS startup registration |
| Map tiles | Leaflet | ^1.9.4 | IP geolocation & live-connections map |
| AI | Claude API (Anthropic) | claude-sonnet-4-6 | Briefings, CVE explainer, Ask Aegis chat |
| Threat intel | NVD REST API v2 | — | CVE feed (30-day window, 20 results) |
| Geolocation | ipwho.is | — | IP → country / ISP / coordinates |
| IP resolution | api64.ipify.org | — | Public IP detection |
| DNS over HTTPS | dns.google | — | DNS resolution and DoH checks |
| Breach check | HaveIBeenPwned k-anon API | — | Password breach lookup (SHA-1 prefix) |
| News feeds | rss2json.com | — | Security RSS aggregation |
| CORS proxy | Cloudflare Workers | — | Proxies authenticated API calls |
| CI/CD | GitHub Actions | — | Windows / macOS / Linux builds |
| Installer (Win) | NSIS via electron-builder | ^25.0.0 | Windows NSIS installer |
| Package (macOS) | DMG via electron-builder | — | Universal x64 + arm64 |
| Package (Linux) | AppImage via electron-builder | — | Portable Linux binary |

---

## File Structure

### `electron/main.js`

The entire Main Process. Responsibilities:

- **Window management** — creates `BrowserWindow` with `contextIsolation: true` and `nodeIntegration: false`; handles minimize/maximize/close events; persists window bounds across sessions; shows window on `dom-ready` (not `ready-to-show`) to avoid hiding the splash animation
- **Tray** — creates system-tray icon with three state icons (`tray-icon.png`, `tray-icon-alert.png`, `tray-icon-monitor.png`); context menu with quick-action items; single-click toggles all windows
- **Background network monitor** — polls public IP via ipify every N minutes (configurable); fires an `incident` IPC event and tray notification when the IP changes; persists the incident to the `incidents` store
- **IPC handlers** — exposes ~50 `ipcMain.handle` and `ipcMain.on` channels covering settings, database CRUD, window controls, tray status, notifications, SSL checking, port scanning, network device scan, traceroute, active connections, and multi-window management
- **Traceroute** — spawns `tracert` (Windows) or `traceroute` (POSIX) as a child process; streams hop-by-hop results back to the renderer via `traceroute-hop` events; handles DNS pre-resolution before launching
- **Local port scanner** — uses Node's `net.Socket` to probe 12 well-known ports on `127.0.0.1` with a 500 ms timeout; no admin rights required
- **Network device scan** — detects own IP and gateway using platform-appropriate commands (`ipconfig` / `ifconfig` / `ip addr`); TCP-probes all 254 host addresses in the subnet in batches of 50; reads the ARP table to correlate MAC addresses; resolves hostnames with `dns.reverse()`; returns enriched device list
- **Device blocking** — wraps `netsh advfirewall` to add/remove inbound firewall rules for a given IP (Windows only)
- **SSL certificate checker** — connects via Node `tls.connect` to port 443; extracts validity dates, SANs, issuer, signature algorithm, TLS protocol, and authorization status without requiring a CA-validated connection
- **Auto-updater** — wires `electron-updater` in packaged builds only; checks immediately on startup and every 4 hours; prompts the renderer via `update-available` / `update-error` events
- **Single-instance lock** — calls `app.requestSingleInstanceLock()`; second instance focuses the existing window instead of opening a duplicate
- **Global shortcut** — registers F11 for fullscreen toggle

### `electron/preload.js`

The only code that bridges Main and Renderer. Uses `contextBridge.exposeInMainWorld` to expose a single `window.aegis` object containing:

- Window controls (`minimize`, `maximize`, `close`, `quitApp`, `hide`, `isMaximized`)
- Settings accessors (`getSetting`, `setSetting`, `getAllSettings`, `setAutoLaunch`)
- Database CRUD for all six data collections (IP history, briefings, incidents, network scans, radar readings, chat history, CVE explanations)
- System actions (`scanLocalPorts`, `getActiveConnections`, `checkSSL`, `scanNetworkDevices`, `blockDevice`, `unblockAllDevices`)
- Event subscriptions (`onConnectivityChange`, `onIncident`, `onTriggerScan`, `onNavigateTo`, `onWindowMaximized`)
- Auto-update (`checkForUpdates`, `installUpdate`, `onUpdateAvailable`)
- Multi-window (`openDetachedWindow`, `setSocPreset`, `openMiniRadar`)
- Platform identifier via `window.aegisPlatform` (used for macOS traffic-light title bar)

Also exposes `window.aegisPlatform` as `process.platform` so the renderer can apply platform-specific styling without any Node.js access.

### `js/main.js`

The largest renderer file (~3,000 lines). Contains:

- **Splash screen** — animated canvas data-streams and shield-perimeter glow; 5-step progress bar; 3.3 s sequence; detached windows skip the splash entirely
- **Navigation** — `navigateTo(page)` switches active `.page` divs and updates the sidebar; keyboard shortcuts are wired in `desktop.js`
- **Mini-radar detached window** — when `?page=mini-radar` is detected, replaces the entire body with a compact 320×380 always-on-top widget that polls stored radar history every 30 s
- **Live clock** — ticks every second; toggles between Athens EET and UTC on click
- **Password Health** — client-side entropy calculation (`charset × log₂` formula); crack-time estimator; 11 security checks (length, character classes, patterns, keyboard walks, common passwords); HaveIBeenPwned k-anonymity check using `crypto.subtle.digest` — the full password is never transmitted, only the 5-character SHA-1 prefix
- **IP Investigator** — resolves domain to IP via Google DoH; calls ipwho.is through proxy; correlates result against `KNOWN_SAFE` and `KNOWN_MALICIOUS` prefix lists; computes threat score 0–100; renders Leaflet dark map with pulse ring; WHOIS enrichment; PTR reverse lookup; PDF export via `window.print()`
- **CVE Feed** — calls NVD REST API v2 for last 30 days (20 results); parses CVSS v3.1 / v3.0 / v2.0 metrics; filters by severity and keyword search; `openCVEModal()` launches an overlay that immediately shows NVD data then calls Claude for AI analysis (prompt uses description only to avoid training-data refusals)
- **AI Briefing** — four style prompts (analyst / executive / technical / incident); injects top-10 CVEs from the loaded feed as context; calls `claude-sonnet-4-6` with up to 1,000 output tokens; parses threat level from response text; `renderBriefingMarkdown()` converts Markdown to styled HTML including code blocks and tables; history saved to electron-store
- **Security News** — fetches three RSS feeds (The Hacker News, BleepingComputer, Dark Reading) through rss2json.com; auto-categorises headlines by keyword matching; thumbnail with graceful fallback to category icon

### `js/radar.js`

Real-time network health monitoring rendered on a 220×220 Canvas element.

- **Radar canvas** — four axes (LAT, IP, VPN, DNS); three concentric rings; animated sweep trail (32 arc slices with opacity decay); metric dots plotted on each axis based on latest reading
- **Sparkline** — 30-point latency history in a secondary canvas; dashed threshold line at 150 ms
- **Sampling** — every 30 seconds: measures latency to three targets (Cloudflare, Google, 8.8.8.8) and takes the minimum; fetches public IP via ipify; enriches with ISP / VPN / geo via ipwho.is proxy; checks DNS via Google DoH; detects IP change, ISP change, DNS state change, and VPN drop
- **Anomaly detection** — compares each reading to the previous sample; fires desktop notifications, tray status changes, incident log entries, and sound alerts for detected events
- **Threat level** — `CRITICAL` if any anomaly in the last 30 minutes has severity CRITICAL; `ELEVATED` for WARNING; `LOW` otherwise
- **History** — up to 120 readings in memory; persisted to electron-store via `window.aegis.addRadarReading`; restored on startup so history survives app restarts; mini-radar window reads from the store instead of sampling

### `js/network-intelligence.js`

Analytical view over the radar data.

- Computes stability score (100 − latency/5, averaged over last 10 readings), average latency, jitter (max − min of last 10), and inferred network type from ISP name
- Renders live metric cards updated on the 30-second radar interval
- Historical charts with selectable time ranges (1h / 6h / 24h)
- Uptime ticker

### `js/network-toolkit.js`

Sub-tabbed toolkit with four tools:

1. **Traceroute Visualiser** — resolves target via Google DoH; calls `window.aegis.startTraceroute`; receives `traceroute-hop` stream events; enriches each hop with geolocation via ipwho.is proxy; plots hops on a Leaflet dark world map with polyline; shows hop table with latency colour-coding
2. **Speed Test** — measures download/upload speed via Cloudflare's speed-test endpoint through the proxy
3. **MAC Address Lookup** — looks up vendor OUI via macvendors.com through the proxy
4. **DNS Records** — queries all common record types (A, AAAA, MX, TXT, NS, CNAME, SOA) via Google DoH

Live Connections sub-tab (`js/network-toolkit.js`): calls `window.aegis.getActiveConnections` every 10 seconds; enriches each public IP with geolocation; plots connections on a Leaflet world map with arc lines; auto-detects game servers; shows process name and PID on Windows.

### `js/security-toolkit.js`

Sub-tabbed toolkit with five tools:

1. **Ask Aegis** — persistent chat with `claude-sonnet-4-6`; system prompt: "You are Aegis AI, a senior cybersecurity analyst assistant"; conversation history persisted to electron-store; Markdown rendered with `renderBriefingMarkdown`
2. **SSL Certificate Checker** — calls `window.aegis.checkSSL(domain)`; displays validity window, days remaining, issuer, SANs, TLS protocol, signature algorithm, and authorization status with colour-coded health badge
3. **Hash Tools** — client-side `crypto.subtle.digest` for MD5 (via custom implementation), SHA-1, SHA-256, SHA-512; supports text input and file hashing via `FileReader`; hash comparator
4. **DNS Inspector** — queries A, AAAA, MX, TXT, NS, CNAME, SOA records via Google DoH; includes reverse DNS lookup
5. **CVE Explainer** — standalone CVE lookup that calls Claude with the NVD description

### `js/desktop.js`

Electron integration glue loaded after `main.js`:

- Adds `.has-titlebar` and `.macos` CSS classes to `document.body` when running inside Electron
- Syncs the custom title-bar page label with sidebar navigation
- Listens for `window-maximized` IPC events to update the maximize button icon
- Wires **keyboard shortcuts** (see [Keyboard Shortcuts](#keyboard-shortcuts) in the User Guide)
- `refreshCurrentPage()` — re-triggers the active page's load function
- `loadDashboard()` — initialises the radar and all dashboard stat cards

### `css/style.css`

Single stylesheet (~2,000 lines). Key design tokens:

```css
--bg-primary:    #020818   /* near-black navy base */
--bg-secondary:  #060d1f   /* card backgrounds     */
--bg-card:       #0d1526   /* elevated surfaces    */
--amber:         #f59e0b   /* primary accent       */
--border:        #1e2d4a   /* subtle dividers      */
--font-title:    'Orbitron'   /* headings            */
--font-mono:     'IBM Plex Mono' /* data / labels   */
--font-ui:       'Inter'      /* body text          */
```

Uses CSS custom properties throughout; no CSS framework. Includes animations for the splash screen, blinking status indicators, and the briefing loading bar.

### `index.html`

Single-page shell. Contains all page `<div id="page-*">` containers, the sidebar navigation, the custom title bar, and the splash screen markup. Loads all JS files at the bottom of `<body>`. Leaflet CSS/JS loaded from `node_modules/leaflet/dist/` (bundled, no CDN dependency at runtime).

---

## API Integrations

All authenticated or CORS-restricted calls go through the Cloudflare Worker proxy at `https://aegis-proxy.ka-mixalis99.workers.dev/?url=<encoded-target>`.

| API | Endpoint | Auth method | Via proxy |
|-----|----------|-------------|-----------|
| Anthropic Claude | `api.anthropic.com/v1/messages` | API key in Worker | Yes |
| NVD CVE API v2 | `services.nvd.nist.gov/rest/json/cves/2.0` | API key in Worker | Yes |
| ipwho.is geolocation | `ipwho.is/<ip>` | None (rate-limited) | Yes |
| whoisjson.com | `whoisjson.com/api/v1/whois` | None | No |
| ipify public IP | `api64.ipify.org?format=json` | None | No (intentional — proxy IP ≠ machine IP) |
| Google DoH | `dns.google/resolve` | None | No |
| HaveIBeenPwned | `api.pwnedpasswords.com/range/<prefix>` | None | No |
| rss2json.com | `api.rss2json.com/v1/api.json` | None | No |
| Cloudflare speed | Cloudflare speed test endpoint | None | Via proxy |
| macvendors.com | MAC OUI lookup | None | Via proxy |

The Cloudflare Worker acts as a transparent forwarding proxy. It adds `x-api-key` (Anthropic) and `apiKey` (NVD) headers from Worker environment variables before forwarding the request, so no credentials appear in the renderer bundle or network inspector within the app.

---

## Electron IPC Bridge

The `window.aegis` object exposed by `preload.js` is the only channel between renderer and main process. The renderer cannot call Node.js APIs directly.

**Pattern — invoke/handle (request/response):**
```js
// renderer
const result = await window.aegis.scanNetworkDevices();

// preload
scanNetworkDevices: () => ipcRenderer.invoke('scan-network-devices')

// main
ipcMain.handle('scan-network-devices', async () => { /* ... */ });
```

**Pattern — send/on (fire-and-forget or streaming):**
```js
// renderer — start streaming traceroute
window.aegis.startTraceroute('8.8.8.8');
window.aegis.onTracerouteHop((hop) => renderHop(hop));
window.aegis.onTracerouteDone((result) => finalize(result));

// preload
startTraceroute: (target) => ipcRenderer.send('start-traceroute', target)
onTracerouteHop: (cb) => ipcRenderer.on('traceroute-hop', (_, hop) => cb(hop))
```

**Pattern — main → renderer events (push notifications):**
```js
// main sends
mainWindow.webContents.send('incident', incidentObject);
mainWindow.webContents.send('connectivity-change', false);

// renderer registers
window.aegis.onIncident((incident) => handleIncident(incident));
window.aegis.onConnectivityChange((online) => updateStatus(online));
```

All IPC channel names are strings defined once in `main.js` and mirrored in `preload.js`. There is no shared constants file — the two files must be kept in sync manually.

---

## Persistent Storage

Aegis uses **electron-store** (a JSON file wrapper around Electron's `app.getPath('userData')`) with two separate store instances:

### Settings store (`electron-store` default)

Persists user preferences. Defaults:

```js
{
  autoLaunch:      false,
  monitorInterval: 5,          // minutes
  notifications: {
    ipChange: true,
    vpnDrop:  true,
    criticalCVE: true,
    anomaly: true
  },
  windowBounds: { width: 1400, height: 900 },
  theme:         'dark',
  socPreset:     'single',
  startupPreset: false,
  justUpdated:   false
}
```

### Data store (`name: 'aegis-data'`)

Persists application data. Collections and retention limits:

| Collection | Max items | TTL |
|-----------|-----------|-----|
| `ipHistory` | 50 | Never (manual clear) |
| `networkScans` | Unbounded | 30 days |
| `briefingHistory` | 10 | Never |
| `incidents` | 500 | Never |
| `radarReadings` | 1,000 | Never |
| `chatHistory` | 50 | Never |
| `cveExplanations` | 10 | Never |

Both stores are written to `%APPDATA%\Aegis\` on Windows, `~/Library/Application Support/Aegis/` on macOS, and `~/.config/Aegis/` on Linux.

---

## CI/CD Pipeline

Defined in `.github/workflows/build.yml`. Three parallel jobs triggered on push to `main` and on GitHub release publication.

```
push to main / release published
         │
         ├─► build-windows  (windows-latest)
         │     npm install
         │     electron-builder --win --x64 --publish never
         │     upload-artifact: dist/Aegis Setup*.exe
         │     on release: upload to GitHub Release + dist/latest.yml
         │
         ├─► build-mac  (macos-latest)
         │     npm install
         │     sips + iconutil  (generate icon.icns)
         │     electron-builder --mac --publish never
         │     upload-artifact: dist/*.dmg
         │     on release: upload to GitHub Release + dist/latest-mac.yml
         │
         └─► build-linux  (ubuntu-latest)
               apt install rpm
               npm install
               electron-builder --linux --publish never
               upload-artifact: dist/*.AppImage
               on release: upload to GitHub Release + dist/latest-linux.yml
```

`CSC_IDENTITY_AUTO_DISCOVERY: false` disables code-signing certificate discovery so unsigned builds succeed in CI. The `PUBLISH_FOR_PULL_REQUEST: false` flag prevents accidental uploads from PR builds.

The `dist/latest.yml` file (generated by electron-builder) is uploaded alongside the installer and is read by `electron-updater` in installed copies to determine whether an update is available.

**Auto-update flow in packaged builds:**
1. App starts → `updater.checkForUpdates()` fires after 5 s
2. Check runs every 4 hours thereafter
3. `update-available` event sent to renderer with new version string
4. User clicks "Update" → `updater.downloadUpdate()` → `quitAndInstall(false, true)`

---

## Security Considerations

### Renderer sandbox
`contextIsolation: true` and `nodeIntegration: false` are set on every `BrowserWindow`. The renderer has no direct access to Node.js APIs. All privileged operations go through the typed `window.aegis` IPC surface.

### Credential handling
API keys (Anthropic, NVD) are stored exclusively in Cloudflare Worker environment variables. They never appear in the packaged app bundle, in network requests visible inside the Electron DevTools, or in any local config file.

### Password breach check (k-anonymity)
The full password is never transmitted. The browser computes a SHA-1 hash client-side using `crypto.subtle.digest`, sends only the first 5 hex characters (prefix) to HaveIBeenPwned, and matches the suffix locally in the returned list.

### Local network operations
Port scanning and network device discovery operate against `127.0.0.1` and the local subnet only. Device blocking (`netsh advfirewall`) uses a sanitised IP (`ip.replace(/[^0-9.]/g, '')`) to prevent command injection.

### External URL handling
All `<a target="_blank">` links call `shell.openExternal()` through IPC rather than opening in the Electron renderer, preventing navigation to arbitrary URLs within the app context.

### Content Security
`webSecurity: true` and `allowRunningInsecureContent: false` are set on all `BrowserWindow` instances. No mixed content.

### Single-instance lock
`app.requestSingleInstanceLock()` prevents multiple simultaneous instances, which would otherwise create race conditions writing to the shared electron-store files.
