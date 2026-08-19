let resultSent = false;

function isDatabaseSearchPage() {
  return /\/search\/database(?:$|[?#])/i.test(window.location.pathname + window.location.search);
}

function findPlayerLink() {
  const links = [...document.querySelectorAll('a[href]')];
  return links.find(link => /\/football-manager-2026\/person\/\d+\//i.test(link.href)) ||
    links.find(link => /\/football-manager\/person\/\d+\//i.test(link.href));
}

function reportPlayerLink() {
  if (!isDatabaseSearchPage() || resultSent) return;
  const link = findPlayerLink();
  if (!link) return;

  const match = link.href.match(/\/person\/(\d+)\/([^/?#]+)/i);
  if (!match) return;
  resultSent = true;
  chrome.runtime.sendMessage({
    type: 'SORTITOUTSI_PLAYER_FOUND',
    id: match[1],
    slug: match[2],
    name: link.textContent.trim(),
    href: link.href
  });
}

reportPlayerLink();
new MutationObserver(reportPlayerLink).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(reportPlayerLink, 1500);

setTimeout(() => {
  if (!resultSent && isDatabaseSearchPage()) {
    resultSent = true;
    chrome.runtime.sendMessage({ type: 'SORTITOUTSI_NOT_FOUND' });
  }
}, 6000);

