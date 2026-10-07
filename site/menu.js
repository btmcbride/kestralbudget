const menu = document.querySelector('#site-nav');
const toggle = document.querySelector('.menu-toggle');
const closeButton = document.querySelector('.nav-close');
const backdrop = document.querySelector('.nav-backdrop');
const mobile = window.matchMedia('(max-width: 720px)');

if (menu && toggle && closeButton && backdrop) {
  const setOpen = (open, returnFocus = false) => {
    document.body.classList.toggle('site-nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    menu.inert = mobile.matches && !open;
    if (returnFocus) toggle.focus();
    if (open) closeButton.focus();
  };

  const syncViewport = () => setOpen(false);
  mobile.addEventListener('change', syncViewport);
  setOpen(false);

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  closeButton.addEventListener('click', () => setOpen(false, true));
  backdrop.addEventListener('click', () => setOpen(false, true));
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('site-nav-open')) {
      setOpen(false, true);
    }
  });
}
