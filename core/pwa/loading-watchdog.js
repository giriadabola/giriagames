(function startLoadingWatchdog() {
  const path = window.location.pathname.toLowerCase();

  if (/(^|\/)market(?:\.html|\/|$)/.test(path)) {
    return;
  }

  const loadingScreen = document.querySelector(
    '#loading-screen, #global-loading, .loading-screen-global'
  );

  if (!loadingScreen) {
    return;
  }

  const refreshKey = `loading-watchdog:${path}`;
  let refreshTimer = null;

  function isVisible(element) {
    const styles = window.getComputedStyle(element);
    const bounds = element.getBoundingClientRect();

    return styles.display !== 'none'
      && styles.visibility !== 'hidden'
      && styles.opacity !== '0'
      && bounds.width > 0
      && bounds.height > 0;
  }

  function scheduleRefreshIfNeeded() {
    window.clearTimeout(refreshTimer);

    if (!isVisible(loadingScreen)) {
      window.sessionStorage.removeItem(refreshKey);
      return;
    }

    refreshTimer = window.setTimeout(() => {
      const refreshedRecently = Number(window.sessionStorage.getItem(refreshKey) || 0)
        > Date.now() - 15000;

      if (isVisible(loadingScreen) && !refreshedRecently) {
        window.sessionStorage.setItem(refreshKey, String(Date.now()));
        window.location.reload();
      }
    }, 3000);
  }

  const observer = new MutationObserver(scheduleRefreshIfNeeded);
  const observerOptions = {
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden']
  };
  observer.observe(loadingScreen, observerOptions);
  if (document.body) {
    observer.observe(document.body, observerOptions);
  }

  scheduleRefreshIfNeeded();
})();
