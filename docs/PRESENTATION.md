# Aegis — Job Interview Presentation Guide

> A structured outline for presenting the Aegis project in a technical interview or portfolio review.
> Recommended duration: 10–15 minutes with live demo, 5–7 minutes slides-only.

---

## 1. What Is Aegis?

**Opening statement (30 seconds):**

> "Aegis is a cross-platform desktop security intelligence platform I built and shipped entirely on my own. It sits in your system tray, monitors your network in real time, pulls live vulnerability data from the NIST database, and gives you a complete security operations toolkit — without opening five different browser tabs."

**Key facts to establish upfront:**
- Live, shipped application — v1.0.11, available on Windows, macOS, and Linux
- Built solo from scratch over several weeks
- 12 distinct feature modules in a single cohesive UI
- Uses a real production CI/CD pipeline and auto-update mechanism
- Integrates Claude AI, NVD API, multiple external data sources

---

## 2. Why I Built It

**The problem it solves:**

Security-conscious developers and IT professionals have to juggle multiple tools and browser tabs every day:
- One tab for checking current CVEs
- Another for IP lookups and threat intelligence
- A terminal open for traceroutes and port scans
- A separate tool for password checks
- Scattered news sources for staying up to date

None of these integrate well, and none of them run in the background watching for network anomalies while you work.

**The personal motivation:**

> "I built the things I found myself doing manually every week and decided to automate. The radar that detects IP changes and VPN drops is something I genuinely use — I wanted to know immediately if my VPN drops or if my IP changes unexpectedly."

**Why a desktop app and not a web app:**

- Needs access to OS-level tools: `tracert`, `netstat`, `arp`, SSL connections, local port scanning
- Background monitoring with tray notifications requires persistent process
- Security data should stay local — no server stores your password entropy tests or network scan results
- Electron was the right tradeoff: write once, ship on all three platforms

---

## 3. Technical Architecture

### The Two-Process Model

```
RENDERER (sandboxed)          MAIN PROCESS (Node.js)
        │                              │
   index.html                   electron/main.js
   js/main.js           ◄─IPC─►  
   js/radar.js          window.aegis   OS tools
   js/security-toolkit.js             electron-store
   js/network-toolkit.js              auto-updater
   js/network-intelligence.js         tray / notifications
```

**Key architecture decision:** `contextIsolation: true` + `nodeIntegration: false`. The renderer is a pure sandboxed browser context. Everything that needs OS access goes through a typed IPC bridge (`window.aegis`) defined in `preload.js`.

**Why this matters to mention:** Many Electron tutorials skip this entirely or disable it for convenience. It's the correct, security-hardened approach, and it was a deliberate design choice.

### The Cloudflare Workers Proxy

All calls to authenticated external APIs (Claude, NVD) go through a Cloudflare Worker. API keys live in Worker environment variables — they never appear in the app binary or network traffic visible inside the app.

**Diagram point:**
```
Renderer → Cloudflare Worker → Claude API
                               NVD API
                               ipwho.is
```

Calls that must use the machine's real IP (public IP detection via ipify, HaveIBeenPwned prefix check) bypass the proxy intentionally — routing them through Cloudflare would return Cloudflare's IP instead of the user's.

### Persistent Storage

`electron-store` provides a JSON key-value store with two instances:
- **Settings store** — user preferences (window bounds, intervals, notification toggles)
- **Data store** — six collections: radar readings (1,000 cap), incidents (500 cap), IP history (50 cap), briefing history (10 cap), network scans (30-day TTL), chat history (50 messages)

**Trade-off to acknowledge:** A proper SQLite instance (the README describes it as such) would be more scalable, but `electron-store` avoids native module compilation issues across three platforms and the data volumes in this application don't need it.

---

## 4. Key Features — Demo Guide

Use this section as a script for a live walkthrough. Show features in this order for maximum impact.

### Demo Sequence (10 minutes)

**1. Splash + Dashboard (1 min)**
- Open the app fresh — show the animated splash screen with data streams and shield glow
- Point out: this isn't decorative. The timing matters — it fires on `dom-ready` rather than `ready-to-show` so the animation is never skipped
- Dashboard: radar spinning, stat cards, anomaly feed

**2. Radar — take a live scan (1 min)**
- Click **SCAN NOW**
- Watch a reading appear: latency dot moves, readouts update, sparkline extends
- Open the **Radar Samples modal** — show the structured table with jitter calculation
- Explain the four axes: LAT, IP, VPN, DNS — what each measures and what "bad" looks like

**3. Password Health (1.5 min)**
- Type a weak password — show the live analysis as you type
- Show entropy bits and crack time estimation
- Type a strong generated password — watch grade jump to A+
- Click **GENERATE** — password is generated and copied instantly
- HaveIBeenPwned breach check fires automatically — show the k-anonymity explanation (only a 5-char SHA-1 prefix is sent)

**4. CVE Feed → AI Explanation (1.5 min)**
- Navigate to CVE Feed — feed loads automatically
- Show the severity bar and filter buttons
- Click **⚡ EXPLAIN** on a CRITICAL CVE
- Modal shows NVD data immediately while Claude generates
- Walk through the AI analysis: type, attack vector, affected systems, remediation

**5. AI Briefing (1.5 min)**
- Navigate to AI Briefing
- Select **Technical** style
- Click Generate — show the loading animation
- Point out: it injects the top 10 CVEs as context before calling Claude
- Show the threat level badge auto-parsed from the response text
- Mention the four style variants and what each is for

