'use strict';

// ─── NETWORK TOOLKIT ─────────────────────────────────────────
const NT_PROXY = 'https://aegis-proxy.ka-mixalis99.workers.dev/?url=';

// ── Tab management ────────────────────────────────────────────
let ntActiveTab = 'traceroute';

function ntSwitchTab(tab) {
  ntActiveTab = tab;
  try { localStorage.setItem('nt-active-tab', tab); } catch(_) {}
  document.querySelectorAll('[data-nt-tab]').forEach(function(btn) {
    const isActive = btn.dataset.ntTab === tab;
    btn.style.background  = isActive ? 'rgba(245,158,11,0.1)' : 'transparent';
    btn.style.color       = isActive ? '#f59e0b' : '#64748b';
    btn.style.borderColor = isActive ? '#f59e0b' : '#1e2d4a';
  });
  document.querySelectorAll('.nt-panel').forEach(function(p) { p.style.display = 'none'; });
  const panel = document.getElementById('nt-panel-' + tab);
  if (panel) panel.style.display = 'block';
  // Leaflet needs the container visible before it can measure dimensions
  if (tab === 'pathviz') setTimeout(ntEnsurePathVizMap, 50);
}

// ═══════════════════════════════════════════════════════════════
// TAB 1 — TRACEROUTE VISUALIZER
// ═══════════════════════════════════════════════════════════════
let ntTraceRunning = false;
let ntTraceAbort = false;

const NT_BACKBONE_NODES = [
  { label: 'Cloudflare DNS', host: '1.1.1.1' },
  { label: 'Google DNS',     host: '8.8.8.8' },
  { label: 'OpenDNS',        host: '208.67.222.222' },
  { label: 'Quad9',          host: '9.9.9.9' },
  { label: 'Level3',         host: '4.2.2.1' },
  { label: 'Comcast DNS',    host: '75.75.75.75' }
];

async function measureLatency(url, samples) {
  const times = [];
  const n = samples || 3;
  for (let i = 0; i < n; i++) {
    if (ntTraceAbort) break;
    const t0 = performance.now();
    try {
      await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(4000) });
    } catch (_) {}
    const t1 = performance.now();
    times.push(Math.round(t1 - t0));
  }
  if (!times.length) return null;
  return Math.round(times.reduce(function(a, b) { return a + b; }, 0) / times.length);
}

async function ntRunTrace() {
  const input = document.getElementById('nt-trace-input').value.trim();
  if (!input) { document.getElementById('nt-trace-result').innerHTML = '<p class="placeholder-text">Enter a domain or IP address.</p>'; return; }
  if (ntTraceRunning) { ntTraceAbort = true; return; }

  ntTraceRunning = true;
  ntTraceAbort = false;
  const btn = document.getElementById('nt-trace-btn');
  btn.textContent = '■ STOP';
  btn.style.borderColor = '#ef4444';
  btn.style.color = '#ef4444';

  const result = document.getElementById('nt-trace-result');
  result.innerHTML = '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:16px;">TRACING ROUTE TO ' + input.toUpperCase() + '...</div><div id="nt-trace-hops"></div>';

  const hopsEl = document.getElementById('nt-trace-hops');
  const hops = [];

  // Resolve target to IP first
  let targetIP = input;
  let targetLabel = input;
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(input)) {
    try {
      const dns = await fetch('https://dns.google/resolve?name=' + encodeURIComponent(input) + '&type=A');
      const dj = await dns.json();
      if (dj.Answer && dj.Answer.length) targetIP = dj.Answer[0].data;
    } catch (_) {}
  }

  const allNodes = NT_BACKBONE_NODES.concat([{ label: targetLabel, host: targetIP }]);

  for (let i = 0; i < allNodes.length; i++) {
    if (ntTraceAbort) break;
    const node = allNodes[i];
    const hopNum = i + 1;

    // Add pending hop
    hops.push({ num: hopNum, label: node.label, host: node.host, latency: null, loss: 0, status: 'measuring' });
    renderTraceHops(hopsEl, hops);

    // Measure via DNS-over-HTTPS ping (fetch to known endpoint)
    let lat = null;
    let loss = 0;
    const probeUrl = 'https://dns.google/resolve?name=' + encodeURIComponent(node.host) + '&type=A';
    const attempts = 3;
    let failed = 0;
    const times = [];
    for (let s = 0; s < attempts; s++) {
      if (ntTraceAbort) break;
      const t0 = performance.now();
      try {
        await fetch(probeUrl, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
        times.push(Math.round(performance.now() - t0));
      } catch (_) { failed++; }
    }
    loss = Math.round((failed / attempts) * 100);
    lat = times.length ? Math.round(times.reduce(function(a, b) { return a + b; }, 0) / times.length) : null;

    hops[i] = { num: hopNum, label: node.label, host: node.host, latency: lat, loss: loss, status: 'done' };
    renderTraceHops(hopsEl, hops);

    if (i < allNodes.length - 1) await new Promise(function(r) { setTimeout(r, 200); });
  }

  // Export button
  if (!ntTraceAbort) {
    const exportBtn = document.createElement('div');
    exportBtn.style.marginTop = '16px';
    exportBtn.innerHTML = '<button onclick="ntExportTrace()" class="aegis-btn" style="font-size:11px; padding:6px 16px; border-color:#a78bfa; color:#a78bfa;">&#11015; EXPORT AS TEXT</button>';
    hopsEl.parentElement.appendChild(exportBtn);
  }

  ntTraceRunning = false;
  ntTraceAbort = false;
  btn.textContent = '▶ TRACE';
  btn.style.borderColor = '#f59e0b';
  btn.style.color = '#f59e0b';
}

