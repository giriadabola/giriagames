const pendingImports = new Map();
let importInProgress = false;
const LOG_KEY = 'importerLogs';

async function debugLog(event, details = '') {
  const line = `[${new Date().toLocaleTimeString('pt-PT')}] ${event}${details ? ` - ${details}` : ''}`;
  console.log('[GiriaGames Importer]', line);
  const stored = await chrome.storage.local.get(LOG_KEY);
  const logs = Array.isArray(stored[LOG_KEY]) ? stored[LOG_KEY] : [];
  logs.push(line);
  await chrome.storage.local.set({ [LOG_KEY]: logs.slice(-100) });
}

function isSofascoreUrl(url) { return /^https:\/\/(www\.)?sofascore\.com\//i.test(url || ''); }
function isAdminUrl(url) { return /criar-jogadores(?:\.html)?(?:[?#]|$)/i.test(url || ''); }

chrome.tabs.onRemoved.addListener((tabId) => {
  if (pendingImports.has(tabId)) {
    debugLog('Aba de pesquisa fechada pelo utilizador/sistema', `tab=${tabId}`);
    pendingImports.delete(tabId);
    importInProgress = false;
  }
});

async function getActiveSofascoreTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !isSofascoreUrl(tab.url)) throw new Error('Abra primeiro o perfil do jogador no Sofascore.');
  return tab;
}

async function getAdminTab() {
  const tabs = await chrome.tabs.query({});
  return tabs.find(tab => isAdminUrl(tab.url));
}

async function sendMessageWithInjection(tabId, message, scriptFile) {
  await debugLog('A enviar mensagem', `${scriptFile} / ${message.type} / tab ${tabId}`);
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    if (response !== undefined) return response;
    throw new Error('A aba não respondeu à mensagem.');
  } catch (firstError) {
    await debugLog('Mensagem falhou; a injectar script', firstError.message);
    await chrome.scripting.executeScript({ target: { tabId }, files: [scriptFile] });
    await debugLog('Script injectado', `${scriptFile} / tab ${tabId}`);
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

async function extractSofascorePlayer(sofascoreTabId) {
  const extracted = await sendMessageWithInjection(sofascoreTabId, { type: 'EXTRACT_SOFASCORE_PLAYER' }, 'content-sofascore.js');
  if (!extracted?.ok) throw new Error(extracted?.error || 'Não foi possível ler o jogador no Sofascore.');
  await debugLog('Dados Sofascore lidos', extracted.name);
  return extracted;
}

async function waitForAdminPageToSettle(tabId) {
  const settleDelay = 1800;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') {
      await new Promise(resolve => setTimeout(resolve, settleDelay));
      const latestTab = await chrome.tabs.get(tabId);
      if (latestTab.status === 'complete') return;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('A página do admin não terminou de actualizar.');
}

async function fillAdminWithExtracted(adminTabId, extracted, faceId) {
  const filled = await sendMessageWithInjection(adminTabId, {
    type: 'FILL_ADMIN_PLAYER',
    text: extracted.text,
    statsText: extracted.statsText,
    faceId: faceId || '',
    playerName: extracted.name
  }, 'content-admin.js');
  if (!filled?.ok) throw new Error(filled?.error || 'Não foi possível preencher o formulário.');
  await debugLog('Resposta do admin', 'nome=' + (filled.name || 'vazio') + '; imagem=' + (filled.imageCode || 'vazia'));
  return filled;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_DEBUG_LOGS') {
    chrome.storage.local.get(LOG_KEY).then(result => sendResponse({ ok: true, logs: result[LOG_KEY] || [] }));
    return true;
  }

  if (message.type === 'IMPORT_CURRENT_PLAYER') {
    // Limpar estados presos
    pendingImports.clear();
    importInProgress = true;

    (async () => {
      await debugLog('Início da importação');
      const sofascoreTab = (sender.tab && isSofascoreUrl(sender.tab.url)) ? sender.tab : await getActiveSofascoreTab();
      const adminTab = await getAdminTab();
      await debugLog('Abas detectadas', `Sofascore=${sofascoreTab.id}; admin=${adminTab?.id || 'nenhuma'}`);
      if (!adminTab) throw new Error('Não encontrei uma aba aberta em admin/criar-jogadores.html.');

      const extracted = await extractSofascorePlayer(sofascoreTab.id);
      await debugLog('Nome guardado para pesquisa da imagem', extracted.name);

      const searchUrl = new URL('https://sortitoutsi.net/search/database');
      searchUrl.searchParams.set('search', extracted.name || '');
      searchUrl.searchParams.set('type', 'person');
      const searchTab = await chrome.tabs.create({ url: searchUrl.toString(), active: true });
      pendingImports.set(searchTab.id, { sofascoreTabId: sofascoreTab.id, adminTabId: adminTab.id, extracted });
      await debugLog('Pesquisa Sortitoutsi aberta', `${searchTab.id} / ${searchUrl}`);
      sendResponse({ ok: true });
    })().catch(error => { debugLog('ERRO', error.stack || error.message); sendResponse({ ok: false, error: error.message }); }).finally(() => { importInProgress = false; });
    return true;
  }

  if (message.type === 'SORTITOUTSI_NOT_FOUND') {
    if (!sender.tab?.id) return;
    (async () => {
      const pending = pendingImports.get(sender.tab.id);
      if (!pending) return;
      pendingImports.delete(sender.tab.id);

      await debugLog('Jogador não encontrado no Sortitoutsi; a prosseguir sem face');
      await chrome.tabs.remove(sender.tab.id);
      await chrome.tabs.update(pending.adminTabId, { active: true });
      await waitForAdminPageToSettle(pending.adminTabId);
      await fillAdminWithExtracted(pending.adminTabId, pending.extracted, '');
    })().catch(error => debugLog('ERRO FALLBACK SORTITOUTSI', error.message));
    return;
  }

  if (message.type === 'SORTITOUTSI_PLAYER_FOUND') {
    if (!/\/search\/database(?:[?#]|$)/i.test(sender.tab?.url || '')) {
      debugLog('Mensagem Sortitoutsi ignorada fora da pesquisa', sender.tab?.url || 'sem URL');
      return;
    }

    (async () => {
      const pending = pendingImports.get(sender.tab.id);
      if (!pending) { await debugLog('ID ignorado sem importação pendente', `tab=${sender.tab.id}`); return; }
      pendingImports.delete(sender.tab.id);

      const id = String(message.id);
      const slug = String(message.slug || 'player');
      const profileUrl = `https://sortitoutsi.net/football-manager-2026/person/${id}/${slug}`;
      await debugLog('ID encontrado', `ID=${id}`);
      await chrome.tabs.update(sender.tab.id, { url: profileUrl });

      await debugLog('A iniciar download da imagem', `ID=${id}`);
      try {
        const faceResponse = await fetch('http://127.0.0.1:8765/download-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        await debugLog('Resposta do servidor de imagens', `HTTP ${faceResponse.status}`);
        if (!faceResponse.ok) throw new Error('Servidor de imagens indisponível.');
        const faceResult = await faceResponse.json();
        if (!faceResult.ok) throw new Error(faceResult.error || 'Erro no servidor de imagens.');
      } catch (err) {
        await debugLog('Aviso: Servidor de imagem offline ou erro no download. A prosseguir sem imagem.', err.message);
      }

      await debugLog('A fechar perfil Sortitoutsi e focar admin');
      await chrome.tabs.remove(sender.tab.id);
      await chrome.tabs.update(pending.adminTabId, { active: true });
      await debugLog('A aguardar actualização do host no admin');
      await waitForAdminPageToSettle(pending.adminTabId);

      const imageCodeResult = await sendMessageWithInjection(pending.adminTabId, { type: 'SET_IMAGE_CODE', faceId: id }, 'content-admin.js');
      if (!imageCodeResult?.ok) await debugLog('Aviso', 'Não foi possível preencher o Código para Imagem.');
      await debugLog('Código para Imagem preenchido; a iniciar dados Sofascore', id);

      const filled = await fillAdminWithExtracted(pending.adminTabId, pending.extracted, id);
      await debugLog('Dados Sofascore preenchidos depois do código', filled.name || pending.extracted.name);
    })().catch(error => { debugLog('ERRO FINAL', error.stack || error.message); console.error('Importação concluída com erro:', error); });
  }
});

