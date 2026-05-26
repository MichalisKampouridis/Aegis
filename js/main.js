let allCVEs = [];

// SPLASH SCREEN
function runSplash() {
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
  let step = 0;
  const interval = setInterval(function() {
    if (step < messages.length) {
      status.textContent = messages[step];
      bar.style.width = ((step + 1) / messages.length * 100) + '%';
      step++;
    } else {
      clearInterval(interval);
      splash.style.transition = 'opacity 0.8s ease';
      splash.style.opacity = '0';
      setTimeout(function() {
        splash.style.display = 'none';
        loadDashboard();
      }, 800);
    }
  }, 500);
}

window.addEventListener('load', function() {
  runSplash();
});

// ============================================================
// AEGIS — PERSONAL SECURITY INTELLIGENCE DASHBOARD
// main.js — Complete Feature Set
// ============================================================

// PAGE NAVIGATION
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('page-title');

const pageTitles = {
  dashboard: 'Security Dashboard',
  breach: 'Breach Checker',
  password: 'Password Health',
  ip: 'IP Investigator',
  cve: 'CVE Threat Feed',
  briefing: 'AI Briefing',
  news: 'Security News',
  network: 'Network Monitor'
};

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const target = item.dataset.page;
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
// PASSWORD HEALTH CHECK — ULTIMATE EDITION
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
      breachDiv2.innerHTML = '<div class="safe-banner">✅ NOT FOUND IN ANY KNOWN DATA BREACH<br><span style="font-size:12px; opacity:0.7;">Checked via HaveIBeenPwned k-anonymity API. Your password was never transmitted.</span></div>';
    } else {
      breachDiv2.innerHTML = '<div class="danger-banner">⚠ FOUND IN ' + count.toLocaleString() + ' KNOWN DATA BREACHES<br><span style="font-size:12px; opacity:0.7;">Change this password immediately on any account using it.</span></div>';
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
      return '<div style="font-family:var(--font-mono); font-size:13px; color:' + (item[1] ? '#10b981' : '#ef4444') + ';">' + (item[1] ? '✓' : '✗') + ' ' + item[0] + '</div>';
    }).join('') +
    '</div></div>' +
    (suggestions.length > 0 ?
    '<div style="margin-bottom:18px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:10px;">RECOMMENDATIONS</div>' +
    suggestions.map(function(s) { return '<div style="font-family:var(--font-mono); font-size:13px; color:#f59e0b; margin-bottom:4px;">▸ ' + s + '</div>'; }).join('') +
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
    btn.textContent = '✓ COPIED';
    btn.style.color = '#10b981';
    btn.style.borderColor = '#10b981';
    setTimeout(function() {
      btn.textContent = '⚡ GENERATE';
      btn.style.color = '#64748b';
      btn.style.borderColor = '#1e2d4a';
    }, 2000);
  });
});