**6. IP Investigator (1 min)**
- Click **MY IP** — auto-investigates your own IP
- Show: threat score, geolocation, ISP, proxy/datacenter flags, Leaflet dark map
- Type `8.8.8.8` — show "TRUSTED — Google Public DNS" result

**7. Network Toolkit — Traceroute (1 min)**
- Enter `google.com`
- Watch hops stream in real time
- Point out: each hop is geolocated, plotted on the world map, colour-coded by latency
- Mention: Electron spawns `tracert` as a child process, streams stdout line by line to the renderer

**8. Security Toolkit — SSL Checker (30 sec)**
- Check any well-known domain
- Show: expiry date, days remaining, TLS version, SANs, issuer

**9. Settings — SOC Preset (30 sec)**
- Switch to Dual preset — a second window opens immediately
- Explain the single/dual/triple monitor layout feature
- Switch back to Single

---

## 5. Stack and Tools Used

Present this as deliberate choices, not a list of buzzwords.

| What | Why |
|------|-----|
| **Electron** | Ship one codebase for Windows, macOS, Linux; get OS-level access (netstat, tracert, tray); no VM or Docker dependency |
| **Vanilla JS (no framework)** | Zero build pipeline, zero framework overhead; the UI is event-driven reads from a store — no need for React's reactivity model; bundle size is small |
| **electron-store** | Zero native module compilation; JSON persistence is sufficient for this data volume; works reliably across all three platforms in CI |
| **Claude (claude-sonnet-4-6)** | Best-in-class for structured, technical analysis; produces clean Markdown the app renders inline; used for briefings, CVE explanations, and chat |
| **Cloudflare Workers** | Serverless, zero cold-start proxy; keeps API keys out of the binary; free tier handles the request volume |
| **Leaflet** | Lightweight, no API key required, extensive tile options; the dark CartoDB tile layer matches the UI theme perfectly |
| **GitHub Actions** | Three parallel matrix builds (Windows NSIS, macOS DMG, Linux AppImage); artefacts uploaded to GitHub Releases; `latest.yml` enables electron-updater auto-update |

---

## 6. What I Learned

**Electron security model**
The `contextIsolation` / `contextBridge` / `nodeIntegration: false` combination is the right security posture for Electron apps. Many apps still ship with `nodeIntegration: true`, which exposes the full Node.js runtime to any renderer-side XSS. Understanding this distinction — and implementing it correctly — was a key learning.

**IPC design as an API**
Designing the `window.aegis` surface forced me to think about the IPC layer as a formal API: which operations are request/response (`.handle`), which are streaming (`.on`/`.send`), which are push notifications from main to renderer. Getting this right upfront avoids callback-hell and race conditions in larger Electron apps.

**k-anonymity in practice**
Implementing the HaveIBeenPwned breach check correctly — computing SHA-1 client-side, sending only the first 5 hex characters, matching the suffix in the returned list — demonstrated the k-anonymity privacy model in a real production scenario.

**Cross-platform CI from day one**
Building for Windows, macOS, and Linux in CI from the start exposed issues early: `ipconfig` vs `ifconfig` vs `ip addr` for network detection, `tracert` vs `traceroute` for path tracing, Windows firewall APIs absent on POSIX. Each required platform-aware branching in `main.js`.

**LLM prompt design**
Getting consistent, parseable output from Claude required careful prompt engineering: injecting structured CVE data as context, specifying exact section headings so the app could parse the threat level, and framing CVE explanation prompts using the description text only (not the ID) to avoid training-data refusals on older CVEs.

**Canvas animation performance**
The radar runs at 60 fps in a `requestAnimationFrame` loop alongside the rest of the UI. Keeping it performant required: avoiding layout thrash, caching gradient objects, and correctly cancelling the previous animation loop before re-initialising on page re-entry.

---

## 7. Talking Points for Common Interview Questions

**"Why not just use a web app?"**
> "Several core features require OS access that browsers don't have: spawning traceroute as a child process, reading the ARP table for LAN device discovery, checking locally-listening ports, registering a system-tray icon that persists when the window is closed. Electron gives me the full Node.js runtime in the main process while keeping the UI sandboxed — it was the right tool for this specific use case."

**"How did you handle security in an app that processes security data?"**
> "I enforced Electron's hardened security model: `contextIsolation: true`, `nodeIntegration: false`, all sensitive operations behind a typed IPC bridge. API keys never appear in the renderer or in the binary — they live exclusively in Cloudflare Worker environment variables. The HaveIBeenPwned check uses k-anonymity so the password never leaves the machine. Every external link opens via `shell.openExternal` rather than in the Electron renderer."

**"What would you improve or add next?"**
> "SQLite for proper relational storage — the current electron-store JSON approach works but limits query flexibility. Streaming responses from Claude for the briefing and chat features — real-time token-by-token output would feel more responsive. A proper settings API surface rather than the flat key-value model. And a plugin/extension system so users can add custom threat feeds or alert integrations."

**"How long did it take to build?"**
> "Several weeks of evenings and weekends, working iteratively. I shipped feature by feature — starting with the radar and dashboard, then adding the toolkit pages, then integrating Claude, then building the CI pipeline. The multi-window SOC mode was one of the last additions."

**"Why Vanilla JS and not React/Vue?"**
> "Aegis doesn't need a component framework. The UI is a collection of pages that each read from a central state (the electron-store + radar history) and imperatively update the DOM. There's no shared state that needs two-way binding, no component tree, no virtual DOM reconciliation. Vanilla JS meant no build step, no transpilation, no `node_modules` in the renderer, and the app starts instantly."
