// Content Script para o Google Search (Auto-clique no 1º resultado Sofascore)
(async function autoClickGoogleResult() {
  const urlParams = new URLSearchParams(window.location.search);
  const isBatchTask = urlParams.get('batch_ggames') === '1' || urlParams.get('cromo_ggames') === '1';

  if (!isBatchTask) {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TASK' });
      if (!res?.task) return;
    } catch (e) {
      return;
    }
  }

  console.log('[Batch-Importador] A procurar 1º resultado do SofaScore na área de resultados do Google...');

  function getSofascoreUrl(element) {
    if (!element) return null;
    let href = element.getAttribute('href') || element.href || '';
    if (!href) return null;

    if (href.includes('google.com/url?') || href.startsWith('/url?')) {
      try {
        const u = new URL(href, window.location.origin);
        const targetUrl = u.searchParams.get('q') || u.searchParams.get('url');
        if (targetUrl) href = targetUrl;
      } catch (e) {}
    }

    if (href.includes('sofascore.com')) {
      return href;
    }
    return null;
  }

  function findAndClickFirstResult() {
    // Restringir estritamente à área de resultados de pesquisa do Google (evita cabeçalhos, rodapés e Iniciar Sessão)
    const searchContainer = document.getElementById('search') 
                         || document.getElementById('rso') 
                         || document.querySelector('.g')
                         || document.getElementById('main');

    const resultLinks = searchContainer 
      ? Array.from(searchContainer.querySelectorAll('a'))
      : Array.from(document.querySelectorAll('#search a, #rso a, .g a, #main a'));

    if (!resultLinks || resultLinks.length === 0) return false;

    // 1. Dar prioridade total a links de perfis de jogadores Sofascore
    for (const a of resultLinks) {
      const targetUrl = getSofascoreUrl(a);
      if (targetUrl && (targetUrl.includes('/player/') || targetUrl.includes('/football/player/'))) {
        console.log('[Batch-Importador] 1º Resultado Sofascore de jogador encontrado:', targetUrl);
        window.location.href = targetUrl;
        return true;
      }
    }

    // 2. Fallback: Qualquer link para o Sofascore dentro da área de resultados de pesquisa
    for (const a of resultLinks) {
      const targetUrl = getSofascoreUrl(a);
      if (targetUrl) {
        console.log('[Batch-Importador] Resultado Sofascore encontrado:', targetUrl);
        window.location.href = targetUrl;
        return true;
      }
    }

    return false;
  }

  if (!findAndClickFirstResult()) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (findAndClickFirstResult() || attempts > 25) {
        clearInterval(interval);
      }
    }, 250);
  }
})();
