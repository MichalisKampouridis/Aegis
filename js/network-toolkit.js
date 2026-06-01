'use strict';

// ─── NETWORK TOOLKIT ─────────────────────────────────────────
const NT_PROXY = 'https://aegis-proxy.ka-mixalis99.workers.dev/?url=';

// ── Tab management ────────────────────────────────────────────
let ntActiveTab = 'traceroute';

function ntSwitchTab(tab) {
  if (ntActiveTab === 'liveconn' && tab !== 'liveconn' && typeof lcStop === 'function') lcStop();
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
  if (tab === 'liveconn') setTimeout(lcEnsureMap, 50);
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
// TAB 5 — LIVE CONNECTIONS
// ═══════════════════════════════════════════════════════════════
const LC_PROXY = 'https://aegis-proxy.ka-mixalis99.workers.dev/?url=';

let lcMonitoring  = false;
let lcPollTimer   = null;
let lcMap         = null;
let lcUserLL      = null;
let lcUserMarker  = null;
let lcConnections = new Map(); // ip → { marker, line, glow, geo, color, gameName }
let lcGeoCache    = new Map(); // ip → geo data
let lcDnsCache    = new Map(); // ip → hostname string or null
let lcCssInjected = false;
let lcAutoTracedIPs      = new Set();  // game server IPs already auto-traced this session
let lcCurrentGameDetected = null;       // { name, ip, location } while a game trace is active
let lcNewConnections = new Map();       // ip → { addedAt: ms, dotTimer: timeoutId|null }
let lcFirstPoll     = true;            // silences banners on the initial seed poll
let lcBannerQueue   = [];              // queued { ip, hostname, geo } items
let lcBannerShowing = false;           // true while a banner is on screen

// ─── SERVICE COLOR DETECTION ──────────────────────────────────
function lcGetServiceColor(hostname, isp) {
  const c = ((hostname || '') + ' ' + (isp || '')).toLowerCase();
  if (/google|youtube|googleapis|gstatic|ggpht|googlevideo/.test(c)) return '#ef4444';
  if (/microsoft|windows\.net|azure|msft|live\.com|outlook|xbox/.test(c)) return '#3b82f6';
  if (/cloudflare/.test(c)) return '#f97316';
  if (/amazon|amazonaws|aws\./.test(c)) return '#a855f7';
  if (/steam|valve|epicgames|roblox|4vision/.test(c)) return '#22c55e';
  if (/facebook|instagram|twitter|tiktok|meta\./.test(c)) return '#ec4899';
  if (/apple|icloud/.test(c)) return '#e2e8f0';
  return '#f59e0b';
}

// ─── SERVICE NAME DETECTION ───────────────────────────────────
function lcGetServiceName(hostname, isp) {
  const c = ((hostname || '') + ' ' + (isp || '')).toLowerCase();
  if (/google|youtube|googleapis|gstatic|ggpht|googlevideo/.test(c)) return 'Google';
  if (/microsoft|windows\.net|azure|msft|live\.com|outlook|xbox/.test(c)) return 'Microsoft';
  if (/cloudflare/.test(c)) return 'Cloudflare';
  if (/amazon|amazonaws|aws\./.test(c)) return 'Amazon AWS';
  if (/facebook|instagram|meta\./.test(c)) return 'Meta';
  if (/twitter|twimg/.test(c)) return 'Twitter / X';
  if (/tiktok/.test(c)) return 'TikTok';
  if (/apple|icloud/.test(c)) return 'Apple';
  if (/github/.test(c)) return 'GitHub';
  return lcDetectGame(hostname, isp);
}

// ─── GAME SERVER DETECTION ────────────────────────────────────
function lcDetectGame(hostname, isp) {
  const h = (hostname || '').toLowerCase();
  const s = (isp || '').toLowerCase();
  if (/valve|steamserver|valve\.net/.test(h) || /valve/.test(s)) return 'Steam / Valve';
  if (/pubg/.test(h)) return 'PUBG';
  if (/riotgames/.test(h) || /riot/.test(s)) return 'Riot Games';
  if (/epicgames/.test(h) || /epic/.test(s)) return 'Epic Games';
  if (/activision|blizzard/.test(h)) return 'Activision / Blizzard';
  if (/\bea\.com\b|origin\.com/.test(h)) return 'EA / Origin';
  if (/ubisoft/.test(h)) return 'Ubisoft';
  if (/roblox/.test(h)) return 'Roblox';
  if (/mojang|minecraft/.test(h)) return 'Minecraft';
  if (/4vision/.test(h) || /4vision/.test(s)) return '4Vision';
  if (/\bgame\b|gameserver/.test(h)) return 'Game Server';
  return null;
}

function lcAutoTrace(ip, gameName, geo) {
  if (lcAutoTracedIPs.has(ip)) return;
  lcAutoTracedIPs.add(ip);
  const location = geo ? [geo.city, geo.country].filter(Boolean).join(', ') : ip;

  // Desktop notification
  try {
    const body = gameName + ' · ' + ip + ' · ' + location;
    if (window.Notification) {
      if (Notification.permission === 'granted') {
        new Notification('🎮 Game Server Detected', { body: body });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(function(p) {
          if (p === 'granted') new Notification('🎮 Game Server Detected', { body: body });
        });
      }
    }
  } catch (_) {}

  // Don't auto-trace if no Electron API or another trace is already active
  if (!window.aegis || lcTraceActive) return;

  lcClickTrace(ip);
  // Set AFTER lcClickTrace because lcClearTrace (called inside) would null it
  lcCurrentGameDetected = { name: gameName, ip: ip, location: location };
  // Re-render immediately so the game banner shows in loading state
  lcRenderTracePanel(lcTraceHops, ip, true, false);
}

// ─── CLICK-TO-TRACE STATE ─────────────────────────────────────
let lcTraceActive       = null;
let lcTraceHopDots      = [];
let lcTraceHops         = [];
let lcTraceSeenHops     = new Set();
let lcTraceListenersSet = false;
let lcTraceHopCallback  = null;
let lcTraceDoneCallback = null;

function lcSetupTraceListeners() {
  if (lcTraceListenersSet || !window.aegis || !window.aegis.onTracerouteHop) return;
  lcTraceListenersSet = true;
  window.aegis.onTracerouteHop(function(hop) {
    if (lcTraceHopCallback) lcTraceHopCallback(hop);
  });
  window.aegis.onTracerouteDone(function() {
    if (lcTraceDoneCallback) lcTraceDoneCallback();
  });
}

function lcInjectCSS() {
  if (lcCssInjected) return;
  lcCssInjected = true;
  const style = document.createElement('style');
  style.textContent =
    '.lc-line-dash{stroke-dasharray:12,6;animation:lcDashFlow 1.2s linear infinite;}' +
    '@keyframes lcDashFlow{from{stroke-dashoffset:0}to{stroke-dashoffset:-54}}' +
    '.lc-new-dot{animation:lcAmberPulse 1s ease-in-out infinite;}' +
    '@keyframes lcAmberPulse{0%,100%{box-shadow:0 0 6px #f59e0b,0 0 14px rgba(245,158,11,0.4)}50%{box-shadow:0 0 18px #f59e0b,0 0 36px rgba(245,158,11,0.7)}}' +
    '@keyframes lcBannerIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(style);
}

function lcFlag(cc) {
  if (!cc || cc.length !== 2) return '';
  const o = 0x1F1E6 - 65;
  return String.fromCodePoint(cc.charCodeAt(0) + o) + String.fromCodePoint(cc.charCodeAt(1) + o);
}

function lcIsPrivate(ip) {
  return !ip || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|0\.0\.0\.0|169\.254\.|::1$|fe80:)/i.test(ip);
}

