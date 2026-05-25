// PAGE NAVIGATION
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('page-title');

const pageTitles = {
  breach: 'Breach Checker',
  password: 'Password Health',
  ip: 'IP Investigator',
  cve: 'CVE Threat Feed',
  briefing: 'AI Briefing',
  news: 'Security News'
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
  });
});

// LIVE CLOCK
function updateClock() {
  const now = new Date();
  const timeStr = now.toUTCString().replace('GMT', 'UTC');
  document.getElementById('live-time').textContent = timeStr;
}
updateClock();
setInterval(updateClock, 1000);


// TOGGLE PASSWORD VISIBILITY
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














// IP / DOMAIN INVESTIGATOR — FULL EDITION
const KNOWN_SAFE = {
  '8.8.8.8': 'Google Public DNS',
  '8.8.4.4': 'Google Public DNS',
  '1.1.1.1': 'Cloudflare DNS',
  '1.0.0.1': 'Cloudflare DNS',
  '9.9.9.9': 'Quad9 DNS',
  '208.67.222.222': 'OpenDNS',
  '208.67.220.220': 'OpenDNS',
  '4.2.2.1': 'Level3 DNS',
  '4.2.2.2': 'Level3 DNS',
  '149.112.112.112': 'Quad9 DNS'
};

const KNOWN_MALICIOUS = [
  '185.220.101.', '185.220.100.', '162.247.74.', '199.87.154.',
  '171.25.193.', '176.10.104.', '77.247.181.', '46.165.230.'
];

let ipSearchHistory = [];

function addToHistory(query, threat, color) {
  ipSearchHistory = ipSearchHistory.filter(h => h.query !== query);
  ipSearchHistory.unshift({ query, threat, color });
  if (ipSearchHistory.length > 10) ipSearchHistory.pop();
  renderHistory();
}

function renderHistory() {
  const histDiv = document.getElementById('ip-history');
  if (!histDiv) return;
  if (ipSearchHistory.length === 0) {
    histDiv.innerHTML = '<p class="placeholder-text" style="font-size:10px;">No recent searches</p>';
    return;
  }
  histDiv.innerHTML = ipSearchHistory.map(h => `
    <div onclick="loadFromHistory('${h.query}')" style="cursor:pointer; padding:6px 10px; margin-bottom:4px; background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ${h.color}; border-radius:2px; font-family:var(--font-mono); font-size:11px; color:${h.color}; transition:all 0.2s;" onmouseover="this.style.background='var(--amber-glow)'" onmouseout="this.style.background='var(--bg-secondary)'">
      ${h.query} <span style="color:var(--text-dim); font-size:10px;">— ${h.threat}</span>
    </div>
  `).join('');
}

function loadFromHistory(query) {
  document.getElementById('ip-input').value = query;
  investigateIP();
}

