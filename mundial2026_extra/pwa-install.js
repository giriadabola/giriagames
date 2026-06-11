(() => {
  const APP_URL = 'https://giriagames.com/mundial2026_extra/index.html';
  const DISMISS_UNTIL_KEY = 'ggames-pwa-install-dismiss-until-v4';
  const INSTALLED_KEY = 'ggames-pwa-installed-v4';
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

  function injectCriticalCss() {
    if (document.getElementById('pwaInstallCriticalCss')) return;
    const style = document.createElement('style');
    style.id = 'pwaInstallCriticalCss';
    style.textContent = `
      #pwaInstallBanner.gg-pwa-toast {
        position: fixed !important;
        left: 12px !important;
        right: 12px !important;
        bottom: max(12px, env(safe-area-inset-bottom)) !important;
        top: auto !important;
        z-index: 2147483000 !important;
        max-width: 460px !important;
        margin: 0 auto !important;
        box-sizing: border-box !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto 34px !important;
        gap: 8px !important;
        align-items: center !important;
        padding: 10px 10px 10px 12px !important;
        border-radius: 16px !important;
        border: 1px solid rgba(97,211,148,.36) !important;
        background: rgba(7,18,38,.96) !important;
        color: #f8fafc !important;
        box-shadow: 0 14px 44px rgba(0,0,0,.42) !important;
        backdrop-filter: blur(14px) !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      }
      #pwaInstallBanner.gg-pwa-toast[hidden] { display: none !important; }
      #pwaInstallBanner .gg-pwa-copy { min-width: 0 !important; display: grid !important; gap: 1px !important; }
      #pwaInstallBanner .gg-pwa-title { font-size: 13px !important; line-height: 1.15 !important; font-weight: 900 !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; color: #ffffff !important; }
      #pwaInstallBanner .gg-pwa-text { font-size: 11px !important; line-height: 1.2 !important; color: rgba(203,213,225,.82) !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
      #pwaInstallBanner .gg-pwa-install,
      #pwaInstallBanner .gg-pwa-close { appearance: none !important; box-sizing: border-box !important; margin: 0 !important; }
      #pwaInstallBanner .gg-pwa-install { border: 1px solid rgba(97,211,148,.62) !important; border-radius: 999px !important; padding: 7px 10px !important; font-size: 12px !important; line-height: 1 !important; font-weight: 900 !important; color: #dcfce7 !important; background: rgba(34,197,94,.12) !important; white-space: nowrap !important; box-shadow: none !important; }
      #pwaInstallBanner .gg-pwa-close { width: 30px !important; height: 30px !important; min-width: 30px !important; border-radius: 999px !important; border: 1px solid rgba(255,255,255,.16) !important; background: rgba(255,255,255,.07) !important; color: #e2e8f0 !important; font-size: 20px !important; line-height: 1 !important; font-weight: 900 !important; padding: 0 !important; display: grid !important; place-items: center !important; }
      @media (max-width: 420px) {
        #pwaInstallBanner.gg-pwa-toast { left: 8px !important; right: 8px !important; grid-template-columns: minmax(0, 1fr) auto 30px !important; padding: 9px !important; gap: 6px !important; }
        #pwaInstallBanner .gg-pwa-title { font-size: 12px !important; }
        #pwaInstallBanner .gg-pwa-text { font-size: 10px !important; }
        #pwaInstallBanner .gg-pwa-install { font-size: 11px !important; padding: 7px 8px !important; }
        #pwaInstallBanner .gg-pwa-close { width: 28px !important; height: 28px !important; min-width: 28px !important; font-size: 18px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureBanner() {
    injectCriticalCss();
    document.querySelectorAll('.pwa-install-banner').forEach((node) => {
      if (node.id !== 'pwaInstallBanner') node.remove();
    });

    let el = document.getElementById('pwaInstallBanner');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'pwaInstallBanner';
    el.className = 'gg-pwa-toast';
    el.hidden = true;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Instalar web app Ggames Mundial 2026');
    el.innerHTML = `
      <div class="gg-pwa-copy">
        <div class="gg-pwa-title">Instalar Ggames Mundial 2026</div>
        <div id="pwaInstallText" class="gg-pwa-text">Adiciona ao ecrã inicial.</div>
      </div>
      <button id="pwaInstallBtn" type="button" class="gg-pwa-install">Instalar</button>
      <button id="pwaInstallDismissBtn" type="button" class="gg-pwa-close" aria-label="Não mostrar agora">×</button>
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
      text.textContent = 'iPhone: Partilhar → Adicionar ao Ecrã principal.';
      btn.textContent = 'Passos';
    } else {
      text.textContent = 'Adiciona ao ecrã inicial.';
      btn.textContent = 'Instalar';
    }

    el.hidden = false;
  }

  function hideBanner(snooze = false) {
    const el = document.getElementById('pwaInstallBanner');
    if (el) el.hidden = true;
    if (snooze) markDismissed();
  }

  async function onInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      deferredPrompt = null;
      if (choice?.outcome === 'accepted') localStorage.setItem(INSTALLED_KEY, '1');
      else markDismissed(7);
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
    setTimeout(() => showBanner('default'), 1400);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    localStorage.setItem(INSTALLED_KEY, '1');
    hideBanner(false);
  });

  document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
    if (isStandalone()) {
      localStorage.setItem(INSTALLED_KEY, '1');
      return;
    }
    if (isIos() && !shouldNotShow()) setTimeout(() => showBanner('ios'), 1800);
  });
})();
