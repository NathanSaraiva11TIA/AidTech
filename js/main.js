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

const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', function () {
    mainNav.classList.toggle('is-open');
  });
}

const productGrid = document.querySelector('.product-grid');
const arrowLeft = document.querySelector('.carousel-arrow-left');
const arrowRight = document.querySelector('.carousel-arrow-right');
const dots = document.querySelectorAll('.carousel-dots .dot');

if (productGrid && arrowLeft && arrowRight) {
  function scrollToCard(direction) {
    productGrid.scrollBy({ left: direction * productGrid.clientWidth, behavior: 'smooth' });
  }

  arrowLeft.addEventListener('click', function () { scrollToCard(-1); });
  arrowRight.addEventListener('click', function () { scrollToCard(1); });

  if (dots.length) {
    let scrollTimeout;
    productGrid.addEventListener('scroll', function () {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(function () {
        const index = Math.round(productGrid.scrollLeft / productGrid.clientWidth);
        dots.forEach(function (dot, i) {
          dot.classList.toggle('is-active', i === index);
        });
      }, 100);
    });
  }
}