function copyIPReport() {
  const reportText = document.getElementById('ip-report-text').innerText;
  navigator.clipboard.writeText(reportText).then(() => {
    const btn = document.getElementById('copy-ip-btn');
    btn.textContent = '✓ COPIED';
    btn.style.color = '#10b981';
    btn.style.borderColor = '#10b981';
    setTimeout(() => {
      btn.textContent = '⎘ COPY REPORT';
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 2000);
  });
}

async function investigateIP() {
  const input = document.getElementById('ip-input').value.trim();
  const resultDiv = document.getElementById('ip-result');

  if (!input) {
    resultDiv.innerHTML = '<p class="placeholder-text">Please enter an IP address or domain.</p>';
    return;
  }

  resultDiv.innerHTML = '<p class="loading">INVESTIGATING TARGET...</p>';

  try {
    // MAIN IP DATA
    const ipResponse = await fetch(`http://ip-api.com/json/${encodeURIComponent(input)}?fields=status,message,country,countryCode,regionName,city,isp,org,as,proxy,hosting,query`);
    const d = await ipResponse.json();

    if (d.status === 'fail') {
      resultDiv.innerHTML = `<p class="placeholder-text">Error: ${d.message}</p>`;
      return;
    }

    // REVERSE DNS
    let reverseDNS = 'Unavailable';
    try {
      const dnsResponse = await fetch(`https://dns.google/resolve?name=${d.query}&type=PTR`);
      const dnsData = await dnsResponse.json();
      if (dnsData.Answer && dnsData.Answer.length > 0) {
        reverseDNS = dnsData.Answer[0].data.replace(/\.$/, '');
      } else {
        reverseDNS = 'No PTR record found';
      }
    } catch (e) { reverseDNS = 'Lookup failed'; }

    // WHOIS
    let whoisHTML = '';
    try {
      const whoisResponse = await fetch(`https://whoisjson.com/api/v1/whois?domain=${encodeURIComponent(input)}`);
      const whoisData = await whoisResponse.json();
      if (whoisData && !whoisData.error) {
        const created = whoisData.created_date ? new Date(whoisData.created_date).toLocaleDateString() : 'Unknown';
        const expires = whoisData.expiration_date ? new Date(whoisData.expiration_date).toLocaleDateString() : 'Unknown';
        const registrar = whoisData.registrar || 'Unknown';
        const registrant = whoisData.registrant_name || whoisData.registrant_org || 'Redacted';
        whoisHTML = `
          <div style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
            <div style="font-family:var(--font-mono); font-size:10px; color:var(--amber); letter-spacing:2px; margin-bottom:8px;">WHOIS DATA</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">
              <div>REGISTRAR: <span style="color:var(--text-primary)">${registrar}</span></div>
              <div>REGISTRANT: <span style="color:var(--text-primary)">${registrant}</span></div>
              <div>CREATED: <span style="color:var(--text-primary)">${created}</span></div>
              <div>EXPIRES: <span style="color:var(--text-primary)">${expires}</span></div>
            </div>
          </div>`;
      }
    } catch (e) {}

    // THREAT SCORING
    let threatScore = 0;
    let threatReasons = [];
    let knownSafeLabel = null;

    if (KNOWN_SAFE[d.query]) knownSafeLabel = KNOWN_SAFE[d.query];
    const isMalicious = KNOWN_MALICIOUS.some(range => d.query.startsWith(range));
    if (isMalicious) { threatScore += 80; threatReasons.push('Known malicious IP range'); }
    if (d.proxy && !knownSafeLabel) { threatScore += 40; threatReasons.push('Proxy / VPN detected'); }
    if (d.hosting && !knownSafeLabel) { threatScore += 20; threatReasons.push('Hosted in datacenter'); }
    const highRiskCountries = ['CN', 'RU', 'KP', 'IR', 'NG', 'RO'];
    if (highRiskCountries.includes(d.countryCode) && !knownSafeLabel) {
      threatScore += 15;
      threatReasons.push('High-risk origin country');
    }

    let threat, threatColor, threatBg;
    if (knownSafeLabel) {
      threat = '✅ TRUSTED'; threatColor = '#10b981'; threatBg = 'rgba(16, 185, 129, 0.08)';
    } else if (threatScore >= 60) {
      threat = '🔴 HIGH THREAT'; threatColor = '#ef4444'; threatBg = 'rgba(239, 68, 68, 0.08)';
    } else if (threatScore >= 25) {
      threat = '⚡ SUSPICIOUS'; threatColor = '#f59e0b'; threatBg = 'rgba(245, 158, 11, 0.08)';
    } else {
      threat = '✅ CLEAN'; threatColor = '#10b981'; threatBg = 'rgba(16, 185, 129, 0.08)';
    }

    const barWidth = knownSafeLabel ? 0 : Math.min(threatScore, 100);
    addToHistory(d.query, threat.replace(/[^\w\s]/g, '').trim(), threatColor);

    const reportText = `AEGIS IP INVESTIGATION REPORT
==============================
TARGET: ${d.query}
VERDICT: ${threat}
THREAT SCORE: ${knownSafeLabel ? 'N/A (Trusted)' : threatScore + '/100'}
REVERSE DNS: ${reverseDNS}
COUNTRY: ${d.country} (${d.countryCode})
REGION: ${d.regionName}
CITY: ${d.city}
ISP: ${d.isp}
ORGANIZATION: ${d.org}
AS NUMBER: ${d.as}
PROXY/VPN: ${d.proxy && !knownSafeLabel ? 'YES' : 'No'}
DATACENTER: ${d.hosting && !knownSafeLabel ? 'YES' : 'No'}
THREAT INDICATORS: ${threatReasons.length > 0 ? threatReasons.join(', ') : 'None'}
GENERATED: ${new Date().toUTCString()}`;

    resultDiv.innerHTML = `
      <div id="ip-report-text" class="breach-card" style="border-left-color:${threatColor}; background:${threatBg}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div class="breach-name" style="color:${threatColor}; font-size:15px;">${threat} — ${d.query}</div>
          <button id="copy-ip-btn" onclick="copyIPReport()" class="aegis-btn" style="font-size:9px; padding:6px 12px;">⎘ COPY REPORT</button>
        </div>
        ${knownSafeLabel ? `<div style="font-family:var(--font-mono); font-size:11px; color:#10b981; margin-bottom:12px;">✓ Verified: ${knownSafeLabel}</div>` : ''}

        ${!knownSafeLabel ? `
        <div style="margin:12px 0;">
          <div style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim); letter-spacing:2px; margin-bottom:6px;">THREAT SCORE</div>
          <div style="background:#0a0f1e; border-radius:2px; height:6px; width:100%;">
            <div style="background:${threatColor}; height:6px; width:${barWidth}%; border-radius:2px; box-shadow:0 0 8px ${threatColor};"></div>
          </div>
          <div style="font-family:var(--font-mono); font-size:11px; color:${threatColor}; margin-top:4px;">${threatScore}/100</div>
        </div>` : ''}

        ${threatReasons.length > 0 ? `
        <div style="margin-bottom:12px;">
          <div style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim); letter-spacing:2px; margin-bottom:6px;">THREAT INDICATORS</div>
          ${threatReasons.map(r => `<div style="font-family:var(--font-mono); font-size:11px; color:${threatColor}; margin-bottom:3px;">▸ ${r}</div>`).join('')}
        </div>` : ''}

        <div class="breach-detail" style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
          <div style="font-family:var(--font-mono); font-size:10px; color:var(--amber); letter-spacing:2px; margin-bottom:8px;">NETWORK INTELLIGENCE</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>REVERSE DNS: <span style="color:var(--text-primary)">${reverseDNS}</span></div>
            <div>COUNTRY: <span>${d.country} (${d.countryCode})</span></div>
            <div>REGION: <span>${d.regionName}</span></div>
            <div>CITY: <span>${d.city}</span></div>
            <div>ISP: <span>${d.isp}</span></div>
            <div>ORGANIZATION: <span>${d.org}</span></div>
            <div>AS NUMBER: <span>${d.as}</span></div>
            <div>PROXY / VPN: <span style="color:${d.proxy && !knownSafeLabel ? '#ef4444' : '#10b981'}">${d.proxy && !knownSafeLabel ? 'YES ⚠' : 'No'}</span></div>
            <div>DATACENTER: <span style="color:${d.hosting && !knownSafeLabel ? '#f59e0b' : '#10b981'}">${d.hosting && !knownSafeLabel ? 'YES ⚡' : 'No'}</span></div>
          </div>
        </div>
        ${whoisHTML}
      </div>
      <div class="result-label" style="margin-top:8px;">Data sourced from ip-api.com · Threat scoring by Aegis Intelligence Engine · ${new Date().toUTCString()}</div>
    `;

  } catch (error) {
    resultDiv.innerHTML = `<p class="placeholder-text">Error: ${error.message}</p>`;
  }
}

