/* Fallbacks multi-API: fontes externas, merge e loadApiWorldCupData final. */
/* ==== GGAMES MULTI-API FALLBACK v1 ====
   Ordem:
   1) worldcup26.ir -> live real, tempo, marcadores, grupos
   2) TheSportsDB v1 free -> calendário/resultados por dia quando disponível
   3) matches.json/Firebase -> fallback local para não deixar a app vazia
*/
const GGAMES_API_SOURCES = {
  worldcup26: {
    name: 'worldcup26.ir',
    gamesUrl: 'https://worldcup26.ir/get/games',
    groupsUrl: 'https://worldcup26.ir/get/groups'
  },
  sportsdb: {
    name: 'TheSportsDB v1 free',
    baseUrl: 'https://www.thesportsdb.com/api/v1/json/123'
  },
  apiFootball: {
    name: 'API-Football',
    baseUrl: 'https://v3.football.api-sports.io'
  },
  footballData: {
    name: 'football-data.org',
    baseUrl: 'https://api.football-data.org/v4'
  },
  highlightly: {
    name: 'Highlightly',
    baseUrl: HIGHLIGHTLY_BASE
  },
  allSports: {
    name: 'AllSportsAPI',
    baseUrl: 'https://apiv2.allsportsapi.com/football/'
  },
  sofaScore: {
    name: 'SofaScore',
    baseUrl: 'https://www.sofascore.com/api/v1'
  },
  espn: {
    name: 'ESPN',
    baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'
  },
  zafronix: {
    name: 'Zafronix WC API',
    baseUrl: ZAFRONIX_WC_BASE
  }
};

function ggamesNormalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\b(e|de|da|do|das|dos|the|fc|cf|sc)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const GGAMES_TEAM_API_ALIASES = {
  'mexico': 'mexico',
  'africa sul': 'south africa',
  'africa do sul': 'south africa',
  'south africa': 'south africa',
  'coreia sul': 'south korea',
  'coreia do sul': 'south korea',
  'south korea': 'south korea',
  'chequia': 'czech republic',
  'republica checa': 'czech republic',
  'czechia': 'czech republic',
  'czech republic': 'czech republic',
  'bosnia herzegovina': 'bosnia and herzegovina',
  'bosnia and herzegovina': 'bosnia and herzegovina',
  'arabia saudita': 'saudi arabia',
  'saudi arabia': 'saudi arabia',
  'costa marfim': 'ivory coast',
  'ivory coast': 'ivory coast',
  'nova zelandia': 'new zealand',
  'new zealand': 'new zealand',
  'estados unidos': 'united states',
  'eua': 'united states',
  'usa': 'united states',
  'united states': 'united states',
  'pais gales': 'wales',
  'wales': 'wales',
  'paises baixos': 'netherlands',
  'netherlands': 'netherlands',
  'alemanha': 'germany',
  'germany': 'germany',
  'espanha': 'spain',
  'spain': 'spain',
  'inglaterra': 'england',
  'england': 'england',
  'japao': 'japan',
  'japan': 'japan',
  'marrocos': 'morocco',
  'morocco': 'morocco',
  'brasil': 'brazil',
  'brazil': 'brazil',
  'holanda': 'netherlands',
  'suica': 'switzerland',
  'switzerland': 'switzerland',
  'croacia': 'croatia',
  'croatia': 'croatia',
  'servia': 'serbia',
  'serbia': 'serbia',
  'argelia': 'algeria',
  'algeria': 'algeria',
  'tunisia': 'tunisia',
  'egito': 'egypt',
  'egypt': 'egypt',
  'senegal': 'senegal',
  'gana': 'ghana',
  'ghana': 'ghana',
  'nigeria': 'nigeria',
  'camaroes': 'cameroon',
  'cameroon': 'cameroon',
  'australia': 'australia',
  'qatar': 'qatar',
  'irao': 'iran',
  'iran': 'iran'
};

function ggamesTeamKey(value) {
  const normalized = ggamesNormalizeText(value);
  return GGAMES_TEAM_API_ALIASES[normalized] || normalized;
}

function ggamesArrayFromPayload(payload, preferredKey = '') {
  if (Array.isArray(payload)) return payload;
  if (preferredKey && Array.isArray(payload?.[preferredKey])) return payload[preferredKey];
  if (Array.isArray(payload?.games)) return payload.games;
  if (Array.isArray(payload?.groups)) return payload.groups;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.event)) return payload.event;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function ggamesFetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

async function ggamesFetchApiFootball(endpoint) {
  if (!hasApiFootballKey()) throw new Error('API-Football sem key gratuita configurada.');
  const response = await fetch(`${GGAMES_API_SOURCES.apiFootball.baseUrl}${endpoint}`, {
    cache: 'no-store',
    headers: { 'x-apisports-key': getApiFootballKey() }
  });
  if (!response.ok) throw new Error(`API-Football ${endpoint}: ${response.status}`);
  return response.json();
}

function ggamesRelevantApiFootballDates() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dates = new Set([today]);
  (data?.matches || []).forEach(match => {
    const kickoff = getMatchDateObj(match);
    if (Number.isNaN(kickoff.getTime())) return;
    const diffHours = Math.abs(kickoff.getTime() - now.getTime()) / (60 * 60 * 1000);
    if (diffHours <= 36 || isMatchInLiveWindow(match)) dates.add(match.date);
  });
  return [...dates].slice(0, 3);
}

function ggamesApiFootballStatusIsFinished(status) {
  const short = String(status?.short || status || '').toUpperCase();
  const long = String(status?.long || '');
  return ['FT', 'AET', 'PEN'].includes(short) || /match finished|finished|after extra time|penalties/i.test(long);
}

function ggamesApiFootballStatusIsLive(status) {
  const short = String(status?.short || status || '').toUpperCase();
  return ['1H','HT','2H','ET','BT','P','SUSP','INT','LIVE'].includes(short);
}

function ggamesApiFootballTimeLabel(status) {
  if (!status) return 'notstarted';
  if (String(status.short || '').toUpperCase() === 'HT') return 'halftime';
  if (status.elapsed != null) return String(status.elapsed);
  return status.short || status.long || 'notstarted';
}

function ggamesLocalDateFromIso(value) {
  if (!value) return { date: '', time: '' };
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    const pad = n => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
    };
  }
  return { date: String(value).slice(0,10), time: String(value).slice(11,16) };
}

