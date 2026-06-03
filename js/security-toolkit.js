'use strict';

// ─── SECURITY TOOLKIT ─────────────────────────────────────────

const ST_PROXY = 'https://aegis-proxy.ka-mixalis99.workers.dev/?url=';

// ── Tab management ────────────────────────────────────────────
let stActiveTab = 'ask-aegis';

function stSwitchTab(tab) {
  stActiveTab = tab;
  document.querySelectorAll('[data-st-tab]').forEach(function(btn) {
    const isActive = btn.dataset.stTab === tab;
    btn.style.background    = isActive ? 'rgba(245,158,11,0.1)' : 'transparent';
    btn.style.color         = isActive ? '#f59e0b' : '#64748b';
    btn.style.borderColor   = isActive ? '#f59e0b' : '#1e2d4a';
  });
  document.querySelectorAll('.st-panel').forEach(function(panel) {
    panel.style.display = 'none';
  });
  const activePanel = document.getElementById('st-panel-' + tab);
  if (activePanel) activePanel.style.display = tab === 'ask-aegis' ? 'flex' : 'block';
}

function stEscapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

// ── ASK AEGIS ────────────────────────────────────────────────
const ST_SYSTEM = 'You are Aegis AI, a senior cybersecurity analyst assistant. You provide expert security advice, explain vulnerabilities, analyze threats, and help with cybersecurity tasks. Be precise, technical, and actionable.';

let stChatMessages = [];
let stChatTyping   = false;

async function stInitChat() {
  if (stChatMessages.length > 0) return;
  try {
    if (window.aegis && window.aegis.getChatHistory) {
      const saved = await window.aegis.getChatHistory();
      if (saved && saved.length) { stChatMessages = saved; stRenderChat(); return; }
    }
    const raw = localStorage.getItem('aegis_chat_history');
    if (raw) { stChatMessages = JSON.parse(raw).slice(-50); stRenderChat(); }
  } catch (_) {}
}

function stRenderChat() {
  const container = document.getElementById('st-chat-messages');
  if (!container) return;

  if (stChatMessages.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding:60px 20px;">' +
      '<div style="font-family:var(--font-title); font-size:14px; color:var(--amber); letter-spacing:3px; margin-bottom:10px;">AEGIS AI ANALYST</div>' +
      '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-dim); max-width:400px; margin:0 auto; line-height:1.8;">Ask me anything about cybersecurity — CVEs, threats, hardening advice, log analysis, or incident response.</div>' +
      '</div>';
    return;
  }

  container.innerHTML = stChatMessages.map(function(msg) {
    if (msg.role === 'user') {
      return '<div style="display:flex; justify-content:flex-end; margin-bottom:4px;">' +
        '<div style="max-width:72%; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); border-radius:4px; padding:12px 16px; font-family:var(--font-mono); font-size:13px; color:#fcd34d; line-height:1.7;">' +
        stEscapeHtml(msg.content) +
        '</div></div>';
    }
    return '<div style="display:flex; justify-content:flex-start; margin-bottom:4px;">' +
      '<div style="max-width:82%; background:var(--bg-secondary); border:1px solid var(--border); border-radius:4px; padding:14px 16px; font-family:var(--font-mono); font-size:13px; color:var(--text-primary); line-height:1.75;">' +
      renderBriefingMarkdown(msg.content) +
      '</div></div>';
  }).join('');

  container.scrollTop = container.scrollHeight;
}

async function stSendChat() {
  if (stChatTyping) return;
  const input   = document.getElementById('st-chat-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  input.style.height = '60px';

  stChatMessages.push({ role: 'user', content: message });
  stRenderChat();

  stChatTyping = true;
  const typingEl = document.getElementById('st-typing-indicator');
  if (typingEl) typingEl.style.display = 'block';

  try {
    const resp = await fetch(ST_PROXY + encodeURIComponent('https://api.anthropic.com/v1/messages'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: ST_SYSTEM,
        messages: stChatMessages.slice(-20).map(function(m) {
          return { role: m.role, content: m.content };
        })
      })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    stChatMessages.push({ role: 'assistant', content: data.content[0].text });
    stSaveChatHistory();
  } catch (err) {
    stChatMessages.push({ role: 'assistant', content: '**Error:** ' + err.message + '\n\nPlease check your connection and try again.' });
  }

  stChatTyping = false;
  if (typingEl) typingEl.style.display = 'none';
  stRenderChat();
}

function stChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); stSendChat(); }
}

function stQuickPrompt(text) {
  const input = document.getElementById('st-chat-input');
  if (input) { input.value = text; input.focus(); }
}

function stClearChat() {
  stChatMessages = [];
  stSaveChatHistory();
  stRenderChat();
}

async function stSaveChatHistory() {
  const toSave = stChatMessages.slice(-50);
  try {
    if (window.aegis && window.aegis.saveChatHistory) { await window.aegis.saveChatHistory(toSave); return; }
    localStorage.setItem('aegis_chat_history', JSON.stringify(toSave));
  } catch (_) {}
}

// ── SSL CERTIFICATE CHECKER ────────────────────────────────────

let sslCheckHistory = [];

