/* Live/API legado: normalizacao inicial, sincronizacao e resultados oficiais. */
function apiStageToLocal(type) {
  const map = { group: 'groups', r32: 'round32', r16: 'round16', qf: 'quarterfinals', sf: 'semifinals', third: 'third_place', final: 'final' };
  return map[String(type || '').toLowerCase()] || 'groups';
}

function parseApiDate(value) {
  const text = String(value || '').trim();
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (m) return { date: `${m[3]}-${m[1]}-${m[2]}`, time: `${m[4]}:${m[5]}` };
  return { date: '', time: '' };
}

function normalizeApiBoolean(value) {
  return String(value || '').toLowerCase() === 'true' || value === true;
}

function normalizeApiScore(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function localMatchById(id) {
  return data?.matches?.find(m => String(m.id) === String(id)) || null;
}

function normalizeTeamForApi(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(the|and|e|de|da|do|republic|rep)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const API_TEAM_ALIASES = {
  'mexico': 'mexico',
  'belgica': 'belgium',
  'franca': 'france',
  'uruguai': 'uruguay',
  'cabo verde': 'cape verde',
  'curacau': 'curacao',
  'equador': 'ecuador',
  'escocia': 'scotland',
  'gana': 'ghana',
  'irao': 'iran',
  'rd congo': 'dr congo',
  'suecia': 'sweden',
  'turquia': 'turkey',
  'uzbequistao': 'uzbekistan',
  'africa sul': 'south africa',
  'africa do sul': 'south africa',
  'south africa': 'south africa',
  'coreia sul': 'south korea',
  'coreia do sul': 'south korea',
  'south korea': 'south korea',
  'chequia': 'czech republic',
  'czechia': 'czech republic',
  'republica checa': 'czech republic',
  'czech republic': 'czech republic',
  'bosnia herzegovina': 'bosnia and herzegovina',
  'arabia saudita': 'saudi arabia',
  'costa marfim': 'ivory coast',
  'nova zelandia': 'new zealand',
  'estados unidos': 'united states',
  'eua': 'united states',
  'usa': 'united states',
  'pais gales': 'wales',
  'paises baixos': 'netherlands',
  'holanda': 'netherlands',
  'alemanha': 'germany',
  'espanha': 'spain',
  'inglaterra': 'england',
  'japao': 'japan',
  'marrocos': 'morocco',
  'brasil': 'brazil',
  'brazil': 'brazil',
  'suica': 'switzerland',
  'croacia': 'croatia',
  'servia': 'serbia',
  'argelia': 'algeria',
  'egito': 'egypt',
  'camaroes': 'cameroon'
};

function apiTeamKey(name) {
  const base = normalizeTeamForApi(name);
  return API_TEAM_ALIASES[base] || base;
}

function apiTeamsMatch(homeA, awayA, homeB, awayB) {
  const aH = apiTeamKey(homeA), aA = apiTeamKey(awayA), bH = apiTeamKey(homeB), bA = apiTeamKey(awayB);
  if (!aH || !aA || !bH || !bA) return false;
  return (aH === bH && aA === bA) || (aH === bA && aA === bH);
}

function getApiFootballKey() {
  return (window.GGAMES_API_FOOTBALL_KEY || localStorage.getItem('ggames_api_football_key') || API_FOOTBALL_KEY || '').trim();
}

function hasApiFootballKey() {
  const key = getApiFootballKey();
  return !!key && !/COLOCA_AQUI_A_TUA_KEY|YOUR_API_KEY/i.test(key);
}

function localDateFromIso(value) {
  if (!value) return { date: '', time: '' };
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    const pad = n => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
    };
  }
  return { date: String(value).slice(0,10), time: String(value).slice(11,16) };
}

function apiFootballStatusIsFinished(status) {
  const short = String(status?.short || status || '').toUpperCase();
  return ['FT', 'AET', 'PEN'].includes(short) || /FINISHED|MATCH FINISHED/i.test(String(status?.long || ''));
}

function apiFootballStatusIsLive(status) {
  const short = String(status?.short || status || '').toUpperCase();
  return ['1H','HT','2H','ET','BT','P','SUSP','INT','LIVE'].includes(short);
}

