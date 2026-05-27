new_func = """async function loadDashboard() {
  const dashDiv = document.getElementById('dashboard-content');
  if (!dashDiv) return;
  dashDiv.innerHTML = '<p class="loading">LOADING AEGIS DASHBOARD...</p>';
  const [newsData, ipData] = await Promise.all([loadDashboardNews(), loadDashboardIP()]);
  const vpnActive = ipData.isVPN;
  const threatLevel = vpnActive ? 'LOW' : 'ELEVATED';
  const threatColor = vpnActive ? '#10b981' : '#f59e0b';
  dashDiv.innerHTML =
    '<div style="background:' + threatColor + '18; border:1px solid ' + threatColor + '; border-radius:4px; padding:20px 28px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center;">' +
    '<div><div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); letter-spacing:3px; margin-bottom:6px;">CURRENT THREAT LEVEL</div>' +
    '<div style="font-family:var(--font-title); font-size:28px; color:' + threatColor + '; letter-spacing:4px;">&#9888; ' + threatLevel + '</div></div>' +
    '<div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); text-align:right;">LAST UPDATED<br><span style="color:var(--text-primary);">' + new Date().toUTCString() + '</span></div></div>' +
    '<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px;">' +
    renderStatCard('YOUR IP', ipData.ip || 'Unknown', ipData.isVPN ? '#10b981' : '#f59e0b', ipData.isVPN ? '&#128274;' : '&#9888;') +
    renderStatCard('VPN STATUS', ipData.isVPN ? 'ACTIVE' : 'NOT DETECTED', ipData.isVPN ? '#10b981' : '#ef4444', ipData.isVPN ? '&#9989;' : '&#9888;') +
    renderStatCard('LOCATION', (ipData.city || 'Unknown') + ', ' + (ipData.country || ''), '#60a5fa', '&#127760;') +
    renderStatCard('NEWS HEADLINES', newsData.length, newsData.length > 0 ? '#10b981' : '#64748b', '&#128225;') +
    '</div>' +
    '<div style="margin-bottom:24px;"><div style="font-family:var(--font-mono); font-size:12px; color:var(--amber); letter-spacing:2px; margin-bottom:12px;">QUICK ACTIONS</div>' +
    '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
    ['password', 'ip', 'cve', 'briefing', 'news', 'network'].map(function(page) {
      const labels = { password: '&#128273; Password Health', ip: '&#127760; IP Investigator', cve: '&#128737; CVE Feed', briefing: '&#129302; AI Briefing', news: '&#128225; Security News', network: '&#128274; Network Monitor' };
      return '<button onclick="navigateTo(' + String.fromCharCode(39) + page + String.fromCharCode(39) + ')" class="aegis-btn" style="font-size:12px; padding:10px 16px;">' + labels[page] + '</button>';
    }).join('') +
    '</div></div>' +
    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">' +
    '<div class="card"><div class="card-header">&#127760; YOUR CONNECTION</div>' +
    '<div style="font-family:var(--font-mono); font-size:14px; color:var(--text-dim); line-height:2.2;">' +
    'IP ADDRESS: <span style="color:var(--text-primary)">' + (ipData.ip || 'Unknown') + '</span><br>' +
    'LOCATION: <span style="color:var(--text-primary)">' + (ipData.city || 'Unknown') + ', ' + (ipData.country || 'Unknown') + '</span><br>' +
    'ISP: <span style="color:var(--text-primary)">' + (ipData.isp || 'Unknown') + '</span><br>' +
    'VPN: <span style="color:' + (ipData.isVPN ? '#10b981' : '#ef4444') + '">' + (ipData.isVPN ? '&#9989; ACTIVE' : '&#9888; NOT DETECTED') + '</span><br>' +
    'THREAT SCORE: <span style="color:' + threatColor + '">' + (ipData.isVPN ? '0/100 - SECURE' : '25/100 - MONITOR') + '</span>' +
    '</div>' +
    '<button onclick="navigateTo(' + String.fromCharCode(39) + 'network' + String.fromCharCode(39) + ')" class="aegis-btn" style="margin-top:16px; font-size:11px; padding:8px 16px; width:100%;">FULL NETWORK SCAN &#9654;</button>' +
    '</div>' +
    '<div class="card"><div class="card-header">&#128225; LATEST NEWS</div>' +
    (newsData.length > 0 ? newsData.slice(0, 5).map(function(item) {
      const categories = getNewsCategories(item.title);
      const borderColor = categories.length > 0 ? categories[0].color : 'var(--border)';
      return '<div style="padding:12px 0; border-bottom:1px solid var(--border); border-left:2px solid ' + borderColor + '; padding-left:12px;">' +
        '<div style="font-family:var(--font-ui); font-size:14px; color:var(--text-primary); font-weight:600; margin-bottom:4px; line-height:1.4;">' + item.title.slice(0, 80) + (item.title.length > 80 ? '...' : '') + '</div>' +
        '<div style="display:flex; justify-content:space-between;">' +
        '<span style="font-family:var(--font-mono); font-size:11px; color:var(--amber);">&#9658; ' + item.source + '</span>' +
        '<span style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">' + timeAgo(item.pubDate) + '</span>' +
        '</div></div>';
    }).join('') : '<p class="placeholder-text">No news loaded.</p>') +
    '<button onclick="navigateTo(' + String.fromCharCode(39) + 'news' + String.fromCharCode(39) + ')" class="aegis-btn" style="margin-top:16px; font-size:11px; padding:8px 16px; width:100%;">VIEW ALL NEWS &#9654;</button>' +
    '</div></div>';
}
"""

content = open('js/main.js', 'r', encoding='latin-1').read()
start = content.find('async function loadDashboard()')
end = content.find('async function loadDashboardNews()')
new_content = content[:start] + new_func + '\n\n' + content[end:]
open('js/main.js', 'w', encoding='latin-1').write(new_content)
print('SUCCESS')