function ntLatColor(lat) {
  if (lat == null) return '#64748b';
  if (lat < 80)  return '#10b981';
  if (lat < 200) return '#f59e0b';
  return '#ef4444';
}

function renderTraceHops(container, hops) {
  container.innerHTML = hops.map(function(hop, idx) {
    const col = hop.status === 'measuring' ? '#64748b' : ntLatColor(hop.latency);
    const latStr = hop.status === 'measuring' ? 'MEASURING...' : (hop.latency != null ? hop.latency + ' ms' : 'TIMEOUT');
    const lossStr = hop.loss > 0 ? '<span style="color:#ef4444; margin-left:12px;">' + hop.loss + '% LOSS</span>' : '';
    const connector = idx < hops.length - 1 ? '<div style="width:2px; height:20px; background:' + col + '; margin:0 auto; opacity:0.4;"></div>' : '';
    return '<div style="display:flex; flex-direction:column; align-items:flex-start; margin-bottom:0;">' +
      '<div style="display:flex; align-items:center; gap:14px; padding:10px 16px; background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ' + col + '; border-radius:3px; width:100%; box-sizing:border-box;">' +
      '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); min-width:28px;">HOP ' + hop.num + '</div>' +
      '<div style="flex:1;">' +
      '<div style="font-family:var(--font-title); font-size:13px; color:' + col + '; letter-spacing:1px;">' + hop.label + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">' + hop.host + '</div>' +
      '</div>' +
      '<div style="font-family:var(--font-title); font-size:16px; color:' + col + ';">' + latStr + lossStr + '</div>' +
      '</div>' +
      connector +
      '</div>';
  }).join('');
}