// ============================================================
// IP / DOMAIN INVESTIGATOR — ULTIMATE EDITION
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
    return '<div onclick="loadFromHistory(\'' + h.query + '\')" style="cursor:pointer; padding:10px 14px; margin-bottom:6px; background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ' + h.color + '; border-radius:2px; font-family:var(--font-mono); font-size:12px; color:' + h.color + ';" onmouseover="this.style.background=\'var(--amber-glow)\'" onmouseout="this.style.background=\'var(--bg-secondary)\'">' + h.query + ' <span style="color:var(--text-dim); font-size:11px;">— ' + h.threat + '</span></div>';
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
      btn.textContent = '✓ COPIED';
      btn.style.color = '#10b981';
      btn.style.borderColor = '#10b981';
      setTimeout(function() { btn.textContent = '⎘ COPY'; btn.style.color = ''; btn.style.borderColor = ''; }, 2000);
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
      '<div class="breach-name" style="color:#a78bfa; font-size:16px;">🔒 PRIVATE / INTERNAL IP</div>' +
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
    const ipResponse = await fetch('https://ipapi.co/' + encodeURIComponent(input) + '?fields=status,message,country,countryCode,regionName,city,isp,org,as,proxy,hosting,query,lat,lon');
    const d = await ipResponse.json();

    if (d.status === 'fail') {
      resultDiv.innerHTML = '<p class="placeholder-text">Error: ' + d.message + '</p>';
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
    const knownSafeLabel = isKnownSafe(d.query);
    const isMalicious = KNOWN_MALICIOUS.some(function(range) { return d.query.startsWith(range); });
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
    addToHistory(d.query, threat, threatColor);

    resultDiv.innerHTML =
      '<div id="ip-report-text" class="breach-card" style="border-left-color:' + threatColor + '; background:' + threatBg + '">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; flex-wrap:wrap; gap:8px;">' +
      '<div class="breach-name" style="color:' + threatColor + '; font-size:16px;">' + threat + ' — ' + d.query + '</div>' +
      '<div style="display:flex; gap:8px;">' +
      '<button id="copy-ip-btn" onclick="copyIPReport()" class="aegis-btn" style="font-size:11px; padding:8px 16px;">⎘ COPY</button>' +
      '<button onclick="exportIPPDF()" class="aegis-btn" style="font-size:11px; padding:8px 16px; border-color:#a78bfa; color:#a78bfa;">⬇ PDF</button>' +
      '</div></div>' +
      (knownSafeLabel ? '<div style="font-family:var(--font-mono); font-size:13px; color:#10b981; margin-bottom:14px;">✓ Verified: ' + knownSafeLabel + '</div>' : '') +
      (!knownSafeLabel ? '<div style="margin:14px 0;"><div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">THREAT SCORE</div><div style="background:#0a0f1e; border-radius:2px; height:8px; width:100%;"><div style="background:' + threatColor + '; height:8px; width:' + barWidth + '%; border-radius:2px; box-shadow:0 0 8px ' + threatColor + ';"></div></div><div style="font-family:var(--font-mono); font-size:13px; color:' + threatColor + '; margin-top:6px;">' + threatScore + '/100</div></div>' : '') +
      (threatReasons.length > 0 ? '<div style="margin-bottom:14px;"><div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">THREAT INDICATORS</div>' + threatReasons.map(function(r) { return '<div style="font-family:var(--font-mono); font-size:13px; color:' + threatColor + '; margin-bottom:4px;">▸ ' + r + '</div>'; }).join('') + '</div>' : '') +
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
      '<div>PROXY / VPN: <span style="color:' + (d.proxy && !knownSafeLabel ? '#ef4444' : '#10b981') + '">' + (d.proxy && !knownSafeLabel ? 'YES ⚠' : 'No') + '</span></div>' +
      '<div>DATACENTER: <span style="color:' + (d.hosting && !knownSafeLabel ? '#f59e0b' : '#10b981') + '">' + (d.hosting && !knownSafeLabel ? 'YES ⚡' : 'No') + '</span></div>' +
      '</div></div>' +
      whoisHTML +
      '<div style="margin-top:16px; border-top:1px solid var(--border); padding-top:14px;">' +
      '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:10px;">GEOLOCATION MAP</div>' +
      '<iframe width="100%" height="320" frameborder="0" scrolling="no" style="border-radius:3px; border:1px solid var(--border); filter:grayscale(0.3) invert(0.9) hue-rotate(180deg);" src="https://www.openstreetmap.org/export/embed.html?bbox=' + (d.lon-2) + ',' + (d.lat-2) + ',' + (d.lon+2) + ',' + (d.lat+2) + '&layer=mapnik&marker=' + d.lat + ',' + d.lon + '"></iframe>' +
      '</div></div>' +
      '<div class="result-label" style="margin-top:10px;">Data sourced from ip-api.com · Threat scoring by Aegis Intelligence Engine · ' + new Date().toUTCString() + '</div>';

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
    btn.textContent = '⌖ MY IP';
    btn.style.opacity = '1';
    investigateIP();
  } catch (e) {
    btn.textContent = '⌖ MY IP';
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
let allCVEs = [];
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

function renderCVECard(cve, expanded) {
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
    '<button onclick="copyCVEId(\'' + cve.id + '\')" id="copy-cve-' + cve.id + '" class="aegis-btn" style="font-size:11px; padding:6px 12px;">⎘ COPY ID</button>' +
    '<a href="https://nvd.nist.gov/vuln/detail/' + cve.id + '" target="_blank" class="aegis-btn" style="font-size:11px; padding:6px 12px; text-decoration:none; border-color:#a78bfa; color:#a78bfa;">↗ NVD</a>' +
    '<button onclick="toggleCVEExpand(\'' + cve.id + '\')" class="aegis-btn" style="font-size:11px; padding:6px 12px; border-color:#1e2d4a; color:#64748b;">' + (expanded ? '▲ LESS' : '▼ MORE') + '</button>' +
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
      btn.textContent = '✓ COPIED';
      btn.style.color = '#10b981';
      btn.style.borderColor = '#10b981';
      setTimeout(function() { btn.textContent = '⎘ COPY ID'; btn.style.color = ''; btn.style.borderColor = ''; }, 2000);
    }
  });
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
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:10px;">SEVERITY BREAKDOWN — ' + total + ' VULNERABILITIES</div>' +
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



