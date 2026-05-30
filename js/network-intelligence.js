'use strict';

// ─── STATE ────────────────────────────────────────────────────
var niStartTime      = null;
var niMetricInterval = null;
var niUptimeInterval = null;

// ─── INIT ─────────────────────────────────────────────────────
async function initNetworkIntelligence() {
  if (!niStartTime) niStartTime = Date.now();

  // If radarHistory is not yet populated (e.g. NI page opened before dashboard
  // radar has had a chance to run radarLoadHistory), seed it from SQLite so that
  // niGetReadings() — used by niUpdateMetricCards and niUpdateLivePanel — has data.
  if (niGetReadings().length === 0) {
    try {
      if (window.aegis && window.aegis.getRadarReadings) {
        var stored = await window.aegis.getRadarReadings(60);
        if (stored && stored.length > 0 &&
            typeof radarHistory !== 'undefined' && radarHistory.length === 0) {
          radarHistory = stored;
        }
      }
    } catch (_) {}
  }

  var readings = niGetReadings();

  var last10   = readings.slice(-10);
  var validLat = last10.filter(function(r) { return r.latency != null; }).map(function(r) { return r.latency; });

  // Stability score
  var stability = null;
  if (last10.length > 0) {
    var scores = last10.map(function(r) { return Math.max(0, Math.min(100, 100 - (r.latency || 0) / 5)); });
    stability = Math.round(scores.reduce(function(a, b) { return a + b; }, 0) / scores.length);
  }

  // Avg latency
  var avgLatency = validLat.length > 0
    ? Math.round(validLat.reduce(function(a, b) { return a + b; }, 0) / validLat.length)
    : null;

  // Jitter
  var jitter = validLat.length >= 2
    ? Math.max.apply(null, validLat) - Math.min.apply(null, validLat)
    : null;

  // Network type
  var networkType = '—';
  if (readings.length > 0) {
    var ispRaw = (readings[readings.length - 1].isp || '').toLowerCase();
    if (/cosmote|vodafone|wind|nova|ote|hellenic|telecom|telecommunications|forthnet|cablenet/.test(ispRaw))  networkType = 'HOME';
    else if (/mobile|cellular/.test(ispRaw))         networkType = 'MOBILE';
    else if (ispRaw)                                  networkType = 'PUBLIC';
  }

  // Update Part 1 stat bar
  niSetCard('ni-stability',    stability  !== null ? stability          : '—',  niStabilityColor(stability));
  niSetCard('ni-avg-latency',  avgLatency !== null ? avgLatency + ' ms' : '—',  niLatencyColor(avgLatency));
  niSetCard('ni-packet-loss',  '0%',                                             '#10b981');
  niSetCard('ni-jitter',       jitter     !== null ? jitter + ' ms'     : '—',  niJitterColor(jitter));
  niSetCard('ni-network-type', networkType,                                       niNetworkTypeColor(networkType));

  // Update metric cards + live panel immediately and on 30s interval
  niUpdateMetricCards();
  niUpdateLivePanel();
  if (niMetricInterval) clearInterval(niMetricInterval);
  niMetricInterval = setInterval(function() {
    niUpdateMetricCards();
    niUpdateLivePanel();
  }, 30000);

  // Uptime ticker (tick every minute for display)
  if (niUptimeInterval) clearInterval(niUptimeInterval);
  niUptimeInterval = setInterval(niTickUptime, 60000);

  // Historical charts + sample log
  niInitCharts(niCurrentRange || '1h');
}

// ─── READINGS ─────────────────────────────────────────────────
function niGetReadings() {
  if (typeof radarHistory !== 'undefined' && radarHistory.length > 0) {
    return radarHistory.slice(-60);
  }
  return [];
}