async function stCheckSSL() {
  const input     = document.getElementById('st-ssl-input');
  const resultDiv = document.getElementById('st-ssl-result');
  const domain    = (input.value || '').trim().replace(/^https?:\/\//i, '').replace(/[/?#:].*/,'').trim();

  if (!domain) {
    resultDiv.innerHTML = '<p class="placeholder-text">Enter a domain name (e.g. google.com).</p>';
    return;
  }

  resultDiv.innerHTML =
    '<div style="font-family:var(--font-mono);font-size:12px;color:var(--text-dim);letter-spacing:2px;margin-bottom:10px;">CONNECTING TO ' + stEscapeHtml(domain) + ':443...</div>' +
    '<div style="width:100%;height:3px;background:var(--bg-secondary);border-radius:2px;"><div style="height:3px;background:#f59e0b;border-radius:2px;animation:loadingBar 2s ease-in-out infinite;"></div></div>';

  if (!window.aegis || !window.aegis.checkSSL) {
    resultDiv.innerHTML = '<p class="placeholder-text">SSL check requires the Electron runtime.</p>';
    return;
  }

  try {
    const data = await window.aegis.checkSSL(domain);
    sslAddHistory(domain, data);
    stRenderSSLResult(resultDiv, domain, data);
  } catch (e) {
    resultDiv.innerHTML = '<p class="placeholder-text">Error: ' + stEscapeHtml(e.message) + '</p>';
  }
}

function sslAddHistory(domain, data) {
  sslCheckHistory = sslCheckHistory.filter(function(h) { return h.domain !== domain; });
  sslCheckHistory.unshift({ domain: domain, ok: data.success && !data.isExpired && data.authorized });
  if (sslCheckHistory.length > 5) sslCheckHistory.pop();
  sslRenderHistory();
}

function sslRenderHistory() {
  const el = document.getElementById('st-ssl-history');
  if (!el || sslCheckHistory.length === 0) return;
  el.innerHTML =
    '<div style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim);letter-spacing:1px;margin-bottom:8px;">RECENT CHECKS</div>' +
    sslCheckHistory.map(function(h) {
      const c = h.ok ? '#10b981' : '#ef4444';
      return '<button onclick="document.getElementById(\'st-ssl-input\').value=\'' + h.domain.replace(/'/g, '') + '\';stCheckSSL();" ' +
        'style="background:var(--bg-secondary);border:1px solid var(--border);border-left:3px solid ' + c + ';color:var(--text-primary);' +
        'font-family:var(--font-mono);font-size:11px;padding:5px 12px;border-radius:2px;cursor:pointer;margin-right:6px;margin-bottom:6px;">' +
        stEscapeHtml(h.domain) + '</button>';
    }).join('');
}

function stRenderSSLResult(resultDiv, domain, data) {
  if (!data.success) {
    resultDiv.innerHTML =
      '<div style="background:#0d1526;border:1px solid #ef4444;border-top:3px solid #ef4444;border-radius:4px;padding:24px;">' +
      '<div style="font-family:var(--font-title);font-size:20px;color:#ef4444;letter-spacing:3px;margin-bottom:10px;">&#9888; UNREACHABLE</div>' +
      '<div style="font-family:var(--font-mono);font-size:13px;color:var(--text-primary);margin-bottom:6px;">' + stEscapeHtml(domain) + '</div>' +
      '<div style="font-family:var(--font-mono);font-size:12px;color:var(--text-dim);">' + stEscapeHtml(data.error || 'Unknown error') + '</div>' +
      '</div>';
    return;
  }

  // Status classification
  let statusLabel, statusColor, statusBg;
  if (data.isExpired) {
    statusLabel = 'EXPIRED';  statusColor = '#ef4444'; statusBg = 'rgba(239,68,68,0.06)';
  } else if (!data.authorized || !data.domainMatches) {
    statusLabel = 'INVALID';  statusColor = '#ef4444'; statusBg = 'rgba(239,68,68,0.06)';
  } else if (data.daysLeft <= 10) {
    statusLabel = 'WARNING';  statusColor = '#ef4444'; statusBg = 'rgba(239,68,68,0.06)';
  } else if (data.daysLeft <= 30) {
    statusLabel = 'WARNING';  statusColor = '#f59e0b'; statusBg = 'rgba(245,158,11,0.06)';
  } else {
    statusLabel = 'SECURE';   statusColor = '#10b981'; statusBg = 'rgba(16,185,129,0.06)';
  }

  const daysColor = data.daysLeft < 0 ? '#ef4444' : data.daysLeft <= 10 ? '#ef4444' : data.daysLeft <= 30 ? '#f59e0b' : '#10b981';
  const daysDisplay = data.isExpired ? 'EXPIRED ' + Math.abs(data.daysLeft) + ' days ago' : data.daysLeft + ' days remaining';

  function row(label, value, vc) {
    return '<div style="display:flex;align-items:baseline;gap:12px;padding:8px 0;border-bottom:1px solid rgba(30,45,74,0.4);">' +
      '<div style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim);letter-spacing:1px;min-width:170px;flex-shrink:0;">' + label + '</div>' +
      '<div style="font-family:var(--font-mono);font-size:12px;color:' + (vc || 'var(--text-primary)') + ';word-break:break-all;">' + stEscapeHtml(String(value || '—')) + '</div>' +
      '</div>';
  }

  function secHead(t) {
    return '<div style="font-family:var(--font-mono);font-size:11px;color:var(--amber);letter-spacing:2px;margin:18px 0 8px;">' + t + '</div>';
  }

  const sansHtml = data.sans && data.sans.length
    ? '<div style="font-family:var(--font-mono);font-size:11px;color:var(--text-primary);word-break:break-all;line-height:2;">' +
      data.sans.map(function(s) { return stEscapeHtml(s); }).join('<span style="color:var(--text-dim);"> · </span>') +
      '</div>'
    : '<div style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim);">None listed</div>';

  const fp = data.fingerprint || '';
  const fpDisplay = fp.length > 59 ? fp.slice(0, 59) + '…' : fp;

  const html =
    // ── Status banner ────────────────────────────────────────────
    '<div style="background:' + statusBg + ';border:1px solid ' + statusColor + ';border-top:3px solid ' + statusColor + ';border-radius:4px;padding:20px 24px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">' +
    '<div>' +
    '<div style="font-family:var(--font-title);font-size:22px;color:' + statusColor + ';letter-spacing:3px;margin-bottom:8px;">&#9679; ' + statusLabel + '</div>' +
    '<div style="font-family:var(--font-mono);font-size:14px;color:var(--text-primary);margin-bottom:4px;">' + stEscapeHtml(domain) + '</div>' +
    '<div style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim);">' + stEscapeHtml(data.protocol || '') + (data.issuer ? ' · ' + stEscapeHtml(data.issuer) : '') + '</div>' +
    '</div>' +
    '<div style="text-align:center;flex-shrink:0;">' +
    '<div style="font-family:var(--font-title);font-size:40px;font-weight:900;color:' + daysColor + ';line-height:1;">' + (data.isExpired ? '0' : data.daysLeft) + '</div>' +
    '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-dim);letter-spacing:1px;margin-top:4px;">DAYS LEFT</div>' +
    '</div>' +
    '</div>' +

    // ── Details card ─────────────────────────────────────────────
    '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:4px;padding:20px 24px;">' +

    secHead('VALIDITY') +
    row('Valid From',       new Date(data.validFrom).toUTCString()) +
    row('Valid To',         new Date(data.validTo).toUTCString()) +
    row('Status',          daysDisplay, daysColor) +

    secHead('CERTIFICATE SUBJECT') +
    row('Common Name',     data.subject) +
    row('Issuer',          data.issuer) +
    (data.issuerOrg && data.issuerOrg !== data.issuer ? row('Issuer Org', data.issuerOrg) : '') +

    secHead('SUBJECT ALTERNATIVE NAMES') +
    '<div style="padding:8px 0;">' + sansHtml + '</div>' +

    secHead('TECHNICAL DETAILS') +
    row('Serial Number',         data.serial    || '—') +
    row('Fingerprint (SHA-256)', fpDisplay      || '—') +
    row('Signature Algorithm',   data.sigAlg    || '—') +
    row('TLS Version',           data.protocol  || '—') +

    secHead('TRUST') +
    row('Chain Trusted',    data.authorized    ? 'Yes' : 'No — ' + (data.authError  || 'untrusted chain'), data.authorized    ? '#10b981' : '#ef4444') +
    row('Domain Matches',   data.domainMatches ? 'Yes' : 'No — certificate does not cover this domain',    data.domainMatches ? '#10b981' : '#ef4444') +

    '</div>';

  resultDiv.innerHTML = html;
}

// ── HASH TOOLS ───────────────────────────────────────────────

function stBufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
}

async function stHashText(text) {
  const enc = new TextEncoder();
  const buf = enc.encode(text);
  const [sha1, sha256, sha512] = await Promise.all([
    crypto.subtle.digest('SHA-1',   buf),
    crypto.subtle.digest('SHA-256', buf),
    crypto.subtle.digest('SHA-512', buf)
  ]);
  return { md5: stMD5(text), sha1: stBufToHex(sha1), sha256: stBufToHex(sha256), sha512: stBufToHex(sha512) };
}

async function stGenerateHashes() {
  const input     = document.getElementById('st-hash-input');
  const resultDiv = document.getElementById('st-hash-results');
  const text      = input.value;
  if (!text) { resultDiv.innerHTML = '<p class="placeholder-text" style="margin:0;">Enter text above to generate hashes.</p>'; return; }

  resultDiv.innerHTML = '<p class="loading" style="margin:0;">COMPUTING...</p>';
  const h = await stHashText(text);

  resultDiv.innerHTML = [['MD5','md5'],['SHA-1','sha1'],['SHA-256','sha256'],['SHA-512','sha512']].map(function(pair) {
    const hash = h[pair[1]];
    return '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:3px; padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">' +
      '<div style="min-width:0;">' +
      '<div style="font-family:var(--font-mono); font-size:10px; color:var(--amber); letter-spacing:2px; margin-bottom:4px;">' + pair[0] + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-primary); word-break:break-all;">' + hash + '</div>' +
      '</div>' +
      '<button onclick="stCopyHash(\'' + hash + '\',this)" class="aegis-btn" style="font-size:11px; padding:5px 12px; white-space:nowrap; flex-shrink:0;">COPY</button>' +
      '</div>';
  }).join('');
}

