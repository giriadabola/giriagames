(() => {
  const APP_URL = 'https://giriagames.com/mundial2026_extra/index.html';
  const DISMISS_UNTIL_KEY = 'ggames-pwa-install-dismiss-until-v6';
  const INSTALLED_KEY = 'ggames-pwa-installed-v6';
  const SNOOZE_DAYS = 30;
  let deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
  }

  function cleanupOldBanners() {
    document.querySelectorAll('#pwaInstallBanner, .pwa-install-banner, .gg-pwa-toast').forEach((node) => node.remove());
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

  function injectCss() {
    if (document.getElementById('ggPwaCssV6')) return;
    const style = document.createElement('style');
    style.id = 'ggPwaCssV6';
    style.textContent = `
      #ggPwaInstallV6, #ggPwaInstallV6 * { box-sizing: border-box !important; }
      #ggPwaInstallV6 {
        position: fixed !important;
        left: 10px !important;
        right: 10px !important;
        bottom: calc(10px + env(safe-area-inset-bottom)) !important;
        top: auto !important;
        z-index: 2147483647 !important;
        max-width: 430px !important;
        min-height: 0 !important;
        margin: 0 auto !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 9px 9px 9px 12px !important;
        border-radius: 16px !important;
        border: 1px solid rgba(97,211,148,.42) !important;
        background: rgba(5, 14, 30, .96) !important;
        color: #f8fafc !important;
        box-shadow: 0 18px 44px rgba(0,0,0,.44) !important;
        backdrop-filter: blur(14px) !important;
        -webkit-backdrop-filter: blur(14px) !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        overflow: hidden !important;
      }
      #ggPwaInstallV6[hidden] { display: none !important; }
      #ggPwaInstallV6 .gg-pwa-main { min-width: 0 !important; flex: 1 1 auto !important; }
      #ggPwaInstallV6 .gg-pwa-title { display:block !important; font-size: 12px !important; line-height: 1.15 !important; font-weight: 900 !important; color: #fff !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
      #ggPwaInstallV6 .gg-pwa-sub { display:block !important; margin-top: 2px !important; font-size: 10px !important; line-height: 1.2 !important; color: rgba(203,213,225,.86) !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
      #ggPwaInstallV6 button { appearance: none !important; -webkit-appearance: none !important; box-shadow: none !important; margin: 0 !important; }
      #ggPwaInstallV6 .gg-pwa-action { flex: 0 0 auto !important; border: 1px solid rgba(97,211,148,.6) !important; border-radius: 999px !important; padding: 7px 9px !important; font-size: 11px !important; line-height: 1 !important; font-weight: 900 !important; color: #dcfce7 !important; background: rgba(34,197,94,.13) !important; white-space: nowrap !important; }
      #ggPwaInstallV6 .gg-pwa-x { flex: 0 0 28px !important; width: 28px !important; height: 28px !important; min-width: 28px !important; border-radius: 50% !important; border: 1px solid rgba(255,255,255,.16) !important; background: rgba(255,255,255,.07) !important; color: #e2e8f0 !important; font-size: 18px !important; font-weight: 900 !important; line-height: 1 !important; padding: 0 !important; display: grid !important; place-items: center !important; }
      @media (max-width: 390px) {
        #ggPwaInstallV6 { left: 8px !important; right: 8px !important; padding: 8px !important; gap: 6px !important; }
        #ggPwaInstallV6 .gg-pwa-title { font-size: 11px !important; }
        #ggPwaInstallV6 .gg-pwa-sub { font-size: 9.5px !important; }
        #ggPwaInstallV6 .gg-pwa-action { font-size: 10px !important; padding: 7px 8px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function createBanner(mode) {
    cleanupOldBanners();
    injectCss();
    const el = document.createElement('div');
    el.id = 'ggPwaInstallV6';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Instalar web app');
    el.innerHTML = `
      <div class="gg-pwa-main">
        <span class="gg-pwa-title">Instalar Ggames Mundial 2026</span>
        <span class="gg-pwa-sub">${mode === 'ios' ? 'iPhone: Partilhar → Adicionar ao Ecrã principal.' : 'Adiciona ao ecrã inicial.'}</span>
      </div>
      <button type="button" class="gg-pwa-action">${mode === 'ios' ? 'Passos' : 'Instalar'}</button>
      <button type="button" class="gg-pwa-x" aria-label="Fechar">×</button>
    `;
    el.querySelector('.gg-pwa-x').addEventListener('click', () => { markDismissed(); el.remove(); });
    el.querySelector('.gg-pwa-action').addEventListener('click', onInstallClick);
    document.body.appendChild(el);
  }

  function show(mode = 'default') {
    if (shouldNotShow()) return;
    createBanner(mode);
  }

  async function onInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      deferredPrompt = null;
      if (choice?.outcome === 'accepted') localStorage.setItem(INSTALLED_KEY, '1');
      else markDismissed(7);
      cleanupOldBanners();
      return;
    }
    if (isIos()) {
      alert('Para instalar no iPhone/iPad:\n\n1. Toca no botão Partilhar do Safari\n2. Escolhe “Adicionar ao Ecrã principal”\n3. Confirma em “Adicionar”');
      markDismissed(7);
      cleanupOldBanners();
      return;
    }
    alert('Abre o menu do browser e escolhe “Instalar app” ou “Adicionar ao ecrã principal”.\n\nLink: ' + APP_URL);
    markDismissed(7);
    cleanupOldBanners();
  }

  // Remove imediatamente banners antigos que venham de HTML/cache antes de criar o novo.
  cleanupOldBanners();
  setTimeout(cleanupOldBanners, 250);
  setTimeout(cleanupOldBanners, 1000);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    setTimeout(() => show('default'), 1600);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    localStorage.setItem(INSTALLED_KEY, '1');
    cleanupOldBanners();
  });

  document.addEventListener('DOMContentLoaded', () => {
    cleanupOldBanners();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v=20260611pwa6').catch(() => {});
    if (isStandalone()) {
      localStorage.setItem(INSTALLED_KEY, '1');
      return;
    }
    if (isIos() && !shouldNotShow()) setTimeout(() => show('ios'), 2200);
  });
})();