// ─── LIVE METRICS PANEL ───────────────────────────────────────
function niUpdateLivePanel() {
  var readings = niGetReadings();

  // ── Section 1: Connection Status ──────────────────────────
  var dotEl    = document.getElementById('ni-status-dot');
  var labelEl  = document.getElementById('ni-status-label');
  var latEl    = document.getElementById('ni-status-latency');
  var timeEl   = document.getElementById('ni-status-time');

  if (readings.length === 0) {
    if (dotEl)   { dotEl.style.background = '#64748b'; dotEl.className = ''; }
    if (labelEl) { labelEl.textContent = 'UNKNOWN'; labelEl.style.color = '#64748b'; }
    if (latEl)   { latEl.textContent = '—'; latEl.style.color = '#64748b'; }
    if (timeEl)  { timeEl.textContent = 'LAST SCAN: —'; }
  } else {
    var last5Lats = readings.slice(-5)
      .filter(function(r) { return r.latency != null; })
      .map(function(r) { return r.latency; });
    var avgLat5 = last5Lats.length
      ? Math.round(last5Lats.reduce(function(a, b) { return a + b; }, 0) / last5Lats.length)
      : null;
    var last = readings[readings.length - 1];

    var status, statusColor, dotColor;
    if (avgLat5 === null) {
      status = 'UNKNOWN'; statusColor = '#64748b'; dotColor = '#64748b';
    } else if (avgLat5 >= 300 || (last && (last.vpnDropped || last.ipChanged))) {
      status = 'CRITICAL'; statusColor = '#ef4444'; dotColor = '#ef4444';
    } else if (avgLat5 >= 100) {
      status = 'DEGRADED'; statusColor = '#f59e0b'; dotColor = '#f59e0b';
    } else {
      status = 'STABLE'; statusColor = '#10b981'; dotColor = '#10b981';
    }

    if (dotEl) {
      dotEl.style.background = dotColor;
      dotEl.style.color      = dotColor;
      dotEl.className        = 'ni-dot-pulse';
    }
    if (labelEl) { labelEl.textContent = status; labelEl.style.color = statusColor; }
    if (latEl) {
      latEl.textContent = avgLat5 !== null ? avgLat5 + ' ms' : '—';
      latEl.style.color = statusColor;
    }
    if (timeEl) {
      var lastTs = last && last.ts ? new Date(last.ts) : null;
      var tsStr  = lastTs
        ? ('0' + lastTs.getHours()).slice(-2) + ':' + ('0' + lastTs.getMinutes()).slice(-2) + ':' + ('0' + lastTs.getSeconds()).slice(-2)
        : '—';
      timeEl.textContent = 'LAST SCAN: ' + tsStr;
    }
  }

  // ── Section 2: Baseline Comparison ────────────────────────
  var baseEl = document.getElementById('ni-baseline-rows');
  if (baseEl) {
    if (readings.length < 3) {
      baseEl.innerHTML = '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">Need 3+ samples for baseline.</div>';
    } else {
      var cur5   = readings.slice(-5);
      var base10 = readings.slice(-10);

      function avg(arr, fn) {
        var vals = arr.map(fn).filter(function(v) { return v != null && !isNaN(v); });
        return vals.length ? vals.reduce(function(a, b) { return a + b; }, 0) / vals.length : null;
      }
      function stab(arr) {
        return avg(arr, function(r) { return Math.max(0, Math.min(100, 100 - (r.latency || 0) / 5)); });
      }
      function jit(arr) {
        var lats = arr.filter(function(r) { return r.latency != null; }).map(function(r) { return r.latency; });
        return lats.length >= 2 ? Math.max.apply(null, lats) - Math.min.apply(null, lats) : null;
      }

      var metrics = [
        { label: 'LATENCY',    cur: avg(cur5, function(r) { return r.latency; }),  base: avg(base10, function(r) { return r.latency; }),  unit: 'ms', lowerBetter: true  },
        { label: 'JITTER',     cur: jit(cur5),                                     base: jit(base10),                                     unit: 'ms', lowerBetter: true  },
        { label: 'PKT LOSS',   cur: 0,                                             base: 0,                                               unit: '%',  lowerBetter: true  },
        { label: 'STABILITY',  cur: stab(cur5),                                    base: stab(base10),                                    unit: '',   lowerBetter: false }
      ];

      baseEl.innerHTML = metrics.map(function(m) {
        var curVal  = m.cur  !== null ? Math.round(m.cur)  : null;
        var baseVal = m.base !== null ? Math.round(m.base) : null;
        var curStr  = curVal  !== null ? curVal  + m.unit : '—';
        var pct = null;
        var arrow = '';
        var trendColor = '#64748b';

        if (curVal !== null && baseVal !== null && baseVal !== 0) {
          pct = Math.round(((curVal - baseVal) / baseVal) * 100);
          var improving = m.lowerBetter ? pct <= 0 : pct >= 0;
          var stable    = Math.abs(pct) < 5;
          arrow = pct > 0 ? ' ↑' : pct < 0 ? ' ↓' : ' →';
          trendColor = stable ? '#10b981' : improving ? '#10b981' : Math.abs(pct) < 20 ? '#f59e0b' : '#ef4444';
        }

        return '<div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid rgba(30,45,74,0.5);">' +
          '<span style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim); letter-spacing:1px; min-width:72px;">' + m.label + '</span>' +
          '<span style="font-family:var(--font-mono); font-size:12px; color:var(--text-primary);">' + curStr + '</span>' +
          '<span style="font-family:var(--font-mono); font-size:11px; color:' + trendColor + '; min-width:52px; text-align:right;">' +
            (pct !== null ? (pct > 0 ? '+' : '') + pct + '%' + arrow : '—') +
          '</span>' +
        '</div>';
      }).join('');
    }
  }

  // ── Section 3: Last 5 Samples ──────────────────────────────
  var last5El = document.getElementById('ni-last5-rows');
  if (last5El) {
    if (readings.length === 0) {
      last5El.innerHTML = '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">Awaiting samples...</div>';
    } else {
      var last5 = readings.slice(-5).reverse();
      last5El.innerHTML = last5.map(function(r) {
        var d   = r.ts ? new Date(r.ts) : null;
        var ts  = d ? ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2) : '—';
        var lat = r.latency != null ? r.latency + ' ms' : '—';
        var lc  = niLatencyColor(r.latency);
        var jitter5 = 0;
        var status = r.latency >= 300 ? 'CRITICAL' : r.latency >= 100 ? 'WARNING' : 'NORMAL';
        var sc = status === 'CRITICAL' ? '#ef4444' : status === 'WARNING' ? '#f59e0b' : '#10b981';
        return '<div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid rgba(30,45,74,0.5);">' +
          '<span style="font-family:var(--font-mono); font-size:10px; color:#94a3b8;">' + ts + '</span>' +
          '<span style="font-family:var(--font-mono); font-size:11px; color:' + lc + ';">' + lat + '</span>' +
          '<span style="font-family:var(--font-mono); font-size:9px; padding:1px 6px; border-radius:2px; background:' + sc + '22; color:' + sc + '; border:1px solid ' + sc + '44; letter-spacing:1px;">' + status + '</span>' +
        '</div>';
      }).join('');
    }
  }

  // ── Section 4: Anomaly Feed ────────────────────────────────
  niUpdateAnomalyFeed();
}

