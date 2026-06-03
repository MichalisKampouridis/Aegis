let allCVEs = [];
let currentPageId = 'dashboard';

// ─── MULTI-WINDOW RENDERER ────────────────────────────────────
const SOC_PRESET_DESCS = {
  single: 'SINGLE MONITOR — Main window maximized on primary display.',
  dual:   'DUAL MONITOR — Dashboard on primary · Network Intelligence on secondary.',
  triple: 'TRIPLE MONITOR — Dashboard · Network Intelligence · Network Monitor.'
};

function setSocPreset(preset) {
  if (window.aegis && window.aegis.setSocPreset) window.aegis.setSocPreset(preset);
  if (typeof saveSetting === 'function') saveSetting('socPreset', preset);
  updateSocPresetButtons(preset);
}

function updateSocPresetButtons(preset) {
  ['single', 'dual', 'triple'].forEach(function(p) {
    const btn = document.getElementById('soc-preset-' + p);
    if (!btn) return;
    if (p === preset) {
      btn.style.background = '#f59e0b';
      btn.style.color      = '#020818';
      btn.style.borderColor = '#f59e0b';
    } else {
      btn.style.background  = 'transparent';
      btn.style.color       = '#f59e0b';
      btn.style.borderColor = '#f59e0b';
    }
  });
  const desc = document.getElementById('soc-preset-desc');
  if (desc) desc.textContent = SOC_PRESET_DESCS[preset] || '';
}

function detachCurrentPage() {
  if (!window.aegis || !window.aegis.openDetachedWindow) return;
  window.aegis.openDetachedWindow(currentPageId);
}

async function initMiniRadarWidget() {
  document.body.innerHTML =
    '<div style="background:#020818; width:320px; height:380px; display:flex; flex-direction:column; overflow:hidden; user-select:none; -webkit-user-select:none;">' +
      '<div style="-webkit-app-region:drag; background:#060d1f; border-bottom:1px solid #1e2d4a; height:32px; display:flex; align-items:center; justify-content:space-between; padding:0 12px; flex-shrink:0;">' +
        '<span style="font-family:Orbitron,sans-serif; font-size:10px; color:#f59e0b; letter-spacing:3px; font-weight:700;">◎ AEGIS RADAR</span>' +
        '<button onclick="if(window.aegis)window.aegis.close()" style="-webkit-app-region:no-drag; background:transparent; border:1px solid rgba(239,68,68,0.6); color:#ef4444; width:22px; height:22px; border-radius:2px; cursor:pointer; font-size:13px; line-height:1; padding:0;">&#10005;</button>' +
      '</div>' +
      '<div style="display:flex; align-items:center; justify-content:center; flex:1; background:#020818;">' +
        '<canvas id="radar-canvas" width="220" height="220" style="display:block;"></canvas>' +
      '</div>' +
      '<div style="background:#060d1f; border-top:1px solid #1e2d4a; padding:8px 16px; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">' +
        '<span style="font-family:\'IBM Plex Mono\',monospace; font-size:11px; color:#64748b; letter-spacing:1px;">LATENCY <span id="mr-latency" style="color:#f59e0b;">—</span></span>' +
        '<span style="font-family:\'IBM Plex Mono\',monospace; font-size:11px; color:#64748b; letter-spacing:1px;">THREAT <span id="mr-threat" style="color:#10b981;">LOW</span></span>' +
      '</div>' +
    '</div>';

  // Load history from store; set flag so initRadar() won't start sampling
  if (window.aegis && window.aegis.getRadarReadings) {
    try {
      const stored = await window.aegis.getRadarReadings(60);
      if (stored && stored.length > 0) radarHistory = stored;
    } catch (_) {}
  }
  radarSamplingStarted = true; // read-only window — no new samples
  await initRadar();
  updateMiniRadarStats();

  setInterval(async function() {
    if (window.aegis && window.aegis.getRadarReadings) {
      try {
        const fresh = await window.aegis.getRadarReadings(60);
        if (fresh && fresh.length > 0) radarHistory = fresh;
      } catch (_) {}
    }
    updateMiniRadarStats();
  }, 30000);
}

function updateMiniRadarStats() {
  const latEl    = document.getElementById('mr-latency');
  const threatEl = document.getElementById('mr-threat');
  if (!latEl || !threatEl || !radarHistory.length) return;
  const recent = radarHistory.slice(-10);
  const lats   = recent.filter(function(r) { return r.latency != null; }).map(function(r) { return r.latency; });
  const avg    = lats.length ? Math.round(lats.reduce(function(a, b) { return a + b; }, 0) / lats.length) : null;
  latEl.textContent  = avg != null ? avg + ' ms' : '—';
  latEl.style.color  = avg == null ? '#64748b' : avg < 100 ? '#10b981' : avg < 300 ? '#f59e0b' : '#ef4444';
  const latest = radarHistory[radarHistory.length - 1];
  if (latest) {
    const hi = latest.latency > 300 || latest.ipChanged || latest.vpnDropped;
    const md = latest.latency > 150;
    threatEl.textContent = hi ? 'HIGH' : md ? 'ELEVATED' : 'LOW';
    threatEl.style.color = hi ? '#ef4444' : md ? '#f59e0b' : '#10b981';
  }
}

// ─── SPLASH EFFECTS ───────────────────────────────────────────
function initSplashEffects() {
  var running       = true;
  var forcedIntensity = null;

  // ── Falling data streams ─────────────────────────────────────
  var sc = document.getElementById('splash-streams');
  if (!sc) return { stop: function() {}, finalPulse: function(cb) { if (cb) cb(); } };
  var sctx = sc.getContext('2d');
  sc.width  = window.innerWidth;
  sc.height = window.innerHeight;

  var streams = [];
  for (var i = 0; i < 35; i++) {
    var len = 30 + Math.random() * 60;
    streams.push({
      x:     Math.random() * sc.width,
      y:     Math.random() * sc.height,
      speed: 0.3 + Math.random() * 0.7,
      len:   len,
      alpha: 0.06 + Math.random() * 0.12
    });
  }

  // ── Shield perimeter glow ────────────────────────────────────
  // Outer polygon: SVG viewBox 60×70, rendered 120×140 (scale 2×), plus
  // 20 px padding on every side → canvas 160×180, points shifted +20.
  var gc   = document.getElementById('splash-glow-canvas');
  var gctx = gc ? gc.getContext('2d') : null;
  var P    = [[80,24],[136,50],[136,100],[80,156],[24,100],[24,50]];

  function tracePath(ctx) {
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (var k = 1; k < P.length; k++) ctx.lineTo(P[k][0], P[k][1]);
    ctx.closePath();
  }

  function drawGlow(intensity) {
    if (!gctx) return;
    gctx.clearRect(0, 0, 160, 180);

    // Layer 1 — outer soft halo
    gctx.save();
    gctx.shadowBlur  = 14 + intensity * 6;
    gctx.shadowColor = 'rgba(245,158,11,' + (intensity * 0.45) + ')';
    gctx.strokeStyle = 'rgba(245,158,11,' + (intensity * 0.20) + ')';
    gctx.lineWidth   = 6;
    tracePath(gctx); gctx.stroke();
    gctx.restore();

    // Layer 2 — mid glow
    gctx.save();
    gctx.shadowBlur  = 8 + intensity * 5;
    gctx.shadowColor = 'rgba(245,158,11,' + (0.30 + intensity * 0.50) + ')';
    gctx.strokeStyle = 'rgba(245,158,11,' + (0.30 + intensity * 0.45) + ')';
    gctx.lineWidth   = 3;
    tracePath(gctx); gctx.stroke();
    gctx.restore();

    // Layer 3 — inner sharp edge
    gctx.save();
    gctx.shadowBlur  = 3 + intensity * 3;
    gctx.shadowColor = 'rgba(245,158,11,' + (0.60 + intensity * 0.40) + ')';
    gctx.strokeStyle = 'rgba(245,158,11,' + (0.70 + intensity * 0.30) + ')';
    gctx.lineWidth   = 1.5;
    tracePath(gctx); gctx.stroke();
    gctx.restore();
  }

  // ── Animation loop ───────────────────────────────────────────
  function tick(t) {
    if (!running) return;

    // Data streams
    sctx.clearRect(0, 0, sc.width, sc.height);
    for (var s = 0; s < streams.length; s++) {
      var st   = streams[s];
      var grad = sctx.createLinearGradient(st.x, st.y - st.len, st.x, st.y);
      grad.addColorStop(0, 'rgba(245,158,11,0)');
      grad.addColorStop(1, 'rgba(245,158,11,' + st.alpha + ')');
      sctx.strokeStyle = grad;
      sctx.lineWidth   = 1;
      sctx.beginPath();
      sctx.moveTo(st.x, st.y - st.len);
      sctx.lineTo(st.x, st.y);
      sctx.stroke();
      st.y += st.speed;
      if (st.y - st.len > sc.height) {
        st.y = -st.len;
        st.x = Math.random() * sc.width;
      }
    }

    // Shield glow — sine-wave breathing (period 2 s) or forced intensity
    var intensity;
    if (forcedIntensity !== null) {
      intensity = forcedIntensity;
    } else {
      var phase = (t % 2000) / 2000 * Math.PI * 2;
      intensity = 0.5 + 0.5 * Math.sin(phase);
    }
    drawGlow(intensity);

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  return {
    stop: function() { running = false; },
    finalPulse: function(callback) {
      // Hold full brightness for 400 ms (the "final burst"), then invoke callback
      forcedIntensity = 1.0;
      setTimeout(function() {
        forcedIntensity = null;
        if (callback) callback();
      }, 400);
    }
  };
}

// ─── SPLASH SCREEN ────────────────────────────────────────────
function runSplash() {
  // Detect URL parameter — used by detached and mini-radar windows only.
  // Main window loads via loadFile() with no query string, so startPage is
  // null here and the splash always runs for the main window.
  const startPage = new URLSearchParams(window.location.search).get('page');

  // Mini-radar detached window
  if (startPage === 'mini-radar') {
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    initMiniRadarWidget();
    return;
  }

  // Any other detached page window — skip splash and navigate directly.
  // Guard: only when the parameter is explicitly set to a non-empty value.
  if (startPage !== null && startPage !== '') {
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    loadDashboard();
    setTimeout(function() {
      navigateTo(startPage);
      if (startPage === 'network-intelligence') setTimeout(initNetworkIntelligence, 150);
    }, 150);
    return;
  }

  // No page parameter (or empty) → main window startup: always show full splash.

  const messages = [
    'LOADING SECURITY MODULES...',
    'CONNECTING TO THREAT FEEDS...',
    'INITIALIZING CVE DATABASE...',
    'LOADING INTELLIGENCE ENGINE...',
    'AEGIS SYSTEMS ONLINE'
  ];
  const bar = document.getElementById('splash-bar');
  const status = document.getElementById('splash-status');
  const splash = document.getElementById('splash-screen');
  if (!splash) return;
  var fx = initSplashEffects();
  let step = 0;
  const interval = setInterval(function() {
    if (step < messages.length) {
      status.textContent = messages[step];
      bar.style.width = ((step + 1) / messages.length * 100) + '%';
      step++;
    } else {
      clearInterval(interval);
      fx.finalPulse(function() {
        splash.style.transition = 'opacity 1s ease';
        splash.style.opacity = '0';
        setTimeout(function() {
          fx.stop();
          splash.style.display = 'none';
          loadDashboard();
        }, 1000);
      });
    }
  }, 500);
}

// Script is at the bottom of <body> so the DOM is ready immediately.
// Don't wait for window.load (which waits for external fonts/images
// and can hang indefinitely), call runSplash right away.
runSplash();

// ============================================================
// AEGIS � PERSONAL SECURITY INTELLIGENCE DASHBOARD
// main.js � Complete Feature Set
// ============================================================

// PAGE NAVIGATION
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('page-title');

const pageTitles = {
  dashboard: 'Security Dashboard',
  'network-intelligence': 'Network Intelligence',
  password: 'Password Health',
  ip: 'IP Investigator',
  cve: 'CVE Threat Feed',
  briefing: 'AI Briefing',
  news: 'Security News',
  network: 'Network Monitor',
  'security-toolkit': 'Security Toolkit',
  'network-toolkit': 'Network Toolkit',
  settings: 'Settings'
};

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof playNavClick === 'function' && isSoundEnabled('ui')) playNavClick();
    const target = item.dataset.page;
    currentPageId = target;
    navItems.forEach(n => n.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + target).classList.add('active');
    pageTitle.textContent = pageTitles[target];
  if (target === 'dashboard') setTimeout(loadDashboard, 100);
  });
});

// LIVE CLOCK
let showUTC = false;
function updateClock() {
  const now = new Date();
  const timeEl = document.getElementById('live-time');
  if (!timeEl) return;
  if (showUTC) {
    timeEl.textContent = now.toUTCString().replace('GMT', 'UTC');
  } else {
    const ath = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Athens' }));
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const hh = String(ath.getHours()).padStart(2,'0');
    const mm = String(ath.getMinutes()).padStart(2,'0');
    const ss = String(ath.getSeconds()).padStart(2,'0');
    timeEl.textContent = days[ath.getDay()] + ', ' + ath.getDate() + ' ' + months[ath.getMonth()] + ' ' + ath.getFullYear() + ' ' + hh + ':' + mm + ':' + ss + ' EET';
  }
}
updateClock();
setInterval(updateClock, 1000);

// ============================================================
// TOGGLE PASSWORD VISIBILITY
// ============================================================
function togglePassword() {
  const input = document.getElementById('password-input');
  const btn = document.getElementById('toggle-pw');
  if (input.type === 'password') {
    input.type = 'text';
    btn.style.color = '#f59e0b';
  } else {
    input.type = 'password';
    btn.style.color = '#64748b';
  }
}

// ============================================================
// PASSWORD HEALTH CHECK � ULTIMATE EDITION
// ============================================================
function calculateEntropy(password) {
  let charset = 0;
  if (/[a-z]/.test(password)) charset += 26;
  if (/[A-Z]/.test(password)) charset += 26;
  if (/[0-9]/.test(password)) charset += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charset += 32;
  return Math.round(password.length * Math.log2(charset || 1));
}

function estimateCrackTime(entropy) {
  const seconds = Math.pow(2, entropy) / 1e12 / 2;
  if (seconds < 1) return 'Instantly';
  if (seconds < 60) return Math.round(seconds) + ' seconds';
  if (seconds < 3600) return Math.round(seconds / 60) + ' minutes';
  if (seconds < 86400) return Math.round(seconds / 3600) + ' hours';
  if (seconds < 31536000) return Math.round(seconds / 86400) + ' days';
  if (seconds < 3153600000) return Math.round(seconds / 31536000) + ' years';
  if (seconds < 3.154e13) return Math.round(seconds / 3153600000) + ' thousand years';
  if (seconds < 3.154e16) return Math.round(seconds / 3.154e13) + ' million years';
  return 'Billions of years';
}

function getStrengthLabel(score) {
  if (score <= 1) return { label: 'CRITICALLY WEAK', color: '#ef4444', grade: 'F' };
  if (score <= 2) return { label: 'WEAK', color: '#f97316', grade: 'D' };
  if (score <= 3) return { label: 'MODERATE', color: '#f59e0b', grade: 'C' };
  if (score <= 4) return { label: 'STRONG', color: '#84cc16', grade: 'B' };
  if (score <= 5) return { label: 'VERY STRONG', color: '#10b981', grade: 'A' };
  return { label: 'MAXIMUM STRENGTH', color: '#10b981', grade: 'A+' };
}

function analyzePassword(password) {
  let score = 0;
  let suggestions = [];
  let checks = {
    length8: password.length >= 8,
    length12: password.length >= 12,
    length16: password.length >= 16,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^a-zA-Z0-9]/.test(password),
    noRepeat: !/(.)\1{2,}/.test(password),
    noSequential: !/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password),
    noKeyboardWalk: !/(?:qwer|wert|erty|rtyu|tyui|yuio|uiop|asdf|sdfg|dfgh|fghj|ghjk|hjkl|zxcv|xcvb|cvbn|vbnm)/i.test(password),
    noCommon: !['password','123456','qwerty','abc123','letmein','monkey','dragon','master','sunshine','princess','welcome','shadow','superman','michael','football'].includes(password.toLowerCase())
  };

  if (checks.length8) score++;
  if (checks.length12) score++;
  if (checks.hasLower && checks.hasUpper) score++;
  if (checks.hasNumber) score++;
  if (checks.hasSymbol) score++;
  if (checks.length16) score++;
  if (!checks.noRepeat) score = Math.max(0, score - 1);
  if (!checks.noSequential) score = Math.max(0, score - 1);
  if (!checks.noKeyboardWalk) score = Math.max(0, score - 1);
  if (!checks.noCommon) score = 0;

  if (!checks.length8) suggestions.push('Use at least 8 characters');
  if (!checks.length12) suggestions.push('Use at least 12 characters for better security');
  if (!checks.hasLower) suggestions.push('Add lowercase letters');
  if (!checks.hasUpper) suggestions.push('Add uppercase letters');
  if (!checks.hasNumber) suggestions.push('Add numbers');
  if (!checks.hasSymbol) suggestions.push('Add special characters (!@#$%^&*)');
  if (!checks.noRepeat) suggestions.push('Avoid repeating characters (e.g. aaa)');
  if (!checks.noSequential) suggestions.push('Avoid sequential patterns (e.g. abc, 123)');
  if (!checks.noKeyboardWalk) suggestions.push('Avoid keyboard patterns (e.g. qwerty, asdf)');
  if (!checks.noCommon) suggestions.push('This is a commonly used password — change it immediately');

  return { score, checks, suggestions };
}

