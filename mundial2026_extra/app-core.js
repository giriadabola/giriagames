/* Core: configuracao, estado, Firebase base, helpers e calculo do torneio. */
const STAGE_LABELS = {
  groups: 'Fase de grupos',
  round32: '16 avos',
  round16: 'Oitavos',
  quarterfinals: 'Quartos de final',
  semifinals: 'Meias-finais',
  third_place: '3.º lugar',
  final: 'Final'
};

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const STORE_KEY = 'mundial2026_prognosticos_v2';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD8WcFD7jC55feYYqdY7aJSgxXyXkEjTX0',
  authDomain: 'g-games-8a8fc.firebaseapp.com',
  projectId: 'g-games-8a8fc',
  storageBucket: 'g-games-8a8fc.firebasestorage.app',
  messagingSenderId: '689897349449',
  appId: '1:689897349449:web:536599794579901beb7a98',
  measurementId: 'G-GTTPJ6G5MD'
};
const FIREBASE_COLLECTION = 'worldcupextra';
const FIREBASE_MATCHES_COLLECTION = 'worldcupextraMatches';
const FIREBASE_SECURE_FINISHED_COLLECTION = 'WoldCupSecureHT';
const WORLD_CUP_API_BASE = 'https://worldcup26.ir';
const SPORTSDB_API_BASE = 'https://www.thesportsdb.com/api/v1/json/123';
const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const API_FOOTBALL_KEY = '28fe67fa1477141ea513286716d04cd6';
const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const FOOTBALL_DATA_KEY = '92761a7be0594efc9686e0f3031d2709';
const HIGHLIGHTLY_BASE = 'https://api.highlightly.net/football';
const HIGHLIGHTLY_KEY = '5bc92d9d-077d-4e4c-be4a-403ae7f5792a';
const ALLSPORTS_BASE = 'https://apiv2.allsportsapi.com/football/';
const ALLSPORTS_KEY = 'dade46c3d79174fc03a9cc1e58b0cbcd0cef90cd9806260b407eaa645f8a042f';
const ZAFRONIX_WC_BASE = 'https://api.zafronix.com/fifa/worldcup/v1';
const ZAFRONIX_WC_KEY = 'zwc_free_4408ccc66492ac311b28addc';
const SOFASCORE_PROXY_URL = '';
const ESPN_PROXY_URL = '';
const API_SYNC_INTERVAL_MS = 30000;
const API_FOOTBALL_MIN_INTERVAL_MS = 90000;
const EXTRA_LIVE_API_MIN_INTERVAL_MS = 120000;
const API_FINISHED_MIN_DELAY_MS = 90 * 60 * 1000;
const API_FIRST_MINUTE_SCORE_CAP_MS = 60 * 1000;
const FIREBASE_SDK_VERSION = '10.14.1';
let firestoreDb = null;
let firebaseTools = null;
let votingDeadline = { raw: '', date: null, loaded: false, closed: false };
let closedPublicViewLoaded = false;
let worldCupApi = { games: [], groups: [], teams: [], stadiums: [], loaded: false, error: null, lastUpdate: null };
let liveLeftTab = 'live';
let liveRightTab = 'battles';
let liveSyncTimer = null;
let lastApiFootballFetchAt = 0;
let lastExtraLiveApiFetchAt = 0;
let ggamesTableSort = { key: 'default', direction: 'desc' };

const DEFAULT_SCORING_RULES = {
  groupExact: 3,
  groupOutcome: 1,
  knockoutInitialExact: 6,
  knockoutInitialWinner: 2,
  finalInitialExact: 8,
  finalInitialWinner: 4,
  finalInitialMethod: 2,
  knockoutReformExact: 2,
  finalReformExact: 3,
  reformExact32: 4,
  reformWinner32: 1,
  reformExact16: 4,
  reformWinner16: 1,
  reformExact8: 4,
  reformWinner8: 1,
  reformExact4: 5,
  reformWinner4: 2,
  reformExact3rd: 5,
  reformWinner3rd: 2,
  reformWinnerFinal: 2,
  initialExact32: 7,
  initialWinner32: 2,
  initialExact16: 7,
  initialWinner16: 2,
  initialExact8: 7,
  initialWinner8: 2,
  initialExact4: 9,
  initialWinner4: 3,
  initialExact3rd: 9,
  initialWinner3rd: 3,
  initialExactFinal: 11,
  initialWinnerFinal: 5
};
let scoringRules = { ...DEFAULT_SCORING_RULES };

function numericRule(name) {
  const value = Number(scoringRules?.[name]);
  return Number.isFinite(value) ? value : DEFAULT_SCORING_RULES[name];
}

function normalizeScoringRules(raw = {}) {
  const normalized = { ...DEFAULT_SCORING_RULES };
  Object.keys(DEFAULT_SCORING_RULES).forEach(key => {
    const value = Number(raw?.[key]);
    if (Number.isFinite(value) && value >= 0) normalized[key] = value;
  });
  return normalized;
}

async function loadScoringRules() {
  if (!firestoreDb || !firebaseTools) {
    scoringRules = { ...DEFAULT_SCORING_RULES };
    return scoringRules;
  }
  try {
    const ref = firebaseTools.doc(firestoreDb, 'settings', 'worldcupScoringRules');
    const snap = await firebaseTools.getDoc(ref);
    scoringRules = snap.exists() ? normalizeScoringRules(snap.data()) : { ...DEFAULT_SCORING_RULES };
  } catch (error) {
    console.warn('Não foi possível carregar as regras de pontuação. A usar valores padrão.', error);
    scoringRules = { ...DEFAULT_SCORING_RULES };
  }
  return scoringRules;
}

