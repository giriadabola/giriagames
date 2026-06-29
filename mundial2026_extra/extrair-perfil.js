import { loadProfileData } from './extrair-perfil-data.js?v=20260629perfil4';
import { buildProfile, computeFullPlayerRanking } from './extrair-perfil-stats.js?v=20260629perfil4';
import { escapeHtml, renderProfile, renderVsProfile } from './extrair-perfil-render.js?v=20260629perfil4';

const state = {
  data: null,
  activeFilters: [],
  vsMode: false,
  chartViews: {},
  predictionsPanelClosed: false,
  predictionsPanelMinimized: false,
  excludedMatches: new Set()
};

const scopeSelect = document.querySelector('#scopeSelect');
const totalByPlayerWrap = document.querySelector('#totalByPlayerWrap');
const totalByPlayerToggle = document.querySelector('#totalByPlayerToggle');
const bwToggleWrap = document.querySelector('#bwToggleWrap');
const bwProfileToggle = document.querySelector('#bwProfileToggle');
const ppToggleWrap = document.querySelector('#ppToggleWrap');
const ppProfileToggle = document.querySelector('#ppProfileToggle');
const vsToggle = document.querySelector('#vsToggle');
const vsPicker = document.querySelector('#vsPicker');
const vsLeftSelect = document.querySelector('#vsLeftSelect');
const vsRightSelect = document.querySelector('#vsRightSelect');
const filterGrid = document.querySelector('#filterGrid');
const statusText = document.querySelector('#statusText');
const captureArea = document.querySelector('#captureArea');
const refreshBtn = document.querySelector('#refreshBtn');
const downloadBtn = document.querySelector('#downloadBtn');
const selectionsPicker = document.querySelector('#selectionsPicker');
const selectionSelect = document.querySelector('#selectionSelect');
const stadiumsPicker = document.querySelector('#stadiumsPicker');
const stadiumSelect = document.querySelector('#stadiumSelect');
const matchesPicker = document.querySelector('#matchesPicker');
const matchSelect = document.querySelector('#matchSelect');
const leaderboardComparePicker = document.querySelector('#leaderboardComparePicker');
const leaderboardCompareSelect = document.querySelector('#leaderboardCompareSelect');

const predictionsPanel = document.querySelector('#predictionsPanel');
const panelPlayerName = document.querySelector('#panelPlayerName');
const panelContent = document.querySelector('#panelContent');
const minimizePanelBtn = document.querySelector('#minimizePanelBtn');
const closePanelBtn = document.querySelector('#closePanelBtn');