function apiFootballTimeLabel(status) {
  if (!status) return '';
  if (status.short === 'HT') return 'halftime';
  if (status.elapsed != null) return String(status.elapsed);
  return status.short || status.long || '';
}

function findLocalMatchForApiFootball(fixtureObj) {
  const fixture = fixtureObj.fixture || {};
  const teams = fixtureObj.teams || {};
  const parsed = localDateFromIso(fixture.date);
  return (data?.matches || []).find(match => {
    const sameDay = !parsed.date || match.date === parsed.date;
    return sameDay && apiTeamsMatch(teams.home?.name, teams.away?.name, match.home, match.away);
  }) || (data?.matches || []).find(match => apiTeamsMatch(teams.home?.name, teams.away?.name, match.home, match.away)) || null;
}

function normalizeApiFootballGame(item, events = []) {
  const fixture = item.fixture || {};
  const teams = item.teams || {};
  const goals = item.goals || {};
  const status = fixture.status || {};
  const local = findLocalMatchForApiFootball(item);
  const parsed = localDateFromIso(fixture.date);
  const id = String(local?.id ?? `apifootball-${fixture.id || ''}`);
  const homeGoals = normalizeApiScore(goals.home);
  const awayGoals = normalizeApiScore(goals.away);
  const finished = apiFootballStatusIsFinished(status);
  const apiLive = apiFootballStatusIsLive(status);
  const scheduleMatch = { ...local, date: local?.date || parsed.date, time: local?.time || parsed.time };
  const scheduleLive = !finished && isMatchInLiveWindow(scheduleMatch);
  const live = !finished && (apiLive || scheduleLive);
  const timeElapsed = apiLive ? apiFootballTimeLabel(status) : (scheduleLive ? elapsedMinuteFromSchedule(scheduleMatch) : (status.short || 'notstarted'));
  const scorerEvents = (events || []).filter(e => ['Goal', 'Own Goal', 'Penalty'].includes(String(e.type || '')) || /Goal|Penalty/i.test(String(e.detail || '')));
  const homeScorers = scorerEvents.filter(e => apiTeamKey(e.team?.name) === apiTeamKey(teams.home?.name)).map(e => e.player?.name || e.assist?.name || '').filter(Boolean);
  const awayScorers = scorerEvents.filter(e => apiTeamKey(e.team?.name) === apiTeamKey(teams.away?.name)).map(e => e.player?.name || e.assist?.name || '').filter(Boolean);

  return ggamesSanitizeAutomaticApiGame({
    id,
    matchId: id,
    apiFootballFixtureId: fixture.id || null,
    stage: local?.stage || 'groups',
    group: local?.group || null,
    date: local?.date || parsed.date,
    time: local?.time || parsed.time,
    homeTeam: local?.home || teams.home?.name || 'A definir',
    awayTeam: local?.away || teams.away?.name || 'A definir',
    homeTeamId: teams.home?.id || null,
    awayTeamId: teams.away?.id || null,
    homeGoals,
    awayGoals,
    homeScorers,
    awayScorers,
    finished,
    live,
    timeElapsed,
    apiStatus: status.short || status.long || '',
    venue: fixture.venue?.name || local?.venue || '',
    city: fixture.venue?.city || local?.city || '',
    country: local?.country || '',
    source: 'live-real',
    status: 'official',
    type: 'officialResult'
  });
}

