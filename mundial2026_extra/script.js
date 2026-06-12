
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
const WORLD_CUP_API_BASE = 'https://worldcup26.ir';
const SPORTSDB_API_BASE = 'https://www.thesportsdb.com/api/v1/json/123';
const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const API_FOOTBALL_KEY = 'COLOCA_AQUI_A_TUA_KEY';
const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const FOOTBALL_DATA_KEY = 'COLOCA_AQUI_A_TUA_KEY';
const HIGHLIGHTLY_BASE = 'https://api.highlightly.net/football';
const HIGHLIGHTLY_KEY = 'COLOCA_AQUI_A_TUA_KEY';
const ALLSPORTS_BASE = 'https://apiv2.allsportsapi.com/football/';
const ALLSPORTS_KEY = 'COLOCA_AQUI_A_TUA_KEY';
const SOFASCORE_PROXY_URL = ''; // opcional: proxy teu para evitar CORS, ex: https://teusite.com/api/sofascore
const ESPN_PROXY_URL = ''; // opcional: proxy teu para evitar CORS, ex: https://teusite.com/api/espn
const API_SYNC_INTERVAL_MS = 30000;
const API_FOOTBALL_MIN_INTERVAL_MS = 90000;
const EXTRA_LIVE_API_MIN_INTERVAL_MS = 120000;
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
  finalReformExact: 3
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
let publicViewerStage = 'groups';
let publicGameFilter = 'played';
let closedMainTab = 'games';
let mobileAppSection = 'games';
let mobilePublicViewerHtml = '';
let mobilePublicViewerLoading = false;
let apiLoadingRequests = 0;
let state = { name: '', predictions: {}, activeStage: 'groups', lastSaved: '' };

function firebaseMatchDocId(matchId) {
  return `match_${String(matchId).padStart(3, '0')}`;
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
  return isOfficialResultLive(doc) || isOfficialResultFinished(doc) || resultHasScore(doc);
}

function normalizeMatchStateDoc(docId, raw = {}) {
  const matchId = Number(raw.matchId ?? String(docId || '').replace(/^match_/, ''));
  return {
    id: docId,
    ...raw,
    matchId: Number.isFinite(matchId) ? matchId : null,
    documentId: raw.documentId || raw.matchDocId || docId
  };
}