let data = null;
let squadsData = null;
let publicPredictions = [];
let officialResults = {};
let legacyOfficialResults = {};
let matchStateOfficialResults = {};
let secureOfficialResults = {};
let publicViewerStage = 'groups';
let publicGameFilter = 'played';
let closedMainTab = 'games';
let mobileAppSection = 'games';
let mobilePublicViewerHtml = '';
let mobilePublicViewerLoading = false;
let livePredictionFilters = {};
let apiLoadingRequests = 0;
let state = { name: '', predictions: {}, activeStage: 'groups', lastSaved: '' };

function firebaseMatchDocId(matchId) {
  return `match_${String(matchId).padStart(3, '0')}`;
}

function getMatchDateObj(match) {
  const date = String(match?.date || '').trim();
  const time = String(match?.time || '12:00').trim() || '12:00';
  if (!date) return new Date(NaN);
  return new Date(`${date}T${time}:00+01:00`);
}

function resultHasScore(result) {
  return !!result && result.homeGoals != null && result.awayGoals != null;
}

function isOfficialResultLive(result) {
  if (!result) return false;
  if (result.finished === true || result._finished === true || result.status === 'finished') return false;
  return !!(result.live === true || result._live === true || result.status === 'live');
}

function isOfficialResultFinished(result) {
  if (!result) return false;
  if (result.finished === true || result._finished === true || result.status === 'finished') return true;
  return !!(
    resultHasScore(result) &&
    !isOfficialResultLive(result) &&
    (result.status === 'official' || result.type === 'officialResult')
  );
}

function shouldTrackMatchDocAsOfficial(doc) {
  if (!doc) return false;
  const isLive = isOfficialResultLive(doc);
  const hasG = isLive 
    ? (doc.homeGoalsLive != null && doc.homeGoalsLive !== '') 
    : (doc.homeGoals != null && doc.homeGoals !== '');
  const hasAwayG = isLive 
    ? (doc.awayGoalsLive != null && doc.awayGoalsLive !== '') 
    : (doc.awayGoals != null && doc.awayGoals !== '');
  return (isLive || isOfficialResultFinished(doc) || (doc.homeGoals != null && doc.awayGoals != null)) && hasG && hasAwayG;
}