function mergeApiGameLists(...lists) {
  const byId = new Map();
  const priority = { 'local-schedule': 0, 'TheSportsDB': 1, 'worldcup26.ir': 2, 'API-Football': 3 };
  lists.flat().filter(Boolean).forEach(game => {
    if (!game?.id) return;
    const key = String(game.id);
    const prev = byId.get(key);
    if (!prev || (priority[game.source] || 0) >= (priority[prev.source] || 0)) {
      byId.set(key, { ...prev, ...game });
    }
  });
  return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

function buildLocalScheduleGames() {
  return (data?.matches || []).map(match => {
    const official = officialResults[String(match.id)];
    const isFinished = isOfficialResultFinished(official);
    const scheduleLive = !isFinished && isMatchInLiveWindow(match);
    return {
      id: String(match.id),
      matchId: String(match.id),
      stage: match.stage,
      group: match.group,
      date: match.date,
      time: match.time,
      homeTeam: match.home,
      awayTeam: match.away,
      homeGoals: official?.homeGoals ?? null,
      awayGoals: official?.awayGoals ?? null,
      finished: isFinished,
      live: scheduleLive,
      timeElapsed: scheduleLive ? `~${elapsedMinuteFromSchedule(match)}` : (isFinished ? 'finished' : 'notstarted'),
      venue: match.venue || '',
      city: match.city || '',
      country: match.country || '',
      source: 'local-schedule'
    };
  });
}

async function fetchApiFootballJson(endpoint) {
  const response = await fetch(`${API_FOOTBALL_BASE}${endpoint}`, {
    cache: 'no-store',
    headers: { 'x-apisports-key': getApiFootballKey() }
  });
  if (!response.ok) throw new Error(`API-Football ${endpoint}: ${response.status}`);
  const payload = await response.json();
  if (payload?.errors && Object.keys(payload.errors).length) {
    console.warn('API-Football errors', payload.errors);
  }
  return payload;
}

function relevantDatesForLiveFetch() {
  const now = new Date();
  const dates = new Set();
  (data?.matches || []).forEach(match => {
    const d = getMatchDateObj({ date: match.date, time: match.time || '12:00' });
    if (Math.abs(d.getTime() - now.getTime()) <= 36 * 60 * 60 * 1000) dates.add(match.date);
  });
  dates.add(now.toISOString().slice(0,10));
  return [...dates].slice(0, 3);
}

async function loadApiFootballGames({ force = false } = {}) {
  if (!hasApiFootballKey()) return [];
  const now = Date.now();
  if (!force && lastApiFootballFetchAt && now - lastApiFootballFetchAt < API_FOOTBALL_MIN_INTERVAL_MS) {
    return worldCupApi.games.filter(g => g.source === 'API-Football');
  }
  lastApiFootballFetchAt = now;

  try {
    const dates = relevantDatesForLiveFetch();
    const fixturePayloads = await Promise.all(dates.map(date =>
      fetchApiFootballJson(`/fixtures?date=${encodeURIComponent(date)}&timezone=Europe/Lisbon`).catch(error => {
        console.warn('API-Football indisponível para', date, error);
        return { response: [] };
      })
    ));
    const rawFixtures = fixturePayloads.flatMap(p => Array.isArray(p.response) ? p.response : []);
    const matched = rawFixtures.filter(item => findLocalMatchForApiFootball(item));
    const eventMap = {};

    const eventTargets = matched.filter(item => {
      const st = item.fixture?.status || {};
      return apiFootballStatusIsLive(st) || apiFootballStatusIsFinished(st);
    }).slice(0, 8);

    await Promise.all(eventTargets.map(async item => {
      const fixtureId = item.fixture?.id;
      if (!fixtureId) return;
      try {
        const payload = await fetchApiFootballJson(`/fixtures/events?fixture=${fixtureId}`);
        eventMap[fixtureId] = Array.isArray(payload.response) ? payload.response : [];
      } catch (error) {
        console.warn('Não foi possível carregar eventos API-Football', fixtureId, error);
      }
    }));

    return matched.map(item => normalizeApiFootballGame(item, eventMap[item.fixture?.id] || []));
  } catch (error) {
    console.warn('API-Football falhou; a usar restantes fontes.', error);
    return [];
  }
}

function isApiStatusLive(value) {
  const lower = String(value || '').trim().toLowerCase();
  if (!lower) return false;
  if (['notstarted', 'not-started', 'scheduled', 'upcoming', 'false', '0', 'finished', 'ended', 'fulltime', 'full-time', 'ft'].includes(lower)) return false;
  if (/^\d+([+\d]*)?$/.test(lower)) return true;
  return ['live', 'inplay', 'in-play', 'playing', 'first-half', 'second-half', 'halftime', 'half-time', 'interval', 'extra-time', 'extratime', 'et', 'penalties', 'penalty', 'shootout', 'pens'].includes(lower);
}

function isMatchInLiveWindow(match, now = new Date()) {
  if (!match?.date) return false;
  const start = getMatchDateObj({ date: match.date, time: match.time || '12:00' });
  if (Number.isNaN(start.getTime())) return false;
  const elapsedMs = now.getTime() - start.getTime();
  return elapsedMs >= 0 && elapsedMs <= 130 * 60 * 1000;
}

function elapsedMinuteFromSchedule(match, now = new Date()) {
  if (!match?.date) return null;
  const start = getMatchDateObj({ date: match.date, time: match.time || '12:00' });
  if (Number.isNaN(start.getTime())) return null;
  const minutes = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 60000));
  if (minutes <= 45) return String(minutes);
  if (minutes <= 60) return 'halftime';
  if (minutes <= 105) return String(minutes - 15);
  return String(Math.min(90, minutes - 15));
}