function ggamesApiFootballLocalMatch(item) {
  const fixture = item.fixture || {};
  const teams = item.teams || {};
  const parsed = ggamesLocalDateFromIso(fixture.date);
  return ggamesLocalMatchByTeams(teams.home?.name, teams.away?.name, parsed.date);
}

function ggamesNormalizeApiFootballFixture(item, events = []) {
  const fixture = item.fixture || {};
  const teams = item.teams || {};
  const goals = item.goals || {};
  const status = fixture.status || {};
  const local = ggamesApiFootballLocalMatch(item);
  if (!local) return null;

  const homeGoals = ggamesSafeScore(goals.home);
  const awayGoals = ggamesSafeScore(goals.away);
  const finished = ggamesApiFootballStatusIsFinished(status);
  const liveByApi = ggamesApiFootballStatusIsLive(status);
  const liveBySchedule = !finished && isMatchInLiveWindow(local);
  const live = !finished && (liveByApi || liveBySchedule);

  const goalEvents = (events || []).filter(event =>
    /goal|penalty/i.test(String(event.type || event.detail || '')) && !/missed/i.test(String(event.detail || ''))
  );
  const homeScorers = goalEvents
    .filter(event => ggamesTeamKey(event.team?.name) === ggamesTeamKey(teams.home?.name))
    .map(event => event.player?.name)
    .filter(Boolean);
  const awayScorers = goalEvents
    .filter(event => ggamesTeamKey(event.team?.name) === ggamesTeamKey(teams.away?.name))
    .map(event => event.player?.name)
    .filter(Boolean);

  return {
    id: String(local.id),
    matchId: String(local.id),
    apiFootballFixtureId: fixture.id || null,
    stage: local.stage,
    group: local.group || null,
    date: local.date,
    time: local.time || '',
    homeTeam: local.home,
    awayTeam: local.away,
    homeTeamId: teams.home?.id || null,
    awayTeamId: teams.away?.id || null,
    homeGoals,
    awayGoals,
    homeScorers,
    awayScorers,
    finished,
    live,
    timeElapsed: liveByApi ? ggamesApiFootballTimeLabel(status) : (liveBySchedule ? `~${elapsedMinuteFromSchedule(local)}` : ggamesApiFootballTimeLabel(status)),
    venue: fixture.venue?.name || local.venue || '',
    city: fixture.venue?.city || local.city || '',
    country: local.country || '',
    source: 'live-real',
    status: 'official',
    type: 'officialResult'
  };
}

async function ggamesLoadApiFootball() {
  const result = { ok: false, games: [], groups: [], error: null, skipped: !hasApiFootballKey() };
  if (!hasApiFootballKey()) {
    result.error = 'Dados live avançados indisponíveis.';
    return result;
  }

  const now = Date.now();
  if (lastApiFootballFetchAt && now - lastApiFootballFetchAt < API_FOOTBALL_MIN_INTERVAL_MS) {
    result.games = (worldCupApi.games || []).filter(game => game.source === 'API-Football');
    result.ok = true;
    result.cached = true;
    return result;
  }
  lastApiFootballFetchAt = now;

  try {
    const dates = ggamesRelevantApiFootballDates();
    const payloads = await Promise.all(dates.map(date =>
      ggamesFetchApiFootball(`/fixtures?date=${encodeURIComponent(date)}&timezone=Europe/Lisbon`)
        .catch(error => {
          console.warn('API-Football falhou no dia', date, error);
          return { response: [] };
        })
    ));
    const fixtures = payloads.flatMap(payload => Array.isArray(payload?.response) ? payload.response : []);
    const matched = fixtures.filter(item => ggamesApiFootballLocalMatch(item));
    const liveOrFinished = matched.filter(item => {
      const status = item.fixture?.status || {};
      return ggamesApiFootballStatusIsLive(status) || ggamesApiFootballStatusIsFinished(status);
    }).slice(0, 8);

    const eventMap = {};
    await Promise.all(liveOrFinished.map(async item => {
      const fixtureId = item.fixture?.id;
      if (!fixtureId) return;
      try {
        const payload = await ggamesFetchApiFootball(`/fixtures/events?fixture=${fixtureId}`);
        eventMap[fixtureId] = Array.isArray(payload?.response) ? payload.response : [];
      } catch (error) {
        console.warn('API-Football eventos falharam para fixture', fixtureId, error);
      }
    }));

    result.games = matched.map(item => ggamesNormalizeApiFootballFixture(item, eventMap[item.fixture?.id] || [])).filter(Boolean);
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error);
    console.warn('API-Football falhou; a usar backups.', error);
  }
  return result;
}

function ggamesLocalMatchByTeams(home, away, date = '') {
  const homeKey = ggamesTeamKey(home);
  const awayKey = ggamesTeamKey(away);
  if (!homeKey || !awayKey) return null;

  const all = data?.matches || [];
  const exact = all.find(match =>
    ggamesTeamKey(match.home) === homeKey &&
    ggamesTeamKey(match.away) === awayKey &&
    (!date || match.date === date || match.sourceDateET === date)
  );
  if (exact) return exact;

  return all.find(match =>
    (ggamesTeamKey(match.home) === homeKey && ggamesTeamKey(match.away) === awayKey) ||
    (ggamesTeamKey(match.home) === awayKey && ggamesTeamKey(match.away) === homeKey)
  ) || null;
}

function ggamesSafeScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function ggamesStatusIsFinished(value) {
  return /(^| )(ft|full ?time|finished|match finished|ended|after penalties|after extra time)( |$)/i.test(String(value || ''));
}

