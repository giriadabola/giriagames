// Content Script para a página de jogador do Sofascore

const ALLOWED_LEAGUES = [
  "Liga Profesional de Fútbol",
  "Trendyol Süper Lig",
  "LaLiga",
  "Premier League",
  "Ekstraklasa",
  "Serie A",
  "Ukrainian Premier League",
  "2. Bundesliga",
  "Bundesliga",
  "Russian Premier League",
  "Mozzart Bet Prva Liga",
  "Mozzart Bet Superliga",
  "Liga Portugal Betclic",
  "Ligue 1",
  "Saudi Pro League",
  "Liga MX, Apertura",
  "Cambodian Premier League",
  "WWIN Liga BiH",
  "HNL"
];

function sendLog(msg) {
  console.log('[StatsUpdater] [SOFASCORE]', msg);
  chrome.runtime.sendMessage({ type: 'ADD_DEBUG_LOG', source: 'SOFASCORE', log: msg }).catch(() => {});
}

function findClickableDropdownElement(el) {
  if (!el) return null;

  const explicitBtn = el.closest('button, [role="button"], [tabindex="0"], a');
  if (explicitBtn) return explicitBtn;

  let curr = el;
  while (curr && curr !== document.body) {
    if (curr.tagName === 'A' && curr.href && !/\/(?:player|jogador)\//i.test(curr.href)) {
      break;
    }

    try {
      const style = window.getComputedStyle(curr);
      if (style && style.cursor === 'pointer') {
        return curr;
      }
    } catch (e) {}

    curr = curr.parentElement;
  }
  return el;
}

function getClickableRow(el) {
  if (!el) return null;

  if (el.tagName === 'A') {
    return el.querySelector('span, div') || el;
  }

  const row = el.closest('li, [role="option"], [role="menuitem"], div[class*="option"], div[class*="Option"], div[class*="item"], div[class*="Item"], div[class*="row"], div[class*="Row"]');
  if (row && row.tagName === 'A') {
    return row.querySelector('span, div') || el;
  }

  return row || el.parentElement || el;
}

