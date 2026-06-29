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
  knockoutInitialExact: 6,
  knockoutInitialWinner: 2,
  finalInitialExact: 8,
  finalInitialWinner: 4,
  finalInitialMethod: 2,
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
  initialExactFinal: 10,
  initialWinnerFinal: 4
};

let firebaseTools = null;

async function loadCollectionSafe(firebase, name) {
  try {
    return await loadCollection(firebase, name);
  } catch (err) {
    console.warn(`Failed to load collection ${name}:`, err);
    return [];
  }
}

async function loadFlags() {
  try {
    const response = await fetch('./mundial2026_bandeiras_redondas.json');
    if (response.ok) {
      const flagsJson = await response.json();
      const flagsMap = {};
      if (Array.isArray(flagsJson.teams)) {
        flagsJson.teams.forEach(t => {
          flagsMap[t.nome.toLowerCase().trim()] = t.flagRound;
          flagsMap[t.name.toLowerCase().trim()] = t.flagRound;
          if (t.aliases) {
            t.aliases.forEach(alias => {
              flagsMap[alias.toLowerCase().trim()] = t.flagRound;
            });
          }
        });
      }
      return flagsMap;
    }
  } catch (e) {
    console.warn('Falha ao carregar bandeiras', e);
  }
  return {};
}

export async function loadProfileData() {
  const [matches, firebase] = await Promise.all([loadMatches(), initFirebase()]);
  const [rules, docs, matchDocs, secureDocs, sofaDocs, battleDocs, pickDocs, reformDocs, flags] = await Promise.all([
    loadScoringRules(firebase),
    loadCollectionSafe(firebase, 'worldcupextra'),
    loadCollectionSafe(firebase, 'worldcupextraMatches'),
    loadCollectionSafe(firebase, 'WoldCupSecureHT'),
    loadCollectionSafe(firebase, 'worldcupSofa'),
    loadCollectionSafe(firebase, 'worldcupextraLiveBattles'),
    loadCollectionSafe(firebase, 'worldcupextraBattleScorers'),
    loadCollectionSafe(firebase, 'worldcupextraReforms'),
    loadFlags()
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
      participantKey: doc.participantKey || '',
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

  // Align matches.json IDs with worldcupextraReforms matchId for knockout matches
  const isSameTeam = (name1, name2) => {
    if (!name1 || !name2) return false;
    return name1.toLowerCase().trim() === name2.toLowerCase().trim();
  };

  matches.forEach(m => {
    if (m.stage && m.stage !== 'groups') {
      const home = m.home || m.homeTeam || '';
      const away = m.away || m.awayTeam || '';
      const stage = m.stage || '';
      const reform = reformDocs.find(doc => {
        const stageMatches = doc.stage && stage && (doc.stage.toLowerCase().trim() === stage.toLowerCase().trim());
        return isSameTeam(doc.homeTeam, home) && isSameTeam(doc.awayTeam, away) && stageMatches;
      });
      if (reform && reform.matchId != null) {
        m.id = Number(reform.matchId);
      }
    }
  });

  // Sort matches by ID so they are in correct numeric order
  matches.sort((a, b) => Number(a.id) - Number(b.id));

  return { matches, players, officialByMatchId, sofaByMatchId, scoringRules: rules, battleDocs, pickDocs, reformDocs, flags };
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