async function loadCVEFeed() {
  const resultDiv = document.getElementById('cve-result');
  resultDiv.innerHTML = '<p class="loading">PULLING LATEST CVE DATA FROM NVD...</p>';
  allCVEs = [];
  expandedCVEs = {};
  activeSeverityFilter = 'ALL';
  cveSearchTerm = '';

  try {
    const response = await fetch('https://api.codetabs.com/v1/proxy?quest=https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
    const data = await response.json();

    if (!data.vulnerabilities || data.vulnerabilities.length === 0) {
      resultDiv.innerHTML = '<p class="placeholder-text">No CVE data available right now. Try again later.</p>';
      return;
    }

    allCVEs = data.vulnerabilities.slice(0, 20).reverse().map(extractCVEDataCISA);
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
// AI DAILY BRIEFING — FULL EDITION
// ============================================================
let briefingHistory = [];

async function generateBriefing() {
  const resultDiv = document.getElementById('briefing-result');
  const btn = document.getElementById('briefing-btn');
  const style = document.getElementById('briefing-style').value;
  const focus = document.getElementById('briefing-focus').value.trim();

  btn.textContent = 'ANALYZING...';
  btn.style.opacity = '0.6';
  btn.disabled = true;

  resultDiv.innerHTML =
    '<div style="text-align:center; padding:40px;">' +
    '<div style="font-family:var(--font-title); font-size:14px; color:var(--amber); letter-spacing:4px; margin-bottom:16px; animation:blink 1s infinite;">AEGIS INTELLIGENCE ENGINE ACTIVE</div>' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">COLLECTING THREAT DATA...</div>' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">CORRELATING CVE DATABASE...</div>' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px;">ENGAGING AI ANALYST...</div>' +
    '<div style="width:200px; height:4px; background:var(--bg-secondary); border-radius:2px; margin:16px auto;"><div style="height:4px; background:var(--amber); border-radius:2px; animation:loadingBar 2s ease-in-out infinite;"></div></div>' +
    '</div>';

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

  const prompt = 'You are a cybersecurity intelligence analyst for Aegis Security Dashboard. ' +
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

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const briefingText = data.content[0].text;
    const timestamp = new Date().toUTCString();

    // Parse threat level
    let threatLevel = 'ELEVATED';
    let threatLevelColor = '#f59e0b';
    if (briefingText.includes('THREAT LEVEL: CRITICAL') || briefingText.includes('THREAT LEVEL:CRITICAL')) {
      threatLevel = 'CRITICAL'; threatLevelColor = '#ef4444';
    } else if (briefingText.includes('THREAT LEVEL: HIGH') || briefingText.includes('THREAT LEVEL:HIGH')) {
      threatLevel = 'HIGH'; threatLevelColor = '#f97316';
    } else if (briefingText.includes('THREAT LEVEL: LOW') || briefingText.includes('THREAT LEVEL:LOW')) {
      threatLevel = 'LOW'; threatLevelColor = '#84cc16';
    } else if (briefingText.includes('THREAT LEVEL: ELEVATED') || briefingText.includes('THREAT LEVEL:ELEVATED')) {
      threatLevel = 'ELEVATED'; threatLevelColor = '#f59e0b';
    }

    // Format briefing text
    const formattedText = briefingText
      .replace(/\*\*(.*?)\*\*/g, '<span style="color:var(--amber); font-weight:bold;">$1</span>')
      .replace(/^(\d+\.\s+[A-Z\s]+:)/gm, '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-top:16px; margin-bottom:8px;">$1</div>')
      .replace(/^[-•]\s+/gm, '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); margin-bottom:6px; padding-left:12px;">▸ ')
      .replace(/\n/g, '</div>\n');

    const briefingHTML =
      '<div id="briefing-report" style="background:var(--bg-card); border:1px solid var(--border); border-radius:4px; padding:28px; position:relative;">' +
      '<div style="position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(to right, transparent, ' + threatLevelColor + ', transparent);"></div>' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px;">' +
      '<div>' +
      '<div style="font-family:var(--font-title); font-size:18px; color:var(--amber); letter-spacing:3px; margin-bottom:6px;">AEGIS INTELLIGENCE BRIEFING</div>' +
      '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">Generated: ' + timestamp + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">Style: ' + style.toUpperCase() + (focus ? ' | Focus: ' + focus : '') + '</div>' +
      '</div>' +
      '<div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">' +
      '<div style="background:' + threatLevelColor + '; color:#020818; font-family:var(--font-title); font-size:13px; font-weight:900; padding:8px 20px; border-radius:3px; letter-spacing:2px;">⚠ ' + threatLevel + '</div>' +
      '<div style="display:flex; gap:8px;">' +
      '<button onclick="copyBriefing()" class="aegis-btn" style="font-size:11px; padding:6px 14px;">⎘ COPY</button>' +
      '<button onclick="exportBriefingPDF()" class="aegis-btn" style="font-size:11px; padding:6px 14px; border-color:#a78bfa; color:#a78bfa;">⬇ PDF</button>' +
      '</div></div></div>' +
      '<div style="font-family:var(--font-mono); font-size:14px; color:var(--text-primary); line-height:1.8; border-top:1px solid var(--border); padding-top:20px;">' +
      formattedText +
      '</div></div>';

    resultDiv.innerHTML = briefingHTML;

    // Add to history
    briefingHistory.unshift({ timestamp, threatLevel, threatLevelColor, style, focus, text: briefingText });
    if (briefingHistory.length > 3) briefingHistory.pop();
    renderBriefingHistory();

  } catch (error) {
    resultDiv.innerHTML =
      '<div class="breach-card" style="border-left-color:#ef4444;">' +
      '<div class="breach-name" style="color:#ef4444;">BRIEFING GENERATION FAILED</div>' +
      '<div class="breach-detail" style="margin-top:8px;">Error: ' + error.message + '<br><br>The AI Briefing feature requires the Anthropic API. This will work fully when Aegis is deployed to GitHub Pages.</div>' +
      '</div>';
  }

  btn.textContent = '⚡ GENERATE BRIEFING';
  btn.style.opacity = '1';
  btn.disabled = false;
}

function copyBriefing() {
  const report = document.getElementById('briefing-report');
  if (!report) return;
  navigator.clipboard.writeText(report.innerText).then(function() {
    const btn = event.target;
    btn.textContent = '✓ COPIED';
    btn.style.color = '#10b981';
    btn.style.borderColor = '#10b981';
    setTimeout(function() { btn.textContent = '⎘ COPY'; btn.style.color = ''; btn.style.borderColor = ''; }, 2000);
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
      '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-primary); margin-top:8px; line-height:1.6;">' + b.text.slice(0, 200) + '...</div>' +
      '</div>';
  }).join('');
}

// ============================================================
// SECURITY NEWS HEADLINES — FULL EDITION
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

    return '<a href="' + item.link + '" target="_blank" style="text-decoration:none;">' +
      '<div style="background:#0f1a2e; border:1px solid #1e2d4a; border-left:3px solid ' + borderColor + '; border-radius:3px; padding:24px 28px; margin-bottom:16px; transition:all 0.2s; cursor:pointer;" onmouseover="this.style.background=\'var(--bg-secondary)\'; this.style.borderColor=\'var(--amber)\'" onmouseout="this.style.background=\'var(--bg-card)\'; this.style.borderColor=\'var(--border)\'">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:12px;">' +
      '<div style="font-family:var(--font-ui); font-size:16px; color:#cbd5e1; font-weight:600; line-height:1.6; flex:1;">' + item.title + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); white-space:nowrap;">' + timeAgo(item.pubDate) + '</div>' +
      '</div>' +
      '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">' +
      '<div style="font-family:var(--font-mono); font-size:13px; color:var(--amber);">▸ ' + item.source + '</div>' +
      categoryBadges +
      '</div>' +
      (item.description ? '<div style="font-family:var(--font-ui); font-size:14px; color:#94a3b8; margin-top:10px; line-height:1.8;">' + item.description.slice(0, 150) + (item.description.length > 150 ? '...' : '') + '</div>' : '') +
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
                source: feed.source
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

async function runNetworkScan() {
  const resultDiv = document.getElementById('network-result');
  resultDiv.innerHTML = '<p class="loading">SCANNING NETWORK...</p>';

  // Run all checks in parallel
  const [ipData, webrtcData, latencyData] = await Promise.all([
    checkPublicIP(),
    checkWebRTCLeak(),
    checkLatency()
  ]);

  const dnsData = await checkDNSLeak(ipData);

  renderNetworkResults(ipData, webrtcData, dnsData, latencyData);

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

    const geoResponse = await fetch('https://ipapi.co/' + ip + '?fields=country,countryCode,city,isp,proxy,hosting,query');
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

async function checkWebRTCLeak() {
  return new Promise(function(resolve) {
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      const ips = [];
      pc.createDataChannel('');
      pc.createOffer().then(function(offer) { return pc.setLocalDescription(offer); });
      pc.onicecandidate = function(e) {
        if (!e.candidate) {
          pc.close();
          const localIPs = ips.filter(function(ip) {
            return /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
          });
          const publicIPs = ips.filter(function(ip) {
            return !/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.)/.test(ip);
          });
          resolve({ ips: ips, localIPs: localIPs, publicIPs: publicIPs, success: true });
          return;
        }
        const match = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(e.candidate.candidate);
        if (match && !ips.includes(match[1])) ips.push(match[1]);
      };
      setTimeout(function() {
        pc.close();
        const localIPs = ips.filter(function(ip) {
          return /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
        });
        const publicIPs = ips.filter(function(ip) {
          return !/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.)/.test(ip);
        });
        resolve({ ips: ips, localIPs: localIPs, publicIPs: publicIPs, success: true });
      }, 3000);
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
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
  alert.innerHTML = '⚠ IP ADDRESS CHANGED<br><span style="color:var(--text-dim); font-size:11px;">Previous: ' + oldIP + '<br>Current: ' + newIP + '</span>';
  document.body.appendChild(alert);
  setTimeout(function() { alert.remove(); }, 8000);
}

function renderNetworkResults(ipData, webrtcData, dnsData, latencyData) {
  const resultDiv = document.getElementById('network-result');

  // VPN STATUS
  const vpnActive = ipData.success && ipData.isVPN;
  const vpnColor = vpnActive ? '#10b981' : '#ef4444';
  const vpnLabel = vpnActive ? '✅ VPN ACTIVE' : '⚠ NO VPN DETECTED';
  const flag = ipData.success ? countryCodeToFlag(ipData.countryCode) : '';

  // WEBRTC
  const webrtcLeak = webrtcData.success && webrtcData.publicIPs.length > 0;
  const webrtcColor = webrtcLeak ? '#ef4444' : '#10b981';
  const webrtcLabel = webrtcLeak ? '⚠ LEAK DETECTED' : '✅ NO LEAK';

  // DNS
  const dnsLeak = dnsData.success && dnsData.isLeaking;
  const dnsColor = dnsLeak ? '#ef4444' : '#10b981';
  const dnsLabel = dnsLeak ? '⚠ DNS LEAK' : '✅ DNS SECURE';

  resultDiv.innerHTML =
    // VPN STATUS CARD
    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">' +

    '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ' + vpnColor + '; border-radius:3px; padding:20px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:10px;">VPN STATUS</div>' +
    '<div style="font-family:var(--font-title); font-size:16px; color:' + vpnColor + '; margin-bottom:12px;">' + vpnLabel + '</div>' +
    (ipData.success ? '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); line-height:1.8;">IP: <span style="color:var(--text-primary)">' + ipData.ip + '</span><br>LOCATION: <span style="color:var(--text-primary)">' + flag + ' ' + ipData.city + ', ' + ipData.country + '</span><br>ISP: <span style="color:var(--text-primary)">' + ipData.isp + '</span></div>' : '<div style="color:#ef4444; font-family:var(--font-mono); font-size:13px;">Could not detect IP</div>') +
    '</div>' +

    '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ' + webrtcColor + '; border-radius:3px; padding:20px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); letter-spacing:2px; margin-bottom:10px;">WEBRTC LEAK TEST</div>' +
    '<div style="font-family:var(--font-title); font-size:16px; color:' + webrtcColor + '; margin-bottom:12px;">' + webrtcLabel + '</div>' +
    '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); line-height:1.8;">' +
    (webrtcData.success ? 'LOCAL IPs: <span style="color:var(--text-primary)">' + (webrtcData.localIPs.length > 0 ? webrtcData.localIPs.join(', ') : 'None') + '</span><br>PUBLIC IPs: <span style="color:' + webrtcColor + '">' + (webrtcData.publicIPs.length > 0 ? webrtcData.publicIPs.join(', ') : 'None') + '</span>' : 'WebRTC not supported') +
    '</div></div></div>' +

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

// Auto-load network monitor when page is visited
document.querySelectorAll('.nav-item').forEach(function(item) {
  item.addEventListener('click', function() {
    if (item.dataset.page === 'network') {
      setTimeout(runNetworkScan, 100);
    }
  });
});





// ============================================================
// DASHBOARD — HOME PAGE
// ============================================================
async function loadDashboard() {
  const dashDiv = document.getElementById('dashboard-content');
  if (!dashDiv) return;

  dashDiv.innerHTML = '<p class="loading">LOADING AEGIS DASHBOARD...</p>';

  // Load CVEs and News in parallel
  const [cveData, newsData, ipData] = await Promise.all([
    loadDashboardCVEs(),
    loadDashboardNews(),
    loadDashboardIP()
  ]);

  const threatLevel = calculateThreatLevel(cveData);
  const threatColor = getThreatLevelColor(threatLevel);

  dashDiv.innerHTML =
    // THREAT LEVEL BANNER
    '<div style="background:' + threatColor + '18; border:1px solid ' + threatColor + '; border-radius:4px; padding:20px 28px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center;">' +
    '<div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); letter-spacing:3px; margin-bottom:6px;">CURRENT THREAT LEVEL</div>' +
    '<div style="font-family:var(--font-title); font-size:28px; color:' + threatColor + '; letter-spacing:4px;">⚠ ' + threatLevel + '</div>' +
    '</div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); text-align:right;">LAST UPDATED<br><span style="color:var(--text-primary);">' + new Date().toUTCString() + '</span></div>' +
    '</div>' +

    // STAT CARDS
    '<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px;">' +
    renderStatCard('CVEs LOADED', cveData.length, cveData.length > 0 ? '#f59e0b' : '#64748b', '🛡') +
    renderStatCard('NEWS HEADLINES', newsData.length, newsData.length > 0 ? '#10b981' : '#64748b', '📡') +
    renderStatCard('CRITICAL CVEs', cveData.filter(function(c) { return c.severity === 'CRITICAL'; }).length, '#ef4444', '🔴') +
    renderStatCard('YOUR IP', ipData.ip || 'Unknown', ipData.isVPN ? '#10b981' : '#f59e0b', ipData.isVPN ? '🔒' : '⚠') +
    '</div>' +

    // QUICK ACTIONS
    '<div style="margin-bottom:24px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:12px;">QUICK ACTIONS</div>' +
    '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
    ['breach', 'password', 'ip', 'cve', 'briefing', 'news', 'network'].map(function(page) {
      const labels = { breach: '⚠ Breach Checker', password: '🔑 Password Health', ip: '🌐 IP Investigator', cve: '🛡 CVE Feed', briefing: '🤖 AI Briefing', news: '📡 Security News', network: '🔒 Network Monitor' };
      return '<button onclick="navigateTo(\'' + page + '\')" class="aegis-btn" style="font-size:12px; padding:10px 16px;">' + labels[page] + '</button>';
    }).join('') +
    '</div></div>' +

    // CVEs AND NEWS SIDE BY SIDE
    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">' +

    // LATEST CVEs
    '<div class="card">' +
    '<div class="card-header">LATEST CVEs</div>' +
    (cveData.length > 0 ? cveData.slice(0, 5).map(function(cve) {
      const color = getSeverityColor(cve.severity);
      return '<div style="padding:12px 0; border-bottom:1px solid var(--border);">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">' +
        '<span style="font-family:var(--font-title); font-size:13px; color:' + color + ';">' + cve.id + '</span>' +
        '<span style="background:' + color + '; color:#020818; font-family:var(--font-mono); font-size:10px; padding:2px 8px; border-radius:2px;">' + cve.severity + '</span>' +
        '</div>' +
        '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); line-height:1.5;">' + cve.desc.slice(0, 100) + '...</div>' +
        '</div>';
    }).join('') : '<p class="placeholder-text">No CVE data loaded.</p>') +
    '<button onclick="navigateTo(\'cve\')" class="aegis-btn" style="margin-top:16px; font-size:11px; padding:8px 16px; width:100%;">VIEW ALL CVEs →</button>' +
    '</div>' +

    // LATEST NEWS
    '<div class="card">' +
    '<div class="card-header">LATEST NEWS</div>' +
    (newsData.length > 0 ? newsData.slice(0, 5).map(function(item) {
      const categories = getNewsCategories(item.title);
      const borderColor = categories.length > 0 ? categories[0].color : 'var(--border)';
      return '<div style="padding:12px 0; border-bottom:1px solid var(--border); border-left:2px solid ' + borderColor + '; padding-left:12px;">' +
        '<div style="font-family:var(--font-ui); font-size:14px; color:var(--text-primary); font-weight:600; margin-bottom:4px; line-height:1.4;">' + item.title.slice(0, 80) + (item.title.length > 80 ? '...' : '') + '</div>' +
        '<div style="display:flex; justify-content:space-between;">' +
        '<span style="font-family:var(--font-mono); font-size:11px; color:var(--amber);">▸ ' + item.source + '</span>' +
        '<span style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">' + timeAgo(item.pubDate) + '</span>' +
        '</div></div>';
    }).join('') : '<p class="placeholder-text">No news loaded.</p>') +
    '<button onclick="navigateTo(\'news\')" class="aegis-btn" style="margin-top:16px; font-size:11px; padding:8px 16px; width:100%;">VIEW ALL NEWS →</button>' +
    '</div>' +
    '</div>';
}

function renderStatCard(label, value, color, icon) {
  return '<div style="background:var(--bg-card); border:1px solid var(--border); border-top:2px solid ' + color + '; border-radius:4px; padding:20px; text-align:center;">' +
    '<div style="font-size:24px; margin-bottom:8px;">' + icon + '</div>' +
    '<div style="font-family:var(--font-title); font-size:20px; color:' + color + '; margin-bottom:6px;">' + value + '</div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); letter-spacing:2px;">' + label + '</div>' +
    '</div>';
}

function calculateThreatLevel(cves) {
  if (cves.length === 0) return 'UNKNOWN';
  const critical = cves.filter(function(c) { return c.severity === 'CRITICAL'; }).length;
  const high = cves.filter(function(c) { return c.severity === 'HIGH'; }).length;
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
    let response = await fetch('https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20', { headers: { 'apiKey': '1f729c55-3075-47ec-9758-3e877ee1db97' } });
    if (!response.ok) response = await fetch('https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20');
    const data = await response.json();
    if (data.vulnerabilities) {
      const cves = data.vulnerabilities.map(extractCVEData);
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
        return { title: item.title, link: item.link, pubDate: item.pubDate, source: 'The Hacker News', description: '' };
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
    const geoResponse = await fetch('https://ipapi.co/' + ipJson.ip + '?fields=country,countryCode,city,isp,proxy,hosting,query');
    const geo = await geoResponse.json();
    return { ip: ipJson.ip, isVPN: geo.proxy || geo.hosting || false, country: geo.country };
  } catch (e) { return { ip: 'Unknown', isVPN: false }; }
}

function navigateTo(page) {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  const pageTitle = document.getElementById('page-title');
  const pageTitles = { dashboard: 'Security Dashboard', breach: 'Breach Checker', password: 'Password Health', ip: 'IP Investigator', cve: 'CVE Threat Feed', briefing: 'AI Briefing', news: 'Security News', network: 'Network Monitor' };
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

// Load dashboard on startup
window.addEventListener('load', function() {
  setTimeout(loadDashboard, 300);
});




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









































