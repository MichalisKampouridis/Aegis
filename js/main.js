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
// PASSWORD HEALTH CHECK
async function checkPassword() {
  const password = document.getElementById('password-input').value;
  const resultDiv = document.getElementById('password-result');

  if (!password) {
    resultDiv.innerHTML = '<p class="placeholder-text">Please enter a password to check.</p>';
    return;
  }

  resultDiv.innerHTML = '<p class="loading">SCANNING BREACH DATABASE...</p>';

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

    const lines = text.split('\n');
    let count = 0;

    for (const line of lines) {
      const [hashSuffix, hashCount] = line.split(':');
      if (hashSuffix.trim() === suffix) {
        count = parseInt(hashCount.trim());
        break;
      }
    }

    if (count === 0) {
      resultDiv.innerHTML = `
        <div class="safe-banner">
          ✅ SECURE — This password has not been found in any known data breaches.
          <br><br>
          <span style="font-size:10px; opacity:0.7;">Checked via HaveIBeenPwned k-anonymity API. Your password was never transmitted.</span>
        </div>`;
    } else {
      resultDiv.innerHTML = `
        <div class="danger-banner">
          ⚠ COMPROMISED — This password has appeared in <strong>${count.toLocaleString()}</strong> known data breaches.
          <br><br>
          <span style="font-size:10px; opacity:0.7;">Change this password immediately on any account using it.</span>
        </div>`;
    }
  } catch (error) {
    resultDiv.innerHTML = '<p class="placeholder-text">Error connecting to breach database. Try again.</p>';
  }
}

document.getElementById('password-btn').addEventListener('click', checkPassword);

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