function lcEnsureMap() {
  if (lcMap) { lcMap.invalidateSize(); return; }
  const container = document.getElementById('lc-map');
  if (!container || typeof L === 'undefined') return;
  lcInjectCSS();
  lcMap = L.map('lc-map', { center: [20, 0], zoom: 2, minZoom: 2 });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(lcMap);
}

async function lcResolveUserLocation() {
  if (window.aegis && window.aegis.getRadarReadings) {
    try {
      const readings = await window.aegis.getRadarReadings(1);
      const last = readings && readings[readings.length - 1];
      if (last && last.lat && last.lon) {
        const label = [last.cc ? lcFlag(last.cc) : '', last.city, last.country].filter(Boolean).join(' ') || last.ip || '';
        return { ll: [last.lat, last.lon], label };
      }
    } catch (_) {}
  }
  try {
    const ipRes = await fetch('https://api64.ipify.org?format=json', { signal: AbortSignal.timeout(5000) });
    const ipJson = await ipRes.json();
    if (ipJson && ipJson.ip) {
      const r = await fetch(LC_PROXY + 'https://ipwho.is/' + ipJson.ip, { signal: AbortSignal.timeout(6000) });
      const d = await r.json();
      if (d.latitude && d.longitude) {
        return { ll: [d.latitude, d.longitude], label: [d.city, d.country].filter(Boolean).join(', ') || ipJson.ip };
      }
    }
  } catch (_) {}
  return null;
}

