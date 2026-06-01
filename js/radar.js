'use strict';

// ─── RADAR CONSTANTS ──────────────────────────────────────────
const RADAR_SIZE   = 220;
const RADAR_CX     = 110;
const RADAR_CY     = 110;
const RADAR_R      = 90;
const SWEEP_SPEED  = 0.022;   // radians per frame

// Axis angles (radians, canvas coords: 0 = right, π/2 = down)
const AXIS_LATENCY = -Math.PI / 2;   // top
const AXIS_IP      = 0;              // right
const AXIS_VPN     = Math.PI / 2;    // bottom
const AXIS_DNS     = Math.PI;        // left

// ─── STATE ────────────────────────────────────────────────────
let radarAngle          = 0;
let radarAnimId         = null;
let radarSamplingStarted = false;
let radarSampleTimer    = null;
let radarHistory        = [];   // array of reading objects
let radarLastIP         = null;
let radarLastISP        = null;
let radarLastDNS        = null;
let radarAnomalies      = [];   // last N anomaly events

// ─── INIT ─────────────────────────────────────────────────────
async function initRadar() {
  const canvas = document.getElementById('radar-canvas');
  if (!canvas) return;

  // Cancel any previous animation loop
  if (radarAnimId) {
    cancelAnimationFrame(radarAnimId);
    radarAnimId = null;
  }

  // Load history from storage once per session
  if (!radarSamplingStarted) {
    await radarLoadHistory();
  }

  // Start animation
  radarAngle = 0;
  radarAnimTick();

  // Start sampling only once
  if (!radarSamplingStarted) {
    radarSamplingStarted = true;
    radarTakeSample();   // immediate first sample
    radarSampleTimer = setInterval(radarTakeSample, 30000);  // every 30s
  }
}

// ─── ANIMATION LOOP ───────────────────────────────────────────
function radarAnimTick() {
  const canvas = document.getElementById('radar-canvas');
  if (!canvas) {
    radarAnimId = null;
    return;
  }
  radarAngle = (radarAngle + SWEEP_SPEED) % (Math.PI * 2);
  radarDrawRadar(canvas);

  const spark = document.getElementById('radar-sparkline');
  if (spark) radarDrawSpark(spark);

  radarAnimId = requestAnimationFrame(radarAnimTick);
}