document.getElementById('ip-btn').addEventListener('click', investigateIP);
document.getElementById('ip-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') investigateIP();
});





// PASSWORD HEALTH CHECK — ULTIMATE EDITION
function calculateEntropy(password) {
  let charset = 0;
  if (/[a-z]/.test(password)) charset += 26;
  if (/[A-Z]/.test(password)) charset += 26;
  if (/[0-9]/.test(password)) charset += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charset += 32;
  return Math.round(password.length * Math.log2(charset || 1));
}

function estimateCrackTime(entropy) {
  const guessesPerSecond = 1e12;
  const combinations = Math.pow(2, entropy);
  const seconds = combinations / guessesPerSecond / 2;
  if (seconds < 1) return 'Instantly';
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds/60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds/3600)} hours`;
  if (seconds < 31536000) return `${Math.round(seconds/86400)} days`;
  if (seconds < 3153600000) return `${Math.round(seconds/31536000)} years`;
  if (seconds < 3.154e13) return `${Math.round(seconds/3153600000)} thousand years`;
  if (seconds < 3.154e16) return `${Math.round(seconds/3.154e13)} million years`;
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
  if (!breachDiv) return;
  if (password === lastBreachChecked) return;
  lastBreachChecked = password;
  breachDiv.innerHTML = '<p class="loading" style="font-size:11px;">Checking breach database...</p>';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    const text = await response.text();
    let count = 0;
    for (const line of text.split('\n')) {
      const [hashSuffix, hashCount] = line.split(':');
      if (hashSuffix.trim() === suffix) { count = parseInt(hashCount.trim()); break; }
    }
    if (!document.getElementById('breach-check-result')) return;
    if (count === 0) {
      breachDiv.innerHTML = `<div class="safe-banner" style="margin-top:0;">✅ NOT FOUND IN ANY KNOWN DATA BREACH<br><span style="font-size:10px; opacity:0.7;">Checked via HaveIBeenPwned k-anonymity API. Your password was never transmitted.</span></div>`;
    } else {
      breachDiv.innerHTML = `<div class="danger-banner" style="margin-top:0;">⚠ FOUND IN ${count.toLocaleString()} KNOWN DATA BREACHES<br><span style="font-size:10px; opacity:0.7;">Change this password immediately on any account using it.</span></div>`;
    }
  } catch (e) {
    if (document.getElementById('breach-check-result')) {
      document.getElementById('breach-check-result').innerHTML = '<p class="placeholder-text" style="font-size:11px;">Breach check unavailable.</p>';
    }
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

  resultDiv.innerHTML = `
    <div class="breach-card" style="border-left-color:${strengthColor}">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div class="breach-name" style="color:${strengthColor}; font-size:15px;">STRENGTH: ${strengthLabel}</div>
        <div style="width:48px; height:48px; border-radius:50%; border:2px solid ${strengthColor}; display:flex; align-items:center; justify-content:center; font-family:var(--font-title); font-size:16px; font-weight:900; color:${strengthColor}; box-shadow:0 0 12px ${strengthColor}40;">${grade}</div>
      </div>

      <div style="margin:12px 0;">
        <div style="background:#0a0f1e; border-radius:2px; height:8px; width:100%;">
          <div style="background:${strengthColor}; height:8px; width:${strengthPercent}%; border-radius:2px; box-shadow:0 0 8px ${strengthColor}; transition:width 0.3s;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:4px;">
          <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">WEAK</span>
          <span style="font-family:var(--font-mono); font-size:10px; color:${strengthColor};">${score}/6</span>
          <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">STRONG</span>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
        <div style="background:var(--bg-secondary); padding:12px; border-radius:3px; border:1px solid var(--border);">
          <div style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim); letter-spacing:2px; margin-bottom:4px;">ENTROPY</div>
          <div style="font-family:var(--font-title); font-size:20px; color:${strengthColor};">${entropy} <span style="font-size:11px;">bits</span></div>
        </div>
        <div style="background:var(--bg-secondary); padding:12px; border-radius:3px; border:1px solid var(--border);">
          <div style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim); letter-spacing:2px; margin-bottom:4px;">CRACK TIME</div>
          <div style="font-family:var(--font-title); font-size:14px; color:${strengthColor}; word-break:break-word;">${crackTime}</div>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-family:var(--font-mono); font-size:10px; color:var(--amber); letter-spacing:2px; margin-bottom:8px;">CHARACTER BREAKDOWN</div>
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; text-align:center;">
          <div style="background:var(--bg-secondary); padding:8px; border-radius:3px; border:1px solid var(--border);">
            <div style="font-family:var(--font-title); font-size:18px; color:#60a5fa;">${lower}</div>
            <div style="font-family:var(--font-mono); font-size:9px; color:var(--text-dim);">LOWER</div>
          </div>
          <div style="background:var(--bg-secondary); padding:8px; border-radius:3px; border:1px solid var(--border);">
            <div style="font-family:var(--font-title); font-size:18px; color:#a78bfa;">${upper}</div>
            <div style="font-family:var(--font-mono); font-size:9px; color:var(--text-dim);">UPPER</div>
          </div>
          <div style="background:var(--bg-secondary); padding:8px; border-radius:3px; border:1px solid var(--border);">
            <div style="font-family:var(--font-title); font-size:18px; color:#34d399;">${numbers}</div>
            <div style="font-family:var(--font-mono); font-size:9px; color:var(--text-dim);">NUMBERS</div>
          </div>
          <div style="background:var(--bg-secondary); padding:8px; border-radius:3px; border:1px solid var(--border);">
            <div style="font-family:var(--font-title); font-size:18px; color:#fb7185;">${symbols}</div>
            <div style="font-family:var(--font-mono); font-size:9px; color:var(--text-dim);">SYMBOLS</div>
          </div>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-family:var(--font-mono); font-size:10px; color:var(--amber); letter-spacing:2px; margin-bottom:8px;">SECURITY CHECKS</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
          ${[
            ['8+ characters', checks.length8],
            ['12+ characters', checks.length12],
            ['16+ characters', checks.length16],
            ['Uppercase letters', checks.hasUpper],
            ['Lowercase letters', checks.hasLower],
            ['Numbers', checks.hasNumber],
            ['Special symbols', checks.hasSymbol],
            ['No repeated chars', checks.noRepeat],
            ['No sequential patterns', checks.noSequential],
            ['No keyboard walks', checks.noKeyboardWalk],
            ['Not a common password', checks.noCommon]
          ].map(([label, passed]) => `
            <div style="font-family:var(--font-mono); font-size:11px; color:${passed ? '#10b981' : '#ef4444'};">
              ${passed ? '✓' : '✗'} ${label}
            </div>
          `).join('')}
        </div>
      </div>

      ${suggestions.length > 0 ? `
      <div style="margin-bottom:16px;">
        <div style="font-family:var(--font-mono); font-size:10px; color:var(--amber); letter-spacing:2px; margin-bottom:8px;">RECOMMENDATIONS</div>
        ${suggestions.map(s => `<div style="font-family:var(--font-mono); font-size:11px; color:#f59e0b; margin-bottom:3px;">▸ ${s}</div>`).join('')}
      </div>` : ''}

      <div id="breach-check-result"><p class="loading" style="font-size:11px;">Checking breach database...</p></div>
    </div>
  `;

  clearTimeout(breachCheckTimeout);
  breachCheckTimeout = setTimeout(() => runBreachCheck(password), 600);
}

// LIVE ANALYSIS
document.getElementById('password-input').addEventListener('input', (e) => {
  renderPasswordAnalysis(e.target.value);
});



document.getElementById('password-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') renderPasswordAnalysis(e.target.value);
});

// PASSWORD GENERATOR
document.getElementById('generate-pw-btn').addEventListener('click', () => {
  const pwd = generatePassword();
  const input = document.getElementById('password-input');
  input.type = 'text';
  input.value = pwd;
  document.getElementById('toggle-pw').style.color = '#f59e0b';
  renderPasswordAnalysis(pwd);
});

// PASTE SUPPORT FOR PASSWORD
document.getElementById('password-input').addEventListener('paste', (e) => {
  setTimeout(() => renderPasswordAnalysis(e.target.value), 50);
});