function stCopyHash(hash, btn) {
  navigator.clipboard.writeText(hash).then(function() {
    const orig = btn.textContent;
    btn.textContent = '✓ COPIED';
    btn.style.color = '#10b981'; btn.style.borderColor = '#10b981';
    setTimeout(function() { btn.textContent = orig; btn.style.color = ''; btn.style.borderColor = ''; }, 2000);
  });
}

function stCompareHashes() {
  const h1 = document.getElementById('st-hash-compare-1').value.trim().toLowerCase();
  const h2 = document.getElementById('st-hash-compare-2').value.trim().toLowerCase();
  const resultDiv = document.getElementById('st-hash-compare-result');
  if (!h1 || !h2) { resultDiv.innerHTML = '<p class="placeholder-text" style="margin:0;">Enter both hashes to compare.</p>'; return; }
  resultDiv.innerHTML = h1 === h2
    ? '<div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:3px; padding:12px 16px; font-family:var(--font-title); font-size:13px; color:#10b981; letter-spacing:2px;">✓ MATCH — Hashes are identical</div>'
    : '<div style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; border-radius:3px; padding:12px 16px; font-family:var(--font-title); font-size:13px; color:#ef4444; letter-spacing:2px;">✗ NO MATCH — Hashes are different</div>';
}

