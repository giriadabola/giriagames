// Content Script para admin/editar-jogadores.html (Importador Batch por Temporada)

console.log('[Batch-Importador] Script ativo no painel de administração GiriaGames.');

function cleanTeamName(raw) {
  if (!raw) return '';
  let text = String(raw).trim();
  text = text.replace(/(?:Contrato|Contract|Emprestado|Loan|Até|Until).*/i, '').trim();
  text = text.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  text = text.replace(/(?:Contrato|Contract|Emprestado|Loan|Até|Until).*/i, '').trim();
  return text.split(/[\r\n]/)[0].trim();
}

function normalizeText(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeFuzzy(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(de|da|do|dos|das|of|fc|cf|sc|afc|cd|ud|sd|club|clube|football|futebol)\b/gi, '')
    .replace(/[^a-z0-9]/g, '');
}

function getDatabaseClubs() {
  // 1. Tentar ler do script #ggames-clubs-data
  const jsonEl = document.getElementById('ggames-clubs-data');
  if (jsonEl && jsonEl.textContent) {
    try {
      const parsed = JSON.parse(jsonEl.textContent);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.warn('[Batch-Importador] Erro ao ler ggames-clubs-data:', e);
    }
  }

  // 2. Fallback: Ler os elementos option no DOM
  const optionElements = Array.from(document.querySelectorAll('#modal-clubs-list option, #filter-clube option, select[name*="clube"] option, select[id*="clube"] option, datalist option'));
  const clubsMap = new Map();

  optionElements.forEach(opt => {
    const val = (opt.value || '').trim();
    const text = (opt.textContent || '').trim();
    if ((!val && !text) || val === 'N/A' || val.startsWith('Todos') || text.startsWith('Todos')) return;

    const mainName = val || text;
    const nomeEnAttr = opt.dataset?.nome_en 
      || opt.dataset?.nomeEn 
      || opt.getAttribute('data-nome_en') 
      || opt.getAttribute('data-nome-en') 
      || '';

    let secondaryName = nomeEnAttr;
    if (!secondaryName && text && val && text !== val && !text.startsWith('<')) {
      secondaryName = text;
    }

    const key = mainName.toLowerCase();
    if (!clubsMap.has(key)) {
      clubsMap.set(key, {
        nome: mainName,
        nome_en: secondaryName
      });
    } else if (secondaryName && !clubsMap.get(key).nome_en) {
      clubsMap.get(key).nome_en = secondaryName;
    }
  });

  return Array.from(clubsMap.values());
}

function findMatchingClubInDatabase(sofascoreClubName, databaseClubs) {
  const cleanName = cleanTeamName(sofascoreClubName);
  if (!cleanName) return { found: true, name: '' };

  const sNorm = normalizeText(cleanName);
  const sFuzzy = normalizeFuzzy(cleanName);
  if (!sNorm) return { found: true, name: '' };

  const getClubFields = (item) => {
    if (typeof item === 'string') {
      return { nome: item, nome_en: '' };
    }
    return {
      nome: item.nome || '',
      nome_en: item.nome_en || ''
    };
  };

  // 1. Correspondência exata normalizada (nome + nome_en)
  let match = databaseClubs.find(item => {
    const { nome, nome_en } = getClubFields(item);
    const nNorm = normalizeText(nome);
    const nEnNorm = normalizeText(nome_en);
    return (nNorm && sNorm === nNorm) || (nEnNorm && sNorm === nEnNorm);
  });
  if (match) return { found: true, name: getClubFields(match).nome };

  // 2. Correspondência exata fuzzy (sem conectores "de", "do", "fc", etc.)
  if (sFuzzy) {
    match = databaseClubs.find(item => {
      const { nome, nome_en } = getClubFields(item);
      const nFuzzy = normalizeFuzzy(nome);
      const nEnFuzzy = normalizeFuzzy(nome_en);
      return (nFuzzy && sFuzzy === nFuzzy) || (nEnFuzzy && sFuzzy === nEnFuzzy);
    });
    if (match) return { found: true, name: getClubFields(match).nome };
  }

  // 3. Sub-string normalizada (nome + nome_en)
  match = databaseClubs.find(item => {
    const { nome, nome_en } = getClubFields(item);
    const nNorm = normalizeText(nome);
    const nEnNorm = normalizeText(nome_en);
    return (nNorm && (sNorm.includes(nNorm) || nNorm.includes(sNorm))) ||
           (nEnNorm && (sNorm.includes(nEnNorm) || nEnNorm.includes(sNorm)));
  });
  if (match) return { found: true, name: getClubFields(match).nome };

  // 4. Sub-string fuzzy (nome + nome_en)
  if (sFuzzy) {
    match = databaseClubs.find(item => {
      const { nome, nome_en } = getClubFields(item);
      const nFuzzy = normalizeFuzzy(nome);
      const nEnFuzzy = normalizeFuzzy(nome_en);
      return (nFuzzy && (sFuzzy.includes(nFuzzy) || nFuzzy.includes(sFuzzy))) ||
             (nEnFuzzy && (sFuzzy.includes(nEnFuzzy) || nEnFuzzy.includes(sFuzzy)));
    });
    if (match) return { found: true, name: getClubFields(match).nome };
  }

  return { found: false, name: cleanName };
}

