/* Central Ggames: live cards, lineups, battles e historico. */
function getWinnerTeamFromScore(result) {
  const home = Number(result.homeGoals);
  const away = Number(result.awayGoals);
  if (home > away) return result.homeTeam;
  if (away > home) return result.awayTeam;
  return 'Empate';
}

function scoreHistoryPrediction(playerDoc, match, pred, official, override = null) {
  if (typeof window.scorePredictionForTable === 'function') {
    return window.scorePredictionForTable(playerDoc, match, pred, official, override);
  }
  return official ? scoreOnePrediction(pred, official, override) : null;
}

function apiMatchForLocal(match) {
  return worldCupApi.games.find(g => String(g.id) === String(match.id)) || null;
}

function hasAnyLiveMatch() {
  const games = (worldCupApi?.games || []).filter(g => g.live && !g.finished && !isOfficialResultFinished(getOfficialResult(g.id)));
  if (games.length) return true;
  if (data?.matches?.length) {
    const fallbackGames = data.matches.filter(m => !isOfficialResultFinished(getOfficialResult(m.id)) && isMatchInLiveWindow(m));
    if (fallbackGames.length) return true;
  }
  return false;
}

function refreshLiveDashboardView(force = false) {
  if (!force && window.publicViewerActiveTab === 'minigames_play') {
    // Prevent the live sync from re-rendering and resetting the active minigame iframe
    return;
  }
  const body = $('#liveViewerBody') || $('#closedLiveDashboard') || $('#closedViewerBody');
  if (body) {
    const scrollState = captureLiveDashboardScrollState(body);
    body.innerHTML = renderLiveDashboard();
    restoreLiveDashboardScrollState(body, scrollState);
  }
  updateMobileAppNav();
}

function renderLiveDashboard() {
  if (!window.liveRightTabUserOverride) {
    liveRightTab = hasAnyLiveMatch() ? 'battles' : 'table';
  }
  if (typeof mobileAppSection !== 'undefined' && mobileAppSection === 'prognostics') {
    if (typeof renderPublicViewer === 'function') {
      mobilePublicViewerHtml = renderPublicViewer(window.publicViewerActiveTab || 'games');
    }
  }
  return `
    <div class="live-two-columns">
      <section class="live-column" data-mobile-live-section="games">
        <div class="live-column-head"><h3>Jogos</h3></div>
        <div class="viewer-tabs compact">
          <button type="button" class="viewer-tab ${liveLeftTab === 'live' ? 'active' : ''}" data-live-left="live">Jogos em Direto</button>
          <button type="button" class="viewer-tab ${liveLeftTab === 'future' ? 'active' : ''}" data-live-left="future">Futuros Jogos</button>
          <button type="button" class="viewer-tab ${liveLeftTab === 'groups' ? 'active' : ''}" data-live-left="groups">Tabela dos Grupos</button>
        </div>
        <div class="live-panel-body" data-scroll-key="live-games-panel">${renderLiveLeftPanel()}</div>
      </section>
      <section class="live-column" data-mobile-live-section="results">
        <div class="live-column-head"><h3>Resultados</h3></div>
        <div class="viewer-tabs compact">
          <button type="button" class="viewer-tab ${liveRightTab === 'battles' ? 'active' : ''}" data-live-right="battles">Ggames Battles Live</button>
          <button type="button" class="viewer-tab ${liveRightTab === 'table' ? 'active' : ''}" data-live-right="table">Tabela Ggames Live</button>
        </div>
        <div class="live-panel-body" data-scroll-key="live-results-panel">${renderLiveRightPanel()}</div>
      </section>
      <section class="live-column mobile-public-page" data-mobile-live-section="prognostics">
        ${mobilePublicViewerHtml || '<div class="live-loading-card">Toca no símbolo central para ver os prognósticos dos jogadores.</div>'}
      </section>
    </div>
  `;
}

function renderLiveLeftPanel() {
  if (liveLeftTab === 'future') return renderFutureApiGames();
  if (liveLeftTab === 'groups') return renderApiGroupsTable();
  return renderLiveApiGames();
}

function renderLiveRightPanel() {
  if (liveRightTab === 'table') return renderGgamesTable({ battles: false });
  return renderLiveGiriaBattles();
}