function generatePassword() {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = lower + upper + numbers + symbols;
  let password = '';
  password += lower[Math.floor(Math.random() * lower.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += upper[Math.floor(Math.random() * upper.length)];
  password += upper[Math.floor(Math.random() * upper.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  for (let i = 0; i < 8; i++) password += all[Math.floor(Math.random() * all.length)];
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

let breachCheckTimeout = null;
let lastBreachChecked = '';

async function runBreachCheck(password) {
  const breachDiv = document.getElementById('breach-check-result');
  if (!breachDiv || password === lastBreachChecked) return;
  lastBreachChecked = password;
  breachDiv.innerHTML = '<p class="loading" style="font-size:13px;">Checking breach database...</p>';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);
    const response = await fetch('https://api.pwnedpasswords.com/range/' + prefix);
    const text = await response.text();
    let count = 0;
    for (const line of text.split('\n')) {
      const [hashSuffix, hashCount] = line.split(':');
      if (hashSuffix.trim() === suffix) { count = parseInt(hashCount.trim()); break; }
    }
    const breachDiv2 = document.getElementById('breach-check-result');
    if (!breachDiv2) return;
    if (count === 0) {
      breachDiv2.innerHTML = '<div class="safe-banner">? NOT FOUND IN ANY KNOWN DATA BREACH<br><span style="font-size:12px; opacity:0.7;">Checked via HaveIBeenPwned k-anonymity API. Your password was never transmitted.</span></div>';
    } else {
      breachDiv2.innerHTML = '<div class="danger-banner">? FOUND IN ' + count.toLocaleString() + ' KNOWN DATA BREACHES<br><span style="font-size:12px; opacity:0.7;">Change this password immediately on any account using it.</span></div>';
    }
  } catch (e) {
    const breachDiv3 = document.getElementById('breach-check-result');
    if (breachDiv3) breachDiv3.innerHTML = '<p class="placeholder-text" style="font-size:13px;">Breach check unavailable.</p>';
  }
}

function renderPasswordAnalysis(password) {
  const resultDiv = document.getElementById('password-result');
  if (!password) {
    resultDiv.innerHTML = '<p class="placeholder-text">Enter a password above to analyze it.</p>';
    return;
  }
  const entropy = calculateEntropy(password);
  const crackTime = estimateCrackTime(entropy);
  const { score, checks, suggestions } = analyzePassword(password);
  const { label: strengthLabel, color: strengthColor, grade } = getStrengthLabel(score);
  const strengthPercent = Math.round((score / 6) * 100);
  const lower = (password.match(/[a-z]/g) || []).length;
  const upper = (password.match(/[A-Z]/g) || []).length;
  const numbers = (password.match(/[0-9]/g) || []).length;
  const symbols = (password.match(/[^a-zA-Z0-9]/g) || []).length;

  resultDiv.innerHTML =
    '<div class="breach-card" style="border-left-color:' + strengthColor + '">' +
    '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
    '<div class="breach-name" style="color:' + strengthColor + '; font-size:16px;">STRENGTH: ' + strengthLabel + '</div>' +
    '<div style="width:52px; height:52px; border-radius:50%; border:2px solid ' + strengthColor + '; display:flex; align-items:center; justify-content:center; font-family:var(--font-title); font-size:18px; font-weight:900; color:' + strengthColor + '; box-shadow:0 0 14px ' + strengthColor + '40;">' + grade + '</div>' +
    '</div>' +
    '<div style="margin:12px 0;">' +
    '<div style="background:#0a0f1e; border-radius:2px; height:8px; width:100%;">' +
    '<div style="background:' + strengthColor + '; height:8px; width:' + strengthPercent + '%; border-radius:2px; box-shadow:0 0 8px ' + strengthColor + '; transition:width 0.3s;"></div>' +
    '</div>' +
    '<div style="display:flex; justify-content:space-between; margin-top:6px;">' +
    '<span style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim);">WEAK</span>' +
    '<span style="font-family:var(--font-mono); font-size:12px; color:' + strengthColor + ';">' + score + '/6</span>' +
    '<span style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim);">STRONG</span>' +
    '</div></div>' +
    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px;">' +
    '<div style="background:var(--bg-secondary); padding:14px; border-radius:3px; border:1px solid var(--border);">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:6px;">ENTROPY</div>' +
    '<div style="font-family:var(--font-title); font-size:22px; color:' + strengthColor + ';">' + entropy + ' <span style="font-size:13px;">bits</span></div>' +
    '</div>' +
    '<div style="background:var(--bg-secondary); padding:14px; border-radius:3px; border:1px solid var(--border);">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:6px;">CRACK TIME</div>' +
    '<div style="font-family:var(--font-title); font-size:16px; color:' + strengthColor + '; word-break:break-word;">' + crackTime + '</div>' +
    '</div></div>' +
    '<div style="margin-bottom:18px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:10px;">CHARACTER BREAKDOWN</div>' +
    '<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; text-align:center;">' +
    '<div style="background:var(--bg-secondary); padding:12px; border-radius:3px; border:1px solid var(--border);"><div style="font-family:var(--font-title); font-size:20px; color:#60a5fa;">' + lower + '</div><div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">LOWER</div></div>' +
    '<div style="background:var(--bg-secondary); padding:12px; border-radius:3px; border:1px solid var(--border);"><div style="font-family:var(--font-title); font-size:20px; color:#a78bfa;">' + upper + '</div><div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">UPPER</div></div>' +
    '<div style="background:var(--bg-secondary); padding:12px; border-radius:3px; border:1px solid var(--border);"><div style="font-family:var(--font-title); font-size:20px; color:#34d399;">' + numbers + '</div><div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">NUMBERS</div></div>' +
    '<div style="background:var(--bg-secondary); padding:12px; border-radius:3px; border:1px solid var(--border);"><div style="font-family:var(--font-title); font-size:20px; color:#fb7185;">' + symbols + '</div><div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">SYMBOLS</div></div>' +
    '</div></div>' +
    '<div style="margin-bottom:18px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:10px;">SECURITY CHECKS</div>' +
    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">' +
    [['8+ characters', checks.length8], ['12+ characters', checks.length12], ['16+ characters', checks.length16], ['Uppercase letters', checks.hasUpper], ['Lowercase letters', checks.hasLower], ['Numbers', checks.hasNumber], ['Special symbols', checks.hasSymbol], ['No repeated chars', checks.noRepeat], ['No sequential patterns', checks.noSequential], ['No keyboard walks', checks.noKeyboardWalk], ['Not a common password', checks.noCommon]].map(function(item) {
      return '<div style="font-family:var(--font-mono); font-size:13px; color:' + (item[1] ? '#10b981' : '#ef4444') + ';">' + (item[1] ? '?' : '?') + ' ' + item[0] + '</div>';
    }).join('') +
    '</div></div>' +
    (suggestions.length > 0 ?
    '<div style="margin-bottom:18px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:10px;">RECOMMENDATIONS</div>' +
    suggestions.map(function(s) { return '<div style="font-family:var(--font-mono); font-size:13px; color:#f59e0b; margin-bottom:4px;">? ' + s + '</div>'; }).join('') +
    '</div>' : '') +
    '<div id="breach-check-result"><p class="loading" style="font-size:13px;">Checking breach database...</p></div>' +
    '</div>';

  clearTimeout(breachCheckTimeout);
  breachCheckTimeout = setTimeout(function() { runBreachCheck(password); }, 600);
}

document.getElementById('password-input').addEventListener('input', function(e) {
  renderPasswordAnalysis(e.target.value);
});

document.getElementById('password-input').addEventListener('paste', function(e) {
  setTimeout(function() { renderPasswordAnalysis(e.target.value); }, 50);
});

document.getElementById('generate-pw-btn').addEventListener('click', function() {
  const pwd = generatePassword();
  const input = document.getElementById('password-input');
  input.type = 'text';
  input.value = pwd;
  document.getElementById('toggle-pw').style.color = '#f59e0b';
  renderPasswordAnalysis(pwd);
  navigator.clipboard.writeText(pwd).then(function() {
    const btn = document.getElementById('generate-pw-btn');
    btn.textContent = '? COPIED';
    btn.style.color = '#10b981';
    btn.style.borderColor = '#10b981';
    setTimeout(function() {
      btn.textContent = '? GENERATE';
      btn.style.color = '#64748b';
      btn.style.borderColor = '#1e2d4a';
    }, 2000);
  });
});

// ============================================================
// IP / DOMAIN INVESTIGATOR � ULTIMATE EDITION
// ============================================================
const KNOWN_SAFE = {
  '8.8.8.8': 'Google Public DNS',
  '8.8.4.4': 'Google Public DNS',
  '1.1.1.1': 'Cloudflare DNS',
  '1.0.0.1': 'Cloudflare DNS',
  '1.1.1.2': 'Cloudflare DNS (Malware Blocking)',
  '1.1.1.3': 'Cloudflare DNS (Adult Content Blocking)',
  '9.9.9.9': 'Quad9 DNS',
  '149.112.112.112': 'Quad9 DNS',
  '208.67.222.222': 'OpenDNS',
  '208.67.220.220': 'OpenDNS',
  '208.67.222.123': 'OpenDNS FamilyShield',
  '208.67.220.123': 'OpenDNS FamilyShield',
  '4.2.2.1': 'Level3 DNS',
  '4.2.2.2': 'Level3 DNS',
  '4.2.2.3': 'Level3 DNS',
  '4.2.2.4': 'Level3 DNS',
  '64.6.64.6': 'Verisign DNS',
  '64.6.65.6': 'Verisign DNS',
  '8.26.56.26': 'Comodo Secure DNS',
  '8.20.247.20': 'Comodo Secure DNS',
  '185.228.168.9': 'CleanBrowsing DNS',
  '185.228.169.9': 'CleanBrowsing DNS',
  '76.76.19.19': 'Alternate DNS',
  '76.223.122.150': 'Alternate DNS',
  '204.79.197.200': 'Microsoft Bing',
  '13.107.42.14': 'Microsoft Teams',
  '13.107.6.152': 'Microsoft Office 365',
  '17.172.224.47': 'Apple iCloud',
  '104.18.6.192': 'OpenAI',
  '104.18.7.192': 'OpenAI',
  '140.82.112.0': 'GitHub',
  '185.199.108.0': 'GitHub Pages',
  '62.38.0.0': 'Cosmote Greece',
  '62.39.0.0': 'Cosmote Greece',
  '46.10.0.0': 'Cosmote Greece',
  '46.11.0.0': 'Cosmote Greece',
  '176.63.0.0': 'Cosmote Greece',
  '94.64.0.0': 'Vodafone Greece',
  '94.65.0.0': 'Vodafone Greece',
  '94.66.0.0': 'Vodafone Greece',
  '94.67.0.0': 'Vodafone Greece',
  '195.167.0.0': 'Vodafone Greece',
  '212.205.0.0': 'Wind Hellas',
  '212.206.0.0': 'Wind Hellas',
  '94.70.0.0': 'Wind Hellas',
  '94.71.0.0': 'Wind Hellas',
  '195.130.0.0': 'Forthnet Greece',
  '83.235.0.0': 'Forthnet Greece',
  '185.31.28.0': 'Nova Greece',
  '195.251.0.0': 'GRNET',
  '195.252.0.0': 'GRNET',
  '83.212.0.0': 'GRNET',
  '83.213.0.0': 'GRNET',
  '147.102.0.0': 'University of Athens',
  '147.27.0.0': 'Aristotle University Thessaloniki',
  '193.92.0.0': 'Greek Government Network',
  '194.219.0.0': 'Greek Government Network',
  '77.235.32.0': 'OTE Group Greece',
  '78.87.0.0': 'OTE Group Greece',
  '78.88.0.0': 'OTE Group Greece',
  '109.242.0.0': 'OTE Group Greece'
};

const KNOWN_MALICIOUS = [
  '185.220.101.', '185.220.100.', '185.220.102.', '185.220.103.',
  '185.107.57.', '185.129.62.', '185.163.45.', '185.170.114.',
  '162.247.74.', '171.25.193.', '176.10.104.', '176.10.99.',
  '199.87.154.', '199.249.223.', '199.249.224.', '199.249.228.',
  '77.247.181.', '46.165.230.', '46.165.221.', '46.165.222.',
  '51.15.43.', '51.75.144.', '51.75.52.',
  '5.188.86.', '5.188.87.', '5.188.10.', '5.188.11.',
  '45.142.212.', '45.142.213.', '45.153.160.', '45.153.161.',
  '91.219.236.', '91.219.237.', '91.219.238.', '91.219.239.',
  '194.165.16.', '194.165.17.', '194.165.18.', '194.165.19.',
  '193.32.162.', '193.32.163.', '193.32.164.',
  '89.248.167.', '89.248.168.', '89.248.169.',
  '80.82.77.', '80.82.78.',
  '185.156.73.', '185.156.74.',
  '92.63.194.', '92.63.195.', '92.63.196.',
  '23.129.64.', '23.129.65.',
  '198.98.51.', '198.98.52.', '198.98.53.',
  '107.189.10.', '107.189.11.', '107.189.12.',
  '185.234.216.', '185.234.217.', '185.234.218.', '185.234.219.',
  '45.61.136.', '45.61.137.', '45.61.138.', '45.61.139.',
  '104.244.76.', '104.244.77.', '104.244.78.', '104.244.79.'
];

const PRIVATE_RANGES = [
  { pattern: /^10\./, label: 'Class A Private (10.0.0.0/8)' },
  { pattern: /^172\.(1[6-9]|2[0-9]|3[0-1])\./, label: 'Class B Private (172.16.0.0/12)' },
  { pattern: /^192\.168\./, label: 'Class C Private (192.168.0.0/16)' },
  { pattern: /^127\./, label: 'Loopback / Localhost' },
  { pattern: /^169\.254\./, label: 'Link-Local (APIPA)' },
  { pattern: /^::1$/, label: 'IPv6 Loopback' },
  { pattern: /^fc00:/, label: 'IPv6 Unique Local' },
  { pattern: /^fe80:/, label: 'IPv6 Link-Local' }
];

function getPrivateRange(ip) {
  for (const range of PRIVATE_RANGES) {
    if (range.pattern.test(ip)) return range.label;
  }
  return null;
}

function isKnownSafe(ip) {
  if (KNOWN_SAFE[ip]) return KNOWN_SAFE[ip];
  for (const prefix of Object.keys(KNOWN_SAFE)) {
    if (prefix.endsWith('.0') && ip.startsWith(prefix.slice(0, -1))) return KNOWN_SAFE[prefix];
  }
  return null;
}

function countryCodeToFlag(code) {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, function(char) {
    return String.fromCodePoint(127397 + char.charCodeAt(0));
  });
}

let ipSearchHistory = [];

function addToHistory(query, threat, color) {
  ipSearchHistory = ipSearchHistory.filter(function(h) { return h.query !== query; });
  ipSearchHistory.unshift({ query: query, threat: threat, color: color });
  if (ipSearchHistory.length > 10) ipSearchHistory.pop();
  renderIPHistory();
}

function renderIPHistory() {
  const histDiv = document.getElementById('ip-history');
  if (!histDiv) return;
  if (ipSearchHistory.length === 0) {
    histDiv.innerHTML = '<p class="placeholder-text" style="font-size:12px;">No recent searches</p>';
    return;
  }
  histDiv.innerHTML = ipSearchHistory.map(function(h) {
    return '<div onclick="loadFromHistory(\'' + h.query + '\')" style="cursor:pointer; padding:10px 14px; margin-bottom:6px; background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ' + h.color + '; border-radius:2px; font-family:var(--font-mono); font-size:12px; color:' + h.color + ';" onmouseover="this.style.background=\'var(--amber-glow)\'" onmouseout="this.style.background=\'var(--bg-secondary)\'">' + h.query + ' <span style="font-size:11px; color:' + h.color + ';">' + h.threat + '</span></div>';
  }).join('');
}

function loadFromHistory(query) {
  document.getElementById("ip-input").value = query;
  investigateIP();
}

function copyIPReport() {
  const reportEl = document.getElementById('ip-report-text');
  if (!reportEl) return;
  navigator.clipboard.writeText(reportEl.innerText).then(function() {
    const btn = document.getElementById('copy-ip-btn');
    if (btn) {
      btn.textContent = '? COPIED';
      btn.style.color = '#10b981';
      btn.style.borderColor = '#10b981';
      setTimeout(function() { btn.textContent = 'COPY'; btn.style.color = ''; btn.style.borderColor = ''; }, 2000);
    }
  });
}

function exportIPPDF() {
  const reportEl = document.getElementById('ip-report-text');
  if (!reportEl) return;
  const target = document.getElementById('ip-input').value.trim();
  const printWindow = window.open('', '_blank');
  printWindow.document.write('<html><head><title>Aegis Threat Report — ' + target + '</title><style>body{background:#020818;color:#e2e8f0;font-family:Courier New,monospace;padding:40px;}h1{color:#f59e0b;font-size:20px;letter-spacing:4px;border-bottom:1px solid #f59e0b;padding-bottom:12px;margin-bottom:24px;}.footer{margin-top:40px;border-top:1px solid #1e2d4a;padding-top:12px;color:#64748b;font-size:11px;}</style></head><body><h1>AEGIS THREAT INTELLIGENCE REPORT</h1><p style="color:#64748b;font-size:12px;margin-bottom:24px;">Generated: ' + new Date().toUTCString() + ' | Target: ' + target + '</p><div>' + reportEl.innerText.replace(/\n/g, '<br>') + '</div><div class="footer">Generated by Aegis Security Intelligence Dashboard | Powered by ip-api.com & Aegis Intelligence Engine</div></body></html>');
  printWindow.document.close();
  setTimeout(function() { printWindow.print(); }, 500);
}

// ─── IP INVESTIGATOR — LEAFLET MAP ───────────────────────────
let _ipLeafletMap = null;

function initIPLeafletMap(lat, lon) {
  if (_ipLeafletMap) {
    try { _ipLeafletMap.remove(); } catch (_) {}
    _ipLeafletMap = null;
  }
  const container = document.getElementById('ip-leaflet-map');
  if (!container || typeof L === 'undefined') return;

  _ipLeafletMap = L.map('ip-leaflet-map', {
    center: [lat, lon],
    zoom: 8,
    zoomControl: true,
    attributionControl: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(_ipLeafletMap);

  const icon = L.divIcon({
    className: '',
    html: '<div style="width:18px;height:18px;border-radius:50%;background:#f59e0b;border:2px solid #fcd34d;box-shadow:0 0 12px #f59e0b,0 0 24px rgba(245,158,11,0.5);"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
  L.marker([lat, lon], { icon }).addTo(_ipLeafletMap);

  L.circle([lat, lon], {
    radius: 25000,
    color: '#f59e0b',
    fillColor: '#f59e0b',
    fillOpacity: 0.06,
    weight: 1,
    opacity: 0.5,
    className: 'ip-pulse-ring'
  }).addTo(_ipLeafletMap);
}

async function investigateIP() {
  const input = document.getElementById('ip-input').value.trim();
  const resultDiv = document.getElementById('ip-result');

  if (!input) {
    resultDiv.innerHTML = '<p class="placeholder-text">Please enter an IP address or domain.</p>';
    return;
  }

  const privateRange = getPrivateRange(input);
  if (privateRange) {
    resultDiv.innerHTML =
      '<div class="breach-card" style="border-left-color:#a78bfa; background:rgba(167,139,250,0.08)">' +
      '<div class="breach-name" style="color:#a78bfa; font-size:16px;">?? PRIVATE / INTERNAL IP</div>' +
      '<div class="breach-detail" style="margin-top:14px;">' +
      '<p style="color:var(--text-primary); margin-bottom:14px; font-size:14px;">This is a private network address. It exists only within a local network and cannot be traced on the public internet.</p>' +
      '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
      '<div>RANGE TYPE: <span style="color:#a78bfa">' + privateRange + '</span></div>' +
      '<div>PUBLICLY ROUTABLE: <span style="color:#ef4444">No</span></div>' +
      '<div>THREAT LEVEL: <span style="color:#10b981">None — Internal Only</span></div>' +
      '<div>VISIBLE ON INTERNET: <span style="color:#ef4444">No</span></div>' +
      '</div></div></div>';
    return;
  }

  resultDiv.innerHTML = '<p class="loading">INVESTIGATING TARGET...</p>';

  try {
    // Resolve domain to IP first if needed
    let targetIP = input;
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(input) && !input.includes(':')) {
      try {
        const resolveResponse = await fetch('https://dns.google/resolve?name=' + input + '&type=A');
        const resolveData = await resolveResponse.json();
        if (resolveData.Answer && resolveData.Answer.length > 0) {
          targetIP = resolveData.Answer[0].data;
        }
      } catch(e) {}
    }
    const ipResponse = await fetch('https://aegis-proxy.ka-mixalis99.workers.dev/?url=' + encodeURIComponent('https://ipwho.is/' + targetIP));
    const d = await ipResponse.json();

    if (d.status === 'fail' || d.success === false) {
      resultDiv.innerHTML =
        '<div style="border:1px solid #ef4444; border-left:3px solid #ef4444; border-radius:3px; padding:20px; background:rgba(239,68,68,0.08); font-family:var(--font-mono); font-size:13px; color:#ef4444; line-height:1.8;">' +
        '<div style="font-size:15px; font-weight:bold; margin-bottom:10px;">&#9888; UNABLE TO RESOLVE</div>' +
        'No geolocation data found for this address. Please check the domain or IP and try again.' +
        (d.message ? '<div style="margin-top:8px; color:var(--text-dim);">Detail: ' + d.message + '</div>' : '') +
        '</div>';
      return;
    }

    let reverseDNS = 'No PTR record found';
    try {
      const dnsResponse = await fetch('https://dns.google/resolve?name=' + d.query + '&type=PTR');
      const dnsData = await dnsResponse.json();
      if (dnsData.Answer && dnsData.Answer.length > 0) reverseDNS = dnsData.Answer[0].data.replace(/\.$/, '');
    } catch (e) { reverseDNS = 'Lookup failed'; }

    let whoisHTML = '';
    try {
      const whoisResponse = await fetch('https://whoisjson.com/api/v1/whois?domain=' + encodeURIComponent(input));
      const whoisData = await whoisResponse.json();
      if (whoisData && !whoisData.error) {
        const created = whoisData.created_date ? new Date(whoisData.created_date).toLocaleDateString() : 'Unknown';
        const expires = whoisData.expiration_date ? new Date(whoisData.expiration_date).toLocaleDateString() : 'Unknown';
        whoisHTML = '<div style="margin-top:14px; border-top:1px solid var(--border); padding-top:14px;"><div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:10px;">WHOIS DATA</div><div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-family:var(--font-mono); font-size:13px; color:var(--text-dim);"><div>REGISTRAR: <span style="color:var(--text-primary)">' + (whoisData.registrar || 'Unknown') + '</span></div><div>REGISTRANT: <span style="color:var(--text-primary)">' + (whoisData.registrant_name || whoisData.registrant_org || 'Redacted') + '</span></div><div>CREATED: <span style="color:var(--text-primary)">' + created + '</span></div><div>EXPIRES: <span style="color:var(--text-primary)">' + expires + '</span></div></div></div>';
      }
    } catch (e) {}

    let threatScore = 0;
    let threatReasons = [];
    d.query = d.ip || d.query || input;
    // Normalize ipwho.is response fields
    d.countryCode = d.country_code || d.countryCode || '';
    d.regionName = d.region || d.regionName || 'Unknown';
    d.isp = (d.connection && d.connection.isp) ? d.connection.isp : (d.isp || 'Unknown');
    d.org = (d.connection && d.connection.org) ? d.connection.org : (d.org || 'Unknown');
    d.as = (d.connection && d.connection.asn) ? 'AS' + d.connection.asn : (d.as || 'Unknown');
    d.proxy = (d.security && d.security.proxy) ? d.security.proxy : (d.proxy || false);
    d.hosting = (d.security && d.security.hosting) ? d.security.hosting : (d.hosting || false);
    d.lat = d.latitude || d.lat || 0;
    d.lon = d.longitude || d.lon || 0;
    const knownSafeLabel = isKnownSafe(d.query);
    const isMalicious = KNOWN_MALICIOUS.some(function(range) { return d.query && d.query.startsWith(range); });
    if (isMalicious) { threatScore += 80; threatReasons.push('Known malicious IP range'); }
    if (d.proxy && !knownSafeLabel) { threatScore += 40; threatReasons.push('Proxy / VPN detected'); }
    if (d.hosting && !knownSafeLabel) { threatScore += 20; threatReasons.push('Hosted in datacenter'); }
    if (['CN','RU','KP','IR','NG','RO'].includes(d.countryCode) && !knownSafeLabel) { threatScore += 15; threatReasons.push('High-risk origin country'); }

    let threat, threatColor, threatBg;
    if (knownSafeLabel) { threat = 'TRUSTED'; threatColor = '#10b981'; threatBg = 'rgba(16,185,129,0.08)'; }
    else if (threatScore >= 60) { threat = 'HIGH THREAT'; threatColor = '#ef4444'; threatBg = 'rgba(239,68,68,0.08)'; }
    else if (threatScore >= 25) { threat = 'SUSPICIOUS'; threatColor = '#f59e0b'; threatBg = 'rgba(245,158,11,0.08)'; }
    else { threat = 'CLEAN'; threatColor = '#10b981'; threatBg = 'rgba(16,185,129,0.08)'; }

    const barWidth = knownSafeLabel ? 0 : Math.min(threatScore, 100);
    const flag = countryCodeToFlag(d.countryCode);
    const hasValidCoords = (d.lat !== 0 || d.lon !== 0) && d.lat != null && d.lon != null;
    addToHistory(d.query, threat, threatColor);

    resultDiv.innerHTML =
      '<div id="ip-report-text" class="breach-card" style="border-left-color:' + threatColor + '; background:' + threatBg + '">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; flex-wrap:wrap; gap:8px;">' +
      '<div class="breach-name" style="color:' + threatColor + '; font-size:16px;">' + threat + ' — ' + d.query + '</div>' +
      '<div style="display:flex; gap:8px;">' +

      '<button onclick="exportIPPDF()" class="aegis-btn" style="font-size:11px; padding:8px 16px; border-color:#a78bfa; color:#a78bfa;">&#11015; PDF</button>' +
      '</div></div>' +
      (knownSafeLabel ? '<div style="font-family:var(--font-mono); font-size:13px; color:#10b981; margin-bottom:14px;">&#10003; Verified: ' + knownSafeLabel + '</div>' : '') +
      (!knownSafeLabel ? '<div style="margin:14px 0;"><div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">THREAT SCORE</div><div style="background:#0a0f1e; border-radius:2px; height:8px; width:100%;"><div style="background:' + threatColor + '; height:8px; width:' + barWidth + '%; border-radius:2px; box-shadow:0 0 8px ' + threatColor + ';"></div></div><div style="font-family:var(--font-mono); font-size:13px; color:' + threatColor + '; margin-top:6px;">' + threatScore + '/100</div></div>' : '') +
      (threatReasons.length > 0 ? '<div style="margin-bottom:14px;"><div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">THREAT INDICATORS</div>' + threatReasons.map(function(r) { return '<div style="font-family:var(--font-mono); font-size:13px; color:' + threatColor + '; margin-bottom:4px;">&#9658; ' + r + '</div>'; }).join('') + '</div>' : '') +
      '<div class="breach-detail" style="margin-top:14px; border-top:1px solid var(--border); padding-top:14px;">' +
      '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:10px;">NETWORK INTELLIGENCE</div>' +
      '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
      '<div>REVERSE DNS: <span style="color:var(--text-primary)">' + reverseDNS + '</span></div>' +
      '<div>COUNTRY: <span>' + flag + ' ' + d.country + ' (' + d.countryCode + ')</span></div>' +
      '<div>REGION: <span>' + d.regionName + '</span></div>' +
      '<div>CITY: <span>' + d.city + '</span></div>' +
      '<div>ISP: <span>' + d.isp + '</span></div>' +
      '<div>ORGANIZATION: <span>' + d.org + '</span></div>' +
      '<div>AS NUMBER: <span>' + d.as + '</span></div>' +
      '<div>COORDINATES: <span>' + d.lat + ', ' + d.lon + '</span></div>' +
      '<div>PROXY / VPN: <span style="color:' + (d.proxy && !knownSafeLabel ? '#ef4444' : '#10b981') + '">' + (d.proxy && !knownSafeLabel ? 'YES' : 'No') + '</span></div>' +
      '<div>DATACENTER: <span style="color:' + (d.hosting && !knownSafeLabel ? '#f59e0b' : '#10b981') + '">' + (d.hosting && !knownSafeLabel ? 'YES' : 'No') + '</span></div>' +
      '</div></div>' +

      '<div style="margin-top:16px; border-top:1px solid var(--border); padding-top:14px;">' +
      '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:10px;">GEOLOCATION MAP</div>' +
      (hasValidCoords
        ? '<div id="ip-leaflet-map" style="height:320px; border-radius:3px; border:1px solid var(--border); background:#0a0f1e;"></div>'
        : '<div style="border:1px solid #f59e0b; border-left:3px solid #ef4444; border-radius:3px; padding:16px; background:rgba(239,68,68,0.08); font-family:var(--font-mono); font-size:13px; color:#ef4444; line-height:1.8;">Unable to resolve — no geolocation data found for this address. Please check the domain or IP and try again.</div>'
      ) +
      '</div></div>' +
      '<div class="result-label" style="margin-top:10px;">Data sourced from ipwho.is — Threat scoring by Aegis Intelligence Engine — ' + new Date().toUTCString() + '</div>';

    if (hasValidCoords) {
      setTimeout(function() { initIPLeafletMap(d.lat, d.lon); }, 50);
    }

  } catch (error) {
    resultDiv.innerHTML = '<p class="placeholder-text">Error: ' + error.message + '</p>';
  }
}

document.getElementById('ip-btn').addEventListener('click', investigateIP);
document.getElementById('ip-input').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') investigateIP();
});

document.getElementById('my-ip-btn').addEventListener('click', async function() {
  const btn = document.getElementById('my-ip-btn');
  btn.textContent = 'LOCATING...';
  btn.style.opacity = '0.6';
  try {
    const response = await fetch('https://api64.ipify.org?format=json');
    const data = await response.json();
    document.getElementById('ip-input').value = data.ip;
    btn.textContent = '? MY IP';
    btn.style.opacity = '1';
    investigateIP();
  } catch (e) {
    btn.textContent = '? MY IP';
    btn.style.opacity = '1';
    document.getElementById('ip-result').innerHTML = '<p class="placeholder-text">Could not detect your IP. Try again.</p>';
  }
});

document.getElementById('clear-ip-btn').addEventListener('click', function() {
  document.getElementById('ip-input').value = '';
  document.getElementById('ip-result').innerHTML = '<p class="placeholder-text">Enter an IP address or domain to investigate.</p>';
});


// CLEAR IP HISTORY
function clearIPHistory() {
  ipSearchHistory = [];
  renderIPHistory();
}

function getSeverityColor(severity) {
  switch(severity) {
    case 'CRITICAL': return '#ef4444';
    case 'HIGH': return '#f97316';
    case 'MEDIUM': return '#f59e0b';
    case 'LOW': return '#84cc16';
    default: return '#64748b';
  }
}

function getSeverityBg(severity) {
  switch(severity) {
    case 'CRITICAL': return 'rgba(239,68,68,0.08)';
    case 'HIGH': return 'rgba(249,115,22,0.08)';
    case 'MEDIUM': return 'rgba(245,158,11,0.08)';
    case 'LOW': return 'rgba(132,204,18,0.08)';
    default: return 'rgba(100,116,139,0.08)';
  }
}

function extractCVEData(item) {
  const cve = item.cve;
  const id = cve.id;
  const description = cve.descriptions.find(function(d) { return d.lang === 'en'; });
const CVE_KEYWORDS = ["windows","linux","apache","chrome","firefox","android","ios","microsoft","adobe","oracle","cisco","vmware","nginx","openssl","php","python","java"];

  const desc = description ? description.value : 'No description available.';
  const published = new Date(cve.published).toLocaleDateString();
  const modified = new Date(cve.lastModified).toLocaleDateString();
  let severity = 'UNKNOWN';
  let score = null;

  if (cve.metrics) {
    const cvss31 = cve.metrics.cvssMetricV31;
    const cvss30 = cve.metrics.cvssMetricV30;
    const cvss2 = cve.metrics.cvssMetricV2;
    if (cvss31 && cvss31.length > 0) {
      score = cvss31[0].cvssData.baseScore;
      severity = cvss31[0].cvssData.baseSeverity;
    } else if (cvss30 && cvss30.length > 0) {
      score = cvss30[0].cvssData.baseScore;
      severity = cvss30[0].cvssData.baseSeverity;
    } else if (cvss2 && cvss2.length > 0) {
      score = cvss2[0].cvssData.baseScore;
      severity = cvss2[0].baseSeverity || 'UNKNOWN';
    }
  }

  const references = cve.references ? cve.references.slice(0, 3) : [];
  const hasKeyword = CVE_KEYWORDS.some(function(kw) { return desc.toLowerCase().includes(kw); });
  const matchedKeywords = CVE_KEYWORDS.filter(function(kw) { return desc.toLowerCase().includes(kw); });

  return { id, desc, published, modified, severity, score, references, hasKeyword, matchedKeywords };
}

// Cache CVE feed data so the CVE Explainer can pass it to Claude,
// enabling explanation of recent CVEs beyond its training cutoff.
window._cveFeedCache = window._cveFeedCache || {};

function renderCVECard(cve, expanded) {
  window._cveFeedCache[cve.id] = cve;
  const color = getSeverityColor(cve.severity);
  const bg = getSeverityBg(cve.severity);
  const scoreDisplay = cve.score !== null ? cve.score.toFixed(1) : 'N/A';
  const shortDesc = cve.desc.length > 200 ? cve.desc.slice(0, 200) + '...' : cve.desc;
  const keywordBadges = cve.matchedKeywords.map(function(kw) {
    return '<span style="background:rgba(245,158,11,0.15); border:1px solid #f59e0b; color:#f59e0b; font-family:var(--font-mono); font-size:12px; padding:4px 12px; border-radius:2px; margin-right:6px; margin-top:4px;">' + kw.toUpperCase() + '</span>';
  }).join('');

  return '<div id="cve-card-' + cve.id + '" style="background:' + bg + '; border:1px solid var(--border); border-left:3px solid ' + color + '; border-radius:3px; padding:18px; margin-bottom:12px;">' +
    '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; flex-wrap:wrap; gap:8px;">' +
    '<div style="display:flex; align-items:center; gap:12px;">' +
    '<div style="font-family:var(--font-title); font-size:14px; color:' + color + '; letter-spacing:1px;">' + cve.id + '</div>' +
    '<div style="background:' + color + '; color:#020818; font-family:var(--font-mono); font-size:11px; font-weight:bold; padding:3px 10px; border-radius:2px;">' + cve.severity + '</div>' +
    '<div style="font-family:var(--font-title); font-size:18px; color:' + color + ';">' + scoreDisplay + '</div>' +
    '</div>' +
    '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
    '<button onclick="copyCVEId(\'' + cve.id + '\')" id="copy-cve-' + cve.id + '" class="aegis-btn" style="font-size:11px; padding:6px 12px;">COPY ID</button>' +
    '<a href="https://nvd.nist.gov/vuln/detail/' + cve.id + '" target="_blank" class="aegis-btn" style="font-size:11px; padding:6px 12px; text-decoration:none; border-color:#a78bfa; color:#a78bfa;">&#9670; NVD</a>' +
    '<button onclick="toggleCVEExpand(\'' + cve.id + '\')" class="aegis-btn" style="font-size:11px; padding:6px 12px; border-color:#1e2d4a; color:#64748b;">' + (expanded ? '^ LESS' : '&#9660; MORE') + '</button>' +
    '<button onclick="openCVEModal(\'' + cve.id + '\')" class="aegis-btn" style="font-size:11px; padding:6px 12px; border-color:#f59e0b; color:#f59e0b;">&#9889; EXPLAIN</button>' +
    '</div></div>' +
    (cve.hasKeyword && cve.matchedKeywords.length > 0 ? '<div style="margin-bottom:10px;">' + keywordBadges + '</div>' : '') +
    '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); line-height:1.7; margin-bottom:10px;">' + (expanded ? cve.desc : shortDesc) + '</div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">PUBLISHED: <span style="color:var(--text-primary)">' + cve.published + '</span> &nbsp;|&nbsp; MODIFIED: <span style="color:var(--text-primary)">' + cve.modified + '</span></div>' +
    (expanded && cve.references.length > 0 ? '<div style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px;"><div style="font-family:var(--font-mono); font-size:13px; color:var(--amber); letter-spacing:2px; margin-bottom:8px;">REFERENCES</div>' + cve.references.map(function(r) { return '<div style="font-family:var(--font-mono); font-size:12px; margin-bottom:4px;"><a href="' + r.url + '" target="_blank" style="color:#60a5fa; text-decoration:none;">' + r.url + '</a></div>'; }).join('') + '</div>' : '') +
    '</div>';
}

function copyCVEId(id) {
  navigator.clipboard.writeText(id).then(function() {
    const btn = document.getElementById('copy-cve-' + id);
    if (btn) {
      btn.textContent = '? COPIED';
      btn.style.color = '#10b981';
      btn.style.borderColor = '#10b981';
      setTimeout(function() { btn.textContent = 'COPY ID'; btn.style.color = ''; btn.style.borderColor = ''; }, 2000);
    }
  });
}

// ── CVE MODAL ────────────────────────────────────────────────
// Opens a modal overlay directly on the CVE Feed page — no navigation,
// no timers, no race conditions. Shows NVD data immediately then calls
// Claude with description-only prompt to avoid training-data refusals.
const CVE_MODAL_PROXY = 'https://aegis-proxy.ka-mixalis99.workers.dev/?url=';

function openCVEModal(cveId) {
  const cveData = window._cveFeedCache && window._cveFeedCache[cveId];
  if (!cveData) return;

  const sevColors = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#84cc16' };
  const sevColor  = sevColors[cveData.severity] || '#64748b';
  const scoreStr  = cveData.score != null ? cveData.score.toFixed(1) : 'N/A';

  // Reuse or create the overlay element
  var overlay = document.getElementById('cve-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'cve-modal-overlay';
    overlay.style.cssText =
      'position:fixed; top:0; left:0; width:100%; height:100%;' +
      'background:rgba(2,8,24,0.92); z-index:8000;' +
      'display:flex; align-items:center; justify-content:center;' +
      'padding:20px; box-sizing:border-box;';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeCVEModal();
    });
    document.body.appendChild(overlay);
  }

  overlay.style.display = 'flex';
  overlay.innerHTML =
    '<div onclick="event.stopPropagation()" style="' +
      'background:#060d1f; border:1px solid #1e2d4a;' +
      'border-top:3px solid ' + sevColor + ';' +
      'border-radius:4px; width:700px; max-width:100%;' +
      'max-height:85vh; overflow-y:auto; padding:28px; position:relative;">' +

    // Header
    '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:20px; flex-wrap:wrap;">' +
    '<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">' +
    '<div style="font-family:var(--font-title); font-size:16px; color:var(--amber); letter-spacing:2px;">' + cveId + '</div>' +
    '<div style="background:' + sevColor + '; color:#020818; font-family:var(--font-mono); font-size:11px; font-weight:bold; padding:3px 12px; border-radius:2px;">' + (cveData.severity || 'UNKNOWN') + '</div>' +
    '<div style="border:1px solid ' + sevColor + '; color:' + sevColor + '; font-family:var(--font-mono); font-size:11px; font-weight:bold; padding:3px 12px; border-radius:2px;">CVSS ' + scoreStr + '</div>' +
    '</div>' +
    '<button onclick="closeCVEModal()" style="background:transparent; border:1px solid var(--border); color:var(--text-dim); font-family:var(--font-mono); font-size:12px; padding:5px 14px; border-radius:2px; cursor:pointer; white-space:nowrap; flex-shrink:0; letter-spacing:1px;">&#10005; CLOSE</button>' +
    '</div>' +

    // NVD description
    '<div style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">&#9673; NVD DESCRIPTION · NIST NATIONAL VULNERABILITY DATABASE</div>' +
    '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-primary); line-height:1.8; padding:14px; background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ' + sevColor + '; border-radius:3px; margin-bottom:12px;">' +
    cveData.desc.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') +
    '</div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-bottom:20px;">PUBLISHED: ' + (cveData.published || '—') + ' &nbsp;|&nbsp; MODIFIED: ' + (cveData.modified || '—') + '</div>' +

    // AI analysis section
    '<div style="border-top:1px solid var(--border); padding-top:20px;">' +
    '<div style="font-family:var(--font-mono); font-size:10px; color:#a78bfa; letter-spacing:2px; margin-bottom:14px;">&#9889; AI TECHNICAL ANALYSIS · CLAUDE SONNET</div>' +
    '<div id="cve-modal-ai-body">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; animation:blink 1s infinite;">GENERATING ANALYSIS...</div>' +
    '</div>' +
    '</div>' +
    '</div>';

  // ESC to close
  document.addEventListener('keydown', cveModalKeyHandler);

  // Call Claude with description only — no CVE ID in prompt
  cveModalFetchAnalysis(cveData.desc);
}

function cveModalKeyHandler(e) {
  if (e.key === 'Escape') closeCVEModal();
}

function closeCVEModal() {
  var overlay = document.getElementById('cve-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  document.removeEventListener('keydown', cveModalKeyHandler);
}

async function cveModalFetchAnalysis(desc) {
  var aiBody = document.getElementById('cve-modal-ai-body');
  if (!aiBody) return;

  var prompt =
    'A vulnerability has been described as follows: ' + desc + '. ' +
    'Explain: 1) What type of vulnerability this is, 2) How the attack works, ' +
    '3) What systems are at risk, 4) Real-world impact, 5) Remediation steps. ' +
    'Be direct and technical.';

  try {
    var resp = await fetch(CVE_MODAL_PROXY + encodeURIComponent('https://api.anthropic.com/v1/messages'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    var data = await resp.json();
    if (data.error) throw new Error(data.error.message);

    var aiBody2 = document.getElementById('cve-modal-ai-body');
    if (aiBody2) {
      aiBody2.innerHTML =
        '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-primary); line-height:1.8;">' +
        renderBriefingMarkdown(data.content[0].text) +
        '</div>';
    }
  } catch (err) {
    var aiBody3 = document.getElementById('cve-modal-ai-body');
    if (aiBody3) {
      aiBody3.innerHTML =
        '<div style="font-family:var(--font-mono); font-size:13px; color:#ef4444; padding:12px; border:1px solid #ef4444; border-radius:3px;">Analysis failed: ' +
        err.message.replace(/</g,'&lt;') + '</div>';
    }
  }
}

let expandedCVEs = {};
function toggleCVEExpand(id) {
  expandedCVEs[id] = !expandedCVEs[id];
  renderCVEList();
}

let activeSeverityFilter = 'ALL';
let cveSearchTerm = '';

function renderCVEList() {
  const resultDiv = document.getElementById('cve-result');
  if (allCVEs.length === 0) return;

  let filtered = allCVEs.filter(function(cve) {
    const matchesSeverity = activeSeverityFilter === 'ALL' || cve.severity === activeSeverityFilter;
    const matchesSearch = cveSearchTerm === '' ||
      cve.id.toLowerCase().includes(cveSearchTerm) ||
      cve.desc.toLowerCase().includes(cveSearchTerm);
    return matchesSeverity && matchesSearch;
  });

  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  allCVEs.forEach(function(cve) { counts[cve.severity] = (counts[cve.severity] || 0) + 1; });

  const total = allCVEs.length;
  const statsBar =
    '<div style="margin-bottom:20px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:10px;">SEVERITY BREAKDOWN · ' + total + ' VULNERABILITIES</div>' +
    '<div style="display:flex; gap:4px; height:8px; border-radius:4px; overflow:hidden; margin-bottom:12px;">' +
    (counts.CRITICAL > 0 ? '<div style="background:#ef4444; flex:' + counts.CRITICAL + '; transition:flex 0.5s;" title="CRITICAL: ' + counts.CRITICAL + '"></div>' : '') +
    (counts.HIGH > 0 ? '<div style="background:#f97316; flex:' + counts.HIGH + '; transition:flex 0.5s;" title="HIGH: ' + counts.HIGH + '"></div>' : '') +
    (counts.MEDIUM > 0 ? '<div style="background:#f59e0b; flex:' + counts.MEDIUM + '; transition:flex 0.5s;" title="MEDIUM: ' + counts.MEDIUM + '"></div>' : '') +
    (counts.LOW > 0 ? '<div style="background:#84cc16; flex:' + counts.LOW + '; transition:flex 0.5s;" title="LOW: ' + counts.LOW + '"></div>' : '') +
    (counts.UNKNOWN > 0 ? '<div style="background:#64748b; flex:' + counts.UNKNOWN + '; transition:flex 0.5s;" title="UNKNOWN: ' + counts.UNKNOWN + '"></div>' : '') +
    '</div>' +
    '<div style="display:flex; gap:12px; flex-wrap:wrap;">' +
    ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(function(sev) {
      const isActive = activeSeverityFilter === sev;
      const col = sev === 'ALL' ? '#f59e0b' : getSeverityColor(sev);
      const cnt = sev === 'ALL' ? total : (counts[sev] || 0);
      return '<button onclick="setCVEFilter(\'' + sev + '\')" style="background:' + (isActive ? col : 'transparent') + '; border:1px solid ' + col + '; color:' + (isActive ? '#020818' : col) + '; font-family:var(--font-mono); font-size:11px; padding:6px 14px; border-radius:2px; cursor:pointer; transition:all 0.2s;">' + sev + ' (' + cnt + ')</button>';
    }).join('') +
    '</div></div>';

  const searchBar =
    '<div style="margin-bottom:20px;">' +
    '<input type="text" id="cve-search" oninput="searchCVEs(this.value)" placeholder="Search CVEs by ID or keyword..." class="aegis-input" style="width:100%;" value="' + cveSearchTerm + '">' +
    '</div>';

  const lastUpdated = '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-bottom:16px;">LAST UPDATED: ' + new Date().toUTCString() + ' &nbsp;|&nbsp; SOURCE: NVD (National Vulnerability Database)</div>';

  const cveCards = filtered.length > 0
    ? filtered.map(function(cve) { return renderCVECard(cve, expandedCVEs[cve.id]); }).join('')
    : '<p class="placeholder-text">No CVEs match your current filter.</p>';

  resultDiv.innerHTML = statsBar + searchBar + lastUpdated + cveCards;
}

function setCVEFilter(severity) {
  activeSeverityFilter = severity;
  renderCVEList();
}

function searchCVEs(term) {
  cveSearchTerm = term.toLowerCase();
  renderCVEList();
}



function nvdRecentCVEUrl(days, count) {
  var now = new Date();
  var start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  function fmt(d) { return d.toISOString().slice(0, -1); }
  return 'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=' + count +
    '&pubStartDate=' + fmt(start) + '&pubEndDate=' + fmt(now);
}

async function loadCVEFeed() {
  const resultDiv = document.getElementById('cve-result');
  resultDiv.innerHTML = '<p class="loading">PULLING LATEST CVE DATA FROM NVD...</p>';
  allCVEs = [];
  expandedCVEs = {};
  activeSeverityFilter = 'ALL';
  cveSearchTerm = '';
  try {
    const response = await fetch('https://aegis-proxy.ka-mixalis99.workers.dev/?url=' + encodeURIComponent(nvdRecentCVEUrl(30, 20)));
    const data = await response.json();
    if (!data.vulnerabilities || data.vulnerabilities.length === 0) {
      resultDiv.innerHTML = '<p class="placeholder-text">No CVE data available right now. Try again later.</p>';
      return;
    }
    allCVEs = data.vulnerabilities
      .sort(function(a, b) { return new Date(b.cve.published) - new Date(a.cve.published); })
      .map(extractCVEData);
    renderCVEList();
  } catch (error) {
    resultDiv.innerHTML = '<p class="placeholder-text">Error loading CVE feed: ' + error.message + '</p>';
  }
}

// Auto-load CVE feed when page is visited
document.querySelectorAll('.nav-item').forEach(function(item) {
  item.addEventListener('click', function() {
    if (item.dataset.page === 'cve') {
      setTimeout(loadCVEFeed, 100);
    }
  });
});




























// ============================================================
// AI DAILY BRIEFING � FULL EDITION
// ============================================================
let briefingHistory = [];
let briefingAbortController = null;

function stopBriefing() {
  if (briefingAbortController) {
    briefingAbortController.abort();
    briefingAbortController = null;
  }
}

function renderBriefingMarkdown(text) {
  // ── CODE BLOCK PROCESSING (must run first to protect content) ─
  // Replace fenced code blocks before any other rule touches the text.
  // Matches ```lang or ``` ... ``` with any internal content.
  text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, function(_, code) {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return '<pre style="background:#060d1f; border-left:3px solid #f59e0b; border-radius:4px; padding:16px; font-family:\'IBM Plex Mono\',monospace; font-size:13px; color:#e2e8f0; overflow-x:auto; white-space:pre; margin:12px 0;"><code>' + escaped + '</code></pre>';
  });
  // ── END CODE BLOCK PROCESSING ────────────────────────────────

  // ── TABLE PROCESSING ─────────────────────────────────────────
  const mdLines = text.split('\n');
  const mdOut   = [];
  let mi = 0;
  while (mi < mdLines.length) {
    if (/^\s*\|/.test(mdLines[mi])) {
      const block = [];
      while (mi < mdLines.length && /^\s*\|/.test(mdLines[mi])) {
        block.push(mdLines[mi++]);
      }
      const sepIdx = block.findIndex(l => /^\s*\|[\s\-:|]+\|/.test(l));
      if (sepIdx === -1) {
        mdOut.push(...block);
      } else {
        const parseCells = l => l.split('|').slice(1, -1).map(c => c.trim());
        let tbl = '<table style="width:100%; border-collapse:collapse; margin:12px 0; background:#0a0f1e; border:1px solid rgba(245,158,11,0.2);">';
        block.slice(0, sepIdx).forEach(function(line) {
          tbl += '<tr>' + parseCells(line).map(function(c) {
            return '<th style="font-family:var(--font-mono); font-size:11px; color:var(--amber); padding:7px 10px; border:1px solid rgba(245,158,11,0.25); text-align:left; letter-spacing:1px; background:rgba(245,158,11,0.06);">' + c + '</th>';
          }).join('') + '</tr>';
        });
        block.slice(sepIdx + 1).forEach(function(line, idx) {
          const bg = idx % 2 === 0 ? 'rgba(13,21,38,0.4)' : 'transparent';
          tbl += '<tr style="background:' + bg + ';">' + parseCells(line).map(function(c) {
            return '<td style="font-family:var(--font-mono); font-size:12px; color:var(--text-primary); padding:7px 10px; border:1px solid rgba(30,45,74,0.8);">' + c + '</td>';
          }).join('') + '</tr>';
        });
        tbl += '</table>';
        mdOut.push(tbl);
      }
    } else {
      mdOut.push(mdLines[mi++]);
    }
  }
  text = mdOut.join('\n');
  // ── END TABLE PROCESSING ─────────────────────────────────────

  return text
    // Bold: **text**
    .replace(/\*\*(.*?)\*\*/g, '<span style="color:var(--amber); font-weight:bold;">$1</span>')
    // H2: ## Header
    .replace(/^##\s+(.+)$/gm, '<div style="font-family:var(--font-title); font-size:13px; color:var(--amber); letter-spacing:2px; margin-top:20px; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid var(--border);">$1</div>')
    // H3: ### Header
    .replace(/^###\s+(.+)$/gm, '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-top:14px; margin-bottom:6px;">$1</div>')
    // Numbered section labels: 1. ALL CAPS:
    .replace(/^(\d+\.\s+[A-Z][A-Z\s]+:)/gm, '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-top:16px; margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid var(--border);">$1</div>')
    // Bullet points: - item or • item
    .replace(/^[-•]\s+(.+)$/gm, '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); margin-bottom:6px; padding-left:12px;">&#9658; $1</div>')
    // Horizontal rules: --- or *** or ___
    .replace(/^(---|\*\*\*|___)$/gm, '<hr style="border:none; border-top:1px solid var(--border); margin:16px 0;">')
    // Paragraph breaks (double newline) → spacer
    .replace(/\n\n/g, '<div style="height:8px;"></div>')
    // Single newlines → line break
    .replace(/\n/g, '<br>');
}

async function generateBriefing() {
  const resultDiv = document.getElementById('briefing-result');
  const btn = document.getElementById('briefing-btn');
  const stopBtn = document.getElementById('briefing-stop-btn');
  const style = document.getElementById('briefing-style').value;
  const focus = document.getElementById('briefing-focus').value.trim();

  btn.textContent = 'ANALYZING...';
  btn.style.opacity = '0.6';
  btn.disabled = true;
  if (stopBtn) { stopBtn.style.display = 'inline-block'; }

  resultDiv.innerHTML =
    '<div style="text-align:center; padding:40px;">' +
    '<div style="font-family:var(--font-title); font-size:14px; color:var(--amber); letter-spacing:4px; margin-bottom:16px; animation:blink 1s infinite;">AEGIS INTELLIGENCE ENGINE ACTIVE</div>' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">COLLECTING THREAT DATA...</div>' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">CORRELATING CVE DATABASE...</div>' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">ENGAGING AI ANALYST...</div>' +
    '<div style="width:200px; height:4px; background:var(--bg-secondary); border-radius:2px; margin:16px auto;"><div style="height:4px; background:var(--amber); border-radius:2px; animation:loadingBar 2s ease-in-out infinite;"></div></div>' +
    '</div>';

  if (typeof playBriefingStart === 'function' && isSoundEnabled('briefing')) playBriefingStart();

  // Add loading bar animation to CSS
  const style_el = document.createElement('style');
  style_el.textContent = '@keyframes loadingBar { 0% { width: 0%; } 50% { width: 100%; } 100% { width: 0%; } }';
  document.head.appendChild(style_el);

  // Gather CVE data
  let cveContext = '';
  if (allCVEs && allCVEs.length > 0) {
    const top10 = allCVEs.slice(0, 10);
    cveContext = 'Current CVE Feed (' + top10.length + ' vulnerabilities):\n' +
      top10.map(function(cve) {
        return '- ' + cve.id + ' [' + cve.severity + ' ' + (cve.score ? cve.score.toFixed(1) : 'N/A') + '] ' + cve.desc.slice(0, 150);
      }).join('\n');
  } else {
    cveContext = 'No CVE data currently loaded. Generate a general threat intelligence briefing based on current cybersecurity trends.';
  }

  const stylePrompts = {
    analyst: 'Write as a senior SOC analyst giving a daily threat briefing to the security team. Use professional but clear language.',
    executive: 'Write as a CISO giving an executive briefing to board members. Focus on business risk and impact. Keep it concise and non-technical.',
    technical: 'Write as a senior threat intelligence engineer. Include technical details, attack vectors, CVE specifics, and mitigation techniques.',
    incident: 'Write as an incident response lead. Focus on immediate threats, prioritized response actions, and what to watch for today.'
  };

  const focusInstruction = focus ? 'Pay special attention to: ' + focus + '.' : '';

  const nowDate = new Date();
  const dateStr = nowDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
    ' ' + nowDate.getUTCHours().toString().padStart(2, '0') + ':' + nowDate.getUTCMinutes().toString().padStart(2, '0') + ' UTC';
  const prompt = 'You are a cybersecurity intelligence analyst for Aegis Security Dashboard. Today\'s date is ' + dateStr + '. ' +
    stylePrompts[style] + ' ' + focusInstruction + '\n\n' +
    'Based on the following threat data, generate a professional intelligence briefing:\n\n' +
    cveContext + '\n\n' +
    'Your briefing MUST include these sections:\n' +
    '1. THREAT LEVEL: (assign one of: LOW / ELEVATED / HIGH / CRITICAL based on the data)\n' +
    '2. EXECUTIVE SUMMARY: (2-3 sentences overview)\n' +
    '3. KEY FINDINGS: (3-5 bullet points of most important threats)\n' +
    '4. CRITICAL VULNERABILITIES: (highlight the most dangerous CVEs)\n' +
    '5. RECOMMENDED ACTIONS: (3-5 specific actionable steps)\n' +
    '6. ANALYST NOTE: (one final insight or warning)\n\n' +
    'Keep the total briefing under 500 words. Write in a professional, authoritative tone.';

  briefingAbortController = new AbortController();
  try {
    const response = await fetch('https://aegis-proxy.ka-mixalis99.workers.dev/?url=' + encodeURIComponent('https://api.anthropic.com/v1/messages'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: briefingAbortController.signal
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const briefingText = data.content[0].text;
    const timestamp = new Date().toUTCString();

    // Parse threat level using case-insensitive regex
    let threatLevel = 'ELEVATED';
    let threatLevelColor = '#f59e0b';
    if (/THREAT LEVEL:?\s*CRITICAL/i.test(briefingText)) { threatLevel = 'CRITICAL'; threatLevelColor = '#ef4444'; }
    else if (/THREAT LEVEL:?\s*HIGH/i.test(briefingText)) { threatLevel = 'HIGH'; threatLevelColor = '#f97316'; }
    else if (/THREAT LEVEL:?\s*LOW/i.test(briefingText)) { threatLevel = 'LOW'; threatLevelColor = '#84cc16'; }
    else if (/THREAT LEVEL:?\s*ELEVATED/i.test(briefingText)) { threatLevel = 'ELEVATED'; threatLevelColor = '#f59e0b'; }

    const formattedText = renderBriefingMarkdown(briefingText);

    resultDiv.innerHTML =
      '<div id="briefing-report" style="background:var(--bg-card); border:1px solid var(--border); border-radius:4px; padding:28px; position:relative;">' +
      '<div style="position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(to right, transparent, ' + threatLevelColor + ', transparent);"></div>' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px;">' +
      '<div>' +
      '<div style="font-family:var(--font-title); font-size:18px; color:var(--amber); letter-spacing:3px; margin-bottom:6px;">AEGIS INTELLIGENCE BRIEFING</div>' +
      '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">Generated: ' + timestamp + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">Style: ' + style.toUpperCase() + (focus ? ' | Focus: ' + focus : '') + '</div>' +
      '</div>' +
      '<div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">' +
      '<div style="background:' + threatLevelColor + '; color:#020818; font-family:var(--font-title); font-size:13px; font-weight:900; padding:8px 20px; border-radius:3px; letter-spacing:2px;">&#9888; ' + threatLevel + '</div>' +
      '<div style="display:flex; gap:8px;">' +
      '<button onclick="copyBriefing()" class="aegis-btn" style="font-size:11px; padding:6px 14px;">COPY</button>' +
      '<button onclick="exportBriefingPDF()" class="aegis-btn" style="font-size:11px; padding:6px 14px; border-color:#a78bfa; color:#a78bfa;">&#11015; PDF</button>' +
      '</div></div></div>' +
      '<div style="font-family:var(--font-mono); font-size:14px; color:var(--text-primary); line-height:1.8; border-top:1px solid var(--border); padding-top:20px;">' +
      formattedText +
      '</div></div>';

    briefingHistory.unshift({ timestamp, threatLevel, threatLevelColor, style, focus, text: briefingText });
    if (briefingHistory.length > 3) briefingHistory.pop();
    renderBriefingHistory();
    if (typeof playBriefingComplete === 'function' && isSoundEnabled('briefing')) playBriefingComplete();

  } catch (error) {
    if (error.name === 'AbortError') {
      resultDiv.innerHTML = '<p class="placeholder-text">Briefing generation cancelled.</p>';
    } else {
      resultDiv.innerHTML =
        '<div class="breach-card" style="border-left-color:#ef4444;">' +
        '<div class="breach-name" style="color:#ef4444;">BRIEFING GENERATION FAILED</div>' +
        '<div class="breach-detail" style="margin-top:8px;">Error: ' + error.message + '</div>' +
        '</div>';
    }
  }

  briefingAbortController = null;
  btn.textContent = '&#9889; GENERATE BRIEFING';
  btn.style.opacity = '1';
  btn.disabled = false;
  if (stopBtn) stopBtn.style.display = 'none';
}

function copyBriefing() {
  const report = document.getElementById('briefing-report');
  if (!report) return;
  navigator.clipboard.writeText(report.innerText).then(function() {
    const btn = event.target;
    btn.textContent = '? COPIED';
    btn.style.color = '#10b981';
    btn.style.borderColor = '#10b981';
    setTimeout(function() { btn.textContent = 'COPY'; btn.style.color = ''; btn.style.borderColor = ''; }, 2000);
  });
}

function exportBriefingPDF() {
  const report = document.getElementById('briefing-report');
  if (!report) return;
  const printWindow = window.open('', '_blank');
  printWindow.document.write('<html><head><title>Aegis Intelligence Briefing</title><style>body{background:#020818;color:#e2e8f0;font-family:Courier New,monospace;padding:40px;}h1{color:#f59e0b;font-size:20px;letter-spacing:4px;border-bottom:1px solid #f59e0b;padding-bottom:12px;margin-bottom:24px;}.footer{margin-top:40px;border-top:1px solid #1e2d4a;padding-top:12px;color:#64748b;font-size:11px;}</style></head><body><h1>AEGIS INTELLIGENCE BRIEFING</h1><div>' + report.innerText.replace(/\n/g, '<br>') + '</div><div class="footer">Generated by Aegis Security Intelligence Dashboard</div></body></html>');
  printWindow.document.close();
  setTimeout(function() { printWindow.print(); }, 500);
}

function stripMarkdownToText(text) {
  return text
    .replace(/\[Current Date\]/gi, '')
    .replace(/\[Date\]/gi, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-*•►]\s*/gm, '')
    .replace(/►/g, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^--[-]+$/gm, '')
    .replace(/--+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

function renderBriefingHistory() {
  const histSection = document.getElementById('briefing-history-section');
  const histDiv = document.getElementById('briefing-history');
  if (!histSection || !histDiv) return;
  if (briefingHistory.length === 0) { histSection.style.display = 'none'; return; }
  histSection.style.display = 'block';
  histDiv.innerHTML = briefingHistory.map(function(b, i) {
    return '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ' + b.threatLevelColor + '; border-radius:3px; padding:16px; margin-bottom:12px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
      '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim);">' + b.timestamp + '</div>' +
      '<div style="background:' + b.threatLevelColor + '; color:#020818; font-family:var(--font-mono); font-size:11px; font-weight:bold; padding:3px 10px; border-radius:2px;">' + b.threatLevel + '</div>' +
      '</div>' +
      '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim);">Style: ' + b.style.toUpperCase() + (b.focus ? ' | Focus: ' + b.focus : '') + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-primary); margin-top:8px; line-height:1.6;">' + stripMarkdownToText(b.text).slice(0, 200) + '...</div>' +
      '</div>';
  }).join('');
}

function clearBriefingHistory() {
  const histDiv = document.getElementById('briefing-history');
  if (!histDiv) return;

  if (briefingHistory.length === 0) {
    histDiv.innerHTML = '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); padding:12px 0;">No history to clear.</div>';
    setTimeout(function() { renderBriefingHistory(); }, 2000);
    return;
  }

  histDiv.innerHTML =
    '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid var(--amber); border-radius:3px; padding:20px;">' +
    '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-primary); margin-bottom:16px; line-height:1.6;">Are you sure you want to clear all briefing history?<br><span style="color:var(--text-dim);">This cannot be undone.</span></div>' +
    '<div style="display:flex; gap:10px;">' +
    '<button onclick="confirmClearBriefings()" class="aegis-btn" style="font-size:12px; padding:8px 20px; border-color:#ef4444; color:#ef4444;">CONFIRM</button>' +
    '<button onclick="renderBriefingHistory()" class="aegis-btn" style="font-size:12px; padding:8px 20px; border-color:#1e2d4a; color:#64748b;">CANCEL</button>' +
    '</div></div>';
}

async function confirmClearBriefings() {
  const histDiv = document.getElementById('briefing-history');
  const histSection = document.getElementById('briefing-history-section');
  try {
    if (window.aegis) await window.aegis.clearBriefings();
    briefingHistory = [];
    histDiv.innerHTML =
      '<div style="font-family:var(--font-mono); font-size:13px; color:#10b981; padding:14px 0; letter-spacing:1px;">&#10003; Briefing history cleared.</div>';
    setTimeout(function() {
      if (histSection) histSection.style.display = 'none';
    }, 2000);
  } catch (e) {
    histDiv.innerHTML = '<div style="font-family:var(--font-mono); font-size:13px; color:#ef4444; padding:12px 0;">Error clearing history. Please try again.</div>';
    setTimeout(function() { renderBriefingHistory(); }, 2000);
  }
}

// ============================================================
// SECURITY NEWS HEADLINES � FULL EDITION
// ============================================================
const NEWS_CATEGORIES = {
  'ransomware': { label: 'RANSOMWARE', color: '#ef4444' },
  'malware': { label: 'MALWARE', color: '#ef4444' },
  'breach': { label: 'BREACH', color: '#ef4444' },
  'hack': { label: 'HACK', color: '#f97316' },
  'phishing': { label: 'PHISHING', color: '#f97316' },
  'vulnerability': { label: 'VULNERABILITY', color: '#f59e0b' },
  'exploit': { label: 'EXPLOIT', color: '#f59e0b' },
  'zero-day': { label: 'ZERO-DAY', color: '#ef4444' },
  'patch': { label: 'PATCH', color: '#84cc16' },
  'update': { label: 'UPDATE', color: '#84cc16' },
  'arrest': { label: 'ARREST', color: '#a78bfa' },
  'botnet': { label: 'BOTNET', color: '#f97316' },
  'spyware': { label: 'SPYWARE', color: '#ef4444' },
  'ddos': { label: 'DDOS', color: '#f97316' },
  'data leak': { label: 'DATA LEAK', color: '#ef4444' },
  'critical': { label: 'CRITICAL', color: '#ef4444' },
  'apt': { label: 'APT', color: '#ef4444' },
  'nation-state': { label: 'NATION-STATE', color: '#a78bfa' }
};

function getNewsCategories(text) {
  const lower = text.toLowerCase();
  const found = [];
  Object.keys(NEWS_CATEGORIES).forEach(function(key) {
    if (lower.includes(key) && found.length < 3) {
      found.push(NEWS_CATEGORIES[key]);
    }
  });
  return found;
}

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return date.toLocaleDateString();
}

// ─── NEWS IMAGE HELPERS ───────────────────────────────────────
function extractNewsImage(item) {
  if (item.enclosure) {
    const u = item.enclosure.link || item.enclosure.url || '';
    if (u && (item.enclosure.type || '').startsWith('image/')) return u;
    if (u && /\.(jpe?g|png|gif|webp)(\?|$)/i.test(u)) return u;
  }
  if (item.thumbnail && typeof item.thumbnail === 'string' && item.thumbnail !== '') return item.thumbnail;
  if (item['media:thumbnail']) return item['media:thumbnail'];
  if (item.image && typeof item.image === 'string' && item.image !== '') return item.image;
  return null;
}

function newsCategoryIcon(title, desc) {
  const t = (title + ' ' + (desc || '')).toLowerCase();
  if (/malware|trojan|worm|spyware/.test(t))         return '&#9763;';
  if (/ransomware/.test(t))                           return '&#9632;';
  if (/critical|zero.day|apt|nation.state/.test(t))  return '&#9650;';
  if (/breach|leak|expos|stolen/.test(t))             return '&#9888;';
  if (/exploit|vulnerability|cve/.test(t))            return '&#9889;';
  if (/patch|update|fix/.test(t))                     return '&#9670;';
  return '&#9679;';
}

function newsThumbHTML(thumbnail, icon, size) {
  const s   = size || 80;
  const fs  = Math.round(s * 0.40);
  const phStyle = 'width:' + s + 'px; height:' + s + 'px; background:#060d1f; ' +
    'border:1px solid rgba(245,158,11,0.25); border-radius:4px; ' +
    'display:flex; align-items:center; justify-content:center; ' +
    'font-size:' + fs + 'px; color:#f59e0b; flex-shrink:0;';
  if (!thumbnail) {
    return '';
  }
  return '<img src="' + thumbnail.replace(/"/g, '%22') + '" ' +
    'data-ph-icon="' + icon + '" data-ph-size="' + s + '" ' +
    'width="' + s + '" height="' + s + '" ' +
    'style="object-fit:cover; border-radius:4px; ' +
    'border:1px solid rgba(245,158,11,0.3); flex-shrink:0; display:block;" ' +
    'onerror="newsImgError(this)">';
}

function newsImgError(img) {
  const icon = img.getAttribute('data-ph-icon') || '&#9679;';
  const size = parseInt(img.getAttribute('data-ph-size')) || 80;
  const fs   = Math.round(size * 0.40);
  const div  = document.createElement('div');
  div.style.cssText = 'width:' + size + 'px; height:' + size + 'px; background:#060d1f; ' +
    'border:1px solid rgba(245,158,11,0.25); border-radius:4px; ' +
    'display:flex; align-items:center; justify-content:center; ' +
    'font-size:' + fs + 'px; color:#f59e0b; flex-shrink:0;';
  div.innerHTML = icon;
  img.parentNode.replaceChild(div, img);
}

let allNews = [];
let newsSearchTerm = '';

function renderNewsList() {
  const resultDiv = document.getElementById('news-result');
  let filtered = allNews.filter(function(item) {
    return newsSearchTerm === '' ||
      item.title.toLowerCase().includes(newsSearchTerm) ||
      item.source.toLowerCase().includes(newsSearchTerm);
  });

  if (filtered.length === 0) {
    resultDiv.innerHTML = '<p class="placeholder-text">No headlines match your search.</p>';
    return;
  }

  const searchBar = '';

  const lastUpdated = '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-bottom:16px;">LAST UPDATED: ' + new Date().toUTCString() + ' | ' + allNews.length + ' HEADLINES LOADED</div>';

  const newsCards = filtered.map(function(item) {
    const categories = getNewsCategories(item.title + ' ' + item.description);
    const categoryBadges = categories.map(function(cat) {
      return '<span style="background:rgba(0,0,0,0.3); border:1px solid ' + cat.color + '; color:' + cat.color + '; font-family:var(--font-mono); font-size:12px; padding:4px 12px; border-radius:2px; margin-right:6px; margin-top:4px;">' + cat.label + '</span>';
    }).join('');

    const borderColor = categories.length > 0 ? categories[0].color : 'var(--border)';
    const icon  = newsCategoryIcon(item.title, item.description);
    const thumb = newsThumbHTML(item.thumbnail, icon, 80);

    return '<a href="' + item.link + '" target="_blank" style="text-decoration:none;">' +
      '<div style="background:#0f1a2e; border:1px solid #1e2d4a; border-left:3px solid ' + borderColor + '; border-radius:3px; padding:16px 20px; margin-bottom:16px; transition:all 0.2s; cursor:pointer;" onmouseover="this.style.background=\'#0d1829\'; this.style.borderColor=\'var(--amber)\'" onmouseout="this.style.background=\'#0f1a2e\'; this.style.borderColor=\'#1e2d4a\'">' +
      '<div style="display:flex; gap:14px; align-items:flex-start;">' +
      thumb +
      '<div style="flex:1; min-width:0;">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:12px;">' +
      '<div style="font-family:var(--font-ui); font-size:16px; color:#cbd5e1; font-weight:600; line-height:1.5; flex:1;">' + item.title + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); white-space:nowrap;">' + timeAgo(item.pubDate) + '</div>' +
      '</div>' +
      '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">' +
      '<div style="font-family:var(--font-mono); font-size:13px; color:var(--amber);">&#9658; ' + item.source + '</div>' +
      categoryBadges +
      '</div>' +
      (item.description ? '<div style="font-family:var(--font-ui); font-size:14px; color:#94a3b8; margin-top:10px; line-height:1.8;">' + item.description.slice(0, 150) + (item.description.length > 150 ? '...' : '') + '</div>' : '') +
      '</div>' +
      '</div>' +
      '</div></a>';
  }).join('');

  resultDiv.innerHTML = searchBar + lastUpdated + newsCards;
}

function searchNews(term) {
  newsSearchTerm = term.toLowerCase();
  renderNewsList();
}

async function loadSecurityNews() {
  const resultDiv = document.getElementById('news-result');
  resultDiv.innerHTML = '<p class="loading">LOADING SECURITY HEADLINES...</p>';
  allNews = [];
  newsSearchTerm = '';

  const feeds = [
    { url: 'https://feeds.feedburner.com/TheHackersNews', source: 'The Hacker News' },
    { url: 'https://www.bleepingcomputer.com/feed/', source: 'BleepingComputer' },
    { url: 'https://www.darkreading.com/rss.xml', source: 'Dark Reading' }
  ];

  const proxyBase = 'https://api.rss2json.com/v1/api.json?rss_url=';

  try {
    const results = await Promise.allSettled(feeds.map(function(feed) {
      return fetch(proxyBase + encodeURIComponent(feed.url))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.status === 'ok' && data.items) {
            return data.items.slice(0, 8).map(function(item) {
              return {
                title: item.title || 'No title',
                link: item.link || '#',
                pubDate: item.pubDate || new Date().toISOString(),
                description: item.description ? item.description.replace(/<[^>]*>/g, '').trim() : '',
                source: feed.source,
                thumbnail: extractNewsImage(item)
              };
            });
          }
          return [];
        });
    }));

    results.forEach(function(result) {
      if (result.status === 'fulfilled') {
        allNews = allNews.concat(result.value);
      }
    });

    allNews.sort(function(a, b) { return new Date(b.pubDate) - new Date(a.pubDate); });

    if (allNews.length === 0) {
      resultDiv.innerHTML = '<p class="placeholder-text">Could not load news feeds. Try again later.</p>';
      return;
    }

    renderNewsList();

  } catch (error) {
    resultDiv.innerHTML = '<p class="placeholder-text">Error loading news: ' + error.message + '</p>';
  }
}

// Auto-load news when page is visited
document.querySelectorAll('.nav-item').forEach(function(item) {
  item.addEventListener('click', function() {
    if (item.dataset.page === 'news') {
      setTimeout(loadSecurityNews, 100);
    }
  });
});









// ============================================================
// NETWORK MONITOR
// ============================================================
let networkMonitorInterval = null;
let lastPublicIP = null;
let lastPortScanResults = null;

async function runNetworkScan() {
  const resultDiv = document.getElementById('network-result');
  resultDiv.innerHTML = '<p class="loading">SCANNING NETWORK...</p>';

  const [ipData, latencyData, portData] = await Promise.all([
    checkPublicIP(),
    checkLatency(),
    scanLocalPorts()
  ]);

  const dnsData = await checkDNSLeak(ipData);

  renderNetworkResults(ipData, dnsData, latencyData, portData);

  // Start auto-refresh every 5 minutes
  if (networkMonitorInterval) clearInterval(networkMonitorInterval);
  networkMonitorInterval = setInterval(async function() {
    const newIPData = await checkPublicIP();
    if (lastPublicIP && newIPData.ip && newIPData.ip !== lastPublicIP) {
      showIPChangeAlert(lastPublicIP, newIPData.ip);
    }
    lastPublicIP = newIPData.ip;
  }, 300000);
}

async function checkPublicIP() {
  try {
    const response = await fetch('https://api64.ipify.org?format=json');
    const ipJson = await response.json();
    const ip = ipJson.ip;
    lastPublicIP = ip;

    const geoResponse = await fetch('https://aegis-proxy.ka-mixalis99.workers.dev/?url=' + encodeURIComponent('https://ipwho.is/' + ip));
    const geo = await geoResponse.json();

    return {
      ip: ip,
      country: geo.country || 'Unknown',
      countryCode: geo.countryCode || '',
      city: geo.city || 'Unknown',
      isp: geo.isp || 'Unknown',
      isVPN: geo.proxy || geo.hosting || false,
      success: true
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Returns true for any IP that is private/link-local and should never trigger a leak warning
function isPrivateIP(ip) {
  const lower = ip.toLowerCase();
  return (
    /^10\./.test(ip) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^127\./.test(ip) ||
    /^169\.254\./.test(ip) ||       // IPv4 link-local
    /^::1$/.test(ip) ||             // IPv6 loopback
    /^fe80:/i.test(ip) ||           // IPv6 link-local
    /^fc[0-9a-f]{2}:/i.test(ip) ||  // IPv6 ULA fc00::/7
    /^fd[0-9a-f]{2}:/i.test(ip) ||  // IPv6 ULA fd00::/8
    /^::ffff:/i.test(lower)          // IPv4-mapped IPv6
  );
}

async function scanLocalPorts() {
  try {
    if (!window.aegis || !window.aegis.scanLocalPorts) return { success: false, ports: [] };
    const ports = await window.aegis.scanLocalPorts();
    return { success: true, ports: ports };
  } catch (e) {
    return { success: false, ports: [] };
  }
}

async function checkDNSLeak(ipData) {
  try {
    const response = await fetch('https://dns.google/resolve?name=whoami.akamai.net&type=A');
    const data = await response.json();
    const dnsIP = data.Answer ? data.Answer[0].data : null;
    const isLeaking = false;
    return { dnsIP: dnsIP, isLeaking: isLeaking, success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function checkLatency() {
  const servers = [
    { name: 'Google', url: 'https://www.google.com/favicon.ico' },
    { name: 'Cloudflare', url: 'https://1.1.1.1/favicon.ico' },
    { name: 'Microsoft', url: 'https://www.microsoft.com/favicon.ico' }
  ];

  const results = await Promise.all(servers.map(async function(server) {
    try {
      const start = Date.now();
      await fetch(server.url + '?_=' + Date.now(), { mode: 'no-cors', cache: 'no-store' });
      const latency = Date.now() - start;
      return { name: server.name, latency: latency, success: true };
    } catch (e) {
      return { name: server.name, latency: null, success: false };
    }
  }));

  return results;
}

function getLatencyColor(ms) {
  if (ms === null) return '#ef4444';
  if (ms < 100) return '#10b981';
  if (ms < 300) return '#f59e0b';
  return '#ef4444';
}

function getLatencyLabel(ms) {
  if (ms === null) return 'UNREACHABLE';
  if (ms < 100) return 'EXCELLENT';
  if (ms < 300) return 'GOOD';
  return 'SLOW';
}

function showIPChangeAlert(oldIP, newIP) {
  const alert = document.createElement('div');
  alert.style.cssText = 'position:fixed; top:20px; right:20px; background:#0d1526; border:1px solid #ef4444; border-radius:4px; padding:16px 20px; font-family:var(--font-mono); font-size:13px; color:#ef4444; z-index:9999; box-shadow:0 0 20px rgba(239,68,68,0.3);';
  alert.innerHTML = '? IP ADDRESS CHANGED<br><span style="color:var(--text-dim); font-size:11px;">Previous: ' + oldIP + '<br>Current: ' + newIP + '</span>';
  document.body.appendChild(alert);
  setTimeout(function() { alert.remove(); }, 8000);
}

function renderNetworkResults(ipData, dnsData, latencyData, portData) {
  const resultDiv = document.getElementById('network-result');

  // VPN STATUS
  const vpnActive = ipData.success && ipData.isVPN;
  const vpnColor = vpnActive ? '#10b981' : '#ef4444';
  const vpnLabel = vpnActive ? '&#9989; VPN ACTIVE' : '&#9888; NO VPN DETECTED';
  const flag = ipData.success ? countryCodeToFlag(ipData.countryCode) : '';


  // DNS
  const dnsLeak = dnsData.success && dnsData.isLeaking;
  const dnsColor = dnsLeak ? '#ef4444' : '#10b981';
  const dnsLabel = dnsLeak ? '&#9888; DNS LEAK' : '&#9989; DNS SECURE';

  resultDiv.innerHTML =
    // VPN STATUS CARD
    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">' +

    '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ' + vpnColor + '; border-radius:3px; padding:20px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:10px;">VPN STATUS</div>' +
    '<div style="font-family:var(--font-title); font-size:16px; color:' + vpnColor + '; margin-bottom:12px;">' + vpnLabel + '</div>' +
    (ipData.success ? '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); line-height:1.8;">IP: <span style="color:var(--text-primary)">' + ipData.ip + '</span><br>LOCATION: <span style="color:var(--text-primary)">' + flag + ' ' + ipData.city + ', ' + ipData.country + '</span><br>ISP: <span style="color:var(--text-primary)">' + ipData.isp + '</span></div>' : '<div style="color:#ef4444; font-family:var(--font-mono); font-size:13px;">Could not detect IP</div>') +
    '</div>' +

    (function() {
      if (!portData.success || portData.ports.length === 0) {
        lastPortScanResults = [];
        return '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid #64748b; border-radius:3px; padding:20px;">' +
          '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:10px;">LOCAL PORT SCAN</div>' +
          '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim);">Port scan unavailable.</div>' +
          '</div>';
      }
      var RED_PORTS = [23, 4444, 6881];
      var openPorts = portData.ports.filter(function(p) { return p.open; });
      lastPortScanResults = openPorts;
      var openCount = openPorts.length;
      var closedCount = portData.ports.length - openCount;
      var hasSuspicious = openPorts.some(function(p) { return RED_PORTS.indexOf(p.port) !== -1; });
      var cardBorder = hasSuspicious ? '#ef4444' : (openCount > 0 ? '#f59e0b' : '#10b981');
      return '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ' + cardBorder + '; border-radius:3px; padding:20px;">' +
        '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">LOCAL PORT SCAN</div>' +
        (hasSuspicious ? '<div style="font-family:var(--font-mono); font-size:12px; color:#ef4444; margin-bottom:8px;">&#9888; SUSPICIOUS PORTS DETECTED</div>' : '') +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
        '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim);">' +
        '<span style="color:' + (openCount > 0 ? '#f59e0b' : '#10b981') + '">' + openCount + ' OPEN</span>' +
        ' &nbsp;·&nbsp; <span style="color:#10b981">' + closedCount + ' CLOSED</span>' +
        '</div>' +
        (openCount > 0 ? '<button onclick="showPortFixAdvice()" class="aegis-btn" style="font-size:11px; padding:5px 12px;">HOW TO FIX &#8594;</button>' : '') +
        '</div>' +
        portData.ports.map(function(p) {
          var isRed = RED_PORTS.indexOf(p.port) !== -1;
          var statusColor = p.open ? (isRed ? '#ef4444' : '#f59e0b') : '#10b981';
          return '<div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px solid rgba(30,45,74,0.4);">' +
            '<span style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); min-width:38px;">' + p.port + '</span>' +
            '<span style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); flex:1; padding-left:4px;">' + p.service + '</span>' +
            '<span style="font-family:var(--font-mono); font-size:11px; color:' + statusColor + '; font-weight:bold;">' + (p.open ? 'OPEN' : 'CLOSED') + '</span>' +
            '</div>';
        }).join('') +
        '<div id="port-fix-panel"></div>' +
        '</div>';
    })() +
    '</div>' +

    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">' +

    '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ' + dnsColor + '; border-radius:3px; padding:20px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:10px;">DNS LEAK TEST</div>' +
    '<div style="font-family:var(--font-title); font-size:16px; color:' + dnsColor + '; margin-bottom:12px;">' + dnsLabel + '</div>' +
    '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); line-height:1.8;">DNS SERVER: <span style="color:var(--text-primary)">' + (dnsData.dnsIP || 'Unknown') + '</span></div>' +
    '</div>' +

    '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid var(--amber); border-radius:3px; padding:20px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:10px;">CONNECTION HEALTH</div>' +
    latencyData.map(function(server) {
      const color = getLatencyColor(server.latency);
      const label = getLatencyLabel(server.latency);
      return '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
        '<span style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim);">' + server.name + '</span>' +
        '<div style="display:flex; align-items:center; gap:8px;">' +
        '<span style="font-family:var(--font-mono); font-size:12px; color:' + color + ';">' + (server.latency ? server.latency + 'ms' : 'N/A') + '</span>' +
        '<span style="background:' + color + '; color:#020818; font-family:var(--font-mono); font-size:10px; padding:2px 8px; border-radius:2px;">' + label + '</span>' +
        '</div></div>';
    }).join('') +
    '</div></div>' +

    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-top:8px;">LAST SCAN: ' + new Date().toUTCString() + ' · AUTO-REFRESH: EVERY 5 MINUTES</div>';
}

async function showPortFixAdvice() {
  const panel = document.getElementById('port-fix-panel');
  if (!panel || !lastPortScanResults || lastPortScanResults.length === 0) return;

  panel.innerHTML =
    '<div style="border-top:1px solid var(--border); margin-top:16px; padding-top:16px;">' +
    '<div style="font-family:var(--font-title); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:12px;">AI REMEDIATION GUIDE</div>' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); margin-bottom:10px;">ANALYZING OPEN PORTS...</div>' +
    '<div style="width:100%; height:3px; background:var(--bg-secondary); border-radius:2px;"><div style="height:3px; background:var(--amber); border-radius:2px; animation:loadingBar 2s ease-in-out infinite;"></div></div>' +
    '</div>';

  const prompt =
    'You are a cybersecurity assistant helping a user secure their local machine.\n\n' +
    'The following ports were found OPEN on localhost:\n\n' +
    lastPortScanResults.map(function(p) { return '- Port ' + p.port + ' (' + p.service + ')'; }).join('\n') +
    '\n\nFor EACH open port provide:\n' +
    '1. What this service does and why it might be running\n' +
    '2. The security risk — what an attacker could exploit\n' +
    '3. Step-by-step instructions to close or disable it on:\n' +
    '   - **Windows** (service names, commands)\n' +
    '   - **macOS** (launchctl or System Settings steps)\n' +
    '   - **Linux** (systemctl or iptables commands)\n\n' +
    'Use ## Port NNN (ServiceName) as a heading for each port. Be concise but complete.';

  try {
    const response = await fetch('https://aegis-proxy.ka-mixalis99.workers.dev/?url=' + encodeURIComponent('https://api.anthropic.com/v1/messages'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.content[0].text;

    panel.innerHTML =
      '<div style="border-top:1px solid var(--border); margin-top:16px; padding-top:16px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">' +
      '<div style="font-family:var(--font-title); font-size:12px; color:var(--amber); letter-spacing:2px;">AI REMEDIATION GUIDE</div>' +
      '<button onclick="document.getElementById(\'port-fix-panel\').innerHTML = \'\'" class="aegis-btn" style="font-size:11px; padding:4px 12px; border-color:#ef4444; color:#ef4444;">&#10005; CLOSE</button>' +
      '</div>' +
      '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-primary); line-height:1.8;">' +
      renderBriefingMarkdown(text) +
      '</div></div>';

  } catch (e) {
    panel.innerHTML =
      '<div style="border-top:1px solid var(--border); margin-top:16px; padding-top:16px;">' +
      '<div style="font-family:var(--font-mono); font-size:13px; color:#ef4444; margin-bottom:10px;">Error: ' + e.message + '</div>' +
      '<button onclick="document.getElementById(\'port-fix-panel\').innerHTML = \'\'" class="aegis-btn" style="font-size:11px; padding:4px 12px; border-color:#64748b; color:#64748b;">DISMISS</button>' +
      '</div>';
  }
}

// Auto-load network monitor when page is visited
document.querySelectorAll('.nav-item').forEach(function(item) {
  item.addEventListener('click', function() {
    if (item.dataset.page === 'network') {
      setTimeout(runNetworkScan, 100);
    }
  });
});

// ============================================================
// NETWORK DEVICES
// ============================================================
var networkDevicesData = [];

async function scanNetworkDevices() {
  var resultDiv = document.getElementById('network-devices-result');
  if (!resultDiv) return;

  resultDiv.innerHTML =
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:10px;">SCANNING LOCAL NETWORK...</div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-bottom:12px;">Probing all subnet hosts via TCP · This may take 30-60 seconds...</div>' +
    '<div style="width:100%; height:3px; background:var(--bg-secondary); border-radius:2px;"><div style="height:3px; background:#38bdf8; border-radius:2px; animation:loadingBar 2s ease-in-out infinite;"></div></div>';

  try {
    if (!window.aegis || !window.aegis.scanNetworkDevices) {
      resultDiv.innerHTML = '<p class="placeholder-text">Network scan not available — requires Electron context.</p>';
      return;
    }
    var result = await window.aegis.scanNetworkDevices();
    if (!result.success) {
      resultDiv.innerHTML = '<div style="font-family:var(--font-mono); font-size:13px; color:#ef4444;">Scan failed: ' + (result.error || 'Unknown error') + '</div>';
      return;
    }
    networkDevicesData = result.devices;
    renderNetworkDevices(result);
  } catch (e) {
    resultDiv.innerHTML = '<div style="font-family:var(--font-mono); font-size:13px; color:#ef4444;">Error: ' + e.message + '</div>';
  }
}

async function lookupMACVendor(mac) {
  if (!mac || mac.length < 8) return '';
  try {
    var resp = await fetch('https://api.macvendors.com/' + encodeURIComponent(mac), {
      signal: AbortSignal.timeout(4000)
    });
    if (!resp.ok) return '';
    var text = await resp.text();
    return text.trim().substring(0, 32);
  } catch (_) { return ''; }
}

function renderNetworkDevices(result) {
  var resultDiv = document.getElementById('network-devices-result');
  if (!resultDiv) return;
  var devices = result.devices || [];

  if (devices.length === 0) {
    resultDiv.innerHTML = '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim);">No devices found on local network.</div>';
    return;
  }

  var html =
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-bottom:14px;">' +
    'SUBNET: <span style="color:#38bdf8">' + (result.subnet || '') + '</span>' +
    ' &nbsp;&middot;&nbsp; GATEWAY: <span style="color:#a78bfa">' + (result.gatewayIP || '') + '</span>' +
    ' &nbsp;&middot;&nbsp; DEVICES FOUND: <span style="color:#10b981">' + devices.length + '</span>' +
    '</div>' +
    '<div style="overflow-x:auto;">' +
    '<table style="width:100%; border-collapse:collapse; font-family:var(--font-mono); font-size:12px;">' +
    '<thead><tr style="border-bottom:1px solid var(--border);">' +
    '<th style="text-align:left; padding:8px 10px; color:var(--text-dim); letter-spacing:1px; font-weight:normal; font-size:11px;">IP ADDRESS</th>' +
    '<th style="text-align:left; padding:8px 10px; color:var(--text-dim); letter-spacing:1px; font-weight:normal; font-size:11px;">HOSTNAME</th>' +
    '<th style="text-align:left; padding:8px 10px; color:var(--text-dim); letter-spacing:1px; font-weight:normal; font-size:11px;">MAC ADDRESS</th>' +
    '<th style="text-align:left; padding:8px 10px; color:var(--text-dim); letter-spacing:1px; font-weight:normal; font-size:11px;">MANUFACTURER</th>' +
    '<th style="text-align:left; padding:8px 10px; color:var(--text-dim); letter-spacing:1px; font-weight:normal; font-size:11px;">STATUS</th>' +
    '<th style="text-align:left; padding:8px 10px; color:var(--text-dim); letter-spacing:1px; font-weight:normal; font-size:11px;">ACTIONS</th>' +
    '</tr></thead><tbody>';

  devices.forEach(function(d, i) {
    var rowBg = d.isOwnDevice
      ? 'rgba(56,189,248,0.06)'
      : (i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)');
    var ipColor = d.isOwnDevice ? '#38bdf8' : (d.isGateway ? '#a78bfa' : 'var(--text-primary)');

    html += '<tr id="nd-row-' + i + '" style="border-bottom:1px solid rgba(30,45,74,0.3); background:' + rowBg + ';">';

    // IP + badge
    html += '<td style="padding:10px; color:' + ipColor + ';">' + d.ip;
    if (d.isOwnDevice) {
      html += ' <span style="border:1px solid #38bdf8; color:#38bdf8; font-size:9px; padding:1px 5px; border-radius:2px; vertical-align:middle; margin-left:4px;">THIS DEVICE</span>';
    } else if (d.isGateway) {
      html += ' <span style="border:1px solid #a78bfa; color:#a78bfa; font-size:9px; padding:1px 5px; border-radius:2px; vertical-align:middle; margin-left:4px;">ROUTER</span>';
    }
    html += '</td>';

    // Hostname
    html += '<td style="padding:10px; color:var(--text-primary); font-size:11px;">' +
      (d.hostname || '<span style="color:var(--text-dim)">—</span>') + '</td>';

    // MAC
    html += '<td style="padding:10px; color:var(--text-dim); font-size:11px;">' +
      (d.mac || '<span style="color:#f59e0b;">—</span>') + '</td>';

    // Manufacturer (loaded async)
    html += '<td id="nd-mfr-' + i + '" style="padding:10px; font-size:11px;">' +
      (d.mac
        ? '<span style="color:var(--text-dim);">Looking up...</span>'
        : '<span style="color:var(--text-dim);">—</span>') +
      '</td>';

    // Status
    html += '<td style="padding:10px;"><span style="color:#10b981; font-weight:bold; font-size:11px;">&#9679; ACTIVE</span></td>';

    // Actions
    if (d.isOwnDevice) {
      html += '<td style="padding:10px;"><span style="color:var(--text-dim); font-size:11px;">—</span></td>';
    } else {
      html += '<td style="padding:10px;"><div style="display:flex; gap:6px; flex-wrap:wrap;">' +
        '<button onclick="confirmBlockDevice(\'' + d.ip + '\')" class="aegis-btn" style="font-size:10px; padding:4px 10px; border-color:#ef4444; color:#ef4444;">BLOCK</button>';
      if (d.isGateway) {
        html += '<button onclick="openRouterPanel(\'' + d.ip + '\')" class="aegis-btn" style="font-size:10px; padding:4px 10px; border-color:#a78bfa; color:#a78bfa;">ROUTER</button>';
      }
      html += '</div></td>';
    }

    html += '</tr>';
  });

  html += '</tbody></table></div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-top:12px;">SCAN COMPLETED: ' + new Date().toUTCString() + '</div>' +
    '<div style="margin-top:14px; padding:10px 14px; border-left:3px solid var(--amber); background:rgba(245,158,11,0.04); font-family:var(--font-mono); font-size:11px; color:var(--text-dim); line-height:1.7;">' +
    '&#9432; iOS devices may not appear if Private WiFi Address is enabled. ' +
    'To show iPhone/iPad: Settings &#8594; WiFi &#8594; tap your network &#8594; disable Private WiFi Address.' +
    '</div>';

  resultDiv.innerHTML = html;

  // Load manufacturer info asynchronously after table is in the DOM
  devices.forEach(function(d, i) {
    if (!d.mac) return;
    lookupMACVendor(d.mac).then(function(vendor) {
      var cell = document.getElementById('nd-mfr-' + i);
      if (!cell) return;
      cell.innerHTML = vendor
        ? '<span style="color:var(--text-primary);">' + vendor + '</span>'
        : '<span style="color:var(--text-dim);">Unknown</span>';
    });
  });
}

async function confirmBlockDevice(ip) {
  if (!confirm('Block all inbound traffic from ' + ip + '?\n\nThis adds a Windows Firewall rule. Requires Aegis to be running as Administrator.')) return;
  await blockDevice(ip);
}

async function blockDevice(ip) {
  try {
    if (!window.aegis || !window.aegis.blockDevice) { alert('Block not available.'); return; }
    var result = await window.aegis.blockDevice(ip);
    if (result.success) {
      // Dim the blocked row and replace its action cell
      var rows = document.querySelectorAll('#network-devices-result tbody tr');
      rows.forEach(function(row) {
        if (row.innerText.indexOf(ip) !== -1) {
          row.style.opacity = '0.45';
          var cells = row.querySelectorAll('td');
          if (cells.length > 0) {
            cells[cells.length - 1].innerHTML =
              '<span style="color:#ef4444; font-family:var(--font-mono); font-size:11px;">&#9632; BLOCKED</span>';
          }
        }
      });
    } else {
      alert('Block failed: ' + (result.error || 'Unknown error') +
        '\n\nTip: Right-click the Aegis shortcut and choose "Run as administrator".');
    }
  } catch (e) {
    alert('Block failed: ' + e.message);
  }
}

async function unblockAllDevices() {
  if (!confirm('Remove all Aegis firewall block rules?\n\nThis will restore traffic from all previously blocked devices.')) return;
  try {
    if (!window.aegis || !window.aegis.unblockAllDevices) { alert('Unblock not available.'); return; }
    var result = await window.aegis.unblockAllDevices();
    if (result.success) {
      alert('All Aegis firewall rules removed.');
      if (networkDevicesData.length > 0) {
        renderNetworkDevices({ devices: networkDevicesData, subnet: '', gatewayIP: '' });
      }
    } else {
      alert('Unblock failed: ' + (result.error || 'Unknown error') +
        '\n\nTip: Run Aegis as administrator.');
    }
  } catch (e) {
    alert('Unblock failed: ' + e.message);
  }
}

async function openRouterPanel(ip) {
  var target = ip;
  if (!target && window.aegis && window.aegis.getGatewayIP) {
    target = await window.aegis.getGatewayIP();
  }
  if (!target) { alert('Could not detect router IP.'); return; }
  if (window.aegis && window.aegis.openExternal) {
    window.aegis.openExternal('http://' + target);
  }
}





// ============================================================
// DASHBOARD � HOME PAGE
// ============================================================
async function loadDashboard() {
  const dashDiv = document.getElementById('dashboard-content');
  if (!dashDiv) return;

  dashDiv.innerHTML = '<p class="loading">LOADING AEGIS DASHBOARD...</p>';

  // Load News and IP in parallel (CVEs no longer needed on dashboard)
  const [newsData, ipData] = await Promise.all([
    loadDashboardNews(),
    loadDashboardIP()
  ]);
  const cveData = [];

  const threatLevel = calculateThreatLevel(cveData);
  const threatColor = getThreatLevelColor(threatLevel);

  dashDiv.innerHTML =
    // THREAT LEVEL BANNER
    '<div id="threat-banner" style="background:' + threatColor + '18; border:1px solid ' + threatColor + '; border-radius:4px; padding:20px 28px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center;">' +
    '<div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); letter-spacing:3px; margin-bottom:6px;">CURRENT THREAT LEVEL</div>' +
    '<div id="threat-level-text" style="font-family:var(--font-title); font-size:28px; color:' + threatColor + '; letter-spacing:4px;">&#9888; ' + threatLevel + '</div>' +
    '</div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); text-align:right;">LAST UPDATED<br><span style="color:var(--text-primary);">' + new Date().toUTCString() + '</span></div>' +
    '</div>' +

    // STAT CARDS
    '<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px;">' +
    renderStatCard('NEWS HEADLINES', newsData.length, newsData.length > 0 ? '#10b981' : '#64748b', '&#128225;') +
    '<div onclick="openRadarSamplesModal()" title="Click to view radar samples" style="background:var(--bg-card); border:1px solid var(--border); border-top:2px solid #64748b; border-radius:4px; padding:20px; text-align:center; cursor:pointer; transition:border-color 0.2s, box-shadow 0.2s;" onmouseenter="this.style.boxShadow=\'0 0 0 1px rgba(245,158,11,0.3)\'" onmouseleave="this.style.boxShadow=\'none\'">' +
    '<div style="font-size:24px; margin-bottom:8px;">&#9673;</div>' +
    '<div id="stat-radar-value" style="font-family:var(--font-title); font-size:20px; color:#64748b; margin-bottom:6px;">0</div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); letter-spacing:2px;">RADAR SAMPLES</div>' +
    '</div>' +
    renderStatCard('VPN STATUS', ipData.isVPN ? 'ACTIVE' : 'INACTIVE', ipData.isVPN ? '#10b981' : '#f59e0b', ipData.isVPN ? '&#128274;' : '&#9888;') +
    renderStatCard('YOUR IP', ipData.ip || 'Unknown', ipData.isVPN ? '#10b981' : '#f59e0b', '&#127760;') +
    '</div>' +

    // QUICK ACTIONS
    '<div style="margin-bottom:24px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:12px;">QUICK ACTIONS</div>' +
    '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +

    ['password', 'ip', 'cve', 'briefing', 'news', 'network'].map(function(page) {
      const labels = { password: '&#128273; Password Health', ip: '&#127760; IP Investigator', cve: '&#128737; CVE Feed', briefing: '&#129302; AI Briefing', news: '&#128225; Security News', network: '&#128274; Network Monitor' };
      return '<button onclick="navigateTo(' + String.fromCharCode(39) + page + String.fromCharCode(39) + ')" class="aegis-btn" style="font-size:12px; padding:10px 16px;">' + labels[page] + '</button>';
    }).join('') +
    '</div>' +  // close quick actions flex
    '</div>' +  // close quick actions wrapper

    // RADAR AND NEWS SIDE BY SIDE
    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">' +

    // NETWORK ANOMALY RADAR
    '<div class="card" id="radar-card" style="border-top:2px solid var(--amber);">' +
    '<div class="card-header" style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;"><span>&#9673; NETWORK ANOMALY RADAR</span><div style="display:flex; gap:6px; flex-shrink:0;"><button id="radar-scan-btn" onclick="triggerRadarScan()" style="background:transparent; border:1px solid #f59e0b; color:#f59e0b; font-family:\'Orbitron\',sans-serif; font-size:10px; font-weight:700; letter-spacing:1px; padding:4px 12px; border-radius:2px; cursor:pointer; transition:all 0.2s;">SCAN NOW</button><button onclick="if(window.aegis)window.aegis.openMiniRadar()" title="Open mini radar widget" style="background:transparent; border:1px solid #f59e0b; color:#f59e0b; font-family:\'Orbitron\',sans-serif; font-size:10px; font-weight:700; letter-spacing:1px; padding:4px 10px; border-radius:2px; cursor:pointer; transition:all 0.2s;">◎ MINI</button></div></div>' +
    '<div style="display:flex; gap:16px; align-items:flex-start;">' +
    '<div style="flex-shrink:0;">' +
    '<canvas id="radar-canvas" width="220" height="220" style="display:block; border-radius:3px;"></canvas>' +
    '<canvas id="radar-sparkline" width="220" height="36" style="display:block; margin-top:4px;"></canvas>' +
    '</div>' +
    '<div id="radar-readouts" style="flex:1; padding-top:4px;">' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">INITIALIZING...</div>' +
    '</div>' +
    '</div>' +
    '<div style="margin-top:14px; border-top:1px solid var(--border); padding-top:10px;">' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--amber); letter-spacing:2px; margin-bottom:8px;">ANOMALY FEED</div>' +
    '<div id="radar-anomaly-feed" style="max-height:120px; overflow-y:auto;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); padding:4px 0;">&#10003; No anomalies detected</div>' +
    '</div></div></div>' +

    // LATEST NEWS
    '<div class="card">' +
    '<div class="card-header">LATEST NEWS</div>' +
    (newsData.length > 0 ? newsData.slice(0, 5).map(function(item) {
      const icon  = newsCategoryIcon(item.title, item.description || '');
      const thumb = newsThumbHTML(item.thumbnail, icon, 48);
      return '<div style="padding:10px 0; border-bottom:1px solid var(--border); display:flex; gap:10px; align-items:flex-start;">' +
        thumb +
        '<div style="flex:1; min-width:0;">' +
        '<div style="font-family:var(--font-ui); font-size:13px; color:var(--text-primary); font-weight:600; margin-bottom:5px; line-height:1.4;">' + item.title.slice(0, 90) + (item.title.length > 90 ? '...' : '') + '</div>' +
        '<div style="display:flex; justify-content:space-between;">' +
        '<span style="font-family:var(--font-mono); font-size:11px; color:var(--amber);">&#9658; ' + item.source + '</span>' +
        '<span style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">' + timeAgo(item.pubDate) + '</span>' +
        '</div></div></div>';
    }).join('') : '<p class="placeholder-text">No news loaded.</p>') +
    '<button onclick="navigateTo(\'news\')" class="aegis-btn" style="margin-top:16px; font-size:11px; padding:8px 16px; width:100%;">VIEW ALL NEWS ></button>' +
    '</div>' +
    '</div>';  // close grid

  setTimeout(initRadar, 50);
  loadThreatHeatmap();
}

// ============================================================
// THREAT HISTORY HEATMAP
// ============================================================
async function loadThreatHeatmap() {
  var container = document.getElementById('threat-heatmap-container');
  if (!container) return;

  var readings = [];
  if (window.aegis && window.aegis.getRadarReadings) {
    try {
      readings = await window.aegis.getRadarReadings(1000);
    } catch (_) {}
  }

  // Group readings by local calendar day
  var dayMap = {};
  var levelRank = { 'LOW': 0, 'ELEVATED': 1, 'HIGH': 2 };
  readings.forEach(function(r) {
    if (!r.ts) return;
    var d = new Date(r.ts);
    var key = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    if (!dayMap[key]) dayMap[key] = { worstLevel: 'LOW', anomalyCount: 0 };
    var level = 'LOW';
    if (r.latency > 300 || r.ipChanged || r.vpnDropped) level = 'HIGH';
    else if (r.latency > 150) level = 'ELEVATED';
    if (levelRank[level] > levelRank[dayMap[key].worstLevel]) dayMap[key].worstLevel = level;
    if (level !== 'LOW') dayMap[key].anomalyCount++;
  });

  // Last 30 days: index 0 = oldest, index 29 = today
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var days = [];
  for (var i = 29; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(today.getDate() - i);
    var key = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    days.push({ date: d, key: key, data: dayMap[key] || null, isToday: i === 0 });
  }

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function squareColor(day) {
    if (!day.data) return '#1e2d4a';
    if (day.data.worstLevel === 'HIGH') return '#ef4444';
    if (day.data.worstLevel === 'ELEVATED') return '#f59e0b';
    return '#10b981';
  }

  // 30 squares — 28px wide, 4px gap → stride 32px
  var squaresHTML = '';
  days.forEach(function(day) {
    var color = squareColor(day);
    var border = day.isToday
      ? 'outline:2px solid #f59e0b;outline-offset:1px;'
      : 'border:1px solid rgba(255,255,255,0.06);';
    var dateText = MONTHS[day.date.getMonth()] + ' ' + day.date.getDate();
    var levelText = day.data ? day.data.worstLevel : 'NO DATA';
    var anomalies = day.data ? day.data.anomalyCount : 0;
    squaresHTML +=
      '<div class="hm-sq"' +
      ' style="width:28px;height:28px;border-radius:3px;background:' + color + ';' + border + 'cursor:default;flex-shrink:0;"' +
      ' data-date="' + dateText + '" data-level="' + levelText + '" data-anomalies="' + anomalies + '">' +
      '</div>';
  });

  // Date labels at every 5th index + today
  var labelsHTML = '<div style="position:relative;height:20px;margin-top:6px;">';
  days.forEach(function(day, i) {
    if (i % 5 === 0 || i === 29) {
      var dateText = MONTHS[day.date.getMonth()] + ' ' + day.date.getDate();
      labelsHTML +=
        '<span style="position:absolute;left:' + (i * 32) + 'px;font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#64748b;white-space:nowrap;">' +
        dateText + '</span>';
    }
  });
  labelsHTML += '</div>';

  container.innerHTML =
    '<div style="background:#060d1f;border:1px solid #1e2d4a;border-top:2px solid #f59e0b;border-radius:4px;padding:20px 24px;margin-top:24px;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#f59e0b;letter-spacing:3px;margin-bottom:16px;">THREAT HISTORY — LAST 30 DAYS</div>' +
    '<div style="display:flex;gap:4px;">' + squaresHTML + '</div>' +
    labelsHTML +
    '<div style="margin-top:14px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;">' +
    '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#64748b;letter-spacing:1px;">LEGEND:</span>' +
    '<span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:12px;background:#10b981;border-radius:2px;"></span><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#64748b;">LOW</span></span>' +
    '<span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:12px;background:#f59e0b;border-radius:2px;"></span><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#64748b;">ELEVATED</span></span>' +
    '<span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:12px;background:#ef4444;border-radius:2px;"></span><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#64748b;">HIGH / CRITICAL</span></span>' +
    '<span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:12px;background:#1e2d4a;border:1px solid rgba(255,255,255,0.1);border-radius:2px;"></span><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#64748b;">NO DATA</span></span>' +
    '</div>' +
    '</div>';

  // Floating tooltip — create once, reuse across re-renders
  var tip = document.getElementById('heatmap-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'heatmap-tip';
    tip.style.cssText =
      'position:fixed;background:#060d1f;border:1px solid #f59e0b;border-radius:3px;' +
      'padding:10px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#e2e8f0;' +
      'pointer-events:none;z-index:9999;display:none;line-height:1.7;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
    document.body.appendChild(tip);
  }

  container.querySelectorAll('.hm-sq').forEach(function(sq) {
    sq.addEventListener('mouseenter', function(e) {
      var date    = sq.getAttribute('data-date');
      var level   = sq.getAttribute('data-level');
      var anomaly = sq.getAttribute('data-anomalies');
      var lc = level === 'HIGH' ? '#ef4444' : level === 'ELEVATED' ? '#f59e0b' : level === 'LOW' ? '#10b981' : '#64748b';
      tip.innerHTML =
        '<div style="color:#f59e0b;margin-bottom:4px;font-size:11px;letter-spacing:1px;">' + date + '</div>' +
        '<div>THREAT: <span style="color:' + lc + ';font-weight:bold;">' + level + '</span></div>' +
        '<div style="color:#94a3b8;">ANOMALIES: <span style="color:#e2e8f0;">' + anomaly + '</span></div>';
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top  = (e.clientY - 10) + 'px';
    });
    sq.addEventListener('mousemove', function(e) {
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top  = (e.clientY - 10) + 'px';
    });
    sq.addEventListener('mouseleave', function() {
      tip.style.display = 'none';
    });
  });
}

function renderStatCard(label, value, color, icon) {
  return '<div style="background:var(--bg-card); border:1px solid var(--border); border-top:2px solid ' + color + '; border-radius:4px; padding:20px; text-align:center;">' +
    '<div style="font-size:24px; margin-bottom:8px;">' + icon + '</div>' +
    '<div style="font-family:var(--font-title); font-size:20px; color:' + color + '; margin-bottom:6px;">' + value + '</div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); letter-spacing:2px;">' + label + '</div>' +
    '</div>';
}

function calculateThreatLevel(cves) {
  if (cves.length === 0) return 'LOW';
  const critical = cves.filter(function(c) { return c.severity === 'CRITICAL' && new Date(c.published) > new Date('1/1/2020'); }).length;
  const high = cves.filter(function(c) { return c.severity === 'HIGH' && new Date(c.published) > new Date('1/1/2020'); }).length;
  if (critical >= 3) return 'CRITICAL';
  if (critical >= 1 || high >= 5) return 'HIGH';
  if (high >= 2) return 'ELEVATED';
  return 'LOW';
}

function getThreatLevelColor(level) {
  switch(level) {
    case 'CRITICAL': return '#ef4444';
    case 'HIGH': return '#f97316';
    case 'ELEVATED': return '#f59e0b';
    case 'LOW': return '#10b981';
    default: return '#64748b';
  }
}

async function loadDashboardCVEs() {
  try {
    const response = await fetch('https://aegis-proxy.ka-mixalis99.workers.dev/?url=' + encodeURIComponent(nvdRecentCVEUrl(30, 20)));
    const data = await response.json();
    if (data.vulnerabilities) {
      const cves = data.vulnerabilities
        .sort(function(a, b) { return new Date(b.cve.published) - new Date(a.cve.published); })
        .map(extractCVEData);
      if (allCVEs.length === 0) allCVEs = cves;
      return cves;
    }
    return [];
  } catch (e) { return allCVEs.length > 0 ? allCVEs : []; }
}

async function loadDashboardNews() {
  try {
    if (allNews.length > 0) return allNews;
    const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('https://feeds.feedburner.com/TheHackersNews'));
    const data = await response.json();
    if (data.status === 'ok' && data.items) {
      const news = data.items.slice(0, 10).map(function(item) {
        return { title: item.title, link: item.link, pubDate: item.pubDate, source: 'The Hacker News', description: '', thumbnail: extractNewsImage(item) };
      });
      if (allNews.length === 0) allNews = news;
      return news;
    }
    return [];
  } catch (e) { return allNews.length > 0 ? allNews : []; }
}

async function loadDashboardIP() {
  try {
    const response = await fetch('https://api64.ipify.org?format=json');
    const ipJson = await response.json();
    const geoResponse = await fetch('https://aegis-proxy.ka-mixalis99.workers.dev/?url=' + encodeURIComponent('https://ipwho.is/' + ipJson.ip));
    const geo = await geoResponse.json();
    return { ip: ipJson.ip, isVPN: geo.proxy || geo.hosting || false, country: geo.country };
  } catch (e) { return { ip: 'Unknown', isVPN: false }; }
}

function navigateTo(page) {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  const pageTitle = document.getElementById('page-title');
  const pageTitles = { dashboard: 'Security Dashboard', 'network-intelligence': 'Network Intelligence', breach: 'Breach Checker', password: 'Password Health', ip: 'IP Investigator', cve: 'CVE Threat Feed', briefing: 'AI Briefing', news: 'Security News', network: 'Network Monitor', 'security-toolkit': 'Security Toolkit', 'network-toolkit': 'Network Toolkit', settings: 'Settings' };
  navItems.forEach(function(n) { n.classList.remove('active'); });
  pages.forEach(function(p) { p.classList.remove('active'); });
  const targetNav = document.querySelector('[data-page="' + page + '"]');
  const targetPage = document.getElementById('page-' + page);
  if (targetNav) targetNav.classList.add('active');
  if (targetPage) targetPage.classList.add('active');
  if (pageTitle) pageTitle.textContent = pageTitles[page] || page;
}

// Auto-load dashboard when page is visited
document.querySelectorAll('.nav-item').forEach(function(item) {
  item.addEventListener('click', function() {
    if (item.dataset.page === 'dashboard') {
      setTimeout(loadDashboard, 100);
    }
  });
});

// Dashboard is loaded by runSplash() once the splash animation completes.




// ============================================================
// PING TOOL
// ============================================================
const KNOWN_HOSTS = {
  // Search & Social
  'google': 'www.google.com',
  'facebook': 'www.facebook.com',
  'twitter': 'twitter.com',
  'x': 'x.com',
  'instagram': 'www.instagram.com',
  'youtube': 'www.youtube.com',
  'linkedin': 'www.linkedin.com',
  'reddit': 'www.reddit.com',
  'tiktok': 'www.tiktok.com',
  'snapchat': 'www.snapchat.com',
  'pinterest': 'www.pinterest.com',
  'tumblr': 'www.tumblr.com',
  'discord': 'discord.com',
  'twitch': 'www.twitch.tv',
  'whatsapp': 'www.whatsapp.com',
  'telegram': 'telegram.org',
  // Tech
  'microsoft': 'www.microsoft.com',
  'apple': 'www.apple.com',
  'amazon': 'www.amazon.com',
  'netflix': 'www.netflix.com',
  'spotify': 'www.spotify.com',
  'github': 'github.com',
  'stackoverflow': 'stackoverflow.com',
  'cloudflare': '1.1.1.1',
  'openai': 'openai.com',
  'anthropic': 'anthropic.com',
  'claude': 'claude.ai',
  // DNS
  'google dns': '8.8.8.8',
  'cloudflare dns': '1.1.1.1',
  'opendns': '208.67.222.222',
  'quad9': '9.9.9.9',
  // News & Security
  'hackernews': 'thehackernews.com',
  'bleepingcomputer': 'www.bleepingcomputer.com',
  'darkreading': 'www.darkreading.com',
  'krebs': 'krebsonsecurity.com',
  'shodan': 'www.shodan.io',
  'virustotal': 'www.virustotal.com',
  'haveibeenpwned': 'haveibeenpwned.com',
  // Greek
  'cosmote': 'www.cosmote.gr',
  'vodafone greece': 'www.vodafone.gr',
  'wind': 'www.wind.gr',
  'nova': 'www.nova.gr',
  'forthnet': 'www.forthnet.gr',
  'skroutz': 'www.skroutz.gr',
  'e-shop': 'www.e-shop.gr',
  'public': 'www.public.gr',
  'taxisnet': 'www.taxisnet.gr',
  'efka': 'www.efka.gov.gr',
  // Gaming
  'steam': 'store.steampowered.com',
  'epicgames': 'www.epicgames.com',
  'riot': 'www.riotgames.com',
  'leagueoflegends': 'www.leagueoflegends.com',
  'battlenet': 'battle.net',
  'playstation': 'www.playstation.com',
  'xbox': 'www.xbox.com',
  // Education & Cybersecurity
  'tryhackme': 'tryhackme.com',
  'hackthebox': 'www.hackthebox.com',
  'coursera': 'www.coursera.org',
  'udemy': 'www.udemy.com',
  'cybrary': 'www.cybrary.it',
  // Cloud
  'aws': 'aws.amazon.com',
  'azure': 'azure.microsoft.com',
  'gcp': 'cloud.google.com',
  'digitalocean': 'www.digitalocean.com',
  'heroku': 'www.heroku.com',
  // Other
  'wikipedia': 'www.wikipedia.org',
  'archive': 'archive.org',
  'pastebin': 'pastebin.com',
  'dropbox': 'www.dropbox.com',
  'onedrive': 'onedrive.live.com',
  'googledrive': 'drive.google.com',
  'gmail': 'mail.google.com',
  'outlook': 'outlook.live.com',
  'yahoo': 'www.yahoo.com',
  'bing': 'www.bing.com',
  'duckduckgo': 'duckduckgo.com',
  'tor': 'www.torproject.org',
  'nordvpn': 'nordvpn.com',
  'expressvpn': 'www.expressvpn.com'
};

let pingRunning = false;
let pingResults = [];

// Init shortcuts when network page loads
document.querySelectorAll('.nav-item').forEach(function(item) {
  item.addEventListener('click', function() {
    if (item.dataset.page === 'network') {
      setTimeout(initPingShortcuts, 200);
    }
  });
});

































































// CIDR RANGE CHECKING
function ipToInt(ip) {
  return ip.split('.').reduce(function(acc, oct) { return (acc << 8) + parseInt(oct); }, 0) >>> 0;
}

function ipInCIDR(ip, cidr) {
  try {
    const parts = cidr.split('/');
    const base = parts[0];
    const bits = parseInt(parts[1]);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipToInt(ip) & mask) === (ipToInt(base) & mask);
  } catch(e) { return false; }
}

// Override isKnownSafe with CIDR support
function isKnownSafe(ip) {
  if (!ip) return null;
  if (KNOWN_SAFE[ip]) return KNOWN_SAFE[ip];
  for (const prefix of Object.keys(KNOWN_SAFE)) {
    if (prefix.includes('/')) {
      if (ipInCIDR(ip, prefix)) return KNOWN_SAFE[prefix];
    } else if (prefix.endsWith('.0') && ip.startsWith(prefix.slice(0, -1))) {
      return KNOWN_SAFE[prefix];
    }
  }
  return null;
}

// Add CIDR ranges to KNOWN_SAFE
const KNOWN_SAFE_CIDR = {
  '8.8.8.0/24': 'Google Public DNS',
  '8.8.4.0/24': 'Google Public DNS',
  '142.250.0.0/15': 'Google LLC',
  '172.217.0.0/16': 'Google LLC',
  '216.58.192.0/19': 'Google LLC',
  '74.125.0.0/16': 'Google LLC',
  '64.233.160.0/19': 'Google LLC',
  '66.102.0.0/20': 'Google LLC',
  '209.85.128.0/17': 'Google LLC',
  '1.1.1.0/24': 'Cloudflare DNS',
  '1.0.0.0/24': 'Cloudflare DNS',
  '104.16.0.0/12': 'Cloudflare CDN',
  '172.64.0.0/13': 'Cloudflare CDN',
  '162.158.0.0/15': 'Cloudflare CDN',
  '198.41.128.0/17': 'Cloudflare CDN',
  '13.64.0.0/11': 'Microsoft Azure',
  '20.0.0.0/8': 'Microsoft Azure',
  '40.64.0.0/10': 'Microsoft Azure',
  '52.224.0.0/11': 'Microsoft Azure',
  '104.40.0.0/13': 'Microsoft Azure',
  '157.54.0.0/15': 'Microsoft',
  '207.46.0.0/16': 'Microsoft',
  '3.0.0.0/8': 'Amazon AWS',
  '18.0.0.0/8': 'Amazon AWS',
  '52.0.0.0/8': 'Amazon AWS',
  '54.0.0.0/8': 'Amazon AWS',
  '205.251.192.0/19': 'Amazon CloudFront',
  '13.224.0.0/14': 'Amazon CloudFront',
  '17.0.0.0/8': 'Apple Inc.',
  '157.240.0.0/16': 'Meta (Facebook)',
  '69.63.176.0/20': 'Meta (Facebook)',
  '69.171.224.0/19': 'Meta (Facebook)',
  '173.252.64.0/18': 'Meta (Facebook)',
  '140.82.112.0/20': 'GitHub',
  '185.199.108.0/22': 'GitHub Pages',
  '192.30.252.0/22': 'GitHub',
  '23.0.0.0/12': 'Akamai CDN',
  '151.101.0.0/16': 'Fastly CDN',
  '199.232.0.0/16': 'Fastly CDN',
  '104.244.42.0/21': 'Twitter/X'
};
Object.assign(KNOWN_SAFE, KNOWN_SAFE_CIDR);

// Override isKnownSafe with CIDR support
function isKnownSafe(ip) {
  if (!ip) return null;
  if (KNOWN_SAFE[ip]) return KNOWN_SAFE[ip];
  for (const prefix of Object.keys(KNOWN_SAFE)) {
    if (prefix.includes('/')) {
      if (ipInCIDR(ip, prefix)) return KNOWN_SAFE[prefix];
    } else if (prefix.endsWith('.0') && ip.startsWith(prefix.slice(0, -1))) {
      return KNOWN_SAFE[prefix];
    }
  }
  return null;
}


// Comprehensive Greek IP Ranges
const GREEK_EXTENDED_CIDRS = {
  // Universities
  '147.102.0.0/16': 'University of Athens',
  '147.27.0.0/16': 'Aristotle University Thessaloniki',
  '143.233.0.0/16': 'University of Crete',
  '195.130.64.0/18': 'Technical University of Crete',
  '160.40.0.0/16': 'NTUA Athens',
  '155.207.0.0/16': 'University of Patras',
  '193.93.0.0/16': 'University of Macedonia',
  '193.140.0.0/16': 'Democritus University',
  '194.63.0.0/16': 'University of Ioannina',
  '195.134.64.0/18': 'University of Thessaly',
  // Government
  '193.92.0.0/16': 'Greek Government Network',
  '194.219.0.0/16': 'Greek Government Network',
  '212.205.32.0/19': 'Greek Ministry of Education',
  '195.46.224.0/19': 'Greek Parliament',
  '194.63.224.0/19': 'Greek Police',
  // Banks
  '185.47.116.0/22': 'Piraeus Bank Greece',
  '212.152.160.0/19': 'National Bank of Greece',
  '194.177.210.0/23': 'Alpha Bank Greece',
  '195.170.0.0/16': 'Eurobank Greece',
  // Media
  '185.6.76.0/22': 'Skroutz',
  '212.205.128.0/17': 'Greek Media',
  // More ISPs
  '185.31.28.0/22': 'Nova Greece',
  '46.176.0.0/14': 'Forthnet Greece',
  '188.254.0.0/15': 'Cyta Hellas',
  '195.74.0.0/16': 'Hellas Online',
  '62.169.192.0/18': 'GRNET Research',
  '79.102.0.0/15': 'Cosmote Mobile',
  '79.166.0.0/15': 'Cosmote Mobile',
  '94.68.0.0/14': 'Vodafone Mobile Greece',
  '188.112.0.0/14': 'Wind Mobile Greece'
};
Object.assign(KNOWN_SAFE, GREEK_EXTENDED_CIDRS);

// Greek ISP CIDR Ranges
const GREEK_CIDRS = {
  '46.10.0.0/15': 'Cosmote Greece',
  '62.38.0.0/15': 'Cosmote Greece',
  '176.63.0.0/18': 'Cosmote Greece',
  '94.64.0.0/14': 'Vodafone Greece',
  '195.167.0.0/16': 'Vodafone Greece',
  '212.205.0.0/16': 'Wind Hellas',
  '94.70.0.0/15': 'Wind Hellas',
  '195.130.0.0/17': 'Forthnet Greece',
  '83.235.0.0/16': 'Forthnet Greece',
  '83.212.0.0/14': 'GRNET',
  '195.251.0.0/16': 'GRNET',
  '77.235.32.0/19': 'OTE Group Greece',
  '78.87.0.0/16': 'OTE Group Greece',
  '109.242.0.0/15': 'OTE Group Greece'
};
Object.assign(KNOWN_SAFE, GREEK_CIDRS);




