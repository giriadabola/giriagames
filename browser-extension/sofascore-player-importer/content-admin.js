function readAdminFields() {
  return {
    name: document.getElementById('nome-jogador')?.value || '',
    country: document.getElementById('pais-jogador')?.value || '',
    club: document.getElementById('clube-jogador')?.value || '',
    position: document.getElementById('posicao-jogador')?.value || '',
    birthDate: document.getElementById('data-nascimento')?.value || '',
    height: document.getElementById('altura-jogador')?.value || '',
    imageCode: document.getElementById('codigo-url-jogador')?.value || ''
  };
}

function restoreAdminFields(snapshot) {
  if (!snapshot) return;
  const fields = {
    'nome-jogador': snapshot.name,
    'pais-jogador': snapshot.country,
    'clube-jogador': snapshot.club,
    'posicao-jogador': snapshot.position,
    'data-nascimento': snapshot.birthDate,
    'altura-jogador': snapshot.height,
    'codigo-url-jogador': snapshot.imageCode
  };
  Object.entries(fields).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field && value) {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

async function waitForAdminReady() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    const fillButton = document.getElementById('fill-form-btn');
    const validationMessage = document.getElementById('player-name-validation');
    if (fillButton && validationMessage) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await new Promise(resolve => setTimeout(resolve, 500));
}

globalThis.__giriaGamesImportedSnapshot ||= null;

if (!globalThis.__giriaGamesAdminFillListenerInstalled) {
  globalThis.__giriaGamesAdminFillListenerInstalled = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'FILL_ADMIN_PLAYER') return;

    (async () => {
      const pasteField = document.getElementById('player-data-paste');
      const fillButton = document.getElementById('fill-form-btn');
      if (!pasteField || !fillButton) {
        sendResponse({ ok: false, error: 'Abra admin/criar-jogadores.html e a janela de Preenchimento Rápido.' });
        return;
      }

      await waitForAdminReady();
      pasteField.value = message.text;
      pasteField.dispatchEvent(new Event('input', { bubbles: true }));
      fillButton.click();

      if (message.statsText) {
        const statsField = document.getElementById('estatisticas-jogador');
        if (statsField) {
          statsField.value = message.statsText;
          statsField.dispatchEvent(new Event('input', { bubbles: true }));
          statsField.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      if (message.playerName) {
        setTimeout(() => {
          const nameField = document.getElementById('nome-jogador');
          if (nameField) {
            nameField.value = message.playerName;
            nameField.dispatchEvent(new Event('input', { bubbles: true }));
            nameField.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, 180);
      }

      setTimeout(() => {
        globalThis.__giriaGamesImportedSnapshot = readAdminFields();
        sendResponse({ ok: true, name: globalThis.__giriaGamesImportedSnapshot.name, imageCode: globalThis.__giriaGamesImportedSnapshot.imageCode, fields: globalThis.__giriaGamesImportedSnapshot });
      }, 450);
    })().catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'SET_IMAGE_CODE') return;
  const before = readAdminFields();
  const importedSnapshot = message.snapshot || before;
  if (importedSnapshot.name || importedSnapshot.country || importedSnapshot.club || importedSnapshot.birthDate || importedSnapshot.height) {
    globalThis.__giriaGamesImportedSnapshot = importedSnapshot;
  }

  const imageCodeField = document.getElementById('codigo-url-jogador');
  if (!imageCodeField) {
    sendResponse({ ok: false, error: 'Campo Código para Imagem não encontrado.' });
    return;
  }

  imageCodeField.value = String(message.faceId || '');
  imageCodeField.dispatchEvent(new Event('input', { bubbles: true }));
  imageCodeField.dispatchEvent(new Event('change', { bubbles: true }));
  sendResponse({ ok: true, imageCode: imageCodeField.value });
});