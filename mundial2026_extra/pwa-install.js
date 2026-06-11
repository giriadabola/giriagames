(() => {
  const APP_URL = 'https://giriagames.com/mundial2026_extra/index.html';
  const DISMISS_UNTIL_KEY = 'ggames-pwa-install-dismiss-until-v2';
  const INSTALLED_KEY = 'ggames-pwa-installed-v2';
  const SNOOZE_DAYS = 30;
  let deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
  }

  function dismissedNow() {
    const until = Number(localStorage.getItem(DISMISS_UNTIL_KEY) || 0);
    return until && Date.now() < until;
  }

  function markDismissed(days = SNOOZE_DAYS) {
    localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
  }

  function shouldNotShow() {
    return isStandalone() || localStorage.getItem(INSTALLED_KEY) === '1' || dismissedNow();
  }

  function ensureBanner() {
    let el = document.getElementById('pwaInstallBanner');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'pwaInstallBanner';
    el.className = 'pwa-install-banner pwa-install-banner--compact';
    el.hidden = true;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Instalar web app Ggames Mundial 2026');
    el.innerHTML = `
      <div class="pwa-install-banner__mini-icon" aria-hidden="true">
        <img src="favicon-48x48.png" alt="">
      </div>
      <div class="pwa-install-banner__copy">
        <strong>Ggames Mundial 2026</strong>
        <span id="pwaInstallText">Instala a web app no teu ecrã inicial.</span>
      </div>
      <button id="pwaInstallBtn" type="button" class="pwa-install-btn">Instalar</button>
      <button id="pwaInstallDismissBtn" type="button" class="pwa-dismiss-btn" aria-label="Não mostrar agora">×</button>
    `;
    document.body.appendChild(el);

    el.querySelector('#pwaInstallDismissBtn')?.addEventListener('click', () => hideBanner(true));
    el.querySelector('#pwaInstallBtn')?.addEventListener('click', onInstallClick);
    return el;
  }

  function showBanner(mode = 'default') {
    if (shouldNotShow()) return;
    const el = ensureBanner();
    const text = el.querySelector('#pwaInstallText');
    const btn = el.querySelector('#pwaInstallBtn');

    if (mode === 'ios') {
      text.textContent = 'No iPhone: Partilhar → Adicionar ao Ecrã principal.';
      btn.textContent = 'Ver passos';
    } else {
      text.textContent = 'Instala a web app no teu ecrã inicial.';
      btn.textContent = 'Instalar';
    }

    el.hidden = false;
    document.body.classList.add('has-pwa-banner');
  }

  function hideBanner(snooze = false) {
    const el = document.getElementById('pwaInstallBanner');
    if (el) el.hidden = true;
    document.body.classList.remove('has-pwa-banner');
    if (snooze) markDismissed();
  }

  async function onInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      deferredPrompt = null;
      if (choice?.outcome === 'accepted') {
        localStorage.setItem(INSTALLED_KEY, '1');
      } else {
        markDismissed(7);
      }
      hideBanner(false);
      return;
    }

    if (isIos()) {
      alert('Para instalar no iPhone/iPad:\n\n1. Toca no botão Partilhar do Safari\n2. Escolhe “Adicionar ao Ecrã principal”\n3. Confirma em “Adicionar”');
      markDismissed(7);
      hideBanner(false);
      return;
    }

    alert('Abre o menu do browser e escolhe “Instalar app” ou “Adicionar ao ecrã principal”.\n\nLink: ' + APP_URL);
    markDismissed(7);
    hideBanner(false);
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    setTimeout(() => showBanner('default'), 1200);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    localStorage.setItem(INSTALLED_KEY, '1');
    hideBanner(false);
  });

  document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    if (isStandalone()) {
      localStorage.setItem(INSTALLED_KEY, '1');
      return;
    }

    // iOS/Safari não tem beforeinstallprompt. Mostramos uma sugestão discreta.
    if (isIos() && !shouldNotShow()) {
      setTimeout(() => showBanner('ios'), 1800);
    }
  });
})();
