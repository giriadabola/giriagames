// Service Worker Background Script para Batch Importador de Temporadas
let activeTask = null;

async function log(msg, data = '') {
  console.log(`[Batch-Importador] ${msg}`, data || '');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_BATCH_VERIFICATION') {
    const adminTabId = sender.tab?.id || activeTask?.adminTabId;

    activeTask = {
      isBatch: true,
      targetSeason: message.targetSeason,
      currentIndex: message.currentIndex,
      totalCount: message.totalCount,
      player: message.player,
      currentPlayerName: message.player.nome,
      adminTabId: adminTabId,
      startTime: Date.now()
    };

    log(`Iniciando verificação (${message.currentIndex + 1}/${message.totalCount}) para:`, message.player.nome);

    // Construir pesquisa limpa no Google para o Sofascore: site:sofascore.com Nome do Jogador
    const cleanPlayerName = (message.player.nome || '').replace(/["']/g, '').trim();
    const query = encodeURIComponent(`site:sofascore.com ${cleanPlayerName}`);
    const searchUrl = `https://www.google.com/search?q=${query}&batch_ggames=1`;

    chrome.tabs.create({ url: searchUrl, active: true }).then((tab) => {
      activeTask.googleTabId = tab.id;
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'GET_ACTIVE_TASK') {
    sendResponse({ ok: true, task: activeTask });
    return true;
  }

  if (message.type === 'CANCEL_BATCH_TASK') {
    activeTask = null;
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'SOFASCORE_DATA_EXTRACTED') {
    log('Dados lidos do SofaScore:', message.data);

    if (activeTask && activeTask.adminTabId) {
      const adminTabId = activeTask.adminTabId;
      const sofascoreTabId = sender.tab?.id;

      // Enviar os dados extraídos de volta para a aba de administração
      chrome.tabs.sendMessage(adminTabId, {
        type: 'APPLY_SOFASCORE_BATCH_VERIFICATION',
        player: activeTask.player,
        sofascoreData: message.data
      }).catch(err => console.warn('Erro ao notificar aba do admin:', err));

      // Re-focar a aba do painel Admin
      chrome.tabs.update(adminTabId, { active: true }).catch(() => {});

      // Fechar a aba do SofaScore automaticamente
      if (sofascoreTabId) {
        setTimeout(() => {
          chrome.tabs.remove(sofascoreTabId).catch(() => {});
        }, 300);
      }
    }
    sendResponse({ ok: true });
    return true;
  }
});