function ntExportTrace() {
  const hopsEl = document.getElementById('nt-trace-hops');
  if (!hopsEl) return;
  const text = 'AEGIS TRACEROUTE REPORT\n' + new Date().toUTCString() + '\n\n' + hopsEl.innerText;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'aegis-traceroute-' + Date.now() + '.txt'; a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
// TAB 2 — DNS RECORDS LOOKUP
// ═══════════════════════════════════════════════════════════════
let ntWhoisHistory = [];

const NT_DNS_TYPES = [
  { type: 'A',   label: 'A RECORDS',   desc: 'IPv4 addresses', color: '#10b981' },
  { type: 'AAAA',label: 'AAAA RECORDS',desc: 'IPv6 addresses', color: '#34d399' },
  { type: 'MX',  label: 'MX RECORDS',  desc: 'Mail servers',   color: '#60a5fa' },
  { type: 'NS',  label: 'NS RECORDS',  desc: 'Nameservers',    color: '#a78bfa' },
  { type: 'TXT', label: 'TXT RECORDS', desc: 'SPF / DMARC / verification', color: '#f59e0b' }
];

async function ntDNSQuery(domain, type) {
  try {
    const r = await fetch('https://dns.google/resolve?name=' + encodeURIComponent(domain) + '&type=' + type, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    return d.Answer || [];
  } catch (_) { return []; }
}

async function ntRunWhois() {
  const input = document.getElementById('nt-whois-input').value.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*/,'');
  if (!input) { document.getElementById('nt-whois-result').innerHTML = '<p class="placeholder-text">Enter a domain name.</p>'; return; }

  const result = document.getElementById('nt-whois-result');
  result.innerHTML = '<p class="loading">QUERYING DNS RECORDS...</p>';

  try {
    const records = await Promise.all(NT_DNS_TYPES.map(function(t) {
      return ntDNSQuery(input, t.type).then(function(ans) { return { ...t, answers: ans }; });
    }));

    const hasAny = records.some(function(r) { return r.answers.length > 0; });
    if (!hasAny) {
      result.innerHTML = '<div style="border:1px solid #ef4444; border-left:3px solid #ef4444; border-radius:3px; padding:16px; background:rgba(239,68,68,0.08); font-family:var(--font-mono); font-size:13px; color:#ef4444;">No DNS records found for <strong>' + input + '</strong>. The domain may not exist or DNS resolution failed.</div>';
      return;
    }

    const sections = records.filter(function(r) { return r.answers.length > 0; }).map(function(r) {
      const rows = r.answers.map(function(ans) {
        const data = String(ans.data || '');
        const ttl  = ans.TTL != null ? ans.TTL + 's TTL' : '';
        return '<div style="display:flex; justify-content:space-between; align-items:flex-start; padding:7px 10px; border-bottom:1px solid rgba(30,45,74,0.5); font-family:var(--font-mono); font-size:12px;">' +
          '<span style="color:var(--text-primary); flex:1; word-break:break-all;">' + ntEscDns(data) + '</span>' +
          '<span style="color:var(--text-dim); font-size:11px; margin-left:12px; flex-shrink:0;">' + ttl + '</span>' +
          '</div>';
      }).join('');
      return '<div style="margin-bottom:16px; background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ' + r.color + '; border-radius:3px; overflow:hidden;">' +
        '<div style="padding:8px 12px; background:rgba(0,0,0,0.2); display:flex; justify-content:space-between; align-items:center;">' +
        '<span style="font-family:var(--font-mono); font-size:11px; color:' + r.color + '; letter-spacing:1px;">' + r.label + '</span>' +
        '<span style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">' + r.desc + ' · ' + r.answers.length + ' record' + (r.answers.length !== 1 ? 's' : '') + '</span>' +
        '</div>' +
        rows +
        '</div>';
    }).join('');

    result.innerHTML =
      '<div style="background:var(--bg-card); border:1px solid var(--border); border-top:2px solid var(--amber); border-radius:4px; padding:20px;">' +
      '<div style="font-family:var(--font-title); font-size:16px; color:var(--amber); letter-spacing:2px; margin-bottom:4px;">&#9673; DNS RECORDS — ' + input.toUpperCase() + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-bottom:16px;">Source: Google Public DNS · ' + new Date().toUTCString() + '</div>' +
      sections +
      '</div>';

    ntWhoisHistory = ntWhoisHistory.filter(function(h) { return h.domain !== input; });
    ntWhoisHistory.unshift({ domain: input, count: records.reduce(function(a, r) { return a + r.answers.length; }, 0) });
    if (ntWhoisHistory.length > 5) ntWhoisHistory.pop();
    ntRenderWhoisHistory();

  } catch (e) {
    result.innerHTML = '<div style="font-family:var(--font-mono); font-size:13px; color:#ef4444; padding:16px; border:1px solid #ef4444; border-radius:3px;">Error: ' + e.message + '</div>';
  }
}

function ntEscDns(text) {
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function ntWhoisRow(label, value) {
  return '<div style="padding:10px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:3px;">' +
    '<div style="color:var(--text-dim); font-size:11px; letter-spacing:1px; margin-bottom:4px;">' + label + '</div>' +
    '<div style="color:var(--text-primary);">' + value + '</div>' +
    '</div>';
}

function ntRenderWhoisHistory() {
  const el = document.getElementById('nt-whois-history');
  if (!el) return;
  if (!ntWhoisHistory.length) { el.innerHTML = '<p class="placeholder-text" style="font-size:12px;">No recent lookups</p>'; return; }
  el.innerHTML = ntWhoisHistory.map(function(h) {
    return '<div onclick="document.getElementById(\'nt-whois-input\').value=\'' + h.domain + '\'; ntRunWhois();" style="cursor:pointer; padding:8px 12px; margin-bottom:6px; background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid var(--amber); border-radius:2px; font-family:var(--font-mono); font-size:12px;" onmouseover="this.style.background=\'rgba(245,158,11,0.05)\'" onmouseout="this.style.background=\'var(--bg-secondary)\'">' +
      '<div style="color:var(--amber);">' + h.domain + '</div>' +
      '<div style="color:var(--text-dim); font-size:11px;">' + (h.count || 0) + ' records found</div>' +
      '</div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// TAB 3 — SPEED TEST
// ═══════════════════════════════════════════════════════════════
let ntSpeedTestRunning = false;
let ntSpeedAbort = false;
let ntSpeedHistory = [];

async function ntRunSpeedTest() {
  if (ntSpeedTestRunning) { ntSpeedAbort = true; return; }
  ntSpeedTestRunning = true;
  ntSpeedAbort = false;

  const btn = document.getElementById('nt-speed-btn');
  btn.textContent = '■ STOP';
  btn.style.borderColor = '#ef4444';
  btn.style.color = '#ef4444';

  const result = document.getElementById('nt-speed-result');
  result.innerHTML = ntSpeedGaugeHTML('TESTING...', null, null, null);

  const startTime = Date.now();

  // --- Latency ---
  let latency = null;
  try {
    const t0 = performance.now();
    await fetch('https://speed.cloudflare.com/__down?bytes=1', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    latency = Math.round(performance.now() - t0);
  } catch (_) {}

  if (ntSpeedAbort) { ntSpeedDone(btn); return; }

  ntUpdateGauge('DOWNLOAD', 0, null, null, latency);

  // --- Download ---
  let downloadMbps = null;
  try {
    const t0 = performance.now();
    const resp = await fetch('https://speed.cloudflare.com/__down?bytes=10000000', { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    const buffer = await resp.arrayBuffer();
    const elapsed = (performance.now() - t0) / 1000;
    const bits = buffer.byteLength * 8;
    downloadMbps = parseFloat((bits / elapsed / 1e6).toFixed(1));
  } catch (_) {}

  if (ntSpeedAbort) { ntSpeedDone(btn); return; }
  ntUpdateGauge('UPLOAD', downloadMbps, null, null, latency);

  // --- Upload ---
  let uploadMbps = null;
  try {
    const payload = new Uint8Array(1024 * 1024); // 1 MB
    const t0 = performance.now();
    await fetch('https://speed.cloudflare.com/__up', { method: 'POST', body: payload, cache: 'no-store', signal: AbortSignal.timeout(30000) });
    const elapsed = (performance.now() - t0) / 1000;
    uploadMbps = parseFloat(((payload.byteLength * 8) / elapsed / 1e6).toFixed(1));
  } catch (_) {}

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Save history
  if (downloadMbps || uploadMbps) {
    ntSpeedHistory.unshift({ ts: new Date().toLocaleTimeString(), dl: downloadMbps, ul: uploadMbps, lat: latency, dur: duration });
    if (ntSpeedHistory.length > 5) ntSpeedHistory.pop();
  }

  result.innerHTML = ntSpeedGaugeHTML('COMPLETE', downloadMbps, uploadMbps, latency, duration);
  ntRenderSpeedHistory();
  ntSpeedDone(btn);
}

function ntSpeedDone(btn) {
  ntSpeedTestRunning = false;
  ntSpeedAbort = false;
  btn.textContent = '▶ START TEST';
  btn.style.borderColor = '#f59e0b';
  btn.style.color = '#f59e0b';
}

function ntUpdateGauge(phase, dl, ul, loss, lat) {
  const el = document.getElementById('nt-speed-result');
  if (el) el.innerHTML = ntSpeedGaugeHTML(phase + '...', dl, ul, lat);
}

function ntSpeedGaugeHTML(phase, dl, ul, lat, duration) {
  const dlVal = dl != null ? dl : 0;
  const ulVal = ul != null ? ul : 0;
  const maxMbps = 1000;
  const dlPct = Math.min((dlVal / maxMbps) * 100, 100);
  const ulPct = Math.min((ulVal / maxMbps) * 100, 100);

  function speedColor(mbps) {
    if (mbps == null) return '#64748b';
    if (mbps >= 100) return '#10b981';
    if (mbps >= 25)  return '#f59e0b';
    return '#ef4444';
  }

  const dlColor = speedColor(dl);
  const ulColor = speedColor(ul);

  const isRunning = phase !== 'COMPLETE';
  const animation = isRunning ? 'animation:loadingBar 1.5s ease-in-out infinite;' : '';

  return '<div style="background:var(--bg-card); border:1px solid var(--border); border-top:2px solid var(--amber); border-radius:4px; padding:24px; text-align:center;">' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--amber); letter-spacing:3px; margin-bottom:20px;">' + phase + '</div>' +

    // Download
    '<div style="margin-bottom:20px;">' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">&#11015; DOWNLOAD</div>' +
    '<div style="font-family:var(--font-title); font-size:40px; color:' + dlColor + '; margin-bottom:8px;">' + (dl != null ? dl : (isRunning && phase.startsWith('DOWN') ? '...' : '—')) + '<span style="font-size:16px; color:var(--text-dim);"> Mbps</span></div>' +
    '<div style="background:var(--bg-secondary); border-radius:4px; height:10px; width:100%; overflow:hidden;">' +
    '<div style="height:10px; background:' + dlColor + '; width:' + dlPct + '%; border-radius:4px; box-shadow:0 0 8px ' + dlColor + '; ' + (isRunning && phase.startsWith('DOWN') ? animation : '') + '"></div>' +
    '</div></div>' +

    // Upload
    '<div style="margin-bottom:20px;">' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">&#11014; UPLOAD</div>' +
    '<div style="font-family:var(--font-title); font-size:40px; color:' + ulColor + '; margin-bottom:8px;">' + (ul != null ? ul : (isRunning && phase.startsWith('UP') ? '...' : '—')) + '<span style="font-size:16px; color:var(--text-dim);"> Mbps</span></div>' +
    '<div style="background:var(--bg-secondary); border-radius:4px; height:10px; width:100%; overflow:hidden;">' +
    '<div style="height:10px; background:' + ulColor + '; width:' + ulPct + '%; border-radius:4px; box-shadow:0 0 8px ' + ulColor + '; ' + (isRunning && phase.startsWith('UP') ? animation : '') + '"></div>' +
    '</div></div>' +

    // Stats row
    '<div style="display:flex; justify-content:center; gap:32px; margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">' +
    '<div><div style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim); letter-spacing:2px;">LATENCY</div><div style="font-family:var(--font-title); font-size:20px; color:' + (lat != null ? ntLatColor(lat) : '#64748b') + ';">' + (lat != null ? lat + ' ms' : '—') + '</div></div>' +
    '<div><div style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim); letter-spacing:2px;">DURATION</div><div style="font-family:var(--font-title); font-size:20px; color:var(--text-primary);">' + (duration ? duration + 's' : '—') + '</div></div>' +
    '</div></div>';
}

function ntRenderSpeedHistory() {
  const el = document.getElementById('nt-speed-history');
  if (!el || !ntSpeedHistory.length) return;
  el.innerHTML = '<div style="font-family:var(--font-mono); font-size:11px; color:var(--amber); letter-spacing:2px; margin-bottom:12px;">LAST 5 TESTS</div>' +
    '<div style="display:grid; grid-template-columns:repeat(5,1fr); gap:8px;">' +
    ntSpeedHistory.map(function(h) {
      return '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:3px; padding:10px; text-align:center; font-family:var(--font-mono); font-size:11px;">' +
        '<div style="color:var(--text-dim); margin-bottom:6px;">' + h.ts + '</div>' +
        '<div style="color:#10b981;">&#11015; ' + (h.dl || '—') + ' Mbps</div>' +
        '<div style="color:#60a5fa;">&#11014; ' + (h.ul || '—') + ' Mbps</div>' +
        '<div style="color:var(--text-dim);">' + (h.lat || '—') + ' ms</div>' +
        '</div>';
    }).join('') +
    '</div>';
}

// ═══════════════════════════════════════════════════════════════
// TAB 4 — MAC LOOKUP
// ═══════════════════════════════════════════════════════════════
const NT_MAC_TABLE = [
  { prefix: '00:1A:2B', vendor: 'Cisco Systems', type: 'Networking' },
  { prefix: '00:50:56', vendor: 'VMware', type: 'Virtualization' },
  { prefix: 'F4:DB:E6', vendor: 'Apple', type: 'Consumer' },
  { prefix: '00:16:CB', vendor: 'Apple', type: 'Consumer' },
  { prefix: '00:1C:B3', vendor: 'Apple', type: 'Consumer' },
  { prefix: '98:54:1B', vendor: 'Samsung', type: 'Consumer' },
  { prefix: '8C:F5:A3', vendor: 'Samsung', type: 'Consumer' },
  { prefix: '00:21:6B', vendor: 'Intel', type: 'Networking' },
  { prefix: 'A4:C3:F0', vendor: 'Intel', type: 'Networking' },
  { prefix: 'B8:27:EB', vendor: 'Raspberry Pi Foundation', type: 'IoT' }
];

function ntNormalizeMAC(raw) {
  const clean = raw.replace(/[:\-\s]/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(clean)) return null;
  return clean.match(/.{2}/g).join(':');
}

async function ntRunMACLookup() {
  const raw = document.getElementById('nt-mac-input').value.trim();
  const mac = ntNormalizeMAC(raw);
  const result = document.getElementById('nt-mac-result');

  if (!mac) {
    result.innerHTML = '<div style="font-family:var(--font-mono); font-size:13px; color:#ef4444; padding:14px; border:1px solid #ef4444; border-radius:3px;">Invalid MAC address format. Use AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, or AABBCCDDEEFF.</div>';
    return;
  }

  result.innerHTML = '<p class="loading">LOOKING UP VENDOR...</p>';

  try {
    const resp = await fetch('https://api.macvendors.com/' + encodeURIComponent(mac), { signal: AbortSignal.timeout(8000) });
    const vendor = resp.ok ? (await resp.text()).trim() : null;

    const prefix = mac.slice(0, 8).toUpperCase();

    result.innerHTML =
      '<div style="background:var(--bg-card); border:1px solid var(--border); border-top:2px solid var(--amber); border-radius:4px; padding:20px;">' +
      '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-family:var(--font-mono); font-size:13px; margin-bottom:16px;">' +
      ntWhoisRow('MAC ADDRESS', mac) +
      ntWhoisRow('OUI PREFIX', prefix) +
      '<div style="grid-column:span 2; padding:14px; background:rgba(245,158,11,0.06); border:1px solid var(--amber); border-radius:3px;">' +
      '<div style="font-size:11px; color:var(--text-dim); letter-spacing:1px; margin-bottom:6px;">MANUFACTURER</div>' +
      '<div style="font-family:var(--font-title); font-size:20px; color:var(--amber); letter-spacing:2px;">' + (vendor || 'UNKNOWN VENDOR') + '</div>' +
      '</div>' +
      '</div>' +
      (vendor ? '<div style="font-family:var(--font-mono); font-size:12px; color:#10b981;">&#10003; Vendor identified via macvendors.com OUI database</div>' :
               '<div style="font-family:var(--font-mono); font-size:12px; color:#f59e0b;">&#9888; Vendor not found — MAC may be locally administered, randomized, or the OUI is unregistered</div>') +
      '</div>';

  } catch (e) {
    result.innerHTML = '<div style="font-family:var(--font-mono); font-size:13px; color:#ef4444; padding:14px; border:1px solid #ef4444; border-radius:3px;">Lookup failed: ' + e.message + '</div>';
  }
}

function ntRenderMACTable() {
  const el = document.getElementById('nt-mac-table');
  if (!el) return;
  el.innerHTML = '<div style="font-family:var(--font-mono); font-size:11px; color:var(--amber); letter-spacing:2px; margin-bottom:12px;">COMMON OUI PREFIXES REFERENCE</div>' +
    '<table style="width:100%; border-collapse:collapse;">' +
    '<thead><tr>' +
    ['PREFIX', 'VENDOR', 'TYPE'].map(function(h) {
      return '<th style="font-family:var(--font-mono); font-size:10px; color:var(--amber); padding:8px 10px; text-align:left; border-bottom:1px solid var(--border); letter-spacing:1px;">' + h + '</th>';
    }).join('') +
    '</tr></thead><tbody>' +
    NT_MAC_TABLE.map(function(row, i) {
      const bg = i % 2 === 0 ? 'rgba(13,21,38,0.4)' : 'transparent';
      return '<tr style="background:' + bg + ';">' +
        '<td style="font-family:var(--font-mono); font-size:12px; color:#60a5fa; padding:8px 10px;">' + row.prefix + ':xx:xx:xx</td>' +
        '<td style="font-family:var(--font-mono); font-size:12px; color:var(--text-primary); padding:8px 10px;">' + row.vendor + '</td>' +
        '<td style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); padding:8px 10px;">' + row.type + '</td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
}

// ═══════════════════════════════════════════════════════════════
// TAB 5 — NETWORK PATH VISUALIZER
// ═══════════════════════════════════════════════════════════════
const NT_PV_PROXY  = 'https://aegis-proxy.ka-mixalis99.workers.dev/?url=';
const NT_PV_SUSPICIOUS_COUNTRIES = new Set(['CN','RU','KP','IR','SY','BY']);

let ntPathVizMap       = null;
let ntPathVizRunning   = false;
let ntPathVizHops      = [];
let ntPathVizUserLL    = null;
let ntPathVizListeners = false;
let ntPathVizTarget    = '';

// Private IP ranges
function ntPvIsPrivate(ip) {
  if (!ip) return true;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|169\.254\.|::1|fc|fd)/i.test(ip);
}

// Country flag emoji from 2-letter code
function ntPvFlag(cc) {
  if (!cc || cc.length !== 2) return '';
  const offset = 0x1F1E6 - 65;
  return String.fromCodePoint(cc.charCodeAt(0) + offset) + String.fromCodePoint(cc.charCodeAt(1) + offset);
}

// In-session geo cache — avoids re-querying the same IP within one app session
const ntPvGeoCache = Object.create(null);

// Geolocate a public IP via the Cloudflare proxy → ipwho.is
async function ntPvGeolocate(ip) {
  if (!ip || ntPvIsPrivate(ip)) return null;
  if (ntPvGeoCache[ip]) return ntPvGeoCache[ip];
  await new Promise(function(r) { setTimeout(r, 300); });
  try {
    const r = await fetch(NT_PV_PROXY + 'https://ipwho.is/' + ip,
      { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.success && d.success !== undefined) return null;
    const geo = {
      lat:     d.latitude  || d.lat || 0,
      lon:     d.longitude || d.lon || 0,
      country: d.country       || '',
      cc:      d.country_code  || '',
      isp:     (d.connection && d.connection.isp) ? d.connection.isp : (d.isp || ''),
      city:    d.city          || ''
    };
    ntPvGeoCache[ip] = geo;
    return geo;
  } catch (_) { return null; }
}

// Initialize the Leaflet map (called lazily when the tab is shown)
function ntEnsurePathVizMap() {
  if (ntPathVizMap) {
    ntPathVizMap.invalidateSize();
    return;
  }
  const container = document.getElementById('nt-pathviz-map');
  if (!container || typeof L === 'undefined') return;

  ntPathVizMap = L.map('nt-pathviz-map', {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    zoomControl: true,
    attributionControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(ntPathVizMap);

  // Register IPC listeners once
  if (!ntPathVizListeners && window.aegis && window.aegis.onTracerouteHop) {
    window.aegis.onTracerouteHop(function(hop) {
      if (ntPathVizRunning) ntPvHandleHop(hop);
    });
    window.aegis.onTracerouteDone(function() {
      ntPvDone();
    });
    ntPathVizListeners = true;
  }
}

// Create a custom glowing marker for a hop
function ntPvMakeIcon(hopNum, color) {
  return L.divIcon({
    className: '',
    html: '<div style="width:22px;height:22px;border-radius:50%;background:' + color + ';border:2px solid ' + color + ';box-shadow:0 0 10px ' + color + ',0 0 20px rgba(245,158,11,0.3);display:flex;align-items:center;justify-content:center;font-family:IBM Plex Mono,monospace;font-size:9px;font-weight:bold;color:#020818;">' + hopNum + '</div>',
    iconSize:   [22, 22],
    iconAnchor: [11, 11]
  });
}

// Draw an animated amber (or red) line between two LatLng points
function ntPvDrawLine(from, to, color) {
  if (!ntPathVizMap || !from || !to) return;

  // Glow underlay (wider, dimmer)
  L.polyline([from, to], {
    color: color,
    weight: 5,
    opacity: 0.15,
    className: 'pv-line-glow'
  }).addTo(ntPathVizMap);

  // Animated dashed line (on top)
  const line = L.polyline([from, to], {
    color: color,
    weight: 2,
    opacity: 0.9,
    className: 'pv-line-dash'
  }).addTo(ntPathVizMap);

  return line;
}

// Add a hop to the map and hop-list panel
async function ntPvHandleHop(hop) {
  // Avoid duplicates (traceroute may re-send)
  if (ntPathVizHops.some(function(h) { return h.hopNum === hop.hopNum; })) return;
  ntPathVizHops.push(hop);

  const hopsEl = document.getElementById('nt-pathviz-hops');

  if (hop.timeout || !hop.ip) {
    // Timeout hop — add to list only
    ntPvRenderHopRow(hop, null, hopsEl);
    return;
  }

  // Private IP — no map dot, but show in list
  if (ntPvIsPrivate(hop.ip)) {
    ntPvRenderHopRow(hop, { private: true }, hopsEl);
    return;
  }

  // Geolocate
  const geo = await ntPvGeolocate(hop.ip);
  if (!geo || (geo.lat === 0 && geo.lon === 0)) {
    ntPvRenderHopRow(hop, null, hopsEl);
    return;
  }

  const suspicious = NT_PV_SUSPICIOUS_COUNTRIES.has(geo.cc);
  const color = suspicious ? '#ef4444' : '#f59e0b';
  const hopLL = [geo.lat, geo.lon];

  // Draw line from previous known point
  const prevLL = ntPvLastKnownLL();
  ntPvDrawLine(prevLL, hopLL, color);

  // Marker
  const icon = ntPvMakeIcon(hop.hopNum, color);
  const marker = L.marker(hopLL, { icon }).addTo(ntPathVizMap);
  marker.bindPopup(ntPvPopupHTML(hop, geo, suspicious), { className: 'pv-popup' });

  // Pulse ring
  L.circle(hopLL, {
    radius: 80000,
    color: color,
    fillColor: color,
    fillOpacity: 0.04,
    weight: 1,
    opacity: 0.4,
    className: 'pv-pulse-ring'
  }).addTo(ntPathVizMap);

  // Store last known LL
  hop._ll = hopLL;
  hop._geo = geo;
  hop._suspicious = suspicious;

  ntPvRenderHopRow(hop, geo, hopsEl);

  // Fly map to keep all hops in view
  try {
    const allLL = ntPathVizHops.filter(function(h) { return h._ll; }).map(function(h) { return h._ll; });
    if (ntPathVizUserLL) allLL.unshift(ntPathVizUserLL);
    if (allLL.length > 1) ntPathVizMap.flyToBounds(L.latLngBounds(allLL), { padding: [40, 40], duration: 0.6 });
  } catch (_) {}

  ntPvUpdateStatus('HOP ' + hop.hopNum + ' — ' + hop.ip + ' — ' + geo.city + ', ' + ntPvFlag(geo.cc) + ' ' + geo.country);
}

// Find the last LatLng we have a geo fix for
function ntPvLastKnownLL() {
  for (let i = ntPathVizHops.length - 1; i >= 0; i--) {
    if (ntPathVizHops[i]._ll) return ntPathVizHops[i]._ll;
  }
  return ntPathVizUserLL || [20, 0];
}

// Build popup HTML for a hop marker
function ntPvPopupHTML(hop, geo, suspicious) {
  const col = suspicious ? '#ef4444' : '#f59e0b';
  return '<div style="font-family:IBM Plex Mono,monospace;font-size:12px;color:#e2e8f0;min-width:200px;background:#0d1526;padding:12px;border-radius:3px;">' +
    '<div style="color:' + col + ';font-size:13px;font-weight:bold;margin-bottom:8px;">HOP ' + hop.hopNum + (suspicious ? ' ⚠ SUSPICIOUS' : '') + '</div>' +
    '<div style="color:#64748b;margin-bottom:3px;">IP: <span style="color:#e2e8f0;">' + hop.ip + '</span></div>' +
    (geo.city ? '<div style="color:#64748b;margin-bottom:3px;">CITY: <span style="color:#e2e8f0;">' + geo.city + '</span></div>' : '') +
    '<div style="color:#64748b;margin-bottom:3px;">COUNTRY: <span style="color:#e2e8f0;">' + ntPvFlag(geo.cc) + ' ' + geo.country + '</span></div>' +
    (geo.isp ? '<div style="color:#64748b;margin-bottom:3px;">ISP: <span style="color:#e2e8f0;">' + geo.isp + '</span></div>' : '') +
    '<div style="color:#64748b;">LATENCY: <span style="color:' + col + ';">' + (hop.latency != null ? hop.latency + ' ms' : 'N/A') + '</span></div>' +
    '</div>';
}

// Render a single hop row in the hop list
function ntPvRenderHopRow(hop, geo, container) {
  if (!container) return;
  const suspicious = hop._suspicious;
  const col = suspicious ? '#ef4444' : (hop.timeout ? '#64748b' : '#f59e0b');
  const latStr = hop.latency != null ? hop.latency + ' ms' : '—';

  let geoInfo = '';
  if (hop.timeout || !hop.ip) {
    geoInfo = '<span style="color:#64748b;">REQUEST TIMED OUT</span>';
  } else if (geo && geo.private) {
    geoInfo = '<span style="color:#a78bfa;">PRIVATE NETWORK</span>';
  } else if (geo) {
    geoInfo = ntPvFlag(geo.cc) + ' <span style="color:#e2e8f0;">' + geo.country + '</span>' +
      (geo.isp ? ' <span style="color:#64748b;font-size:11px;">· ' + geo.isp + '</span>' : '');
    if (suspicious) geoInfo += ' <span style="color:#ef4444;margin-left:6px;">⚠ SUSPICIOUS ROUTING</span>';
  } else {
    geoInfo = '<span style="color:#64748b;">GEO UNAVAILABLE</span>';
  }

  const row = document.createElement('div');
  row.dataset.hopNum = String(hop.hopNum);
  row.style.cssText = 'display:grid;grid-template-columns:60px 130px 1fr 80px;gap:8px;align-items:center;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-left:3px solid ' + col + ';border-radius:3px;font-family:IBM Plex Mono,monospace;font-size:12px;';
  row.innerHTML =
    '<span style="color:' + col + ';">HOP ' + hop.hopNum + '</span>' +
    '<span style="color:' + col + ';word-break:break-all;">' + (hop.ip || '*') + '</span>' +
    '<span>' + geoInfo + '</span>' +
    '<span style="color:' + col + ';text-align:right;">' + latStr + '</span>';
  container.appendChild(row);
}

function ntPvUpdateStatus(msg) {
  const el = document.getElementById('nt-pathviz-status');
  if (el) el.textContent = msg;
}

function ntPvDone() {
  ntPathVizRunning = false;
  const btn = document.getElementById('nt-pathviz-btn');
  if (btn) { btn.textContent = '⬤ TRACE'; btn.style.borderColor = '#f59e0b'; btn.style.color = '#f59e0b'; }

  // Find the last non-timeout hop (has a real IP)
  let lastValidIdx = -1;
  for (let i = ntPathVizHops.length - 1; i >= 0; i--) {
    if (!ntPathVizHops[i].timeout && ntPathVizHops[i].ip) { lastValidIdx = i; break; }
  }

  // Remove trailing timed-out rows from the table; keep mid-route ones
  const hopsEl = document.getElementById('nt-pathviz-hops');
  if (hopsEl && lastValidIdx >= 0 && lastValidIdx < ntPathVizHops.length - 1) {
    const trailingNums = new Set(
      ntPathVizHops.slice(lastValidIdx + 1).map(function(h) { return h.hopNum; })
    );
    hopsEl.querySelectorAll('[data-hop-num]').forEach(function(row) {
      if (trailingNums.has(Number(row.dataset.hopNum))) row.remove();
    });
  }

  const hopCount = lastValidIdx >= 0 ? lastValidIdx + 1 : ntPathVizHops.length;
  const suspiciousCount = ntPathVizHops.filter(function(h) { return h._suspicious; }).length;
  ntPvUpdateStatus('TRACE COMPLETE — ' + hopCount + ' HOPS · ' + suspiciousCount + ' SUSPICIOUS');

  // Desktop notification — only when at least 3 hops were geolocated
  const geoHops = ntPathVizHops.filter(function(h) { return h._geo; });
  if (geoHops.length >= 3 && window.aegis && window.aegis.notify) {
    const lastCountry = geoHops[geoHops.length - 1]._geo.country || 'unknown';
    window.aegis.notify(
      'Path Trace Complete',
      'Route to ' + ntPathVizTarget + ' mapped — ' + hopCount + ' hops, final destination: ' + lastCountry
    );
  }
}

// Resolve the user's own map position.
// Primary: last radar reading already has the user's real public IP geolocated correctly.
// Fallback: fetch the real public IP from ipify then geolocate it via the proxy.
async function ntPvResolveUserLocation() {
  if (window.aegis && window.aegis.getRadarReadings) {
    try {
      const readings = await window.aegis.getRadarReadings(1);
      const last = readings && readings[readings.length - 1];
      if (last && last.lat && last.lon) {
        const label = [last.cc ? ntPvFlag(last.cc) : '', last.city, last.country]
          .filter(Boolean).join(' ') || last.ip || '';
        return { ll: [last.lat, last.lon], label };
      }
    } catch (_) {}
  }
  // Fallback: get the user's real public IP then geolocate it directly
  try {
    const ipRes  = await fetch('https://api64.ipify.org?format=json', { signal: AbortSignal.timeout(5000) });
    const ipJson = await ipRes.json();
    const selfIP = ipJson && ipJson.ip;
    if (selfIP) {
      const geo = await ntPvGeolocate(selfIP);
      if (geo && (geo.lat || geo.lon)) {
        const label = [geo.cc ? ntPvFlag(geo.cc) : '', geo.city, geo.country]
          .filter(Boolean).join(' ') || selfIP;
        return { ll: [geo.lat, geo.lon], label };
      }
    }
  } catch (_) {}
  return null;
}

// Run a traceroute
async function ntRunPathViz() {
  const input = document.getElementById('nt-pathviz-input').value.trim();
  if (!input) return;

  if (ntPathVizRunning) {
    // Stop current trace
    if (window.aegis && window.aegis.stopTraceroute) window.aegis.stopTraceroute();
    ntPvDone();
    return;
  }

  if (!window.aegis || !window.aegis.startTraceroute) {
    ntPvUpdateStatus('ERROR: traceroute not available in this environment');
    return;
  }

  ntPathVizTarget = input;
  ntEnsurePathVizMap();
  ntClearPathViz();

  ntPathVizRunning = true;
  const btn = document.getElementById('nt-pathviz-btn');
  if (btn) { btn.textContent = '■ STOP'; btn.style.borderColor = '#ef4444'; btn.style.color = '#ef4444'; }
  ntPvUpdateStatus('RESOLVING TARGET...');

  // Add header row to hop list
  const hopsEl = document.getElementById('nt-pathviz-hops');
  if (hopsEl) {
    hopsEl.innerHTML = '<div style="display:grid;grid-template-columns:60px 130px 1fr 80px;gap:8px;padding:6px 12px;font-family:IBM Plex Mono,monospace;font-size:10px;color:var(--amber);letter-spacing:2px;border-bottom:1px solid var(--border);margin-bottom:6px;">' +
      '<span>HOP</span><span>IP ADDRESS</span><span>LOCATION</span><span style="text-align:right;">LATENCY</span></div>';
  }

  // Get user location first so we can draw the first line from "here"
  const userLoc = await ntPvResolveUserLocation();
  if (userLoc) {
    ntPathVizUserLL = userLoc.ll;
    const youIcon = L.divIcon({
      className: '',
      html: '<div style="width:18px;height:18px;border-radius:50%;background:#10b981;border:2px solid #34d399;box-shadow:0 0 10px #10b981,0 0 20px rgba(16,185,129,0.4);display:flex;align-items:center;justify-content:center;font-family:IBM Plex Mono,monospace;font-size:8px;font-weight:bold;color:#020818;">YOU</div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    L.marker(ntPathVizUserLL, { icon: youIcon }).addTo(ntPathVizMap)
      .bindPopup('<div style="font-family:IBM Plex Mono,monospace;font-size:12px;color:#e2e8f0;background:#0d1526;padding:10px;border-radius:3px;"><div style="color:#10b981;margin-bottom:4px;">YOUR LOCATION</div><div>' + userLoc.label + '</div></div>', { className: 'pv-popup' });
    ntPathVizMap.setView(ntPathVizUserLL, 4);
  }

  ntPvUpdateStatus('RUNNING TRACEROUTE TO ' + input.toUpperCase() + '...');
  window.aegis.startTraceroute(input);
}

// Clear map and hop list
function ntClearPathViz() {
  ntPathVizHops = [];
  ntPathVizUserLL = null;
  const hopsEl = document.getElementById('nt-pathviz-hops');
  if (hopsEl) hopsEl.innerHTML = '';
  ntPvUpdateStatus('');
  if (ntPathVizMap) {
    ntPathVizMap.eachLayer(function(layer) {
      if (!(layer instanceof L.TileLayer)) ntPathVizMap.removeLayer(layer);
    });
    ntPathVizMap.setView([20, 0], 2);
  }
}

// ─── INIT ──────────────────────────────────────────────────────
function initNetworkToolkit() {
  let savedTab = 'traceroute';
  try { savedTab = localStorage.getItem('nt-active-tab') || 'traceroute'; } catch(_) {}
  ntSwitchTab(savedTab);
  ntRenderWhoisHistory();
  ntRenderMACTable();
  // Render speed history if any
  const sh = document.getElementById('nt-speed-history');
  if (sh && !ntSpeedHistory.length) sh.innerHTML = '';
}