function lcPlaceYouMarker(ll, label) {
  if (!lcMap) return;
  if (lcUserMarker) { lcMap.removeLayer(lcUserMarker); lcUserMarker = null; }
  const icon = L.divIcon({
    className: '',
    html: '<div style="width:18px;height:18px;border-radius:50%;background:#10b981;border:2px solid #34d399;box-shadow:0 0 10px #10b981,0 0 20px rgba(16,185,129,0.4);display:flex;align-items:center;justify-content:center;font-family:IBM Plex Mono,monospace;font-size:8px;font-weight:bold;color:#020818;">YOU</div>',
    iconSize: [18, 18], iconAnchor: [9, 9]
  });
  lcUserMarker = L.marker(ll, { icon }).addTo(lcMap)
    .bindPopup(
      '<div style="font-family:IBM Plex Mono,monospace;font-size:12px;color:#e2e8f0;background:#0d1526;padding:10px;border-radius:3px;">' +
      '<div style="color:#10b981;margin-bottom:4px;">YOUR LOCATION</div><div>' + (label || '') + '</div></div>',
      { className: 'pv-popup' }
    );
  lcUserLL = ll;
  lcMap.setView(ll, 3);
}

function lcEnqueueBanner(ip, hostname, geo) {
  lcBannerQueue.push({ ip: ip, hostname: hostname, geo: geo });
  if (!lcBannerShowing) lcProcessBannerQueue();
}

function lcProcessBannerQueue() {
  if (!lcBannerQueue.length) { lcBannerShowing = false; return; }
  lcBannerShowing = true;
  const item = lcBannerQueue.shift();
  const ip = item.ip;
  const hostname = item.hostname;
  const geo = item.geo;

  const mapContainer = document.getElementById('lc-map');
  if (!mapContainer || !mapContainer.parentNode) {
    setTimeout(lcProcessBannerQueue, 0);
    return;
  }
  const serviceName = lcGetServiceName(hostname, geo ? geo.isp : '');
  const location = geo ? [geo.city, geo.country].filter(Boolean).join(', ') || '—' : '—';
  const isp = geo ? (geo.isp || '—') : '—';
  const domain = hostname || ip;
  const serviceLabel = serviceName
    ? '<span style="color:#fbbf24;font-weight:bold;">' + serviceName + '</span>'
    : '<span style="color:#f59e0b;">UNKNOWN SERVICE</span>';
  const banner = document.createElement('div');
  banner.style.cssText = 'background:rgba(245,158,11,0.1);border:1px solid #f59e0b;border-radius:4px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;animation:lcBannerIn 0.3s ease;';
  banner.innerHTML =
    '<span style="font-size:16px;flex-shrink:0;">🆕</span>' +
    '<div style="flex:1;font-family:var(--font-mono);">' +
    '<span style="color:#f59e0b;font-size:11px;letter-spacing:2px;">NEW CONNECTION</span>&nbsp;&nbsp;' + serviceLabel +
    '<div style="color:var(--text-dim);font-size:11px;margin-top:2px;">' + domain + ' &nbsp;·&nbsp; ' + location + ' &nbsp;·&nbsp; ' + isp + '</div>' +
    '</div>' +
    '<button onclick="this.parentNode.remove();lcProcessBannerQueue();" style="background:transparent;border:none;color:#64748b;cursor:pointer;font-size:18px;line-height:1;padding:0;flex-shrink:0;">×</button>';
  mapContainer.parentNode.insertBefore(banner, mapContainer);
  setTimeout(function() {
    if (banner.parentNode) banner.remove();
    lcProcessBannerQueue();
  }, 3000);
}

async function lcBatchGeolocate(ips) {
  const toFetch = ips.filter(function(ip) { return !lcGeoCache.has(ip); });
  if (!toFetch.length) return;
  try {
    const r = await fetch(
      LC_PROXY + 'http://ip-api.com/batch?fields=status,query,country,countryCode,city,isp,lat,lon',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toFetch.map(function(ip) { return { query: ip }; })),
        signal: AbortSignal.timeout(10000)
      }
    );
    if (r.ok) {
      const results = await r.json();
      results.forEach(function(d) {
        if (d.status === 'success' && d.query) {
          lcGeoCache.set(d.query, {
            lat: d.lat || 0, lon: d.lon || 0,
            country: d.country || '', cc: d.countryCode || '',
            city: d.city || '', isp: d.isp || ''
          });
        }
      });
    }
  } catch (_) {}
}

async function lcBatchReverseDNS(ips) {
  const toFetch = ips.filter(function(ip) { return !lcDnsCache.has(ip); });
  if (!toFetch.length) return;
  await Promise.all(toFetch.map(async function(ip) {
    const reversed = ip.split('.').reverse().join('.');
    try {
      const r = await fetch(
        'https://dns.google/resolve?name=' + reversed + '.in-addr.arpa&type=PTR',
        { signal: AbortSignal.timeout(4000) }
      );
      if (r.ok) {
        const d = await r.json();
        const answer = d.Answer && d.Answer[0];
        lcDnsCache.set(ip, answer ? answer.data.replace(/\.$/, '') : null);
      } else {
        lcDnsCache.set(ip, null);
      }
    } catch (_) {
      lcDnsCache.set(ip, null);
    }
  }));
}

