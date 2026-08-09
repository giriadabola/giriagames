const PWA_SERVICE_WORKER_URL = './sw.js';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

async function unregisterLocalServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

function registerPwaServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (LOCAL_HOSTNAMES.has(window.location.hostname)) {
    window.addEventListener('load', () => {
      unregisterLocalServiceWorkers().catch((error) => {
        console.error('Falha ao remover o service worker local:', error);
      });
    });
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(PWA_SERVICE_WORKER_URL).catch((error) => {
      console.error('PWA service worker registration failed:', error);
    });
  });
}

registerPwaServiceWorker();
