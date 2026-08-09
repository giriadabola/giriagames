const PWA_SERVICE_WORKER_URL = './sw.js';

function registerPwaServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(PWA_SERVICE_WORKER_URL, {
      scope: '/',
      updateViaCache: 'none'
    }).then((registration) => registration.update()).catch((error) => {
      console.error('PWA service worker registration failed:', error);
    });
  });
}

registerPwaServiceWorker();
