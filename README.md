# Aegis — Personal Security Intelligence

A desktop security tool I built for myself that turned into something I'm genuinely proud of.

Aegis runs in your system tray and keeps an eye on your network, threat feeds, and security posture — so you always know what's going on without having to check anything manually.

Built with Electron. Runs on Windows, macOS, and Linux.

---

## What it does

**Network monitoring** — live radar on your dashboard tracking latency, IP changes, VPN status, and DNS. Alerts you when something changes. Stores everything in SQLite so you can see trends over time.

**CVE Threat Feed** — pulls from NVD every time you open it. Filter by severity, search by keyword, get an AI explanation of any vulnerability with one click.

**AI Security Briefing** — generates a daily threat intelligence report using Claude. Analyst style, executive style, incident response focus — your choice.

**IP Investigator** — look up any IP or domain, get full geolocation, ISP, threat score, and a map. Checks against known malicious ranges including Greek ISP database.

**Security Toolkit** — Ask Aegis (AI chat), DNS inspector, hash generator/verifier, CVE explainer.

**Network Toolkit** — traceroute visualizer, DNS records lookup, speed test, MAC address lookup.

**Password Health** — entropy, crack time, breach check via HaveIBeenPwned k-anonymity (your password never leaves your machine).

**Multi-monitor SOC mode** — open different pages across multiple screens with one click.

---

## Stack

- Electron + vanilla HTML/CSS/JS
- better-sqlite3 for local storage
- Claude API (Anthropic) for AI features
- NVD API for CVE data
- Cloudflare Workers as proxy

---

## Download

[→ Latest release](https://github.com/MichalisKampouridis/Aegis/releases/latest)

---

## Installation

**Windows**
1. Download `Aegis-Setup-1.0.0.exe` from the latest release
2. Run the installer
3. Launch Aegis from the Start Menu or Desktop shortcut

**macOS**
1. Download `Aegis-1.0.0.dmg` from the latest release
2. Open the .dmg file
3. Drag Aegis to your Applications folder
4. Right-click Aegis → Open (first launch only, to bypass Gatekeeper)

**Linux**
1. Download `Aegis-1.0.0.AppImage` from the latest release
2. Make it executable: `chmod +x Aegis-1.0.0.AppImage`
3. Run it: `./Aegis-1.0.0.AppImage`

---

## Why I built this

I wanted a tool I'd actually use every day — something that sits in my tray, monitors my connection, and keeps me informed about current threats without me having to open five different browser tabs. Everything in Aegis is something I found myself doing manually and decided to automate.

---

## About

Built by Michalis Kampouridis — cybersecurity student from Greece.

[LinkedIn](https://www.linkedin.com/in/michalis-kampouridis-704051397/)