// ─── METRIC CARDS ─────────────────────────────────────────────
function niUpdateMetricCards() {
  var readings = niGetReadings();
  var last = readings.length > 0 ? readings[readings.length - 1] : null;
  var prev = readings.length > 1 ? readings[readings.length - 2] : null;
  var validL = readings.slice(-10).filter(function(r) { return r.latency != null; }).map(function(r) { return r.latency; });
  var jitter = validL.length >= 2 ? Math.max.apply(null, validL) - Math.min.apply(null, validL) : null;

  // LATENCY
  if (last && last.latency != null) {
    var trend = (prev && prev.latency != null) ? (last.latency > prev.latency ? ' ↑' : ' ↓') : '';
    var lc = niLatencyColor(last.latency);
    niMcSet('ni-mc-latency', last.latency + ' ms' + trend, lc,
            last.latency < 100 ? 'GOOD' : last.latency < 300 ? 'ELEVATED' : 'HIGH', lc);
  } else {
    niMcSet('ni-mc-latency', '—', '#64748b', 'UNKNOWN', '#64748b');
  }

  // PUBLIC IP
  if (last && last.ip) {
    var ic = last.ipChanged ? '#ef4444' : '#10b981';
    niMcSet('ni-mc-ip', last.ip, ic, last.ipChanged ? 'CHANGED' : 'STABLE', ic);
  } else {
    niMcSet('ni-mc-ip', '—', '#64748b', 'UNKNOWN', '#64748b');
  }

  // VPN
  if (last) {
    var vpnLabel = last.vpnDropped ? 'DROPPED' : last.isVPN ? 'ACTIVE' : 'INACTIVE';
    var vc = last.vpnDropped ? '#ef4444' : last.isVPN ? '#10b981' : '#64748b';
    // Count consecutive readings in same VPN state for duration badge
    var stateRuns = 0;
    for (var i = readings.length - 1; i >= 0; i--) {
      if (!!readings[i].isVPN === !!last.isVPN) stateRuns++;
      else break;
    }
    var secs = stateRuns * 30;
    var durStr = secs >= 3600 ? Math.floor(secs / 3600) + 'h ' + Math.floor((secs % 3600) / 60) + 'm' : Math.floor(secs / 60) + 'm';
    niMcSet('ni-mc-vpn', vpnLabel, vc, durStr, vc);
  } else {
    niMcSet('ni-mc-vpn', '—', '#64748b', 'UNKNOWN', '#64748b');
  }

  // DNS
  if (last && last.dnsOK !== undefined) {
    var dc = last.dnsOK === false ? '#ef4444' : last.dnsChanged ? '#f59e0b' : '#10b981';
    var dv = last.dnsOK === false ? 'FAILING' : 'RESOLVING';
    var db = last.dnsOK === false ? 'FAILING' : last.dnsChanged ? 'CHANGED' : 'STABLE';
    niMcSet('ni-mc-dns', dv, dc, db, dc);
  } else {
    niMcSet('ni-mc-dns', '—', '#64748b', 'UNKNOWN', '#64748b');
  }

  // PACKET LOSS — always 0% (Part 2 spec; real measurement is Part 3)
  niMcSet('ni-mc-loss', '0%', '#10b981', 'OK', '#10b981');

  // JITTER
  if (jitter !== null) {
    var jc = niJitterColor(jitter);
    niMcSet('ni-mc-jitter', jitter + ' ms', jc, jitter < 30 ? 'STABLE' : 'UNSTABLE', jc);
  } else {
    niMcSet('ni-mc-jitter', '—', '#64748b', 'UNKNOWN', '#64748b');
  }

  // ISP
  if (last && last.isp) {
    var ispShort = last.isp.length > 22 ? last.isp.slice(0, 21) + '…' : last.isp;
    var ispType  = /cosmote|vodafone|wind|nova|ote|hellenic|telecom|telecommunications|forthnet|cablenet/i.test(last.isp) ? 'HOME'
                 : /mobile|cellular/i.test(last.isp) ? 'MOBILE' : 'PUBLIC';
    var isc = ispType === 'HOME' ? '#10b981' : ispType === 'MOBILE' ? '#f59e0b' : '#64748b';
    niMcSet('ni-mc-isp', ispShort, isc, ispType, isc);
  } else {
    niMcSet('ni-mc-isp', '—', '#64748b', 'UNKNOWN', '#64748b');
  }

  // UPTIME
  niTickUptime();

}