function normalizeMatchStateDoc(docId, raw = {}) {
  const matchId = Number(raw.matchId ?? String(docId || '').replace(/^match_/, ''));
  const editWinsOn = raw.editarwins === true || raw.editarwins === 'true' || raw.editarwins === 'on';
  const finishedManual =
    raw.finishedManual === true ? true :
    raw.finishedManual === false ? false :
    raw.finishedManual === 'true' ? true :
    raw.finishedManual === 'false' ? false :
    null;
  const effectiveFinished = editWinsOn && finishedManual !== null
    ? finishedManual
    : (raw.finished === true || raw.status === 'finished');
  const effectiveLive = editWinsOn && finishedManual !== null
    ? !finishedManual
    : (raw.live === true || raw.status === 'live');
  const isLive = !!effectiveLive && !effectiveFinished;
  const homeEdit = raw.HomeEdit;
  const awayEdit = raw.AwayEdit;
  const homeEditNumber = homeEdit == null || homeEdit === '' ? null : Number(homeEdit);
  const awayEditNumber = awayEdit == null || awayEdit === '' ? null : Number(awayEdit);
  const hasManualLiveEdit =
    (Number.isFinite(homeEditNumber) && homeEditNumber > 0) ||
    (Number.isFinite(awayEditNumber) && awayEditNumber > 0);
  const resolvedLiveHomeGoals = editWinsOn
    ? (Number.isFinite(homeEditNumber) ? homeEditNumber : null)
    : (hasManualLiveEdit
        ? (Number.isFinite(homeEditNumber) ? homeEditNumber : (raw.homeGoalsLive ?? raw.homeGoals ?? null))
        : (raw.homeGoalsLive ?? raw.homeGoals ?? null));
  const resolvedLiveAwayGoals = editWinsOn
    ? (Number.isFinite(awayEditNumber) ? awayEditNumber : null)
    : (hasManualLiveEdit
        ? (Number.isFinite(awayEditNumber) ? awayEditNumber : (raw.awayGoalsLive ?? raw.awayGoals ?? null))
        : (raw.awayGoalsLive ?? raw.awayGoals ?? null));
  return {
    id: docId,
    ...raw,
    matchId: Number.isFinite(matchId) ? matchId : null,
    documentId: raw.documentId || raw.matchDocId || docId,
    finished: effectiveFinished,
    live: isLive,
    status: effectiveFinished ? 'finished' : (isLive ? 'live' : raw.status),
    homeGoals: isLive ? resolvedLiveHomeGoals : (raw.homeGoals ?? raw.homeGoalsLive ?? null),
    awayGoals: isLive ? resolvedLiveAwayGoals : (raw.awayGoals ?? raw.awayGoalsLive ?? null)
  };
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

function resolveOfficialResultKickoffMs(matchId, official = null) {
  const key = String(matchId || official?.matchId || '').trim();
  const directKickoffMs = ggamesFirestoreTimestampToMillis(official?.kickoff);
  if (directKickoffMs) return directKickoffMs;

  const matchStateKickoffMs = ggamesFirestoreTimestampToMillis(matchStateOfficialResults?.[key]?.kickoff);
  if (matchStateKickoffMs) return matchStateKickoffMs;

  const secureKickoffMs = ggamesFirestoreTimestampToMillis(secureOfficialResults?.[key]?.kickoff);
  if (secureKickoffMs) return secureKickoffMs;

  const legacyKickoffMs = ggamesFirestoreTimestampToMillis(legacyOfficialResults?.[key]?.kickoff);
  if (legacyKickoffMs) return legacyKickoffMs;

  if (official?.date) {
    const dateMs = getMatchDateObj({ date: official.date, time: official.time || '12:00' }).getTime();
    if (!Number.isNaN(dateMs)) return dateMs;
  }

  const local = (data?.matches || []).find(m => String(m.id) === key);
  if (!local) return null;
  const localMs = getMatchDateObj({ date: local.date, time: local.time || '12:00' }).getTime();
  return Number.isNaN(localMs) ? null : localMs;
}

function canExposeOfficialResult(matchId, official = null) {
  if (!official) return false;
  const kickoffMs = resolveOfficialResultKickoffMs(matchId, official);
  if (kickoffMs == null) return true;
  return Date.now() >= kickoffMs;
}

function getVisibleOfficialResult(matchId) {
  const key = String(matchId);
  const official = officialResults[key] || null;
  return canExposeOfficialResult(key, official) ? official : null;
}

function mergeLiveGameWithFirestore(game) {
  const official = getVisibleOfficialResult(game?.id);
  if (!game || !official || !isOfficialResultLive(official)) return game;
  return {
    ...game,
    status: official.status || game.status,
    live: official.live === true || official.status === 'live',
    finished: official.finished === true || official.status === 'finished',
    homeGoals: official.homeGoals ?? game.homeGoals ?? null,
    awayGoals: official.awayGoals ?? game.awayGoals ?? null,
    homeGoalsLive: official.homeGoalsLive ?? game.homeGoalsLive ?? null,
    awayGoalsLive: official.awayGoalsLive ?? game.awayGoalsLive ?? null,
    timeElapsed: official.timeElapsed || game.timeElapsed,
    homeTeam: official.homeTeam || game.homeTeam,
    awayTeam: official.awayTeam || game.awayTeam
  };
}

function rebuildOfficialResults() {
  officialResults = Object.fromEntries([
    ...Object.entries(legacyOfficialResults),
    ...Object.entries(matchStateOfficialResults),
    ...Object.entries(secureOfficialResults)
  ]);
}

function applyLoadedOfficialSources(loaded = {}) {
  legacyOfficialResults = loaded.legacyOfficialByMatchId || {};
  matchStateOfficialResults = loaded.matchStateOfficialByMatchId || {};
  secureOfficialResults = loaded.secureOfficialByMatchId || {};
  rebuildOfficialResults();
}

function resolveMatchStateKickoffMs(matchDoc = {}) {
  const kickoffMs = ggamesFirestoreTimestampToMillis(matchDoc.kickoff);
  if (kickoffMs) return kickoffMs;
  if (matchDoc.date) {
    const dateMs = getMatchDateObj({ date: matchDoc.date, time: matchDoc.time || '12:00' }).getTime();
    if (!Number.isNaN(dateMs)) return dateMs;
  }
  const local = (data?.matches || []).find(m => String(m.id) === String(matchDoc.matchId));
  if (!local) return null;
  const localMs = getMatchDateObj({ date: local.date, time: local.time || '12:00' }).getTime();
  return Number.isNaN(localMs) ? null : localMs;
}

function shouldMirrorMatchStateDocToSecure(docId, raw = {}) {
  const normalized = normalizeMatchStateDoc(docId, raw);
  if (!normalized.matchId || !isOfficialResultFinished(normalized)) return false;
  const kickoffMs = resolveMatchStateKickoffMs({ ...raw, matchId: normalized.matchId });
  // A partir das 3 horas de jogo em diante: se a app "acordar" mais tarde, ainda espelha.
  return kickoffMs != null && Date.now() >= kickoffMs + (3 * 60 * 60 * 1000);
}

function buildSecureFinishedPayload(docId, raw = {}) {
  const normalized = normalizeMatchStateDoc(docId, raw);
  return {
    documentId: raw.documentId || raw.matchDocId || docId,
    matchDocId: raw.matchDocId || docId,
    matchId: normalized.matchId,
    homeTeam: raw.homeTeam || normalized.homeTeam || null,
    awayTeam: raw.awayTeam || normalized.awayTeam || null,
    stage: raw.stage || normalized.stage || null,
    stageLabel: raw.stageLabel || normalized.stageLabel || null,
    group: raw.group || normalized.group || null,
    date: raw.date || normalized.date || null,
    time: raw.time || normalized.time || null,
    timezone: raw.timezone || normalized.timezone || null,
    city: raw.city || normalized.city || null,
    country: raw.country || normalized.country || null,
    venue: raw.venue || normalized.venue || null,
    kickoff: raw.kickoff || null,
    kickoffIso: raw.kickoffIso || null,
    status: 'finished',
    finished: true,
    live: false,
    homeGoals: normalized.homeGoals ?? raw.homeGoals ?? null,
    awayGoals: normalized.awayGoals ?? raw.awayGoals ?? null,
    winnerTeam: raw.winnerTeam || normalized.winnerTeam || null,
    timeElapsed: 'FT'
  };
}

function secureFinishedPayloadMatches(existing = {}, payload = {}) {
  const sameNumberOrNull = (a, b) => {
    const left = a == null || a === '' ? null : Number(a);
    const right = b == null || b === '' ? null : Number(b);
    return left === right;
  };
  return (
    String(existing.matchId || '') === String(payload.matchId || '') &&
    String(existing.status || '') === String(payload.status || '') &&
    !!existing.finished === !!payload.finished &&
    !!existing.live === !!payload.live &&
    sameNumberOrNull(existing.homeGoals, payload.homeGoals) &&
    sameNumberOrNull(existing.awayGoals, payload.awayGoals) &&
    sameNumberOrNull(existing.homeGoalsLive, payload.homeGoalsLive) &&
    sameNumberOrNull(existing.awayGoalsLive, payload.awayGoalsLive) &&
    String(existing.timeElapsed || '') === String(payload.timeElapsed || '')
  );
}

const secureMirrorInFlight = new Set();

async function syncMatchStateDocToSecureCollection(docId, raw = {}) {
  if (!firestoreDb || !firebaseTools || !firebaseTools.getDoc || !firebaseTools.setDoc) return;
  if (!shouldMirrorMatchStateDocToSecure(docId, raw)) return;

  const syncKey = String(docId);
  if (secureMirrorInFlight.has(syncKey)) return;
  secureMirrorInFlight.add(syncKey);

  try {
    const payload = buildSecureFinishedPayload(docId, raw);
    const ref = firebaseTools.doc(firestoreDb, FIREBASE_SECURE_FINISHED_COLLECTION, syncKey);
    const snap = await firebaseTools.getDoc(ref);
    // WoldCupSecureHT é write-once: se o documento já existir, nunca mais o alteramos aqui.
    if (snap.exists()) return;
    await firebaseTools.setDoc(ref, payload);
  } catch (error) {
    console.warn('Nao foi possivel espelhar o resultado final para a colecao segura.', error);
  } finally {
    secureMirrorInFlight.delete(syncKey);
  }
}

async function loadOfficialMatchStateDocs() {
  if (!firestoreDb || !firebaseTools) return {};
  const collectionRef = firebaseTools.collection(firestoreDb, FIREBASE_COLLECTION);
  const matchesCollectionRef = firebaseTools.collection(firestoreDb, FIREBASE_MATCHES_COLLECTION);
  const secureCollectionRef = firebaseTools.collection(firestoreDb, FIREBASE_SECURE_FINISHED_COLLECTION);
  let legacySnapshot;
  let matchesSnapshot = null;
  let secureSnapshot = null;
  try {
    legacySnapshot = await firebaseTools.getDocs(firebaseTools.query(collectionRef, firebaseTools.orderBy('clientTimestamp', 'desc')));
  } catch {
    legacySnapshot = await firebaseTools.getDocs(collectionRef);
  }
  try {
    matchesSnapshot = await firebaseTools.getDocs(matchesCollectionRef);
  } catch (error) {
    console.warn('Nao foi possivel carregar worldcupextraMatches. A usar fallback legacy.', error);
  }
  try {
    secureSnapshot = await firebaseTools.getDocs(secureCollectionRef);
  } catch (error) {
    console.warn('Nao foi possivel carregar WoldCupSecureHT. A usar fallback de resultados finais.', error);
  }

  const allDocs = legacySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const legacyOfficialDocs = allDocs
    .filter(doc => doc.status === 'official' || doc.type === 'officialResult')
    .filter(doc => doc.matchId != null || doc.id?.startsWith?.('official-match-'))
    .map(doc => [String(doc.matchId ?? String(doc.id).replace('official-match-', '')), { ...doc, _officialSource: 'firestore' }]);
  const matchStateDocs = (matchesSnapshot?.docs || [])
    .map(doc => {
      const normalized = normalizeMatchStateDoc(doc.id, doc.data());
      return [String(normalized.matchId), { ...normalized, _officialSource: 'firestore' }];
    })
    .filter(([, doc]) => shouldTrackMatchDocAsOfficial(doc));
  const secureDocs = (secureSnapshot?.docs || [])
    .map(doc => {
      const normalized = normalizeMatchStateDoc(doc.id, doc.data());
      return [String(normalized.matchId), { ...normalized, _officialSource: 'secure-firestore' }];
    })
    .filter(([, doc]) => shouldTrackMatchDocAsOfficial(doc));
  return {
    allDocs,
    legacyOfficialByMatchId: Object.fromEntries(legacyOfficialDocs),
    matchStateOfficialByMatchId: Object.fromEntries(matchStateDocs),
    secureOfficialByMatchId: Object.fromEntries(secureDocs),
    officialByMatchId: Object.fromEntries([...legacyOfficialDocs, ...matchStateDocs, ...secureDocs])
  };
}

const $ = (selector) => document.querySelector(selector);

function hideLoadingScreen() {
  document.body.classList.remove('app-loading');
  const loading = $('#loadingScreen');
  if (loading) {
    loading.setAttribute('aria-busy', 'false');
    loading.classList.add('is-hidden');
  }
}

function setApiLoadingNotice(visible, message = 'As informacoes estao a ser carregadas...') {
  const notice = $('#apiLoadingNotice');
  if (!notice) return;
  notice.hidden = !visible;
  notice.setAttribute('aria-busy', visible ? 'true' : 'false');
  if (visible) notice.textContent = message;
}

function loadState() {
  const savedV2 = localStorage.getItem(STORE_KEY);
  const savedV1 = localStorage.getItem('mundial2026_prognosticos_v1');
  const saved = savedV2 || savedV1;
  if (saved) {
    try { state = { ...state, ...JSON.parse(saved) }; }
    catch { console.warn('Não foi possível carregar os dados guardados.'); }
  }
}

function saveState() {
  state.lastSaved = new Date().toLocaleString('pt-PT');
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  updateSummary();
}

function dateTitle(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(date);
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));
}