function normalizeApiGame(raw) {
  const homeNameRaw = raw.home_team_name_en || raw.home_team_name || raw.home_team_label;
  const awayNameRaw = raw.away_team_name_en || raw.away_team_name || raw.away_team_label;
  let local = null;
  if (homeNameRaw && awayNameRaw) {
    local = (data?.matches || []).find(match => apiTeamsMatch(homeNameRaw, awayNameRaw, match.home, match.away));
  }
  if (!local) {
    const rawId = String(raw.id ?? raw.match_id ?? raw.game_id ?? raw._id ?? '');
    local = localMatchById(rawId);
  }
  const id = local ? String(local.id) : String(raw.id ?? raw.match_id ?? raw.game_id ?? raw._id ?? '');
  const parsedDate = parseApiDate(raw.local_date || raw.date || raw.datetime);
  const homeName = raw.home_team_name_en || raw.home_team_name || raw.home_team_label || local?.home || 'A definir';
  const awayName = raw.away_team_name_en || raw.away_team_name || raw.away_team_label || local?.away || 'A definir';
  const homeGoals = normalizeApiScore(raw.home_score ?? raw.homeGoals);
  const awayGoals = normalizeApiScore(raw.away_score ?? raw.awayGoals);
  const finished = normalizeApiBoolean(raw.finished);
  const rawElapsed = raw.time_elapsed ?? raw.status ?? 'notstarted';
  const apiLive = isApiStatusLive(rawElapsed);
  const scheduleMatch = { ...local, date: local?.date || parsedDate.date || '', time: local?.time || parsedDate.time || '' };
  const scheduleLive = !finished && isMatchInLiveWindow(scheduleMatch);
  const live = !finished && (apiLive || scheduleLive);
  const timeElapsed = apiLive ? rawElapsed : (scheduleLive ? elapsedMinuteFromSchedule(scheduleMatch) : rawElapsed);
  return {
    id,
    matchId: id,
    stage: apiStageToLocal(raw.type || local?.stage),
    group: raw.group || local?.group || null,
    date: local?.date || parsedDate.date || '',
    time: local?.time || parsedDate.time || '',
    homeTeam: homeName,
    awayTeam: awayName,
    homeTeamId: raw.home_team_id || null,
    awayTeamId: raw.away_team_id || null,
    homeGoals,
    awayGoals,
    homeScorers: raw.home_scorers || null,
    awayScorers: raw.away_scorers || null,
    finished,
    live,
    timeElapsed,
    venue: local?.venue || '',
    city: local?.city || '',
    country: local?.country || '',
    source: 'worldcup',
    status: 'official',
    type: 'officialResult'
  };
}

async function fetchApiJson(endpoint) {
  const response = await fetch(`${WORLD_CUP_API_BASE}${endpoint}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`API ${endpoint}: ${response.status}`);
  return response.json();
}

async function fetchSportsDbJson(endpoint) {
  const response = await fetch(`${SPORTSDB_API_BASE}${endpoint}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`TheSportsDB ${endpoint}: ${response.status}`);
  return response.json();
}

function extractApiArray(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.event)) return payload.event;
  if (Array.isArray(payload?.lineup)) return payload.lineup;
  return [];
}

