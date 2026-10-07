// Show the latest release version next to the download button; the link works without this.
fetch('https://api.github.com/repos/btmcbride/kestralbudget/releases/latest')
  .then((r) => (r.ok ? r.json() : Promise.reject()))
  .then((release) => {
    const info = document.getElementById('release-info');
    if (info && release.tag_name) info.textContent = `${release.tag_name} \u00b7 Windows x64 \u00b7 macOS Apple Silicon`;
  })
  .catch(() => {});
