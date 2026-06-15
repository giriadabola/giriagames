(() => {
  const DISMISS_UNTIL_KEY = 'ggames-ed-game-pwa-dismiss-until-v1';
  const INSTALLED_KEY = 'ggames-ed-game-pwa-installed-v1';
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

  function dismiss(days = 30) {
    localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
  }

  function shouldHide() {
    return isStandalone() || localStorage.getItem(INSTALLED_KEY) === '1' || dismissedNow();
  }

  function showInstallBanner(mode = 'default') {
    if (shouldHide() || document.getElementById('edPwaBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'edPwaBanner';
    banner.className = 'ed-pwa-banner';
    banner.innerHTML = `
      <div>
        <strong>Instalar Editor de Jogos</strong>
        <span>${mode === 'ios' ? 'Safari: Partilhar → Adicionar ao Ecrã principal.' : 'Adicionar esta página como web app.'}</span>
      </div>
      <button type="button" class="ed-pwa-install">${mode === 'ios' ? 'Passos' : 'Instalar'}</button>
      <button type="button" class="ed-pwa-close" aria-label="Fechar">×</button>
    `;
    banner.querySelector('.ed-pwa-close').addEventListener('click', () => {
      dismiss();
      banner.remove();
    });
    banner.querySelector('.ed-pwa-install').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice.catch(() => null);
        if (choice?.outcome === 'accepted') localStorage.setItem(INSTALLED_KEY, '1');
        else dismiss(7);
        deferredPrompt = null;
        banner.remove();
        return;
      }
      if (isIos()) alert('Para instalar:\n\n1. Abre no Safari\n2. Toca em Partilhar\n3. Escolhe “Adicionar ao Ecrã principal”\n4. Confirma em “Adicionar”');
      else alert('Abre o menu do browser e escolhe “Instalar app” ou “Adicionar ao ecrã principal”.');
      dismiss(7);
      banner.remove();
    });
    document.body.appendChild(banner);
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    setTimeout(() => showInstallBanner('default'), 1200);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    localStorage.setItem(INSTALLED_KEY, '1');
    document.getElementById('edPwaBanner')?.remove();
  });

  document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v=20260615edgame2', { scope: './' }).catch(() => {});
    if (isStandalone()) {
      localStorage.setItem(INSTALLED_KEY, '1');
      return;
    }
    if (isIos()) setTimeout(() => showInstallBanner('ios'), 1600);
  });
})();