let batchState = {
  running: false,
  targetSeason: '',
  queue: [],
  currentIndex: 0,
  totalCount: 0,
  timeoutTimer: null
};

function showBatchBanner(message, type = 'error') {
  let banner = document.getElementById('batch-import-alert-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'batch-import-alert-banner';
    document.body.appendChild(banner);
  }

  const bgColor = type === 'success' ? '#2ecc71' : (type === 'warning' ? '#e74c3c' : '#e74c3c');
  const borderColor = type === 'success' ? '#27ae60' : '#c0392b';
  const title = type === 'success' ? '🎉 BATCH CONCLUÍDO' : '🛑 PROCESSO PARADO';

  banner.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: ${bgColor};
    color: #ffffff;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 13px;
    max-width: 450px;
    border-left: 6px solid ${borderColor};
    line-height: 1.5;
    transition: all 0.3s ease;
  `;

  banner.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
      <strong style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">${title}</strong>
      <button onclick="document.getElementById('batch-import-alert-banner').remove()" style="background: transparent; border: none; color: white; font-weight: bold; cursor: pointer; font-size: 16px; margin-left: 10px;">✕</button>
    </div>
    <div>${message.replace(/\n/g, '<br>')}</div>
  `;
}

function stopBatchImport(msg = '') {
  if (batchState.timeoutTimer) {
    clearTimeout(batchState.timeoutTimer);
    batchState.timeoutTimer = null;
  }

  batchState.running = false;
  batchState.queue = [];
  chrome.runtime.sendMessage({ type: 'CANCEL_BATCH_TASK', reason: msg }).catch(() => {});

  if (msg) {
    console.warn('[Batch-Importador]', msg);
    showBatchBanner(msg, 'error');
  }
}

function startBatchImport(targetSeason) {
  const handler = (e) => {
    window.removeEventListener('CROMO_PAGE_INFO_RESPONSE', handler);
    const { playersMissingSeason } = e.detail;

    if (!playersMissingSeason || playersMissingSeason.length === 0) {
      alert(`[Batch-Importador] 🎉 Todos os jogadores já possuem a temporada "${targetSeason}" criada!`);
      return;
    }

    batchState = {
      running: true,
      targetSeason: targetSeason,
      queue: playersMissingSeason,
      currentIndex: 0,
      totalCount: playersMissingSeason.length,
      timeoutTimer: null
    };

    console.log(`[Batch-Importador] A iniciar batch de ${batchState.totalCount} jogadores para a época ${targetSeason}`);
    processNextBatchPlayer();
  };

  window.addEventListener('CROMO_PAGE_INFO_RESPONSE', handler);
  window.dispatchEvent(new CustomEvent('CROMO_GET_PAGE_INFO', { detail: { targetSeason } }));
}