function ggamesStatusIsLive(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  if (isApiStatusLive(text)) return true;
  return /live|in ?play|first half|second half|half ?time|^\d{1,3}('| min|m)?$/i.test(text);
}

function ggamesBuildLocalScheduledGame(match) {
  const official = getOfficialResult(match.id);
  const isFinished = isOfficialResultFinished(official);
  const scheduleLive = !isFinished && isMatchInLiveWindow(match);
  return {
    id: String(match.id),
    matchId: String(match.id),
    stage: match.stage,
    group: match.group || null,
    date: match.date,
    time: match.time || '',
    homeTeam: match.home,
    awayTeam: match.away,
    homeGoals: official?.homeGoals ?? null,
    awayGoals: official?.awayGoals ?? null,
    homeScorers: official?.homeScorers || null,
    awayScorers: official?.awayScorers || null,
    finished: isFinished,
    live: scheduleLive,
    timeElapsed: scheduleLive ? `~${elapsedMinuteFromSchedule(match)}` : (isFinished ? 'finished' : 'notstarted'),
    venue: match.venue || '',
    city: match.city || '',
    country: match.country || '',
    source: 'matches.json'
  };
}

function ggamesNormalizeSportsDbEvent(event) {
  const eventDate = event.dateEvent || event.dateEventLocal || '';
  const local = ggamesLocalMatchByTeams(event.strHomeTeam, event.strAwayTeam, eventDate);
  if (!local) return null;

  const date = local.date || event.dateEventLocal || event.dateEvent || '';
  const rawTime = local.time || event.strTimeLocal || event.strTime || '';
  const time = String(rawTime || '').slice(0, 5);

  const homeGoals = ggamesSafeScore(event.intHomeScore);
  const awayGoals = ggamesSafeScore(event.intAwayScore);
  const statusText = event.strStatus || event.strProgress || event.strResult || '';
  const scheduleGame = { ...local, date, time };
  const liveBySchedule = isMatchInLiveWindow(scheduleGame);
  const liveByApi = ggamesStatusIsLive(statusText);
  const finished = homeGoals !== null && awayGoals !== null && (ggamesStatusIsFinished(statusText) || (getMatchDateObj(local) < new Date(Date.now() - 130 * 60 * 1000) && !/live|active|1h|2h|ht/i.test(statusText)));
  const live = !finished && (liveByApi || liveBySchedule);

  return {
    id: String(local.id),
    matchId: String(local.id),
    externalEventId: event.idEvent || null,
    stage: local.stage,
    group: local.group || null,
    date,
    time,
    homeTeam: local.home,
    awayTeam: local.away,
    homeTeamId: event.idHomeTeam || null,
    awayTeamId: event.idAwayTeam || null,
    homeGoals,
    awayGoals,
    homeScorers: event.strHomeGoalDetails || null,
    awayScorers: event.strAwayGoalDetails || null,
    finished,
    live,
    timeElapsed: liveByApi ? statusText : (liveBySchedule ? `~${elapsedMinuteFromSchedule(scheduleGame)}` : statusText || 'notstarted'),
    venue: event.strVenue || local.venue || '',
    city: local.city || '',
    country: local.country || '',
    source: 'lineups',
    status: 'official',
    type: 'officialResult'
  };
}

function ggamesNormalizeWorldCup26Game(raw) {
  const normalized = normalizeApiGame(raw);
  if (!normalized?.id) return null;
  return {
    ...normalized,
    id: String(normalized.id),
    matchId: String(normalized.id),
    source: 'worldcup'
  };
}

function ggamesHasUsefulScore(game) {
  return game && game.homeGoals !== null && game.homeGoals !== undefined && game.awayGoals !== null && game.awayGoals !== undefined;
}

function ggamesGameQuality(game) {
  if (!game) return 0;
  let score = 1;
  if (game.source === 'API-Football') score += 18;
  if (game.source === 'football-data') score += 16;
  if (game.source === 'Highlightly') score += 15;
  if (game.source === 'AllSportsAPI') score += 15;
  if (game.source === 'SofaScore') score += 13;
  if (game.source === 'ESPN') score += 12;
  if (game.source === 'worldcup26.ir') score += 8;
  if (game.source === 'TheSportsDB v1 free') score += 5;
  if (game.live) score += 20;
  if (game.finished) score += 15;
  if (ggamesHasUsefulScore(game)) score += 10;
  if (game.timeElapsed && String(game.timeElapsed).toLowerCase() !== 'notstarted') score += 4;
  if (game.homeScorers || game.awayScorers) score += 4;
  return score;
}

function ggamesMergeOneLocalMatch(match, externalGames) {
  const candidates = externalGames.filter(game => String(game.id) === String(match.id));
  const best = candidates.sort((a, b) => ggamesGameQuality(b) - ggamesGameQuality(a))[0] || null;
  const localGame = ggamesBuildLocalScheduledGame(match);
  if (!best) return localGame;

  // Se uma API tem marcador/estado melhor, entra; senão fica o fallback local.
  return ggamesSanitizeAutomaticApiGame({
    ...localGame,
    ...best,
    id: String(match.id),
    matchId: String(match.id),
    stage: match.stage,
    group: match.group || best.group || null,
    date: match.date,
    time: match.time || best.time || '',
    homeTeam: match.home,
    awayTeam: match.away,
    venue: best.venue || match.venue || '',
    city: match.city || '',
    country: match.country || '',
    finished: !!best.finished,
    live: !!(best.live || localGame.live),
    timeElapsed: best.timeElapsed || localGame.timeElapsed || '',
    _apiSources: candidates.map(c => c.source).filter(Boolean)
  }, match, { scheduleLiveFallback: localGame.live });
}

async function ggamesLoadWorldCup26() {
  const result = { ok: false, games: [], groups: [], error: null };
  try {
    const [gamesPayload, groupsPayload] = await Promise.all([
      ggamesFetchJson(GGAMES_API_SOURCES.worldcup26.gamesUrl),
      ggamesFetchJson(GGAMES_API_SOURCES.worldcup26.groupsUrl).catch(() => [])
    ]);
    result.games = ggamesArrayFromPayload(gamesPayload, 'games').map(ggamesNormalizeWorldCup26Game).filter(Boolean);
    result.groups = ggamesArrayFromPayload(groupsPayload, 'groups');
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error);
    console.warn('worldcup26.ir falhou; a tentar backups.', error);
  }
  return result;
}


function ggamesGetApiKey(name, fallback) {
  const map = {
    footballData: 'ggames_football_data_key',
    highlightly: 'ggames_highlightly_key',
    allSports: 'ggames_allsports_key'
  };
  const winName = {
    footballData: 'GGAMES_FOOTBALL_DATA_KEY',
    highlightly: 'GGAMES_HIGHLIGHTLY_KEY',
    allSports: 'GGAMES_ALLSPORTS_KEY'
  }[name];
  return (window[winName] || localStorage.getItem(map[name]) || fallback || '').trim();
}

function ggamesHasKey(value) {
  return !!value && !/COLOCA_AQUI_A_TUA_KEY|YOUR_API_KEY/i.test(value);
}

function ggamesCanFetchExtraLiveApis() {
  const now = Date.now();
  if (lastExtraLiveApiFetchAt && now - lastExtraLiveApiFetchAt < EXTRA_LIVE_API_MIN_INTERVAL_MS) return false;
  lastExtraLiveApiFetchAt = now;
  return true;
}

