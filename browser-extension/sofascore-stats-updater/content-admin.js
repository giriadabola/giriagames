// Content Script para admin/editar-jogadores.html

function showFeedbackBanner(message, isSuccess = true) {
  let banner = document.getElementById('stats-updater-feedback-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'stats-updater-feedback-banner';
    document.body.appendChild(banner);
  }

  const bgColor = isSuccess ? '#059669' : '#dc2626';
  const title = isSuccess ? '✅ ESTATÍSTICAS ATUALIZADAS' : '❌ ERRO NA ATUALIZAÇÃO';

  banner.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999999;
    background: ${bgColor};
    color: #ffffff;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    max-width: 450px;
    line-height: 1.5;
    transition: all 0.3s ease;
  `;

  banner.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
      <strong style="font-size: 14px; text-transform: uppercase;">${title}</strong>
      <button onclick="document.getElementById('stats-updater-feedback-banner').remove()" style="background: transparent; border: none; color: white; font-weight: bold; cursor: pointer; font-size: 16px;">✕</button>
    </div>
    <div>${message.replace(/\n/g, '<br>')}</div>
  `;

  setTimeout(() => {
    if (banner && banner.parentNode) banner.remove();
  }, 10000);
}

function getOpenPlayerName() {
  const nameInput = document.getElementById('playerName');
  const modal = document.getElementById('edit-player-popup') || document.getElementById('editPlayerForm');
  
  if (!nameInput || !nameInput.value.trim()) return '';
  return nameInput.value.trim();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_OPEN_PLAYER_INFO') {
    const playerName = getOpenPlayerName();
    if (!playerName || playerName.toLowerCase() === 'sem nome') {
      sendResponse({ ok: false, error: 'Abra o modal de edição de um jogador em admin/editar-jogadores.html.' });
    } else {
      sendResponse({ ok: true, playerName });
    }
    return true;
  }

  if (message.type === 'APPLY_STATS_RESULT') {
    if (message.ok) {
      const statsTextarea = document.getElementById('playerStats');
      if (statsTextarea) {
        statsTextarea.value = message.statsText;
        statsTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        statsTextarea.dispatchEvent(new Event('change', { bubbles: true }));

        // Destacar o campo temporariamente em verde
        statsTextarea.style.border = '2px solid #10b981';
        statsTextarea.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.4)';
        setTimeout(() => {
          statsTextarea.style.border = '';
          statsTextarea.style.boxShadow = '';
        }, 5000);

        showFeedbackBanner(`Estatísticas da época 25/26 coladas com sucesso!\nLiga: ${message.league || 'Encontrada'}\nOverall e Coeficientes recalculados.`, true);
      } else {
        showFeedbackBanner('Não foi possível encontrar o campo #playerStats no formulário.', false);
      }
    } else {
      showFeedbackBanner(message.error || 'Erro ao obter estatísticas do Sofascore.', false);
    }
    sendResponse({ ok: true });
    return true;
  }
});

// Injetar botão auxiliar dentro da caixa de Estatísticas se o modal estiver aberto
function injectHelperButton() {
  const label = document.querySelector('label[for="playerStats"]');
  if (label && !document.getElementById('giria-import-stats-btn')) {
    const btn = document.createElement('button');
    btn.id = 'giria-import-stats-btn';
    btn.type = 'button';
    btn.innerHTML = '⚡ Importar Sofascore 25/26';
    btn.style.cssText = `
      margin-left: 10px;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 700;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      vertical-align: middle;
    `;

    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.innerHTML = '⏳ A pesquisar Sofascore...';
      chrome.runtime.sendMessage({ type: 'START_STATS_UPDATE_PROCESS' }, (res) => {
        if (!res?.ok) {
          showFeedbackBanner(res?.error || 'Erro ao iniciar o processo.', false);
        }
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = '⚡ Importar Sofascore 25/26';
        }, 4000);
      });
    });

    label.appendChild(btn);
  }
}

setInterval(injectHelperButton, 1000);
