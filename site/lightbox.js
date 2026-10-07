// Click any screenshot to view it enlarged; click, tap, or press Esc to close.
const dialog = document.createElement('dialog');
dialog.className = 'lightbox';
dialog.innerHTML = '<img alt=""><button type="button" aria-label="Close">&times;</button>';
document.body.append(dialog);
const full = dialog.querySelector('img');
const open = (img) => {
  full.src = img.currentSrc || img.src;
  full.alt = img.alt;
  dialog.showModal();
};
for (const img of document.querySelectorAll('img.shot, figure img')) {
  img.tabIndex = 0;
  img.setAttribute('role', 'button');
  img.classList.add('zoomable');
  img.addEventListener('click', () => open(img));
  img.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(img); }
  });
}
dialog.addEventListener('click', () => dialog.close());