function ggamesFootballDataStatusIsLive(status) {
  return ['LIVE', 'IN_PLAY', 'PAUSED'].includes(String(status || '').toUpperCase());
}

function ggamesFootballDataStatusIsFinished(status) {
  return ['FINISHED', 'AWARDED'].includes(String(status || '').toUpperCase());
}

async function ggamesFetchFootballData(endpoint) {
  const key = ggamesGetApiKey('footballData', FOOTBALL_DATA_KEY);
  if (!ggamesHasKey(key)) throw new Error('Sem chave football-data.');
  const response = await fetch(`${GGAMES_API_SOURCES.footballData.baseUrl}${endpoint}`, {
    cache: 'no-store',
    headers: { 'X-Auth-Token': key }
  });
  if (!response.ok) throw new Error(`football-data ${endpoint}: ${response.status}`);
  return response.json();
}

function ggamesNormalizeFootballDataMatch(match) {
  const local = ggamesLocalMatchByTeams(match.homeTeam?.name, match.awayTeam?.name, String(match.utcDate || '').slice(0, 10));
  if (!local) return null;

  const full = match.score?.fullTime || {};
  const regular = match.score?.regularTime || {};
  const homeGoals = ggamesSafeScore(full.home ?? regular.home);
  const awayGoals = ggamesSafeScore(full.away ?? regular.away);
  const status = String(match.status || '');
  const live = ggamesFootballDataStatusIsLive(status);
  const finished = ggamesFootballDataStatusIsFinished(status);
  const minute = match.minute != null ? String(match.minute) : '';

  return {
    id: String(local.id),
    matchId: String(local.id),
    footballDataMatchId: match.id || null,
    stage: local.stage,
    group: local.group || null,
    date: local.date,
    time: local.time || '',
    homeTeam: local.home,
    awayTeam: local.away,
    homeGoals,
    awayGoals,
    finished,
    live: !finished && live,
    timeElapsed: live && minute ? minute : (live ? 'live' : status || 'notstarted'),
    venue: local.venue || '',
    city: local.city || '',
    country: local.country || '',
    source: 'football-data',
    status: 'official',
    type: 'officialResult'
  };
}

async function ggamesLoadFootballData() {
  const result = { ok: false, games: [], error: null, skipped: !ggamesHasKey(ggamesGetApiKey('footballData', FOOTBALL_DATA_KEY)) };
  if (result.skipped) {
    result.error = 'Sem chave configurada.';
    return result;
  }
  if (ggamesShouldSkipFootballDataDirectCors()) {
    result.skipped = true;
    result.error = 'football-data ignorada em 127.0.0.1 para evitar CORS. Usa http://localhost:5502 ou um proxy teu.';
    return result;
  }
  try {
    const dates = ggamesRelevantApiFootballDates();
    const from = dates.sort()[0];
    const to = dates.sort()[dates.length - 1];
    const payload = await ggamesFetchFootballData(`/matches?dateFrom=${encodeURIComponent(from)}&dateTo=${encodeURIComponent(to)}`);
    result.games = ggamesArrayFromPayload(payload, 'matches').map(ggamesNormalizeFootballDataMatch).filter(Boolean);
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error);
    console.warn('football-data falhou; a usar restantes fontes.', error);
  }
  return result;
}

async function ggamesFetchHighlightly(path) {
  const key = ggamesGetApiKey('highlightly', HIGHLIGHTLY_KEY);
  if (!ggamesHasKey(key)) throw new Error('Sem chave Highlightly.');
  const response = await fetch(`${GGAMES_API_SOURCES.highlightly.baseUrl}${path}`, {
    cache: 'no-store',
    headers: {
      'x-api-key': key,
      'X-API-KEY': key,
      'Authorization': `Bearer ${key}`
    }
  });
  if (!response.ok) throw new Error(`Highlightly ${path}: ${response.status}`);
  return response.json();
}

function ggamesHighlightlyStatusIsFinished(value) {
  const statusStr = String(value || '');
  return /finished|ft|full.?time|ended|after extra|pen/i.test(statusStr) && !/live|in.?play|1h|2h|ht/i.test(statusStr);
}

function ggamesHighlightlyStatusIsLive(value) {
  return /live|in.?play|first|second|half.?time|1h|2h|ht|^\d{1,3}/i.test(String(value || ''));
}


function ggamesExtractDirectMinuteLabel(value) {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.max(0, Math.floor(value)));
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw
    .replace(/min(?:ute)?s?/ig, '')
    .replace(/′/g, "'")
    .replace(/\s+/g, '')
    .trim();

  if (/^\d{1,3}$/.test(cleaned)) return cleaned;
  if (/^\d{1,3}'$/.test(cleaned)) return cleaned;
  if (/^\d{1,3}\+\d{1,2}$/.test(cleaned)) return cleaned;
  if (/^\d{1,3}'\+\d{1,2}'?$/.test(cleaned)) return cleaned;
  if (/^\d{1,3}:\d{2}$/.test(cleaned)) return cleaned.split(':')[0];
  return '';
}

function ggamesExtractHighlightlyMinute(item) {
  const candidates = [
    item?.minute,
    item?.minutes,
    item?.elapsed,
    item?.elapsedTime,
    item?.matchMinute,
    item?.match_time,
    item?.matchTime,
    item?.liveMinute,
    item?.clock,
    item?.displayClock,
    item?.timer,
    item?.time,
    item?.time?.minute,
    item?.time?.minutes,
    item?.time?.elapsed,
    item?.time?.current,
    item?.time?.display,
    item?.status?.minute,
    item?.status?.minutes,
    item?.status?.elapsed,
    item?.status?.clock,
    item?.status?.displayClock,
    item?.period?.minute,
    item?.period?.elapsed,
    item?.periodTime,
    item?.gameTime
  ];
  for (const candidate of candidates) {
    const label = ggamesExtractDirectMinuteLabel(candidate);
    if (label) return label;
  }
  return '';
}

function ggamesGameHasDirectMinute(game) {
  if (!game || !game.live) return false;
  return !!ggamesExtractDirectMinuteLabel(game.timeElapsed);
}

function ggamesSourceHasDirectLiveMinute(result) {
  return !!(result && Array.isArray(result.games) && result.games.some(ggamesGameHasDirectMinute));
}