function processNextBatchPlayer() {
  if (!batchState.running) return;

  if (batchState.currentIndex >= batchState.queue.length) {
    const doneMsg = `Todos os ${batchState.totalCount} jogadores foram atualizados para a época "${batchState.targetSeason}".`;
    showBatchBanner(doneMsg, 'success');
    alert(`[Batch-Importador] 🎉 Processo concluído com sucesso!\n\n${doneMsg}`);
    stopBatchImport();
    return;
  }

  const currentPlayer = batchState.queue[batchState.currentIndex];
  console.log(`[Batch-Importador] (${batchState.currentIndex + 1}/${batchState.totalCount}) A abrir popup para: ${currentPlayer.nome}`);

  if (batchState.timeoutTimer) {
    clearTimeout(batchState.timeoutTimer);
  }

  // Timer de segurança de 25s para caso a pesquisa encrave ou a ligação esteja lenta
  batchState.timeoutTimer = setTimeout(() => {
    if (batchState.running) {
      const timeoutMsg = `Tempo limite (25s) excedido ao pesquisar no Sofascore o jogador "${currentPlayer.nome}". O processo parou.`;
      stopBatchImport(timeoutMsg);
      alert(`[Batch-Importador] ⚠️ O PROCESSO PAROU!\n\n${timeoutMsg}`);
    }
  }, 25000);

  // 1. Abrir o popup do jogador visivelmente no ecrã para a época pretendida
  window.dispatchEvent(new CustomEvent('CROMO_OPEN_PLAYER_FOR_SEASON', {
    detail: {
      playerId: currentPlayer.id,
      targetSeason: batchState.targetSeason
    }
  }));

  // 2. Aguardar tempo para o popup abrir no ecrã e copiar o nome exato do campo #playerName
  setTimeout(() => {
    if (!batchState.running) return;

    // Copiar o NOME EXATO diretamente da caixa do formulário aberta no ecrã (#playerName)
    const popupNameInput = document.getElementById('playerName');
    const exactNameFromPopup = (popupNameInput?.value || '').trim() || (currentPlayer.nome || '').trim();
    const nameLower = exactNameFromPopup.toLowerCase();

    if (!exactNameFromPopup || nameLower === 'sem nome' || nameLower === 'sem_nome' || nameLower === 'sem-nome') {
      const invalidMsg = `O jogador (ID: ${currentPlayer.id}) tem um nome inválido ou "Sem Nome" ("${exactNameFromPopup || 'vazio'}"). O processo batch foi BLOQUEADO e nada foi gravado.`;
      stopBatchImport(invalidMsg);
      alert(`[Batch-Importador] ⚠️ O PROCESSO PAROU!\n\n${invalidMsg}`);
      return;
    }

    console.log(`[Batch-Importador] Nome copiado do popup: "${exactNameFromPopup}"`);

    chrome.runtime.sendMessage({
      type: 'START_BATCH_VERIFICATION',
      player: {
        id: currentPlayer.id,
        nome: exactNameFromPopup,
        clube: currentPlayer.clube,
        pais: currentPlayer.pais
      },
      targetSeason: batchState.targetSeason,
      currentIndex: batchState.currentIndex,
      totalCount: batchState.totalCount
    });
  }, 400);
}

// Escutar mensagens do Popup e Background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_EDITAR_JOGADORES_INFO') {
    const handler = (e) => {
      window.removeEventListener('CROMO_PAGE_INFO_RESPONSE', handler);
      sendResponse(e.detail);
    };
    window.addEventListener('CROMO_PAGE_INFO_RESPONSE', handler);
    window.dispatchEvent(new CustomEvent('CROMO_GET_PAGE_INFO'));
    return true;
  }

  if (message.type === 'START_BATCH_SEASON_IMPORT') {
    startBatchImport(message.targetSeason);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'STOP_BATCH_IMPORT') {
    stopBatchImport('O processo foi interrompido manualmente pelo utilizador.');
    sendResponse({ ok: true });
    return true;
  }

