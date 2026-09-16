const menu = document.getElementById('storeMenu');
const toggle = document.getElementById('storeMenuToggle');
toggle.addEventListener('click', () => { menu.showModal(); toggle.setAttribute('aria-expanded', 'true'); });
document.getElementById('storeMenuClose').addEventListener('click', () => menu.close());
menu.addEventListener('close', () => { toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); });
menu.addEventListener('click', event => {
  const rect = menu.getBoundingClientRect();
  if (event.target === menu && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) menu.close();
});
const mobile = matchMedia('(max-width: 960px)');
const footerSections = [...document.querySelectorAll('.store-footer .store-intro-box')];
function syncChrome() {
  footerSections.forEach(section => { section.open = !mobile.matches; section.querySelector('summary').tabIndex = mobile.matches ? 0 : -1; });
  if (!mobile.matches && menu.open) menu.close();
}
mobile.addEventListener('change', syncChrome);
syncChrome();
const column = document.querySelector('.store-column');
document.addEventListener('click', event => { if (!column.contains(event.target)) column.open = false; });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && column.open) { column.open = false; column.querySelector('summary').focus(); } });
