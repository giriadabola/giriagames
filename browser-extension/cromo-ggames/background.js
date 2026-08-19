// Service Worker Background Script para Cromo-ggames
let activeTask = null;

async function log(msg, data = '') {
  console.log(`[Cromo-ggames] ${msg}`, data || '');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CROMO_VERIFICATION') {
    const adminTabId = sender.tab?.id;
    activeTask = {
      player: message.player,
      adminTabId: adminTabId,
      startTime: Date.now()
    };
    log('Iniciando verificação para:', message.player.nome);

    // Abrir o Google Search com a flag cromo_ggames=1
    const query = encodeURIComponent(`site:sofascore.com ${message.player.nome}`);
    const searchUrl = `https://www.google.com/search?q=${query}&cromo_ggames=1`;

    chrome.tabs.create({ url: searchUrl, active: true }).then((tab) => {
      activeTask.googleTabId = tab.id;
      sendResponse({ ok: true });
    });
    return true; // async response
  }

  if (message.type === 'GET_ACTIVE_TASK') {
    sendResponse({ ok: true, task: activeTask });
    return true;
  }

  if (message.type === 'SOFASCORE_DATA_EXTRACTED') {
    log('Dados lidos do SofaScore:', message.data);

    if (activeTask && activeTask.adminTabId) {
      const adminTabId = activeTask.adminTabId;
      const sofascoreTabId = sender.tab?.id;

      // Enviar os dados extraídos de volta para a aba da aplicação de gestão admin
      chrome.tabs.sendMessage(adminTabId, {
        type: 'APPLY_SOFASCORE_VERIFICATION',
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

      activeTask = null;
    }
    sendResponse({ ok: true });
    return true;
  }
});