async function loadWorldcup26Games() {
  try {
    const [gamesPayload, groupsPayload] = await Promise.all([
      fetchApiJson('/get/games'),
      fetchApiJson('/get/groups').catch(() => [])
    ]);
    return {
      games: extractApiArray(gamesPayload, 'games').map(normalizeApiGame).filter(g => g.id),
      groups: extractApiArray(groupsPayload, 'groups')
    };
  } catch (error) {
    console.warn('worldcup26.ir falhou; a usar restantes fontes.', error);
    return { games: [], groups: [] };
  }
}

function sportsDbEventMatchesLocal(event, local) {
  return apiTeamsMatch(event.strHomeTeam, event.strAwayTeam, local?.home, local?.away);
}

function normalizeSportsDbGame(raw) {
  const local = (data?.matches || []).find(match => sportsDbEventMatchesLocal(raw, match)) || null;
  if (!local) return null;
  const homeGoals = normalizeApiScore(raw.intHomeScore);
  const awayGoals = normalizeApiScore(raw.intAwayScore);
  const statusText = raw.strStatus || raw.strProgress || '';
  const finished = homeGoals !== null && awayGoals !== null && (/match finished|finished|ft|full/i.test(statusText) || getMatchDateObj(local) < new Date(Date.now() - 130 * 60 * 1000));
  const scheduleLive = !finished && isMatchInLiveWindow(local);
  return {
    id: String(local.id),
    matchId: String(local.id),
    apiEventId: raw.idEvent || null,
    stage: local.stage,
    group: local.group,
    date: local.date,
    time: local.time,
    homeTeam: local.home,
    awayTeam: local.away,
    homeGoals,
    awayGoals,
    homeScorers: raw.strHomeGoalDetails || null,
    awayScorers: raw.strAwayGoalDetails || null,
    finished,
    live: scheduleLive,
    timeElapsed: scheduleLive ? `~${elapsedMinuteFromSchedule(local)}` : statusText || 'notstarted',
    venue: raw.strVenue || local.venue || '',
    city: local.city || '',
    country: local.country || '',
    source: 'lineups',
    status: 'official',
    type: 'officialResult'
  };
}

async function loadSportsDbGames() {
  const dates = relevantDatesForLiveFetch();
  const payloads = await Promise.all(dates.map(date =>
    fetchSportsDbJson(`/eventsday.php?d=${encodeURIComponent(date)}&s=Soccer`).catch(error => {
      console.warn('TheSportsDB indisponível para', date, error);
      return { events: [] };
    })
  ));
  return payloads.flatMap(p => extractApiArray(p, 'events')).map(normalizeSportsDbGame).filter(Boolean);
}

function buildGroupsTableFromGames(games) {
  const groups = {};
  (data?.matches || []).forEach(match => {
    if (match.stage !== 'groups' || !match.group) return;
    if (!groups[match.group]) groups[match.group] = {};
    [match.home, match.away].forEach(team => {
      if (!groups[match.group][team]) groups[match.group][team] = { team, played: 0, pts: 0, gf: 0, ga: 0 };
    });

    const official = getOfficialResult(match.id) || games.find(g => String(g.id) === String(match.id));
    if (!official || official.homeGoals == null || official.awayGoals == null || !isOfficialResultFinished(official)) return;

    const home = groups[match.group][match.home];
    const away = groups[match.group][match.away];
    const hg = Number(official.homeGoals);
    const ag = Number(official.awayGoals);
    home.played++; away.played++;
    home.gf += hg; home.ga += ag;
    away.gf += ag; away.ga += hg;
    if (hg > ag) home.pts += 3;
    else if (ag > hg) away.pts += 3;
    else { home.pts += 1; away.pts += 1; }
  });

  return Object.entries(groups).map(([group, teams]) => ({
    group,
    teams: Object.values(teams).sort((a, b) =>
      (b.pts - a.pts) ||
      ((b.gf - b.ga) - (a.gf - a.ga)) ||
      (b.gf - a.gf) ||
      a.team.localeCompare(b.team, 'pt-PT')
    )
  })).sort((a, b) => a.group.localeCompare(b.group));
}

