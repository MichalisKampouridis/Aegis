# Aegis — Personal Security Intelligence Platform

![Version](https://img.shields.io/badge/version-1.0.11-f59e0b?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square)
![Electron](https://img.shields.io/badge/built%20with-Electron-47848f?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

A personal security intelligence desktop application built for daily use. Sits in your system tray, monitors your network in real time, pulls the latest CVEs, and gives you a complete security operations toolkit — without opening five different browser tabs.

---

## Features

**Network Intelligence**
Real-time radar detecting anomalies, latency spikes, IP changes, VPN drops, and DNS changes. Stores all data locally in SQLite with 30-day history and clickable heatmap.

**Live Connections Map**
Monitors every active network connection from your machine in real time. Color coded by service, shows which application is making each connection, auto-detects game servers and traces the route automatically.

**CVE Threat Feed**
Pulls directly from the NVD API. Filter by severity, search by keyword, get an AI-powered explanation of any vulnerability with one click.

**AI Security Briefing**
Generates daily threat intelligence reports using Claude AI. Choose from analyst, executive, technical, or incident response styles.

**Security Toolkit**
- SSL Certificate Checker — inspect any domain's certificate, expiry, TLS version
- Hash Tools — MD5, SHA1, SHA256, SHA512, file hashing, comparator
- DNS Inspector — full DNS records lookup with reverse DNS support
- CVE Explainer — AI-powered vulnerability analysis
- Ask Aegis — interactive AI security chat

**Network Toolkit**
- Traceroute with real hop-by-hop geolocation on a dark world map
- Speed Test via Cloudflare
- MAC Address Lookup
- DNS Records

**Password Health**
Entropy calculation, crack time estimation, HaveIBeenPwned breach check using k-anonymity (your password never leaves your machine), secure password generator.

**IP Investigator**
Full geolocation, ISP, threat scoring, dark cyber map, PDF export, search history.

**Network Monitor**
VPN detection, DNS leak test, local port scanner, ping tool, incident log, network device scanner with block capability.

**Multi-Monitor SOC Mode**
Open different pages across multiple screens with one click. Single, dual, or triple monitor presets.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron |
| Frontend | Vanilla HTML/CSS/JS |
| Database | SQLite (better-sqlite3) |
| AI | Claude API (Anthropic) |
| Threat Intel | NVD API |
| Geolocation | ip-api.com |
| Proxy | Cloudflare Workers |
| CI/CD | GitHub Actions |

---

## Installation

**Windows**
1. Download `Aegis-Setup-1.0.11.exe` from the [latest release](https://github.com/MichalisKampouridis/Aegis/releases/latest)
2. Run the installer
3. Launch from Start Menu or Desktop shortcut

**macOS**
1. Download `Aegis-1.0.11-arm64.dmg` (Apple Silicon) or `Aegis-1.0.11.dmg` (Intel)
2. Open the .dmg and drag Aegis to Applications
3. Right-click → Open on first launch to bypass Gatekeeper

**Linux**
1. Download `Aegis-1.0.11.AppImage` from the [latest release](https://github.com/MichalisKampouridis/Aegis/releases/latest)
2. `chmod +x Aegis-1.0.11.AppImage`
3. `./Aegis-1.0.11.AppImage`

---

## Why I built this

I wanted a tool I'd actually use every day — something that sits in my tray, monitors my connection, and keeps me informed about current threats without opening five different browser tabs. Everything in Aegis is something I found myself doing manually and decided to automate.

---

## About

Built by Michalis Kampouridis

[LinkedIn](https://www.linkedin.com/in/michalis-kampouridis-704051397/) · [GitHub](https://github.com/MichalisKampouridis)
