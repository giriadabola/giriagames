export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD8WcFD7jC55feYYqdY7aJSgxXyXkEjTX0',
  authDomain: 'g-games-8a8fc.firebaseapp.com',
  projectId: 'g-games-8a8fc',
  storageBucket: 'g-games-8a8fc.firebasestorage.app',
  messagingSenderId: '689897349449',
  appId: '1:689897349449:web:536599794579901beb7a98',
  measurementId: 'G-GTTPJ6G5MD'
};

export const DEFAULT_SCORING_RULES = {
  groupExact: 3,
  groupOutcome: 1,
  knockoutInitialExact: 5,
  knockoutInitialWinner: 3,
  finalInitialExact: 6,
  finalInitialWinner: 4,
  finalInitialMethod: 2
};

let firebaseTools = null;

export async function loadProfileData() {
  const [matches, firebase] = await Promise.all([loadMatches(), initFirebase()]);
  const [rules, docs, matchDocs, secureDocs, sofaDocs] = await Promise.all([
    loadScoringRules(firebase),
    loadCollection(firebase, 'worldcupextra'),
    loadCollection(firebase, 'worldcupextraMatches'),
    loadCollection(firebase, 'WoldCupSecureHT'),
    loadCollection(firebase, 'worldcupSofa')
  ]);

  const officialByMatchId = {};

  const legacyOfficial = docs
    .filter((doc) => doc.status === 'official' || doc.type === 'officialResult' || doc.status === 'finished')
    .filter((doc) => doc.matchId != null || String(doc.id || '').startsWith('official-match-'))
    .map((doc) => normalizeOfficialDoc(doc))
    .filter((doc) => doc.matchId != null && hasScore(doc));

  legacyOfficial.forEach((doc) => {
    officialByMatchId[String(doc.matchId)] = doc;
  });

  matchDocs
    .map((doc) => normalizeOfficialDoc(doc))
    .filter((doc) => doc.matchId != null && hasScore(doc))
    .forEach((doc) => {
      officialByMatchId[String(doc.matchId)] = doc;
    });

  secureDocs
    .map((doc) => normalizeOfficialDoc(doc))
    .filter((doc) => doc.matchId != null && hasScore(doc))
    .forEach((doc) => {
      officialByMatchId[String(doc.matchId)] = doc;
    });

  const players = docs
    .filter((doc) => doc.status !== 'official' && doc.type !== 'officialResult' && Array.isArray(doc.matches))
    .map((doc) => ({
      id: doc.id,
      participantName: doc.participantName || doc.name || 'Participante',
      icon: doc.icon || doc.participantIcon || doc.playerIcon || '',
      matches: doc.matches
    }))
    .sort((a, b) => a.participantName.localeCompare(b.participantName, 'pt-PT'));

  const sofaByMatchId = Object.fromEntries(
    sofaDocs.map((doc) => {
      const matchId = String(doc.matchId ?? String(doc.id || '').replace(/^match_/, ''));
      return [matchId, normalizeSofaDoc(doc)];
    })
  );

  return { matches, players, officialByMatchId, sofaByMatchId, scoringRules: rules };
}

async function loadMatches() {
  const response = await fetch('./matches.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar matches.json.');
  const payload = await response.json();
  return Array.isArray(payload?.matches) ? payload.matches : [];
}

async function initFirebase() {
  if (firebaseTools) return firebaseTools;
  const appModule = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
  const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  const app = appModule.initializeApp(FIREBASE_CONFIG);
  firebaseTools = { db: firestoreModule.getFirestore(app), ...firestoreModule };
  return firebaseTools;
}

async function loadCollection(firebase, name) {
  const snap = await firebase.getDocs(firebase.collection(firebase.db, name));
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

async function loadScoringRules(firebase) {
  try {
    const snap = await firebase.getDoc(firebase.doc(firebase.db, 'settings', 'worldcupScoringRules'));
    if (!snap.exists()) return { ...DEFAULT_SCORING_RULES };
    const raw = snap.data();
    return Object.fromEntries(
      Object.entries(DEFAULT_SCORING_RULES).map(([key, fallback]) => {
        const value = Number(raw?.[key]);
        return [key, Number.isFinite(value) && value >= 0 ? value : fallback];
      })
    );
  } catch {
    return { ...DEFAULT_SCORING_RULES };
  }
}

function hasScore(doc) {
  return doc && doc.homeGoals != null && doc.homeGoals !== '' && doc.awayGoals != null && doc.awayGoals !== '';
}

function normalizeOfficialDoc(raw = {}) {
  const isLive = raw.live === true || raw.status === 'live';
  const matchId = Number(raw.matchId ?? String(raw.id || '').replace(/^match_/, '').replace(/^official-match-/, ''));
  return {
    ...raw,
    matchId: Number.isFinite(matchId) ? matchId : null,
    homeTeam: raw.homeTeam || raw.home,
    awayTeam: raw.awayTeam || raw.away,
    homeGoals: isLive ? (raw.homeGoalsLive ?? raw.homeGoals ?? null) : (raw.homeGoals ?? raw.homeGoalsLive ?? null),
    awayGoals: isLive ? (raw.awayGoalsLive ?? raw.awayGoals ?? null) : (raw.awayGoals ?? raw.awayGoalsLive ?? null)
  };
}

function normalizeSofaDoc(raw = {}) {
  return {
    ...raw,
    homeTeam: raw.homeTeam || raw.home,
    awayTeam: raw.awayTeam || raw.away,
    homeGoals: raw.homeGoals ?? null,
    awayGoals: raw.awayGoals ?? null,
    homeGoalsList: Array.isArray(raw.homeGoalsList) ? raw.homeGoalsList : [],
    awayGoalsList: Array.isArray(raw.awayGoalsList) ? raw.awayGoalsList : []
  };
}