async function loadOfficialMatchStateDocs() {
  if (!firestoreDb || !firebaseTools) return {};
  const collectionRef = firebaseTools.collection(firestoreDb, FIREBASE_COLLECTION);
  const matchesCollectionRef = firebaseTools.collection(firestoreDb, FIREBASE_MATCHES_COLLECTION);
  let legacySnapshot;
  let matchesSnapshot = null;
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

  const allDocs = legacySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const legacyOfficialDocs = allDocs
    .filter(doc => doc.status === 'official' || doc.type === 'officialResult')
    .filter(doc => doc.matchId != null || doc.id?.startsWith?.('official-match-'))
    .map(doc => [String(doc.matchId ?? String(doc.id).replace('official-match-', '')), doc]);
  const matchStateDocs = (matchesSnapshot?.docs || [])
    .map(doc => normalizeMatchStateDoc(doc.id, doc.data()))
    .filter(shouldTrackMatchDocAsOfficial)
    .map(doc => [String(doc.matchId), doc]);
  return {
    allDocs,
    officialByMatchId: Object.fromEntries([...legacyOfficialDocs, ...matchStateDocs])
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
  const thirdByGroup = Object.fromEntries(qualifiedThirds.map(t => [t.group, t]));
  const groups = qualifiedThirds.map(t => t.group);
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

function renderMatch(match, context = null) {
  const ctx = context || getTournamentContext();
  const pred = getPrediction(match.id);
  const ko = isKnockout(match);
  const score = scoreState(pred);
  const needsDecision = ko && score.filled && score.tied;
  const homeName = ko ? resolveTeam(match, 'home', ctx.qualified) : match.home;
  const awayName = ko ? resolveTeam(match, 'away', ctx.qualified) : match.away;
  const autoWinnerLabel = ko && score.filled && !score.tied
    ? (score.home > score.away ? homeName : awayName)
    : '';
  const originalLabel = ko && (homeName !== match.home || awayName !== match.away)
    ? `<span class="path-label">${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</span>`
    : '';

  return `
    <article class="match-card match-card-clickable" data-match-id="${match.id}" title="Clica no jogo para ver o relvado e os 11 prováveis">
      <div class="match-no">
        <span class="badge">Jogo ${match.id}</span>
        ${match.group ? `<span>Grupo ${match.group}</span>` : `<span>${STAGE_LABELS[match.stage]}</span>`}
      </div>
      <div class="teams">
        <strong>${teamButton(homeName)} <span class="muted-inline">vs</span> ${teamButton(awayName)}</strong>
        ${originalLabel}
        <span class="meta">${escapeHtml(match.time || 'Hora a definir')} · ${escapeHtml(match.venue)} · ${escapeHtml(match.city)}, ${escapeHtml(match.country)}</span>
        <span class="hint-line">Clica no jogo para ver relvado, 11 provável, suplentes e treinador.</span>
      </div>
      <div class="prediction">
        <div class="score-row">
          <span>${escapeHtml(homeName)}</span>
          <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-field="homeGoals" value="${escapeHtml(pred.homeGoals)}" aria-label="Golos ${escapeHtml(homeName)}">
          <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-field="awayGoals" value="${escapeHtml(pred.awayGoals)}" aria-label="Golos ${escapeHtml(awayName)}">
          <span>${escapeHtml(awayName)}</span>
        </div>
        ${ko && autoWinnerLabel ? `<div class="auto-winner">Vencedor automático: <strong>${escapeHtml(autoWinnerLabel)}</strong> <span>nos 90'</span></div>` : ''}
        ${needsDecision ? `
          <div class="ko-row">
            <select data-field="method" aria-label="Método de decisão">
              <option value="" ${!pred.method || pred.method === '90' ? 'selected' : ''}>Como foi decidido?</option>
              <option value="et" ${pred.method === 'et' ? 'selected' : ''}>Prolongamento</option>
              <option value="pens" ${pred.method === 'pens' ? 'selected' : ''}>Penáltis</option>
            </select>
            <select data-field="winner" aria-label="Vencedor">
              ${winnerOptions(match, pred, ctx.qualified)}
            </select>
          </div>
          <span class="error">Como há empate, escolhe se foi decidido no prolongamento ou nos penáltis e indica o vencedor.</span>
        ` : ''}
      </div>
    </article>
  `;
}

function getTeamSquad(teamName) {
  return squadsData?.teams?.[teamName] || null;
}

function getPlayer(teamName, playerId) {
  const squad = getTeamSquad(teamName);
  return squad?.players?.find(p => p.id === playerId) || null;
}

function playerPhoto(player) {
  if (player?.image) return `<img src="${escapeHtml(player.image)}" alt="${escapeHtml(player.name)}">`;
  const initials = String(player?.shirtName || player?.name || '?').split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase();
  return `<div class="player-placeholder">${escapeHtml(initials)}</div>`;
}

function groupedPlayers(teamName) {
  const squad = getTeamSquad(teamName);
  const groups = { GK: [], DF: [], MF: [], FW: [] };
  squad?.players?.forEach(p => groups[p.position]?.push(p));
  return groups;
}

function openTeamModal(teamName) {
  const squad = getTeamSquad(teamName);
  if (!squad) {
    openModal(`<h2>${escapeHtml(teamName)}</h2><p class="modal-muted">Ainda não há convocatória disponível para esta seleção.</p>`);
    return;
  }
  const labels = { GK: 'Guarda-redes', DF: 'Defesas', MF: 'Médios', FW: 'Avançados' };
  const groups = groupedPlayers(teamName);
  openModal(`
    <div class="modal-head">
      <div>
        <p class="eyebrow small">${escapeHtml(squad.code)} · ${squad.status === 'official' ? 'Convocatória oficial' : 'Convocatória por validar'}</p>
        <h2>${escapeHtml(teamName)}</h2>
        <p class="modal-muted">Treinador: <strong>${escapeHtml(squad.coach?.name || '—')}</strong></p>
      </div>
    </div>
    <div class="squad-grid">
      ${Object.entries(groups).map(([pos, players]) => `
        <section class="squad-position">
          <h3>${labels[pos]}</h3>
          ${players.map(p => `
            <button type="button" class="player-row" data-team="${escapeHtml(teamName)}" data-player-id="${escapeHtml(p.id)}">
              <span class="shirt-no">${p.number}</span>
              <span><strong>${escapeHtml(p.shirtName || p.name)}</strong><small>${escapeHtml(p.club)}</small></span>
            </button>`).join('')}
        </section>`).join('')}
    </div>
    <p class="modal-footnote">Fonte: ${escapeHtml(squad.source?.name || 'fonte da seleção')} — ${escapeHtml(squad.source?.title || 'dados da convocatória')}. Fotografias e alguns pesos podem ficar por preencher.</p>
  `);
}

function openPlayerModal(teamName, playerId) {
  const player = getPlayer(teamName, playerId);
  if (!player) return;
  openModal(`
    <div class="player-profile">
      <div class="player-photo">${playerPhoto(player)}</div>
      <div>
        <p class="eyebrow small">${escapeHtml(teamName)} · ${escapeHtml(player.positionLabel)}</p>
        <h2>${escapeHtml(player.shirtName || player.name)}</h2>
        <p class="modal-muted">${escapeHtml(player.name)}</p>
        <dl class="player-facts">
          <div><dt>Idade</dt><dd>${player.age ?? '—'} anos</dd></div>
          <div><dt>Altura</dt><dd>${player.heightCm ? `${player.heightCm} cm` : '—'}</dd></div>
          <div><dt>Peso</dt><dd>${player.weightKg ? `${player.weightKg} kg` : '—'}</dd></div>
          <div><dt>Clube atual</dt><dd>${escapeHtml(player.club || '—')}</dd></div>
          <div><dt>Nascimento</dt><dd>${escapeHtml(player.dob || '—')}</dd></div>
          <div><dt>Número</dt><dd>${player.number ?? '—'}</dd></div>
        </dl>
      </div>
    </div>
  `);
}

function lineup(teamName) {
  const squad = getTeamSquad(teamName);
  if (!squad) return null;
  const xi = (squad.likelyXI || []).map(id => getPlayer(teamName, id)).filter(Boolean);
  const subs = (squad.substitutes || []).map(id => getPlayer(teamName, id)).filter(Boolean);
  return { squad, xi, subs };
}

function pitchPlayers(teamName, side) {
  const l = lineup(teamName);
  if (!l) return `<div class="lineup-missing">Sem dados para ${escapeHtml(teamName)}</div>`;
  const zones = {
    GK: l.xi.filter(p => p.position === 'GK'),
    DF: l.xi.filter(p => p.position === 'DF'),
    MF: l.xi.filter(p => p.position === 'MF'),
    FW: l.xi.filter(p => p.position === 'FW')
  };
  return `<div class="team-pitch team-pitch-${side}">
    ${['FW','MF','DF','GK'].map(pos => `<div class="pitch-line pitch-${pos}">${zones[pos].map(p => `<button type="button" class="pitch-player" data-team="${escapeHtml(teamName)}" data-player-id="${escapeHtml(p.id)}"><span>${p.number}</span>${escapeHtml(p.shirtName || p.name)}</button>`).join('')}</div>`).join('')}
  </div>`;
}

function subsPanel(teamName) {
  const l = lineup(teamName);
  if (!l) return '';
  return `<section class="subs-panel"><h3>${escapeHtml(teamName)}</h3><p>Treinador: <strong>${escapeHtml(l.squad.coach?.name || '—')}</strong></p><h4>Suplentes</h4>${l.subs.map(p => `<button type="button" class="sub-player" data-team="${escapeHtml(teamName)}" data-player-id="${escapeHtml(p.id)}">${p.number}. ${escapeHtml(p.shirtName || p.name)} <span>${escapeHtml(p.positionLabel)}</span></button>`).join('')}</section>`;
}

function openMatchModal(matchId) {
  const match = data.matches.find(m => String(m.id) === String(matchId));
  if (!match) return;
  const ctx = getTournamentContext();
  const home = isKnockout(match) ? resolveTeam(match, 'home', ctx.qualified) : match.home;
  const away = isKnockout(match) ? resolveTeam(match, 'away', ctx.qualified) : match.away;
  openModal(`
    <div class="modal-head">
      <div>
        <p class="eyebrow small">Jogo ${match.id} · ${escapeHtml(STAGE_LABELS[match.stage])}</p>
        <h2>${escapeHtml(home)} vs ${escapeHtml(away)}</h2>
        <p class="modal-muted">${escapeHtml(match.time || 'Hora a definir')} · ${escapeHtml(match.venue)} · ${escapeHtml(match.city)}</p>
      </div>
    </div>
    <div class="lineup-layout">
      ${subsPanel(home)}
      <div class="pitch">
        ${pitchPlayers(home, 'home')}
        <div class="halfway"></div>
        ${pitchPlayers(away, 'away')}
      </div>
      ${subsPanel(away)}
    </div>
    <p class="modal-footnote">O 11 provável é uma estimativa e pode ser ajustado quando houver informação mais fiável perto do jogo.</p>
  `);
}

function ensureModal() {
  if ($('#appModal')) return;
  document.body.insertAdjacentHTML('beforeend', `<div id="appModal" class="modal-backdrop" hidden><div class="modal-box"><button type="button" class="modal-close" aria-label="Fechar">×</button><div id="modalContent"></div></div></div>`);
}

function openModal(html) {
  ensureModal();
  $('#modalContent').innerHTML = html;
  $('#appModal').hidden = false;
  document.body.classList.add('modal-open');
}

function closeModal() {
  const modal = $('#appModal');
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('modal-open');
}

function renderSingleGroupTable(group, context) {
  const { tables, qualified } = context;
  const rows = tables[group] || [];
  return `
    <section class="standing-card group-standing-card">
      <h3>Classificação — Grupo ${group}</h3>
      <table>
        <thead><tr><th>#</th><th>Equipa</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GM</th><th>GS</th><th>DG</th><th>Pts</th></tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr class="${row.position <= 2 ? 'qualified' : row.position === 3 && qualified.bestThirdGroups.includes(group) ? 'third-ok' : ''}">
              <td>${row.position}</td><td>${teamButton(row.team)}</td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gd}</td><td><strong>${row.points}</strong></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </section>`;
}

function renderBestThirdsTable(context) {
  const thirds = context.qualified.bestThirds.map(row => `
    <tr class="${row.qualifiedThird ? 'third-ok' : ''}">
      <td>${row.thirdRank}</td><td>${teamButton(row.team)}</td><td>Grupo ${row.group}</td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gd}</td><td><strong>${row.points}</strong></td>
    </tr>`).join('');

  return `
    <section class="standing-card best-thirds">
      <h3>Melhores terceiros classificados</h3>
      <table>
        <thead><tr><th>#</th><th>Equipa</th><th>Grupo</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GM</th><th>GS</th><th>DG</th><th>Pts</th></tr></thead>
        <tbody>${thirds}</tbody>
      </table>
    </section>`;
}

function renderGroupHeader() {
  return `
    <section class="standings-head">
      <h2>Fase de grupos</h2>
      <p>Cada grupo mostra primeiro a classificação automática e logo por baixo os jogos desse grupo. Passam os dois primeiros de cada grupo e os 8 melhores terceiros. Critérios usados: pontos, diferença de golos, golos marcados, vitórias, confronto direto quando aplicável e, no limite, ordem alfabética.</p>
    </section>`;
}

function renderStage(stage) {
  const context = getTournamentContext();
  const stageMatches = data.matches.filter(m => m.stage === stage);

  if (stage === 'groups') {
    const groupBlocks = GROUPS.map(group => {
      const matches = stageMatches.filter(match => match.group === group);
      return `
        <section class="group-block" id="grupo-${group}">
          <h2 class="day-title">Grupo ${group}</h2>
          ${renderSingleGroupTable(group, context)}
          <div class="group-matches">
            <h3>Jogos do Grupo ${group}</h3>
            ${matches.map(match => renderMatch(match, context)).join('')}
          </div>
        </section>`;
    }).join('');

    return `
      <section class="standings-block">
        ${renderGroupHeader()}
        ${groupBlocks}
        ${renderBestThirdsTable(context)}
      </section>`;
  }

  const grouped = stageMatches.reduce((acc, match) => {
    const key = match.date;
    acc[key] ||= [];
    acc[key].push(match);
    return acc;
  }, {});

  return Object.entries(grouped).map(([key, matches]) => `
    <div class="day-block">
      <h2 class="day-title">${dateTitle(key)}</h2>
      ${matches.map(match => renderMatch(match, context)).join('')}
    </div>
  `).join('') || `<div class="empty-state">Não há jogos nesta fase.</div>`;
}

function renderMatches() {
  if (isVotingClosed()) {
    renderClosedPublicView();
    return;
  }
  $('#matchesContainer').innerHTML = renderStage(state.activeStage);
  validateAllVisible();
}

function renderMatchesPreservingPosition(sourceEl = document.activeElement) {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const card = sourceEl?.closest?.('.match-card');
  const matchId = card?.dataset?.matchId || '';
  const field = sourceEl?.dataset?.field || '';

  renderMatches();

  requestAnimationFrame(() => {
    window.scrollTo(scrollX, scrollY);
    if (matchId && field) {
      const nextEl = document.querySelector(`.match-card[data-match-id="${CSS.escape(matchId)}"] [data-field="${CSS.escape(field)}"]`);
      if (nextEl) {
        nextEl.focus({ preventScroll: true });
        try {
          const len = String(nextEl.value ?? '').length;
          nextEl.setSelectionRange(len, len);
        } catch {
          // inputs type=number não suportam seleção em todos os browsers
        }
      }
    }
    window.scrollTo(scrollX, scrollY);
  });
}


function parseVotingDeadline(rawValue) {
  if (!rawValue) return null;

  if (typeof rawValue?.toDate === 'function') {
    return rawValue.toDate();
  }

  if (rawValue instanceof Date) {
    return new Date(rawValue);
  }

  const raw = String(rawValue).trim();
  const ptMatch = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (ptMatch) {
    const [, day, month, year] = ptMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
  }

  const isoDate = new Date(raw);
  if (!Number.isNaN(isoDate.getTime())) {
    isoDate.setHours(23, 59, 59, 999);
    return isoDate;
  }

  return null;
}

function formatVotingDeadline() {
  if (!votingDeadline.date) return '';
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(votingDeadline.date);
}

function isVotingClosed() {
  return !!votingDeadline.closed;
}

function refreshVotingDeadlineState() {
  votingDeadline.closed = !!(votingDeadline.date && new Date() > votingDeadline.date);
}

async function loadVotingDeadline() {
  if (!firestoreDb || !firebaseTools) return;
  try {
    const ref = firebaseTools.doc(firestoreDb, 'settings', 'endateworld');
    const snap = await firebaseTools.getDoc(ref);
    if (snap.exists()) {
      const value = snap.data()?.end;
      votingDeadline.raw = value || '';
      votingDeadline.date = parseVotingDeadline(value);
    }
  } catch (error) {
    console.warn('Não foi possível carregar a data limite.', error);
  } finally {
    votingDeadline.loaded = true;
    refreshVotingDeadlineState();
    applyVotingDeadlineUi();
    updateSaveButton();
  }
}

function applyVotingDeadlineUi() {
  refreshVotingDeadlineState();
  const closed = isVotingClosed();
  document.body.classList.toggle('voting-closed', closed);
  const lobby = $('#closedLobby');
  if (lobby) lobby.hidden = !closed;
  const status = $('#firebaseStatus');
  const dateText = formatVotingDeadline();

  if (closed) {
    if (status) status.textContent = dateText ? `As votações encerraram em ${dateText}.` : 'As votações já estão encerradas.';
    renderClosedPublicView();
  } else if (status && dateText) {
    status.textContent = `Podes gravar o teu prognóstico até ${dateText}.`;
  }
  updateMobileAppNav();
}

async function renderClosedPublicView() {
  const container = $('#matchesContainer');
  if (container) container.innerHTML = '';

  const dashboard = $('#closedLiveDashboard');
  if (dashboard) {
    dashboard.innerHTML = '<div class="live-loading-card">A carregar a Central Ggames...</div>';
  }

  await Promise.allSettled([loadScoringRules(), loadApiWorldCupData({ sync: true }), loadPublicPredictions()]);

  if (dashboard) {
    dashboard.innerHTML = renderLiveDashboard();
  }

  startLiveApiSync();
}

async function openLiveResultsModal() {
  openModal(`
    <div class="modal-head">
      <div>
        <p class="eyebrow small">Mundial em direto</p>
        <h2>Central Ggames Mundial 2026</h2>
      </div>
    </div>
    <div id="liveViewerBody" class="closed-viewer-body">
      <div class="live-loading-card">A carregar jogos, resultados e classificação...</div>
    </div>
  `);

  await Promise.allSettled([loadApiWorldCupData({ sync: true }), loadPublicPredictions()]);
  const body = $('#liveViewerBody');
  if (body) body.innerHTML = renderLiveDashboard();
  startLiveApiSync();
}

function refreshLiveDashboardView() {
  const body = $('#liveViewerBody') || $('#closedLiveDashboard') || $('#closedViewerBody');
  if (body) body.innerHTML = renderLiveDashboard();
  updateMobileAppNav();
}




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

  return {
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
  };
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
    const scheduleLive = isMatchInLiveWindow(match);
    return {
      id: String(match.id),
      matchId: String(match.id),
      stage: match.stage,
      group: match.group,
      date: match.date,
      time: match.time,
      homeTeam: match.home,
      awayTeam: match.away,
      homeGoals: null,
      awayGoals: null,
      finished: false,
      live: scheduleLive,
      timeElapsed: scheduleLive ? `~${elapsedMinuteFromSchedule(match)}` : 'notstarted',
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
    const d = new Date(`${match.date}T${match.time || '12:00'}:00`);
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
  const id = String(raw.id ?? raw.match_id ?? raw.game_id ?? raw._id ?? '');
  const local = localMatchById(id);
  const parsedDate = parseApiDate(raw.local_date || raw.date || raw.datetime);
  const homeName = raw.home_team_name_en || raw.home_team_name || raw.home_team_label || local?.home || 'A definir';
  const awayName = raw.away_team_name_en || raw.away_team_name || raw.away_team_label || local?.away || 'A definir';
  const homeGoals = normalizeApiScore(raw.home_score ?? raw.homeGoals);
  const awayGoals = normalizeApiScore(raw.away_score ?? raw.awayGoals);
  const finished = normalizeApiBoolean(raw.finished);
  const rawElapsed = raw.time_elapsed ?? raw.status ?? 'notstarted';
  const apiLive = isApiStatusLive(rawElapsed);
  const scheduleMatch = { ...local, date: parsedDate.date || local?.date || '', time: parsedDate.time || local?.time || '' };
  const scheduleLive = !finished && isMatchInLiveWindow(scheduleMatch);
  const live = !finished && (apiLive || scheduleLive);
  const timeElapsed = apiLive ? rawElapsed : (scheduleLive ? elapsedMinuteFromSchedule(scheduleMatch) : rawElapsed);
  return {
    id,
    matchId: id,
    stage: apiStageToLocal(raw.type || local?.stage),
    group: raw.group || local?.group || null,
    date: parsedDate.date || local?.date || '',
    time: parsedDate.time || local?.time || '',
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
  }));
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
    worldCupApi.groups = worldcup26.groups?.length ? worldcup26.groups : buildGroupsTableFromGames(worldCupApi.games);
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
      officialResults = loaded.officialByMatchId;
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
  worldCupApi.games.forEach(game => {
    const hasScore = game.homeGoals !== null && game.awayGoals !== null;
    if (!hasScore) return;
    if (game.finished || !game.live) return;
    const existing = officialResults[String(game.id)];
    if (!existing || game.live) {
      officialResults[String(game.id)] = {
        ...existing,
        ...game,
        status: 'official',
        type: 'officialResult',
        source: 'api-live',
        _live: game.live,
        _finished: game.finished
      };
    }
  });
}

async function syncFinishedApiResultsToFirebase() {
  if (!firestoreDb || !firebaseTools || !worldCupApi.games.length) return;
  const trustedSources = new Set(['API-Football', 'football-data', 'Highlightly', 'AllSportsAPI', 'SofaScore', 'ESPN', 'worldcup26.ir', 'TheSportsDB v1 free', 'lineups', 'worldcup']);
  const relevantGames = worldCupApi.games.filter(g =>
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
      const nextStatus = game.finished ? 'finished' : 'live';
      const nextLive = !!(game.live && !game.finished);
      const nextFinished = !!game.finished;
      const sameCoreState =
        existing &&
        existing.status === nextStatus &&
        !!existing.live === nextLive &&
        !!existing.finished === nextFinished &&
        (existing.homeGoals ?? null) === (game.homeGoals ?? null) &&
        (existing.awayGoals ?? null) === (game.awayGoals ?? null) &&
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
        homeGoals: game.homeGoals ?? null,
        awayGoals: game.awayGoals ?? null,
        winnerTeam: game.finished && resultHasScore(game) ? getWinnerTeamFromScore(game) : null,
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

  const tick = async () => {
    await loadApiWorldCupData({ sync: true });
    if (isVotingClosed()) refreshLiveDashboardView();
    window.dispatchEvent(new CustomEvent('ggames-live-updated', { detail: { updatedAt: worldCupApi.lastUpdate } }));
  };

  liveSyncTimer = setInterval(tick, API_SYNC_INTERVAL_MS);
}

function getWinnerTeamFromScore(result) {
  const home = Number(result.homeGoals);
  const away = Number(result.awayGoals);
  if (home > away) return result.homeTeam;
  if (away > home) return result.awayTeam;
  return 'Empate';
}

function apiMatchForLocal(match) {
  return worldCupApi.games.find(g => String(g.id) === String(match.id)) || null;
}

function renderLiveDashboard() {
  return `
    <div class="live-two-columns">
      <section class="live-column" data-mobile-live-section="games">
        <div class="live-column-head"><h3>Jogos</h3></div>
        <div class="viewer-tabs compact">
          <button type="button" class="viewer-tab ${liveLeftTab === 'live' ? 'active' : ''}" data-live-left="live">Jogos em Direto</button>
          <button type="button" class="viewer-tab ${liveLeftTab === 'future' ? 'active' : ''}" data-live-left="future">Futuros Jogos</button>
          <button type="button" class="viewer-tab ${liveLeftTab === 'groups' ? 'active' : ''}" data-live-left="groups">Tabela dos Grupos</button>
        </div>
        <div class="live-panel-body">${renderLiveLeftPanel()}</div>
      </section>
      <section class="live-column" data-mobile-live-section="results">
        <div class="live-column-head"><h3>Resultados</h3></div>
        <div class="viewer-tabs compact">
          <button type="button" class="viewer-tab ${liveRightTab === 'battles' ? 'active' : ''}" data-live-right="battles">Ggames Battles Live</button>
          <button type="button" class="viewer-tab ${liveRightTab === 'table' ? 'active' : ''}" data-live-right="table">Tabela Ggames Live</button>
        </div>
        <div class="live-panel-body">${renderLiveRightPanel()}</div>
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


function renderLiveStatusText(game) {
  if (!game?.live) return game?.finished ? 'Terminado' : 'Por jogar';
  if (String(game.timeElapsed || '').startsWith('~')) return '';
  return liveStatusLabel(game.timeElapsed);
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

function renderLiveGameCard(game, mode = 'live') {
  const status = renderLiveStatusText(game);
  const score = game.homeGoals !== null && game.awayGoals !== null ? `${game.homeGoals} - ${game.awayGoals}` : 'vs';
  const local = localMatchById(game.id);
  const homeScorers = compactScorersForCard(scorerValueForSide(game, 'home'));
  const awayScorers = compactScorersForCard(scorerValueForSide(game, 'away'));

  return `
    <button type="button" class="api-game-card ${game.live ? 'is-live' : ''} ${game.finished ? 'is-finished' : ''}" data-live-match="${escapeHtml(game.id)}">
      <div class="api-game-top"><span>Jogo ${escapeHtml(game.id)} · ${escapeHtml(STAGE_LABELS[game.stage] || game.stage)}</span><b>${status}</b></div>
      <div class="api-score-line api-score-line-with-scorers">
        <div class="api-team-score-side">
          <strong>${escapeHtml(game.homeTeam || local?.home || 'A definir')}</strong>
          ${homeScorers}
        </div>
        <span>${score}</span>
        <div class="api-team-score-side api-team-score-side-away">
          <strong>${escapeHtml(game.awayTeam || local?.away || 'A definir')}</strong>
          ${awayScorers}
        </div>
      </div>
      <p class="modal-muted">${escapeHtml(game.date || local?.date || '')} ${escapeHtml(game.time || local?.time || '')}${game.venue ? ` · ${escapeHtml(game.venue)}` : ''}</p>
    </button>
  `;
}

function liveStatusLabel(value) {
  const raw = String(value || '').trim();
  const text = raw.toLowerCase();

  // Se o valor foi estimado pelo horário local, não mostramos texto nenhum.
  // Isto inclui minutos estimados e "halftime"/"Intervalo" estimados.
  if (raw.startsWith('~') || text.startsWith('estimado:')) return '';

  if (!text || text === 'notstarted' || text === 'live') return 'Ao vivo';
  if (text === 'halftime' || text === 'half-time' || text === 'interval') return 'Intervalo';
  if (/^\d+([+\d]*)?$/.test(text)) return `${text}'`;
  return String(value);
}

function apiScorerList(value) {
  if (value == null) return [];

  const clean = item => String(item || '')
    .replace(/\s+/g, ' ')
    .replace(/^\d+\s*[:.'’-]\s*/, '')
    .replace(/\b\d{1,3}(?:\+\d+)?['’]?\b/g, '')
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
    if (parsed && typeof parsed === 'object') return apiScorerList(Object.values(parsed));
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
  return game?.apiEventId || game?.externalEventId || game?.idEvent || officialResults[String(game?.id || local?.id)]?.apiEventId || local?.apiEventId || null;
}

function findApiFootballFixtureIdForGame(game, local) {
  return game?.apiFootballFixtureId || officialResults[String(game?.id || local?.id)]?.apiFootballFixtureId || local?.apiFootballFixtureId || null;
}

function findHighlightlyMatchIdForGame(game, local) {
  return game?.highlightlyMatchId || officialResults[String(game?.id || local?.id)]?.highlightlyMatchId || local?.highlightlyMatchId || null;
}

function findAllSportsEventIdForGame(game, local) {
  return game?.allSportsEventId || officialResults[String(game?.id || local?.id)]?.allSportsEventId || local?.allSportsEventId || null;
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
  const game = worldCupApi.games.find(g => String(g.id) === String(matchId)) || officialResults[String(matchId)] || localMatchById(matchId);
  if (!game) return;
  const local = localMatchById(matchId);
  const home = game.homeTeam || game.home || local?.home || 'A definir';
  const away = game.awayTeam || game.away || local?.away || 'A definir';
  const stage = game.stage || local?.stage || 'groups';
  const score = game.homeGoals !== null && game.homeGoals !== undefined && game.awayGoals !== null && game.awayGoals !== undefined ? `${game.homeGoals} - ${game.awayGoals}` : 'vs';
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
      ${renderScorersBlock(game)}
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

function renderLiveGameUserPredictions(gameId) {
  if (!publicPredictions || !publicPredictions.length) {
    return '';
  }

  const gamePredictions = [];
  publicPredictions.forEach(player => {
    const pred = (player.matches || []).find(m => String(m.id) === String(gameId));
    if (pred && pred.homeGoals !== '' && pred.awayGoals !== '' && pred.homeGoals !== null && pred.awayGoals !== null) {
      gamePredictions.push({
        player,
        pred
      });
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

  return `
    <div class="live-game-predictions">
      <h4 class="live-predictions-title">Prognósticos dos Participantes</h4>
      <ul class="live-predictions-list">
        ${gamePredictions.map(item => {
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
          const predText = `${escapeHtml(item.pred.homeTeam)} ${item.pred.homeGoals}-${item.pred.awayGoals} ${escapeHtml(item.pred.awayTeam)}${extra}`;
          
          return `
            <li class="live-prediction-item">
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
  let games = worldCupApi.games.filter(g => g.live && !g.finished).sort((a,b) => Number(a.id)-Number(b.id));

  // Salvaguarda: se a API ainda não marcar o jogo como "live" mas o horário local já estiver dentro da janela do jogo,
  // mostramos o jogo em direto na mesma. Isto evita o ecrã "não há jogos em direto" durante jogos 0-0 ou quando a API atrasa o estado.
  if (!games.length && data?.matches?.length) {
    games = data.matches
      .filter(m => isMatchInLiveWindow(m))
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

  if (!games.length) return '<div class="empty-state">Neste momento não há jogos em direto.</div>';
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
  const games = source.filter(g => !g.finished && !g.live && getMatchDateObj({ date: g.date, time: g.time }) >= now).slice(0, 18);
  if (!games.length) return '<div class="empty-state">Não há jogos futuros para mostrar.</div>';
  return `<div class="api-games-list">${games.map(g => renderLiveGameCard(g, 'future')).join('')}</div>`;
}

function renderApiGroupsTable() {
  if (worldCupApi.groups.length) {
    return `<div class="api-groups-grid">${worldCupApi.groups.map(group => {
      const groupName = group.group || group.name || group.group_name || '';
      const teams = Array.isArray(group.teams) ? group.teams : [];
      return `<section class="api-group-card"><h4>Grupo ${escapeHtml(groupName)}</h4><table><thead><tr><th>Equipa</th><th>Pts</th><th>GM</th><th>GS</th></tr></thead><tbody>${teams.map(t => `<tr><td>${escapeHtml(t.team_name_en || t.name_en || t.team || t.team_id || 'Equipa')}</td><td>${escapeHtml(t.pts ?? t.points ?? 0)}</td><td>${escapeHtml(t.gf ?? 0)}</td><td>${escapeHtml(t.ga ?? 0)}</td></tr>`).join('')}</tbody></table></section>`;
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
      const official = officialResults[String(match.id)];
      return !(isOfficialResultFinished(existing) || isOfficialResultFinished(official));
    })
    .sort((a, b) => Number(a.id) - Number(b.id))[0];

  if (!localLive) return null;

  const existing = (worldCupApi?.games || []).find(game => String(game.id) === String(localLive.id)) || {};
  const official = officialResults[String(localLive.id)] || {};
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
      const pred = (player?.matches || []).find(match => Number(match.id) === Number(game.id));
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

function renderLiveGiriaBattles() {
  const liveGame = getCurrentLiveGameForDashboard();

  // Regra principal: se há jogo em direto/estimado em direto, esta aba mostra só esse jogo.
  // Nunca pode saltar para o próximo jogo enquanto o atual estiver live.
  if (liveGame) {
    const directCards = directLiveBattleCardsForGame(liveGame);
    return directCards || `<p class="modal-muted">Este jogo está em direto, mas ainda não há prognósticos suficientes para criar battles live.</p>`;
  }

  const rows = calculateGgamesTable();
  if (rows.length < 2) return '<p class="modal-muted">Ainda não há jogadores suficientes para criar battles.</p>';

  const futureMatches = worldCupApi.games.filter(g => !g.finished && !g.live && g.id);
  const localFuture = !futureMatches.length && data?.matches
    ? data.matches
        .filter(m => !officialResults[String(m.id)])
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
  const predictions = Array.isArray(playerDoc.matches) ? playerDoc.matches : [];
  const historyRows = predictions.map(pred => {
    const match = data?.matches?.find(m => String(m.id) === String(pred.id)) || {};
    const official = getOfficialResult(pred.id);
    const score = official ? scoreOnePrediction(pred, official) : null;
    const status = official
      ? (score?.points > 0 ? 'Acertou' : 'Falhou')
      : 'Por jogar';
    const statusClass = official ? (score?.points > 0 ? 'ok' : 'bad') : 'wait';
    const officialText = official
      ? `${escapeHtml(official.homeTeam || match.home || '')} ${official.homeGoals ?? official.homeScore ?? 0}-${official.awayGoals ?? official.awayScore ?? 0} ${escapeHtml(official.awayTeam || match.away || '')}`
      : 'Ainda sem resultado oficial';
    return `
      <tr>
        <td>${escapeHtml(pred.id)}</td>
        <td>${escapeHtml(match.stageLabel || STAGE_LABELS[match.stage] || match.stage || 'Jogo')}</td>
        <td>${escapeHtml(match.home || pred.homeTeam || 'Equipa A')} vs ${escapeHtml(match.away || pred.awayTeam || 'Equipa B')}</td>
        <td>${predictionResultText(pred)}</td>
        <td>${officialText}</td>
        <td><span class="history-pill ${statusClass}">${status}${score ? ` · ${score.points} pts` : ''}</span></td>
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
      <article><span>Pontos</span><strong>${row.points}</strong></article>
      <article><span>Acertados</span><strong>${row.correctPredictions}</strong></article>
      <article><span>Falhados</span><strong>${row.failedPredictions}</strong></article>
      <article><span>Golos Marcados</span><strong>${row.goalsHit}</strong></article>
      <article><span>Golos Falhados</span><strong>${row.goalsMissed}</strong></article>
    </section>
    <div class="table-scroll history-scroll">
      <table class="ggames-table player-history-table">
        <thead><tr><th>Jogo</th><th>Fase</th><th>Partida</th><th>Prognóstico</th><th>Resultado</th><th>Estado</th></tr></thead>
        <tbody>${historyRows || '<tr><td colspan="6">Sem prognósticos para mostrar.</td></tr>'}</tbody>
      </table>
    </div>
  `);
}

function completionInfo() {
  if (!data) return { filled: 0, total: 0, complete: false, missingName: true, missingMatches: [] };
  const currentName = ($('#userName')?.value || state.name || '').trim();
  const missingMatches = data.matches.filter(match => !isPredictionComplete(match, getPrediction(match.id)));
  return {
    filled: data.matches.length - missingMatches.length,
    total: data.matches.length,
    complete: !!currentName && missingMatches.length === 0,
    missingName: !currentName,
    missingMatches
  };
}

function updateSaveButton() {
  const btn = $('#saveFirebaseBtn');
  const status = $('#firebaseStatus');
  if (!btn || !status) return;
  const info = completionInfo();
  btn.disabled = !info.complete || !firestoreDb || isVotingClosed();

  const dateText = formatVotingDeadline();
  if (isVotingClosed()) {
    status.textContent = dateText ? `As votações encerraram em ${dateText}.` : 'As votações já estão encerradas.';
  } else if (!firestoreDb) {
    status.textContent = 'A gravação ainda não está pronta. Confirma que estás com internet.';
  } else if (info.complete) {
    status.textContent = dateText ? `Tudo preenchido. Podes gravar até ${dateText}.` : 'Tudo preenchido. Já podes gravar o teu prognóstico.';
  } else if (info.missingName) {
    status.textContent = `Falta o nome do participante e faltam ${info.missingMatches.length} jogos.`;
  } else {
    status.textContent = `Faltam ${info.missingMatches.length} jogos para poderes gravar.`;
  }
}

function updateSummary() {
  $('#participantName').textContent = state.name || 'Sem nome';
  $('#userName').value = state.name || '';
  $('#lastSaved').textContent = state.lastSaved || '—';
  const info = completionInfo();
  $('#progressCount').textContent = `${info.filled}/${info.total || 104}`;
  updateSaveButton();
}

function validateMatch(card) {
  const id = card.dataset.matchId;
  const match = data.matches.find(m => String(m.id) === String(id));
  if (!match || !isKnockout(match)) return true;

  const p = getPrediction(id);
  const score = scoreState(p);
  const valid = !score.filled || !score.tied || ((p.method === 'et' || p.method === 'pens') && !!p.winner);

  card.classList.toggle('invalid', !valid);
  return valid;
}

function validateAllVisible() {
  document.querySelectorAll('.match-card').forEach(validateMatch);
}

function autoWinner(matchId) {
  const match = data.matches.find(m => String(m.id) === String(matchId));
  const p = getPrediction(matchId);
  if (!match || !isKnockout(match) || !isFilledScore(p)) return;

  const home = Number(p.homeGoals);
  const away = Number(p.awayGoals);
  if (home > away) {
    p.winner = 'home';
    p.method = '90';
  } else if (away > home) {
    p.winner = 'away';
    p.method = '90';
  } else {
    p.winner = '';
    p.method = '';
  }
  state.predictions[String(matchId)] = p;
}


async function initFirebase() {
  try {
    const appModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`);
    const firestoreModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`);
    const app = appModule.initializeApp(FIREBASE_CONFIG);
    firestoreDb = firestoreModule.getFirestore(app);
    firebaseTools = {
      addDoc: firestoreModule.addDoc,
      collection: firestoreModule.collection,
      serverTimestamp: firestoreModule.serverTimestamp,
      getDocs: firestoreModule.getDocs,
      getDoc: firestoreModule.getDoc,
      query: firestoreModule.query,
      where: firestoreModule.where,
      orderBy: firestoreModule.orderBy,
      doc: firestoreModule.doc,
      setDoc: firestoreModule.setDoc,
      limit: firestoreModule.limit,
      writeBatch: firestoreModule.writeBatch
    };
    updateSaveButton();
    await loadScoringRules();
    await loadVotingDeadline();
  } catch (error) {
    console.error('Erro ao preparar ligação:', error);
    const status = $('#firebaseStatus');
    if (status) status.textContent = 'Não foi possível preparar a gravação. Confirma a internet.';
    updateSaveButton();
  }
}

function resolvedWinner(match, pred, q) {
  if (!isKnockout(match)) {
    if (!isFilledScore(pred)) return '';
    const score = scoreState(pred);
    if (score.home > score.away) return match.home;
    if (score.away > score.home) return match.away;
    return 'Empate';
  }
  if (!isFilledScore(pred)) return '';
  const score = scoreState(pred);
  if (!score.tied) return score.home > score.away ? resolveTeam(match, 'home', q) : resolveTeam(match, 'away', q);
  return pred.winner ? resolveTeam(match, pred.winner, q) : '';
}



async function hashPinForParticipant(participantKey, pin) {
  const text = `${participantKey}:${pin}`;
  if (window.crypto?.subtle) {
    const data = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  // fallback simples caso crypto.subtle não esteja disponível
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fnv-${(hash >>> 0).toString(16)}`;
}

function getOrCreateParticipantPin(participantKey) {
  const key = `worldcup2026_pin_${participantKey || 'participante'}`;
  let pin = localStorage.getItem(key);
  if (!/^\d{6}$/.test(String(pin || ''))) {
    const array = new Uint32Array(1);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(array);
    const n = window.crypto?.getRandomValues ? array[0] : Math.floor(Math.random() * 1000000);
    pin = String(100000 + (n % 900000));
    localStorage.setItem(key, pin);
  }
  return pin;
}

function buildSubmissionPayload(participantKey = '', visitorKey = '') {
  const ctx = getTournamentContext();
  const participantName = ($('#userName')?.value || state.name || '').trim();
  const matches = data.matches.map(match => {
    const pred = getPrediction(match.id);
    const homeTeam = isKnockout(match) ? resolveTeam(match, 'home', ctx.qualified) : match.home;
    const awayTeam = isKnockout(match) ? resolveTeam(match, 'away', ctx.qualified) : match.away;
    return {
      id: match.id,
      stage: match.stage,
      stageLabel: STAGE_LABELS[match.stage],
      group: match.group || null,
      date: match.date,
      time: match.time || null,
      venue: match.venue || null,
      city: match.city || null,
      country: match.country || null,
      originalHome: match.home,
      originalAway: match.away,
      homeTeam,
      awayTeam,
      homeGoals: Number(pred.homeGoals),
      awayGoals: Number(pred.awayGoals),
      method: isKnockout(match) ? (pred.method || '90') : 'group',
      winnerSide: isKnockout(match) ? (pred.winner || (Number(pred.homeGoals) > Number(pred.awayGoals) ? 'home' : 'away')) : null,
      winnerTeam: resolvedWinner(match, pred, ctx.qualified)
    };
  });

  return {
    participantName,
    participantKey,
    visitorKey,
    pin: getOrCreateParticipantPin(participantKey),
    createdAt: firebaseTools.serverTimestamp(),
    clientTimestamp: new Date().toISOString(),
    locale: 'pt-PT',
    source: 'worldcup-2026-predictor-web',
    totalMatches: data.matches.length,
    completedMatches: matches.length,
    predictionsRaw: state.predictions,
    matches,
    standings: ctx.tables,
    qualified: ctx.qualified,
    champion: matches.find(m => m.stage === 'final')?.winnerTeam || null,
    runnerUp: (() => {
      const finalMatch = matches.find(m => m.stage === 'final');
      if (!finalMatch) return null;
      return finalMatch.winnerTeam === finalMatch.homeTeam ? finalMatch.awayTeam : finalMatch.homeTeam;
    })()
  };
}


function normalizeParticipantName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'participante';
}

function getOrCreateDeviceId() {
  const key = 'worldcup2026_device_id';
  let value = localStorage.getItem(key);
  if (!value) {
    value = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-]/g, '');
    localStorage.setItem(key, value);
  }
  return value;
}

async function sha256(text) {
  if (!crypto?.subtle) return btoa(unescape(encodeURIComponent(text))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
  const dataBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return [...new Uint8Array(hashBuffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function getVisitorKey() {
  const cached = sessionStorage.getItem('worldcup2026_visitor_key');
  if (cached) return cached;

  const deviceId = getOrCreateDeviceId();
  let ipPart = '';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      const payload = await response.json();
      ipPart = payload.ip || '';
    }
  } catch {
    // Se o serviço de IP falhar, usa um identificador anónimo deste navegador.
  }

  const visitorKey = ipPart
    ? await sha256(`ip:${ipPart}`)
    : await sha256(`device:${navigator.userAgent}|${deviceId}`);
  sessionStorage.setItem('worldcup2026_visitor_key', visitorKey);
  return visitorKey;
}

async function findExistingSubmission(participantKey, visitorKey) {
  const collectionRef = firebaseTools.collection(firestoreDb, FIREBASE_COLLECTION);
  const byName = await firebaseTools.getDocs(
    firebaseTools.query(collectionRef, firebaseTools.where('participantKey', '==', participantKey), firebaseTools.limit(1))
  );
  if (!byName.empty) return { reason: 'name' };

  const byVisitor = await firebaseTools.getDocs(
    firebaseTools.query(collectionRef, firebaseTools.where('visitorKey', '==', visitorKey), firebaseTools.limit(1))
  );
  if (!byVisitor.empty) return { reason: 'visitor' };

  return null;
}

async function loadPublicPredictions() {
  if (!firestoreDb || !firebaseTools) throw new Error('A ligaÃ§Ã£o ainda nÃ£o estÃ¡ pronta.');
  const loaded = await loadOfficialMatchStateDocs();
  publicPredictions = loaded.allDocs.filter(doc => doc.status !== 'official' && doc.type !== 'officialResult' && Array.isArray(doc.matches));
  officialResults = loaded.officialByMatchId;
  mergeApiResultsIntoOfficialResults();
  return publicPredictions;
  if (!firestoreDb || !firebaseTools) throw new Error('A ligação ainda não está pronta.');
  const collectionRef = firebaseTools.collection(firestoreDb, FIREBASE_COLLECTION);
  const matchesCollectionRef = firebaseTools.collection(firestoreDb, FIREBASE_MATCHES_COLLECTION);
  let snapshot;
  let matchesSnapshot = null;
  try {
    snapshot = await firebaseTools.getDocs(firebaseTools.query(collectionRef, firebaseTools.orderBy('clientTimestamp', 'desc')));
  } catch {
    snapshot = await firebaseTools.getDocs(collectionRef);
  }
  try {
    matchesSnapshot = await firebaseTools.getDocs(matchesCollectionRef);
  } catch (error) {
    console.warn('NÃ£o foi possÃ­vel carregar worldcupextraMatches. A usar fallback legacy.', error);
  }
  const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  publicPredictions = allDocs.filter(doc => doc.status !== 'official' && doc.type !== 'officialResult' && Array.isArray(doc.matches));
  const legacyOfficialDocs = allDocs
    .filter(doc => doc.status === 'official' || doc.type === 'officialResult')
    .filter(doc => doc.matchId != null || doc.id?.startsWith?.('official-match-'))
    .map(doc => [String(doc.matchId ?? String(doc.id).replace('official-match-', '')), doc]);
  const matchStateDocs = (matchesSnapshot?.docs || [])
    .map(doc => normalizeMatchStateDoc(doc.id, doc.data()))
    .filter(shouldTrackMatchDocAsOfficial)
    .map(doc => [String(doc.matchId), doc]);
  officialResults = Object.fromEntries([...legacyOfficialDocs, ...matchStateDocs]);
  return publicPredictions;
}

function getOfficialResult(matchId) {
  const key = String(matchId);
  return officialResults[key] || null;
}

function getMatchDateObj(match) {
  return new Date(`${match.date}T${match.time || '12:00'}:00`);
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function actualOutcome(result) {
  if (!result) return '';
  const home = Number(result.homeGoals);
  const away = Number(result.awayGoals);
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

function predictionOutcome(pred) {
  if (!pred) return '';
  const home = Number(pred.homeGoals);
  const away = Number(pred.awayGoals);
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

function sameTeamName(a, b) {
  return normalizeParticipantName(a) === normalizeParticipantName(b);
}

function teamsMatchPrediction(pred, official) {
  if (!pred || !official) return false;
  if (pred.stage === 'groups') return true;
  return sameTeamName(pred.homeTeam, official.homeTeam) && sameTeamName(pred.awayTeam, official.awayTeam);
}

function officialWinnerTeam(official) {
  return getWinnerTeamFromScore(official);
}

function scoreOnePrediction(pred, official) {
  if (!pred || !official || pred.homeGoals == null || pred.awayGoals == null || official.homeGoals == null || official.awayGoals == null) {
    return { points: 0, exact: false, outcomeHit: false, goalsHit: 0, goalsMissed: 0, winHit: 0, drawHit: 0, lossHit: 0, played: false };
  }
  const ph = Number(pred.homeGoals);
  const pa = Number(pred.awayGoals);
  const oh = Number(official.homeGoals);
  const oa = Number(official.awayGoals);
  const stage = pred.stage || official.stage || 'groups';
  const teamsMatch = teamsMatchPrediction(pred, official);
  const exact = teamsMatch && ph === oh && pa === oa;
  const actual = actualOutcome(official);
  const predicted = predictionOutcome(pred);
  const outcomeHit = teamsMatch && actual === predicted;
  const winnerHit = pred.winnerTeam && officialWinnerTeam(official) !== 'Empate' && sameTeamName(pred.winnerTeam, officialWinnerTeam(official));

  let points = 0;
  if (stage === 'groups') {
    points = exact ? numericRule('groupExact') : outcomeHit ? numericRule('groupOutcome') : 0;
  } else if (stage === 'final') {
    points = exact ? numericRule('finalInitialExact') : winnerHit ? numericRule('finalInitialWinner') : outcomeHit ? numericRule('finalInitialMethod') : 0;
  } else {
    points = exact ? numericRule('knockoutInitialExact') : outcomeHit ? numericRule('knockoutInitialWinner') : 0;
  }

  const goalsHit = (ph === oh ? oh : 0) + (pa === oa ? oa : 0);
  const goalsMissed = Math.abs(ph - oh) + Math.abs(pa - oa);
  return {
    points,
    exact,
    outcomeHit: outcomeHit || winnerHit,
    goalsHit,
    goalsMissed,
    winHit: (outcomeHit || winnerHit) && actual === 'home' ? 1 : 0,
    drawHit: outcomeHit && actual === 'draw' ? 1 : 0,
    lossHit: (outcomeHit || winnerHit) && actual === 'away' ? 1 : 0,
    played: true
  };
}


function calculateGgamesTable() {
  const rows = publicPredictions.map(item => {
    const stats = {
      id: item.id,
      name: item.participantName || 'Participante',
      icon: item.icon || item.participantIcon || item.playerIcon || '',
      points: 0,
      correctPredictions: 0,
      failedPredictions: 0,
      goalsHit: 0,
      goalsMissed: 0,
      winsHit: 0,
      drawsHit: 0,
      lossesHit: 0,
      exactResults: 0
    };
    (item.matches || []).forEach(pred => {
      const official = getOfficialResult(pred.id);
      if (!official) return;
      const score = scoreOnePrediction(pred, official);
      stats.points += score.points;
      stats.correctPredictions += score.points > 0 ? 1 : 0;
      stats.failedPredictions += score.points === 0 ? 1 : 0;
      stats.goalsHit += score.goalsHit;
      stats.goalsMissed += score.goalsMissed;
      stats.winsHit += score.winHit;
      stats.drawsHit += score.drawHit;
      stats.lossesHit += score.lossHit;
      stats.exactResults += score.exact ? 1 : 0;
    });
    return stats;
  });

  return rows.sort((a, b) =>
    (b.points - a.points) ||
    (b.correctPredictions - a.correctPredictions) ||
    (b.goalsHit - a.goalsHit) ||
    (a.goalsMissed - b.goalsMissed) ||
    a.name.localeCompare(b.name, 'pt-PT')
  ).map((row, index) => ({ ...row, rank: index + 1 }));
}


function predictionResultText(matchPrediction) {
  if (!matchPrediction) return '—';
  const methodLabel = matchPrediction.method === 'et' ? 'após prolongamento' : matchPrediction.method === 'pens' ? 'após penáltis' : '';
  const winner = matchPrediction.winnerTeam && matchPrediction.winnerTeam !== 'Empate' ? ` · vence ${escapeHtml(matchPrediction.winnerTeam)}${methodLabel ? ` ${methodLabel}` : ''}` : '';
  return `${escapeHtml(matchPrediction.homeTeam)} ${matchPrediction.homeGoals}-${matchPrediction.awayGoals} ${escapeHtml(matchPrediction.awayTeam)}${winner}`;
}

function renderPublicPlayerList() {
  if (!publicPredictions.length) return '<div class="empty-state">Ainda não há prognósticos gravados.</div>';
  return `
    <div class="viewer-list">
      ${publicPredictions.map(item => `
        <button type="button" class="viewer-player" data-view-player="${escapeHtml(item.id)}">
          <strong>${renderParticipantIdentity(item.participantName || 'Participante', item.icon || item.participantIcon || item.playerIcon || '')}</strong>
          <span>${escapeHtml(item.champion ? `Campeão: ${item.champion}` : 'Prognóstico completo')}</span>
        </button>
      `).join('')}
    </div>
    <div id="viewerDetails" class="viewer-details"><p class="modal-muted">Escolhe um jogador para veres todos os resultados.</p></div>
  `;
}

function renderPublicPlayerDetails(publicId) {
  const item = publicPredictions.find(p => p.id === publicId);
  if (!item) return '<p class="modal-muted">Prognóstico não encontrado.</p>';
  const grouped = Object.keys(STAGE_LABELS).map(stage => {
    const rows = (item.matches || []).filter(match => match.stage === stage);
    if (!rows.length) return '';
    return `
      <section class="viewer-stage-block">
        <h3>${escapeHtml(STAGE_LABELS[stage])}</h3>
        ${rows.map(match => `<div class="viewer-result"><span>Jogo ${match.id}</span><strong>${predictionResultText(match)}</strong></div>`).join('')}
      </section>
    `;
  }).join('');
  return `<h3>${renderParticipantIdentity(item.participantName || 'Participante', item.icon || item.participantIcon || item.playerIcon || '')}</h3>${grouped}`;
}

function renderPublicByGame(stage = publicViewerStage, filter = publicGameFilter) {
  const now = new Date();
  const stageMatches = data.matches.filter(match => match.stage === stage).filter(match => {
    const official = getOfficialResult(match.id);
    const matchDate = getMatchDateObj(match);
    if (filter === 'played') return isOfficialResultFinished(official);
    if (filter === 'today') return sameLocalDay(matchDate, now);
    if (filter === 'future') return !official && matchDate > now;
    return true;
  });

  return `
    <div class="viewer-stage-tabs">
      ${Object.entries(STAGE_LABELS).map(([key, label]) => `<button type="button" class="viewer-stage-tab ${key === stage ? 'active' : ''}" data-view-stage="${key}">${escapeHtml(label)}</button>`).join('')}
    </div>
    <div class="viewer-filter-tabs">
      <button type="button" class="viewer-filter-tab ${filter === 'played' ? 'active' : ''}" data-game-filter="played">Jogados</button>
      <button type="button" class="viewer-filter-tab ${filter === 'today' ? 'active' : ''}" data-game-filter="today">Hoje</button>
      <button type="button" class="viewer-filter-tab ${filter === 'future' ? 'active' : ''}" data-game-filter="future">Futuros</button>
    </div>
    <div class="viewer-games">
      ${stageMatches.length ? stageMatches.map(match => {
        const official = getOfficialResult(match.id);
        const predictions = publicPredictions.map(item => ({
          player: item.participantName || 'Participante',
          item,
          match: (item.matches || []).find(row => Number(row.id) === Number(match.id))
        })).filter(row => row.match);
        return `
          <section class="viewer-game-card">
            <div class="viewer-game-head">
              <div>
                <h3>Jogo ${match.id} · ${escapeHtml(STAGE_LABELS[match.stage])}</h3>
                <p class="modal-muted">${escapeHtml(match.home)} vs ${escapeHtml(match.away)} · ${escapeHtml(match.date)} ${escapeHtml(match.time || '')}</p>
              </div>
              ${official ? `<strong class="official-chip ${official._live ? 'live-chip' : ''}">${official._live ? 'Ao vivo' : 'Oficial'}: ${escapeHtml(official.homeTeam || match.home)} ${official.homeGoals}-${official.awayGoals} ${escapeHtml(official.awayTeam || match.away)}</strong>` : '<span class="future-chip">Ainda por jogar</span>'}
            </div>
            <div class="viewer-picks">
              ${predictions.length ? predictions.map(row => {
                const score = official ? scoreOnePrediction(row.match, official) : null;
                const className = score ? (score.points === 3 ? 'hit-exact' : score.points === 1 ? 'hit-outcome' : 'miss') : '';
                const badge = score ? `<b>${score.points} pts</b>` : '';
                return `<div class="viewer-pick ${className}"><strong>${renderParticipantIdentity(row.player, row.item?.icon || row.item?.participantIcon || row.item?.playerIcon || '', 'participant-ident--compact')}</strong><span>${predictionResultText(row.match)}</span>${badge}</div>`;
              }).join('') : '<p class="modal-muted">Ainda não há prognósticos para este jogo.</p>'}
            </div>
          </section>
        `;
      }).join('') : `<div class="empty-state">Não há jogos nesta lista.</div>`}
    </div>
  `;
}

function sortIconFor(key) {
  if (ggamesTableSort.key !== key) return '';
  return ggamesTableSort.direction === 'asc' ? ' ↑' : ' ↓';
}

function sortedGgamesRows(rows) {
  if (ggamesTableSort.key === 'default') return rows;
  const key = ggamesTableSort.key;
  const dir = ggamesTableSort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    if (typeof av === 'string' || typeof bv === 'string') {
      return String(av).localeCompare(String(bv), 'pt-PT') * dir || (a.rank - b.rank);
    }
    return ((av - bv) * dir) || (a.rank - b.rank);
  });
}

function ggamesSortHeader(key, label, title = '') {
  const active = ggamesTableSort.key === key ? ' active' : '';
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<th><button type="button" class="ggames-sort-btn${active}" data-ggames-sort="${key}"${titleAttr}>${label}${sortIconFor(key)}</button></th>`;
}

function renderGgamesTable(options = {}) {
  const showBattles = options.battles !== false;
  const baseRows = calculateGgamesTable();
  const rows = sortedGgamesRows(baseRows);
  if (!rows.length) return '<div class="empty-state">Ainda não há jogadores para mostrar.</div>';
  return `
    <div class="leaderboard-layout">
      <section class="leaderboard-card">
        <h3>Tabela Ggames</h3>
        <div class="table-scroll">
          <table class="ggames-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Jogador</th>
                ${ggamesSortHeader('points', 'Pontos')}
                ${ggamesSortHeader('correctPredictions', 'A', 'Acertados')}
                ${ggamesSortHeader('failedPredictions', 'E', 'Errados')}
                ${ggamesSortHeader('goalsHit', 'GM', 'Golos marcados')}
                ${ggamesSortHeader('goalsMissed', 'GF', 'Golos falhados')}
                ${ggamesSortHeader('winsHit', 'Vitórias')}
                ${ggamesSortHeader('drawsHit', 'Empates')}
                ${ggamesSortHeader('lossesHit', 'Derrotas')}
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `<tr class="ggames-player-row" data-live-player="${escapeHtml(row.id)}" title="Ver histórico de ${escapeHtml(row.name)}">
                <td>${row.rank}</td><td><button type="button" class="ggames-player-link" data-live-player="${escapeHtml(row.id)}"><strong>${renderParticipantIdentity(row.name, row.icon, 'participant-ident--compact')}</strong></button></td><td><strong>${row.points}</strong></td><td>${row.correctPredictions}</td><td>${row.failedPredictions}</td><td title="Golos marcados">${row.goalsHit}</td><td title="Golos falhados">${row.goalsMissed}</td><td>${row.winsHit}</td><td>${row.drawsHit}</td><td>${row.lossesHit}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="ggames-info-row">
          <button type="button" class="ggames-info-btn" data-ggames-info aria-label="Ver regras de pontuação e desempate">i</button>
          <span>Regras de pontuação e desempate</span>
        </div>
      </section>
      ${showBattles ? `<aside class="battles-card">
        <h3>Giria Battles</h3>
        ${renderGiriaBattles(baseRows)}
      </aside>` : ''}
    </div>
  `;
}

function openGgamesRulesModal() {
  openModal(`
    <div class="modal-head">
      <div>
        <p class="eyebrow small">Tabela Ggames</p>
        <h2>Regras de pontuação</h2>
      </div>
    </div>
    <section class="rules-modal-content">
      <h3>Secção 1 — prognóstico inicial</h3>
      <ul>
        <li><strong>Fase de grupos:</strong> resultado exato = ${numericRule('groupExact')} pontos; acertar vencedor/empate = ${numericRule('groupOutcome')} ponto(s).</li>
        <li><strong>16 avos até meias/3.º lugar:</strong> resultado exato = ${numericRule('knockoutInitialExact')} pontos; acertar vencedor/apurado = ${numericRule('knockoutInitialWinner')} ponto(s).</li>
        <li><strong>Final:</strong> resultado exato = ${numericRule('finalInitialExact')} pontos; acertar o campeão/vencedor = ${numericRule('finalInitialWinner')} pontos; acertar apenas o desfecho = ${numericRule('finalInitialMethod')} ponto(s).</li>
      </ul>
      <h3>Secção 2 — reformulações nas eliminatórias</h3>
      <ul>
        <li>Se o jogador reformular um jogo dos 16 avos em diante, o resultado reformulado vale ${numericRule('knockoutReformExact')} ponto(s) se estiver exato.</li>
        <li>Na final, uma reformulação certa vale ${numericRule('finalReformExact')} ponto(s).</li>
        <li>As regras são lidas do Firebase em <strong>settings/worldcupScoringRules</strong>. Se o documento não existir, o site usa os valores padrão.</li>
      </ul>
      <h3>Estatísticas da tabela</h3>
      <ul>
        <li><strong>Acertados:</strong> prognósticos que deram pontos.</li>
        <li><strong>Falhados:</strong> prognósticos de jogos já disputados que não deram pontos.</li>
        <li><strong>GM:</strong> golos marcados — golos que o jogador acertou no prognóstico.</li>
        <li><strong>GF:</strong> golos falhados — diferença entre os golos previstos e os golos reais.</li>
        <li><strong>Vitórias/Empates/Derrotas:</strong> desfechos acertados pelo jogador.</li>
      </ul>
      <h3>Desempate</h3>
      <ol>
        <li>Mais pontos.</li>
        <li>Mais prognósticos acertados.</li>
        <li>Mais GM.</li>
        <li>Menos GF.</li>
      </ol>
    </section>
  `);
}

function renderGiriaBattles(rows) {
  if (rows.length < 2) return '<p class="modal-muted">Ainda não há confrontos suficientes.</p>';
  const futureMatches = data.matches.filter(match => !getOfficialResult(match.id) && getMatchDateObj(match) >= new Date());
  const cards = [];
  for (let i = 0; i < rows.length - 1 && cards.length < 8; i++) {
    const top = rows[i];
    const below = rows[i + 1];
    if (Math.abs(top.points - below.points) > 3) continue;
    const p1 = publicPredictions.find(p => p.id === top.id);
    const p2 = publicPredictions.find(p => p.id === below.id);
    const nextMatch = futureMatches.find(match =>
      (p1?.matches || []).some(pred => Number(pred.id) === Number(match.id)) &&
      (p2?.matches || []).some(pred => Number(pred.id) === Number(match.id))
    );
    if (!nextMatch) continue;
    const pred1 = (p1.matches || []).find(pred => Number(pred.id) === Number(nextMatch.id));
    const pred2 = (p2.matches || []).find(pred => Number(pred.id) === Number(nextMatch.id));
    cards.push(`
      <div class="battle-card battle-card-horizontal">
        <span class="battle-match">Jogo ${nextMatch.id} · ${escapeHtml(nextMatch.home)} vs ${escapeHtml(nextMatch.away)}</span>
        <div class="battle-duel-row">
          <div class="battle-player battle-player-a"><strong>${renderParticipantIdentity(`#${top.rank} ${top.name}`, p1?.icon || p1?.participantIcon || p1?.playerIcon || top.icon, 'participant-ident--compact')}</strong><span>${predictionResultText(pred1)}</span></div>
          <b class="battle-versus">VS</b>
          <div class="battle-player battle-player-b"><strong>${renderParticipantIdentity(`#${below.rank} ${below.name}`, p2?.icon || p2?.participantIcon || p2?.playerIcon || below.icon, 'participant-ident--compact')}</strong><span>${predictionResultText(pred2)}</span></div>
        </div>
      </div>
    `);
  }
  return cards.join('') || '<p class="modal-muted">Ainda não há batalhas próximas.</p>';
}


function renderPublicViewer(active = 'players') {
  return `
    <div class="modal-head">
      <div>
        <p class="eyebrow small">Prognósticos gravados</p>
        <h2>Outros jogadores</h2>
        <p class="modal-muted">Consulta os prognósticos por jogador, por jogo ou pela Tabela Ggames.</p>
      </div>
    </div>
    <div class="viewer-tabs">
      <button type="button" class="viewer-tab ${active === 'players' ? 'active' : ''}" data-view-tab="players">Por jogador</button>
      <button type="button" class="viewer-tab ${active === 'games' ? 'active' : ''}" data-view-tab="games">Por jogo</button>
      <button type="button" class="viewer-tab ${active === 'table' ? 'active' : ''}" data-view-tab="table">Tabela Ggames</button>
    </div>
    <div id="viewerBody">
      ${active === 'players' ? renderPublicPlayerList() : active === 'games' ? renderPublicByGame(publicViewerStage, publicGameFilter) : renderGgamesTable()}
    </div>
  `;
}



function isMobileClosedView() {
  return isVotingClosed() && window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
}

function updateMobileAppNav() {
  const nav = $('#mobileAppNav');
  if (!nav) return;
  const show = isVotingClosed();
  nav.hidden = !show;
  nav.querySelectorAll('[data-mobile-section]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mobileSection === mobileAppSection);
  });
  document.body.classList.toggle('mobile-section-games', mobileAppSection === 'games');
  document.body.classList.toggle('mobile-section-results', mobileAppSection === 'results');
  document.body.classList.toggle('mobile-section-prognostics', mobileAppSection === 'prognostics');
}

function setMobileAppSection(section) {
  mobileAppSection = section || 'games';
  updateMobileAppNav();
  refreshLiveDashboardView();
  requestAnimationFrame(() => {
    const target = $('#closedLiveDashboard');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

async function openMobilePublicPredictionsPage(active = 'games') {
  mobileAppSection = 'prognostics';
  mobilePublicViewerLoading = true;
  mobilePublicViewerHtml = '<div class="live-loading-card">A carregar prognósticos dos jogadores...</div>';
  updateMobileAppNav();
  refreshLiveDashboardView();
  try {
    await Promise.allSettled([loadApiWorldCupData({ sync: false }), loadPublicPredictions()]);
    mobilePublicViewerHtml = renderPublicViewer(active);
  } catch (error) {
    console.error(error);
    mobilePublicViewerHtml = '<div class="live-loading-card">Não foi possível carregar os prognósticos. Tenta novamente mais tarde.</div>';
  } finally {
    mobilePublicViewerLoading = false;
    updateMobileAppNav();
    refreshLiveDashboardView();
  }
}

async function openPublicPredictionsEntry() {
  if (isMobileClosedView()) {
    await openMobilePublicPredictionsPage('games');
    return;
  }
  await openPublicPredictionsModal();
}

async function openPublicPredictionsModal() {
  openModal('<h2>Outros jogadores</h2><p class="modal-muted">A carregar prognósticos...</p>');
  try {
    await Promise.allSettled([loadApiWorldCupData({ sync: false }), loadPublicPredictions()]);
    openModal(renderPublicViewer('games'));
  } catch (error) {
    console.error(error);
    openModal('<h2>Outros jogadores</h2><p class="modal-muted">Não foi possível carregar os prognósticos. Tenta novamente mais tarde.</p>');
  }
}

function showFirstMissing(info) {
  if (info.missingName) {
    $('#userName')?.focus();
    alert('Tens de preencher o nome antes de gravar.');
    return;
  }
  const first = info.missingMatches[0];
  if (!first) return;
  state.activeStage = first.stage;
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.stage === first.stage));
  renderMatches();
  requestAnimationFrame(() => {
    const card = document.querySelector(`.match-card[data-match-id="${first.id}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card?.classList.add('invalid');
  });
  alert(`Ainda falta preencher o Jogo ${first.id}.`);
}

async function saveToFirebase() {
  state.name = ($('#userName')?.value || '').trim();
  saveState();

  const info = completionInfo();
  if (!info.complete) {
    showFirstMissing(info);
    updateSaveButton();
    return;
  }
  if (!firestoreDb || !firebaseTools) {
    alert('A gravação ainda não está pronta. Confirma a internet e tenta novamente.');
    return;
  }
  refreshVotingDeadlineState();
  if (isVotingClosed()) {
    alert('As votações já estão encerradas. Agora só é possível ver os prognósticos dos outros jogadores.');
    applyVotingDeadlineUi();
    return;
  }

  const btn = $('#saveFirebaseBtn');
  const status = $('#firebaseStatus');
  const previousText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'A gravar...';
  status.textContent = 'A verificar se já existe um prognóstico com este nome ou deste dispositivo...';

  try {
    const participantKey = normalizeParticipantName(state.name);
    const visitorKey = await getVisitorKey();
    const existing = await findExistingSubmission(participantKey, visitorKey);
    if (existing?.reason === 'name') {
      status.textContent = 'Este nome já tem um prognóstico gravado.';
      alert('Esse nome já gravou um prognóstico. Usa outro nome ou pede ao administrador para remover o antigo.');
      return;
    }
    if (existing?.reason === 'visitor') {
      status.textContent = 'Este dispositivo/rede já gravou um prognóstico.';
      alert('Este dispositivo/rede já gravou um prognóstico. Só é permitido gravar uma vez.');
      return;
    }

    status.textContent = 'A gravar o teu prognóstico...';
    const payload = buildSubmissionPayload(participantKey, visitorKey);
    payload.pinHash = await hashPinForParticipant(participantKey, payload.pin);
    const docId = participantKey;
    const batch = firebaseTools.writeBatch(firestoreDb);
    const predictionRef = firebaseTools.doc(firestoreDb, FIREBASE_COLLECTION, docId);
    const visitorRef = firebaseTools.doc(firestoreDb, 'worldcupextraVisitors', visitorKey);
    batch.set(predictionRef, payload);
    batch.set(visitorRef, {
      participantKey,
      participantName: state.name,
      createdAt: firebaseTools.serverTimestamp(),
      clientTimestamp: new Date().toISOString()
    });
    await batch.commit();
    const createdPin = payload.pin || getOrCreateParticipantPin(participantKey);
    status.textContent = `Prognóstico gravado com sucesso. PIN: ${createdPin}`;
    alert(`Prognóstico gravado com sucesso. Guarda este PIN para poderes reformular nas eliminatórias: ${createdPin}`);
    state.lastSaved = new Date().toLocaleString('pt-PT');
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    localStorage.setItem('worldcup2026_submission_saved', docId);
    updateSummary();
  } catch (error) {
    console.error('Erro ao gravar:', error);
    status.textContent = 'Erro ao gravar. Tenta novamente mais tarde.';
    alert('Não foi possível gravar. Tenta novamente mais tarde.');
  } finally {
    btn.textContent = previousText;
    updateSaveButton();
  }
}

function bindEvents() {
  $('#saveNameBtn').addEventListener('click', () => {
    state.name = $('#userName').value.trim();
    $('#saveStatus').textContent = state.name ? 'Nome guardado.' : 'Nome apagado.';
    saveState();
  });

  $('#userName').addEventListener('input', () => {
    state.name = $('#userName').value.trim();
    updateSummary();
  });

  $('#userName').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') $('#saveNameBtn').click();
  });

  $('#saveFirebaseBtn').addEventListener('click', saveToFirebase);

  document.querySelector('.tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;
    state.activeStage = tab.dataset.stage;
    document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn === tab));
    renderMatches();
    saveState();
  });

  $('#matchesContainer').addEventListener('click', (event) => {
    const teamBtn = event.target.closest('.team-link');
    if (teamBtn) {
      event.stopPropagation();
      openTeamModal(teamBtn.dataset.team);
      return;
    }
    const interactive = event.target.closest('input, select, button');
    if (interactive) return;
    if (isVotingClosed()) return;
    if (isVotingClosed()) return;
    const card = event.target.closest('.match-card');
    if (card) openMatchModal(card.dataset.matchId);
  });

  document.body.addEventListener('click', (event) => {
    const ggamesInfo = event.target.closest('[data-ggames-info]');
    if (ggamesInfo) {
      event.stopPropagation();
      openGgamesRulesModal();
      return;
    }

    const ggamesSort = event.target.closest('[data-ggames-sort]');
    if (ggamesSort) {
      event.stopPropagation();
      const key = ggamesSort.dataset.ggamesSort;
      if (ggamesTableSort.key === key) {
        ggamesTableSort.direction = ggamesTableSort.direction === 'desc' ? 'asc' : 'desc';
      } else {
        ggamesTableSort = { key, direction: key === 'failedPredictions' || key === 'goalsMissed' ? 'asc' : 'desc' };
      }
      const viewerBody = $('#viewerBody');
      if (viewerBody && viewerBody.contains(ggamesSort)) {
        viewerBody.innerHTML = renderGgamesTable();
      } else {
        refreshLiveDashboardView();
      }
      return;
    }

    const viewerTab = event.target.closest('[data-view-tab]');
    if (viewerTab) {
      event.stopPropagation();
      $('#viewerBody').innerHTML = viewerTab.dataset.viewTab === 'players' ? renderPublicPlayerList() : viewerTab.dataset.viewTab === 'games' ? renderPublicByGame(publicViewerStage, publicGameFilter) : renderGgamesTable();
      document.querySelectorAll('.viewer-tab').forEach(btn => btn.classList.toggle('active', btn === viewerTab));
      return;
    }

    const viewerPlayer = event.target.closest('[data-view-player]');
    if (viewerPlayer) {
      event.stopPropagation();
      const details = $('#viewerDetails');
      if (details) details.innerHTML = renderPublicPlayerDetails(viewerPlayer.dataset.viewPlayer);
      return;
    }

    const viewerStage = event.target.closest('[data-view-stage]');
    if (viewerStage) {
      event.stopPropagation();
      publicViewerStage = viewerStage.dataset.viewStage;
      $('#viewerBody').innerHTML = renderPublicByGame(publicViewerStage, publicGameFilter);
      return;
    }

    const gameFilter = event.target.closest('[data-game-filter]');
    if (gameFilter) {
      event.stopPropagation();
      publicGameFilter = gameFilter.dataset.gameFilter;
      $('#viewerBody').innerHTML = renderPublicByGame(publicViewerStage, publicGameFilter);
      return;
    }

    const liveLeft = event.target.closest('[data-live-left]');
    if (liveLeft) {
      event.stopPropagation();
      liveLeftTab = liveLeft.dataset.liveLeft;
      refreshLiveDashboardView();
      return;
    }

    const liveRight = event.target.closest('[data-live-right]');
    if (liveRight) {
      event.stopPropagation();
      liveRightTab = liveRight.dataset.liveRight;
      refreshLiveDashboardView();
      return;
    }

    const mobileNavBtn = event.target.closest('[data-mobile-section]');
    if (mobileNavBtn) {
      event.stopPropagation();
      const section = mobileNavBtn.dataset.mobileSection;
      if (section === 'prognostics') {
        openMobilePublicPredictionsPage('games');
      } else {
        setMobileAppSection(section);
      }
      return;
    }

    const liveMatchBtn = event.target.closest('[data-live-match]');
    if (liveMatchBtn) {
      event.stopPropagation();
      openLiveMatchModal(liveMatchBtn.dataset.liveMatch);
      return;
    }

    const livePlayerBtn = event.target.closest('[data-live-player]');
    if (livePlayerBtn) {
      event.stopPropagation();
      openGgamesPlayerHistory(livePlayerBtn.dataset.livePlayer);
      return;
    }

    const playerBtn = event.target.closest('[data-player-id]');
    if (playerBtn) {
      event.stopPropagation();
      openPlayerModal(playerBtn.dataset.team, playerBtn.dataset.playerId);
      return;
    }
    if (event.target.matches('.modal-close') || event.target.matches('.modal-backdrop')) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  $('#matchesContainer').addEventListener('input', (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    const card = event.target.closest('.match-card');
    const id = card.dataset.matchId;
    const pred = getPrediction(id);
    if (field === 'homeGoals' || field === 'awayGoals') {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 2);
    }
    pred[field] = event.target.value;
    state.predictions[String(id)] = pred;
    if (field === 'homeGoals' || field === 'awayGoals') autoWinner(id);
    saveState();
    renderMatchesPreservingPosition(event.target);
  });

  $('#matchesContainer').addEventListener('change', (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    const card = event.target.closest('.match-card');
    const id = card.dataset.matchId;
    const pred = getPrediction(id);
    if (field === 'homeGoals' || field === 'awayGoals') {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 2);
    }
    pred[field] = event.target.value;
    state.predictions[String(id)] = pred;
    saveState();
    renderMatchesPreservingPosition(event.target);
  });

  $('#clearBtn').addEventListener('click', () => {
    if (isVotingClosed()) return;
    const ok = confirm('Queres mesmo apagar todos os prognósticos guardados neste navegador?');
    if (!ok) return;
    state.predictions = {};
    saveState();
    renderMatches();
  });

  $('#viewOthersBtn').addEventListener('click', openPublicPredictionsEntry);
  $('#viewOthersBtnClosed')?.addEventListener('click', openPublicPredictionsEntry);

  $('#exportPdfBtn').addEventListener('click', exportPdf);
}

async function exportPdf() {
  saveState();
  const area = $('#pdfArea');
  const filename = `prognosticos-mundial-2026-${(state.name || 'participante').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.pdf`;

  if (!window.html2canvas || !window.jspdf) {
    window.print();
    return;
  }

  const activeStage = state.activeStage;
  const originalHtml = $('#matchesContainer').innerHTML;
  const tabs = document.querySelectorAll('.tab');

  $('#matchesContainer').innerHTML = Object.keys(STAGE_LABELS).map(stage =>
    `<section class="pdf-stage"><h2>${STAGE_LABELS[stage]}</h2>${renderStage(stage)}</section>`
  ).join('');

  const canvas = await html2canvas(area, { scale: 1.5, backgroundColor: '#07111f' });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = canvas.height * imgWidth / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  pdf.save(filename);

  state.activeStage = activeStage;
  $('#matchesContainer').innerHTML = originalHtml;
  tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.stage === activeStage));
  renderMatches();
}

async function init() {
  try {
    const [matchesResponse, squadsResponse] = await Promise.all([fetch('matches.json'), fetch('squads.json')]);
    data = await matchesResponse.json();
    squadsData = await squadsResponse.json();
    loadState();
    bindEvents();
    window.addEventListener('resize', updateMobileAppNav);
    updateMobileAppNav();
    updateSummary();
    renderMatches();
    await initFirebase();
    hideLoadingScreen();
  } catch (error) {
    hideLoadingScreen();
    $('#matchesContainer').innerHTML = `<div class="empty-state">Erro ao carregar o calendário e as equipas. Abre o site através de um servidor local, por exemplo VS Code + Live Server.</div>`;
    console.error(error);
  }
}

init();



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
  const scheduleLive = isMatchInLiveWindow(match);
  return {
    id: String(match.id),
    matchId: String(match.id),
    stage: match.stage,
    group: match.group || null,
    date: match.date,
    time: match.time || '',
    homeTeam: match.home,
    awayTeam: match.away,
    homeGoals: null,
    awayGoals: null,
    homeScorers: null,
    awayScorers: null,
    finished: false,
    live: scheduleLive,
    timeElapsed: scheduleLive ? `~${elapsedMinuteFromSchedule(match)}` : 'notstarted',
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
  const finished = ggamesStatusIsFinished(statusText) || (!!event.intHomeScore && !!event.intAwayScore && !liveBySchedule);
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
  const finished = !!best.finished;
  const live = !finished && !!(best.live || localGame.live);
  const timeElapsed = finished
    ? (best.timeElapsed || 'FT')
    : (best.live && !String(best.timeElapsed || '').startsWith('~')
        ? best.timeElapsed
        : (localGame.live ? localGame.timeElapsed : best.timeElapsed));

  // Se uma API tem marcador/estado melhor, entra; senão fica o fallback local.
  return {
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
    finished,
    live,
    timeElapsed,
    _apiSources: candidates.map(c => c.source).filter(Boolean)
  };
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
  return /finished|ft|full.?time|ended|after extra|pen/i.test(String(value || ''));
}

function ggamesHighlightlyStatusIsLive(value) {
  return /live|in.?play|first|second|half.?time|1h|2h|ht|^\d{1,3}/i.test(String(value || ''));
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
  const minute = item.minute ?? item.time?.minute ?? item.elapsed ?? item.status?.elapsed ?? '';

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
    timeElapsed: live && minute ? String(minute) : (live ? 'live' : status || 'notstarted'),
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
    const payloads = await Promise.all(paths.map(path => ggamesFetchHighlightly(path).catch(() => null)));
    const matches = payloads.flatMap(payload =>
      ggamesArrayFromPayload(payload, 'matches')
        .concat(ggamesArrayFromPayload(payload, 'fixtures'))
        .concat(ggamesArrayFromPayload(payload, 'data'))
    );
    result.games = matches.map(ggamesNormalizeHighlightlyMatch).filter(Boolean);
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
  return /finished|ft|after extra|penalties/i.test(String(event.event_status || event.event_status_info || event.event_final_result || '')) ||
    (!!event.event_ft_result && String(event.event_ft_result).includes(' - '));
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
  const minute = event.time?.currentPeriodStartTimestamp
    ? Math.max(1, Math.floor((Date.now() / 1000 - Number(event.time.currentPeriodStartTimestamp)) / 60))
    : (event.statusTime?.prefix || event.statusTime?.short || event.statusTime?.long || '');

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
  }));
}

async function loadApiWorldCupData({ sync = false } = {}) {
  const shouldShowLoadingNotice = !sync || !worldCupApi.loaded;
  if (shouldShowLoadingNotice) {
    apiLoadingRequests += 1;
    setApiLoadingNotice(true);
  }

  try {
    const canFetchExtra = ggamesCanFetchExtraLiveApis();
    const [apiFootball, footballData, highlightly, allSports, sofaScore, espn, primary, sportsDb] = await Promise.all([
      ggamesLoadApiFootball(),
      canFetchExtra ? ggamesLoadFootballData() : Promise.resolve({ ok: true, games: (worldCupApi.games || []).filter(g => g.source === 'football-data'), cached: true }),
      canFetchExtra ? ggamesLoadHighlightly() : Promise.resolve({ ok: true, games: (worldCupApi.games || []).filter(g => g.source === 'Highlightly'), cached: true }),
      canFetchExtra ? ggamesLoadAllSports() : Promise.resolve({ ok: true, games: (worldCupApi.games || []).filter(g => g.source === 'AllSportsAPI'), cached: true }),
      canFetchExtra ? ggamesLoadSofaScore() : Promise.resolve({ ok: true, games: (worldCupApi.games || []).filter(g => g.source === 'SofaScore'), cached: true }),
      canFetchExtra ? ggamesLoadEspn() : Promise.resolve({ ok: true, games: (worldCupApi.games || []).filter(g => g.source === 'ESPN'), cached: true }),
      ggamesLoadWorldCup26(),
      ggamesLoadSportsDb()
    ]);

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

    worldCupApi.games = mergedGames;
    worldCupApi.groups = primary.groups?.length ? primary.groups : ggamesBuildGroupsFromCurrentGames(mergedGames);
    worldCupApi.loaded = true;
    worldCupApi.error = (!apiFootball.ok && !footballData.ok && !highlightly.ok && !allSports.ok && !sofaScore.ok && !espn.ok && !primary.ok && !sportsDb.ok)
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
      officialResults = loaded.officialByMatchId;
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
