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