function lcAddConnectionToMap(ip, geo, isNew) {
  if (lcConnections.has(ip) || !lcMap) return;
  const hostname = lcDnsCache.get(ip) || null;
  const isp = geo ? (geo.isp || '') : '';
  const gameName = lcDetectGame(hostname, isp);
  const color = gameName ? '#22c55e' : lcGetServiceColor(hostname, isp);

  let marker = null;
  let line   = null;
  let glow   = null;

  // Only draw map elements when we have valid coordinates
  if (geo && (geo.lat || geo.lon)) {
    const to = [geo.lat, geo.lon];
    // Draw line from user only when our own location is known
    if (lcUserLL) {
      const from = lcUserLL;
      glow = L.polyline([from, to], { color: color, weight: 5, opacity: 0.12, className: 'lc-line-glow' }).addTo(lcMap);
      line = L.polyline([from, to], { color: color, weight: 2, opacity: 0.85, className: 'lc-line-dash' }).addTo(lcMap);
    }
    const normalDotHTML = '<div style="width:10px;height:10px;border-radius:50%;background:' + color + ';border:1px solid ' + color + ';box-shadow:0 0 8px ' + color + ',0 0 16px ' + color + '40;cursor:pointer;"></div>';
    const initialHTML = isNew
      ? '<div class="lc-new-dot" style="width:12px;height:12px;border-radius:50%;background:#f59e0b;border:2px solid #fbbf24;cursor:pointer;"></div>'
      : normalDotHTML;
    const dotIcon = L.divIcon({
      className: '',
      html: initialHTML,
      iconSize: isNew ? [12, 12] : [10, 10],
      iconAnchor: isNew ? [6, 6] : [5, 5]
    });
    marker = L.marker(to, { icon: dotIcon }).addTo(lcMap).bindPopup(
      '<div style="font-family:IBM Plex Mono,monospace;font-size:12px;color:#e2e8f0;min-width:200px;background:#0d1526;padding:10px;border-radius:3px;">' +
      '<div style="color:' + color + ';font-size:13px;font-weight:bold;margin-bottom:2px;">' + (hostname || ip) + '</div>' +
      (hostname ? '<div style="color:#64748b;margin-bottom:6px;">' + ip + '</div>' : '<div style="margin-bottom:6px;"></div>') +
      (geo.city ? '<div style="color:#64748b;margin-bottom:3px;">CITY: <span style="color:#e2e8f0;">' + geo.city + '</span></div>' : '') +
      '<div style="color:#64748b;margin-bottom:3px;">COUNTRY: <span style="color:#e2e8f0;">' + lcFlag(geo.cc) + ' ' + geo.country + '</span></div>' +
      (geo.isp ? '<div style="color:#64748b;margin-bottom:3px;">ISP: <span style="color:#e2e8f0;">' + geo.isp + '</span></div>' : '') +
      '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #1e2d4a;">' +
      '<button onclick="lcClickTrace(\'' + ip + '\')" style="background:transparent;border:1px solid ' + color + ';color:' + color + ';font-family:IBM Plex Mono,monospace;font-size:11px;padding:4px 10px;border-radius:2px;cursor:pointer;letter-spacing:1px;">&#9654; TRACE ROUTE</button>' +
      '</div></div>',
      { className: 'pv-popup' }
    );
    if (line) line.on('click', function() { lcClickTrace(ip); });

    if (isNew) {
      const dotTimer = setTimeout(function() {
        if (!lcConnections.has(ip)) return;
        marker.setIcon(L.divIcon({ className: '', html: normalDotHTML, iconSize: [10, 10], iconAnchor: [5, 5] }));
        const nc = lcNewConnections.get(ip);
        if (nc) nc.dotTimer = null;
      }, 10000);
      lcNewConnections.set(ip, { addedAt: Date.now(), dotTimer });
    }
  } else if (isNew) {
    // No geo coordinates — connection tracked in table/counter only, no map marker
    lcNewConnections.set(ip, { addedAt: Date.now(), dotTimer: null });
  }

  lcConnections.set(ip, { marker: marker, line: line, glow: glow, geo: geo || null, color: color, gameName: gameName || null });
}