// Sets a metric card value, color, badge text and badge color
function niMcSet(cardId, value, valueColor, badgeText, badgeColor) {
  var card = document.getElementById(cardId);
  if (!card) return;
  var val   = document.getElementById(cardId + '-val');
  var badge = document.getElementById(cardId + '-badge');
  if (val)   { val.textContent = value; val.style.color = valueColor; }
  if (badge) {
    badge.textContent   = badgeText;
    badge.style.color   = badgeColor;
    badge.style.borderColor = badgeColor;
    badge.style.background  = niBadgeBg(badgeColor);
  }
  card.style.borderLeftColor = valueColor;
}

// Convert known theme colors to rgba background
function niBadgeBg(hex) {
  var map = { '#10b981': 'rgba(16,185,129,0.15)', '#f59e0b': 'rgba(245,158,11,0.15)', '#ef4444': 'rgba(239,68,68,0.15)', '#a78bfa': 'rgba(167,139,250,0.15)' };
  return map[hex] || 'rgba(100,116,139,0.15)';
}

function niTickUptime() {
  if (!niStartTime) return;
  var secs    = Math.floor((Date.now() - niStartTime) / 1000);
  var h       = Math.floor(secs / 3600);
  var m       = Math.floor((secs % 3600) / 60);
  var display = h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  var el = document.getElementById('ni-mc-uptime-val');
  if (el) el.textContent = display;
}