const CUSTOM_PLAYER_ICONS = {
  lion: { label: 'Leão', bg1: '#f59e0b', bg2: '#7c2d12', glyph: '<path d="M26 25l7-9 9 5 9-5 7 9-4 27H30z"/><path d="M31 33c2-7 7-11 11-11s9 4 11 11"/><circle cx="37" cy="38" r="2.2"/><circle cx="47" cy="38" r="2.2"/><path d="M39 44l3 3 3-3"/><path d="M36 49c4 2 8 2 12 0"/>' },
  wave: { label: 'Água', bg1: '#38bdf8', bg2: '#1d4ed8', glyph: '<path d="M18 46c6 0 6-7 12-7s6 7 12 7 6-7 12-7 6 7 12 7"/><path d="M18 35c6 0 6-7 12-7s6 7 12 7 6-7 12-7 6 7 12 7"/><path d="M42 18c6 7 6 12 0 18-6-6-6-11 0-18z"/>' },
  buffalo: { label: 'Búfalo', bg1: '#92400e', bg2: '#2d1606', glyph: '<path d="M18 27c8 0 9-10 18-10v7c3-3 6-5 8-5s5 2 8 5v-7c9 0 10 10 18 10-4 2-7 6-8 10H26c-1-4-4-8-8-10z"/><path d="M28 37h28l-3 17H31z"/><circle cx="38" cy="41" r="2.2"/><circle cx="46" cy="41" r="2.2"/><path d="M39 49h6"/>' },
  elephant: { label: 'Elefante', bg1: '#94a3b8', bg2: '#334155', glyph: '<path d="M23 34c0-10 8-16 19-16h1c11 0 19 6 19 16v8c0 6-4 11-10 13v7h-9v-8h-2c-10 0-18-8-18-18z"/><path d="M42 35c0 5 3 7 7 9 5 2 7 5 7 9 0 3-2 6-4 8"/><path d="M33 33c2 2 4 3 6 3"/><circle cx="35" cy="30" r="2.2"/><path d="M33 42l-3 5m24-5l3 5"/>' },
  tiger: { label: 'Tigre', bg1: '#fb923c', bg2: '#7c2d12', glyph: '<path d="M24 27l8-10 8 7 2-6 2 6 8-7 8 10-4 27H28z"/><path d="M31 30l3 9m8-13v16m11-12l-3 9"/><circle cx="37" cy="39" r="2.2"/><circle cx="47" cy="39" r="2.2"/><path d="M39 44l3 3 3-3"/><path d="M37 49c4 2 8 2 10 0"/>' },
  hyena: { label: 'Hiena', bg1: '#a16207', bg2: '#3f2a0f', glyph: '<path d="M25 29l7-10 7 4 5-3 7 3 8-4 5 10-4 24H29z"/><circle cx="37" cy="38" r="2.2"/><circle cx="47" cy="37" r="2.2"/><path d="M37 47c4 3 10 3 14 0"/><path d="M35 48l4-1m4 1l4-1m4 1l4-1"/><path d="M31 33l-3 3m26-4l4 3"/>' },
  boa: { label: 'Jiboia', bg1: '#22c55e', bg2: '#14532d', glyph: '<path d="M22 44c0-8 5-13 12-13 6 0 8 4 8 7s-2 7-8 7c-4 0-6 3-6 6 0 3 3 5 6 5h16c7 0 12-5 12-11 0-7-5-12-12-12-4 0-7 2-9 5"/><circle cx="25" cy="44" r="5"/><circle cx="23.5" cy="43" r="1.4"/><circle cx="26.5" cy="43" r="1.4"/><path d="M25 48v5"/>' },
  gator: { label: 'Jacaré', bg1: '#16a34a', bg2: '#14532d', glyph: '<path d="M17 41c8-10 18-15 31-15 6 0 12 1 19 4-7 3-12 7-15 13l-24 1c-4 0-8-1-11-3z"/><path d="M36 33h21"/><path d="M42 38h18"/><path d="M47 44l3 3 3-3 3 3 3-3"/><circle cx="32" cy="31" r="2"/>' },
  hippo: { label: 'Hipopótamo', bg1: '#64748b', bg2: '#1e293b', glyph: '<path d="M19 36c0-11 10-18 23-18s23 7 23 18v6c0 7-5 12-12 12H31c-7 0-12-5-12-12z"/><path d="M27 39h30v11H27z"/><circle cx="37" cy="33" r="2.2"/><circle cx="47" cy="33" r="2.2"/><circle cx="37" cy="44" r="1.8"/><circle cx="47" cy="44" r="1.8"/>' },
  eagle: { label: 'Águia', bg1: '#fbbf24', bg2: '#78350f', glyph: '<path d="M22 44c7-12 16-19 29-19 7 0 12 2 18 7-5 1-8 3-12 7l-5 6H31z"/><path d="M50 35l12 2-8 6"/><circle cx="39" cy="31" r="2.1"/><path d="M25 48l8-7m10 4l8-6"/>' },
  wolf: { label: 'Lobo', bg1: '#cbd5e1', bg2: '#334155', glyph: '<path d="M24 28l8-12 8 9 2-7 2 7 8-9 8 12-5 25H29z"/><circle cx="37" cy="39" r="2.2"/><circle cx="47" cy="39" r="2.2"/><path d="M39 45l3-3 3 3"/><path d="M36 50c5 2 9 2 12 0"/>' },
  rhino: { label: 'Rinoceronte', bg1: '#9ca3af', bg2: '#374151', glyph: '<path d="M20 42c0-9 8-16 21-16 9 0 16 2 24 8l-8 3v13H30c-6 0-10-3-10-8z"/><path d="M57 30l9-8-2 10"/><circle cx="34" cy="31" r="2.1"/><path d="M29 50h19"/>' },
  cobra: { label: 'Cobra', bg1: '#10b981', bg2: '#064e3b', glyph: '<path d="M42 17c10 0 18 7 18 17 0 8-5 13-12 16v9H36v-9c-7-3-12-8-12-16 0-10 8-17 18-17z"/><circle cx="36" cy="32" r="2.1"/><circle cx="48" cy="32" r="2.1"/><path d="M42 38v10"/><path d="M42 48l-2 4m2-4l2 4"/>' },
  shark: { label: 'Tubarão', bg1: '#38bdf8', bg2: '#0f172a', glyph: '<path d="M15 43c8-11 18-17 32-17 6 0 12 2 18 5l7 2-7 4 7 6c-6 3-12 5-18 5-14 0-24-5-32-13z"/><path d="M39 27l8-12 5 13"/><path d="M23 43l-8-7v14z"/><circle cx="47" cy="35" r="2"/><path d="M54 42c-4 2-8 3-13 3"/>' },
  falcon: { label: 'Falcão', bg1: '#60a5fa', bg2: '#172554', glyph: '<path d="M20 46c7-14 17-22 29-22 8 0 13 2 19 7l-14 3-5 8-6 7H27z"/><path d="M49 34l13 2-7 5"/><circle cx="39" cy="30" r="2"/><path d="M32 48l8-7"/>' },
  panther: { label: 'Pantera', bg1: '#475569', bg2: '#020617', glyph: '<path d="M24 28l8-11 8 8 2-6 2 6 8-8 8 11-5 26H29z"/><circle cx="37" cy="39" r="2.2"/><circle cx="47" cy="39" r="2.2"/><path d="M39 45l3 2 3-2"/><path d="M36 50c4 1 8 1 12 0"/>' },
  bear: { label: 'Urso', bg1: '#92400e', bg2: '#422006', glyph: '<circle cx="31" cy="25" r="5"/><circle cx="53" cy="25" r="5"/><path d="M22 37c0-11 9-18 20-18s20 7 20 18v6c0 6-5 11-11 11H33c-6 0-11-5-11-11z"/><circle cx="37" cy="36" r="2.2"/><circle cx="47" cy="36" r="2.2"/><path d="M39 44l3 2 3-2"/>' },
  fox: { label: 'Raposa', bg1: '#f97316', bg2: '#7c2d12', glyph: '<path d="M22 28l10-12 10 10 10-10 10 12-8 26H30z"/><circle cx="37" cy="38" r="2.2"/><circle cx="47" cy="38" r="2.2"/><path d="M39 45l3 3 3-3"/><path d="M34 50l8-5 8 5"/>' },
  owl: { label: 'Coruja', bg1: '#8b5cf6', bg2: '#312e81', glyph: '<path d="M27 25l7-8 8 7 8-7 7 8v23c0 4-3 7-7 7H34c-4 0-7-3-7-7z"/><circle cx="36" cy="35" r="5"/><circle cx="48" cy="35" r="5"/><circle cx="36" cy="35" r="1.8"/><circle cx="48" cy="35" r="1.8"/><path d="M42 42l-3 4h6z"/>' },
  bull: { label: 'Touro', bg1: '#ef4444', bg2: '#450a0a', glyph: '<path d="M18 27c8 0 10-10 19-10v7c2-3 4-4 5-4s3 1 5 4v-7c9 0 11 10 19 10-5 2-8 6-9 10H27c-1-4-4-8-9-10z"/><path d="M28 37h28l-4 17H32z"/><circle cx="38" cy="41" r="2.2"/><circle cx="46" cy="41" r="2.2"/><path d="M39 49h6"/>' }
};

