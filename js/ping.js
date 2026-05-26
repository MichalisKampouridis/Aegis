// PING AUTOCOMPLETE AND KNOWN HOSTS PANEL
function initPingShortcuts() {
  const input = document.getElementById('ping-input');
  if (!input) return;

  // AUTOCOMPLETE
  const inputRow = input.parentElement;
  inputRow.style.position = 'relative';

  const autocompleteDiv = document.createElement('div');
  autocompleteDiv.id = 'ping-autocomplete';
  autocompleteDiv.style.cssText = 'position:absolute; top:100%; left:0; right:80px; background:var(--bg-card); border:1px solid var(--amber); border-top:none; border-radius:0 0 3px 3px; z-index:100; max-height:200px; overflow-y:auto; display:none;';
  inputRow.appendChild(autocompleteDiv);

  input.addEventListener('input', function() {
    const val = input.value.toLowerCase().trim();
    if (!val) { autocompleteDiv.style.display = 'none'; return; }
    const matches = Object.keys(KNOWN_HOSTS).filter(function(k) {
      return k.includes(val) || KNOWN_HOSTS[k].includes(val);
    }).slice(0, 8);
    if (matches.length === 0) { autocompleteDiv.style.display = 'none'; return; }
    autocompleteDiv.style.display = 'block';
    autocompleteDiv.innerHTML = matches.map(function(k) {
      return '<div class="ping-ac-item" data-key="' + k + '" style="padding:10px 16px; font-family:var(--font-mono); font-size:13px; color:var(--text-primary); cursor:pointer; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">' +
        '<span style="color:var(--amber);">' + k + '</span>' +
        '<span style="color:var(--text-dim); font-size:11px;">' + KNOWN_HOSTS[k] + '</span>' +
        '</div>';
    }).join('');

    autocompleteDiv.querySelectorAll('.ping-ac-item').forEach(function(item) {
      item.addEventListener('mouseover', function() { item.style.background = 'var(--amber-glow)'; });
      item.addEventListener('mouseout', function() { item.style.background = ''; });
      item.addEventListener('click', function() {
        input.value = item.dataset.key;
        autocompleteDiv.style.display = 'none';
        runPing();
      });
    });
  });

  document.addEventListener('click', function(e) {
    if (!inputRow.contains(e.target)) autocompleteDiv.style.display = 'none';
  });

  // QUICK SHORTCUTS
  const shortcuts = document.getElementById('ping-shortcuts');
  if (!shortcuts) return;
  const common = ['google', 'cloudflare', 'github', 'facebook', 'youtube', 'tryhackme', 'hackthebox', 'discord'];
  shortcuts.innerHTML = common.map(function(name) {
    return '<button class="ping-shortcut" data-name="' + name + '" style="background:transparent; border:1px solid var(--border); color:var(--text-dim); font-family:var(--font-mono); font-size:12px; padding:6px 14px; border-radius:2px; cursor:pointer; transition:all 0.2s;">' + name + '</button>';
  }).join('');

  shortcuts.querySelectorAll('.ping-shortcut').forEach(function(btn) {
    btn.addEventListener('mouseover', function() { btn.style.borderColor = 'var(--amber)'; btn.style.color = 'var(--amber)'; });
    btn.addEventListener('mouseout', function() { btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--text-dim)'; });
    btn.addEventListener('click', function() { quickPing(btn.dataset.name); });
  });

  // KNOWN HOSTS PANEL
  if (document.getElementById('known-hosts-panel')) return;

  const categories = {
    'Search & Social': ['google', 'facebook', 'twitter', 'x', 'instagram', 'youtube', 'linkedin', 'reddit', 'tiktok', 'discord', 'twitch', 'whatsapp', 'telegram'],
    'Tech & Cloud': ['microsoft', 'apple', 'amazon', 'netflix', 'spotify', 'github', 'stackoverflow', 'cloudflare', 'openai', 'anthropic', 'claude', 'aws', 'azure', 'digitalocean'],
    'DNS Servers': ['google dns', 'cloudflare dns', 'opendns', 'quad9'],
    'Security Tools': ['hackernews', 'bleepingcomputer', 'darkreading', 'krebs', 'shodan', 'virustotal', 'haveibeenpwned', 'tryhackme', 'hackthebox', 'cybrary'],
    'Greek Sites': ['cosmote', 'vodafone greece', 'wind', 'nova', 'forthnet', 'skroutz', 'e-shop', 'public', 'taxisnet', 'efka'],
    'Gaming': ['steam', 'epicgames', 'riot', 'leagueoflegends', 'battlenet', 'playstation', 'xbox'],
    'Other': ['wikipedia', 'dropbox', 'googledrive', 'gmail', 'outlook', 'yahoo', 'bing', 'duckduckgo', 'nordvpn', 'tor']
  };

  const panel = document.createElement('div');
  panel.id = 'known-hosts-panel';
  panel.style.cssText = 'margin-top:16px;';

  const header = document.createElement('div');
  header.style.cssText = 'font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; cursor:pointer; padding:10px 0; border-top:1px solid var(--border); display:flex; justify-content:space-between;';
  header.innerHTML = 'KNOWN HOSTS (' + Object.keys(KNOWN_HOSTS).length + ') <span>▼ EXPAND</span>';

  const body = document.createElement('div');
  body.style.display = 'none';

  Object.keys(categories).forEach(function(cat) {
    const catDiv = document.createElement('div');
    catDiv.style.cssText = 'margin-bottom:16px;';
    catDiv.innerHTML = '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); letter-spacing:2px; margin-bottom:8px; margin-top:12px;">' + cat.toUpperCase() + '</div>';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px;';

    categories[cat].forEach(function(name) {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.style.cssText = 'background:transparent; border:1px solid var(--border); color:var(--text-dim); font-family:var(--font-mono); font-size:11px; padding:5px 12px; border-radius:2px; cursor:pointer; transition:all 0.2s;';
      btn.addEventListener('mouseover', function() { btn.style.borderColor = 'var(--amber)'; btn.style.color = 'var(--amber)'; });
      btn.addEventListener('mouseout', function() { btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--text-dim)'; });
      btn.addEventListener('click', function() { quickPing(name); });
      btnRow.appendChild(btn);
    });

    catDiv.appendChild(btnRow);
    body.appendChild(catDiv);
  });

  header.addEventListener('click', function() {
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    header.querySelector('span').textContent = isOpen ? '▼ EXPAND' : '▲ COLLAPSE';
  });

  panel.appendChild(header);
  panel.appendChild(body);
  shortcuts.after(panel);
}

function quickPing(name) {
  document.getElementById('ping-input').value = name;
  runPing();
}

function stopPing() {
  pingRunning = false;
  document.getElementById('ping-stop-btn').style.display = 'none';
  const resultDiv = document.getElementById('ping-result');
  if (pingResults.length > 0) {
    const successful = pingResults.filter(function(r) { return r !== null; });
    if (successful.length > 0) {
      const min = Math.min.apply(null, successful);
      const max = Math.max.apply(null, successful);
      const avg = Math.round(successful.reduce(function(a, b) { return a + b; }, 0) / successful.length);
      resultDiv.innerHTML += '<div style="font-family:var(--font-mono); font-size:13px; color:var(--amber); margin-top:12px; padding-top:12px; border-top:1px solid var(--border);">--- PING STATISTICS ---<br>' +
        '<span style="color:var(--text-primary);">' + pingResults.length + ' packets transmitted, ' + successful.length + ' received, ' + (pingResults.length - successful.length) + ' lost</span><br>' +
        'MIN: <span style="color:#10b981;">' + min + 'ms</span> · AVG: <span style="color:#f59e0b;">' + avg + 'ms</span> · MAX: <span style="color:#ef4444;">' + max + 'ms</span></div>';
    }
  }
}

async function runPing() {
  const input = document.getElementById('ping-input').value.trim().toLowerCase();
  const resultDiv = document.getElementById('ping-result');
  if (!input) return;

  let host = input;
  if (KNOWN_HOSTS[input]) host = KNOWN_HOSTS[input];

  pingRunning = true;
  pingResults = [];
  document.getElementById('ping-stop-btn').style.display = 'block';

  resultDiv.innerHTML = '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); margin-bottom:12px;">PING ' + host + ' — 10 packets</div><div id="ping-lines"></div>';

  const linesDiv = document.getElementById('ping-lines');

  for (let i = 1; i <= 10; i++) {
    if (!pingRunning) break;
    try {
      const start = performance.now();
      await fetch('https://' + host + '/favicon.ico?_=' + Date.now(), { mode: 'no-cors', cache: 'no-store' });
      const ms = Math.round(performance.now() - start);
      pingResults.push(ms);
      const color = ms < 100 ? '#10b981' : ms < 300 ? '#f59e0b' : '#ef4444';
      linesDiv.innerHTML += '<div style="font-family:var(--font-mono); font-size:13px; color:' + color + '; margin-bottom:4px;">Reply from <span style="color:var(--text-primary);">' + host + '</span>: seq=' + i + ' time=<span style="font-weight:bold;">' + ms + 'ms</span> <span style="font-size:11px; background:' + color + '22; border:1px solid ' + color + '; padding:1px 6px; border-radius:2px;">' + (ms < 100 ? 'FAST' : ms < 300 ? 'OK' : 'SLOW') + '</span></div>';
    } catch (e) {
      pingResults.push(null);
      linesDiv.innerHTML += '<div style="font-family:var(--font-mono); font-size:13px; color:#ef4444; margin-bottom:4px;">Request timeout for seq=' + i + '</div>';
    }
    await new Promise(function(r) { setTimeout(r, 500); });
  }

  if (pingRunning) stopPing();
}