function niUpdateAnomalyFeed() {
  var feed = document.getElementById('ni-anomaly-feed');
  if (!feed) return;
  if (typeof radarAnomalies === 'undefined' || radarAnomalies.length === 0) {
    feed.innerHTML = '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">&#10003; No anomalies detected</div>';
    return;
  }
  var cols = { CRITICAL: '#ef4444', WARNING: '#f59e0b', INFO: '#10b981' };
  feed.innerHTML = radarAnomalies.slice(0, 3).map(function(ev) {
    var c    = cols[ev.severity] || '#64748b';
    var time = new Date(ev.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return '<div style="padding:3px 0; border-bottom:1px solid var(--border); display:flex; gap:6px; align-items:center;">' +
      '<span style="font-family:var(--font-mono); font-size:10px; background:' + c + '22; color:' + c + '; padding:1px 5px; border-radius:2px; flex-shrink:0;">' + ev.type + '</span>' +
      '<span style="font-family:var(--font-mono); font-size:11px; color:var(--text-primary); flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">' + ev.msg + '</span>' +
      '<span style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim); flex-shrink:0;">' + time + '</span>' +
      '</div>';
  }).join('');
}

// ─── COLOR / STAT BAR HELPERS ─────────────────────────────────
// Part 1 stat bar helpers
function niSetCard(id, value, color) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  el.style.color = color;
  if (el.parentElement) el.parentElement.style.borderTop = '2px solid ' + color;
}

function niStabilityColor(score) {
  if (score === null) return '#64748b';
  if (score >= 80)    return '#10b981';
  if (score >= 50)    return '#f59e0b';
  return '#ef4444';
}

function niLatencyColor(ms) {
  if (ms === null) return '#64748b';
  if (ms < 100)    return '#10b981';
  if (ms < 300)    return '#f59e0b';
  return '#ef4444';
}

function niJitterColor(ms) {
  if (ms === null) return '#64748b';
  if (ms < 30)     return '#10b981';
  if (ms < 80)     return '#f59e0b';
  return '#ef4444';
}

function niNetworkTypeColor(type) {
  if (type === 'HOME')   return '#10b981';
  if (type === 'MOBILE') return '#f59e0b';
  return '#64748b';
}