const CUSTOM_PLAYER_ICON_KEYS = Object.keys(CUSTOM_PLAYER_ICONS);
const CUSTOM_PLAYER_ICON_ALIASES = {
  leao: 'lion', 'leão': 'lion', agua: 'wave', 'água': 'wave', bufalo: 'buffalo', 'búfalo': 'buffalo',
  elefante: 'elephant', tigre: 'tiger', hiena: 'hyena', jiboia: 'boa', jibóia: 'boa',
  jacare: 'gator', jacaré: 'gator', hipopotamo: 'hippo', hipopótamo: 'hippo', aguia: 'eagle', 'águia': 'eagle',
  lobo: 'wolf', rinoceronte: 'rhino', cobra: 'cobra', tubarao: 'shark', tubarão: 'shark',
  falcao: 'falcon', falcão: 'falcon', pantera: 'panther', urso: 'bear', raposa: 'fox', coruja: 'owl', touro: 'bull'
};

function autoIconKeyFromName(name) {
  const text = String(name || 'Participante').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return CUSTOM_PLAYER_ICON_KEYS[Math.abs(hash) % CUSTOM_PLAYER_ICON_KEYS.length] || 'lion';
}

function normalizeIconKey(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/^fa-/, '').replace(/\s+/g, '-').replace(/_/g, '-');
  return CUSTOM_PLAYER_ICON_ALIASES?.[raw] || raw;
}