function lcRemoveConnectionFromMap(ip) {
  const nc = lcNewConnections.get(ip);
  if (nc && nc.dotTimer) clearTimeout(nc.dotTimer);
  lcNewConnections.delete(ip);
  const conn = lcConnections.get(ip);
  if (!conn) return;
  if (lcMap) {
    if (conn.line   && lcMap.hasLayer(conn.line))   lcMap.removeLayer(conn.line);
    if (conn.glow   && lcMap.hasLayer(conn.glow))   lcMap.removeLayer(conn.glow);
    if (conn.marker && lcMap.hasLayer(conn.marker)) lcMap.removeLayer(conn.marker);
  }
  lcConnections.delete(ip);
}

function lcClickTrace(ip) {
  if (!window.aegis) return;
  lcSetupTraceListeners();
  lcClearTrace();
  lcTraceActive = ip;
  lcTraceHops = [];
  lcTraceSeenHops = new Set();
  lcRenderTracePanel([], ip, true, false);
  if (window.aegis.stopTraceroute) window.aegis.stopTraceroute();

  lcTraceHopCallback = async function(hop) {
    if (lcTraceActive !== ip) return;
    if (lcTraceSeenHops.has(hop.hopNum)) return;
    lcTraceSeenHops.add(hop.hopNum);
    let geo = null;
    if (hop.ip && !lcIsPrivate(hop.ip)) {
      await lcBatchGeolocate([hop.ip]);
      geo = lcGeoCache.get(hop.ip) || null;
    }
    const hopData = { hopNum: hop.hopNum, ip: hop.ip, latency: hop.latency, timeout: hop.timeout, geo };
    lcTraceHops.push(hopData);
    if (geo && lcMap && (geo.lat || geo.lon)) {
      const latCol = ntLatColor(hop.latency);
      const hopIcon = L.divIcon({
        className: '',
        html: '<div style="width:8px;height:8px;border-radius:50%;background:#60a5fa;border:1px solid #93c5fd;box-shadow:0 0 6px #60a5fa;cursor:pointer;"></div>',
        iconSize: [8, 8], iconAnchor: [4, 4]
      });
      const hopCity = [geo.city, geo.country].filter(Boolean).join(', ') || 'Unknown';
      const hopDot = L.marker([geo.lat, geo.lon], { icon: hopIcon }).addTo(lcMap).bindPopup(
        '<div style="font-family:IBM Plex Mono,monospace;font-size:12px;color:#e2e8f0;background:#0d1526;padding:10px;border-radius:3px;">' +
        '<div style="color:#60a5fa;font-size:13px;margin-bottom:4px;">HOP ' + hop.hopNum + '</div>' +
        '<div style="color:#e2e8f0;margin-bottom:2px;">' + (hop.ip || '—') + '</div>' +
        '<div style="color:#64748b;margin-bottom:4px;">' + hopCity + '</div>' +
        '<div style="color:' + latCol + ';">' + (hop.latency != null ? hop.latency + ' ms' : 'TIMEOUT') + '</div>' +
        '</div>',
        { className: 'pv-popup' }
      );
      lcTraceHopDots.push(hopDot);
    }
    lcRenderTracePanel(lcTraceHops, ip, false, false);
  };

  lcTraceDoneCallback = function() {
    lcTraceHopCallback = null;
    lcTraceDoneCallback = null;
    lcRenderTracePanel(lcTraceHops, ip, false, true);
  };

  window.aegis.startTraceroute(ip);
}

function lcClearTrace() {
  if (window.aegis && window.aegis.stopTraceroute) window.aegis.stopTraceroute();
  lcCurrentGameDetected = null;
  lcTraceActive = null;
  lcTraceHopCallback = null;
  lcTraceDoneCallback = null;
  lcTraceSeenHops = new Set();
  if (lcMap) {
    lcTraceHopDots.forEach(function(dot) {
      if (lcMap.hasLayer(dot)) lcMap.removeLayer(dot);
    });
  }
  lcTraceHopDots = [];
  lcTraceHops = [];
  const panel = document.getElementById('lc-trace-panel');
  if (panel) panel.style.display = 'none';
}