function renderChangeSummaryInModal(targetSeason, oldClub, newClub, oldPosicao, newPosicao, isRetired = false) {
  const form = document.getElementById('editPlayerForm') || document.querySelector('#edit-player-popup form');
  if (!form) return;

  let summaryBox = document.getElementById('cromo-batch-summary-box');
  if (!summaryBox) {
    summaryBox = document.createElement('div');
    summaryBox.id = 'cromo-batch-summary-box';
    form.insertBefore(summaryBox, form.firstChild);
  }

  const clubChanged = (oldClub || '').trim().toLowerCase() !== (newClub || '').trim().toLowerCase();
  const posChanged = (oldPosicao || '').trim().toLowerCase() !== (newPosicao || '').trim().toLowerCase();

  summaryBox.style.cssText = `
    background: rgba(46, 204, 113, 0.15);
    border: 1.5px solid #2ecc71;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    color: #f0f2f5;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    box-shadow: 0 4px 15px rgba(0,0,0,0.4);
  `;

  summaryBox.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-weight: bold; color: #2ecc71; font-size: 14px;">
      <span>✨ Alterações a Gravar ➔ Época ${targetSeason}</span>
      <span style="font-size: 11px; background: rgba(46,204,113,0.25); padding: 2px 8px; border-radius: 12px; color: #2ecc71;">A visualizar alterações (2.5s)...</span>
    </div>
    <div style="margin-top: 6px;">
      <div>• <strong>Clube do Jogador:</strong> ${isRetired ? '<strong style="color: #e74c3c;">Vazio / Limpo (Retirado)</strong>' : (clubChanged && oldClub ? `<span style="text-decoration: line-through; color: #e74c3c; margin-right: 6px;">${oldClub}</span> <strong style="color: #2ecc71;">${newClub}</strong>` : `<strong style="color: #2ecc71;">${newClub}</strong>`)}</div>
      <div>• <strong>Posição do Jogador:</strong> ${posChanged && oldPosicao ? `<span style="text-decoration: line-through; color: #e74c3c; margin-right: 6px;">${oldPosicao}</span>` : ''} <strong style="color: #2ecc71;">${newPosicao || oldPosicao || 'N/A'}</strong></div>
      <div>• <strong>Campo Retirado:</strong> <strong style="color: ${isRetired ? '#e74c3c' : '#2ecc71'};">${isRetired ? 'true' : 'false'}</strong></div>
      <div>• <strong>Coeficientes / Estatísticas:</strong> <span style="color: #f39c12; font-style: italic;">Limpo (Época Nova)</span></div>
    </div>
  `;

  const modalClubeInput = document.getElementById('playerClub');
  const modalPosicaoSelect = document.getElementById('playerPosition');
  if (modalClubeInput) {
    modalClubeInput.style.border = '2px solid #2ecc71';
    modalPosicaoSelect.style.border = '2px solid #2ecc71';
  }
}

function clearChangeSummaryFromModal() {
  const summaryBox = document.getElementById('cromo-batch-summary-box');
  if (summaryBox) summaryBox.remove();

  const modalClubeInput = document.getElementById('playerClub');
  const modalPosicaoSelect = document.getElementById('playerPosition');
  if (modalClubeInput) modalClubeInput.style.border = '';
  if (modalPosicaoSelect) modalPosicaoSelect.style.border = '';
}

  if (message.type === 'APPLY_SOFASCORE_BATCH_VERIFICATION') {
    const { player, sofascoreData } = message;
    console.log('[Batch-Importador] Dados recebidos do Sofascore para:', player.nome, sofascoreData);

    if (!batchState.running) return;

    if (batchState.timeoutTimer) {
      clearTimeout(batchState.timeoutTimer);
      batchState.timeoutTimer = null;
    }

    const currentPlayer = batchState.queue[batchState.currentIndex];

    // Validação de Segurança: O nome nunca pode ficar vazio ou "Sem Nome"
    const popupNameInput = document.getElementById('playerName');
    const currentName = (popupNameInput?.value || '').trim() || (player?.nome || '').trim();
    const currentNameLower = currentName.toLowerCase();
    if (!currentName || currentNameLower === 'sem nome' || currentNameLower === 'sem_nome' || currentNameLower === 'sem-nome') {
      const invalidNameMsg = `O nome do jogador é inválido ou "Sem Nome" ("${currentName || 'vazio'}"). O processo batch foi BLOQUEADO e impedido de gravar.`;
      stopBatchImport(invalidNameMsg);
      alert(`[Batch-Importador] ⚠️ O PROCESSO PAROU!\n\n${invalidNameMsg}`);
      sendResponse({ ok: false, error: invalidNameMsg });
      return true;
    }

    const modalClubeInput = document.getElementById('playerClub');
    const modalPosicaoSelect = document.getElementById('playerPosition');
    const playerStatsEl = document.getElementById('playerStats');

    const oldClub = modalClubeInput?.value?.trim() || '';
    const oldPosicao = modalPosicaoSelect?.value?.trim() || '';

    const newEquipa = cleanTeamName(sofascoreData.equipa);
    const newPosicao = (sofascoreData.posicao || '').trim();

    const isRetired = /^retirado$/i.test(newEquipa) || /retired/i.test(newEquipa) || /fim de carreira/i.test(newEquipa) || /carreira terminada/i.test(newEquipa);

    let finalClub = '';
    let finalPosicao = newPosicao || oldPosicao;

    if (isRetired) {
      console.log('[Batch-Importador] Jogador detetado como Retirado. Limpando clube e ativando campo Retirado=true');

      if (modalClubeInput) {
        modalClubeInput.value = '';
        modalClubeInput.dispatchEvent(new Event('input', { bubbles: true }));
        modalClubeInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const modalRetiredSelect = document.getElementById('playerRetired');
      if (modalRetiredSelect) {
        modalRetiredSelect.value = 'Sim';
        modalRetiredSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      // 1. Verificar se a equipa existe na BD (nome + nome_en)
      const dbClubs = getDatabaseClubs();
      console.log('[Batch-Importador] Clubes na BD encontrados:', dbClubs.length, dbClubs);
      const clubCheck = findMatchingClubInDatabase(newEquipa, dbClubs);
      console.log('[Batch-Importador] Resultado verificação clube:', newEquipa, clubCheck);

      if (!clubCheck.found) {
        // Clube NÃO EXISTE na BD -> Preenche o input do clube no popup visível, MANTÉM O POPUP ABERTO e PARAR O PROCESSO!
        if (modalClubeInput && newEquipa) {
          modalClubeInput.value = newEquipa;
          modalClubeInput.dispatchEvent(new Event('input', { bubbles: true }));
          modalClubeInput.style.border = '2px solid #e74c3c';
        }
        const missingMsg = `O clube "${newEquipa}" (do jogador "${currentPlayer.nome}") não existe na base de dados!\n\nPor favor, crie este clube no painel admin em "criar-clubes.html" antes de continuar.`;
        stopBatchImport(missingMsg);
        alert(`[Batch-Importador] ⚠️ O PROCESSO PAROU!\n\n${missingMsg}`);
        sendResponse({ ok: true });
        return true;
      }

      // 2. Clube EXISTE na BD -> Preencher os campos no popup aberto no ecrã
      finalClub = clubCheck.name;

      if (modalClubeInput) {
        modalClubeInput.value = finalClub;
        modalClubeInput.dispatchEvent(new Event('input', { bubbles: true }));
        modalClubeInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const modalRetiredSelect = document.getElementById('playerRetired');
      if (modalRetiredSelect) {
        modalRetiredSelect.value = 'Não';
        modalRetiredSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    if (finalPosicao && modalPosicaoSelect) {
      const options = Array.from(modalPosicaoSelect.options);
      const matchOpt = options.find(o => o.value.toLowerCase() === finalPosicao.toLowerCase());
      if (matchOpt) {
        modalPosicaoSelect.value = matchOpt.value;
        modalPosicaoSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // Limpar campo estatísticas (Coeficientes) para a nova época
    if (playerStatsEl) playerStatsEl.value = '';

    // Exibir caixa verde de resumo de alterações no topo da modal
    renderChangeSummaryInModal(batchState.targetSeason, oldClub, finalClub, oldPosicao, finalPosicao, isRetired);

    // Pausa confortável de 2.5s para o utilizador visualizar as alterações na modal antes de gravar
    setTimeout(() => {
      if (!batchState.running) return;

      // Submeter o formulário para gravar na Firestore
      window.dispatchEvent(new CustomEvent('CROMO_SAVE_PLAYER_FORM'));

      // Dar tempo para a gravação concluir (600ms) e fechar o popup
      setTimeout(() => {
        if (!batchState.running) return;

        window.dispatchEvent(new CustomEvent('CROMO_CLOSE_PLAYER_MODAL'));
        clearChangeSummaryFromModal();

        batchState.currentIndex++;

        // Dar um intervalo confortável (500ms) antes de abrir o popup do próximo jogador
        setTimeout(() => {
          processNextBatchPlayer();
        }, 500);
      }, 600);
    }, 2500);

    sendResponse({ ok: true });
    return true;
  }
});