function participantIconKey(source) {
  if (!source) return '';
  if (typeof source === 'string') return normalizeIconKey(source);
  return normalizeIconKey(source.icon || source.participantIcon || source.playerIcon || source.animalIcon || '');
}

function participantIconMeta(key) {
  const normalized = participantIconKey(key);
  return CUSTOM_PLAYER_ICONS[normalized] || null;
}

function renderParticipantIcon(iconKey, label = '') {
  const normalized = participantIconKey(iconKey);
  const meta = participantIconMeta(normalized);

  // IMPORTANTE: a Tabela/Battles só mostram ícone quando vem do campo `icon` do Firebase.
  // Se o campo não existir ou estiver mal escrito, não inventa animal aleatório.
  if (!meta) return '';

  return `<span class="participant-icon participant-icon--svg" title="${escapeHtml(meta.label)}" aria-hidden="true">
    <svg viewBox="0 0 84 84" role="img" focusable="false">
      <defs><linearGradient id="grad-${normalized}" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="${meta.bg1}"/><stop offset="100%" stop-color="${meta.bg2}"/></linearGradient></defs>
      <rect x="4" y="4" width="76" height="76" rx="24" fill="url(#grad-${normalized})"/>
      <circle cx="42" cy="42" r="31" fill="rgba(255,255,255,.08)"/>
      <g fill="none" stroke="#f8fbff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${meta.glyph}</g>
    </svg>
  </span>`;
}