function lcRenderTracePanel(hops, ip, loading, done) {
  let panel = document.getElementById('lc-trace-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'lc-trace-panel';
    const mapEl = document.getElementById('lc-map');
    if (mapEl && mapEl.parentNode) mapEl.parentNode.insertBefore(panel, mapEl.nextSibling);
  }
  panel.style.display = 'block';
  let sorted = hops.slice().sort(function(a, b) { return a.hopNum - b.hopNum; });
  if (done) {
    let end = sorted.length;
    while (end > 0 && sorted[end - 1].timeout) end--;
    sorted = sorted.slice(0, end);
  }
  const statusText = loading ? 'TRACING...' : (done ? 'COMPLETE — ' + sorted.length + ' HOPS' : 'TRACING — ' + sorted.length + ' HOPS');
  const statusColor = done ? '#10b981' : '#f59e0b';

  const isGame = !!(lcCurrentGameDetected && lcCurrentGameDetected.ip === ip);
  const accentColor = isGame ? '#22c55e' : '#60a5fa';

  // Game banner shown at the top when this is an auto-detected game server trace
  let gameBannerHTML = '';
  if (isGame) {
    gameBannerHTML =
      '<div style="background:rgba(34,197,94,0.08);border:1px solid #22c55e;border-radius:4px;padding:12px 16px;margin-bottom:12px;display:flex;align-items:center;gap:12px;">' +
      '<span style="font-size:22px;">🎮</span>' +
      '<div>' +
      '<div style="font-family:var(--font-mono);font-size:11px;color:#22c55e;letter-spacing:2px;margin-bottom:2px;">GAME SERVER DETECTED — ' + lcCurrentGameDetected.name.toUpperCase() + '</div>' +
      '<div style="font-family:var(--font-mono);font-size:11px;color:#64748b;">' + ip + ' · ' + lcCurrentGameDetected.location + '</div>' +
      '</div></div>';
  }

  // Game latency footer shown when trace is complete
  let gameLatencyHTML = '';
  if (isGame && done) {
    let lastLatency = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (!sorted[i].timeout && sorted[i].latency != null) { lastLatency = sorted[i].latency; break; }
    }
    if (lastLatency != null) {
      const latCol = ntLatColor(lastLatency);
      gameLatencyHTML =
        '<div style="margin-top:12px;padding:14px 16px;background:rgba(34,197,94,0.06);border:1px solid #22c55e;border-radius:4px;text-align:center;">' +
        '<div style="font-family:var(--font-mono);font-size:11px;color:#22c55e;letter-spacing:3px;margin-bottom:6px;">🎮 GAME SERVER LATENCY</div>' +
        '<div style="font-family:var(--font-title);font-size:36px;color:' + latCol + ';">' + lastLatency + '<span style="font-size:16px;color:var(--text-dim);"> ms</span></div>' +
        '</div>';
    }
  }

  const rows = sorted.map(function(h) {
    const latCol = ntLatColor(h.latency);
    const loc = h.geo ? [h.geo.city, h.geo.country].filter(Boolean).join(', ') : '—';
    return '<tr style="border-bottom:1px solid rgba(30,45,74,0.4);">' +
      '<td style="font-family:var(--font-mono);font-size:12px;color:#64748b;padding:6px 10px;">HOP ' + h.hopNum + '</td>' +
      '<td style="font-family:var(--font-mono);font-size:12px;color:var(--text-primary);padding:6px 10px;">' + (h.ip || '* * *') + '</td>' +
      '<td style="font-family:var(--font-mono);font-size:12px;color:var(--text-dim);padding:6px 10px;">' + loc + '</td>' +
      '<td style="font-family:var(--font-mono);font-size:12px;color:' + latCol + ';padding:6px 10px;">' + (h.timeout ? 'TIMEOUT' : (h.latency != null ? h.latency + ' ms' : '—')) + '</td>' +
      '</tr>';
  }).join('');

  panel.innerHTML =
    '<div style="background:var(--bg-card);border:1px solid var(--border);border-top:2px solid ' + accentColor + ';border-radius:4px;padding:16px;margin-bottom:20px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
    '<div style="font-family:var(--font-mono);font-size:11px;color:' + accentColor + ';letter-spacing:2px;">&#9654; TRACEROUTE — ' + ip + '</div>' +
    '<div style="display:flex;gap:10px;align-items:center;">' +
    '<span style="font-family:var(--font-mono);font-size:11px;color:' + statusColor + ';">' + statusText + '</span>' +
    '<button onclick="lcClearTrace()" style="background:transparent;border:1px solid #64748b;color:#64748b;font-family:var(--font-mono);font-size:10px;padding:3px 10px;border-radius:2px;cursor:pointer;letter-spacing:1px;">&#10005; CLOSE</button>' +
    '</div></div>' +
    gameBannerHTML +
    (sorted.length ?
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
      '<thead><tr style="border-bottom:1px solid var(--border);">' +
      '<th style="font-family:var(--font-mono);font-size:10px;color:' + accentColor + ';letter-spacing:1px;padding:6px 10px;text-align:left;">HOP</th>' +
      '<th style="font-family:var(--font-mono);font-size:10px;color:' + accentColor + ';letter-spacing:1px;padding:6px 10px;text-align:left;">IP ADDRESS</th>' +
      '<th style="font-family:var(--font-mono);font-size:10px;color:' + accentColor + ';letter-spacing:1px;padding:6px 10px;text-align:left;">LOCATION</th>' +
      '<th style="font-family:var(--font-mono);font-size:10px;color:' + accentColor + ';letter-spacing:1px;padding:6px 10px;text-align:left;">LATENCY</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<p style="font-family:var(--font-mono);font-size:12px;color:var(--text-dim);margin:0;">Waiting for hops...</p>') +
    gameLatencyHTML +
    '</div>';
}

