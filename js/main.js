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

(function () {
  const user = JSON.parse(localStorage.getItem('agrosense_user'));
  if (user) {
    const loginBtn = document.querySelector('a[href="login.html"]');
    if (loginBtn) loginBtn.style.display = 'none';
    const headerActions = document.querySelector('.header-actions');
    if (headerActions && !document.querySelector('.logout-btn')) {
      const logoutBtn = document.createElement('button');
      logoutBtn.className = 'btn logout-btn';
      logoutBtn.textContent = 'Sair';
      logoutBtn.type = 'button';
      logoutBtn.style.marginLeft = '16px';
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        localStorage.removeItem('agrosense_user');
        window.location.href = 'index.html';
      });
      headerActions.appendChild(logoutBtn);
    }
  }
})();

const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', function () {
    mainNav.classList.toggle('is-open');
  });

  document.addEventListener('click', function (e) {
    if (!mainNav.classList.contains('is-open')) return;
    if (mainNav.contains(e.target) || menuToggle.contains(e.target)) return;
    mainNav.classList.remove('is-open');
  });
}

const productGrid = document.querySelector('.product-grid');
const arrowLeft = document.querySelector('.carousel-arrow-left');
const arrowRight = document.querySelector('.carousel-arrow-right');
const dotsWrap = document.querySelector('.carousel-dots');

if (productGrid && arrowLeft && arrowRight) {
  // distância entre o início de um card e o do próximo (largura + gap)
  function cardStep() {
    const cards = productGrid.children;
    if (cards.length < 2) return productGrid.clientWidth;
    return cards[1].offsetLeft - cards[0].offsetLeft;
  }

  function scrollToCard(direction) {
    productGrid.scrollBy({ left: direction * cardStep(), behavior: 'smooth' });
  }

  arrowLeft.addEventListener('click', function () { scrollToCard(-1); });
  arrowRight.addEventListener('click', function () { scrollToCard(1); });

  if (dotsWrap) {
    // um dot por posição possível do carrossel (varia com quantos cards cabem na tela)
    function updateDots() {
      const step = cardStep();
      const maxScroll = productGrid.scrollWidth - productGrid.clientWidth;
      const total = Math.max(1, Math.round(maxScroll / step) + 1);
      const index = Math.min(total - 1, Math.round(productGrid.scrollLeft / step));

      if (dotsWrap.children.length !== total) {
        dotsWrap.innerHTML = '';
        for (let i = 0; i < total; i++) {
          const dot = document.createElement('span');
          dot.className = 'dot';
          dotsWrap.appendChild(dot);
        }
      }

      Array.prototype.forEach.call(dotsWrap.children, function (dot, i) {
        dot.classList.toggle('is-active', i === index);
      });
    }

    let scrollTimeout;
    productGrid.addEventListener('scroll', function () {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateDots, 100);
    });
    window.addEventListener('resize', updateDots);
    updateDots();
  }
}

(function () {
  const card = document.getElementById('jogoVideoCard');
  const video = document.getElementById('jogoVideo');
  if (!card || !video) return;

  const playToggle = document.getElementById('jogoPlayToggle');
  const controlsPlay = document.getElementById('jogoControlsPlay');
  const timeLabel = document.getElementById('jogoVideoTime');
  const progress = document.getElementById('jogoVideoProgress');
  const progressFill = document.getElementById('jogoVideoProgressFill');
  const muteBtn = document.getElementById('jogoVideoMute');
  const fullscreenBtn = document.getElementById('jogoVideoFullscreen');

  const playIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>';
  const volumeOnIcon = muteBtn.innerHTML;
  const volumeOffIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>';

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function updateTime() {
    timeLabel.textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration || 0);
    const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
    progressFill.style.width = pct + '%';
  }

  function togglePlay() {
    if (video.paused || video.ended) {
      video.play();
    } else {
      video.pause();
    }
  }

  video.addEventListener('play', function () {
    card.classList.add('is-playing');
    playToggle.innerHTML = pauseIcon;
    controlsPlay.innerHTML = pauseIcon;
  });
  video.addEventListener('pause', function () {
    card.classList.remove('is-playing');
    playToggle.innerHTML = playIcon;
    controlsPlay.innerHTML = playIcon;
  });
  video.addEventListener('ended', function () {
    card.classList.remove('is-playing');
    playToggle.innerHTML = playIcon;
    controlsPlay.innerHTML = playIcon;
  });
  video.addEventListener('timeupdate', updateTime);
  video.addEventListener('loadedmetadata', updateTime);

  video.addEventListener('click', togglePlay);
  playToggle.addEventListener('click', function (e) { e.stopPropagation(); togglePlay(); });
  controlsPlay.addEventListener('click', function (e) { e.stopPropagation(); togglePlay(); });

  progress.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!video.duration) return;
    const rect = progress.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    video.currentTime = pct * video.duration;
  });

  muteBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    video.muted = !video.muted;
    muteBtn.innerHTML = video.muted ? volumeOffIcon : volumeOnIcon;
  });

  fullscreenBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (card.requestFullscreen) card.requestFullscreen();
  });
})();
(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const status = document.getElementById('contactStatus');
  const button = form.querySelector('button[type="submit"]');

  function showStatus(text, isError) {
    status.textContent = text;
    status.classList.toggle('is-error', !!isError);
    status.hidden = false;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!form.checkValidity()) {
      showStatus('Preencha nome, um e-mail válido e a mensagem.', true);
      form.reportValidity();
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    button.disabled = true;
    showStatus('Enviando...', false);

    try {
      const res = await fetch('/api/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const body = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(body.erro || 'falha ao enviar');

      form.reset();
      showStatus('Mensagem enviada! Em breve entraremos em contato.', false);
    } catch (err) {
      showStatus('Não foi possível enviar agora. Tente novamente em instantes.', true);
    } finally {
      button.disabled = false;
    }
  });
})();
