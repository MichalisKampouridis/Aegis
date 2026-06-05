# Aegis — User Guide

> Version 1.0.11 · Personal Security Intelligence Dashboard

---

## Table of Contents

1. [Installation](#installation)
2. [Getting Started](#getting-started)
3. [Features](#features)
   - [Dashboard](#dashboard)
   - [Network Intelligence](#network-intelligence)
   - [Password Health](#password-health)
   - [IP Investigator](#ip-investigator)
   - [CVE Feed](#cve-feed)
   - [AI Briefing](#ai-briefing)
   - [Security News](#security-news)
   - [Network Monitor](#network-monitor)
   - [Security Toolkit](#security-toolkit)
   - [Network Toolkit](#network-toolkit)
   - [Live Connections](#live-connections)
   - [Settings](#settings)
4. [Keyboard Shortcuts](#keyboard-shortcuts)
5. [FAQ](#faq)
6. [Troubleshooting](#troubleshooting)

---

## Installation

### Windows

1. Go to the [latest release](https://github.com/MichalisKampouridis/Aegis/releases/latest) and download `Aegis Setup 1.0.11.exe`
2. Run the installer — you can choose a custom install directory
3. Launch Aegis from the Start Menu shortcut or the Desktop shortcut
4. Aegis will appear in your system tray when running

> **Note:** Windows may show a SmartScreen warning for unsigned apps. Click **More info → Run anyway** to proceed.

### macOS

1. Download `Aegis-1.0.11-arm64.dmg` (Apple Silicon) or `Aegis-1.0.11.dmg` (Intel Mac)
2. Open the `.dmg` file and drag **Aegis** into your **Applications** folder
3. On first launch, right-click the app icon → **Open** to bypass Gatekeeper
4. Subsequent launches work normally from Spotlight or the Dock

### Linux

1. Download `Aegis-1.0.11.AppImage` from the [latest release](https://github.com/MichalisKampouridis/Aegis/releases/latest)
2. Make it executable:
   ```bash
   chmod +x Aegis-1.0.11.AppImage
   ```
3. Run it:
   ```bash
   ./Aegis-1.0.11.AppImage
   ```
4. Optionally, integrate it into your desktop environment using a `.desktop` file

---

## Getting Started

When you first launch Aegis, a brief splash screen loads the security modules and connects to threat feeds. The main window then opens maximised.

**What happens in the background immediately:**
- A radar reading is taken (measures latency, detects your public IP, checks DNS, checks VPN status)
- The background network monitor starts polling every 5 minutes for IP changes
- The system-tray icon appears — Aegis continues running even when the window is closed

**Recommended first steps:**
1. Open **Settings** (sidebar or `Ctrl+0`) and enter your Claude API key if you want AI features
2. Set your preferred monitoring interval under **Settings → General**
3. Visit **Network Intelligence** to see your first real-time data
4. Visit **CVE Feed** to pull the latest vulnerability data — this enriches AI Briefings

---

## Features

### Dashboard

The main overview page, visible at startup.

**Threat Level Banner** — shows CRITICAL / ELEVATED / LOW based on radar anomalies detected in the last 30 minutes. The colour and border of the banner change accordingly.

**Stat Cards:**
- **Radar Readings** — how many network samples have been collected this session. Click to open the Radar Samples modal
- **Incidents** — count of logged events (IP changes, VPN drops, high latency). Click to review them
- **Active CVEs** — count of loaded CVEs from the last feed refresh
- **Uptime** — session duration since Aegis was last opened

**Radar Widget** — an animated circular radar with four axes:
- **LAT** (top) — latency: green below 150 ms, amber 150–300 ms, red above 300 ms
- **IP** (right) — public IP stability: red if your IP has just changed
- **VPN** (bottom) — VPN state: green if protected, red if just dropped
- **DNS** (left) — DNS health: red if DNS resolution just failed

Below the radar, a **Sparkline** shows the last 30 latency readings with a 150 ms threshold line.

**Anomaly Feed** — the last 5 detected anomaly events with timestamp and severity badge. Click **SCAN NOW** to take an immediate radar reading.

---

### Network Intelligence

A deeper analytical view of your network health over time.

**Metric Bar** — five cards updated every 30 seconds:
- **Stability** — 0–100 score derived from recent latency readings
- **Avg Latency** — mean latency across the last 10 samples
- **Packet Loss** — shown when detectable
- **Jitter** — spread between min and max latency in the last 10 samples (lower is better)
- **Network Type** — HOME, MOBILE, or PUBLIC based on ISP name

**Historical Charts** — latency and VPN status plotted over selectable time ranges: 1h, 6h, or 24h. Points are colour-coded by severity.

**Live Panel** — connection status, current IP, ISP, VPN state, and DNS health, all updating on the radar's 30-second cycle.

**Sample Log** — a table of recent radar readings with columns for time, latency, jitter, IP status, VPN, DNS, and overall status. Click any row to see full details.

> **Tip:** You can pop Network Intelligence into its own window — useful on a second monitor. Right-click the page title or use **Settings → SOC Preset → Dual**.

---

### Password Health

A fully client-side password analyser — nothing leaves your machine.

**Analyse a Password:**
1. Type or paste a password into the input field
2. Click the eye icon to show/hide the password
3. Results update as you type

**What is analysed:**
- **Strength grade** (F through A+) and strength bar
- **Entropy** in bits — how much randomness the password contains
- **Estimated crack time** — from "Instantly" to "Billions of years", based on 1 trillion guesses per second
- **Security checks** — 11 criteria including length thresholds, character classes, repeated characters, sequential patterns (abc, 123), keyboard walks (qwerty, asdf), and a list of common passwords
- **Recommendations** — specific suggestions for improvement
- **HaveIBeenPwned breach check** — checks against billions of leaked passwords using k-anonymity. Only a 5-character SHA-1 prefix is sent; your actual password is never transmitted

**Generate a strong password:**
Click **GENERATE** to create a cryptographically random 16-character password with mixed case, numbers, and symbols. It is automatically copied to your clipboard.

---

### IP Investigator

Look up any IP address or domain to get full threat intelligence.

**To investigate:**
1. Type an IP address or domain name in the input field
2. Press **Enter** or click **INVESTIGATE**
3. Click **MY IP** to automatically investigate your own current public IP

**Results include:**
- **Threat level** — TRUSTED, CLEAN, SUSPICIOUS, or HIGH THREAT with a 0–100 threat score
- **Threat indicators** — explains why the score was assigned (known malicious range, proxy/VPN detected, datacenter-hosted, high-risk country)
- **Network intelligence** — reverse DNS (PTR record), country, region, city, ISP, organisation, ASN, coordinates, proxy/VPN flag, datacenter flag
- **WHOIS data** — registrar, registrant, creation and expiry dates (for domains)
- **Geolocation map** — dark world map with a pulsing pin at the IP's approximate location
- **Export** — copy the full report as text or export as a print-friendly PDF

**Search history** — your last 10 lookups appear in the sidebar panel. Click any entry to re-run it.

**Note on private IPs:** Entering a private range address (10.x.x.x, 192.168.x.x, etc.) shows a purple "PRIVATE / INTERNAL IP" result — these cannot be geolocated.

---

### CVE Feed

Live feed of vulnerabilities from the NIST National Vulnerability Database (NVD).

**Loading the feed:**
The feed loads automatically when you navigate to this page. It pulls the most recent 20 CVEs published in the last 30 days.

**Each CVE card shows:**
- CVE ID, severity badge (CRITICAL / HIGH / MEDIUM / LOW), and CVSS score
- Keyword tags (Windows, Linux, Apache, Chrome, etc.) when matched
- Short description (expandable with the **▼ MORE** button)
- Published and last-modified dates
- Reference links (when expanded)

**Filtering and searching:**
- Click severity buttons at the top to filter by CRITICAL, HIGH, MEDIUM, or LOW
- Type in the search bar to filter by CVE ID or keywords in the description

**AI Explanation:**
Click **⚡ EXPLAIN** on any CVE card to open an analysis modal. The modal shows the NVD description immediately, then calls Claude to provide:
1. Vulnerability type
2. How the attack works
3. Affected systems
4. Real-world impact
5. Remediation steps

---

### AI Briefing

AI-generated daily threat intelligence reports powered by Claude.

**Generating a briefing:**
1. Select a **report style**:
   - **Analyst** — for the security team; professional and clear
   - **Executive** — for management; focuses on business risk, non-technical
   - **Technical** — for engineers; includes attack vectors and CVE specifics
   - **Incident Response** — focuses on immediate threats and prioritised actions
2. Optionally enter a **focus area** (e.g., "cloud infrastructure", "ransomware", "critical CVEs")
3. Click **⚡ GENERATE BRIEFING**
4. Click **■ STOP** at any time to cancel generation

**What the briefing contains:**
- Threat level rating (LOW / ELEVATED / HIGH / CRITICAL)
- Executive summary
- Key findings (3–5 bullet points)
- Critical vulnerabilities from the loaded CVE feed
- Recommended actions
- Analyst note

**Exporting:**
- **COPY** — copies the full text to your clipboard
- **⬇ PDF** — opens the browser print dialog for a formatted PDF

**History** — up to 3 previous briefings are shown at the bottom of the page with a preview excerpt.

> **Tip:** Load the CVE Feed first. The briefing engine injects the top 10 current CVEs as context, making the analysis more relevant.

---

### Security News

Live headlines from three major cybersecurity sources: **The Hacker News**, **BleepingComputer**, and **Dark Reading**.

News loads automatically when you navigate to this page. Each headline card shows:
- **Category badges** — auto-detected from keywords: RANSOMWARE, MALWARE, BREACH, HACK, PHISHING, VULNERABILITY, EXPLOIT, ZERO-DAY, PATCH, APT, etc.
- **Source** and relative time (e.g., "2h ago")
- Article thumbnail (with icon fallback if the image fails to load)
- Short excerpt

Click any card to open the full article in your default browser.

Use the **search bar** to filter headlines by keyword.

---

### Network Monitor

A comprehensive local network security panel.

**VPN Status** — detects whether your connection is routing through a VPN by inspecting the ISP name from ipwho.is. Shows PROTECTED (green) or UNPROTECTED.

**DNS Leak Test** — sends DNS queries and reports the servers actually resolving them. Flags if results differ from expected.

**Local Port Scanner** — scans 12 sensitive ports on your own machine:

| Port | Service |
|------|---------|
| 21 | FTP |
| 22 | SSH |
| 23 | Telnet |
| 25 | SMTP |
| 80 | HTTP |
| 443 | HTTPS |
| 3389 | RDP |
| 4444 | Metasploit |
| 5900 | VNC |
| 6881 | BitTorrent |
| 8080 | HTTP Alt |
| 8443 | HTTPS Alt |

Ports marked **OPEN** are listening on localhost. Investigate any unexpected open port.

**Ping Tool** — sends ICMP pings to a target you specify; shows response time and packet loss.

**Network Device Scanner** — scans your local subnet (e.g., 192.168.1.0/24) to discover all connected devices. For each device shows:
- IP address, MAC address, hostname
- Whether it is your own device or the gateway
- Device status

Click **BLOCK** next to any device to add a Windows Firewall inbound-block rule for that IP. Click **UNBLOCK ALL** to remove all Aegis-created rules.

> **Note:** Device blocking requires administrator privileges on Windows.

**Incident Log** — a time-stamped list of all detected events (IP changes, VPN drops, high latency, anomalies) with severity badges. Click **EXPORT** to save as JSON. Click **CLEAR** to wipe the log.

---

### Security Toolkit

Five specialised security tools in a tabbed interface.

#### Ask Aegis

A persistent chat with an AI cybersecurity analyst powered by Claude. Ask about:
- CVE details and exploitation techniques
- Hardening advice for specific systems
- Log analysis and threat hunting
- Incident response procedures
- Security architecture questions

Conversation history is saved locally and restored when you re-open the app. Click **CLEAR** to start a fresh conversation.

#### SSL Certificate Checker

Inspect the SSL/TLS certificate of any domain.

Enter a domain (e.g., `example.com`) and click **CHECK**. Results show:
- Validity window (valid from / valid to) and days remaining
- Expiry status with colour-coded badge (green / amber / red)
- Subject and issuer names
- Subject Alternative Names (SANs)
- TLS protocol version (TLS 1.2, TLS 1.3, etc.)
- Signature algorithm (RSA-2048, ECDSA P-256, etc.)
- Serial number and SHA-256 fingerprint
- Whether the domain name matches the certificate

#### Hash Tools

Client-side hash generation — no data is uploaded.

- Type text or drop a file to compute its MD5, SHA-1, SHA-256, or SHA-512 hash
- Use the **comparator** to verify whether two hashes match

#### DNS Inspector

Performs a full DNS records lookup for any domain.

Returns all available record types: **A**, **AAAA**, **MX**, **TXT**, **NS**, **CNAME**, **SOA** — plus a **reverse DNS (PTR)** lookup if you enter an IP address. Results come from Google's DNS-over-HTTPS API.

#### CVE Explainer

Look up a specific CVE by ID to get an AI-powered explanation from Claude. Useful for CVEs that weren't in the current feed window.

---

### Network Toolkit

Four network diagnostic tools in a tabbed interface.

#### Traceroute Visualiser

Visualises the route from your machine to any destination.

1. Enter a domain or IP address
2. Click **TRACE** (or **■ STOP** to cancel)
3. Watch hops appear in real time as they are discovered

Each hop is:
- Plotted on a dark world map with connecting lines
- Listed in a table with hop number, IP, hostname, latency, and geolocation
- Colour-coded: green < 50 ms, amber 50–150 ms, red > 150 ms, grey for timeouts

#### Speed Test

Measures your download and upload speed using a Cloudflare endpoint. Click **START TEST** and wait for results.

#### MAC Address Lookup

Enter a MAC address (any format) to look up the manufacturer/vendor from the OUI database.

#### DNS Records

Enter a domain to retrieve all DNS record types in a clean, formatted view — identical to the DNS Inspector in the Security Toolkit but in a standalone tab.

---

### Live Connections

Real-time map of all active outbound network connections from your machine.

- Refreshes every 10 seconds
- Each connection is shown on a world map with an arc from your location to the remote IP
- The connections table lists: remote IP, geolocation (country / city), process name, PID, and latency
- Colour-coded by connection type (game server, browser, work services, etc.)
- Click **TRACE ROUTE** on any connection to immediately run a traceroute to that IP

> **Note:** Process names and PIDs are available on Windows without administrator rights. macOS and Linux show IP addresses only.

---

### Settings

Configure Aegis to match your workflow.

#### General
- **Monitor interval** — how often the background IP monitor checks for changes (1–60 minutes, default 5)
- **Launch at startup** — register Aegis to start with your OS
- **Apply SOC preset on startup** — automatically open the selected multi-monitor layout when Aegis launches

#### Notifications
Toggle individual notification types:
- IP address changed
- VPN connection dropped
- Critical CVE detected
- Network anomaly detected

#### SOC Preset
Configure multi-monitor layouts:
- **Single** — main window only
- **Dual** — main window + Network Intelligence on a second monitor
- **Triple** — main window + Network Intelligence + Network Monitor across three monitors

Click **APPLY** to immediately rearrange windows.

#### Data Management
- View storage usage across all data collections
- Clear individual collections or all data at once

#### About
- Current version number
- Data storage path
- Check for updates (in packaged builds)
- Links to GitHub and documentation

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Navigate to Dashboard |
| `Ctrl+2` | Navigate to Network Intelligence |
| `Ctrl+3` | Navigate to Password Health |
| `Ctrl+4` | Navigate to IP Investigator |
| `Ctrl+5` | Navigate to CVE Feed |
| `Ctrl+6` | Navigate to AI Briefing |
| `Ctrl+7` | Navigate to Security News |
| `Ctrl+8` | Navigate to Network Monitor |
| `Ctrl+9` | Navigate to Security Toolkit |
| `Ctrl+0` | Navigate to Network Toolkit |
| `Ctrl+R` | Refresh / reload the current page |
| `Ctrl+Q` | Hide the window (minimise to tray) |
| `Ctrl+Shift+S` | Navigate to Network Monitor and run a scan |
| `F11` | Toggle fullscreen |
| `Esc` | Close any open modal (CVE explainer, radar samples, etc.) |

> On macOS, substitute `Cmd` for `Ctrl`.

---

## FAQ

**Does Aegis send my passwords anywhere?**
No. Password analysis is entirely client-side. For the HaveIBeenPwned breach check, only the first 5 characters of a SHA-1 hash are sent — your actual password never leaves your machine.

**What data is stored locally?**
Aegis stores: your radar readings (up to 1,000), network scan results (30-day retention), incidents (up to 500), IP investigation history (last 50), AI chat history (last 50 messages), CVE explanations (last 10), and AI briefing history (last 10). All data lives in your OS user-data folder.

**Why does the CVE feed sometimes show fewer than 20 results?**
Some recent CVEs may not have a complete CVSS score yet. The feed always pulls the latest 20 published CVEs; some may be omitted from display if NVD data is incomplete.

**Can I use Aegis offline?**
The radar still samples latency and checks DNS resolution without internet. IP geolocation, CVE feed, AI features, and news headlines all require an internet connection.

**Why can't Aegis block devices on macOS/Linux?**
Device blocking uses `netsh advfirewall`, which is Windows-only. On other platforms the BLOCK button is not shown.

**What is the Cloudflare proxy?**
A small serverless function that forwards requests to external APIs (Claude, NVD, ipwho.is) while adding authentication headers. This keeps API credentials out of the app binary. The proxy does not log or store your requests.

**Does Aegis update automatically?**
Yes, in packaged builds. Aegis checks for updates 5 seconds after launch and every 4 hours thereafter. When an update is available you'll see a notification in Settings. Updates are downloaded only when you click **Install Update** — Aegis never updates silently without your confirmation.

**Will Aegis still monitor if I close the window?**
Yes. Closing the main window minimises Aegis to the system tray. The background IP monitor and tray notifications continue running. Right-click the tray icon and choose **Quit Aegis** to fully exit.

---

## Troubleshooting

**The radar shows no data / "—" everywhere**
The first radar reading takes a few seconds after launch. Wait 10–15 seconds, then click **SCAN NOW** on the Dashboard. If it still shows nothing, check your internet connection.

**CVE Feed fails to load**
This usually means the NVD API or the Cloudflare proxy is temporarily unavailable. Try clicking the **RELOAD** button again after a minute. The NVD API occasionally has brief outages.

**AI Briefing / Ask Aegis returns "API key invalid" or similar error**
Verify your Claude API key in **Settings → About**. The key must start with `sk-ant-` and have sufficient credits on your Anthropic account.

**The app window opens on the wrong screen after restarting**
Aegis always opens on the primary display. If you have changed your primary display in OS settings since last use, the window position may be off. Drag the window to the correct position and restart Aegis to save the new bounds.

**Device scanner finds no devices**
The scanner requires that your machine has an active local network connection. On some systems, the ARP cache may be empty if there has been no recent LAN traffic. Try using the network (e.g., open a browser page) and then run the scan again.

**Port scanner shows unexpected open ports**
Common false positives: port 80 or 8080 may be open if you are running a local web server or development server. Port 22 (SSH) may be open if Remote Login (macOS) or OpenSSH (Windows optional feature) is enabled.

**Traceroute gets stuck or shows all timeouts**
Some network routers and ISPs suppress ICMP TTL-exceeded responses, causing hops to appear as timeouts (`* * *`). This is normal and does not mean the route is broken — the destination hop should still resolve.

**Aegis crashes on startup (Windows)**
Try running as administrator once to let the installer complete any pending setup steps. If the crash persists, delete `%APPDATA%\Aegis\` and restart — this clears all stored data and resets the app to defaults.

**"Aegis is still running" notification appears when I close the app**
This is expected behaviour — closing the window minimises Aegis to the tray. To fully quit, right-click the tray icon and select **Quit Aegis**.