function lcRenderTable() {
  const el = document.getElementById('lc-table');
  if (!el) return;
  if (!lcConnections.size) {
    el.innerHTML = '<p class="placeholder-text">No active connections detected.</p>';
    return;
  }
  const rows = Array.from(lcConnections.entries()).map(function(entry) {
    const ip       = entry[0];
    const conn     = entry[1];
    const geo      = conn.geo || {};
    const color    = conn.color || '#f59e0b';
    const hostname = lcDnsCache.get(ip) || null;
    const flag     = geo.cc ? lcFlag(geo.cc) : '';
    const location = [flag, geo.city, geo.country].filter(Boolean).join(' ') || '—';
    const isGame   = !!conn.gameName;
    const nc = lcNewConnections.get(ip);
    const ageMs = nc ? (Date.now() - nc.addedAt) : Infinity;
    const isNewRecent = ageMs < 10000;
    const isNewBadge  = ageMs < 30000;
    const serviceName = lcGetServiceName(hostname, geo.isp || '');
    const rowBg    = isNewRecent ? 'rgba(245,158,11,0.08)' : (isGame ? 'rgba(34,197,94,0.05)' : 'transparent');
    const rowHover = isNewRecent ? 'rgba(245,158,11,0.14)' : (isGame ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.04)');
    const newBadge = isNewBadge
      ? '<span style="font-family:var(--font-mono);font-size:9px;background:rgba(245,158,11,0.2);border:1px solid #f59e0b;color:#f59e0b;padding:1px 5px;border-radius:2px;margin-left:4px;letter-spacing:1px;vertical-align:middle;">NEW</span>'
      : '';
    let serviceTag;
    if (isGame) {
      serviceTag = '<span style="font-family:var(--font-mono);font-size:9px;background:rgba(34,197,94,0.15);border:1px solid #22c55e;color:#22c55e;padding:1px 5px;border-radius:2px;margin-left:6px;letter-spacing:1px;vertical-align:middle;">🎮 ' + conn.gameName + '</span>';
    } else if (serviceName) {
      serviceTag = '<span style="font-family:var(--font-mono);font-size:9px;background:rgba(255,255,255,0.04);border:1px solid var(--border);color:var(--text-dim);padding:1px 5px;border-radius:2px;margin-left:6px;letter-spacing:1px;vertical-align:middle;">' + serviceName + '</span>';
    } else if (isNewBadge) {
      serviceTag = '<span style="font-family:var(--font-mono);font-size:9px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;padding:1px 5px;border-radius:2px;margin-left:6px;letter-spacing:1px;vertical-align:middle;">UNKNOWN SERVICE</span>';
    } else {
      serviceTag = '';
    }
    return '<tr onclick="lcClickTrace(\'' + ip + '\')" style="cursor:pointer;background:' + rowBg + ';" onmouseover="this.style.background=\'' + rowHover + '\'" onmouseout="this.style.background=\'' + rowBg + '\'">' +
      '<td style="font-family:var(--font-mono);font-size:12px;color:' + color + ';padding:8px 10px;">' +
      '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color + ';margin-right:6px;vertical-align:middle;box-shadow:0 0 4px ' + color + ';"></span>' + ip + newBadge + '</td>' +
      '<td style="font-family:var(--font-mono);font-size:12px;color:var(--text-primary);padding:8px 10px;">' + (hostname || ip) + serviceTag + '</td>' +
      '<td style="font-family:var(--font-mono);font-size:12px;color:var(--text-primary);padding:8px 10px;">' + location + '</td>' +
      '<td style="font-family:var(--font-mono);font-size:12px;color:var(--text-dim);padding:8px 10px;">' + (geo.isp || '—') + '</td>' +
      '</tr>';
  }).join('');
  el.innerHTML =
    '<div style="background:var(--bg-card);border:1px solid var(--border);border-top:2px solid var(--amber);border-radius:4px;padding:16px;">' +
    '<div style="font-family:var(--font-mono);font-size:11px;color:var(--amber);letter-spacing:2px;margin-bottom:12px;">ACTIVE CONNECTION LOG — CLICK ROW TO TRACE</div>' +
    '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
    '<thead><tr style="border-bottom:1px solid var(--border);">' +
    '<th style="font-family:var(--font-mono);font-size:10px;color:var(--amber);letter-spacing:2px;padding:8px 10px;text-align:left;font-weight:500;">IP ADDRESS</th>' +
    '<th style="font-family:var(--font-mono);font-size:10px;color:var(--amber);letter-spacing:2px;padding:8px 10px;text-align:left;font-weight:500;">DOMAIN</th>' +
    '<th style="font-family:var(--font-mono);font-size:10px;color:var(--amber);letter-spacing:2px;padding:8px 10px;text-align:left;font-weight:500;">LOCATION</th>' +
    '<th style="font-family:var(--font-mono);font-size:10px;color:var(--amber);letter-spacing:2px;padding:8px 10px;text-align:left;font-weight:500;">ISP</th>' +
    '</tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table></div></div>';
}

