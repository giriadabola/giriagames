// Content Script para as páginas Admin do GiriaGames (Interceção do clique & verificação do clube na BD)

console.log('[Cromo-ggames] Script ativo no painel de administração GiriaGames.');

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
  // 1. Tentar ler da tag script #ggames-clubs-data injetada pela página admin (tem nome + nome_en de todos os clubes)
  const jsonEl = document.getElementById('ggames-clubs-data');
  if (jsonEl && jsonEl.textContent) {
    try {
      const parsed = JSON.parse(jsonEl.textContent);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.warn('[Cromo-ggames] Erro ao ler ggames-clubs-data:', e);
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

  // 2. Correspondência exata fuzzy (removendo conectores "de", "do", "fc", etc. em nome + nome_en)
  if (sFuzzy) {
    match = databaseClubs.find(item => {
      const { nome, nome_en } = getClubFields(item);
      const nFuzzy = normalizeFuzzy(nome);
      const nEnFuzzy = normalizeFuzzy(nome_en);
      return (nFuzzy && sFuzzy === nFuzzy) || (nEnFuzzy && sFuzzy === nEnFuzzy);
    });
    if (match) return { found: true, name: getClubFields(match).nome };
  }

  // 3. Correspondência por sub-string normalizada (nome + nome_en)
  match = databaseClubs.find(item => {
    const { nome, nome_en } = getClubFields(item);
    const nNorm = normalizeText(nome);
    const nEnNorm = normalizeText(nome_en);
    return (nNorm && (sNorm.includes(nNorm) || nNorm.includes(sNorm))) ||
           (nEnNorm && (sNorm.includes(nEnNorm) || nEnNorm.includes(sNorm)));
  });
  if (match) return { found: true, name: getClubFields(match).nome };

  // 4. Correspondência por sub-string fuzzy (nome + nome_en)
  if (sFuzzy) {
    match = databaseClubs.find(item => {
      const { nome, nome_en } = getClubFields(item);
      const nFuzzy = normalizeFuzzy(nome);
      const nEnFuzzy = normalizeFuzzy(nome_en);
      return (nFuzzy && (sFuzzy.includes(nFuzzy) || nFuzzy.includes(sFuzzy))) ||
             (nEnFuzzy && (sFuzzy.includes(nEnFuzzy) || nFuzzy.includes(sFuzzy)));
    });
    if (match) return { found: true, name: getClubFields(match).nome };
  }

  return { found: false, name: cleanName };
}

// Escutar o evento de clique no ícone do Sofascore na página admin (modal ou tabela)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#modal-sofascore-link, .btn-sofascore-link, a[title*="SofaScore"], a[href*="sofascore.com"]');
  if (!btn) return;

  // Intercetar para iniciar o fluxo Cromo-ggames
  e.preventDefault();
  e.stopPropagation();

  const tr = btn.closest('tr');
  const playerName = document.getElementById('modal-player-name')?.textContent?.trim()
                  || tr?.querySelector('.player-row-name')?.textContent?.trim()
                  || '';

  const playerClube = document.getElementById('modal-clube-input')?.value?.trim()
                   || tr?.children[1]?.textContent?.trim()
                   || '';

  const playerPosicao = document.getElementById('modal-posicao-select')?.value?.trim()
                     || tr?.children[2]?.textContent?.trim()
                     || '';

  if (!playerName) {
    console.warn('[Cromo-ggames] Nome do jogador não encontrado.');
    return;
  }

  const playerData = {
    nome: playerName,
    clube: playerClube,
    posicao: playerPosicao
  };

  console.log('[Cromo-ggames] A iniciar verificação para:', playerData);

  chrome.runtime.sendMessage({
    type: 'START_CROMO_VERIFICATION',
    player: playerData
  });
}, true);

// Escutar mensagem de verificação concluída do SofaScore
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'APPLY_SOFASCORE_VERIFICATION') {
    const { player, sofascoreData } = message;
    console.log('[Cromo-ggames] Comparando dados para:', player.nome, sofascoreData);

    const newEquipa = cleanTeamName(sofascoreData.equipa);
    const newPosicao = (sofascoreData.posicao || '').trim();

    // Procurar e abrir o modal de edição do jogador na tabela se ainda não estiver aberto
    const modal = document.getElementById('player-modal');
    const isModalOpen = modal && modal.style.display !== 'none';

    if (!isModalOpen) {
      const allRows = Array.from(document.querySelectorAll('tr'));
      for (const row of allRows) {
        if (row.textContent.includes(player.nome)) {
          row.click(); // Abre o modal de edição do jogador
          break;
        }
      }
    }

    setTimeout(() => {
      const modalClubeInput = document.getElementById('modal-clube-input');
      const modalPosicaoSelect = document.getElementById('modal-posicao-select');

      // Atualizar posição se houver diferença
      if (newPosicao && modalPosicaoSelect) {
        const options = Array.from(modalPosicaoSelect.options);
        const matchOpt = options.find(o => o.value.toLowerCase() === newPosicao.toLowerCase());
        if (matchOpt && modalPosicaoSelect.value !== matchOpt.value) {
          modalPosicaoSelect.value = matchOpt.value;
          modalPosicaoSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Verificar se a equipa existe na base de dados
      const dbClubs = getDatabaseClubs();
      console.log('[Cromo-ggames] Clubes na BD encontrados:', dbClubs.length, dbClubs);
      const clubCheck = findMatchingClubInDatabase(newEquipa, dbClubs);
      console.log('[Cromo-ggames] Resultado da verificação do clube:', newEquipa, clubCheck);

      if (modalClubeInput && newEquipa) {
        if (clubCheck.found) {
          // Clube existe na BD -> Preenche com o nome correspondente silenciosamente
          if (modalClubeInput.value !== clubCheck.name) {
            modalClubeInput.value = clubCheck.name;
            modalClubeInput.dispatchEvent(new Event('input', { bubbles: true }));
            modalClubeInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else {
          // Clube NÃO existe na BD -> Preenche o input e mostra o aviso ÚNICO
          modalClubeInput.value = newEquipa;
          modalClubeInput.dispatchEvent(new Event('input', { bubbles: true }));
          alert(`[Cromo-ggames] ⚠️ O clube "${newEquipa}" não existe na base de dados!\n\nPor favor, crie primeiro este clube no painel ou escolha um clube existente.`);
        }
      }
    }, 300);

    sendResponse({ ok: true });
    return true;
  }
});
