// Content Script para a página de pesquisa do Google

function sendLog(msg) {
  console.log('[StatsUpdater] [GOOGLE]', msg);
  chrome.runtime.sendMessage({ type: 'ADD_DEBUG_LOG', source: 'GOOGLE', log: msg }).catch(() => {});
}

function cleanGoogleUrl(href) {
  if (!href) return '';
  if (href.includes('/url?') || href.includes('&url=')) {
    try {
      const urlObj = new URL(href, window.location.origin);
      const target = urlObj.searchParams.get('q') || urlObj.searchParams.get('url');
      if (target) return target;
    } catch (e) {}
  }
  return href;
}

function isStrictPlayerProfileUrl(href) {
  if (!href || typeof href !== 'string') return false;
  
  // BLOQUEIO TOTAL E CATEGÓRICO: Rejeitar páginas não pertencentes a um jogador
  if (/trending|tournament|team|equipa|news|noticias|rankings|search|index/i.test(href)) return false;
  
  // Exigir obrigatoriamente que contenha sofascore.com, /player/ ou /jogador/, e terminação com ID numérico
  const hasPlayerPath = /\/(?:player|jogador)\//i.test(href);
  const hasNumericId = /\/\d+(?:[?#]|$)/i.test(href);

  return href.includes('sofascore.com') && hasPlayerPath && hasNumericId;
}

(function autoSelectSofascoreResult() {
  sendLog('A analisar os resultados da pesquisa do Google...');
  const startTime = Date.now();

  function findAndRedirect() {
    // Procurar estritamente dentro dos contentores de resultados de pesquisa (#search, #rso, div.g)
    const searchContainer = document.querySelector('#search, #rso, #main') || document.body;
    const allLinks = Array.from(searchContainer.querySelectorAll('a[href]'));
    
    for (const a of allLinks) {
      const rawHref = a.getAttribute('href') || '';
      const cleanHref = cleanGoogleUrl(a.href || rawHref);
      
      if (isStrictPlayerProfileUrl(cleanHref)) {
        sendLog(`Perfil individual de jogador validado: ${cleanHref}`);
        chrome.runtime.sendMessage({
          type: 'SOFASCORE_PLAYER_LINK_FOUND',
          url: cleanHref
        });
        return true;
      }
    }

    if (Date.now() - startTime < 3500) {
      setTimeout(findAndRedirect, 300);
    } else {
      sendLog('Erro: Nenhum perfil individual de jogador do Sofascore foi encontrado na pesquisa.');
      chrome.runtime.sendMessage({
        type: 'SOFASCORE_STATS_ERROR',
        error: 'Não foi possível encontrar o perfil do jogador no Sofascore via Google.'
      });
    }
  }

  findAndRedirect();
})();