// ─── DRAW RADAR ───────────────────────────────────────────────
function radarDrawRadar(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);

  // Background
  ctx.fillStyle = '#020818';
  ctx.fillRect(0, 0, RADAR_SIZE, RADAR_SIZE);

  // Concentric rings
  const ringRadii = [RADAR_R * 0.34, RADAR_R * 0.67, RADAR_R];
  const ringAlphas = [0.20, 0.13, 0.08];
  ringRadii.forEach(function(r, i) {
    ctx.beginPath();
    ctx.arc(RADAR_CX, RADAR_CY, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245,158,11,' + ringAlphas[i] + ')';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Axis lines
  const axes = [AXIS_LATENCY, AXIS_IP, AXIS_VPN, AXIS_DNS];
  axes.forEach(function(a) {
    ctx.beginPath();
    ctx.moveTo(RADAR_CX, RADAR_CY);
    ctx.lineTo(RADAR_CX + Math.cos(a) * RADAR_R, RADAR_CY + Math.sin(a) * RADAR_R);
    ctx.strokeStyle = 'rgba(245,158,11,0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Sweep trail — 32 thin arc slices with decreasing opacity
  const TRAIL_ARC = (55 * Math.PI) / 180;
  const SLICES = 32;
  for (let i = 0; i < SLICES; i++) {
    const sliceStart = radarAngle - TRAIL_ARC + (i / SLICES) * TRAIL_ARC;
    const sliceEnd   = sliceStart + TRAIL_ARC / SLICES;
    const alpha      = (i / SLICES) * 0.25;
    ctx.beginPath();
    ctx.moveTo(RADAR_CX, RADAR_CY);
    ctx.arc(RADAR_CX, RADAR_CY, RADAR_R, sliceStart, sliceEnd);
    ctx.closePath();
    ctx.fillStyle = 'rgba(245,158,11,' + alpha + ')';
    ctx.fill();
  }

  // Sweep line
  ctx.beginPath();
  ctx.moveTo(RADAR_CX, RADAR_CY);
  ctx.lineTo(RADAR_CX + Math.cos(radarAngle) * RADAR_R, RADAR_CY + Math.sin(radarAngle) * RADAR_R);
  ctx.strokeStyle = 'rgba(245,158,11,0.90)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(RADAR_CX, RADAR_CY, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  // Pulse ring on center
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 600);
  ctx.beginPath();
  ctx.arc(RADAR_CX, RADAR_CY, 6 + pulse * 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(245,158,11,' + (0.15 + pulse * 0.20) + ')';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Axis labels
  ctx.font = '9px monospace';
  ctx.fillStyle = 'rgba(148,163,184,0.70)';
  ctx.textAlign = 'center';
  ctx.fillText('LAT', RADAR_CX, RADAR_CY - RADAR_R - 6);
  ctx.fillText('DNS', RADAR_CX - RADAR_R - 8, RADAR_CY + 3);
  ctx.textAlign = 'left';
  ctx.fillText('IP', RADAR_CX + RADAR_R + 4, RADAR_CY + 3);
  ctx.textAlign = 'center';
  ctx.fillText('VPN', RADAR_CX, RADAR_CY + RADAR_R + 12);

  // Metric dots from latest reading
  if (radarHistory.length > 0) {
    const reading = radarHistory[radarHistory.length - 1];
    radarPlotDot(ctx, AXIS_LATENCY, radarLatRatio(reading.latency),  radarLatColor(reading.latency));
    radarPlotDot(ctx, AXIS_IP,      radarIPRatio(reading),           radarIPColor(reading));
    radarPlotDot(ctx, AXIS_VPN,     radarVPNRatio(reading),          radarVPNColor(reading));
    radarPlotDot(ctx, AXIS_DNS,     radarDNSRatio(reading),          radarDNSColor(reading));
  }
}

function radarPlotDot(ctx, angle, ratio, color) {
  const dist = ratio * RADAR_R;
  const x = RADAR_CX + Math.cos(angle) * dist;
  const y = RADAR_CY + Math.sin(angle) * dist;

  // Glow
  const grd = ctx.createRadialGradient(x, y, 0, x, y, 10);
  grd.addColorStop(0, color.replace(')', ',0.40)').replace('rgb', 'rgba'));
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();

  // Dot
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// ─── DRAW SPARKLINE ───────────────────────────────────────────
function radarDrawSpark(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#020818';
  ctx.fillRect(0, 0, W, H);

  if (radarHistory.length < 2) return;

  const readings = radarHistory.slice(-30);
  const maxLat   = 600;
  const threshold = 150;

  // Threshold dashed line
  const ty = H - (threshold / maxLat) * (H - 4) - 2;
  ctx.beginPath();
  ctx.setLineDash([3, 4]);
  ctx.moveTo(0, ty);
  ctx.lineTo(W, ty);
  ctx.strokeStyle = 'rgba(245,158,11,0.30)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  // Latency sparkline
  ctx.beginPath();
  readings.forEach(function(r, i) {
    const x = (i / (readings.length - 1)) * W;
    const y = H - Math.min(r.latency / maxLat, 1) * (H - 4) - 2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Fill under sparkline
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = 'rgba(245,158,11,0.07)';
  ctx.fill();
}

// ─── METRIC HELPERS ───────────────────────────────────────────
function radarLatRatio(latency) {
  if (latency == null) return 0.35;
  if (latency > 300)   return 0.88;
  if (latency > 150)   return 0.62;
  return Math.max(0.18, 0.35 + (latency / 300) * 0.25);
}
function radarLatColor(latency) {
  if (latency == null) return '#64748b';
  if (latency > 300)   return '#ef4444';
  if (latency > 150)   return '#f59e0b';
  return '#10b981';
}

function radarIPRatio(reading) {
  if (!reading) return 0.35;
  if (reading.ipChanged)  return 0.88;
  if (reading.isVPN)      return 0.35;
  return 0.55;
}
function radarIPColor(reading) {
  if (!reading)          return '#64748b';
  if (reading.ipChanged) return '#ef4444';
  if (reading.isVPN)     return '#10b981';
  return '#f59e0b';
}

function radarVPNRatio(reading) {
  if (!reading)           return 0.35;
  if (reading.vpnDropped) return 0.88;
  if (reading.isVPN)      return 0.35;
  return 0.62;
}
function radarVPNColor(reading) {
  if (!reading)            return '#64748b';
  if (reading.vpnDropped)  return '#ef4444';
  if (reading.isVPN)       return '#10b981';
  return '#64748b';   // no VPN is normal — neutral gray
}

function radarDNSRatio(reading) {
  if (!reading)           return 0.35;
  if (reading.dnsChanged) return 0.88;
  return 0.35;
}
function radarDNSColor(reading) {
  if (!reading)           return '#64748b';
  if (reading.dnsChanged) return '#ef4444';
  return '#10b981';
}

// ─── SAMPLING ─────────────────────────────────────────────────
async function radarTakeSample() {
  try {
    // 1. Latency — measure 3 servers, take best
    const latency = await radarMeasureLatency();

    // 2. Public IP — direct fetch (proxy would return Cloudflare's IP)
    let ip = null, isp = null, isVPN = false;
    try {
      const ipRes  = await fetch('https://api64.ipify.org?format=json');
      const ipJson = await ipRes.json();
      ip = ipJson.ip || null;
    } catch (_) {}

    // ISP + VPN + geo via ipwho.is with the real IP, through proxy
    let lat = null, lon = null, city = null, country = null, cc = null;
    if (ip) {
      try {
        const geoRes  = await fetch('https://aegis-proxy.ka-mixalis99.workers.dev/?url=' + encodeURIComponent('https://ipwho.is/' + ip));
        const geoData = await geoRes.json();
        if (geoData && geoData.success !== false) {
          isp     = geoData.connection && geoData.connection.isp ? geoData.connection.isp : null;
          isVPN   = !!(geoData.security && (geoData.security.vpn || geoData.security.tor || geoData.security.proxy));
          lat     = geoData.latitude     || null;
          lon     = geoData.longitude    || null;
          city    = geoData.city         || null;
          country = geoData.country      || null;
          cc      = geoData.country_code || null;
        }
      } catch (_) {}
    }

    // 3. DNS check — direct query to Google DoH (same method as Network Monitor)
    let dnsOK = null;
    try {
      const dnsRes  = await fetch('https://dns.google/resolve?name=google.com&type=A');
      const dnsData = await dnsRes.json();
      dnsOK = !!(dnsData && dnsData.Answer && dnsData.Answer.length > 0);
    } catch (_) { dnsOK = false; }

    // Detect changes
    const ipChanged  = radarLastIP  !== null && ip  !== null && ip  !== radarLastIP;
    const ispChanged = radarLastISP !== null && isp !== null && isp !== radarLastISP;
    const dnsChanged = radarLastDNS !== null && dnsOK !== radarLastDNS;
    const vpnDropped = radarLastIP  !== null && isVPN === false && (radarHistory.length > 0 && radarHistory[radarHistory.length - 1].isVPN === true);

    if (ip)  radarLastIP  = ip;
    if (isp) radarLastISP = isp;
    if (dnsOK !== null) radarLastDNS = dnsOK;

    const reading = {
      ts:         Date.now(),
      latency:    latency,
      ip:         ip,
      isp:        isp,
      isVPN:      isVPN,
      dnsOK:      dnsOK,
      ipChanged:  ipChanged,
      ispChanged: ispChanged,
      dnsChanged: dnsChanged,
      vpnDropped: vpnDropped,
      lat:        lat,
      lon:        lon,
      city:       city,
      country:    country,
      cc:         cc
    };

    radarHistory.push(reading);
    if (radarHistory.length > 120) radarHistory.shift();

    // Persist to storage
    if (window.aegis && window.aegis.addRadarReading) {
      window.aegis.addRadarReading(reading).catch(function() {});
    }

    // Anomaly detection
    radarDetect(reading);

    // Update readouts panel
    radarUpdateReadouts(reading);
    radarUpdateFeed();
    radarUpdateDashboardThreat();
    radarUpdateStatCard();

    // Refresh NI live panel if that page is currently visible
    const niPage = document.getElementById('page-network-intelligence');
    if (niPage && niPage.classList.contains('active')) {
      if (typeof niUpdateMetricCards === 'function') niUpdateMetricCards();
      if (typeof niUpdateLivePanel   === 'function') niUpdateLivePanel();
    }

  } catch (_) {}
}

async function radarMeasureLatency() {
  const targets = [
    'https://aegis-proxy.ka-mixalis99.workers.dev/?url=https://1.1.1.1/cdn-cgi/trace',
    'https://aegis-proxy.ka-mixalis99.workers.dev/?url=https://8.8.8.8/generate_204',
    'https://aegis-proxy.ka-mixalis99.workers.dev/?url=https://www.google.com/generate_204'
  ];
  const results = await Promise.all(targets.map(async function(url) {
    const t0 = performance.now();
    try {
      await fetch(url, { method: 'HEAD', mode: 'cors', cache: 'no-store', signal: AbortSignal.timeout(4000) });
    } catch (_) { return 9999; }
    return Math.round(performance.now() - t0);
  }));
  const valid = results.filter(function(v) { return v < 9999; });
  if (valid.length === 0) return 999;
  return Math.min(...valid);
}

// ─── ANOMALY DETECTION ────────────────────────────────────────
function radarDetect(reading) {
  const events = [];

  if (reading.latency > 300) {
    events.push({ type: 'LATENCY', severity: 'CRITICAL', msg: 'High latency: ' + reading.latency + 'ms' });
  } else if (reading.latency > 150) {
    events.push({ type: 'LATENCY', severity: 'WARNING',  msg: 'Elevated latency: ' + reading.latency + 'ms' });
  }

  if (reading.ipChanged) {
    events.push({ type: 'IP',  severity: 'CRITICAL', msg: 'Public IP changed to ' + reading.ip });
  }
  if (reading.dnsChanged) {
    events.push({ type: 'DNS', severity: 'CRITICAL', msg: 'DNS resolution state changed' });
  }
  if (reading.vpnDropped) {
    events.push({ type: 'VPN', severity: 'WARNING',  msg: 'VPN connection dropped' });
  }
  if (reading.ispChanged) {
    events.push({ type: 'ISP', severity: 'WARNING',  msg: 'ISP changed: ' + reading.isp });
  }

  events.forEach(function(ev) {
    ev.ts = reading.ts;
    radarAnomalies.unshift(ev);

    // Sound alert
    if (typeof isSoundEnabled === 'function' && isSoundEnabled('alert')) {
      if (ev.type === 'VPN' && typeof playVPNDrop === 'function') {
        playVPNDrop();
      } else if (ev.type === 'IP' && typeof playIPChanged === 'function') {
        playIPChanged();
      } else if (ev.severity === 'CRITICAL' && typeof playCriticalAlert === 'function') {
        playCriticalAlert();
      } else if (ev.severity === 'WARNING' && typeof playWarningAlert === 'function') {
        playWarningAlert();
      } else if (typeof playInfoBlip === 'function') {
        playInfoBlip();
      }
    }

    // Desktop notification
    if (window.aegis && window.aegis.notify) {
      window.aegis.notify('Aegis Anomaly: ' + ev.type, ev.msg).catch(function() {});
    }
    // Tray status
    if (window.aegis && window.aegis.setTrayStatus) {
      window.aegis.setTrayStatus(ev.severity === 'CRITICAL' ? 'alert' : 'monitor').catch(function() {});
    }
    // Log incident
    if (window.aegis && window.aegis.logIncident) {
      window.aegis.logIncident('RADAR_' + ev.type, ev.msg, ev.severity).catch(function() {});
    }
  });

  if (radarAnomalies.length > 20) radarAnomalies.length = 20;
}

// ─── LOAD HISTORY ─────────────────────────────────────────────
async function radarLoadHistory() {
  try {
    if (!window.aegis || !window.aegis.getRadarReadings) return;
    const stored = await window.aegis.getRadarReadings(60);
    if (stored && stored.length > 0) {
      radarHistory = stored;
      // Restore last known values
      const last = radarHistory[radarHistory.length - 1];
      if (last.ip)  radarLastIP  = last.ip;
      if (last.isp) radarLastISP = last.isp;
      if (last.dnsOK !== undefined) radarLastDNS = last.dnsOK;
    }
  } catch (_) {}
}

// ─── UI UPDATES ───────────────────────────────────────────────
function radarUpdateReadouts(reading) {
  const el = document.getElementById('radar-readouts');
  if (!el) return;

  function row(label, value, color) {
    return '<div style="margin-bottom:10px;">' +
      '<div style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim); letter-spacing:1px; margin-bottom:2px;">' + label + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:12px; color:' + color + ';">' + value + '</div>' +
      '</div>';
  }

  const latColor = radarLatColor(reading.latency);
  const latVal   = reading.latency != null ? reading.latency + 'ms' : 'N/A';

  const ipColor  = radarIPColor(reading);
  const ipVal    = reading.ip || 'Unknown';

  const vpnColor = reading.vpnDropped ? '#ef4444' : reading.isVPN ? '#10b981' : '#64748b';
  const vpnVal   = reading.vpnDropped ? 'DROPPED' : reading.isVPN ? 'PROTECTED' : 'INACTIVE';

  const dnsColor = reading.dnsOK ? '#10b981' : (reading.dnsOK === false ? '#ef4444' : '#64748b');
  const dnsVal   = reading.dnsOK == null ? 'N/A' : (reading.dnsOK ? 'STABLE' : 'FAILING');

  el.innerHTML =
    row('LATENCY', latVal, latColor) +
    row('PUBLIC IP', ipVal, ipColor) +
    row('VPN', vpnVal, vpnColor) +
    row('DNS', dnsVal, dnsColor);
}

function radarUpdateFeed() {
  const el = document.getElementById('radar-anomaly-feed');
  if (!el) return;

  if (radarAnomalies.length === 0) {
    el.innerHTML = '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); padding:4px 0;">&#10003; No anomalies detected</div>';
    return;
  }

  const severityColors = { CRITICAL: '#ef4444', WARNING: '#f59e0b', INFO: '#10b981' };

  el.innerHTML = radarAnomalies.slice(0, 5).map(function(ev) {
    const color = severityColors[ev.severity] || '#64748b';
    const time  = new Date(ev.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return '<div style="padding:4px 0; border-bottom:1px solid var(--border); display:flex; gap:8px; align-items:flex-start;">' +
      '<span style="font-family:var(--font-mono); font-size:10px; background:' + color + '22; color:' + color + '; padding:1px 6px; border-radius:2px; flex-shrink:0; margin-top:1px;">' + ev.type + '</span>' +
      '<div style="flex:1;">' +
      '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-primary); line-height:1.4;">' + ev.msg + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">' + time + '</div>' +
      '</div></div>';
  }).join('');
}

// ─── THREAT LEVEL & STAT CARD ─────────────────────────────────
let radarPrevThreatLevel = null;

function radarComputeThreatLevel() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  const recent = radarAnomalies.filter(function(ev) { return ev.ts >= cutoff; });
  if (recent.some(function(ev) { return ev.severity === 'CRITICAL'; })) return 'CRITICAL';
  if (recent.some(function(ev) { return ev.severity === 'WARNING'; }))  return 'ELEVATED';
  return 'LOW';
}

function radarUpdateDashboardThreat() {
  const el = document.getElementById('threat-level-text');
  if (!el) return;
  const level = radarComputeThreatLevel();
  const colors = { CRITICAL: '#ef4444', HIGH: '#f97316', ELEVATED: '#f59e0b', LOW: '#10b981' };
  const color = colors[level] || '#64748b';
  el.style.color = color;
  el.innerHTML = '&#9888; ' + level;
  const banner = document.getElementById('threat-banner');
  if (banner) {
    banner.style.background  = color + '18';
    banner.style.borderColor = color;
  }

  // Fire notification + sound only when level actually changes
  if (radarPrevThreatLevel !== null && radarPrevThreatLevel !== level) {
    const old = radarPrevThreatLevel;

    // Desktop notification — respects the anomaly notification toggle
    const notifOk = typeof currentSettings !== 'undefined'
      ? (currentSettings.notifications || {}).anomaly !== false
      : true;
    if (notifOk && window.aegis && window.aegis.notify) {
      window.aegis.notify(
        '⚠ Aegis Threat Level Changed',
        'Threat level changed from ' + old + ' to ' + level
      ).catch(function() {});
    }

    // Sound — respects the alert sounds toggle
    if (typeof isSoundEnabled === 'function' && isSoundEnabled('alert')) {
      if      (level === 'CRITICAL' && typeof playCriticalAlert === 'function') playCriticalAlert();
      else if (level === 'HIGH'     && typeof playWarningAlert  === 'function') playWarningAlert();
      else if (level === 'ELEVATED' && typeof playInfoBlip      === 'function') playInfoBlip();
      else if (level === 'LOW'      && typeof playSuccess       === 'function') playSuccess();
    }
  }
  radarPrevThreatLevel = level;
}

function radarUpdateStatCard() {
  const el = document.getElementById('stat-radar-value');
  if (!el) return;
  const count = radarHistory.length;
  el.textContent = count;
  el.style.color = count > 0 ? '#f59e0b' : '#64748b';
}

// ─── RADAR SAMPLES MODAL ─────────────────────────────────────
function openRadarSamplesModal() {
  var existing = document.getElementById('radar-samples-modal');
  if (existing) existing.remove();

  // Take last 10 readings, most recent first
  var slice = radarHistory.slice(-10).reverse();

  // Enrich each reading with computed jitter and status
  var rows = slice.map(function(r, i) {
    var origIdx = radarHistory.length - 1 - i;
    var window  = radarHistory.slice(Math.max(0, origIdx - 4), origIdx + 1);
    var lats    = window.filter(function(x) { return x.latency != null; })
                        .map(function(x) { return x.latency; });
    var jit     = lats.length >= 2
                  ? Math.round(Math.max.apply(null, lats) - Math.min.apply(null, lats))
                  : 0;
    var lat     = r.latency || 0;
    var d       = new Date(r.ts);
    return {
      time:     ('0' + d.getHours()).slice(-2) + ':' +
                ('0' + d.getMinutes()).slice(-2) + ':' +
                ('0' + d.getSeconds()).slice(-2),
      latency:  lat,
      jitter:   jit,
      ipStatus: r.ipChanged   ? 'CHANGED' : 'STABLE',
      vpn:      r.vpnDropped  ? 'DROPPED' : r.isVPN ? 'ACTIVE' : 'INACTIVE',
      dns:      r.dnsOK === false ? 'FAIL' : r.dnsChanged ? 'CHANGED' : 'STABLE',
      status:   lat >= 300 || jit >= 80 ? 'CRITICAL'
              : lat >= 100 || jit >= 30 ? 'WARNING' : 'NORMAL'
    };
  });

  function latC(ms) { return ms < 100 ? '#10b981' : ms < 300 ? '#f59e0b' : '#ef4444'; }
  function jitC(ms) { return ms <  30 ? '#10b981' : ms <  80 ? '#f59e0b' : '#ef4444'; }

  var bodyHTML;
  if (rows.length === 0) {
    bodyHTML =
      '<div style="font-family:\'IBM Plex Mono\',monospace; font-size:12px; color:#64748b; ' +
      'text-align:center; padding:36px 0; letter-spacing:1px;">' +
      'No samples recorded yet.<br><span style="font-size:11px; opacity:0.7;">Run a scan to collect data.</span></div>';
  } else {
    var thead =
      '<thead><tr style="border-bottom:1px solid #1e2d4a;">' +
      ['TIME','LATENCY','JITTER','IP STATUS','VPN','DNS','STATUS'].map(function(h) {
        return '<th style="font-family:\'IBM Plex Mono\',monospace; font-size:10px; color:#f59e0b; ' +
               'letter-spacing:1px; padding:7px 8px; text-align:left; font-weight:500; white-space:nowrap;">' + h + '</th>';
      }).join('') +
      '</tr></thead>';

    var tbody = '<tbody>' + rows.map(function(r, i) {
      var bg  = i % 2 === 0 ? 'rgba(13,21,38,0.5)' : 'transparent';
      var sc  = r.status === 'CRITICAL' ? '#ef4444' : r.status === 'WARNING' ? '#f59e0b' : '#10b981';
      var ipc = r.ipStatus === 'CHANGED' ? '#ef4444' : '#10b981';
      var vc  = r.vpn === 'ACTIVE'  ? '#10b981' : r.vpn === 'DROPPED' ? '#ef4444' : '#64748b';
      var dc  = r.dns === 'STABLE'  ? '#10b981' : r.dns === 'FAIL'    ? '#ef4444' : '#f59e0b';
      return '<tr style="background:' + bg + '; border-bottom:1px solid rgba(30,45,74,0.4);">' +
        '<td style="padding:7px 8px; font-family:\'IBM Plex Mono\',monospace; font-size:10px; color:#94a3b8; white-space:nowrap;">' + r.time     + '</td>' +
        '<td style="padding:7px 8px; font-family:\'IBM Plex Mono\',monospace; font-size:10px; color:' + latC(r.latency) + '; white-space:nowrap;">' + r.latency  + ' ms</td>' +
        '<td style="padding:7px 8px; font-family:\'IBM Plex Mono\',monospace; font-size:10px; color:' + jitC(r.jitter)  + '; white-space:nowrap;">' + r.jitter   + ' ms</td>' +
        '<td style="padding:7px 8px; font-family:\'IBM Plex Mono\',monospace; font-size:10px; color:' + ipc            + '; white-space:nowrap;">' + r.ipStatus + '</td>' +
        '<td style="padding:7px 8px; font-family:\'IBM Plex Mono\',monospace; font-size:10px; color:' + vc             + '; white-space:nowrap;">' + r.vpn      + '</td>' +
        '<td style="padding:7px 8px; font-family:\'IBM Plex Mono\',monospace; font-size:10px; color:' + dc             + '; white-space:nowrap;">' + r.dns      + '</td>' +
        '<td style="padding:7px 8px;">' +
          '<span style="font-family:\'IBM Plex Mono\',monospace; font-size:9px; padding:2px 7px; border-radius:2px; ' +
          'background:' + sc + '22; color:' + sc + '; border:1px solid ' + sc + '44; letter-spacing:1px; white-space:nowrap;">' +
          r.status + '</span></td></tr>';
    }).join('') + '</tbody>';

    bodyHTML =
      '<div style="overflow-x:auto;">' +
      '<table style="width:100%; border-collapse:collapse;">' + thead + tbody + '</table>' +
      '</div>';
  }

  var subtitleCount = rows.length + ' OF ' + radarHistory.length + ' TOTAL · MOST RECENT FIRST';

  var modal =
    '<div id="radar-samples-modal" ' +
      'style="position:fixed; top:0; left:0; width:100%; height:100%; ' +
             'background:rgba(2,8,24,0.85); z-index:9000; ' +
             'display:flex; align-items:center; justify-content:center;" ' +
      'onclick="closeRadarSamplesModal()">' +

      '<div style="background:#0d1526; border:1px solid #1e2d4a; border-top:3px solid #f59e0b; ' +
                  'border-radius:4px; width:500px; max-width:92vw; max-height:80vh; ' +
                  'overflow-y:auto; padding:24px; position:relative;" ' +
           'onclick="event.stopPropagation()">' +

        // Header
        '<div style="display:flex; justify-content:space-between; align-items:center; ' +
                    'margin-bottom:6px; padding-bottom:14px; border-bottom:1px solid #1e2d4a;">' +
          '<span style="font-family:Orbitron,sans-serif; font-size:13px; font-weight:700; ' +
                       'color:#f59e0b; letter-spacing:3px;">RADAR SAMPLES LOG</span>' +
          '<button onclick="closeRadarSamplesModal()" ' +
                  'style="background:transparent; border:1px solid #f59e0b; color:#f59e0b; ' +
                         'width:28px; height:28px; border-radius:2px; cursor:pointer; ' +
                         'font-size:14px; line-height:1; padding:0; flex-shrink:0;">&#10005;</button>' +
        '</div>' +

        // Subtitle
        '<div style="font-family:\'IBM Plex Mono\',monospace; font-size:10px; color:#475569; ' +
                    'letter-spacing:2px; margin-bottom:14px;">SHOWING ' + subtitleCount + '</div>' +

        // Table / empty
        bodyHTML +

        // Footer
        '<div style="margin-top:16px; padding-top:12px; border-top:1px solid #1e2d4a; ' +
                    'text-align:center; font-family:\'IBM Plex Mono\',monospace; ' +
                    'font-size:11px; color:#64748b;">' +
          'Full history available in ' +
          '<a href="#" onclick="closeAndNavToNI(event)" ' +
             'style="color:#f59e0b; text-decoration:none; ' +
                    'border-bottom:1px solid rgba(245,158,11,0.35);">' +
             'Network Intelligence' +
          '</a>' +
        '</div>' +

      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modal);

  document._radarModalEsc = function(e) {
    if (e.key === 'Escape') closeRadarSamplesModal();
  };
  document.addEventListener('keydown', document._radarModalEsc);
}

function closeRadarSamplesModal() {
  var modal = document.getElementById('radar-samples-modal');
  if (modal) modal.remove();
  if (document._radarModalEsc) {
    document.removeEventListener('keydown', document._radarModalEsc);
    document._radarModalEsc = null;
  }
}

function closeAndNavToNI(e) {
  if (e) e.preventDefault();
  closeRadarSamplesModal();
  navigateTo('network-intelligence');
  setTimeout(initNetworkIntelligence, 100);
}

// ─── MANUAL SCAN TRIGGER ──────────────────────────────────────
async function triggerRadarScan() {
  const btn = document.getElementById('radar-scan-btn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'SCANNING...';
  btn.style.opacity = '0.6';
  if (typeof playScanStart === 'function' && isSoundEnabled('ui')) playScanStart();
  try {
    await radarTakeSample();
    if (typeof playSuccess === 'function' && isSoundEnabled('ui')) playSuccess();
  } finally {
    const b = document.getElementById('radar-scan-btn');
    if (b) {
      b.textContent = 'SCAN NOW';
      b.disabled = false;
      b.style.opacity = '1';
    }
  }
}