function clickMenuOption(element) {
  if (!element) return;

  const target = (element.tagName === 'A' || element.tagName === 'BUTTON' || element.getAttribute('role') === 'option' || element.getAttribute('role') === 'menuitem')
    ? element
    : (element.closest('li, a, [role="option"], [role="menuitem"], div[class*="option"], div[class*="Item"], div[class*="row"]') || element);

  const txt = (target.textContent || '').trim();
  sendLog(`[CLIQUE OPÇÃO MENU] Clique físico direto na opção: "${txt}" (Tag: ${target.tagName})`);

  try {
    if (typeof target.focus === 'function') target.focus();
    if (typeof target.scrollIntoView === 'function') {
      try { target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    }

    const opts = { bubbles: true, cancelable: true, view: window, detail: 1, pointerId: 1, isPrimary: true };

    try { target.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (e) {}
    try { target.dispatchEvent(new MouseEvent('mousedown', opts)); } catch (e) {}
    try { target.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (e) {}
    try { target.dispatchEvent(new MouseEvent('mouseup', opts)); } catch (e) {}
    try { target.dispatchEvent(new MouseEvent('click', opts)); } catch (e) {}

    if (typeof target.click === 'function') {
      target.click();
    }
  } catch (err) {
    console.warn('[StatsUpdater] Erro no clickMenuOption:', err);
  }
}

function safeClick(element) {
  if (!element) return;

  const btn = (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button' || element.getAttribute('role') === 'combobox')
    ? element
    : (element.closest ? (element.closest('button, [role="combobox"], [role="button"], [aria-haspopup="listbox"], .dropdown__button') || element) : element);

  const chevronTarget = (btn && btn.querySelector)
    ? (btn.querySelector('.dropdown__chevronBox') || btn.querySelector('svg') || btn.querySelector('span') || btn)
    : element;

  try {
    if (typeof btn.focus === 'function') btn.focus();
    if (typeof chevronTarget.focus === 'function') chevronTarget.focus();

    const opts = { bubbles: true, cancelable: true, view: window, detail: 1, pointerId: 1, isPrimary: true };

    try { chevronTarget.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (e) {}
    try { chevronTarget.dispatchEvent(new MouseEvent('mousedown', opts)); } catch (e) {}
    try { chevronTarget.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (e) {}
    try { chevronTarget.dispatchEvent(new MouseEvent('mouseup', opts)); } catch (e) {}
    try { chevronTarget.dispatchEvent(new MouseEvent('click', opts)); } catch (e) {}

    try {
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }));
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    } catch (e) {}
  } catch (err) {
    console.warn('[StatsUpdater] Erro no safeClick:', err);
  }
}

function closeDropdownPopovers() {
  try {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  } catch (e) {}
}

function normalizeName(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function matchesAllowedLeague(candidateName) {
  if (!candidateName) return null;
  const candNorm = normalizeName(candidateName);
  if (!candNorm || candNorm.length < 2) return null;

  for (const league of ALLOWED_LEAGUES) {
    const lNorm = normalizeName(league);
    
    if (candNorm.includes(lNorm)) {
      return league;
    }

    if (lNorm.length <= 4) {
      const wordRegex = new RegExp(`\\b${league}\\b`, 'i');
      if (wordRegex.test(candidateName)) {
        return league;
      }
    }
  }

  return null;
}

function extractStatsText(bodyText) {
  if (!bodyText) return '';
  const startRegex = /(?:Média de [Pp]ontuações Sofascore|[Pp]ontuações Sofascore|Sofascore Rating|Mapa de calor da época)/i;
  const matchStart = bodyText.match(startRegex);
  if (!matchStart) return '';

  let statsSubstring = bodyText.slice(matchStart.index);

  if (!/^Média de Pontuações Sofascore/i.test(statsSubstring)) {
    statsSubstring = 'Média de Pontuações Sofascore\n' + statsSubstring;
  }

  const bioMatch = statsSubstring.match(/\n.*?\btem\s+\d+\s+anos\b/i);
  if (bioMatch) {
    statsSubstring = statsSubstring.slice(0, bioMatch.index).trim();
    return statsSubstring;
  }

  const footerMatch = statsSubstring.match(/\n.*?(?:Se .+? jogar, poderás também acompanhar|O perfil de .+? mostra todos|poderás também acompanhar a sua pontuação)/i);
  if (footerMatch) {
    statsSubstring = statsSubstring.slice(0, footerMatch.index).trim();
  }

  return statsSubstring.trim();
}

function getOpenPopoverMenu(excludeElements = [], triggerButton = null) {
  if (triggerButton && triggerButton.getAttribute) {
    const ariaControls = triggerButton.getAttribute('aria-controls');
    if (ariaControls) {
      const controlledEl = document.getElementById(ariaControls) || document.querySelector(`[id="${ariaControls}"]`);
      if (controlledEl && controlledEl.offsetWidth > 0 && controlledEl.offsetHeight > 0) {
        return controlledEl;
      }
    }
  }

  const explicitListboxes = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"]'))
    .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
  if (explicitListboxes.length > 0) {
    return explicitListboxes[explicitListboxes.length - 1];
  }

  const popovers = Array.from(document.querySelectorAll(`
    [class*="Popover"],
    [class*="popover"],
    [class*="DropdownMenu"],
    [class*="dropdownMenu"],
    [class*="SelectMenu"],
    [class*="selectMenu"],
    [class*="portal"],
    [class*="Portal"],
    [data-state="open"],
    [id*="popover"],
    [id*="dropdown"],
    ul[class*="Menu"],
    div[class*="Menu"],
    div[class*="menu"]
  `)).filter(el => {
    if (!el || el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;

    if (excludeElements.some(ex => ex && ex === el)) {
      return false;
    }

    if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
      return false;
    }

    const options = el.querySelectorAll('li, [role="option"], [role="menuitem"], a, div, span');
    if (options.length < 2) return false;

    return true;
  });

  if (popovers.length > 0) {
    return popovers[popovers.length - 1];
  }

  const overlays = Array.from(document.querySelectorAll('body [style*="position: absolute"], body [style*="position: fixed"], [class*="portal"] > div, [class*="Portal"] > div'));
  const fallback = overlays.find(el => {
    if (!el || el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
    if (excludeElements.some(ex => ex && ex === el)) return false;
    const items = el.querySelectorAll('li, [role="option"], [role="menuitem"], a, div');
    return items.length >= 2;
  });

  return fallback || null;
}

function findMatchingLeagueOptions(searchScope = document.body) {
  const allVisible = Array.from(searchScope.querySelectorAll('*'))
    .filter(el => {
      if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
      if (el.children.length > 3) return false;
      const txt = el.textContent.trim();
      return txt.length >= 2 && txt.length <= 60;
    });

  const rawTextsScanned = [];
  const matchingOptions = [];

  for (const el of allVisible) {
    const txt = el.textContent.trim();
    if (!rawTextsScanned.includes(txt)) rawTextsScanned.push(txt);

    const matchedLeague = matchesAllowedLeague(txt);
    if (matchedLeague && !matchingOptions.some(m => m.league === matchedLeague)) {
      matchingOptions.push({ league: matchedLeague, text: txt, element: el });
    }
  }

  return { matchingOptions, rawTextsScanned };
}

function getEpocaSectionContainer() {
  const headings = Array.from(document.querySelectorAll('*'))
    .filter(el => {
      if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
      const txt = (el.textContent || '').trim();
      return /(?:Média de Pontuações Sofascore|Mapa de calor da época|Visão geral da época|Presenças)/i.test(txt);
    });

  for (const heading of headings) {
    let p = heading.parentElement;
    while (p && p !== document.body) {
      const btns = Array.from(p.querySelectorAll('button.dropdown__button, button[role="combobox"], [aria-haspopup="listbox"]'))
        .filter(b => b.offsetWidth > 0 && b.offsetHeight > 0);
      if (btns.length >= 2) {
        return p;
      }
      p = p.parentElement;
    }
  }

  const tabs = Array.from(document.querySelectorAll('button, a, div[role="tab"], span, li'));
  const epocaTab = tabs.find(el => {
    const txt = (el.textContent || '').trim();
    return txt === 'Época' || txt === 'Season';
  });

  if (epocaTab) {
    let p = epocaTab.parentElement;
    while (p && p !== document.body) {
      const btns = Array.from(p.querySelectorAll('button.dropdown__button, button[role="combobox"], [aria-haspopup="listbox"]'))
        .filter(b => b.offsetWidth > 0 && b.offsetHeight > 0);
      if (btns.length >= 2) {
        return p;
      }
      p = p.parentElement;
    }
  }

  return document.body;
}

function getPlayerSeasonDropdowns() {
  const allComboboxes = Array.from(document.querySelectorAll('button.dropdown__button, button[role="combobox"], [aria-haspopup="listbox"]'))
    .filter(b => b.offsetWidth > 0 && b.offsetHeight > 0);

  const seasonRegex = /\b(?:\d{2}\/\d{2}|20\d{2}|19\d{2})\b/;

  let leagueDropdown = null;
  let seasonDropdown = null;

  seasonDropdown = allComboboxes.find(b => seasonRegex.test((b.textContent || '').trim()));

  leagueDropdown = allComboboxes.find(b => {
    if (b === seasonDropdown) return false;
    const root = b.closest('.dropdown__root, [class*="dropdown"]') || b.parentElement;
    const rootTxt = (root?.textContent || '').toLowerCase();
    if (rootTxt.includes('tournament') || rootTxt.includes('torneio') || rootTxt.includes('liga')) return true;
    if (b.querySelector('img[src*="unique-tournament"], img[src*="tournament"]')) return true;
    return !seasonRegex.test((b.textContent || '').trim());
  });

  if (leagueDropdown && seasonDropdown) {
    sendLog(`[DROPDOWN_DETECTOR] Sucesso! DROPDOWN 1 (Liga)="${leagueDropdown.textContent.trim()}" | DROPDOWN 2 (Época)="${seasonDropdown.textContent.trim()}"`);
    return { leagueDropdown, seasonDropdown };
  }

  if (allComboboxes.length >= 2) {
    leagueDropdown = allComboboxes[0];
    seasonDropdown = allComboboxes[1];
    sendLog(`[DROPDOWN_DETECTOR] Sucesso por ordem de botões: DROPDOWN 1="${leagueDropdown.textContent.trim()}" | DROPDOWN 2="${seasonDropdown.textContent.trim()}"`);
    return { leagueDropdown, seasonDropdown };
  }

  return { leagueDropdown: null, seasonDropdown: null };
}

async function ensureEpocaTabActive() {
  sendLog('[TAB] Procurando separador "Época"...');

  let epocaTab = null;
  const startTime = Date.now();

  while (Date.now() - startTime < 6000) {
    const tabs = Array.from(document.querySelectorAll('button, a, div[role="tab"], span, li'));
    epocaTab = tabs.find(el => {
      const txt = (el.textContent || '').trim();
      return txt === 'Época' || txt === 'Season';
    });

    if (epocaTab) break;
    await new Promise(r => setTimeout(r, 300));
  }

  if (!epocaTab) {
    sendLog('[TAB] Separador "Época" não foi encontrado no ecrã.');
    return false;
  }

  const isAlreadyActive = epocaTab.getAttribute('aria-selected') === 'true' || epocaTab.getAttribute('data-state') === 'active';
  if (!isAlreadyActive) {
    sendLog(`[TAB] Clicando no separador "Época"...`);
    safeClick(epocaTab);
    await new Promise(r => setTimeout(r, 700));
  }

  const waitStart = Date.now();
  while (Date.now() - waitStart < 5000) {
    const bodyTxt = document.body?.innerText || '';
    if (/(?:Média de [Pp]ontuações|Mapa de calor da época|Presenças|Sofascore Rating)/i.test(bodyTxt)) {
      sendLog('[TAB] Contentor da aba "Época" CONFIRMADO como ativo!');
      await new Promise(r => setTimeout(r, 300));
      return true;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  return true;
}

async function waitForPlayerSeasonDropdowns(maxWaitMs = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const res = getPlayerSeasonDropdowns();
    if (res.leagueDropdown && res.seasonDropdown) {
      return res;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return getPlayerSeasonDropdowns();
}

function isSeason2526Text(txt) {
  if (!txt) return false;
  const clean = String(txt).replace(/[\s\u00a0\u200b]+/g, '').trim();
  if (clean === '25/26' || clean === '2025/26' || clean === '2025/2026' || clean === '25-26') return true;
  return /\b(?:25\/26|2025\/26|2025\/2026)\b/i.test(clean);
}

async function selectSeason2526InDropdown2() {
  const { seasonDropdown } = await waitForPlayerSeasonDropdowns();
  if (!seasonDropdown) {
    sendLog('[DROPDOWN 2] Erro: Botão do DROPDOWN 2 não encontrado no DOM.');
    return false;
  }

  const currentSeasonText = (seasonDropdown.textContent || '').trim();
  sendLog(`[DROPDOWN 2] Estado atual visível no botão: "${currentSeasonText}"`);

  if (isSeason2526Text(currentSeasonText)) {
    sendLog('[DROPDOWN 2] Época 25/26 JÁ ESTÁ SELECIONADA no botão visível! Não é necessário clicar.');
    return true;
  }

  sendLog('[DROPDOWN 2] A clicar no botão do DROPDOWN 2 para abrir a lista de épocas...');
  safeClick(seasonDropdown);
  await new Promise(r => setTimeout(r, 500));

  let popoverMenu = getOpenPopoverMenu([seasonDropdown]);
  if (!popoverMenu) {
    sendLog('[DROPDOWN 2] Popover não abriu à 1ª tentativa. Tentando clicar novamente...');
    safeClick(seasonDropdown);
    await new Promise(r => setTimeout(r, 500));
    popoverMenu = getOpenPopoverMenu([seasonDropdown]);
  }

  const searchScope = popoverMenu || document.body;
  const allVisible = Array.from(searchScope.querySelectorAll('li, [role="option"], [role="menuitem"], a, div, span'))
    .filter(el => {
      if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
      const txt = el.textContent || '';
      return txt.length >= 2 && txt.length <= 40;
    });

  const optionTexts = allVisible.map(el => el.textContent.trim()).filter((v, idx, self) => v && self.indexOf(v) === idx);
  sendLog(`[DROPDOWN 2 OPÇÕES] Total de elementos lidos (${allVisible.length} elementos | ${optionTexts.length} opções únicas): [${optionTexts.join(', ')}]`);

  // Procurar elementos folha ou botões no menu que contenham 25/26
  const candidates = Array.from(document.querySelectorAll('li, [role="option"], [role="menuitem"], a, span, div, p'))
    .filter(el => {
      if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
      if (el.querySelectorAll('li, [role="option"], [role="menuitem"], a').length > 0) return false;
      return isSeason2526Text(el.textContent);
    });

  const opt2526El = candidates[candidates.length - 1] || candidates[0] || allVisible.find(el => isSeason2526Text(el.textContent));

  if (opt2526El) {
    sendLog(`[DROPDOWN 2] Opção "25/26" LOCALIZADA na lista (texto DOM: "${opt2526El.textContent.trim()}")! Efetuando clique...`);
    clickMenuOption(getClickableRow(opt2526El));
    await new Promise(r => setTimeout(r, 800));
    
    closeDropdownPopovers();
    await new Promise(r => setTimeout(r, 200));
    return true;
  }

  sendLog('[DROPDOWN 2] Opção "25/26" NÃO EXISTE no menu de épocas para esta liga.');
  closeDropdownPopovers();
  await new Promise(r => setTimeout(r, 200));
  return false;
}

async function scrollAndScanPopover(popoverMenu) {
  const scope = popoverMenu || document.body;
  const matchingOptions = [];
  const rawTextsScanned = [];

  function scanCurrentView() {
    const res = findMatchingLeagueOptions(scope);
    for (const txt of res.rawTextsScanned) {
      if (!rawTextsScanned.includes(txt)) rawTextsScanned.push(txt);
    }
    for (const opt of res.matchingOptions) {
      if (!matchingOptions.some(m => m.league === opt.league)) {
        matchingOptions.push(opt);
      }
    }
  }

  scanCurrentView();

  if (popoverMenu) {
    const scrollContainer = (popoverMenu.scrollHeight > popoverMenu.clientHeight)
      ? popoverMenu
      : (popoverMenu.querySelector('ul, div[class*="content"], div[class*="scroll"], div') || popoverMenu);

    if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
      sendLog(`[SCROLL POPOVER] Varrimento com scroll iniciado (scrollHeight=${scrollContainer.scrollHeight}px)...`);

      let lastScrollTop = -1;
      scrollContainer.scrollTop = 0;
      await new Promise(r => setTimeout(r, 150));

      while (scrollContainer.scrollTop !== lastScrollTop && scrollContainer.scrollTop + scrollContainer.clientHeight < scrollContainer.scrollHeight + 15) {
        lastScrollTop = scrollContainer.scrollTop;
        scrollContainer.scrollTop += 180;
        await new Promise(r => setTimeout(r, 200));
        scanCurrentView();
      }

      scrollContainer.scrollTop = 0;
      await new Promise(r => setTimeout(r, 100));
    }
  }

  sendLog(`[SCAN COMPLETO DROPDOWN 1] Total de textos brutos lidos no menu (${rawTextsScanned.length}): [${rawTextsScanned.join(' | ')}]`);
  sendLog(`[SCAN COMPLETO DROPDOWN 1] Ligas permitidas encontradas (${matchingOptions.length}): [${matchingOptions.map(m => `"${m.league}" (texto: "${m.text}")`).join(', ')}]`);

  return { matchingOptions, rawTextsScanned };
}

async function findAndExtractAllowedStats2526() {
  sendLog(`[INIT] URL da página atual: ${window.location.href}`);

  // 1. Clicar no separador "Época" ao entrar na página
  const tabOk = await ensureEpocaTabActive();
  if (!tabOk) {
    sendLog('[ERRO CRÍTICO] Não foi possível ativar o separador "Época". Abortando.');
    chrome.runtime.sendMessage({ type: 'SOFASCORE_STATS_ERROR', error: 'Separador "Época" não foi localizado na página do jogador.' }).catch(() => {});
    return;
  }

  // 2. Localizar os dropdowns do jogador
  let { leagueDropdown, seasonDropdown } = await waitForPlayerSeasonDropdowns();

  if (!leagueDropdown) {
    sendLog('[ERRO CRÍTICO] DROPDOWN 1 de ligas não foi localizado a tempo. Abortando.');
    chrome.runtime.sendMessage({ type: 'SOFASCORE_STATS_ERROR', error: 'Dropdown de ligas/torneios não foi localizado.' }).catch(() => {});
    return;
  }

  const initialLeagueTxt = (leagueDropdown?.textContent || '').trim();
  const initialSeasonTxt = (seasonDropdown?.textContent || '').trim();
  const initialMatchedLeague = matchesAllowedLeague(initialLeagueTxt);

  sendLog(`[ANALISE INICIAL] Estado do ecrã ao carregar:`);
  sendLog(`[ANALISE INICIAL] -> Dropdown 1 (Liga): "${initialLeagueTxt}" | Pertence às ligas permitidas? ${initialMatchedLeague ? `SIM ("${initialMatchedLeague}")` : 'NÃO'}`);
  sendLog(`[ANALISE INICIAL] -> Dropdown 2 (Época): "${initialSeasonTxt}" | Já é 25/26? ${/\b25\/26\b/.test(initialSeasonTxt) ? 'SIM' : 'NÃO'}`);

  // 3. SE A LIGA INICIAL NO DROPDOWN 1 JÁ FOR PERMITIDA: Deixar o Dropdown 1 selecionado e clicar no Dropdown 2 para ver as épocas
  if (initialMatchedLeague) {
    sendLog(`[DECISÃO 1] Liga inicial ("${initialLeagueTxt}") JÁ É PERMITIDA ("${initialMatchedLeague}"). Mantendo Dropdown 1 e testando Dropdown 2 primeiro...`);
    const initialSeasonFound = await selectSeason2526InDropdown2();

    if (initialSeasonFound) {
      sendLog(`[ÉPOCA 25/26] Época 25/26 selecionada com sucesso na liga inicial "${initialMatchedLeague}"! Extraindo estatísticas...`);
      await new Promise(r => setTimeout(r, 800));

      const statsText = extractStatsText(document.body.innerText);
      if (statsText && statsText.length > 20) {
        sendLog(`[SUCESSO COMPLETO] Estatísticas extraídas com sucesso na liga inicial ("${initialMatchedLeague}"). Tamanho: ${statsText.length} caracteres. Enviando resultado...`);
        chrome.runtime.sendMessage({
          type: 'SOFASCORE_STATS_EXTRACTED',
          statsText: statsText,
          league: initialMatchedLeague
        }).catch(() => {});
        return;
      } else {
        sendLog(`[AVISO EXTRAÇÃO] Texto de estatísticas muito curto (${statsText?.length || 0} caracteres). Tentando extrair novamente...`);
        await new Promise(r => setTimeout(r, 1000));
        const retryStatsText = extractStatsText(document.body.innerText);
        if (retryStatsText && retryStatsText.length > 20) {
          sendLog(`[SUCESSO RE-TRY] Estatísticas extraídas na 2.ª tentativa (${retryStatsText.length} caracteres). Enviando...`);
          chrome.runtime.sendMessage({
            type: 'SOFASCORE_STATS_EXTRACTED',
            statsText: retryStatsText,
            league: initialMatchedLeague
          }).catch(() => {});
          return;
        }
      }
    }
    sendLog(`[DECISÃO 1] Época 25/26 NÃO ENCONTRADA para a liga inicial "${initialMatchedLeague}". Prosseguindo para abrir o Dropdown 1 e varrer outras ligas...`);
  } else {
    sendLog(`[DECISÃO 1] Liga inicial ("${initialLeagueTxt}") NÃO É PERMITIDA. A abrir Dropdown 1 para trocar de liga...`);
  }

  // 4. Se a liga inicial não servir ou não tiver 25/26, abrir o DROPDOWN 1 e identificar todas as ligas permitidas do jogador
  safeClick(leagueDropdown);
  await new Promise(r => setTimeout(r, 500));

  let popoverMenu = getOpenPopoverMenu([leagueDropdown], leagueDropdown);
  if (!popoverMenu) {
    sendLog('[DROPDOWN 1] Popover de ligas não abriu à 1ª. Clicando novamente...');
    safeClick(leagueDropdown);
    await new Promise(r => setTimeout(r, 500));
    popoverMenu = getOpenPopoverMenu([leagueDropdown], leagueDropdown);
  }

  const { matchingOptions, rawTextsScanned } = await scrollAndScanPopover(popoverMenu);

  closeDropdownPopovers();
  await new Promise(r => setTimeout(r, 300));

  if (matchingOptions.length === 0) {
    if (initialMatchedLeague) {
      matchingOptions.push({ league: initialMatchedLeague, text: initialLeagueTxt });
    }
  }

  if (matchingOptions.length === 0) {
    sendLog(`[ERRO FINAL] Nenhuma das ligas lidas no menu do jogador pertence às ligas permitidas. Lidas: [${rawTextsScanned.slice(0, 8).join(', ')}]`);
    chrome.runtime.sendMessage({
      type: 'SOFASCORE_STATS_ERROR',
      error: `Nenhuma das ligas do jogador pertence às ligas permitidas (${rawTextsScanned.slice(0, 5).join(', ')}...).`
    }).catch(() => {});
    return;
  }

  // 5. Selecionar cada liga permitida e testar as opções do DROPDOWN 2 até encontrar a época 25/26
  for (let i = 0; i < matchingOptions.length; i++) {
    const target = matchingOptions[i];
    sendLog(`[CICLO LIGAS] ===== PASSO ${i + 1}/${matchingOptions.length} =====`);
    sendLog(`[CICLO LIGAS] Alvo atual: Liga permitida "${target.league}" (texto no menu: "${target.text}")`);

    const dropdowns = await waitForPlayerSeasonDropdowns(2000);
    const currLeagueBtn = dropdowns.leagueDropdown || leagueDropdown;
    const currLeagueTxt = (currLeagueBtn.textContent || '').trim();

    if (matchesAllowedLeague(currLeagueTxt) !== target.league) {
      sendLog(`[DROPDOWN 1] Liga atual no botão ("${currLeagueTxt}") não é "${target.league}". A abrir menu para clicar na opção...`);
      safeClick(currLeagueBtn);
      await new Promise(r => setTimeout(r, 500));

      const popover = getOpenPopoverMenu([currLeagueBtn], currLeagueBtn);
      let leagueEl = null;

      if (popover) {
        const scrollContainer = (popover.scrollHeight > popover.clientHeight)
          ? popover
          : (popover.querySelector('ul, div[class*="content"], div[class*="scroll"], div') || popover);

        let lastScrollTop = -1;
        if (scrollContainer && scrollContainer.scrollTop !== undefined) scrollContainer.scrollTop = 0;

        while (!leagueEl) {
          const candidateNodes = Array.from(popover.querySelectorAll('li, [role="option"], [role="menuitem"], a, span, div'))
            .filter(el => {
              if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
              if (el.querySelectorAll('li, [role="option"], [role="menuitem"], a').length > 0) return false;
              return matchesAllowedLeague(el.textContent.trim()) === target.league;
            });

          if (candidateNodes.length > 0) {
            leagueEl = candidateNodes[0];
            break;
          }

          if (!scrollContainer || scrollContainer.scrollTop === lastScrollTop) break;
          lastScrollTop = scrollContainer.scrollTop;
          scrollContainer.scrollTop += 180;
          await new Promise(r => setTimeout(r, 150));
        }
      }

      if (leagueEl) {
        sendLog(`[DROPDOWN 1] Elemento da liga "${target.league}" localizado no menu! Clicando com clickMenuOption...`);
        clickMenuOption(getClickableRow(leagueEl));
        await new Promise(r => setTimeout(r, 600));
        closeDropdownPopovers();
        await new Promise(r => setTimeout(r, 300));
      } else {
        sendLog(`[DROPDOWN 1 AVISO] Elemento DOM para a liga "${target.league}" não foi localizado no popover aberto.`);
        closeDropdownPopovers();
        await new Promise(r => setTimeout(r, 200));
      }

      // Aguardar em polling até o botão do Dropdown 1 atualizar efetivamente para a liga pretendida
      let updatedLeagueMatch = null;
      const waitStart = Date.now();
      while (Date.now() - waitStart < 3500) {
        const updatedDropdowns = getPlayerSeasonDropdowns();
        const currentTxt = (updatedDropdowns.leagueDropdown?.textContent || '').trim();
        updatedLeagueMatch = matchesAllowedLeague(currentTxt);
        if (updatedLeagueMatch === target.league) {
          sendLog(`[DROPDOWN 1] Confirmado! Botão do Dropdown 1 atualizado para "${target.league}".`);
          break;
        }
        await new Promise(r => setTimeout(r, 300));
      }

      // Dar um tempo de sincronização para o Sofascore atualizar as opções do Dropdown 2 (Época)
      await new Promise(r => setTimeout(r, 600));
    } else {
      sendLog(`[DROPDOWN 1] Liga permitida "${target.league}" já está selecionada no botão.`);
    }

    // Validação estrita de segurança: O botão do Dropdown 1 TEM de ter mudado para a liga permitida pretendida
    const confirmDropdowns = getPlayerSeasonDropdowns();
    const activeLeagueTxt = (confirmDropdowns.leagueDropdown?.textContent || '').trim();
    const activeLeagueMatch = matchesAllowedLeague(activeLeagueTxt);

    if (activeLeagueMatch !== target.league) {
      sendLog(`[BLOQUEIO RIGOROSO] O Dropdown 1 ("${activeLeagueTxt}") não é a liga permitida "${target.league}". Ignorando...`);
      continue;
    }

    // Testar as opções do DROPDOWN 2 até chegar a 25/26
    sendLog(`[DROPDOWN 2] A testar opções do DROPDOWN 2 para a liga "${target.league}"...`);
    const seasonFound = await selectSeason2526InDropdown2();

    if (seasonFound) {
      sendLog(`[ÉPOCA 25/26] Época 25/26 ENCONTRADA e SELECIONADA para "${target.league}"! Extraindo estatísticas...`);
      await new Promise(r => setTimeout(r, 800));

      const statsText = extractStatsText(document.body.innerText);
      if (statsText && statsText.length > 20) {
        sendLog(`[SUCESSO FINAL] Estatísticas extraídas com sucesso para "${target.league}" (${statsText.length} caracteres). Enviando...`);
        chrome.runtime.sendMessage({
          type: 'SOFASCORE_STATS_EXTRACTED',
          statsText: statsText,
          league: target.league
        }).catch(() => {});
        return;
      }
    } else {
      sendLog(`[DROPDOWN 2] Época 25/26 NÃO DISPONÍVEL para a liga "${target.league}". Prosseguindo para a próxima liga permitida...`);
    }
  }

  sendLog('[ERRO FINAL] Época 25/26 não foi encontrada em nenhuma das ligas permitidas deste jogador.');
  chrome.runtime.sendMessage({
    type: 'SOFASCORE_STATS_ERROR',
    error: 'Época 25/26 não encontrada para nenhuma das ligas permitidas deste jogador.'
  }).catch(() => {});
}

async function processSofascoreStats() {
  if (!/\/(?:player|jogador)\//i.test(window.location.pathname)) return;

  sendLog('=== INÍCIO: AUTOMATA DE LIGAS E ÉPOCA 25/26 ===');
  await findAndExtractAllowedStats2526();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(processSofascoreStats, 1200));
} else {
  setTimeout(processSofascoreStats, 1200);
}
