const activeTasks = new Map();
const LOG_KEY = 'statsUpdaterLogs';

async function debugLog(source, message) {
  const timestamp = new Date().toLocaleTimeString('pt-PT');
  const line = `[${timestamp}] [${source}] ${message}`;
  console.log('[StatsUpdater]', line);
  
  try {
    const stored = await chrome.storage.local.get(LOG_KEY);
    const logs = Array.isArray(stored[LOG_KEY]) ? stored[LOG_KEY] : [];
    logs.push(line);
    await chrome.storage.local.set({ [LOG_KEY]: logs.slice(-200) });
  } catch (e) {}
}

function isAdminUrl(url) {
  return /editar-jogadores(?:\.html)?(?:[?#]|$)/i.test(url || '');
}

async function getAdminTab() {
  const tabs = await chrome.tabs.query({});
  return tabs.find(tab => isAdminUrl(tab.url));
}

async function sendMessageWithInjection(tabId, message, scriptFile) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    if (response !== undefined) return response;
  } catch (err) {}

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: [scriptFile] }).catch(() => {});
    await new Promise(r => setTimeout(r, 150));
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    throw new Error('Não foi possível comunicar com a página do admin. Por favor, atualize a página admin/editar-jogadores.html (F5).');
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeTasks.has(tabId)) {
    const task = activeTasks.get(tabId);
    activeTasks.delete(tabId);
    if (task?.adminTabId) {
      debugLog('BACKGROUND', 'Aba de pesquisa fechada prematuramente pelo utilizador.');
      chrome.tabs.sendMessage(task.adminTabId, {
        type: 'APPLY_STATS_RESULT',
        ok: false,
        error: 'A aba de pesquisa do Sofascore foi fechada antes de concluir.'
      }).catch(() => {});
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ADD_DEBUG_LOG') {
    debugLog(message.source || 'LOG', message.log || '');
    return;
  }

  if (message.type === 'GET_DEBUG_LOGS') {
    chrome.storage.local.get(LOG_KEY).then(res => sendResponse({ ok: true, logs: res[LOG_KEY] || [] }));
    return true;
  }

  if (message.type === 'CLEAR_DEBUG_LOGS') {
    chrome.storage.local.set({ [LOG_KEY]: [] }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'START_STATS_UPDATE_PROCESS') {
    (async () => {
      await chrome.storage.local.set({ [LOG_KEY]: [] });
      await debugLog('BACKGROUND', '=== INÍCIO DO PROCESSO DE ATUALIZAÇÃO DE ESTATÍSTICAS ===');
      
      const adminTab = await getAdminTab();
      if (!adminTab) {
        throw new Error('Abra primeiro o painel admin/editar-jogadores.html e abra o modal de edição de um jogador.');
      }

      await debugLog('ADMIN', `Aba de administração encontrada (ID: ${adminTab.id})`);

      const info = await sendMessageWithInjection(adminTab.id, { type: 'GET_OPEN_PLAYER_INFO' }, 'content-admin.js');
      if (!info?.ok || !info.playerName) {
        throw new Error('Abra o modal de edição de um jogador em admin/editar-jogadores.html.');
      }

      const playerName = info.playerName;
      await debugLog('ADMIN', `Jogador detetado no modal: "${playerName}"`);

      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(playerName + ' sofascore')}`;
      await debugLog('BACKGROUND', `A abrir pesquisa no Google: "${playerName} sofascore"`);
      
      const searchTab = await chrome.tabs.create({ url: searchUrl, active: true });

      activeTasks.set(searchTab.id, {
        adminTabId: adminTab.id,
        playerName: playerName,
        searchTabId: searchTab.id
      });

      sendResponse({ ok: true, playerName });
    })().catch(error => {
      debugLog('ERRO', error.message);
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'SOFASCORE_PLAYER_LINK_FOUND') {
    if (!sender.tab?.id) return;
    const task = activeTasks.get(sender.tab.id);
    if (!task) return;

    (async () => {
      await debugLog('GOOGLE', `Link do Sofascore recebido: ${message.url}`);
      
      const isTrendingOrInvalid = /trending|tournament|team|equipa|news|rankings|index/i.test(message.url);
      const isPlayerUrl = /\/(?:player|jogador)\//i.test(message.url) && /\/\d+/i.test(message.url);

      if (!isTrendingOrInvalid && isPlayerUrl) {
        await debugLog('BACKGROUND', 'URL validada! Redirecionando aba para o perfil do jogador no Sofascore...');
        await chrome.tabs.update(sender.tab.id, { url: message.url });
      } else {
        throw new Error(`Link inválido bloqueado pelo sistema (${message.url}). Não é o perfil de um jogador.`);
      }
    })().catch(err => {
      debugLog('ERRO', err.message);
      activeTasks.delete(sender.tab.id);
      chrome.tabs.remove(sender.tab.id).catch(() => {});
      chrome.tabs.sendMessage(task.adminTabId, {
        type: 'APPLY_STATS_RESULT',
        ok: false,
        error: err.message
      }).catch(() => {});
    });
    return;
  }

  if (message.type === 'SOFASCORE_STATS_EXTRACTED') {
    if (!sender.tab?.id) return;
    const task = activeTasks.get(sender.tab.id);
    if (!task) return;

    activeTasks.delete(sender.tab.id);

    (async () => {
      await debugLog('SOFASCORE', `Estatísticas 25/26 extraídas com sucesso para a liga "${message.league}"!`);
      await debugLog('BACKGROUND', 'A fechar aba do Sofascore e a regressar ao formulário admin...');

      await chrome.tabs.remove(sender.tab.id);
      await chrome.tabs.update(task.adminTabId, { active: true });

      await sendMessageWithInjection(task.adminTabId, {
        type: 'APPLY_STATS_RESULT',
        ok: true,
        statsText: message.statsText,
        league: message.league
      }, 'content-admin.js');
    })().catch(err => debugLog('ERRO APLICAR ESTATISTICAS', err.message));
    return;
  }

  if (message.type === 'SOFASCORE_STATS_ERROR') {
    if (!sender.tab?.id) return;
    const task = activeTasks.get(sender.tab.id);
    if (!task) return;

    activeTasks.delete(sender.tab.id);

    (async () => {
      await debugLog('ERRO SOFASCORE', message.error);
      await debugLog('BACKGROUND', 'A fechar aba e a enviar mensagem de erro para o admin...');
      await chrome.tabs.remove(sender.tab.id);
      await chrome.tabs.update(task.adminTabId, { active: true });

      await sendMessageWithInjection(task.adminTabId, {
        type: 'APPLY_STATS_RESULT',
        ok: false,
        error: message.error
      }, 'content-admin.js');
    })().catch(err => debugLog('ERRO ENVIAR ERRO ADMIN', err.message));
    return;
  }
});