async function lcPoll() {
  if (!lcMonitoring) return;
  let currentIPs = [];
  try {
    if (window.aegis && window.aegis.getActiveConnections) {
      currentIPs = await window.aegis.getActiveConnections();
    }
  } catch (_) {}

  const currentSet = new Set(currentIPs);

  // Remove gone connections
  Array.from(lcConnections.keys()).forEach(function(ip) {
    if (!currentSet.has(ip)) lcRemoveConnectionFromMap(ip);
  });

  // Geolocate and reverse-DNS new connections in parallel
  const newIPs = currentIPs.filter(function(ip) { return !lcConnections.has(ip) && !lcIsPrivate(ip); });
  if (newIPs.length) {
    await Promise.all([lcBatchGeolocate(newIPs), lcBatchReverseDNS(newIPs)]);
    // Always register the connection — map elements are skipped gracefully if geo/location unavailable
    // isNew is false on the very first poll (pre-existing connections get no badge/amber dot)
    newIPs.forEach(function(ip) {
      const geo = lcGeoCache.get(ip) || null;
      lcAddConnectionToMap(ip, geo, !lcFirstPoll);
    });
    newIPs.forEach(function(ip) {
      const hostname = lcDnsCache.get(ip) || null;
      const geo = lcGeoCache.get(ip) || null;
      // Skip banners on the very first poll — those are pre-existing connections, not new arrivals
      if (!lcFirstPoll) lcEnqueueBanner(ip, hostname, geo);
      if (lcAutoTracedIPs.has(ip)) return;
      const isp = geo ? (geo.isp || '') : '';
      const gameName = lcDetectGame(hostname, isp);
      if (gameName) lcAutoTrace(ip, gameName, geo);
    });
  }
  lcFirstPoll = false;

  const counter = document.getElementById('lc-counter');
  if (counter) counter.textContent = String(lcConnections.size);
  const status = document.getElementById('lc-status');
  if (status) status.textContent = '● LIVE — ' + lcConnections.size + ' ACTIVE CONNECTIONS';
  lcRenderTable();
}

async function lcToggle() {
  if (lcMonitoring) { lcStop(); } else { await lcStart(); }
}

async function lcStart() {
  lcEnsureMap();
  lcSetupTraceListeners();
  lcMonitoring = true;
  const btn = document.getElementById('lc-toggle-btn');
  if (btn) { btn.textContent = '■ STOP MONITORING'; btn.style.borderColor = '#ef4444'; btn.style.color = '#ef4444'; }
  const status = document.getElementById('lc-status');
  if (status) status.textContent = '● SCANNING CONNECTIONS...';
  if (!lcUserLL) {
    const userLoc = await lcResolveUserLocation();
    if (userLoc) lcPlaceYouMarker(userLoc.ll, userLoc.label);
  }
  await lcPoll();
  if (lcMonitoring) lcPollTimer = setInterval(lcPoll, 5000);
}

function lcStop() {
  lcClearTrace();
  lcMonitoring = false;
  if (lcPollTimer) { clearInterval(lcPollTimer); lcPollTimer = null; }
  lcNewConnections.forEach(function(nc) { if (nc.dotTimer) clearTimeout(nc.dotTimer); });
  lcNewConnections.clear();
  lcFirstPoll = true;
  lcBannerQueue = [];
  lcBannerShowing = false;
  const btn = document.getElementById('lc-toggle-btn');
  if (btn) { btn.textContent = '▶ START MONITORING'; btn.style.borderColor = '#f59e0b'; btn.style.color = '#f59e0b'; }
  const status = document.getElementById('lc-status');
  if (status) status.textContent = '';
}

// ─── INIT ──────────────────────────────────────────────────────
function initNetworkToolkit() {
  let savedTab = 'traceroute';
  try {
    const stored = localStorage.getItem('nt-active-tab');
    savedTab = (stored && stored !== 'pathviz') ? stored : 'traceroute';
  } catch(_) {}
  ntSwitchTab(savedTab);
  ntRenderWhoisHistory();
  ntRenderMACTable();
  // Render speed history if any
  const sh = document.getElementById('nt-speed-history');
  if (sh && !ntSpeedHistory.length) sh.innerHTML = '';
}