// ─── SCAN NOW ─────────────────────────────────────────────────
async function niScanNow() {
  var btn = document.getElementById('ni-scan-btn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'SCANNING...';
  btn.style.opacity = '0.6';
  try { await triggerRadarScan(); } catch (_) {}
  btn.textContent = 'SCAN NOW';
  btn.disabled    = false;
  btn.style.opacity = '1';
  initNetworkIntelligence();
}

// ─── CHART & LOG STATE ────────────────────────────────────────
var niCurrentRange   = '1h';
var niLogFilter      = 'ALL';
var niLogCurrentPage = 0;
var NI_LOG_PER_PAGE  = 20;
var niSyntheticCache = {};

// ─── HISTORICAL CHARTS ────────────────────────────────────────
function niInitCharts(range) {
  niCurrentRange = range || '1h';

  document.querySelectorAll('.ni-tab').forEach(function(t) {
    t.classList.toggle('active', t.dataset.range === niCurrentRange);
  });

  var data = niGetChartData(niCurrentRange);

  niDrawLineChart('ni-chart-latency', data, 'latency', {
    color:     '#f59e0b',
    fillColor: 'rgba(245,158,11,0.08)',
    yMax:      300,
    threshold: 150,
    unit:      'ms'
  });
  niDrawLineChart('ni-chart-jitter', data, 'jitter', {
    color:     '#f97316',
    fillColor: 'rgba(249,115,22,0.08)',
    yMax:      200,
    threshold: 100,
    unit:      'ms'
  });
  niDrawLineChart('ni-chart-stability', data, 'stability', {
    color:     '#10b981',
    fillColor: 'rgba(16,185,129,0.08)',
    yMax:      100,
    threshold: 80,
    unit:      ''
  });

  niRenderLog();
}

function niGetChartData(range) {
  var now     = Date.now();
  var rangeMs = range === '7d'  ? 7 * 24 * 3600000
              : range === '24h' ? 24 * 3600000
              : 3600000;
  var cutoff  = now - rangeMs;

  var readings = (typeof radarHistory !== 'undefined')
    ? radarHistory.filter(function(r) { return r.ts >= cutoff; })
    : [];

  if (readings.length >= 3) {
    return readings.map(function(r, i, arr) {
      var slice = arr.slice(Math.max(0, i - 5), i + 1);
      var lats  = slice.filter(function(x) { return x.latency != null; })
                       .map(function(x) { return x.latency; });
      var jit   = lats.length >= 2
                  ? Math.max.apply(null, lats) - Math.min.apply(null, lats)
                  : 0;
      var stab  = Math.round(Math.max(0, Math.min(100, 100 - (r.latency || 0) / 5)));
      return { ts: r.ts, latency: r.latency || 0, jitter: Math.round(jit), stability: stab };
    });
  }

  return niGetSynthetic(range, now);
}

function niGetSynthetic(range, now) {
  if (niSyntheticCache[range]) return niSyntheticCache[range];

  var count      = range === '7d' ? 168 : range === '24h' ? 144 : 120;
  var intervalMs = range === '7d' ? 3600000 : range === '24h' ? 600000 : 30000;

  var seed = Math.floor(now / 86400000);
  function lcg() {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 4294967296;
  }

  var data      = [];
  var latency   = 42;
  var jitter    = 7;
  var stability = 93;

  for (var i = 0; i < count; i++) {
    latency   += (lcg() - 0.47) * 18;
    jitter    += (lcg() - 0.47) * 10;
    stability += (lcg() - 0.47) * 5;
    if (lcg() < 0.04) latency   += 70  + lcg() * 110;
    if (lcg() < 0.04) jitter    += 40  + lcg() * 60;
    if (lcg() < 0.03) stability -= 12  + lcg() * 18;
    latency   = Math.max(8,  Math.min(290, latency));
    jitter    = Math.max(2,  Math.min(190, jitter));
    stability = Math.max(22, Math.min(100, stability));
    data.push({
      ts:        now - (count - i) * intervalMs,
      latency:   Math.round(latency),
      jitter:    Math.round(jitter),
      stability: Math.round(stability)
    });
  }

  niSyntheticCache[range] = data;
  return data;
}

function niDrawLineChart(canvasId, data, field, opts) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;

  var W = canvas.clientWidth > 0 ? canvas.clientWidth : 380;
  canvas.width  = W;
  canvas.height = 200;
  var H = 200;

  var ctx = canvas.getContext('2d');

  var PAD_L = 44;
  var PAD_R = 10;
  var PAD_T = 14;
  var PAD_B = 26;
  var plotW = W - PAD_L - PAD_R;
  var plotH = H - PAD_T - PAD_B;

  ctx.fillStyle = '#020818';
  ctx.fillRect(0, 0, W, H);

  // Horizontal grid lines + Y-axis labels
  var ySteps = 5;
  ctx.font         = '9px monospace';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';

  for (var i = 0; i <= ySteps; i++) {
    var val = Math.round(opts.yMax * (1 - i / ySteps));
    var gy  = PAD_T + (i / ySteps) * plotH;

    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.moveTo(PAD_L, gy);
    ctx.lineTo(PAD_L + plotW, gy);
    ctx.strokeStyle = 'rgba(30,45,74,0.7)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.fillText(val + (opts.unit || ''), PAD_L - 4, gy);
  }

  // Threshold dashed line
  var threshY = PAD_T + (1 - opts.threshold / opts.yMax) * plotH;
  ctx.beginPath();
  ctx.setLineDash([5, 4]);
  ctx.moveTo(PAD_L, threshY);
  ctx.lineTo(PAD_L + plotW, threshY);
  ctx.strokeStyle = 'rgba(245,158,11,0.45)';
  ctx.lineWidth   = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  if (data.length < 2) {
    ctx.font          = '10px monospace';
    ctx.fillStyle     = 'rgba(100,116,139,0.5)';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText('AWAITING DATA', PAD_L + plotW / 2, PAD_T + plotH / 2);
    return;
  }

  // X-axis time labels (5 evenly spaced)
  var labCount = Math.min(5, data.length);
  ctx.font          = '9px monospace';
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'top';
  ctx.fillStyle     = '#475569';

  for (var j = 0; j < labCount; j++) {
    var idx = j === labCount - 1
      ? data.length - 1
      : Math.round((j / (labCount - 1)) * (data.length - 1));
    var lx  = PAD_L + (idx / (data.length - 1)) * plotW;
    var dt  = new Date(data[idx].ts);
    var hh  = ('0' + dt.getHours()).slice(-2);
    var mm  = ('0' + dt.getMinutes()).slice(-2);
    ctx.fillText(hh + ':' + mm, lx, H - PAD_B + 4);
  }

  // Data line
  ctx.beginPath();
  data.forEach(function(pt, k) {
    var x     = PAD_L + (k / (data.length - 1)) * plotW;
    var ratio = Math.max(0, Math.min(1, pt[field] / opts.yMax));
    var y     = PAD_T + (1 - ratio) * plotH;
    k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = opts.color;
  ctx.lineWidth   = 1.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // Fill area under line
  ctx.lineTo(PAD_L + plotW, PAD_T + plotH);
  ctx.lineTo(PAD_L,         PAD_T + plotH);
  ctx.closePath();
  ctx.fillStyle = opts.fillColor;
  ctx.fill();
}

// ─── SAMPLE LOG ───────────────────────────────────────────────
function niGetAllSamples() {
  var hasReal = (typeof radarHistory !== 'undefined' && radarHistory.length >= 5);

  if (hasReal) {
    return radarHistory.slice().reverse().map(function(r, i) {
      var origIdx = radarHistory.length - 1 - i;
      var slice   = radarHistory.slice(Math.max(0, origIdx - 5), origIdx + 1);
      var lats    = slice.filter(function(x) { return x.latency != null; })
                         .map(function(x) { return x.latency; });
      var jit     = lats.length >= 2
                    ? Math.round(Math.max.apply(null, lats) - Math.min.apply(null, lats))
                    : 0;
      var lat = r.latency || 0;
      return {
        ts:       r.ts || (Date.now() - i * 30000),
        latency:  lat,
        jitter:   jit,
        ipStatus: r.ipChanged  ? 'CHANGED'  : 'STABLE',
        vpn:      r.vpnDropped ? 'DROPPED'  : r.isVPN ? 'ACTIVE' : 'INACTIVE',
        dns:      r.dnsOK === false ? 'FAIL' : r.dnsChanged ? 'CHANGED' : 'STABLE',
        status:   niSampleStatus(lat, jit)
      };
    });
  }

  // Fallback: synthesize from cached 24h data
  return niGetSynthetic('24h', Date.now()).slice().reverse().map(function(d) {
    function h(offset) {
      var s = ((d.ts + offset) * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 4294967296;
    }
    return {
      ts:       d.ts,
      latency:  d.latency,
      jitter:   d.jitter,
      ipStatus: h(0) < 0.04  ? 'CHANGED'  : 'STABLE',
      vpn:      h(1) < 0.65  ? 'ACTIVE'   : 'INACTIVE',
      dns:      h(2) < 0.03  ? 'CHANGED'  : 'STABLE',
      status:   niSampleStatus(d.latency, d.jitter)
    };
  });
}

function niSampleStatus(latency, jitter) {
  if (latency >= 300 || jitter >= 80) return 'CRITICAL';
  if (latency >= 100 || jitter >= 30) return 'WARNING';
  return 'NORMAL';
}

function niSetLogFilter(filter) {
  niLogFilter      = filter;
  niLogCurrentPage = 0;
  document.querySelectorAll('.ni-log-filter-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  niRenderLog();
}

function niLogPageChange(delta) {
  var samples    = niGetAllSamples();
  var filtered   = niLogFilter === 'ALL'
    ? samples
    : samples.filter(function(r) { return r.status === niLogFilter; });
  var totalPages = Math.max(1, Math.ceil(filtered.length / NI_LOG_PER_PAGE));
  niLogCurrentPage = Math.max(0, Math.min(totalPages - 1, niLogCurrentPage + delta));
  niRenderLog();
}

function niRenderLog() {
  var tbody    = document.getElementById('ni-log-tbody');
  var pageInfo = document.getElementById('ni-log-page-info');
  if (!tbody) return;

  var samples  = niGetAllSamples();
  var filtered = niLogFilter === 'ALL'
    ? samples
    : samples.filter(function(r) { return r.status === niLogFilter; });

  var totalPages   = Math.max(1, Math.ceil(filtered.length / NI_LOG_PER_PAGE));
  niLogCurrentPage = Math.min(niLogCurrentPage, totalPages - 1);

  var page = filtered.slice(
    niLogCurrentPage * NI_LOG_PER_PAGE,
    (niLogCurrentPage + 1) * NI_LOG_PER_PAGE
  );

  tbody.innerHTML = page.map(function(r, rowIdx) {
    var d   = new Date(r.ts);
    var ts  = ('0' + d.getDate()).slice(-2) + '/' +
              ('0' + (d.getMonth() + 1)).slice(-2) + ' ' +
              ('0' + d.getHours()).slice(-2) + ':' +
              ('0' + d.getMinutes()).slice(-2) + ':' +
              ('0' + d.getSeconds()).slice(-2);
    var sc  = r.status === 'CRITICAL' ? '#ef4444' : r.status === 'WARNING' ? '#f59e0b' : '#10b981';
    var lc  = niLatencyColor(r.latency);
    var jc  = niJitterColor(r.jitter);
    var ipc = r.ipStatus === 'CHANGED' ? '#ef4444' : '#10b981';
    var vc  = r.vpn === 'ACTIVE' ? '#10b981' : r.vpn === 'DROPPED' ? '#ef4444' : '#64748b';
    var dc  = r.dns === 'STABLE' ? '#10b981' : r.dns === 'FAIL' ? '#ef4444' : '#f59e0b';
    var bg  = rowIdx % 2 === 0 ? 'rgba(13,21,38,0.4)' : 'transparent';
    return '<tr style="background:' + bg + '; border-bottom:1px solid rgba(30,45,74,0.5);">' +
      '<td style="padding:7px 10px; font-family:var(--font-mono); font-size:11px; color:#94a3b8; white-space:nowrap;">' + ts + '</td>' +
      '<td style="padding:7px 10px; font-family:var(--font-mono); font-size:11px; color:' + lc  + ';">' + r.latency  + ' ms</td>' +
      '<td style="padding:7px 10px; font-family:var(--font-mono); font-size:11px; color:' + jc  + ';">' + r.jitter   + ' ms</td>' +
      '<td style="padding:7px 10px; font-family:var(--font-mono); font-size:11px; color:' + ipc + ';">' + r.ipStatus + '</td>' +
      '<td style="padding:7px 10px; font-family:var(--font-mono); font-size:11px; color:' + vc  + ';">' + r.vpn      + '</td>' +
      '<td style="padding:7px 10px; font-family:var(--font-mono); font-size:11px; color:' + dc  + ';">' + r.dns      + '</td>' +
      '<td style="padding:7px 10px;">' +
        '<span style="font-family:var(--font-mono); font-size:10px; padding:2px 8px; border-radius:2px; ' +
          'background:' + sc + '22; color:' + sc + '; border:1px solid ' + sc + '44; letter-spacing:1px;">' +
          r.status + '</span></td></tr>';
  }).join('');

  if (pageInfo) {
    if (filtered.length > 0) {
      var start = niLogCurrentPage * NI_LOG_PER_PAGE + 1;
      var end   = Math.min((niLogCurrentPage + 1) * NI_LOG_PER_PAGE, filtered.length);
      pageInfo.textContent = 'SHOWING ' + start + '–' + end + ' OF ' + filtered.length;
    } else {
      pageInfo.textContent = 'NO RECORDS';
    }
  }

  var prevBtn = document.getElementById('ni-log-prev');
  var nextBtn = document.getElementById('ni-log-next');
  if (prevBtn) prevBtn.disabled = (niLogCurrentPage === 0);
  if (nextBtn) nextBtn.disabled = (niLogCurrentPage + 1 >= totalPages);
}

function niExportCSV() {
  var samples = niGetAllSamples();
  var rows    = ['TIMESTAMP,LATENCY_MS,JITTER_MS,IP_STATUS,VPN,DNS,STATUS'];
  samples.forEach(function(r) {
    var ts = new Date(r.ts).toISOString().replace('T', ' ').slice(0, 19);
    rows.push([ts, r.latency, r.jitter, r.ipStatus, r.vpn, r.dns, r.status].join(','));
  });
  var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'aegis-network-log-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── NAV LISTENER ─────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(function(item) {
  item.addEventListener('click', function() {
    if (item.dataset.page === 'network-intelligence') {
      setTimeout(initNetworkIntelligence, 100);
    }
  });
});