function stDragOver(e) {
  e.preventDefault();
  const d = document.getElementById('st-file-drop');
  if (d) { d.style.borderColor = 'var(--amber)'; d.style.background = 'rgba(245,158,11,0.05)'; }
}
function stDragLeave() {
  const d = document.getElementById('st-file-drop');
  if (d) { d.style.borderColor = 'var(--border)'; d.style.background = ''; }
}
function stDrop(e) {
  e.preventDefault(); stDragLeave();
  const file = e.dataTransfer && e.dataTransfer.files[0];
  if (file) stHashFile(file);
}

async function stHashFile(file) {
  if (!file) return;
  const resultDiv = document.getElementById('st-file-hash-result');
  const dropArea  = document.getElementById('st-file-drop');
  if (dropArea) {
    dropArea.innerHTML =
      '<div style="font-family:var(--font-mono); font-size:13px; color:var(--amber); letter-spacing:1px;">📄 ' + stEscapeHtml(file.name) + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-top:6px;">Click to select a different file</div>';
  }
  resultDiv.innerHTML = '<p class="loading" style="margin:0;">COMPUTING HASHES...</p>';

  try {
    const arrayBuf = await file.arrayBuffer();
    const bytes    = new Uint8Array(arrayBuf);
    const [sha1, sha256, sha512] = await Promise.all([
      crypto.subtle.digest('SHA-1',   bytes),
      crypto.subtle.digest('SHA-256', bytes),
      crypto.subtle.digest('SHA-512', bytes)
    ]);

    const fileSize = file.size < 1024 ? file.size + ' B'
      : file.size < 1048576 ? (file.size / 1024).toFixed(1) + ' KB'
      : (file.size / 1048576).toFixed(2) + ' MB';

    const h = { md5: stMD5Binary(bytes), sha1: stBufToHex(sha1), sha256: stBufToHex(sha256), sha512: stBufToHex(sha512) };

    resultDiv.innerHTML =
      '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid var(--border);">' +
      '📄 ' + stEscapeHtml(file.name) + ' · ' + fileSize + ' · ' + (file.type || 'unknown type') +
      '</div>' +
      [['MD5','md5'],['SHA-1','sha1'],['SHA-256','sha256'],['SHA-512','sha512']].map(function(pair) {
        const hash = h[pair[1]];
        return '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:3px; padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">' +
          '<div style="min-width:0;">' +
          '<div style="font-family:var(--font-mono); font-size:10px; color:var(--amber); letter-spacing:2px; margin-bottom:4px;">' + pair[0] + '</div>' +
          '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-primary); word-break:break-all;">' + hash + '</div>' +
          '</div>' +
          '<button onclick="stCopyHash(\'' + hash + '\',this)" class="aegis-btn" style="font-size:11px; padding:5px 12px; white-space:nowrap; flex-shrink:0;">COPY</button>' +
          '</div>';
      }).join('');
  } catch (e) {
    resultDiv.innerHTML = '<p class="placeholder-text">Error hashing file: ' + stEscapeHtml(e.message) + '</p>';
  }
}

// ── MD5 (pure JS, public domain algorithm) ───────────────────

function stMD5(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 128) { bytes.push(c); }
    else if (c < 2048) { bytes.push((c >> 6) | 192, (c & 63) | 128); }
    else { bytes.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128); }
  }
  return stMD5Binary(new Uint8Array(bytes));
}

