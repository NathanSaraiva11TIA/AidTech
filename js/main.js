(function () {
  const root = document.documentElement;
  const buttons = document.querySelectorAll('.theme-btn');
  const themedImages = document.querySelectorAll('img[data-src-light]');
  const STORAGE_KEY = 'agrosense-theme';

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    buttons.forEach(function (btn) {
      const isActive = btn.dataset.themeSet === theme;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
    themedImages.forEach(function (img) {
      const src = theme === 'light' ? img.dataset.srcLight : img.dataset.srcDark;
      if (src) img.src = src;
    });
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  applyTheme(saved === 'light' || saved === 'dark' ? saved : 'dark');

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const theme = btn.dataset.themeSet;
      applyTheme(theme);
      localStorage.setItem(STORAGE_KEY, theme);
    });
  });
})();