async function loadApiWorldCupData({ sync = false } = {}) {
  const localGames = buildLocalScheduleGames();
  try {
    const [worldcup26, sportsDbGames, apiFootballGames] = await Promise.all([
      loadWorldcup26Games(),
      loadSportsDbGames(),
      loadApiFootballGames({ force: sync })
    ]);

    worldCupApi.games = mergeApiGameLists(localGames, worldcup26.games, sportsDbGames, apiFootballGames);
    worldCupApi.groups = buildGroupsTableFromGames(worldCupApi.games);
    worldCupApi.loaded = true;
    worldCupApi.error = null;
    worldCupApi.lastUpdate = new Date();
    worldCupApi.source = apiFootballGames.length ? 'API-Football + backups' : 'worldcup26.ir + TheSportsDB + local';

    mergeApiResultsIntoOfficialResults();
    if (typeof finalizeBattlesIfMatchFinished === 'function') {
      (worldCupApi.games || []).filter(g => g.finished).forEach(g => {
        const battles = (window.ggamesBattleDocs || []).filter?.(b => String(b.matchId) === String(g.id)) || [];
        finalizeBattlesIfMatchFinished(g, battles);
      });
    }
    if (sync) {
      await syncFinishedApiResultsToFirebase();
      const loaded = await loadOfficialMatchStateDocs();
      applyLoadedOfficialSources(loaded);
      mergeApiResultsIntoOfficialResults();
    }
    return worldCupApi;
  } catch (error) {
    worldCupApi.error = error;
    console.warn('Todas as APIs falharam. O site continua com dados locais/Firebase.', error);
    worldCupApi.games = localGames;
    worldCupApi.groups = buildGroupsTableFromGames(localGames);
    worldCupApi.loaded = true;
    worldCupApi.lastUpdate = new Date();
    mergeApiResultsIntoOfficialResults();
    return worldCupApi;
  }
}

function mergeApiResultsIntoOfficialResults() {
  // Enforce kickoff rule: games before kickoff cannot be live, finished or have goals/scorers.
  worldCupApi.games.forEach(g => {
    if (isMatchBeforeKickoff(g)) {
      g.live = false;
      g.finished = false;
      g.homeGoals = null;
      g.awayGoals = null;
      g.timeElapsed = '';
    }
  });

  worldCupApi.games.forEach(game => {
    const hasScore = game.homeGoals !== null && game.awayGoals !== null;
    if (!hasScore) return;
    if (!game.live && !game.finished) return;
    const existing = officialResults[String(game.id)];
    // Se o jogo já estiver na coleção segura, essa coleção manda sempre.
    if (existing?._officialSource === 'secure-firestore') return;
    if (!existing || existing._officialSource !== 'firestore') {
      officialResults[String(game.id)] = {
        ...existing,
        ...game,
        status: 'official',
        type: 'officialResult',
        source: 'api-live',
        _live: game.live,
        _finished: game.finished,
        _officialSource: 'apiOverlay'
      };
    }
  });
}


function ggamesFirestoreTimestampToMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000);
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function ggamesMatchKickoffStillFuture(existingData) {
  const kickoffMs = ggamesFirestoreTimestampToMillis(existingData?.kickoff);
  if (!kickoffMs) return false;
  return Date.now() < kickoffMs;
}

function ggamesShouldSkipFootballDataDirectCors() {
  try {
    const host = String(window.location.hostname || '').toLowerCase();
    // football-data.org responde com Access-Control-Allow-Origin: http://localhost.
    // Em 127.0.0.1 o preflight rebenta antes de a app poder tratar o erro.
    return host === '127.0.0.1';
  } catch {
    return false;
  }
}