function stMD5Binary(bytes) {
  function safeAdd(x, y) {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    return ((x >> 16) + (y >> 16) + (lsw >> 16)) << 16 | (lsw & 0xFFFF);
  }
  function rot(n, c) { return n << c | n >>> (32 - c); }
  function cmn(q, a, b, x, s, t) { return safeAdd(rot(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
  function ff(a,b,c,d,x,s,t){ return cmn((b&c)|(~b&d),a,b,x,s,t); }
  function gg(a,b,c,d,x,s,t){ return cmn((b&d)|(c&~d),a,b,x,s,t); }
  function hh(a,b,c,d,x,s,t){ return cmn(b^c^d,a,b,x,s,t); }
  function ii(a,b,c,d,x,s,t){ return cmn(c^(b|~d),a,b,x,s,t); }

  const len  = bytes.length;
  const nblk = ((len + 8) >>> 6) + 1;
  const blk  = new Array(nblk * 16).fill(0);
  let i;
  for (i = 0; i < len; i++) blk[i >> 2] |= bytes[i] << ((i & 3) * 8);
  blk[i >> 2] |= 0x80 << ((i & 3) * 8);
  blk[nblk * 16 - 2] = len * 8;

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;

  for (i = 0; i < blk.length; i += 16) {
    const oa=a, ob=b, oc=c, od=d;
    a=ff(a,b,c,d,blk[i+ 0], 7,-680876936);  b=ff(d,a,b,c,blk[i+ 1],12,-389564586);
    c=ff(c,d,a,b,blk[i+ 2],17, 606105819);  d=ff(b,c,d,a,blk[i+ 3],22,-1044525330);
    a=ff(a,b,c,d,blk[i+ 4], 7,-176418897);  b=ff(d,a,b,c,blk[i+ 5],12, 1200080426);
    c=ff(c,d,a,b,blk[i+ 6],17,-1473231341); d=ff(b,c,d,a,blk[i+ 7],22,-45705983);
    a=ff(a,b,c,d,blk[i+ 8], 7, 1770035416); b=ff(d,a,b,c,blk[i+ 9],12,-1958414417);
    c=ff(c,d,a,b,blk[i+10],17,-42063);      d=ff(b,c,d,a,blk[i+11],22,-1990404162);
    a=ff(a,b,c,d,blk[i+12], 7, 1804603682); b=ff(d,a,b,c,blk[i+13],12,-40341101);
    c=ff(c,d,a,b,blk[i+14],17,-1502002290); d=ff(b,c,d,a,blk[i+15],22, 1236535329);
    a=gg(a,b,c,d,blk[i+ 1], 5,-165796510);  b=gg(d,a,b,c,blk[i+ 6], 9,-1069501632);
    c=gg(c,d,a,b,blk[i+11],14, 643717713);  d=gg(b,c,d,a,blk[i+ 0],20,-373897302);
    a=gg(a,b,c,d,blk[i+ 5], 5,-701558691);  b=gg(d,a,b,c,blk[i+10], 9, 38016083);
    c=gg(c,d,a,b,blk[i+15],14,-660478335);  d=gg(b,c,d,a,blk[i+ 4],20,-405537848);
    a=gg(a,b,c,d,blk[i+ 9], 5, 568446438);  b=gg(d,a,b,c,blk[i+14], 9,-1019803690);
    c=gg(c,d,a,b,blk[i+ 3],14,-187363961);  d=gg(b,c,d,a,blk[i+ 8],20, 1163531501);
    a=gg(a,b,c,d,blk[i+13], 5,-1444681467); b=gg(d,a,b,c,blk[i+ 2], 9,-51403784);
    c=gg(c,d,a,b,blk[i+ 7],14, 1735328473); d=gg(b,c,d,a,blk[i+12],20,-1926607734);
    a=hh(a,b,c,d,blk[i+ 5], 4,-378558);     b=hh(d,a,b,c,blk[i+ 8],11,-2022574463);
    c=hh(c,d,a,b,blk[i+11],16, 1839030562); d=hh(b,c,d,a,blk[i+14],23,-35309556);
    a=hh(a,b,c,d,blk[i+ 1], 4,-1530992060); b=hh(d,a,b,c,blk[i+ 4],11, 1272893353);
    c=hh(c,d,a,b,blk[i+ 7],16,-155497632);  d=hh(b,c,d,a,blk[i+10],23,-1094730640);
    a=hh(a,b,c,d,blk[i+13], 4, 681279174);  b=hh(d,a,b,c,blk[i+ 0],11,-358537222);
    c=hh(c,d,a,b,blk[i+ 3],16,-722521979);  d=hh(b,c,d,a,blk[i+ 6],23, 76029189);
    a=hh(a,b,c,d,blk[i+ 9], 4,-640364487);  b=hh(d,a,b,c,blk[i+12],11,-421815835);
    c=hh(c,d,a,b,blk[i+15],16, 530742520);  d=hh(b,c,d,a,blk[i+ 2],23,-995338651);
    a=ii(a,b,c,d,blk[i+ 0], 6,-198630844);  b=ii(d,a,b,c,blk[i+ 7],10, 1126891415);
    c=ii(c,d,a,b,blk[i+14],15,-1416354905); d=ii(b,c,d,a,blk[i+ 5],21,-57434055);
    a=ii(a,b,c,d,blk[i+12], 6, 1700485571); b=ii(d,a,b,c,blk[i+ 3],10,-1894986606);
    c=ii(c,d,a,b,blk[i+10],15,-1051523);    d=ii(b,c,d,a,blk[i+ 1],21,-2054922799);
    a=ii(a,b,c,d,blk[i+ 8], 6, 1873313359); b=ii(d,a,b,c,blk[i+15],10,-30611744);
    c=ii(c,d,a,b,blk[i+ 6],15,-1560198380); d=ii(b,c,d,a,blk[i+13],21, 1309151649);
    a=ii(a,b,c,d,blk[i+ 4], 6,-145523070);  b=ii(d,a,b,c,blk[i+11],10,-1120210379);
    c=ii(c,d,a,b,blk[i+ 2],15, 718787259);  d=ii(b,c,d,a,blk[i+ 9],21,-343485551);
    a=safeAdd(a,oa); b=safeAdd(b,ob); c=safeAdd(c,oc); d=safeAdd(d,od);
  }

  function w2h(n) {
    let s='';
    for (let k=0;k<4;k++) s+=('0'+((n>>(k*8))&0xFF).toString(16)).slice(-2);
    return s;
  }
  return w2h(a)+w2h(b)+w2h(c)+w2h(d);
}

// ── CVE EXPLAINER ────────────────────────────────────────────

let stCveExplanations = [];

async function stInitCVEExplainer() {
  if (stCveExplanations.length > 0) { stRenderRecentCVEs(); return; }
  try {
    if (window.aegis && window.aegis.getCVEExplanations) {
      const saved = await window.aegis.getCVEExplanations();
      if (saved && saved.length) { stCveExplanations = saved; stRenderRecentCVEs(); return; }
    }
    const raw = localStorage.getItem('aegis_cve_explanations');
    if (raw) { stCveExplanations = JSON.parse(raw).slice(0,10); stRenderRecentCVEs(); }
  } catch (_) {}
}

// cveData is an optional object from the CVE Feed: { id, desc, severity, score, published, ... }
async function stExplainCVE(prefillId, cveData) {
  const inputEl   = document.getElementById('st-cve-id-input');
  const resultDiv = document.getElementById('st-cve-explain-result');
  const cveId     = ((prefillId || (inputEl && inputEl.value)) || '').trim().toUpperCase();

  if (!cveId || !/^CVE-\d{4}-\d+$/.test(cveId)) {
    resultDiv.innerHTML = '<p class="placeholder-text">Please enter a valid CVE ID (e.g. CVE-2024-12345)</p>';
    return;
  }
  if (inputEl) inputEl.value = cveId;

  // ── PATH A: NVD feed data available ───────────────────────────
  // Show the verified NVD record immediately, then ask Claude to analyse
  // only the description text — no CVE ID in the prompt avoids refusals
  // for 2026 entries beyond Claude's training cutoff.
  if (cveData && cveData.desc) {
    const sevColors = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#84cc16' };
    const sevColor  = sevColors[cveData.severity] || '#64748b';
    const scoreStr  = cveData.score != null ? cveData.score.toFixed(1) : 'N/A';
    const pubStr    = cveData.published || '';

    // Render the NVD data card immediately — no waiting for Claude.
    resultDiv.innerHTML =
      // ── NVD verified record ──────────────────────────────────
      '<div style="background:var(--bg-card); border:1px solid var(--border); border-top:2px solid ' + sevColor + '; border-radius:4px; padding:20px; margin-bottom:16px;">' +
      '<div style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim); letter-spacing:2px; margin-bottom:12px;">&#9673; NVD VERIFIED RECORD · SOURCE: NIST NATIONAL VULNERABILITY DATABASE</div>' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:14px;">' +
      '<div style="font-family:var(--font-title); font-size:16px; color:var(--amber); letter-spacing:2px;">' + cveId + '</div>' +
      '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">' +
      '<div style="background:' + sevColor + '; color:#020818; font-family:var(--font-mono); font-size:11px; font-weight:bold; padding:3px 12px; border-radius:2px;">' + (cveData.severity || 'UNKNOWN') + '</div>' +
      '<div style="background:var(--bg-secondary); border:1px solid ' + sevColor + '; color:' + sevColor + '; font-family:var(--font-mono); font-size:11px; font-weight:bold; padding:3px 12px; border-radius:2px;">CVSS ' + scoreStr + '</div>' +
      '</div></div>' +
      '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-primary); line-height:1.8; margin-bottom:14px; padding:14px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:3px;">' +
      stEscapeHtml(cveData.desc) +
      '</div>' +
      (pubStr ? '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">PUBLISHED: ' + pubStr + '</div>' : '') +
      '</div>' +
      // ── Claude analysis section (loading) ────────────────────
      '<div id="st-cve-ai-section" style="background:var(--bg-card); border:1px solid var(--border); border-top:2px solid #a78bfa; border-radius:4px; padding:20px;">' +
      '<div style="font-family:var(--font-mono); font-size:10px; color:#a78bfa; letter-spacing:2px; margin-bottom:16px;">&#9889; AI TECHNICAL ANALYSIS · CLAUDE SONNET</div>' +
      '<div id="st-cve-ai-body" style="text-align:center; padding:20px;">' +
      '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; animation:blink 1s infinite;">GENERATING TECHNICAL ANALYSIS...</div>' +
      '</div></div>';

    // Now call Claude with description only — no CVE ID, no date.
    const prompt =
      'You are a cybersecurity analyst. A vulnerability has been reported with this description: \'' + cveData.desc + '\'. ' +
      'Explain: ' +
      '1) What type of vulnerability this is technically, ' +
      '2) How this attack works and the exploit path, ' +
      '3) What systems/software configurations are at risk, ' +
      '4) Real-world impact, ' +
      '5) Exact remediation steps. ' +
      'Be direct and technical. No disclaimers or caveats.';

    const aiBody = document.getElementById('st-cve-ai-body');
    try {
      const resp = await fetch(ST_PROXY + encodeURIComponent('https://api.anthropic.com/v1/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message);

      const aiText    = data.content[0].text;
      const timestamp = new Date().toUTCString();

      if (aiBody) {
        aiBody.innerHTML =
          '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-primary); line-height:1.8;">' +
          renderBriefingMarkdown(aiText) +
          '</div>';
      }

      stCveExplanations.unshift({ id: cveId, text: aiText, timestamp });
      if (stCveExplanations.length > 10) stCveExplanations.pop();
      stSaveCVEExplanations();
      stRenderRecentCVEs();

    } catch (err) {
      if (aiBody) {
        aiBody.innerHTML =
          '<div style="font-family:var(--font-mono); font-size:13px; color:#ef4444;">Analysis failed: ' + stEscapeHtml(err.message) + '</div>';
      }
    }
    return;
  }

  // ── PATH B: manual CVE ID only — original behaviour ──────────
  resultDiv.innerHTML =
    '<div style="text-align:center; padding:30px;">' +
    '<div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; animation:blink 1s infinite;">ANALYZING ' + cveId + '...</div>' +
    '</div>';

  try {
    const prompt = 'Explain ' + cveId + ' in detail: what it is, what systems are affected, ' +
      'how it works technically, severity and impact, and exact remediation steps.';
    const resp = await fetch(ST_PROXY + encodeURIComponent('https://api.anthropic.com/v1/messages'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);

    const text      = data.content[0].text;
    const timestamp = new Date().toUTCString();

    resultDiv.innerHTML =
      '<div style="background:var(--bg-card); border:1px solid var(--border); border-top:2px solid var(--amber); border-radius:4px; padding:24px;">' +
      '<div style="font-family:var(--font-title); font-size:15px; color:var(--amber); letter-spacing:2px; margin-bottom:4px;">' + cveId + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid var(--border);">' + timestamp + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-primary); line-height:1.8;">' +
      renderBriefingMarkdown(text) +
      '</div></div>';

    stCveExplanations.unshift({ id: cveId, text, timestamp });
    if (stCveExplanations.length > 10) stCveExplanations.pop();
    stSaveCVEExplanations();
    stRenderRecentCVEs();

  } catch (err) {
    resultDiv.innerHTML =
      '<div class="breach-card" style="border-left-color:#ef4444;">' +
      '<div class="breach-name" style="color:#ef4444;">EXPLANATION FAILED</div>' +
      '<div class="breach-detail" style="margin-top:8px; font-family:var(--font-mono); font-size:13px;">Error: ' + stEscapeHtml(err.message) + '</div>' +
      '</div>';
  }
}

function stRenderRecentCVEs() {
  const section   = document.getElementById('st-cve-recent-section');
  const container = document.getElementById('st-cve-recent');
  if (!section || !container) return;
  if (!stCveExplanations.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  container.innerHTML = stCveExplanations.map(function(exp) {
    return '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid var(--amber); border-radius:3px; padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">' +
      '<div>' +
      '<div style="font-family:var(--font-title); font-size:12px; color:var(--amber); letter-spacing:1px; margin-bottom:4px;">' + exp.id + '</div>' +
      '<div style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">' + exp.timestamp + '</div>' +
      '</div>' +
      '<button onclick="stLoadSavedCVE(\'' + exp.id + '\')" class="aegis-btn" style="font-size:11px; padding:5px 12px;">VIEW</button>' +
      '</div>';
  }).join('');
}

function stClearCVEHistory() {
  const container = document.getElementById('st-cve-recent');
  if (!container) return;

  if (!stCveExplanations.length) {
    container.innerHTML = '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); padding:12px 0;">No history to clear.</div>';
    setTimeout(function() { stRenderRecentCVEs(); }, 2000);
    return;
  }

  container.innerHTML =
    '<div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid var(--amber); border-radius:3px; padding:20px;">' +
    '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-primary); margin-bottom:16px; line-height:1.6;">Are you sure you want to clear all CVE explanation history?<br><span style="color:var(--text-dim);">This cannot be undone.</span></div>' +
    '<div style="display:flex; gap:10px;">' +
    '<button onclick="stConfirmClearCVEHistory()" class="aegis-btn" style="font-size:12px; padding:8px 20px; border-color:#ef4444; color:#ef4444;">CONFIRM</button>' +
    '<button onclick="stRenderRecentCVEs()" class="aegis-btn" style="font-size:12px; padding:8px 20px; border-color:#1e2d4a; color:#64748b;">CANCEL</button>' +
    '</div></div>';
}

async function stConfirmClearCVEHistory() {
  const container = document.getElementById('st-cve-recent');
  const section   = document.getElementById('st-cve-recent-section');
  try {
    if (window.aegis && window.aegis.clearCVEExplanations) await window.aegis.clearCVEExplanations();
    stCveExplanations = [];
    if (container) {
      container.innerHTML = '<div style="font-family:var(--font-mono); font-size:13px; color:#10b981; padding:14px 0; letter-spacing:1px;">&#10003; CVE explanation history cleared.</div>';
    }
    setTimeout(function() {
      if (section) section.style.display = 'none';
    }, 2000);
  } catch (e) {
    if (container) {
      container.innerHTML = '<div style="font-family:var(--font-mono); font-size:13px; color:#ef4444; padding:12px 0;">Error clearing history. Please try again.</div>';
    }
    setTimeout(function() { stRenderRecentCVEs(); }, 2000);
  }
}

function stLoadSavedCVE(id) {
  const exp = stCveExplanations.find(function(e) { return e.id === id; });
  if (!exp) return;
  const inputEl = document.getElementById('st-cve-id-input');
  if (inputEl) inputEl.value = exp.id;
  const resultDiv = document.getElementById('st-cve-explain-result');
  resultDiv.innerHTML =
    '<div style="background:var(--bg-card); border:1px solid var(--border); border-top:2px solid var(--amber); border-radius:4px; padding:24px;">' +
    '<div style="font-family:var(--font-title); font-size:15px; color:var(--amber); letter-spacing:2px; margin-bottom:4px;">' + exp.id + '</div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid var(--border);">' + exp.timestamp + ' (cached)</div>' +
    '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-primary); line-height:1.8;">' +
    renderBriefingMarkdown(exp.text) +
    '</div></div>';
}

async function stSaveCVEExplanations() {
  try {
    if (window.aegis && window.aegis.saveCVEExplanations) { await window.aegis.saveCVEExplanations(stCveExplanations); return; }
    localStorage.setItem('aegis_cve_explanations', JSON.stringify(stCveExplanations));
  } catch (_) {}
}

// ── Public entrypoint from CVE Feed page ─────────────────────
// Looks up cached feed data (set in renderCVECard) so Claude gets the
// live description, severity and score — essential for 2026 CVEs that
// are beyond its training cutoff.
function openCVEExplainer(cveId) {
  const cveData = (window._cveFeedCache && window._cveFeedCache[cveId]) || null;
  console.log('CVE cache lookup:', cveId, window._cveFeedCache && window._cveFeedCache[cveId]);

  // Set flag BEFORE navigateTo so that the initSecurityToolkit() it triggers
  // (at T+150ms) skips clearing the CVE explainer result div.  We clear the
  // flag inside our own callback which fires later (T+350ms), guaranteeing
  // initSecurityToolkit always completes before stExplainCVE runs.
  window._pendingCVEExplain = true;
  navigateTo('security-toolkit');

  setTimeout(function() {
    window._pendingCVEExplain = false;
    stSwitchTab('cve-explainer');
    stExplainCVE(cveId, cveData);
  }, 350);
}

// ── Session reset — called every time Security Toolkit is navigated to ──
function initSecurityToolkit() {
  // Ask Aegis: always start with an empty chat window.
  // SQLite history is preserved but not reloaded into the UI.
  stChatMessages = [];
  stRenderChat();

  // SSL Inspector: clear input and result
  const sslInput = document.getElementById('st-ssl-input');
  if (sslInput) sslInput.value = '';
  const sslResult = document.getElementById('st-ssl-result');
  if (sslResult) sslResult.innerHTML = '<p class="placeholder-text">Enter a domain name and click INSPECT to analyze its SSL/TLS configuration.</p>';

  // Hash Tools: clear all inputs, results, and file drop zone
  ['st-hash-input', 'st-hash-compare-1', 'st-hash-compare-2'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const hashResults = document.getElementById('st-hash-results');
  if (hashResults) hashResults.innerHTML = '';
  const hashCompare = document.getElementById('st-hash-compare-result');
  if (hashCompare) hashCompare.innerHTML = '';
  const fileHashResult = document.getElementById('st-file-hash-result');
  if (fileHashResult) fileHashResult.innerHTML = '';
  const fileDrop = document.getElementById('st-file-drop');
  if (fileDrop) fileDrop.innerHTML =
    '<div style="font-family:var(--font-mono); font-size:13px; color:var(--text-dim); letter-spacing:1px;">&#128229; DRAG &amp; DROP FILE HERE OR CLICK TO SELECT</div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-top:6px; opacity:0.6;">Any file type supported</div>';
  const fileInput = document.getElementById('st-file-input');
  if (fileInput) fileInput.value = '';

  // CVE Explainer: clear the input and result pane, but keep Recent Explanations.
  // Skip the reset if openCVEExplainer() is mid-flight — it will populate the
  // result div itself 350ms after navigateTo, after we've already run.
  if (!window._pendingCVEExplain) {
    const cveInput = document.getElementById('st-cve-id-input');
    if (cveInput) cveInput.value = '';
    const cveResult = document.getElementById('st-cve-explain-result');
    if (cveResult) cveResult.innerHTML = '<p class="placeholder-text">Enter a CVE ID to get a detailed AI-powered explanation of the vulnerability, affected systems, and remediation steps.</p>';
  }

  // Load Recent Explanations from SQLite (or localStorage) into the panel
  stInitCVEExplainer();
}

// ── Auto-init on navigation ───────────────────────────────────
document.querySelectorAll('.nav-item').forEach(function(item) {
  item.addEventListener('click', function() {
    if (item.dataset.page === 'security-toolkit') {
      setTimeout(initSecurityToolkit, 150);
    }
  });
});