function ggamesNormalizeHighlightlyMatch(item) {
  const homeName = item.homeTeam?.name || item.home?.name || item.home_team?.name || item.homeTeamName || item.home_name || item.home;
  const awayName = item.awayTeam?.name || item.away?.name || item.away_team?.name || item.awayTeamName || item.away_name || item.away;
  const local = ggamesLocalMatchByTeams(homeName, awayName, String(item.date || item.startDate || item.start_time || '').slice(0, 10));
  if (!local) return null;

  const status = item.status?.name || item.status?.long || item.status?.short || item.state || item.status || item.matchStatus || '';
  const homeGoals = ggamesSafeScore(item.score?.home ?? item.scores?.home ?? item.homeScore ?? item.home_score ?? item.goals?.home);
  const awayGoals = ggamesSafeScore(item.score?.away ?? item.scores?.away ?? item.awayScore ?? item.away_score ?? item.goals?.away);
  const live = ggamesHighlightlyStatusIsLive(status);
  const finished = ggamesHighlightlyStatusIsFinished(status);
  const minute = ggamesExtractHighlightlyMinute(item);

  return {
    id: String(local.id),
    matchId: String(local.id),
    highlightlyMatchId: item.id || item.matchId || null,
    stage: local.stage,
    group: local.group || null,
    date: local.date,
    time: local.time || '',
    homeTeam: local.home,
    awayTeam: local.away,
    homeGoals,
    awayGoals,
    finished,
    live: !finished && live,
    timeElapsed: live && minute ? String(minute) : (finished ? 'FT' : ''),
    minuteProvider: live && minute ? 'Highlightly' : '',
    venue: item.venue?.name || local.venue || '',
    city: local.city || '',
    country: local.country || '',
    source: 'Highlightly',
    status: 'official',
    type: 'officialResult'
  };
}

async function ggamesLoadHighlightly() {
  const result = { ok: false, games: [], error: null, skipped: !ggamesHasKey(ggamesGetApiKey('highlightly', HIGHLIGHTLY_KEY)) };
  if (result.skipped) {
    result.error = 'Sem chave configurada.';
    return result;
  }
  try {
    const dates = ggamesRelevantApiFootballDates();
    const paths = [
      `/matches/live`,
      `/matches?date=${encodeURIComponent(dates[0])}`,
      `/fixtures?date=${encodeURIComponent(dates[0])}`
    ];

    const allGames = [];
    for (const path of paths) {
      const payload = await ggamesFetchHighlightly(path).catch(() => null);
      if (!payload) continue;
      const matches = ggamesArrayFromPayload(payload, 'matches')
        .concat(ggamesArrayFromPayload(payload, 'fixtures'))
        .concat(ggamesArrayFromPayload(payload, 'data'));
      const games = matches.map(ggamesNormalizeHighlightlyMatch).filter(Boolean);
      allGames.push(...games);

      // Poupa requests: se a primeira chamada já trouxer minuto direto, não tenta os endpoints seguintes.
      if (games.some(ggamesGameHasDirectMinute)) break;
    }

    result.games = allGames;
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error);
    console.warn('Highlightly falhou; a usar restantes fontes.', error);
  }
  return result;
}