async function syncFinishedApiResultsToFirebase() {
  if (!firestoreDb || !firebaseTools || !worldCupApi.games.length) return;
  const trustedSources = new Set(['API-Football', 'football-data', 'Highlightly', 'AllSportsAPI', 'SofaScore', 'ESPN', 'worldcup26.ir', 'TheSportsDB v1 free', 'lineups', 'worldcup']);
  const relevantGames = worldCupApi.games
    .map(game => ggamesSanitizeAutomaticApiGame(game))
    .filter(g =>
      (g.live || g.finished) &&
      trustedSources.has(g.source) &&
      (g.finished ? !String(g.timeElapsed || '').startsWith('~') : true)
    );
  if (!relevantGames.length) return;
  try {
    const existingDocs = await Promise.all(relevantGames.map(async game => {
      const ref = firebaseTools.doc(firestoreDb, FIREBASE_MATCHES_COLLECTION, firebaseMatchDocId(game.id));
      const snap = await firebaseTools.getDoc(ref);
      return [String(game.id), snap.exists() ? snap.data() : null];
    }));
    const existingByMatchId = Object.fromEntries(existingDocs);
    const batch = firebaseTools.writeBatch(firestoreDb);
    relevantGames.forEach(game => {
      const existing = existingByMatchId[String(game.id)] || null;
      
      // Timing boundaries check
      const local = (data?.matches || []).find(m => String(m.id) === String(game.id));
      const kickoffMs = local ? getMatchDateObj({ date: local.date, time: local.time || '12:00' }).getTime() : null;
      const nowMs = Date.now();
        type: 'officialResult',
        source: 'api-live',
        _live: game.live,
        _finished: game.finished,
        _officialSource: 'apiOverlay'
      };
    }
  });
}

function ggamesFirestoreTimestampToMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000);
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function ggamesMatchKickoffStillFuture(existingData) {
  const kickoffMs = ggamesFirestoreTimestampToMillis(existingData?.kickoff);
  if (!kickoffMs) return false;
  return Date.now() < kickoffMs;
}

function ggamesShouldSkipFootballDataDirectCors() {
  try {
    const host = String(window.location.hostname || '').toLowerCase();
    // football-data.org responde com Access-Control-Allow-Origin: http://localhost.
    // Em 127.0.0.1 o preflight rebenta antes de a app poder tratar o erro.
    return host === '127.0.0.1';
  } catch {
    return false;
  }
}