function hasRealApiMinuteLabel(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('~')) return false;

  const text = raw.toLowerCase();
  if (['live', 'notstarted', 'halftime', 'half-time', 'interval', 'paused', 'pause', 'ht', 'em pausa', 'ao vivo'].includes(text)) {
    return false;
  }

  // Aceita apenas minuto direto vindo da API: 23, 23', 45+2, 45'+2, 90+5'
  return (
    /^\d{1,3}$/.test(raw) ||
    /^\d{1,3}['’]$/.test(raw) ||
    /^\d{1,3}\+\d{1,2}$/.test(raw) ||
    /^\d{1,3}\+\d{1,2}['’]$/.test(raw) ||
    /^\d{1,3}['’]\+\d{1,2}['’]?$/.test(raw)
  );
}

function renderLiveStatusText(game) {
  if (!game?.live) return game?.finished ? 'Terminado' : 'Por jogar';

  const elapsed = String(game.timeElapsed || '').trim();

  // Se não houver minuto real vindo diretamente da API, fica só a bola vermelha a piscar.
  // Não mostra: EM PAUSA, AO VIVO, LIVE, HT, Intervalo, nem minutos estimados com ~.
  if (!hasRealApiMinuteLabel(elapsed)) return '';

  return liveStatusLabel(elapsed);
}


function compactScorersForCard(value) {
  const scorers = apiScorerList(value)
    .map(item => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!scorers.length) return '';
  return `<small class="api-card-scorers">⚽ ${scorers.map(escapeHtml).join(' · ')}</small>`;
}

function scorerValueForSide(game, side) {
  if (side === 'home') {
    return game.homeScorers || game.homeGoalScorers || game.home_goals || game.goalsHome || game.homeGoalsDetails || game.home_goal_details;
  }
  return game.awayScorers || game.awayGoalScorers || game.away_goals || game.goalsAway || game.awayGoalsDetails || game.away_goal_details;
}

function isMatchBeforeKickoff(game) {
  if (!game) return false;
  const local = localMatchById(game.id || game.matchId);
  const dateStr = game.date || local?.date;
  const timeStr = game.time || local?.time;
  if (!dateStr) return false;
  const kickoff = getMatchDateObj({ date: dateStr, time: timeStr || '12:00' });
  return new Date() < kickoff;
}

function compareMatchesBySchedule(a, b) {
  const kickoffA = getMatchDateObj({ date: a?.date, time: a?.time || '12:00' }).getTime();
  const kickoffB = getMatchDateObj({ date: b?.date, time: b?.time || '12:00' }).getTime();
  if (kickoffA !== kickoffB) return kickoffA - kickoffB;
  return Number(a?.id || 0) - Number(b?.id || 0);
}

function ggamesApiKickoffMs(game, fallbackMatch = null) {
  const local = fallbackMatch || localMatchById(game?.id || game?.matchId);
  const dateStr = game?.date || local?.date;
  const timeStr = game?.time || local?.time || '12:00';
  if (!dateStr) return null;
  const kickoff = getMatchDateObj({ date: dateStr, time: timeStr });
  const kickoffMs = kickoff.getTime();
  return Number.isNaN(kickoffMs) ? null : kickoffMs;
}

function ggamesApiElapsedSinceKickoffMs(game, fallbackMatch = null, now = new Date()) {
  const kickoffMs = ggamesApiKickoffMs(game, fallbackMatch);
  if (kickoffMs == null) return null;
  return now.getTime() - kickoffMs;
}

function ggamesSanitizeEarlyGoalValue(value, elapsedMs) {
  if (value == null || elapsedMs == null || elapsedMs < 0 || elapsedMs >= API_FIRST_MINUTE_SCORE_CAP_MS) return value ?? null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value ?? null;
  return Math.min(numeric, 1);
}

function ggamesSanitizeAutomaticApiGame(game, fallbackMatch = null, options = {}) {
  if (!game) return game;
  const now = options.now instanceof Date ? options.now : new Date();
  const local = fallbackMatch || localMatchById(game.id || game.matchId);
  const elapsedMs = ggamesApiElapsedSinceKickoffMs(game, local, now);
  const liveWindow = local ? isMatchInLiveWindow(local, now) : isMatchInLiveWindow(game, now);
  const finished = !!game.finished && elapsedMs != null && elapsedMs >= API_FINISHED_MIN_DELAY_MS;
  const live = !finished && !!(game.live || options.scheduleLiveFallback === true || liveWindow);
  const homeGoals = ggamesSanitizeEarlyGoalValue(game.homeGoals, elapsedMs);
  const awayGoals = ggamesSanitizeEarlyGoalValue(game.awayGoals, elapsedMs);
  const timeElapsed = finished
    ? (game.timeElapsed || 'FT')
    : (live && String(game.timeElapsed || '').trim().toUpperCase() === 'FT'
        ? (local?.timeElapsed || '')
        : game.timeElapsed);

  return {
    ...game,
    homeGoals,
    awayGoals,
    finished,
    live,
    timeElapsed
  };
}

function renderLiveGameCard(game, mode = 'live') {
  const status = renderLiveStatusText(game);
  const isFuture = isMatchBeforeKickoff(game);
  const actualScore = isFuture ? 'vs' : (game.homeGoals !== null && game.awayGoals !== null ? `${game.homeGoals} - ${game.awayGoals}` : 'vs');
  const local = localMatchById(game.id);
  const homeScorers = isFuture ? '' : compactScorersForCard(scorerValueForSide(game, 'home'));
  const awayScorers = isFuture ? '' : compactScorersForCard(scorerValueForSide(game, 'away'));

  return `
    <div class="api-game-card ${game.live ? 'is-live' : ''} ${game.finished ? 'is-finished' : ''}" data-live-match="${escapeHtml(game.id)}">
      <div class="api-game-top"><span>Jogo ${escapeHtml(game.id)} · ${escapeHtml(STAGE_LABELS[game.stage] || game.stage)}</span><b>${status}</b></div>
      <div class="api-score-line api-score-line-with-scorers">
        <div class="api-team-score-side">
          <strong>${escapeHtml(game.homeTeam || local?.home || 'A definir')}</strong>
          ${homeScorers}
        </div>
        <span>${actualScore}</span>
        <div class="api-team-score-side api-team-score-side-away">
          <strong>${escapeHtml(game.awayTeam || local?.away || 'A definir')}</strong>
          ${awayScorers}
        </div>
      </div>
      <p class="modal-muted">${escapeHtml(game.date || local?.date || '')} ${escapeHtml(game.time || local?.time || '')}${game.venue ? ` · ${escapeHtml(game.venue)}` : ''}</p>
    </div>
  `;
}

function liveStatusLabel(value) {
  const raw = String(value || '').trim();

  if (!hasRealApiMinuteLabel(raw)) return '';

  // 23 -> 23'
  if (/^\d{1,3}$/.test(raw)) return `${raw}'`;

  // 45+2 -> 45+2'
  if (/^\d{1,3}\+\d{1,2}$/.test(raw)) return `${raw}'`;

  // 45'+2 -> 45+2'
  const normalized = raw.replace(/[’]/g, "'").replace(/^(\d{1,3})'\+(\d{1,2})'?$/, '$1+$2\'');
  return normalized;
}

function apiScorerList(value) {
  if (value == null) return [];

  const clean = item => String(item || '')
    .replace(/[{}[\]"]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\d+\s*[:.'’-]\s*/, '')
    .replace(/\b\d{1,3}(?:\+\d+)?['’]?/g, '')
    .trim();

  const fromObject = obj => {
    if (!obj || typeof obj !== 'object') return '';
    return obj.name ||
      obj.player ||
      obj.playerName ||
      obj.strPlayer ||
      obj.scorer ||
      obj.goal_scorer ||
      obj.home_scorer ||
      obj.away_scorer ||
      obj.lineup_player ||
      obj.player_name ||
      obj.player?.name ||
      obj.player?.displayName ||
      '';
  };

  if (Array.isArray(value)) {
    return value
      .map(v => typeof v === 'string' ? v : fromObject(v))
      .map(clean)
      .filter(Boolean);
  }

  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'null' || text === '[]') return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return apiScorerList(parsed);
    if (parsed && typeof parsed === 'object') {
      const keys = Object.keys(parsed);
      const isKeyNameMap = keys.length && keys.every(k => !/^\d+$/.test(k) && k.length > 2);
      if (isKeyNameMap) {
        return apiScorerList(keys);
      }
      return apiScorerList(Object.values(parsed));
    }
  } catch {}

  return text
    .split(/[,;|]/)
    .map(part => clean(part))
    .filter(Boolean);
}

function renderScorersBlock(game) {
  const home = apiScorerList(game.homeScorers);
  const away = apiScorerList(game.awayScorers);
  if (!home.length && !away.length) return '<p class="modal-muted">Ainda não há marcadores registados para este jogo.</p>';
  return `<div class="scorers-grid">
    <section><h3>${escapeHtml(game.homeTeam || 'Casa')}</h3>${home.length ? `<ul>${home.map(s => `<li>⚽ ${escapeHtml(s)}</li>`).join('')}</ul>` : '<p class="modal-muted">Sem marcadores.</p>'}</section>
    <section><h3>${escapeHtml(game.awayTeam || 'Fora')}</h3>${away.length ? `<ul>${away.map(s => `<li>⚽ ${escapeHtml(s)}</li>`).join('')}</ul>` : '<p class="modal-muted">Sem marcadores.</p>'}</section>
  </div>`;
}

function findSportsDbEventIdForGame(game, local) {
  return game?.apiEventId || game?.externalEventId || game?.idEvent || getOfficialResult(game?.id || local?.id)?.apiEventId || local?.apiEventId || null;
}

function findApiFootballFixtureIdForGame(game, local) {
  return game?.apiFootballFixtureId || getOfficialResult(game?.id || local?.id)?.apiFootballFixtureId || local?.apiFootballFixtureId || null;
}

function findHighlightlyMatchIdForGame(game, local) {
  return game?.highlightlyMatchId || getOfficialResult(game?.id || local?.id)?.highlightlyMatchId || local?.highlightlyMatchId || null;
}

function findAllSportsEventIdForGame(game, local) {
  return game?.allSportsEventId || getOfficialResult(game?.id || local?.id)?.allSportsEventId || local?.allSportsEventId || null;
}

async function fetchSportsDbLineupForGame(game, local) {
  const eventId = findSportsDbEventIdForGame(game, local);
  if (!eventId) return [];
  const payload = await fetchSportsDbJson(`/lookuplineup.php?id=${encodeURIComponent(eventId)}`);
  return extractApiArray(payload, 'lineup').map(row => ({
    team: lineupSideLabel(row, game, local),
    name: row.strPlayer || row.strPlayerName || row.strName || 'Jogador',
    number: row.intSquadNumber || row.strNumber || row.intNumber || '',
    position: row.strPosition || row.strPositionShort || row.strRole || '',
    type: String(row.strSubstitute || row.strLineup || row.strType || row.strStatus || '').toLowerCase()
  }));
}

async function fetchApiFootballLineupForGame(game, local) {
  const fixtureId = findApiFootballFixtureIdForGame(game, local);
  if (!fixtureId || !hasApiFootballKey()) return [];
  const payload = await fetchApiFootballJson(`/fixtures/lineups?fixture=${encodeURIComponent(fixtureId)}`);
  const rows = Array.isArray(payload?.response) ? payload.response : [];
  return rows.flatMap(team => {
    const teamName = team.team?.name || '';
    const starters = (team.startXI || []).map(item => item.player || item).map(player => ({
      team: teamName,
      name: player.name || 'Jogador',
      number: player.number || '',
      position: player.pos || player.position || '',
      type: 'starter'
    }));
    const subs = (team.substitutes || []).map(item => item.player || item).map(player => ({
      team: teamName,
      name: player.name || 'Jogador',
      number: player.number || '',
      position: player.pos || player.position || '',
      type: 'sub'
    }));
    return starters.concat(subs);
  });
}

async function fetchHighlightlyLineupForGame(game, local) {
  const matchId = findHighlightlyMatchIdForGame(game, local);
  if (!matchId || !ggamesHasKey(ggamesGetApiKey('highlightly', HIGHLIGHTLY_KEY))) return [];
  const possiblePaths = [
    `/matches/${encodeURIComponent(matchId)}/lineups`,
    `/lineups/${encodeURIComponent(matchId)}`,
    `/matches/${encodeURIComponent(matchId)}/lineup`
  ];
  for (const path of possiblePaths) {
    try {
      const payload = await ggamesFetchHighlightly(path);
      const raw = ggamesArrayFromPayload(payload, 'lineups')
        .concat(ggamesArrayFromPayload(payload, 'lineup'))
        .concat(ggamesArrayFromPayload(payload, 'data'));
      const rows = normalizeGenericLineupPayload(raw, game, local);
      if (rows.length) return rows;
    } catch {}
  }
  return [];
}

async function fetchAllSportsLineupForGame(game, local) {
  const eventId = findAllSportsEventIdForGame(game, local);
  if (!eventId || !ggamesHasKey(ggamesGetApiKey('allSports', ALLSPORTS_KEY))) return [];
  try {
    const payload = await ggamesFetchAllSports({ met: 'Lineups', matchId: eventId });
    const raw = ggamesArrayFromPayload(payload, 'result');
    return normalizeGenericLineupPayload(raw, game, local);
  } catch {
    return [];
  }
}

function lineupSideLabel(row, game, local) {
  const team = row.team || row.strTeam || row.strTeamName || row.strHomeAway || row.strSide || row.teamName || row.name || '';
  const home = game?.homeTeam || local?.home || '';
  const away = game?.awayTeam || local?.away || '';
  if (team && sameTeamName(team, home)) return home;
  if (team && sameTeamName(team, away)) return away;
  if (String(row.strHomeAway || row.side || row.homeAway || '').toLowerCase().includes('home')) return home;
  if (String(row.strHomeAway || row.side || row.homeAway || '').toLowerCase().includes('away')) return away;
  return team || 'Equipa';
}

function normalizeGenericLineupPayload(raw, game, local) {
  const rows = [];

  function addPlayer(player, team, type = '') {
    if (!player) return;
    const p = player.player || player;
    const name = p.name || p.player_name || p.strPlayer || p.strPlayerName || p.namePlayer || p.lineup_player || p.player || '';
    if (!name) return;
    rows.push({
      team: team || lineupSideLabel(p, game, local),
      name,
      number: p.number || p.lineup_number || p.shirt_number || p.intSquadNumber || p.strNumber || '',
      position: p.pos || p.position || p.lineup_position || p.strPosition || p.strPositionShort || '',
      type: String(type || p.type || p.status || p.lineup_type || p.strSubstitute || p.strLineup || '').toLowerCase()
    });
  }

  (raw || []).forEach(item => {
    const team = item.team?.name || item.teamName || item.strTeam || item.event_home_team || item.event_away_team || item.name || '';
    if (Array.isArray(item.startXI)) item.startXI.forEach(p => addPlayer(p, team, 'starter'));
    if (Array.isArray(item.startingXI)) item.startingXI.forEach(p => addPlayer(p, team, 'starter'));
    if (Array.isArray(item.lineup)) item.lineup.forEach(p => addPlayer(p, team, 'starter'));
    if (Array.isArray(item.players)) item.players.forEach(p => addPlayer(p, team, p.substitute ? 'sub' : 'starter'));
    if (Array.isArray(item.substitutes)) item.substitutes.forEach(p => addPlayer(p, team, 'sub'));
    if (item.player || item.strPlayer || item.lineup_player || item.player_name) addPlayer(item, team, item.substitute ? 'sub' : item.lineup_type || item.type);
  });

  return rows;
}

function normalizeLineupRows(rows, game, local) {
  const grouped = {};
  (rows || []).forEach(row => {
    const team = lineupSideLabel(row, game, local);
    if (!grouped[team]) grouped[team] = { starters: [], subs: [], other: [] };
    const player = {
      name: row.name || row.strPlayer || row.strPlayerName || row.strName || 'Jogador',
      number: row.number || row.intSquadNumber || row.strNumber || row.intNumber || '',
      position: row.position || row.strPosition || row.strPositionShort || row.strRole || '',
      type: String(row.type || row.strSubstitute || row.strLineup || row.strType || row.strStatus || '').toLowerCase()
    };
    const bucket = player.type.includes('sub') || player.type.includes('bench') ? 'subs'
      : player.type.includes('start') || player.type.includes('lineup') || player.type.includes('xi') ? 'starters'
      : grouped[team].starters.length < 11 ? 'starters' : 'subs';
    grouped[team][bucket].push(player);
  });
  return grouped;
}

function renderSportsDbLineupList(players, emptyText) {
  if (!players?.length) return `<p class="modal-muted">${emptyText}</p>`;
  return `<ol class="api-lineup-list">${players.map(player => `
    <li>
      ${player.number ? `<b>${escapeHtml(player.number)}</b>` : ''}
      <span>${escapeHtml(player.name)}</span>
      ${player.position ? `<em>${escapeHtml(player.position)}</em>` : ''}
    </li>
  `).join('')}</ol>`;
}

function renderSportsDbLineups(rows, game, local) {
  if (!rows?.length) {
    return '<p class="modal-muted">11’s não oficiais ainda indisponíveis.</p>';
  }
  const grouped = normalizeLineupRows(rows, game, local);
  const teams = Object.keys(grouped);
  if (!teams.length) {
    return '<p class="modal-muted">11’s não oficiais ainda indisponíveis.</p>';
  }
  return `<div class="api-lineups-grid">${teams.map(team => `
    <section class="api-lineup-team">
      <h4>${escapeHtml(team)}</h4>
      <h5>11 titulares</h5>
      ${renderSportsDbLineupList(grouped[team].starters, 'Sem titulares confirmados.')}
      <h5>Suplentes</h5>
      ${renderSportsDbLineupList(grouped[team].subs, 'Sem suplentes confirmados.')}
    </section>
  `).join('')}</div>`;
}

async function fetchBestLineupsForGame(game, local) {
  const loaders = [
    fetchApiFootballLineupForGame,
    fetchHighlightlyLineupForGame,
    fetchAllSportsLineupForGame,
    fetchSportsDbLineupForGame
  ];

  for (const loader of loaders) {
    try {
      const rows = await loader(game, local);
      const starters = rows.filter(row => String(row.type || '').includes('start') || String(row.type || '').includes('xi') || String(row.type || '').includes('lineup'));
      if (rows.length && (starters.length >= 11 || rows.length >= 18)) return rows;
      if (rows.length) return rows;
    } catch (error) {
      console.warn('Fonte de 11’s indisponível; a tentar outra.', error);
    }
  }
  return [];
}

async function hydrateLiveMatchLineups(game, local) {
  const target = document.querySelector('#apiLineupsLiveBlock');
  if (!target) return;
  try {
    const lineups = await fetchBestLineupsForGame(game, local);
    target.innerHTML = renderSportsDbLineups(lineups, game, local);
  } catch (error) {
    console.warn('Não foi possível carregar os 11’s.', error);
    target.innerHTML = '<p class="modal-muted">Não foi possível carregar os 11’s não oficiais neste momento.</p>';
  }
}

function openLiveMatchModal(matchId) {
  const game = worldCupApi.games.find(g => String(g.id) === String(matchId)) || getOfficialResult(matchId) || localMatchById(matchId);
  if (!game) return;
  const local = localMatchById(matchId);
  const home = game.homeTeam || game.home || local?.home || 'A definir';
  const away = game.awayTeam || game.away || local?.away || 'A definir';
  const stage = game.stage || local?.stage || 'groups';
  const isFuture = isMatchBeforeKickoff(game);
  const score = isFuture ? 'vs' : (game.homeGoals !== null && game.homeGoals !== undefined && game.awayGoals !== null && game.awayGoals !== undefined ? `${game.homeGoals} - ${game.awayGoals}` : 'vs');
  const status = renderLiveStatusText(game);
  openModal(`
    <div class="modal-head">
      <div>
        <p class="eyebrow small">Jogo ${escapeHtml(game.id || matchId)} · ${escapeHtml(STAGE_LABELS[stage] || stage)}</p>
        <h2>${escapeHtml(home)} ${escapeHtml(score)} ${escapeHtml(away)}</h2>
        <p class="modal-muted">${escapeHtml(status)} · ${escapeHtml(game.date || local?.date || '')} ${escapeHtml(game.time || local?.time || '')}${game.venue || local?.venue ? ` · ${escapeHtml(game.venue || local?.venue)}` : ''}</p>
      </div>
    </div>
    <section class="live-detail-section">
      <h3>Marcadores</h3>
      ${isFuture ? '<p class="modal-muted">Ainda não há marcadores registados para este jogo.</p>' : renderScorersBlock(game)}
    </section>
    <section class="live-detail-section">
      <h3>11’s não oficiais</h3>
      <div id="apiLineupsLiveBlock" class="api-lineups-loading">
        <p class="modal-muted">A procurar 11’s disponíveis...</p>
      </div>
    </section>
    <section class="live-detail-section">
      <h3>Equipas e banco</h3>
      <div class="lineup-layout">
        ${subsPanel(home)}
        <div class="pitch">
          ${pitchPlayers(home, 'home')}
          <div class="halfway"></div>
          ${pitchPlayers(away, 'away')}
        </div>
        ${subsPanel(away)}
      </div>
      <p class="modal-footnote">A primeira secção mostra os 11’s não oficiais, quando disponíveis. Esta secção mantém os dados locais/prováveis como reserva.</p>
    </section>
  `);
  hydrateLiveMatchLineups(game, local);
}

function livePredictionScoreKey(pred) {
  return `${Number(pred.homeGoals)}-${Number(pred.awayGoals)}`;
}

function livePredictionFilterOptions(gamePredictions, official) {
  const uniqueScores = [...new Set(gamePredictions.map(item => livePredictionScoreKey(item.pred)))].sort((a, b) => {
    const [aHome, aAway] = a.split('-').map(Number);
    const [bHome, bAway] = b.split('-').map(Number);
    if (aHome !== bHome) return aHome - bHome;
    return aAway - bAway;
  });
  const currentScoreKey = official && official.homeGoals != null && official.awayGoals != null
    ? `${Number(official.homeGoals)}-${Number(official.awayGoals)}`
    : '';
  const options = [{ key: 'all', label: 'Todos' }];
  if (currentScoreKey) {
    options.push({ key: `current:${currentScoreKey}`, label: currentScoreKey });
  }
  uniqueScores
    .filter(scoreKey => !currentScoreKey || scoreKey !== currentScoreKey)
    .forEach(scoreKey => {
      options.push({ key: `score:${scoreKey}`, label: scoreKey });
    });
  return options;
}

function filterLivePredictions(gamePredictions, activeFilter) {
  if (!activeFilter || activeFilter === 'all') return gamePredictions;
  if (activeFilter.startsWith('current:')) {
    const currentScoreKey = activeFilter.slice('current:'.length);
    return gamePredictions.filter(item => livePredictionScoreKey(item.pred) === currentScoreKey);
  }
  if (activeFilter.startsWith('score:')) {
    const scoreKey = activeFilter.slice('score:'.length);
    return gamePredictions.filter(item => livePredictionScoreKey(item.pred) === scoreKey);
  }
  return gamePredictions;
}

function renderLiveGameUserPredictions(gameId) {
  const local = localMatchById(gameId);
  const game = worldCupApi.games.find(g => String(g.id) === String(gameId)) || getOfficialResult(gameId) || local;
  if (isMatchBeforeKickoff(game)) {
    return '';
  }

  if (!publicPredictions || !publicPredictions.length) {
    return '';
  }

  const gamePredictions = [];
  const localMatch = localMatchById(gameId);
  const official = getOfficialResult(gameId) || worldCupApi.games.find(g => String(g.id) === String(gameId)) || localMatch || null;
  const lookupMatch = localMatch || official || { id: gameId };
  const isKnockout = lookupMatch ? lookupMatch.stage !== 'groups' : true;

  publicPredictions.forEach(player => {
    const initialPred = typeof findInitialPredictionForMatch === 'function'
      ? findInitialPredictionForMatch(player, lookupMatch)
      : (player.matches || []).find(m => String(m.id) === String(gameId));

    const override = typeof getSection2DocForPlayer === 'function' ? getSection2DocForPlayer(player, gameId) : null;

    if (isKnockout) {
      if (!override) return;
      let finalPred = null;
      if (override.mode === 'changed') {
        finalPred = {
          homeGoals: override.homeGoals,
          awayGoals: override.awayGoals,
          winnerTeam: override.winnerTeam,
          method: override.method,
          homeTeam: override.homeTeam,
          awayTeam: override.awayTeam
        };
      } else if (override.mode === 'replicate' && (initialPred || override.initialPrediction)) {
        const basePred = initialPred || override.initialPrediction;
        finalPred = {
          homeGoals: basePred.homeGoals,
          awayGoals: basePred.awayGoals,
          winnerTeam: basePred.winnerTeam,
          method: basePred.method,
          homeTeam: basePred.homeTeam,
          awayTeam: basePred.awayTeam
        };
      }
      if (finalPred && finalPred.homeGoals !== '' && finalPred.awayGoals !== '' && finalPred.homeGoals !== null && finalPred.awayGoals !== null) {
        gamePredictions.push({
          player,
          pred: finalPred,
          override
        });
      }
    } else {
      if (initialPred && initialPred.homeGoals !== '' && initialPred.awayGoals !== '' && initialPred.homeGoals !== null && initialPred.awayGoals !== null) {
        gamePredictions.push({
          player,
          pred: initialPred,
          override: null
        });
      }
    }
  });

  if (!gamePredictions.length) {
    return '';
  }

  // Ordenar alfabeticamente pelo nome do participante
  gamePredictions.sort((a, b) => {
    const nameA = a.player.participantName || a.player.name || '';
    const nameB = b.player.participantName || b.player.name || '';
    return nameA.localeCompare(nameB, 'pt-PT');
  });

  const filterOptions = livePredictionFilterOptions(gamePredictions, official);
  const activeFilter = filterOptions.some(option => option.key === livePredictionFilters[String(gameId)])
    ? livePredictionFilters[String(gameId)]
    : 'all';
  const filteredPredictions = filterLivePredictions(gamePredictions, activeFilter);

  return `
    <div class="live-game-predictions">
      <div class="live-predictions-filters">
        ${filterOptions.map(option => `
          <button type="button" class="live-predictions-filter ${activeFilter === option.key ? 'is-active' : ''} ${option.key.startsWith('current:') ? 'is-current-score' : ''}" data-live-predictions-filter="${escapeHtml(option.key)}" data-live-predictions-game="${escapeHtml(gameId)}">${escapeHtml(option.label)}</button>
        `).join('')}
      </div>
      <h4 class="live-predictions-title">Prognósticos dos Participantes</h4>
      <ul class="live-predictions-list">
        ${filteredPredictions.map(item => {
          const playerName = item.player.participantName || item.player.name || 'Participante';
          const iconKey = item.player.icon || item.player.participantIcon || item.player.playerIcon || '';
          const identHtml = renderParticipantIdentity(playerName, iconKey, 'participant-ident--compact');
          
          // Formatação simples: remove vencedor redundante para resultado normal
          const homeG = Number(item.pred.homeGoals);
          const awayG = Number(item.pred.awayGoals);
          let extra = '';
          if (homeG === awayG && item.pred.winnerTeam && item.pred.winnerTeam !== 'Empate') {
            const methodLabel = item.pred.method === 'et' ? 'após prolongamento' : item.pred.method === 'pens' ? 'após penáltis' : '';
            extra = ` · vence ${escapeHtml(item.pred.winnerTeam)}${methodLabel ? ` ${methodLabel}` : ''}`;
          } else if (item.pred.method === 'et' || item.pred.method === 'pens') {
            const methodLabel = item.pred.method === 'et' ? 'prolongamento' : 'penáltis';
            extra = ` (${methodLabel})`;
          }
          const predText = `${item.pred.homeGoals}-${item.pred.awayGoals}${extra}`;
          
          // Verificar se está a ganhar em direto (resultado exato)
          let isWinning = false;
          if (official && official.homeGoals !== null && official.awayGoals !== null) {
            const evaluation = typeof scoreOnePrediction === 'function' ? scoreOnePrediction(item.pred, official, item.override) : null;
            if (evaluation && evaluation.exact === true) {
              isWinning = true;
            }
          }

          return `
            <li class="live-prediction-item ${isWinning ? 'is-winning' : ''}">
              ${identHtml}
              <strong class="live-prediction-choice">${predText}</strong>
            </li>
          `;
        }).join('')}
      </ul>
    </div>
  `;
}

function renderLiveApiGames() {
  let games = worldCupApi.games
    .filter(g => g.live && !g.finished && !isOfficialResultFinished(getOfficialResult(g.id)))
    .map(mergeLiveGameWithFirestore)
    .sort((a,b) => Number(a.id)-Number(b.id));

  // Salvaguarda: se a API ainda não marcar o jogo como "live" mas o horário local já estiver dentro da janela do jogo,
  // mostramos o jogo em direto na mesma. Isto evita o ecrã "não há jogos em direto" durante jogos 0-0 ou quando a API atrasa o estado.
  if (!games.length && data?.matches?.length) {
    games = data.matches
      .filter(m => !isOfficialResultFinished(getOfficialResult(m.id)) && isMatchInLiveWindow(m))
      .map(m => ({
        ...m,
        id: String(m.id),
        matchId: String(m.id),
        homeTeam: m.home,
        awayTeam: m.away,
        homeGoals: null,
        awayGoals: null,
        finished: false,
        live: true,
        timeElapsed: `~${elapsedMinuteFromSchedule(m)}`,
        source: 'schedule-fallback'
      }));
  }

  if (!games.length) {
    return `
      <div class="empty-state" style="display: flex; flex-direction: column; align-items: flex-start; gap: 20px; text-align: left; width: 100%;">
        <div>Neste momento não há jogos em direto.</div>
        <div style="display: flex; gap: 15px; width: 100%; flex-wrap: wrap;">
          <!-- Não Explodas o Treinador -->
          <div style="display: inline-block; position: relative; cursor: pointer; transition: transform 0.2s; border-radius: 12px; overflow: hidden; width: calc(50% - 8px); min-width: 140px; max-width: 200px;" 
               data-action="play-minigame" data-game-url="nao-explodas-o-treinador.html"
               onmouseover="this.style.transform='scale(1.02)'; this.querySelector('.play-btn-overlay').style.opacity='1'; this.querySelector('.play-btn-overlay').style.transform='scale(1)';"
               onmouseout="this.style.transform='scale(1)'; this.querySelector('.play-btn-overlay').style.opacity='0'; this.querySelector('.play-btn-overlay').style.transform='scale(0.95)';">
            <img src="nao_explodas.png" alt="Não Explodas o Treinador" style="width: 100%; display: block; height: 120px; object-fit: contain; border-radius: 12px;">
            <div class="play-btn-overlay" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(0.95); transition: opacity 0.3s ease, transform 0.3s ease; pointer-events: none; background: rgba(7, 26, 63, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); border-radius: 12px;">
              <span style="padding: 8px 16px; font-size: 0.72rem; font-family: 'Outfit', sans-serif; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 30px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.18); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #fff; box-shadow: 0 6px 16px rgba(0,0,0,0.4); white-space: nowrap;">JOGAR</span>
            </div>
          </div>
          <!-- Na Prancha do Pirata -->
          <div style="display: inline-block; position: relative; cursor: pointer; transition: transform 0.2s; border-radius: 12px; overflow: hidden; width: calc(50% - 8px); min-width: 140px; max-width: 200px;" 
               data-action="play-minigame" data-game-url="na-prancha-do-pirata-v2.html"
               onmouseover="this.style.transform='scale(1.02)'; this.querySelector('.play-btn-overlay').style.opacity='1'; this.querySelector('.play-btn-overlay').style.transform='scale(1)';"
               onmouseout="this.style.transform='scale(1)'; this.querySelector('.play-btn-overlay').style.opacity='0'; this.querySelector('.play-btn-overlay').style.transform='scale(0.95)';">
            <img src="na_prancha.png" alt="Na Prancha do Pirata!" style="width: 100%; display: block; height: 120px; object-fit: contain; border-radius: 12px;">
            <div class="play-btn-overlay" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(0.95); transition: opacity 0.3s ease, transform 0.3s ease; pointer-events: none; background: rgba(7, 26, 63, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); border-radius: 12px;">
              <span style="padding: 8px 16px; font-size: 0.72rem; font-family: 'Outfit', sans-serif; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 30px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.18); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #fff; box-shadow: 0 6px 16px rgba(0,0,0,0.4); white-space: nowrap;">JOGAR</span>
            </div>
          </div>
          <!-- Defende a Fama -->
          <div style="display: inline-block; position: relative; cursor: pointer; transition: transform 0.2s; border-radius: 12px; overflow: hidden; width: calc(50% - 8px); min-width: 140px; max-width: 200px;" 
               data-action="play-minigame" data-game-url="defende-a-fama.html"
               onmouseover="this.style.transform='scale(1.02)'; this.querySelector('.play-btn-overlay').style.opacity='1'; this.querySelector('.play-btn-overlay').style.transform='scale(1)';"
               onmouseout="this.style.transform='scale(1)'; this.querySelector('.play-btn-overlay').style.opacity='0'; this.querySelector('.play-btn-overlay').style.transform='scale(0.95)';">
            <img src="defende_fama.png" alt="Defende a Fama!" style="width: 100%; display: block; height: 120px; object-fit: contain; border-radius: 12px;">
            <div class="play-btn-overlay" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(0.95); transition: opacity 0.3s ease, transform 0.3s ease; pointer-events: none; background: rgba(7, 26, 63, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); border-radius: 12px;">
              <span style="padding: 8px 16px; font-size: 0.72rem; font-family: 'Outfit', sans-serif; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 30px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.18); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #fff; box-shadow: 0 6px 16px rgba(0,0,0,0.4); white-space: nowrap;">JOGAR</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  return `
    <div class="api-games-list">
      ${games.map(g => `
        <div class="live-game-wrapper" style="display: flex; flex-direction: column; gap: 8px;">
          ${renderLiveGameCard(g, 'live')}
          ${renderLiveGameUserPredictions(g.id)}
        </div>
      `).join('')}
    </div>
  `;
}

function renderFutureApiGames() {
  const now = new Date();
  const source = worldCupApi.games.length ? worldCupApi.games : (data?.matches || []).map(m => ({...m, id: String(m.id), homeTeam: m.home, awayTeam: m.away, homeGoals: null, awayGoals: null, finished: false, live: false}));
  const games = source
    .filter(g => !g.finished && !g.live && getMatchDateObj({ date: g.date, time: g.time }) >= now)
    .sort(compareMatchesBySchedule)
    .slice(0, 18);
  if (!games.length) return '<div class="empty-state">Não há jogos futuros para mostrar.</div>';
  return `<div class="api-games-list">${games.map(g => renderLiveGameCard(g, 'future')).join('')}</div>`;
}

function renderApiGroupsTable() {
  if (worldCupApi.groups.length) {
    const sourceName = worldCupApi.groups.some(g => g.source === 'Zafronix WC API') ? 'Zafronix WC API — classificação oficial' : 'Tabela calculada por resultados/Firebase';
    return `<div class="api-source-note">Fonte: ${escapeHtml(sourceName)}</div><div class="api-groups-grid">${worldCupApi.groups.map(group => {
      const groupName = group.group || group.name || group.group_name || '';
      const teams = Array.isArray(group.teams) ? group.teams : [];
      return `<section class="api-group-card"><h4>Grupo ${escapeHtml(groupName)}</h4><table><thead><tr><th>#</th><th>Equipa</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GM</th><th>GS</th><th>DG</th><th>Pts</th></tr></thead><tbody>${teams.map((t, index) => {
        const position = t.position ?? (index + 1);
        const teamName = t.team_name_en || t.name_en || t.team || t.team_id || 'Equipa';
        const played = t.played ?? t.p ?? 0;
        const wins = t.wins ?? t.won ?? t.w ?? 0;
        const draws = t.draws ?? t.drawn ?? t.d ?? 0;
        const losses = t.losses ?? t.lost ?? t.l ?? 0;
        const gf = t.gf ?? t.goalsFor ?? 0;
        const ga = t.ga ?? t.goalsAgainst ?? 0;
        const gd = t.gd ?? t.goalDifference ?? (Number(gf || 0) - Number(ga || 0));
        const pts = t.pts ?? t.points ?? 0;
        return `<tr class="${t.advanced ? 'qualified' : ''}"><td>${escapeHtml(position)}</td><td>${escapeHtml(teamName)}</td><td>${escapeHtml(played)}</td><td>${escapeHtml(wins)}</td><td>${escapeHtml(draws)}</td><td>${escapeHtml(losses)}</td><td>${escapeHtml(gf)}</td><td>${escapeHtml(ga)}</td><td>${escapeHtml(gd)}</td><td><strong>${escapeHtml(pts)}</strong></td></tr>`;
      }).join('')}</tbody></table></section>`;
    }).join('')}</div>`;
  }
  return '<div class="empty-state">Ainda não há classificação dos grupos para mostrar.</div>';
}


function getCurrentLiveGameForDashboard() {
  const apiLive = (worldCupApi?.games || [])
    .filter(game => game.live && !game.finished && game.id)
    .sort((a, b) => Number(a.id) - Number(b.id))[0];
  if (apiLive) return apiLive;

  const localLive = (data?.matches || [])
    .filter(match => {
      if (!isMatchInLiveWindow(match)) return false;
      const existing = (worldCupApi?.games || []).find(game => String(game.id) === String(match.id));
      const official = getOfficialResult(match.id);
      return !(isOfficialResultFinished(existing) || isOfficialResultFinished(official));
    })
    .sort((a, b) => Number(a.id) - Number(b.id))[0];

  if (!localLive) return null;

  const existing = (worldCupApi?.games || []).find(game => String(game.id) === String(localLive.id)) || {};
  const official = getOfficialResult(localLive.id) || {};
  const elapsed = elapsedMinuteFromSchedule(localLive);

  return {
    ...existing,
    id: String(localLive.id),
    matchId: String(localLive.id),
    stage: localLive.stage,
    group: localLive.group || null,
    date: localLive.date,
    time: localLive.time,
    homeTeam: localLive.home,
    awayTeam: localLive.away,
    homeGoals: official.homeGoals ?? existing.homeGoals ?? null,
    awayGoals: official.awayGoals ?? existing.awayGoals ?? null,
    venue: existing.venue || localLive.venue || '',
    city: localLive.city || '',
    country: localLive.country || '',
    live: true,
    finished: false,
    timeElapsed: official.timeElapsed ?? existing.timeElapsed ?? `~${elapsed}`,
    source: existing.source || 'matches.json'
  };
}

function findCurrentLiveGameForBattles() {
  return getCurrentLiveGameForDashboard();
}

function participantKeyForLiveBattle(item) {
  return item?.participantKey || normalizeParticipantName(item?.participantName || item?.name || item?.id || '');
}


function battlePredictionOutcomeForPair(pred) {
  if (!pred) return '';
  return predictionOutcome(pred);
}

function battlePredictionScoreKey(pred) {
  if (!pred) return '';
  return `${Number(pred.homeGoals)}-${Number(pred.awayGoals)}-${pred.winnerTeam || ''}`;
}

function battlePairDiversityScore(a, b, game, indexA, indexB) {
  const predA = a.pred;
  const predB = b.pred;
  const differentOutcome = battlePredictionOutcomeForPair(predA) !== battlePredictionOutcomeForPair(predB);
  const differentScore = battlePredictionScoreKey(predA) !== battlePredictionScoreKey(predB);
  const differentWinner = String(predA?.winnerTeam || '') !== String(predB?.winnerTeam || '');
  const rankGap = Math.abs(Number(a.row.rank || indexA) - Number(b.row.rank || indexB));
  const seed = Number(game?.id || 0);
  const rotation = ((indexA + 1) * 17 + (indexB + 1) * 31 + seed * 13) % 23;

  let score = 0;
  if (differentOutcome) score += 120;
  if (differentWinner) score += 80;
  if (differentScore) score += 45;
  score += Math.max(0, 35 - rankGap);
  score += rotation / 10;
  return score;
}

function buildDiverseLiveBattlePairs(rows, game, limit = 10) {
  const candidates = rows
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((row, index) => {
      const player = publicPredictions.find(p =>
        String(p.id) === String(row.id) ||
        participantKeyForLiveBattle(p) === (row.participantKey || participantKeyForLiveBattle(row))
      );
      const pred = typeof findInitialPredictionForMatch === 'function' ? findInitialPredictionForMatch(player, game) : (player?.matches || []).find(match => Number(match.id) === Number(game.id));
      return player && pred ? { row, player, pred, index } : null;
    })
    .filter(Boolean);

  const allPairs = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      allPairs.push({
        a,
        b,
        score: battlePairDiversityScore(a, b, game, i, j)
      });
    }
  }

  allPairs.sort((x, y) => y.score - x.score);
  const selected = [];
  const usedPlayers = new Set();

  for (const pair of allPairs) {
    const keyA = String(pair.a.row.id);
    const keyB = String(pair.b.row.id);
    if (usedPlayers.has(keyA) || usedPlayers.has(keyB)) continue;
    selected.push(pair);
    usedPlayers.add(keyA);
    usedPlayers.add(keyB);
    if (selected.length >= limit) break;
  }

  // Se ainda faltarem battles, permite repetir jogadores, mas mantendo prognósticos diferentes primeiro.
  if (selected.length < limit) {
    const usedPairKeys = new Set(selected.map(pair => [pair.a.row.id, pair.b.row.id].sort().join('|')));
    for (const pair of allPairs) {
      const pairKey = [pair.a.row.id, pair.b.row.id].sort().join('|');
      if (usedPairKeys.has(pairKey)) continue;
      selected.push(pair);
      usedPairKeys.add(pairKey);
      if (selected.length >= limit) break;
    }
  }

  return selected;
}

function directLiveBattleCardsForGame(game) {
  const rows = calculateGgamesTable();
  if (!game || rows.length < 2) return '';

  const pairs = buildDiverseLiveBattlePairs(rows, game, 10);
  const cards = [];
  const official = getOfficialResult(game.id) || game;

  pairs.forEach((pair, index) => {
    const top = pair.a.row;
    const below = pair.b.row;
    const p1 = pair.a.player;
    const p2 = pair.b.player;
    const pred1 = pair.a.pred;
    const pred2 = pair.b.pred;

    const s1 = scoreOnePrediction(pred1, official);
    const s2 = scoreOnePrediction(pred2, official);
    const factor1 = (s1.outcomeHit ? 1 : 0) + (Number(pred1.homeGoals) === Number(official.homeGoals) ? 1 : 0) + (Number(pred1.awayGoals) === Number(official.awayGoals) ? 1 : 0) + (s1.exact ? 1 : 0);
    const factor2 = (s2.outcomeHit ? 1 : 0) + (Number(pred2.homeGoals) === Number(official.homeGoals) ? 1 : 0) + (Number(pred2.awayGoals) === Number(official.awayGoals) ? 1 : 0) + (s2.exact ? 1 : 0);

    let state = `Battle live · fatores agora: ${factor1}-${factor2}`;
    if (factor1 > factor2) state += ` · na frente ${escapeHtml(top.name)}`;
    if (factor2 > factor1) state += ` · na frente ${escapeHtml(below.name)}`;
    if (factor1 === factor2) state += ' · empate';
    const leadA = factor1 > factor2;
    const leadB = factor2 > factor1;
    const contrastLabel = battlePredictionOutcomeForPair(pred1) !== battlePredictionOutcomeForPair(pred2)
      ? 'Vencedores diferentes'
      : battlePredictionScoreKey(pred1) !== battlePredictionScoreKey(pred2)
        ? 'Resultados diferentes'
        : 'Duelo equilibrado';

    cards.push(`
      <div class="battle-card live-battle battle-card-horizontal battle-card-is-live">
        <span class="battle-match">Jogo ${escapeHtml(game.id)} · ${escapeHtml(game.homeTeam)} vs ${escapeHtml(game.awayTeam)} <em class="battle-contrast-chip">${escapeHtml(contrastLabel)}</em></span>
        <div class="battle-duel-row">
          <div class="battle-player battle-player-a ${leadA ? 'battle-player-leading' : ''}">
            <strong>${renderParticipantIdentity(`#${top.rank} ${top.name}`, p1.icon || p1.participantIcon || p1.playerIcon || top.icon, 'participant-ident--compact')}</strong>
            <span>${predictionResultText(pred1)}</span>
            ${leadA ? '<div class="battle-fans" aria-hidden="true"><span>🙌</span><span>⚑</span><span>🙌</span><span>⚑</span><span>🙌</span></div>' : ''}
          </div>
          <b class="battle-versus">VS</b>
          <div class="battle-player battle-player-b ${leadB ? 'battle-player-leading' : ''}">
            <strong>${renderParticipantIdentity(`#${below.rank} ${below.name}`, p2.icon || p2.participantIcon || p2.playerIcon || below.icon, 'participant-ident--compact')}</strong>
            <span>${predictionResultText(pred2)}</span>
            ${leadB ? '<div class="battle-fans" aria-hidden="true"><span>🙌</span><span>⚑</span><span>🙌</span><span>⚑</span><span>🙌</span></div>' : ''}
          </div>
        </div>
        <p class="battle-state">${state}</p>
      </div>
    `);
  });

  return cards.join('');
}

function renderFinishedBattleCardsForGame(game) {
  const rows = calculateGgamesTable();
  if (!game || rows.length < 2) return '';

  const pairs = buildDiverseLiveBattlePairs(rows, game, 10);
  const cards = [];
  const official = getOfficialResult(game.id) || game;

  pairs.forEach((pair) => {
    const top = pair.a.row;
    const below = pair.b.row;
    const p1 = pair.a.player;
    const p2 = pair.b.player;
    const pred1 = pair.a.pred;
    const pred2 = pair.b.pred;

    const s1 = scoreOnePrediction(pred1, official);
    const s2 = scoreOnePrediction(pred2, official);

    const pts1 = s1.points || 0;
    const pts2 = s2.points || 0;

    let state = `Resultado do jogo: ${official.homeGoals}-${official.awayGoals}`;
    if (pts1 > pts2) state += ` · Vencedor: ${escapeHtml(top.name)} (+${pts1} pts)`;
    else if (pts2 > pts1) state += ` · Vencedor: ${escapeHtml(below.name)} (+${pts2} pts)`;
    else if (pts1 === pts2 && pts1 > 0) state += ` · Empate (+${pts1} pts cada)`;
    else state += ` · Empate (0 pts)`;

    const leadA = pts1 > pts2;
    const leadB = pts2 > pts1;

    cards.push(`
      <div class="battle-card live-battle battle-card-horizontal">
        <span class="battle-match">Jogo ${escapeHtml(game.id)} · ${escapeHtml(game.homeTeam)} vs ${escapeHtml(game.awayTeam)} <em class="battle-contrast-chip" style="background: rgba(97,211,148,.16); color: var(--accent); border: 1px solid rgba(97,211,148,.35);">Terminado</em></span>
        <div class="battle-duel-row">
          <div class="battle-player battle-player-a ${leadA ? 'battle-player-leading' : ''}">
            <strong>${renderParticipantIdentity(`#${top.rank} ${top.name}`, p1.icon || p1.participantIcon || p1.playerIcon || top.icon, 'participant-ident--compact')}${leadA ? ' <span style="font-size:1rem; margin-left:4px;">👑</span>' : ''}</strong>
            <span>${predictionResultText(pred1)}</span>
          </div>
          <b class="battle-versus">VS</b>
          <div class="battle-player battle-player-b ${leadB ? 'battle-player-leading' : ''}">
            <strong>${renderParticipantIdentity(`#${below.rank} ${below.name}`, p2.icon || p2.participantIcon || p2.playerIcon || below.icon, 'participant-ident--compact')}${leadB ? ' <span style="font-size:1rem; margin-left:4px;">👑</span>' : ''}</strong>
            <span>${predictionResultText(pred2)}</span>
          </div>
        </div>
        <p class="battle-state" style="color: var(--accent-2); font-weight: 600;">${state}</p>
      </div>
    `);
  });

  return cards.join('');
}

function renderLiveGiriaBattles() {
  const liveGame = getCurrentLiveGameForDashboard();

  // Regra principal: se há jogo em direto/estimado em direto, esta aba mostra só esse jogo.
  // Nunca pode saltar para o próximo jogo enquanto o atual estiver live.
  if (liveGame) {
    const directCards = directLiveBattleCardsForGame(liveGame);
    return directCards || `<p class="modal-muted">Este jogo está em direto, mas ainda não há prognósticos suficientes para criar battles live.</p>`;
  }

  // Se não há jogo em direto, mostra os resultados das battles do jogo anterior (último terminado)
  const finishedGames = worldCupApi.games.filter(g => g.finished && g.id);
  const lastFinished = finishedGames.sort((a, b) => Number(b.id) - Number(a.id))[0];

  if (lastFinished) {
    const finishedCards = renderFinishedBattleCardsForGame(lastFinished);
    if (finishedCards) return finishedCards;
  }

  const rows = calculateGgamesTable();
  if (rows.length < 2) return '<p class="modal-muted">Ainda não há jogadores suficientes para criar battles.</p>';

  const futureMatches = worldCupApi.games.filter(g => !g.finished && !g.live && g.id);
  const localFuture = !futureMatches.length && data?.matches
    ? data.matches
        .filter(m => !getOfficialResult(m.id))
        .map(m => ({ id: String(m.id), homeTeam: m.home, awayTeam: m.away, date: m.date, time: m.time, stage: m.stage, live: false, finished: false }))
    : [];
  const gamesPool = futureMatches.length ? futureMatches : localFuture;
  const cards = [];

  for (let i = 0; i < rows.length - 1 && cards.length < 8; i++) {
    const top = rows[i];
    const below = rows[i + 1];
    if (Math.abs(top.points - below.points) > 6) continue;
    const p1 = publicPredictions.find(p => String(p.id) === String(top.id));
    const p2 = publicPredictions.find(p => String(p.id) === String(below.id));
    const game = gamesPool.find(match =>
      (p1?.matches || []).some(pred => Number(pred.id) === Number(match.id)) &&
      (p2?.matches || []).some(pred => Number(pred.id) === Number(match.id))
    );
    if (!game) continue;

    const pred1 = (p1?.matches || []).find(pred => Number(pred.id) === Number(game.id));
    const pred2 = (p2?.matches || []).find(pred => Number(pred.id) === Number(game.id));
    const stateText = `Battle do próximo jogo: ${escapeHtml(game.date || '')} ${escapeHtml(game.time || '')}`;

    cards.push(`
      <div class="battle-card live-battle battle-card-horizontal">
        <span class="battle-match">Jogo ${escapeHtml(game.id)} · ${escapeHtml(game.homeTeam)} vs ${escapeHtml(game.awayTeam)}</span>
        <div class="battle-duel-row">
          <div class="battle-player battle-player-a">
            <strong>${renderParticipantIdentity(`#${top.rank} ${top.name}`, p1?.icon || p1?.participantIcon || p1?.playerIcon || top.icon, 'participant-ident--compact')}</strong>
            <span>${predictionResultText(pred1)}</span>
          </div>
          <b class="battle-versus">VS</b>
          <div class="battle-player battle-player-b">
            <strong>${renderParticipantIdentity(`#${below.rank} ${below.name}`, p2?.icon || p2?.participantIcon || p2?.playerIcon || below.icon, 'participant-ident--compact')}</strong>
            <span>${predictionResultText(pred2)}</span>
          </div>
        </div>
        <small>${stateText}</small>
      </div>
    `);
  }

  return cards.join('') || '<p class="modal-muted">Ainda não há battles próximas para mostrar.</p>';
}


function openGgamesPlayerHistory(playerId) {
  const rows = calculateGgamesTable();
  const row = rows.find(r => String(r.id) === String(playerId));
  const playerDoc = publicPredictions.find(p => String(p.id) === String(playerId));
  if (!row || !playerDoc) {
    openModal('<h2>Histórico do jogador</h2><p class="modal-muted">Não foi possível encontrar este jogador.</p>');
    return;
  }
  const scheduledMatches = Array.isArray(data?.matches)
    ? [...data.matches].sort(compareMatchesBySchedule)
    : [];
  const historyEntries = scheduledMatches.map(match => {
    const pred = typeof findInitialPredictionForMatch === 'function'
      ? findInitialPredictionForMatch(playerDoc, match)
      : (playerDoc.matches || []).find(row => Number(row.id) === Number(match.id));
    const override = typeof getSection2DocForPlayer === 'function' ? getSection2DocForPlayer(playerDoc, match.id) : null;
    const isKnockout = match.stage && match.stage !== 'groups';

    let displayPred = pred;
    if (isKnockout && override) {
      if (override.mode === 'changed') {
        displayPred = {
          homeGoals: override.homeGoals,
          awayGoals: override.awayGoals,
          winnerTeam: override.winnerTeam,
          method: override.method,
          homeTeam: override.homeTeam,
          awayTeam: override.awayTeam,
          stage: override.stage || match.stage,
          id: override.matchId || match.id
        };
      } else if (override.mode === 'replicate' && (override.initialPrediction || pred)) {
        const basePred = override.initialPrediction || pred;
        displayPred = {
          homeGoals: basePred.homeGoals,
          awayGoals: basePred.awayGoals,
          winnerTeam: basePred.winnerTeam,
          method: basePred.method,
          homeTeam: override.homeTeam || basePred.homeTeam || match.home,
          awayTeam: override.awayTeam || basePred.awayTeam || match.away,
          stage: override.stage || basePred.stage || match.stage,
          id: override.matchId || basePred.id || match.id
        };
      }
    }

    if (!displayPred) return null;
    return { match, pred, displayPred, override };
  }).filter(Boolean);
  const historyRows = historyEntries.map(({ match, pred, displayPred, override }) => {
    const official = getOfficialResult(match.id);
    const isLive = !!official && isOfficialResultLive(official) && !isOfficialResultFinished(official);
    
    const score = official && isOfficialResultFinished(official) ? scoreHistoryPrediction(playerDoc, match, pred, official, override) : null;
    
    const status = official
      ? (isLive ? 'Live' : (score?.points > 0 ? 'Acertou' : 'Falhou'))
      : 'Por jogar';
    const statusClass = official
      ? (isLive ? 'wait' : (score?.points > 0 ? 'ok' : 'bad'))
      : 'wait';
    const officialText = official
      ? (isLive
        ? 'Live'
        : `${escapeHtml(official.homeTeam || match.home || '')} ${official.homeGoals ?? official.homeScore ?? 0}-${official.awayGoals ?? official.awayScore ?? 0} ${escapeHtml(official.awayTeam || match.away || '')}`)
      : '';
    const isFinished = official && isOfficialResultFinished(official);
    const resultCell = isFinished
      ? `<td data-label="Resultado" class="history-result-cell-clickable" data-match-id="${match.id}" onclick="handleHistoryResultClick(this.dataset.matchId)" style="cursor: pointer; text-decoration: underline; color: var(--accent); font-weight: bold;">${officialText}</td>`
      : `<td data-label="Resultado">${officialText}</td>`;
      
    let predText = predictionResultText(displayPred);
    if (override && override.mode === 'changed') {
      predText = `${escapeHtml(override.homeTeam)} ${override.homeGoals}-${override.awayGoals} ${escapeHtml(override.awayTeam)}`;
      if (override.winnerTeam) {
        let methodSuffix = '';
        if (override.method === 'et') {
          methodSuffix = ' após prolongamento';
        } else if (override.method === 'pens') {
          methodSuffix = ' após penáltis';
        }
        predText += ` <span style="font-size:0.75rem; opacity:0.85;">(vence ${escapeHtml(override.winnerTeam)}${methodSuffix})</span>`;
      }
    } else if (override && override.mode === 'replicate') {
      predText += ` <small style="opacity: 0.65; font-size: 0.72rem;">(Mantido)</small>`;
    }

    return `
      <tr>
        <td data-label="Jogo">${escapeHtml(match.id)}</td>
        <td><span class="history-pill ${statusClass}">${status}${score ? ` · ${score.points} pts` : ''}</span></td>
        <td data-label="Prognóstico">${predText}</td>
        ${resultCell}
        <td data-label="Fase">${escapeHtml(match.stageLabel || STAGE_LABELS[match.stage] || match.stage || 'Jogo')}</td>
      </tr>`;
  }).join('');

  openModal(`
    <div class="modal-head">
      <div>
        <p class="eyebrow small">Tabela Ggames</p>
        <h2>${renderParticipantIdentity(`Histórico de ${row.name}`, row.icon, 'participant-ident--title')}</h2>
      </div>
    </div>
    <section class="player-history-summary">
      <article><span>Pontos Totais</span><strong>${row.points}</strong></article>
      <article><span>Pontos BW</span><strong>(${row.battleBonusPoints || 0})</strong></article>
      <article><span>Acertados</span><strong>${row.correctPredictions}</strong></article>
      <article><span>Falhados</span><strong>${row.failedPredictions}</strong></article>
      <article><span>Golos Marcados</span><strong>${row.goalsHit}</strong></article>
      <article><span>Golos Falhados</span><strong>${row.goalsMissed}</strong></article>
    </section>
    <div class="table-scroll history-scroll">
      <table class="ggames-table player-history-table">
        <thead><tr><th>Jogo</th><th>Estado</th><th>Prognóstico</th><th>Resultado</th><th>Fase</th></tr></thead>
        <tbody>${historyRows || '<tr><td colspan="5">Sem prognósticos para mostrar.</td></tr>'}</tbody>
      </table>
    </div>
  `);
}

window.handleHistoryResultClick = function(matchId) {
  const official = getOfficialResult(matchId);
  if (!official || (official.status !== 'finished' && official.finished !== true)) {
    alert('Este jogo ainda não terminou ou não possui o status "finished". Apenas jogos terminados podem ser editados.');
    return;
  }
  
  const sortedParticipants = [...publicPredictions].sort((a, b) => 
    (a.participantName || '').localeCompare(b.participantName || '', 'pt', { sensitivity: 'base' })
  );
  let optionsHtml = sortedParticipants.map(p => 
    `<option value="${escapeHtml(p.participantName)}">${escapeHtml(p.participantName)}</option>`
  ).join('');
  
  const modalHtml = `
    <div class="modal-head">
      <h2>Colaborar no Jogo ${escapeHtml(matchId)}</h2>
      <p class="modal-muted">${escapeHtml(official.homeTeam)} vs ${escapeHtml(official.awayTeam)}</p>
    </div>
    <div style="margin: 20px 0; display: flex; flex-direction: column; gap: 15px;">
      <div>
        <label for="colabParticipantSelect" style="display:block; margin-bottom:8px; font-weight:800; font-size: 0.95rem;">Selecione o seu participante:</label>
        <select id="colabParticipantSelect" style="width:100%; padding: 12px; border-radius: 12px; background: #07111f; color: var(--text); border: 1px solid var(--line);">
          <option value="">-- Escolha um participante --</option>
          ${optionsHtml}
        </select>
      </div>
      
      <div>
        <label for="colabPinInput" style="display:block; margin-bottom:8px; font-weight:800; font-size: 0.95rem;">Introduza o PIN correspondente:</label>
        <input type="text" id="colabPinInput" placeholder="Ex: 318890984" style="width:100%; padding: 12px; border-radius: 12px; background: #07111f; color: var(--text); border: 1px solid var(--line);" />
      </div>
      
      <button type="button" class="primary" id="colabValidateBtn" style="margin-top: 10px; width:100%; padding: 12px; border-radius: 999px;">Validar PIN</button>
    </div>
  `;
  openModal(modalHtml);
  
  document.getElementById('colabValidateBtn').addEventListener('click', () => {
    const selectedName = document.getElementById('colabParticipantSelect').value;
    const enteredPin = document.getElementById('colabPinInput').value.trim();
    
    if (!selectedName) {
      alert('Selecione um participante.');
      return;
    }
    
    const participant = publicPredictions.find(p => p.participantName === selectedName);
    if (!participant) {
      alert('Participante não encontrado.');
      return;
    }
    
    if (String(participant.pin || '').trim() === enteredPin) {
      openCollaborationEditPopup(matchId, participant.participantName, official);
    } else {
      alert('O PIN introduzido não corresponde a este participante.');
    }
  });
};

window.openCollaborationEditPopup = function(matchId, participantName, official) {
  function makeGoalsOptions(selectedValue) {
    let html = '';
    for (let i = 0; i <= 20; i++) {
      const selectedAttr = (selectedValue !== null && selectedValue !== undefined && Number(selectedValue) === i) ? 'selected' : '';
      html += `<option value="${i}" ${selectedAttr}>${i}</option>`;
    }
    return html;
  }
  
  const homeOptions = makeGoalsOptions(official.homeGoals);
  const awayOptions = makeGoalsOptions(official.awayGoals);
  
  const editHtml = `
    <div class="modal-head">
      <h2>Editar Resultado - Jogo ${escapeHtml(matchId)}</h2>
      <p class="modal-muted">Colaborador: <strong>${escapeHtml(participantName)}</strong></p>
    </div>
    <div style="margin: 25px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; text-align: center;">
      <div style="background: rgba(255,255,255,.03); padding: 16px; border-radius: 16px; border: 1px solid var(--line);">
        <h3 style="margin: 0 0 12px; font-size: 1.1rem; color: var(--text);">${escapeHtml(official.homeTeam)}</h3>
        <select id="colabHomeGoals" style="width: 100px; padding: 10px; text-align: center; font-size: 1.25rem; border-radius: 12px; background: #07111f; color: var(--text); border: 1px solid var(--line);">
          ${homeOptions}
        </select>
      </div>
      <div style="background: rgba(255,255,255,.03); padding: 16px; border-radius: 16px; border: 1px solid var(--line);">
        <h3 style="margin: 0 0 12px; font-size: 1.1rem; color: var(--text);">${escapeHtml(official.awayTeam)}</h3>
        <select id="colabAwayGoals" style="width: 100px; padding: 10px; text-align: center; font-size: 1.25rem; border-radius: 12px; background: #07111f; color: var(--text); border: 1px solid var(--line);">
          ${awayOptions}
        </select>
      </div>
    </div>
    <div style="margin-top: 25px;">
      <button type="button" class="primary" id="colabSubmitBtn" style="width:100%; padding: 12px; border-radius: 999px;">Colaborar</button>
    </div>
  `;
  openModal(editHtml);
  
  document.getElementById('colabSubmitBtn').addEventListener('click', async () => {
    const newHomeGoals = Number(document.getElementById('colabHomeGoals').value);
    const newAwayGoals = Number(document.getElementById('colabAwayGoals').value);
    
    const prevHomeGoals = official.homeGoals;
    const prevAwayGoals = official.awayGoals;
    
    const homeGoalsChanged = (prevHomeGoals !== newHomeGoals);
    const awayGoalsChanged = (prevAwayGoals !== newAwayGoals);
    
    if (!homeGoalsChanged && !awayGoalsChanged) {
      alert('Não alterou nenhum dos golos.');
      closeModal();
      return;
    }
    
    let editDesc = '';
    if (homeGoalsChanged && awayGoalsChanged) {
      editDesc = `${official.homeTeam} homeGoals (${prevHomeGoals ?? 0} -> ${newHomeGoals}) e ${official.awayTeam} awayGoals (${prevAwayGoals ?? 0} -> ${newAwayGoals})`;
    } else if (homeGoalsChanged) {
      editDesc = `${official.homeTeam} homeGoals (${prevHomeGoals ?? 0} -> ${newHomeGoals})`;
    } else {
      editDesc = `${official.awayTeam} awayGoals (${prevAwayGoals ?? 0} -> ${newAwayGoals})`;
    }
    const colaboracaoEntry = `${participantName} + ${editDesc}`;
    
    const matchDocId = firebaseMatchDocId(matchId);
    const ref = firebaseTools.doc(firestoreDb, FIREBASE_MATCHES_COLLECTION, matchDocId);
    
    const submitBtn = document.getElementById('colabSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'A gravar...';
    
    try {
      const snap = await firebaseTools.getDoc(ref);
      let currentData = snap.exists() ? snap.data() : {};
      
      let colaboracaoList = Array.isArray(currentData.colaboracao) ? currentData.colaboracao : [];
      colaboracaoList.push(colaboracaoEntry);
      
      await firebaseTools.setDoc(ref, {
        homeGoals: newHomeGoals,
        awayGoals: newAwayGoals,
        colaboracao: colaboracaoList
      }, { merge: true });
      
      closeModal();
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Erro ao gravar colaboração no Firebase: ' + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Colaborar';
    }
  });
};