async function ggamesFetchAllSports(params) {
  const key = ggamesGetApiKey('allSports', ALLSPORTS_KEY);
  if (!ggamesHasKey(key)) throw new Error('Sem chave AllSports.');
  const query = new URLSearchParams({ ...params, APIkey: key }).toString();
  const response = await fetch(`${GGAMES_API_SOURCES.allSports.baseUrl}?${query}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`AllSports ${params.met || ''}: ${response.status}`);
  return response.json();
}

function ggamesAllSportsStatusIsFinished(event) {
  const status = String(event.event_status || event.event_status_info || event.event_live || '');
  return /finished|ft|aet|ap/i.test(status) && !/live|half|[0-9]+/i.test(status);
}

function ggamesAllSportsStatusIsLive(event) {
  return /live|half|[0-9]+/i.test(String(event.event_live || event.event_status || event.event_status_info || ''));
}

function ggamesParseAllSportsScore(value) {
  const m = String(value || '').match(/(\d+)\s*-\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [null, null];
}

function ggamesNormalizeAllSportsEvent(event) {
  const local = ggamesLocalMatchByTeams(event.event_home_team, event.event_away_team, event.event_date);
  if (!local) return null;

  const [ftHome, ftAway] = ggamesParseAllSportsScore(event.event_ft_result || event.event_final_result);
  const [liveHome, liveAway] = ggamesParseAllSportsScore(event.event_final_result || event.event_live_result || event.event_halftime_result);
  const finished = ggamesAllSportsStatusIsFinished(event);
  const live = !finished && ggamesAllSportsStatusIsLive(event);
  const statusText = event.event_status || event.event_live || event.event_status_info || '';
  const scorers = Array.isArray(event.goalscorers) ? event.goalscorers : [];

  return {
    id: String(local.id),
    matchId: String(local.id),
    allSportsEventId: event.event_key || null,
    stage: local.stage,
    group: local.group || null,
    date: local.date,
    time: local.time || '',
    homeTeam: local.home,
    awayTeam: local.away,
    homeGoals: finished ? ftHome : liveHome,
    awayGoals: finished ? ftAway : liveAway,
    homeScorers: scorers.filter(s => ggamesTeamKey(s.home_scorer)).map(s => s.home_scorer).filter(Boolean),
    awayScorers: scorers.filter(s => ggamesTeamKey(s.away_scorer)).map(s => s.away_scorer).filter(Boolean),
    finished,
    live,
    timeElapsed: live ? String(statusText || 'live').replace(/[^0-9+HTA-Za-z' ]/g, '').trim() : (finished ? 'FT' : 'notstarted'),
    venue: event.event_stadium || local.venue || '',
    city: local.city || '',
    country: local.country || '',
    source: 'AllSportsAPI',
    status: 'official',
    type: 'officialResult'
  };
}

async function ggamesLoadAllSports() {
  const result = { ok: false, games: [], error: null, skipped: !ggamesHasKey(ggamesGetApiKey('allSports', ALLSPORTS_KEY)) };
  if (result.skipped) {
    result.error = 'Sem chave configurada.';
    return result;
  }
  try {
    const dates = ggamesRelevantApiFootballDates().sort();
    const fixturesPayload = await ggamesFetchAllSports({
      met: 'Fixtures',
      from: dates[0],
      to: dates[dates.length - 1],
      timezone: 'Europe/Lisbon'
    }).catch(() => ({ result: [] }));
    const livePayload = await ggamesFetchAllSports({ met: 'Livescore', timezone: 'Europe/Lisbon' }).catch(() => ({ result: [] }));
    const events = [
      ...ggamesArrayFromPayload(fixturesPayload, 'result'),
      ...ggamesArrayFromPayload(livePayload, 'result')
    ];
    result.games = events.map(ggamesNormalizeAllSportsEvent).filter(Boolean);
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error);
    console.warn('AllSportsAPI falhou; a usar restantes fontes.', error);
  }
  return result;
}


function ggamesRelevantSportsDbDates() {
  const all = data?.matches || [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dates = new Set([today]);

  all.forEach(match => {
    if (!match.date) return;
    const kickoff = getMatchDateObj(match);
    if (Number.isNaN(kickoff.getTime())) return;
    const diffDays = Math.abs(kickoff.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    if (diffDays <= 3 || isMatchInLiveWindow(match)) dates.add(match.date);
  });

  // limite pequeno para respeitar free tier
  return [...dates].slice(0, 8);
}


function ggamesProxyUrl(proxyBase, pathOrUrl) {
  if (!proxyBase) return pathOrUrl;
  const sep = proxyBase.includes('?') ? '&' : '?';
  return `${proxyBase}${sep}url=${encodeURIComponent(pathOrUrl)}`;
}

async function ggamesFetchSofaScore(path) {
  const directUrl = `${GGAMES_API_SOURCES.sofaScore.baseUrl}${path}`;
  const url = SOFASCORE_PROXY_URL ? ggamesProxyUrl(SOFASCORE_PROXY_URL, directUrl) : directUrl;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`SofaScore ${path}: ${response.status}`);
  return response.json();
}

function ggamesSofaScoreStatusIsFinished(status) {
  const type = String(status?.type || status?.description || status || '').toLowerCase();
  return ['finished', 'afterpenalties', 'afterextratime'].includes(type) || /finished|ended|full.?time|ft/i.test(type);
}

function ggamesSofaScoreStatusIsLive(status) {
  const type = String(status?.type || status?.description || status || '').toLowerCase();
  return ['inprogress', 'halftime', 'live', 'interrupted'].includes(type) || /live|progress|half|in.?play/i.test(type);
}

function ggamesNormalizeSofaScoreEvent(event) {
  const homeName = event.homeTeam?.name || event.homeTeam?.shortName || '';
  const awayName = event.awayTeam?.name || event.awayTeam?.shortName || '';
  const startDate = event.startTimestamp ? new Date(event.startTimestamp * 1000).toISOString().slice(0, 10) : '';
  const local = ggamesLocalMatchByTeams(homeName, awayName, startDate);
  if (!local) return null;

  const status = event.status || {};
  const homeGoals = ggamesSafeScore(event.homeScore?.current ?? event.homeScore?.normaltime ?? event.homeScore?.display);
  const awayGoals = ggamesSafeScore(event.awayScore?.current ?? event.awayScore?.normaltime ?? event.awayScore?.display);
  const live = ggamesSofaScoreStatusIsLive(status);
  const finished = ggamesSofaScoreStatusIsFinished(status);
  // Sem estimativas: só aceitamos minuto se vier diretamente escrito na resposta da fonte.
  const minute = event.statusTime?.prefix || event.statusTime?.short || event.statusTime?.long || '';

  return {
    id: String(local.id),
    matchId: String(local.id),
    sofaScoreEventId: event.id || null,
    stage: local.stage,
    group: local.group || null,
    date: local.date,
    time: local.time || '',
    homeTeam: local.home,
    awayTeam: local.away,
    homeGoals,
    awayGoals,
    homeScorers: event.homeScorers || null,
    awayScorers: event.awayScorers || null,
    finished,
    live: !finished && live,
    timeElapsed: live && minute ? String(minute) : (finished ? 'FT' : (status.description || status.type || 'notstarted')),
    venue: event.venue?.name || local.venue || '',
    city: local.city || '',
    country: local.country || '',
    source: 'SofaScore',
    status: 'official',
    type: 'officialResult'
  };
}

async function ggamesEnrichSofaScoreScorers(game) {
  if (!game?.sofaScoreEventId) return game;
  try {
    const payload = await ggamesFetchSofaScore(`/event/${encodeURIComponent(game.sofaScoreEventId)}/incidents`);
    const incidents = ggamesArrayFromPayload(payload, 'incidents');
    const goals = incidents.filter(item => /goal|penalty/i.test(String(item.incidentType || item.incidentClass || item.type || '')) && !/miss/i.test(String(item.incidentClass || item.type || '')));
    return {
      ...game,
      homeScorers: goals.filter(g => String(g.isHome) === 'true' || g.homeScore != null).map(g => g.player?.name || g.playerName || '').filter(Boolean),
      awayScorers: goals.filter(g => String(g.isHome) === 'false' || g.awayScore != null).map(g => g.player?.name || g.playerName || '').filter(Boolean)
    };
  } catch {
    return game;
  }
}

async function ggamesLoadSofaScore() {
  const result = { ok: false, games: [], error: null, skipped: !SOFASCORE_PROXY_URL };
  if (!SOFASCORE_PROXY_URL) {
    result.error = 'Proxy não configurado.';
    return result;
  }
  try {
    const dates = ggamesRelevantApiFootballDates();
    const payloads = await Promise.all(dates.map(date =>
      ggamesFetchSofaScore(`/sport/football/scheduled-events/${encodeURIComponent(date)}`).catch(() => null)
    ));
    const events = payloads.flatMap(payload => ggamesArrayFromPayload(payload, 'events'));
    const matched = events.map(ggamesNormalizeSofaScoreEvent).filter(Boolean);
    result.games = await Promise.all(matched.map(ggamesEnrichSofaScoreScorers));
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error);
    console.warn('SofaScore falhou; a usar restantes fontes.', error);
  }
  return result;
}

async function ggamesFetchEspn(url = GGAMES_API_SOURCES.espn.baseUrl) {
  const finalUrl = ESPN_PROXY_URL ? ggamesProxyUrl(ESPN_PROXY_URL, url) : url;
  const response = await fetch(finalUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`ESPN: ${response.status}`);
  return response.json();
}

function ggamesEspnStatusIsFinished(status) {
  return !!(status?.type?.completed || /STATUS_FINAL|FINAL|FT|FULL/i.test(String(status?.type?.name || status?.type?.description || status?.displayClock || '')));
}

function ggamesEspnStatusIsLive(status) {
  return !!(status?.type?.state === 'in' || /STATUS_IN_PROGRESS|IN_PROGRESS|HALF|LIVE/i.test(String(status?.type?.name || status?.type?.description || '')));
}

function ggamesNormalizeEspnCompetition(event) {
  const comp = event.competitions?.[0] || {};
  const competitors = comp.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
  const homeName = home.team?.displayName || home.team?.name || home.team?.shortDisplayName || '';
  const awayName = away.team?.displayName || away.team?.name || away.team?.shortDisplayName || '';
  const local = ggamesLocalMatchByTeams(homeName, awayName, String(event.date || '').slice(0, 10));
  if (!local) return null;

  const status = event.status || comp.status || {};
  const live = ggamesEspnStatusIsLive(status);
  const finished = ggamesEspnStatusIsFinished(status);
  const homeScorers = [];
  const awayScorers = [];

  (comp.details || event.competitions?.[0]?.details || []).forEach(detail => {
    if (!/goal|penalty/i.test(String(detail.type?.text || detail.type || detail.scoringPlay || ''))) return;
    const athlete = detail.athletes?.[0]?.displayName || detail.athlete?.displayName || detail.participants?.[0]?.athlete?.displayName || '';
    const teamId = detail.team?.id || detail.teamId || '';
    if (!athlete) return;
    if (String(teamId) === String(home.team?.id)) homeScorers.push(athlete);
    else if (String(teamId) === String(away.team?.id)) awayScorers.push(athlete);
  });

  return {
    id: String(local.id),
    matchId: String(local.id),
    espnEventId: event.id || null,
    stage: local.stage,
    group: local.group || null,
    date: local.date,
    time: local.time || '',
    homeTeam: local.home,
    awayTeam: local.away,
    homeGoals: ggamesSafeScore(home.score),
    awayGoals: ggamesSafeScore(away.score),
    homeScorers,
    awayScorers,
    finished,
    live: !finished && live,
    timeElapsed: live ? (status.displayClock || status.type?.shortDetail || status.type?.description || 'live') : (finished ? 'FT' : 'notstarted'),
    venue: comp.venue?.fullName || local.venue || '',
    city: local.city || '',
    country: local.country || '',
    source: 'ESPN',
    status: 'official',
    type: 'officialResult'
  };
}

async function ggamesLoadEspn() {
  const result = { ok: false, games: [], error: null };
  try {
    const payload = await ggamesFetchEspn();
    result.games = ggamesArrayFromPayload(payload, 'events').map(ggamesNormalizeEspnCompetition).filter(Boolean);
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error);
    console.warn('ESPN falhou; a usar restantes fontes.', error);
  }
  return result;
}



async function ggamesFetchZafronix(path) {
  if (!ZAFRONIX_WC_KEY || ZAFRONIX_WC_KEY === 'COLOCA_AQUI_A_TUA_KEY') {
    throw new Error('Zafronix WC API sem key configurada.');
  }
  const response = await fetch(`${GGAMES_API_SOURCES.zafronix.baseUrl}${path}`, {
    cache: 'no-store',
    headers: {
      'Accept': 'application/json',
      'X-API-Key': ZAFRONIX_WC_KEY
    }
  });
  if (!response.ok) throw new Error(`Zafronix ${path}: ${response.status}`);
  return response.json();
}

function ggamesNormalizeZafronixGroupLetter(rawGroup) {
  const value = String(rawGroup || '').trim().toUpperCase();
  const direct = value.match(/^([A-L])$/);
  if (direct) return direct[1];
  const fromStage = value.match(/GROUP[_\s-]*([A-L])/i);
  return fromStage ? fromStage[1].toUpperCase() : value;
}

function ggamesNormalizeZafronixStandingRow(row = {}) {
  const played = Number(row.played ?? row.matchesPlayed ?? row.gamesPlayed ?? row.p ?? 0) || 0;
  const wins = Number(row.won ?? row.wins ?? row.w ?? 0) || 0;
  const draws = Number(row.drawn ?? row.draws ?? row.d ?? 0) || 0;
  const losses = Number(row.lost ?? row.losses ?? row.l ?? 0) || 0;
  const gf = Number(row.goalsFor ?? row.gf ?? row.goals_for ?? 0) || 0;
  const ga = Number(row.goalsAgainst ?? row.ga ?? row.goals_against ?? 0) || 0;
  const gd = Number(row.goalDifference ?? row.gd ?? (gf - ga)) || 0;
  const pts = Number(row.points ?? row.pts ?? 0) || 0;
  return {
    team: row.team || row.teamName || row.name || row.country || 'Equipa',
    played,
    wins,
    draws,
    losses,
    gf,
    ga,
    gd,
    pts,
    points: pts,
    position: row.position ?? row.rank ?? null,
    advanced: row.advanced === true,
    source: 'Zafronix WC API'
  };
}

function ggamesNormalizeZafronixStandings(payload) {
  const rawGroups = payload?.groups || payload?.data?.groups || payload?.standings || payload?.data || {};
  const entries = Array.isArray(rawGroups)
    ? rawGroups.map(groupObj => [groupObj.group || groupObj.name || groupObj.letter, groupObj.teams || groupObj.rows || groupObj.standings || groupObj.table || []])
    : Object.entries(rawGroups);

  return entries
    .map(([group, rows]) => {
      const groupLetter = ggamesNormalizeZafronixGroupLetter(group);
      const teams = (Array.isArray(rows) ? rows : [])
        .map(ggamesNormalizeZafronixStandingRow)
        .sort((a, b) => {
          const pa = a.position == null ? 999 : Number(a.position);
          const pb = b.position == null ? 999 : Number(b.position);
          return (pa - pb) || (b.pts - a.pts) || (b.gd - a.gd) || (b.gf - a.gf) || a.team.localeCompare(b.team, 'pt-PT');
        });
      return { group: groupLetter, teams, source: 'Zafronix WC API' };
    })
    .filter(group => group.group && group.teams.length)
    .sort((a, b) => a.group.localeCompare(b.group, 'pt-PT'));
}

async function ggamesLoadZafronixStandings() {
  const result = { ok: false, groups: [], error: null };
  try {
    const payload = await ggamesFetchZafronix('/standings?year=2026');
    result.groups = ggamesNormalizeZafronixStandings(payload);
    result.ok = result.groups.length > 0;
    if (!result.ok) result.error = 'Zafronix respondeu sem grupos.';
  } catch (error) {
    result.error = String(error?.message || error);
    console.warn('Zafronix standings falhou; a usar tabela calculada por jogos/Firebase.', error);
  }
  return result;
}

async function ggamesLoadSportsDb() {
  const result = { ok: false, games: [], groups: [], error: null };
  // Em muitos browsers a fonte bloqueia CORS. Evitamos chamadas diretas que geram erros no console.
  if (location.protocol === 'http:' && (location.hostname === '127.0.0.1' || location.hostname === 'localhost')) {
    result.error = 'Indisponível neste ambiente.';
    return result;
  }
  try {
    const dates = ggamesRelevantSportsDbDates();
    const payloads = await Promise.all(dates.map(date =>
      ggamesFetchJson(`${GGAMES_API_SOURCES.sportsdb.baseUrl}/eventsday.php?d=${encodeURIComponent(date)}&s=Soccer`)
        .catch(error => {
          console.warn('TheSportsDB falhou no dia', date, error);
          return null;
        })
    ));
    const events = payloads.flatMap(payload => ggamesArrayFromPayload(payload, 'events'));
    result.games = events.map(ggamesNormalizeSportsDbEvent).filter(Boolean);
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error);
    console.warn('TheSportsDB free falhou; a usar local/Firebase.', error);
  }
  return result;
}

function ggamesBuildGroupsFromCurrentGames(games) {
  const groups = {};
  (data?.matches || []).filter(match => match.stage === 'groups' && match.group).forEach(match => {
    groups[match.group] ||= {};
    [match.home, match.away].forEach(team => {
      groups[match.group][team] ||= { team, played: 0, pts: 0, gf: 0, ga: 0 };
    });
    const game = games.find(g => String(g.id) === String(match.id));
    const official = getOfficialResult(match.id) || game;
    if (!official || !isOfficialResultFinished(official) || !ggamesHasUsefulScore(official)) return;

    const home = groups[match.group][match.home];
    const away = groups[match.group][match.away];
    const hg = Number(official.homeGoals);
    const ag = Number(official.awayGoals);

    home.played += 1; away.played += 1;
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
  const shouldShowLoadingNotice = !sync || !worldCupApi.loaded;
  if (shouldShowLoadingNotice) {
    apiLoadingRequests += 1;
    setApiLoadingNotice(true);
  }

  try {
    const canFetchExtra = ggamesCanFetchExtraLiveApis();
    const cachedLive = (source) => Promise.resolve({ ok: true, games: (worldCupApi.games || []).filter(g => g.source === source), cached: true, skipped: true });

    const [primary, sportsDb, zafronixStandings] = await Promise.all([
      ggamesLoadWorldCup26(),
      ggamesLoadSportsDb(),
      ggamesLoadZafronixStandings()
    ]);

    const apiFootball = await ggamesLoadApiFootball();
    let footballData = await cachedLive('football-data');
    let highlightly = await cachedLive('Highlightly');
    let allSports = await cachedLive('AllSportsAPI');
    let sofaScore = await cachedLive('SofaScore');
    let espn = await cachedLive('ESPN');

    // Obter todas as fontes ativas para consolidar o melhor resultado possível
    if (canFetchExtra) {
       highlightly = await ggamesLoadHighlightly();
    }
    if (canFetchExtra) {
       footballData = await ggamesLoadFootballData();
    }
    if (canFetchExtra) {
       allSports = await ggamesLoadAllSports();
    }
    if (canFetchExtra) {
       sofaScore = await ggamesLoadSofaScore();
    }
    if (canFetchExtra) {
       espn = await ggamesLoadEspn();
    }

    const externalGames = [
      ...primary.games,
      ...sportsDb.games,
      ...espn.games,
      ...sofaScore.games,
      ...allSports.games,
      ...highlightly.games,
      ...footballData.games,
      ...apiFootball.games
    ].filter(Boolean);
    const localMatches = data?.matches || [];
    const mergedGames = localMatches.length
      ? localMatches.map(match => ggamesMergeOneLocalMatch(match, externalGames))
      : externalGames;

    const sanitizedGames = mergedGames.map(game => ggamesSanitizeAutomaticApiGame(game));
    worldCupApi.games = sanitizedGames;
    worldCupApi.groups = (zafronixStandings?.groups?.length ? zafronixStandings.groups : ggamesBuildGroupsFromCurrentGames(sanitizedGames));
    worldCupApi.loaded = true;
    worldCupApi.error = (!apiFootball.ok && !footballData.ok && !highlightly.ok && !allSports.ok && !sofaScore.ok && !espn.ok && !primary.ok && !sportsDb.ok && !zafronixStandings.ok)
      ? 'Dados live indisponíveis; modo estimado ativo.'
      : null;
    worldCupApi.lastUpdate = new Date();
    worldCupApi.sources = {
      apiFootball: apiFootball.ok ? (apiFootball.cached ? 'cache' : 'ok') : apiFootball.error,
      footballData: footballData.ok ? (footballData.cached ? 'cache' : 'ok') : footballData.error,
      highlightly: highlightly.ok ? (highlightly.cached ? 'cache' : 'ok') : highlightly.error,
      allSports: allSports.ok ? (allSports.cached ? 'cache' : 'ok') : allSports.error,
      sofaScore: sofaScore.ok ? (sofaScore.cached ? 'cache' : 'ok') : sofaScore.error,
      espn: espn.ok ? (espn.cached ? 'cache' : 'ok') : espn.error,
      primary: primary.ok ? 'ok' : primary.error,
      sportsDb: sportsDb.ok ? 'ok' : sportsDb.error,
      zafronixStandings: zafronixStandings.ok ? 'ok' : zafronixStandings.error,
      fallback: 'matches.json/Firebase'
    };

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
    if (shouldShowLoadingNotice) {
      apiLoadingRequests = Math.max(0, apiLoadingRequests - 1);
      if (!apiLoadingRequests) setApiLoadingNotice(false);
    }
    return worldCupApi;
  } catch (error) {
    worldCupApi.error = String(error?.message || error);
    worldCupApi.games = (data?.matches || []).map(ggamesBuildLocalScheduledGame);
    worldCupApi.groups = ggamesBuildGroupsFromCurrentGames(worldCupApi.games);
    worldCupApi.loaded = true;
    worldCupApi.lastUpdate = new Date();
    console.warn('Dados live indisponíveis; modo estimado ativo.', error);
    if (shouldShowLoadingNotice) {
      apiLoadingRequests = Math.max(0, apiLoadingRequests - 1);
      if (!apiLoadingRequests) setApiLoadingNotice(false);
    }
    return worldCupApi;
  }
}