function selectedFilters() {
  return [...filterGrid.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

function normalizeKey(str) {
  return String(str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getSection2DocForPlayer(player, matchId) {
  if (!state.data?.reformDocs) return null;
  const playerKeys = [player.id, player.participantKey, player.participantName, player.name].map(k => normalizeKey(k)).filter(Boolean);
  
  const match = state.data.matches.find(m => Number(m.id) === Number(matchId));
  const homeTeam = match ? (match.home || match.homeTeam || '') : '';
  const awayTeam = match ? (match.away || match.awayTeam || '') : '';
  const matchStage = match ? (match.stage || '') : '';

  return state.data.reformDocs.find(doc => {
    const docKeys = [doc.participantKey, doc.playerName, doc.name, doc.participantName].map(k => normalizeKey(k)).filter(Boolean);
    const isPlayer = playerKeys.some(pk => docKeys.includes(pk));
    if (!isPlayer) return false;

    const idMatches = Number(doc.matchId) === Number(matchId);
    
    const stageMatches = doc.stage && matchStage && 
      (doc.stage.toLowerCase().trim() === matchStage.toLowerCase().trim());

    const teamsMatch = homeTeam && awayTeam && doc.homeTeam && doc.awayTeam && stageMatches &&
      (doc.homeTeam.toLowerCase().trim() === homeTeam.toLowerCase().trim()) &&
      (doc.awayTeam.toLowerCase().trim() === awayTeam.toLowerCase().trim());

    return idMatches || teamsMatch;
  }) || null;
}

function isMatchKnockout(matchId) {
  const match = state.data?.matches?.find(m => Number(m.id) === Number(matchId));
  return match ? match.stage !== 'groups' : true;
}

let isUpdatingDropdowns = false;
function updatePlayerDropdowns() {
  if (isUpdatingDropdowns) return;
  isUpdatingDropdowns = true;

  const predictionActive = state.activeFilters.includes('prediction');
  const leaderboardActive = state.activeFilters.includes('leaderboard');
  const showMatches = predictionActive || leaderboardActive;
  const matchId = showMatches ? (matchSelect?.value || '') : '';
  const isKO = matchId ? isMatchKnockout(matchId) : false;

  const currentScope = scopeSelect.value;
  const currentLeft = vsLeftSelect.value;
  const currentRight = vsRightSelect.value;

  const options = ['<option value="total">Total</option>'];
  const playerOptions = [];

  state.data.players.forEach((player) => {
    if (isKO && matchId) {
      if (!getSection2DocForPlayer(player, matchId)) {
        return; // skip player since they haven't predicted this knockout match
      }
    }
    const option = `<option value="${escapeHtml(player.id)}">${escapeHtml(player.participantName)}</option>`;
    options.push(option);
    playerOptions.push(option);
  });

  scopeSelect.innerHTML = options.join('');
  vsLeftSelect.innerHTML = playerOptions.join('');
  vsRightSelect.innerHTML = playerOptions.join('');

  if ([...scopeSelect.options].some(o => o.value === currentScope)) {
    scopeSelect.value = currentScope;
  } else {
    scopeSelect.value = 'total';
  }

  if ([...vsLeftSelect.options].some(o => o.value === currentLeft)) {
    vsLeftSelect.value = currentLeft;
  } else if (vsLeftSelect.options[0]) {
    vsLeftSelect.value = vsLeftSelect.options[0].value;
  }

  if ([...vsRightSelect.options].some(o => o.value === currentRight)) {
    vsRightSelect.value = currentRight;
  } else if (vsRightSelect.options[1]) {
    vsRightSelect.value = vsRightSelect.options[1].value;
  } else if (vsRightSelect.options[0]) {
    vsRightSelect.value = vsRightSelect.options[0].value;
  }

  isUpdatingDropdowns = false;
}

function populateScopeSelect() {
  populateSelectionSelect();
  populateStadiumSelect();
  populateMatchSelect();
  updatePlayerDropdowns();
}
function populateStadiumSelect() {
  if (!stadiumSelect || !state.data) return;
  const venues = new Set();
  state.data.matches.forEach((m) => {
    if (m.venue) venues.add(m.venue);
  });
  const sortedVenues = [...venues].sort((a, b) => a.localeCompare(b, 'pt-PT'));
  const options = ['<option value="all">Todos</option>'];
  sortedVenues.forEach((venue) => {
    options.push(`<option value="${escapeHtml(venue)}">${escapeHtml(venue)}</option>`);
  });
  stadiumSelect.innerHTML = options.join('');
}

function populateMatchSelect() {
  if (!matchSelect || !state.data) return;
  const options = [];
  state.data.matches.forEach((m) => {
    const home = m.home || m.homeTeam || 'Casa';
    const away = m.away || m.awayTeam || 'Fora';
    options.push(`<option value="${m.id}">Jogo ${m.id} · ${escapeHtml(home)} vs ${escapeHtml(away)}</option>`);
  });
  matchSelect.innerHTML = options.join('');
}

function populateSelectionSelect() {
  if (!selectionSelect || !state.data) return;
  const teams = new Set();
  
  const isRealTeam = (name) => {
    if (!name) return false;
    const lower = name.toLowerCase().trim();
    if (/^\d+\.º\s*grupo/i.test(lower)) return false;
    if (/^vencedor/i.test(lower)) return false;
    if (/^perdedor/i.test(lower)) return false;
    if (/^grupo\s+[a-z]$/i.test(lower)) return false;
    return true;
  };

  state.data.matches.forEach((m) => {
    const h = m.home || m.homeTeam;
    const a = m.away || m.awayTeam;
    if (h && isRealTeam(h)) teams.add(h);
    if (a && isRealTeam(a)) teams.add(a);
  });

  if (state.data.officialByMatchId) {
    Object.values(state.data.officialByMatchId).forEach((m) => {
      const h = m.homeTeam || m.home;
      const a = m.awayTeam || m.away;
      if (h && isRealTeam(h)) teams.add(h);
      if (a && isRealTeam(a)) teams.add(a);
    });
  }

  if (state.data.sofaByMatchId) {
    Object.values(state.data.sofaByMatchId).forEach((m) => {
      const h = m.homeTeam || m.home;
      const a = m.awayTeam || m.away;
      if (h && isRealTeam(h)) teams.add(h);
      if (a && isRealTeam(a)) teams.add(a);
    });
  }

  const sortedTeams = [...teams].sort((a, b) => a.localeCompare(b, 'pt-PT'));
  const options = ['<option value="all">Todas</option>'];
  sortedTeams.forEach((team) => {
    options.push(`<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`);
  });
  selectionSelect.innerHTML = options.join('');
}

function render() {
  if (!state.data) return;
  state.activeFilters = selectedFilters();
  updatePlayerDropdowns();
  const groupByPlayer = !state.vsMode && scopeSelect.value === 'total' && totalByPlayerToggle.checked;
  if (totalByPlayerWrap) {
    totalByPlayerWrap.style.display = (state.vsMode || scopeSelect.value !== 'total') ? 'none' : 'flex';
  }

  const starsPathActive = state.activeFilters.includes('starsPath');
  const leaderboardActive = state.activeFilters.includes('leaderboard');
  if (bwToggleWrap) {
    bwToggleWrap.style.display = (starsPathActive || leaderboardActive) ? 'flex' : 'none';
  }
  if (ppToggleWrap) {
    ppToggleWrap.style.display = (starsPathActive || leaderboardActive) ? 'flex' : 'none';
  }
  const includeBw = bwProfileToggle ? bwProfileToggle.checked : true;
  const includePp = ppProfileToggle ? ppProfileToggle.checked : true;

  const selectionsActive = state.activeFilters.includes('selections');
  selectionsPicker.hidden = !selectionsActive;
  const selectedSel = selectionSelect.value || 'all';

  const stadiumsActive = state.activeFilters.includes('stadiums');
  stadiumsPicker.hidden = !stadiumsActive;
  const selectedStad = stadiumSelect.value || 'all';

  const predictionActive = state.activeFilters.includes('prediction');
  const showMatches = predictionActive || leaderboardActive;
  matchesPicker.hidden = !showMatches;
  const selectedMatch = matchSelect.value || '';

  if (leaderboardComparePicker) {
    leaderboardComparePicker.hidden = !leaderboardActive;
  }
  const compareOffset = leaderboardCompareSelect ? leaderboardCompareSelect.value : 'none';
  
  if (state.vsMode) {
    const leftId = vsLeftSelect.value || state.data.players[0]?.id || '';
    const rightId = vsRightSelect.value || state.data.players[1]?.id || leftId;
    const leftProfile = buildProfile({ data: state.data, scopeId: leftId, activeFilters: state.activeFilters, selectedSelection: selectedSel, selectedStadium: selectedStad, selectedMatch, includeBw, includePp, compareOffset });
    const rightProfile = buildProfile({ data: state.data, scopeId: rightId, activeFilters: state.activeFilters, selectedSelection: selectedSel, selectedStadium: selectedStad, selectedMatch, includeBw, includePp, compareOffset });
    captureArea.innerHTML = renderVsProfile(leftProfile, rightProfile, state.activeFilters, state.chartViews, state.excludedMatches);
  } else {
    const profile = buildProfile({
      data: state.data,
      scopeId: scopeSelect.value,
      activeFilters: state.activeFilters,
      groupByPlayer,
      selectedSelection: selectedSel,
      selectedStadium: selectedStad,
      selectedMatch,
      includeBw,
      includePp,
      compareOffset
    });
    captureArea.innerHTML = renderProfile(profile, state.activeFilters, state.chartViews, state.excludedMatches);
  }
  downloadBtn.disabled = !state.activeFilters.length;
  updatePredictionsPanel();
}

function updatePredictionsPanel() {
  if (!state.data) return;

  const selectedPlayerId = scopeSelect.value;
  const isPlayerSelected = selectedPlayerId && selectedPlayerId !== 'total';
  const showPanel = (isPlayerSelected || (selectedPlayerId === 'total' && state.activeFilters.length > 0)) && !state.vsMode && !state.predictionsPanelClosed;

  if (!showPanel) {
    predictionsPanel.hidden = true;
    return;
  }

  predictionsPanel.hidden = false;

  const iconMinimize = minimizePanelBtn.querySelector('.icon-minimize');
  const iconExpand = minimizePanelBtn.querySelector('.icon-expand');

  if (state.predictionsPanelMinimized) {
    predictionsPanel.classList.add('minimized');
    iconMinimize.style.display = 'none';
    iconExpand.style.display = 'block';
    panelContent.style.display = 'none';
    return;
  } else {
    predictionsPanel.classList.remove('minimized');
    iconMinimize.style.display = 'block';
    iconExpand.style.display = 'none';
    panelContent.style.display = 'flex';
  }

  if (selectedPlayerId === 'total') {
    panelPlayerName.textContent = 'Geral: Mais & Menos';

    const FILTERS_METADATA = {
      lost: { title: 'Perdidos', unit: ' pts' },
      dramaticLost: { title: 'Dramaticamente perdidos', unit: ' pts' },
      commonResult: { title: 'Resultado comum', unit: 'x' },
      checkpoint: { title: 'Intervalo/90', unit: 'x' },
      badScorers: { title: 'Marcador Azia', unit: 'x' },
      goodScorers: { title: 'Marcador Querido', unit: 'x' },
      lateGains: { title: 'Ganhos por uma unha', unit: ' pts' },
      gains: { title: 'Ganhos', unit: ' pts' },
      aloneInFame: { title: 'Sozinho na Fama', unit: 'x' },
      wonWithStyle: { title: 'Ganho com estilo', unit: 'x' },
      selections: { title: 'Seleções', unit: ' pts' },
      stadiums: { title: 'Estádios', unit: ' pts' },
      starsPath: { title: 'Rumo ao Estrelato', unit: 'º' }
    };

    const rankingsHtml = state.activeFilters.filter(key => key !== 'leaderboard').map(key => {
      const config = FILTERS_METADATA[key] || { title: key, unit: '' };
      const includeBw = bwProfileToggle ? bwProfileToggle.checked : true;
      const fullList = computeFullPlayerRanking(key, state.data, { includeBw });
      if (!fullList || fullList.length === 0) return '';

      // Top 3 (Mais)
      const top3 = fullList.slice(0, 3);
      // Bottom 3 (Menos)
      const bottom3 = fullList.slice(-3).reverse();

      const formatVal = (score) => {
        if (key === 'starsPath') return `${score}º`;
        return `${score}${config.unit}`;
      };

      const renderPlayerRow = (player, index, isTop) => {
        const displayRank = isTop ? (index + 1) : (fullList.length - index);
        const color = isTop ? 'var(--good)' : 'var(--bad)';
        return `
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 3px 0;">
            <span style="color: var(--text);">${displayRank}º ${escapeHtml(player.name)}</span>
            <strong style="color: ${color};">${formatVal(player.score)}</strong>
          </div>
        `;
      };

      const topHtml = top3.map((p, idx) => renderPlayerRow(p, idx, true)).join('');
      const bottomHtml = bottom3.map((p, idx) => renderPlayerRow(p, idx, false)).join('');

      return `
        <div class="stat-ranking-card" id="ranking-card-${key}" style="margin-bottom: 18px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 14px;">
          <h4 style="margin: 0 0 8px; color: var(--accent); font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(config.title)}</h4>
          
          <div class="ranking-group-mais" style="margin-bottom: 8px;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--good); font-weight: bold; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
              <span>▲ Mais</span>
            </div>
            ${topHtml}
          </div>

          <div class="ranking-group-menos">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--bad); font-weight: bold; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
              <span>▼ Menos</span>
            </div>
            ${bottomHtml}
          </div>
        </div>
      `;
    }).join('');

    panelContent.innerHTML = rankingsHtml || '<div class="empty">Nenhuma estatística selecionada.</div>';
    return;
  }

  const player = state.data.players.find(p => p.id === selectedPlayerId);
  if (!player) {
    predictionsPanel.hidden = true;
    return;
  }

  panelPlayerName.textContent = player.participantName;


  const predictionsHtml = (player.matches || []).map(prediction => {
    const matchId = String(prediction.id);
    const match = state.data.matches.find(m => String(m.id) === matchId);
    if (!match) return '';

    const official = state.data.sofaByMatchId[matchId] || state.data.officialByMatchId[matchId];
    const hasOfficial = official && official.homeGoals != null && official.awayGoals != null && official.homeGoals !== '' && official.awayGoals !== '';

    let points = 0;
    let pointsClass = 'pending';
    let exact = false;
    let outcomeHit = false;

    if (hasOfficial) {
      const scoringRules = state.data.scoringRules || {
        groupExact: 3,
        groupOutcome: 1,
        knockoutInitialExact: 5,
        knockoutInitialWinner: 3,
        finalInitialExact: 6,
        finalInitialWinner: 4,
        finalInitialMethod: 2
      };
      
      const ph = Number(prediction.homeGoals);
      const pa = Number(prediction.awayGoals);
      const oh = Number(official.homeGoals);
      const oa = Number(official.awayGoals);
      exact = ph === oh && pa === oa;
      
      const outcome = (h, a) => h > a ? 'home' : a > h ? 'away' : 'draw';
      outcomeHit = outcome(ph, pa) === outcome(oh, oa);
      
      const stage = match.stage || 'groups';
      
      if (stage === 'groups') {
        points = exact ? scoringRules.groupExact : outcomeHit ? scoringRules.groupOutcome : 0;
      } else if (stage === 'final') {
        const officialWinner = oh > oa ? (official.homeTeam || match.home) : oa > oh ? (official.awayTeam || match.away) : 'Empate';
        const winnerHit = prediction.winnerTeam && officialWinner !== 'Empate' && (prediction.winnerTeam.toLowerCase().trim() === officialWinner.toLowerCase().trim());
        points = exact ? scoringRules.finalInitialExact : winnerHit ? scoringRules.finalInitialWinner : outcomeHit ? scoringRules.finalInitialMethod : 0;
      } else {
        const officialWinner = oh > oa ? (official.homeTeam || match.home) : oa > oh ? (official.awayTeam || match.away) : 'Empate';
        const winnerHit = prediction.winnerTeam && officialWinner !== 'Empate' && (prediction.winnerTeam.toLowerCase().trim() === officialWinner.toLowerCase().trim());
        points = exact ? scoringRules.knockoutInitialExact : (outcomeHit || winnerHit) ? scoringRules.knockoutInitialWinner : 0;
      }

      if (exact) {
        pointsClass = 'exact';
      } else if (points > 0) {
        pointsClass = 'outcome';
      } else {
        pointsClass = 'miss';
      }
    }

    const homeTeam = match.home || match.homeTeam || 'Casa';
    const awayTeam = match.away || match.awayTeam || 'Fora';

    const stageLabel = {
      groups: 'Grupos',
      round32: '16 avos',
      round16: 'Oitavos',
      quarterfinals: 'Quartos',
      semifinals: 'Meias',
      third_place: '3º Lugar',
      final: 'Final'
    }[match.stage] || match.stage || 'Jogo';

    return `
      <div class="prediction-item ${pointsClass}">
        <div class="prediction-match-info">
          <span class="match-stage">${stageLabel} · Jogo ${match.id}</span>
          <div class="match-teams">
            <span class="team">${escapeHtml(homeTeam)}</span>
            <span class="vs-text">vs</span>
            <span class="team">${escapeHtml(awayTeam)}</span>
          </div>
        </div>
        <div class="prediction-scores">
          <div class="score-box pred">
            <span class="label">Prog:</span>
            <span class="val">${prediction.homeGoals} - ${prediction.awayGoals}</span>
          </div>
          ${hasOfficial ? `
            <div class="score-box real">
              <span class="label">Res:</span>
              <span class="val">${official.homeGoals} - ${official.awayGoals}</span>
            </div>
            <div class="points-badge ${pointsClass}">
              +${points} pts
            </div>
          ` : `
            <div class="score-box pending">
              <span class="label">Pendente</span>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');

  panelContent.innerHTML = predictionsHtml || '<div class="empty">Sem prognósticos.</div>';
}

function setVsMode(enabled) {
  state.vsMode = enabled;
  vsToggle.setAttribute('aria-pressed', String(enabled));
  vsToggle.classList.toggle('is-active', enabled);
  vsPicker.hidden = !enabled;
  scopeSelect.disabled = enabled;
  totalByPlayerWrap.hidden = enabled || scopeSelect.value !== 'total';
  render();
}

async function reload() {
  refreshBtn.disabled = true;
  downloadBtn.disabled = true;
  statusText.textContent = 'A carregar prognósticos, resultados e golos...';
  try {
    state.data = await loadProfileData();
    populateScopeSelect();
    statusText.textContent = `Carregados ${state.data.players.length} jogadores, ${state.data.matches.length} jogos e ${Object.keys(state.data.sofaByMatchId).length} jogos com golos em worldcupSofa.`;
    render();
  } catch (error) {
    console.error(error);
    statusText.textContent = `Erro: ${error?.message || error}`;
    captureArea.innerHTML = '<div class="empty">Não foi possível carregar os dados. Abre esta página num servidor web e confirma o acesso ao Firebase.</div>';
  } finally {
    refreshBtn.disabled = false;
  }
}

async function downloadPng() {
  if (!window.html2canvas || !state.activeFilters.length) return;
  downloadBtn.disabled = true;
  const originalText = downloadBtn.textContent;
  downloadBtn.textContent = 'A gerar PNG...';
  try {
    const canvas = await window.html2canvas(captureArea, {
      backgroundColor: '#08111d',
      useCORS: true,
      allowTaint: false,
      scale: 2,
      logging: false
    });
    const name = state.vsMode
      ? `${vsLeftSelect.options[vsLeftSelect.selectedIndex]?.textContent || 'jogador-a'}-vs-${vsRightSelect.options[vsRightSelect.selectedIndex]?.textContent || 'jogador-b'}`
      : scopeSelect.value === 'total'
        ? 'total'
        : (scopeSelect.options[scopeSelect.selectedIndex]?.textContent || 'jogador');
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `perfil-${slugify(name)}.png`;
    link.click();
  } catch (error) {
    console.error(error);
    statusText.textContent = 'Não foi possível gerar o PNG.';
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = originalText;
  }
}

function slugify(value) {
  return String(value || 'perfil')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'perfil';
}

scopeSelect.addEventListener('change', () => {
  state.predictionsPanelClosed = false;
  state.excludedMatches.clear();
  render();
});
totalByPlayerToggle.addEventListener('change', render);
if (bwProfileToggle) {
  bwProfileToggle.addEventListener('change', render);
}
if (ppProfileToggle) {
  ppProfileToggle.addEventListener('change', render);
}
vsToggle.addEventListener('click', () => setVsMode(!state.vsMode));
vsLeftSelect.addEventListener('change', render);
vsRightSelect.addEventListener('change', render);
selectionSelect.addEventListener('change', render);
stadiumSelect.addEventListener('change', render);
matchSelect.addEventListener('change', render);
if (leaderboardCompareSelect) {
  leaderboardCompareSelect.addEventListener('change', render);
}
filterGrid.addEventListener('change', render);
refreshBtn.addEventListener('click', reload);
downloadBtn.addEventListener('click', downloadPng);

minimizePanelBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  state.predictionsPanelMinimized = !state.predictionsPanelMinimized;
  updatePredictionsPanel();
});

closePanelBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  state.predictionsPanelClosed = true;
  updatePredictionsPanel();
});

predictionsPanel.addEventListener('click', () => {
  if (state.predictionsPanelMinimized) {
    state.predictionsPanelMinimized = false;
    updatePredictionsPanel();
  }
});

captureArea.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-toggle-chart');
  if (btn) {
    const filterKey = btn.dataset.filter;
    const view = btn.dataset.view;
    if (view) {
      state.chartViews[filterKey] = view;
    } else {
      state.chartViews[filterKey] = !state.chartViews[filterKey];
    }
    render();
    return;
  }

  const removeBtn = e.target.closest('.btn-remove-card');
  if (removeBtn) {
    const matchId = removeBtn.dataset.matchId;
    if (matchId) {
      state.excludedMatches.add(matchId);
      render();
    }
    return;
  }

  const toggleBtn = e.target.closest('.btn-toggle-match');
  if (toggleBtn) {
    const matchId = toggleBtn.dataset.matchId;
    if (matchId) {
      if (state.excludedMatches.has(matchId)) {
        state.excludedMatches.delete(matchId);
      } else {
        state.excludedMatches.add(matchId);
      }
      render();
    }
    return;
  }

  const removeAllBtn = e.target.closest('.btn-remove-all-sequence');
  if (removeAllBtn) {
    const activePlayerId = scopeSelect.value;
    const player = state.data.players.find(p => p.id === activePlayerId);
    if (player && player.matches) {
      player.matches.forEach(m => {
        state.excludedMatches.add(String(m.id));
      });
      render();
    }
    return;
  }

  const restoreBtn = e.target.closest('.btn-restore-sequence');
  if (restoreBtn) {
    state.excludedMatches.clear();
    render();
    return;
  }
});

reload();