function renderParticipantIdentity(name, iconKey, extraClass = '') {
  const iconHtml = renderParticipantIcon(iconKey, name);
  const hasIcon = iconHtml ? ' has-icon' : ' no-icon';
  return `<span class="participant-ident ${extraClass}${hasIcon}">${iconHtml}<span class="participant-ident__name">${escapeHtml(name || 'Participante')}</span></span>`;
}

function getPrediction(id) {
  return state.predictions[String(id)] || { homeGoals: '', awayGoals: '', method: '', winner: '' };
}

function isFilledScore(p) {
  return p && p.homeGoals !== '' && p.awayGoals !== '' && !Number.isNaN(Number(p.homeGoals)) && !Number.isNaN(Number(p.awayGoals));
}

function isKnockout(match) {
  return match.stage !== 'groups';
}

function scoreState(pred) {
  if (!isFilledScore(pred)) return { filled: false, tied: false, home: null, away: null };
  const home = Number(pred.homeGoals);
  const away = Number(pred.awayGoals);
  return { filled: true, tied: home === away, home, away };
}

function isPredictionComplete(match, pred) {
  if (!isFilledScore(pred)) return false;
  if (!isKnockout(match)) return true;

  const score = scoreState(pred);
  if (!score.tied) return true;
  return (pred.method === 'et' || pred.method === 'pens') && !!pred.winner;
}

function groupMatches() {
  return data.matches.filter(m => m.stage === 'groups');
}

function teamsByGroup() {
  const groups = {};
  groupMatches().forEach(match => {
    groups[match.group] ||= new Set();
    groups[match.group].add(match.home);
    groups[match.group].add(match.away);
  });
  return Object.fromEntries(Object.entries(groups).map(([group, teams]) => [group, [...teams]]));
}

function blankTeam(name, group) {
  return { team: name, group, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 };
}

function calculateStandings() {
  const byGroup = teamsByGroup();
  const tables = {};

  Object.entries(byGroup).forEach(([group, teams]) => {
    const stats = Object.fromEntries(teams.map(team => [team, blankTeam(team, group)]));

    groupMatches().filter(m => m.group === group).forEach(match => {
      const p = getPrediction(match.id);
      if (!isFilledScore(p)) return;
      const hg = Number(p.homeGoals);
      const ag = Number(p.awayGoals);
      const home = stats[match.home];
      const away = stats[match.away];

      home.played++; away.played++;
      home.gf += hg; home.ga += ag;
      away.gf += ag; away.ga += hg;

      if (hg > ag) { home.wins++; away.losses++; home.points += 3; }
      else if (ag > hg) { away.wins++; home.losses++; away.points += 3; }
      else { home.draws++; away.draws++; home.points++; away.points++; }
    });

    Object.values(stats).forEach(t => { t.gd = t.gf - t.ga; });
    tables[group] = sortGroupTable(Object.values(stats), group).map((t, i) => ({ ...t, position: i + 1 }));
  });

  return tables;
}

function miniTableForTeams(teamNames, group) {
  const stats = Object.fromEntries(teamNames.map(team => [team, blankTeam(team, group)]));
  groupMatches().filter(m => m.group === group && teamNames.includes(m.home) && teamNames.includes(m.away)).forEach(match => {
    const p = getPrediction(match.id);
    if (!isFilledScore(p)) return;
    const hg = Number(p.homeGoals);
    const ag = Number(p.awayGoals);
    const home = stats[match.home];
    const away = stats[match.away];

    home.played++; away.played++;
    home.gf += hg; home.ga += ag;
    away.gf += ag; away.ga += hg;

    if (hg > ag) { home.wins++; away.losses++; home.points += 3; }
    else if (ag > hg) { away.wins++; home.losses++; away.points += 3; }
    else { home.draws++; away.draws++; home.points++; away.points++; }
  });
  Object.values(stats).forEach(t => { t.gd = t.gf - t.ga; });
  return stats;
}

function compareBasic(a, b) {
  return (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf) || (b.wins - a.wins) || a.team.localeCompare(b.team, 'pt-PT');
}

function sortGroupTable(rows, group) {
  const basicSorted = [...rows].sort(compareBasic);

  // Desempate aproximado FIFA: depois de pontos, diferença de golos e golos marcados, aplica confronto direto
  // entre equipas ainda empatadas nesses três critérios. Fair play/sorteio não existem no prognóstico, por isso o nome desempata no fim.
  const result = [];
  let i = 0;
  while (i < basicSorted.length) {
    const tied = [basicSorted[i]];
    let j = i + 1;
    while (j < basicSorted.length &&
      basicSorted[j].points === basicSorted[i].points &&
      basicSorted[j].gd === basicSorted[i].gd &&
      basicSorted[j].gf === basicSorted[i].gf) {
      tied.push(basicSorted[j]);
      j++;
    }

    if (tied.length > 1) {
      const h2h = miniTableForTeams(tied.map(t => t.team), group);
      tied.sort((a, b) => {
        const ha = h2h[a.team];
        const hb = h2h[b.team];
        return (hb.points - ha.points) || (hb.gd - ha.gd) || (hb.gf - ha.gf) || (b.wins - a.wins) || a.team.localeCompare(b.team, 'pt-PT');
      });
    }

    result.push(...tied);
    i = j;
  }
  return result;
}

