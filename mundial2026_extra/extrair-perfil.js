import { loadProfileData } from './extrair-perfil-data.js';
import { buildProfile } from './extrair-perfil-stats.js';
import { escapeHtml, renderProfile, renderVsProfile } from './extrair-perfil-render.js';

const state = {
  data: null,
  activeFilters: [],
  vsMode: false,
  chartViews: {}
};

const scopeSelect = document.querySelector('#scopeSelect');
const totalByPlayerWrap = document.querySelector('#totalByPlayerWrap');
const totalByPlayerToggle = document.querySelector('#totalByPlayerToggle');
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

function selectedFilters() {
  return [...filterGrid.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

function populateScopeSelect() {
  const options = ['<option value="total">Total</option>'];
  const playerOptions = [];
  state.data.players.forEach((player) => {
    const option = `<option value="${escapeHtml(player.id)}">${escapeHtml(player.participantName)}</option>`;
    options.push(option);
    playerOptions.push(option);
  });
  scopeSelect.innerHTML = options.join('');
  vsLeftSelect.innerHTML = playerOptions.join('');
  vsRightSelect.innerHTML = playerOptions.join('');
  if (state.data.players[1]) vsRightSelect.value = state.data.players[1].id;

  populateSelectionSelect();
  populateStadiumSelect();
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
  const groupByPlayer = !state.vsMode && scopeSelect.value === 'total' && totalByPlayerToggle.checked;
  totalByPlayerWrap.hidden = state.vsMode || scopeSelect.value !== 'total';

  const selectionsActive = state.activeFilters.includes('selections');
  selectionsPicker.hidden = !selectionsActive;
  const selectedSel = selectionSelect.value || 'all';

  const stadiumsActive = state.activeFilters.includes('stadiums');
  stadiumsPicker.hidden = !stadiumsActive;
  const selectedStad = stadiumSelect.value || 'all';
  
  if (state.vsMode) {
    const leftId = vsLeftSelect.value || state.data.players[0]?.id || '';
    const rightId = vsRightSelect.value || state.data.players[1]?.id || leftId;
    const leftProfile = buildProfile({ data: state.data, scopeId: leftId, activeFilters: state.activeFilters, selectedSelection: selectedSel, selectedStadium: selectedStad });
    const rightProfile = buildProfile({ data: state.data, scopeId: rightId, activeFilters: state.activeFilters, selectedSelection: selectedSel, selectedStadium: selectedStad });
    captureArea.innerHTML = renderVsProfile(leftProfile, rightProfile, state.activeFilters, state.chartViews);
  } else {
    const profile = buildProfile({
      data: state.data,
      scopeId: scopeSelect.value,
      activeFilters: state.activeFilters,
      groupByPlayer,
      selectedSelection: selectedSel,
      selectedStadium: selectedStad
    });
    captureArea.innerHTML = renderProfile(profile, state.activeFilters, state.chartViews);
  }
  downloadBtn.disabled = !state.activeFilters.length;
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

scopeSelect.addEventListener('change', render);
totalByPlayerToggle.addEventListener('change', render);
vsToggle.addEventListener('click', () => setVsMode(!state.vsMode));
vsLeftSelect.addEventListener('change', render);
vsRightSelect.addEventListener('change', render);
selectionSelect.addEventListener('change', render);
stadiumSelect.addEventListener('change', render);
filterGrid.addEventListener('change', render);
refreshBtn.addEventListener('click', reload);
downloadBtn.addEventListener('click', downloadPng);

captureArea.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-toggle-chart');
  if (btn) {
    const filterKey = btn.dataset.filter;
    state.chartViews[filterKey] = !state.chartViews[filterKey];
    render();
  }
});

reload();
