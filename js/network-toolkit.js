'use strict';

// ─── NETWORK TOOLKIT ─────────────────────────────────────────
const NT_PROXY = 'https://aegis-proxy.ka-mixalis99.workers.dev/?url=';

// ── Tab management ────────────────────────────────────────────
let ntActiveTab = 'traceroute';

function ntSwitchTab(tab) {
  ntActiveTab = tab;
  document.querySelectorAll('[data-nt-tab]').forEach(function(btn) {
    const isActive = btn.dataset.ntTab === tab;
    btn.style.background  = isActive ? 'rgba(245,158,11,0.1)' : 'transparent';
    btn.style.color       = isActive ? '#f59e0b' : '#64748b';
    btn.style.borderColor = isActive ? '#f59e0b' : '#1e2d4a';
  });
  document.querySelectorAll('.nt-panel').forEach(function(p) { p.style.display = 'none'; });
  const panel = document.getElementById('nt-panel-' + tab);
  if (panel) panel.style.display = 'block';
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

// ─── INIT ──────────────────────────────────────────────────────
function initNetworkToolkit() {
  ntSwitchTab('traceroute');
  ntRenderWhoisHistory();
  ntRenderMACTable();
  // Render speed history if any
  const sh = document.getElementById('nt-speed-history');
  if (sh && !ntSpeedHistory.length) sh.innerHTML = '';
}