async function syncFinishedApiResultsToFirebase() {
  if (!firestoreDb || !firebaseTools || !worldCupApi.games.length) return;
  const trustedSources = new Set(['API-Football', 'football-data', 'Highlightly', 'AllSportsAPI', 'SofaScore', 'ESPN', 'worldcup26.ir', 'TheSportsDB v1 free', 'lineups', 'worldcup']);
  const relevantGames = worldCupApi.games
    .map(game => ggamesSanitizeAutomaticApiGame(game))
    .filter(g =>
      (g.live || g.finished) &&
      trustedSources.has(g.source) &&
      (g.finished ? !String(g.timeElapsed || '').startsWith('~') : true)
    );
  if (!relevantGames.length) return;
  try {
    const existingDocs = await Promise.all(relevantGames.map(async game => {
      const ref = firebaseTools.doc(firestoreDb, FIREBASE_MATCHES_COLLECTION, firebaseMatchDocId(game.id));
      const snap = await firebaseTools.getDoc(ref);
      return [String(game.id), snap.exists() ? snap.data() : null];
    }));
    const existingByMatchId = Object.fromEntries(existingDocs);
    const batch = firebaseTools.writeBatch(firestoreDb);
    relevantGames.forEach(game => {
      const existing = existingByMatchId[String(game.id)] || null;
      
      // Timing boundaries check
      const local = (data?.matches || []).find(m => String(m.id) === String(game.id));
      const kickoffMs = local ? getMatchDateObj({ date: local.date, time: local.time || '12:00' }).getTime() : null;
      const nowMs = Date.now();

      // Rule 1: Kickoff has not arrived yet
      if (kickoffMs && nowMs < kickoffMs) return;

      // Rule 2: 180 minutes have passed since kickoff
      if (kickoffMs && nowMs > kickoffMs + 180 * 60 * 1000) return;

      if (existing?.status === 'finished' || existing?.finished === true) {
        if (existing.homeGoalsLive != null && existing.awayGoalsLive != null && (existing.homeGoals == null || existing.awayGoals == null)) {
          // Proceed to copy goals live
        } else {
          return;
        }
      }
      // Se o documento foi atualizado manualmente (pelo painel ou manualmente no DB), impede a reescrita automática da API
      if (existing && (existing.syncOrigin === 'manual-logic-panel' || existing.syncOrigin === 'manual')) return;
      
      const nextStatus = game.finished ? 'finished' : 'live';
      const nextLive = !!(game.live && !game.finished);
      const nextFinished = !!game.finished;

      const targetHomeGoalsLive = game.homeGoals ?? null;
      const targetAwayGoalsLive = game.awayGoals ?? null;
      const targetHomeGoals = nextFinished ? targetHomeGoalsLive : (existing?.homeGoals ?? null);
      const targetAwayGoals = nextFinished ? targetAwayGoalsLive : (existing?.awayGoals ?? null);

      let winnerTeam = existing?.winnerTeam ?? null;
      if (nextFinished && targetHomeGoals !== null && targetAwayGoals !== null) {
        if (targetHomeGoals > targetAwayGoals) winnerTeam = game.homeTeam || '';
        else if (targetAwayGoals > targetHomeGoals) winnerTeam = game.awayTeam || '';
        else winnerTeam = 'Empate';
      }

      const sameCoreState =
        existing &&
        existing.status === nextStatus &&
        !!existing.live === nextLive &&
        !!existing.finished === nextFinished &&
        existing.homeGoalsLive === targetHomeGoalsLive &&
        existing.awayGoalsLive === targetAwayGoalsLive &&
        existing.homeGoals === targetHomeGoals &&
        existing.awayGoals === targetAwayGoals &&
        String(existing.timeElapsed || '') === String(game.timeElapsed || '');
        
      if (sameCoreState) return;
      
      const ref = firebaseTools.doc(firestoreDb, FIREBASE_MATCHES_COLLECTION, firebaseMatchDocId(game.id));
      batch.set(ref, {
        documentId: firebaseMatchDocId(game.id),
        matchDocId: firebaseMatchDocId(game.id),
        matchId: Number(game.id),
        status: nextStatus,
        live: nextLive,
        finished: nextFinished,
        stage: game.stage,
        group: game.group || null,
        date: game.date || null,
        time: game.time || null,
        venue: game.venue || null,
        city: game.city || null,
        country: game.country || null,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeGoalsLive: targetHomeGoalsLive,
        awayGoalsLive: targetAwayGoalsLive,
        homeGoals: targetHomeGoals,
        awayGoals: targetAwayGoals,
        winnerTeam,
        timeElapsed: game.timeElapsed || null,
        source: game.source || 'api',
        syncOrigin: 'api',
        apiUpdatedAt: new Date().toISOString(),
        updatedAt: firebaseTools.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  } catch (error) {
    // Em produção, o ideal é uma Cloud Function. Se as regras não permitirem escrita pública, o site apenas mostra os dados da API.
    console.warn('Não foi possível atualizar os resultados automaticamente neste momento.', error);
  }
}

function startLiveApiSync() {
  if (liveSyncTimer) clearInterval(liveSyncTimer);

  let isSyncing = false;

  const tick = async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const liveMatchIdsBefore = new Set(
        (worldCupApi.games || [])
          .filter(g => g.live && !g.finished)
          .map(g => String(g.id))
      );

      await loadApiWorldCupData({ sync: true });

      const finishedMatchIdsAfter = new Set(
        (worldCupApi.games || [])
          .filter(g => g.finished)
          .map(g => String(g.id))
      );

      let transitionDetected = false;
      for (const id of liveMatchIdsBefore) {
        if (finishedMatchIdsAfter.has(id)) {
          transitionDetected = true;
          break;
        }
      }

      if (transitionDetected) {
        console.log('Um jogo em direto terminou. A recarregar a página forçadamente...');
        location.reload(true);
        return;
      }

      if (isVotingClosed()) refreshLiveDashboardView();
      window.dispatchEvent(new CustomEvent('ggames-live-updated', { detail: { updatedAt: worldCupApi.lastUpdate } }));

      // Se a API principal do worldcup26.ir falhou/está inativa, força nova sincronização em 5 segundos
      if (worldCupApi.sources && worldCupApi.sources.primary !== 'ok') {
        console.warn('worldcup26.ir não está ativo. A agendar nova tentativa rápida em 5 segundos...');
        setTimeout(tick, 5000);
      }
    } finally {
      isSyncing = false;
    }
  };

  liveSyncTimer = setInterval(tick, API_SYNC_INTERVAL_MS);
}