function getBestThirds(tables) {
  const thirds = GROUPS.map(group => tables[group]?.[2]).filter(Boolean);
  return thirds.sort(compareBasic).map((team, index) => ({ ...team, thirdRank: index + 1, qualifiedThird: index < 8 }));
}

function getQualified(tables) {
  const q = { first: {}, second: {}, third: {}, bestThirds: [] };
  GROUPS.forEach(group => {
    q.first[group] = tables[group]?.[0] || null;
    q.second[group] = tables[group]?.[1] || null;
    q.third[group] = tables[group]?.[2] || null;
  });
  q.bestThirds = getBestThirds(tables);
  q.bestThirdGroups = q.bestThirds.filter(t => t.qualifiedThird).map(t => t.group);
  q.thirdSlotMap = assignThirdSlots(q.bestThirds.filter(t => t.qualifiedThird));
  return q;
}

function parseThirdGroups(label) {
  const match = String(label).match(/3\.º Grupo ([A-L](?:\/[A-L])*)/);
  return match ? match[1].split('/') : [];
}

function thirdSlotsFromMatches() {
  const slots = [];
  data.matches.filter(m => m.stage === 'round32').forEach(match => {
    ['home', 'away'].forEach(side => {
      const allowed = parseThirdGroups(match[side]);
      if (allowed.length) slots.push({ key: `${match.id}:${side}`, matchId: match.id, side, allowed });
    });
  });
  return slots;
}

function assignThirdSlots(qualifiedThirds) {
  const groups = qualifiedThirds.map(t => t.group);
  const sortedGroupsStr = [...groups].sort().join('');

  // Override for the official qualified third-placed groups combination (B, D, E, F, H, I, J, K)
  if (sortedGroupsStr === 'BDEFHIJK') {
    return {
      '74:away': 'D', // Paraguai
      '77:away': 'F', // Suécia
      '79:away': 'E', // Equador
      '80:away': 'K', // RD Congo
      '81:away': 'I', // Senegal
      '82:away': 'B', // Bósnia
      '85:away': 'J', // Argélia
      '87:away': 'H'  // Cabo Verde
    };
  }

  // Override for the alternative combination with Group L (B, D, E, F, I, J, K, L)
  if (sortedGroupsStr === 'BDEFIJKL') {
    return {
      '74:away': 'D', // Paraguai
      '77:away': 'F', // Suécia
      '79:away': 'E', // Equador
      '80:away': 'K', // RD Congo
      '81:away': 'I', // Senegal
      '82:away': 'B', // Bósnia
      '85:away': 'J', // Argélia
      '84:away': 'L'  // Croácia
    };
  }

  const thirdByGroup = Object.fromEntries(qualifiedThirds.map(t => [t.group, t]));
  const slots = thirdSlotsFromMatches().map(slot => ({
    ...slot,
    candidates: slot.allowed.filter(group => groups.includes(group))
  }));

  const sortedSlots = [...slots].sort((a, b) => a.candidates.length - b.candidates.length);
  const used = new Set();
  const assignment = {};

  function backtrack(index) {
    if (index === sortedSlots.length) return true;
    const slot = sortedSlots[index];
    const candidates = [...slot.candidates].sort((a, b) => thirdByGroup[a].thirdRank - thirdByGroup[b].thirdRank);
    for (const group of candidates) {
      if (used.has(group)) continue;
      used.add(group);
      assignment[slot.key] = group;
      if (backtrack(index + 1)) return true;
      used.delete(group);
      delete assignment[slot.key];
    }
    return false;
  }

  backtrack(0);
  return assignment;
}

function resolveStandingLabel(label, q, matchId = null, side = null) {
  const text = String(label);
  let match = text.match(/^(1|2)\.º Grupo ([A-L])$/);
  if (match) {
    const pos = match[1] === '1' ? 'first' : 'second';
    return q[pos][match[2]]?.team || text;
  }

  match = text.match(/^3\.º Grupo/);
  if (match && matchId && side) {
    const group = q.thirdSlotMap[`${matchId}:${side}`];
    const team = group ? q.third[group]?.team : null;
    return team || text;
  }

  match = text.match(/^Vencedor Jogo (\d+)$/);
  if (match) {
    const previous = data.matches.find(m => String(m.id) === match[1]);
    if (!previous) return text;
    const pred = getPrediction(previous.id);
    if (!pred.winner) return text;
    return resolveTeam(previous, pred.winner, q);
  }

  match = text.match(/^Perdedor Jogo (\d+)$/);
  if (match) {
    const previous = data.matches.find(m => String(m.id) === match[1]);
    if (!previous) return text;
    const pred = getPrediction(previous.id);
    if (!pred.winner) return text;
    return resolveTeam(previous, pred.winner === 'home' ? 'away' : 'home', q);
  }

  return text;
}

function getTournamentContext() {
  const tables = calculateStandings();
  const qualified = getQualified(tables);
  return { tables, qualified };
}

function resolveTeam(match, side, q = null) {
  const context = q ? { qualified: q } : getTournamentContext();
  return resolveStandingLabel(match[side], context.qualified, match.id, side);
}

function winnerOptions(match, pred, q) {
  const home = resolveTeam(match, 'home', q);
  const away = resolveTeam(match, 'away', q);
  return [
    `<option value="">Escolher vencedor</option>`,
    `<option value="home" ${pred.winner === 'home' ? 'selected' : ''}>${escapeHtml(home)}</option>`,
    `<option value="away" ${pred.winner === 'away' ? 'selected' : ''}>${escapeHtml(away)}</option>`
  ].join('');
}

function teamButton(name) {
  return `<button type="button" class="team-link" data-team="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
}

