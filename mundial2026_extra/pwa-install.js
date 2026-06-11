(() => {
  const APP_URL = 'https://giriagames.com/mundial2026_extra/index.html';
  const DISMISS_KEY = 'ggames-pwa-install-dismissed-v1';
  const banner = () => document.getElementById('pwaInstallBanner');
  const installBtn = () => document.getElementById('pwaInstallBtn');
  const dismissBtn = () => document.getElementById('pwaInstallDismissBtn');
  const text = () => document.getElementById('pwaInstallText');
  let deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
  }

  function isDismissed() {
    return localStorage.getItem(DISMISS_KEY) === '1';
  }

  function showBanner(mode = 'default') {
    const el = banner();
    if (!el || isStandalone() || isDismissed()) return;

    if (mode === 'ios') {
      if (text()) text().textContent = 'No iPhone/iPad: toca em Partilhar e escolhe “Adicionar ao Ecrã principal”.';
      if (installBtn()) installBtn().textContent = 'Como instalar';
    } else {
      if (text()) text().textContent = 'Adiciona esta web app ao ecrã inicial para entrares mais rápido.';
      if (installBtn()) installBtn().textContent = 'Descarregar';
    }

    el.hidden = false;
    document.body.classList.add('has-pwa-banner');
  }

  function hideBanner(permanent = false) {
    const el = banner();
    if (el) el.hidden = true;
    document.body.classList.remove('has-pwa-banner');
    if (permanent) localStorage.setItem(DISMISS_KEY, '1');
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    setTimeout(() => showBanner('default'), 900);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideBanner(true);
  });

  document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    dismissBtn()?.addEventListener('click', () => hideBanner(true));

    installBtn()?.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(() => null);
        deferredPrompt = null;
        hideBanner(true);
        return;
      }

      if (isIos()) {
        alert('Para instalar no iPhone/iPad:\n\n1. Toca no botão Partilhar do Safari\n2. Escolhe “Adicionar ao Ecrã principal”\n3. Confirma em “Adicionar”');
        return;
      }

      alert('Se o botão automático não aparecer, abre o menu do browser e escolhe “Instalar app” ou “Adicionar ao ecrã principal”.\n\nLink: ' + APP_URL);
    });

    // iOS não tem evento beforeinstallprompt. Mostramos uma sugestão própria.
    if (isIos() && !isStandalone() && !isDismissed()) {
      setTimeout(() => showBanner('ios'), 1600);
    }
  });
})();
