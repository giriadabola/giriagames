#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Dynamically import/require firebase-admin
let admin;
try {
  admin = require('firebase-admin');
} catch (err) {
  console.error("Erro: 'firebase-admin' não está instalado. Corre 'npm install firebase-admin'.");
  process.exit(1);
}

// Global configurations & team aliases matching script.js
const FIREBASE_MATCHES_COLLECTION = 'worldcupextraMatches';

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
  'brasil': 'brazil',
  'brazil': 'brazil',
  'suica': 'switzerland',
  'croacia': 'croatia',
  'servia': 'serbia',
  'argelia': 'algeria',
  'egito': 'egypt',
  'camaroes': 'cameroon'
};

function normalizeTeamForApi(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(the|and|e|de|da|do|republic|rep)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function apiTeamKey(name) {
  const base = normalizeTeamForApi(name);
  return API_TEAM_ALIASES[base] || base;
}

function apiTeamsMatch(homeA, awayA, homeB, awayB) {
  const aH = apiTeamKey(homeA), aA = apiTeamKey(awayA), bH = apiTeamKey(homeB), bA = apiTeamKey(awayB);
  if (!aH || !aA || !bH || !bA) return false;
  return (aH === bH && aA === bA) || (aH === bA && aA === bH);
}

// Load local database of matches
const matchesFilePath = path.join(__dirname, '../matches.json');
if (!fs.existsSync(matchesFilePath)) {
  console.error(`Ficheiro não encontrado: ${matchesFilePath}`);
  process.exit(1);
}
const localMatchesData = JSON.parse(fs.readFileSync(matchesFilePath, 'utf8'));
const localMatches = localMatchesData.matches || [];

function findLocalMatchByTeams(home, away, date) {
  return localMatches.find(m => {
    const teamsMatch = apiTeamsMatch(m.home, m.away, home, away);
    if (!teamsMatch) return false;
    if (!date) return true;
    return m.date === date;
  });
}

function normalizeApiScore(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Get dates around today (yesterday, today, tomorrow)
function getRelevantDates() {
  const dates = [];
  const now = new Date();
  for (let i = -1; i <= 1; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// 1. Fetch worldcup26.ir
async function fetchWorldCup26() {
  try {
    const res = await fetch('https://worldcup26.ir/get/games');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const games = data.games || data.data || [];
    return games.map(g => {
      const local = findLocalMatchByTeams(g.home_team, g.away_team, g.date);
      if (!local) return null;
      const homeGoals = normalizeApiScore(g.home_score);
      const awayGoals = normalizeApiScore(g.away_score);
      const finished = String(g.status || '').toLowerCase() === 'finished';
      const live = String(g.status || '').toLowerCase() === 'live';
      return {
        id: String(local.id),
        homeGoals,
        awayGoals,
        finished,
        live,
        timeElapsed: g.time_elapsed || '',
        source: 'worldcup26.ir'
      };
    }).filter(Boolean);
  } catch (err) {
    console.warn('worldcup26.ir falhou:', err.message);
    return [];
  }
}

// 2. Fetch ESPN
async function fetchEspn() {
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const events = data.events || [];
    return events.map(event => {
      const comp = event.competitions?.[0] || {};
      const competitors = comp.competitors || [];
      const home = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
      const away = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
      const local = findLocalMatchByTeams(home.team?.displayName || home.team?.name, away.team?.displayName || away.team?.name, String(event.date || '').slice(0, 10));
      if (!local) return null;

      const status = event.status || comp.status || {};
      const finished = !!status.type?.completed;
      const live = !finished && (status.type?.state === 'in' || /progress|live/i.test(status.type?.name || ''));
      return {
        id: String(local.id),
        homeGoals: normalizeApiScore(home.score),
        awayGoals: normalizeApiScore(away.score),
        finished,
        live,
        timeElapsed: live ? (status.displayClock || 'live') : (finished ? 'FT' : 'notstarted'),
        source: 'ESPN'
      };
    }).filter(Boolean);
  } catch (err) {
    console.warn('ESPN falhou:', err.message);
    return [];
  }
}

// 3. Fetch SofaScore
async function fetchSofaScore() {
  const dates = getRelevantDates();
  const allGames = [];
  for (const date of dates) {
    try {
      const res = await fetch(`https://www.sofascore.com/api/v1/sport/football/scheduled-events/${date}`);
      if (!res.ok) continue;
      const data = await res.json();
      const events = data.events || [];
      events.forEach(event => {
        const local = findLocalMatchByTeams(event.homeTeam?.name || event.homeTeam?.shortName, event.awayTeam?.name || event.awayTeam?.shortName, date);
        if (!local) return;

        const status = event.status || {};
        const type = String(status.type || '').toLowerCase();
        const finished = ['finished', 'afterpenalties', 'afterextratime'].includes(type) || /finished|ended|full.?time|ft/i.test(type);
        const live = !finished && (['inprogress', 'halftime', 'live', 'interrupted'].includes(type) || /live|progress|half|in.?play/i.test(type));
        const minute = event.statusTime?.short || event.statusTime?.long || '';

        allGames.push({
          id: String(local.id),
          homeGoals: normalizeApiScore(event.homeScore?.current),
          awayGoals: normalizeApiScore(event.awayScore?.current),
          finished,
          live,
          timeElapsed: live && minute ? String(minute) : (finished ? 'FT' : 'notstarted'),
          source: 'SofaScore'
        });
      });
    } catch (err) {
      console.warn(`SofaScore data ${date} falhou:`, err.message);
    }
  }
  return allGames;
}

// Initialize Firebase
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountKey) {
  console.error("Erro: Variável de ambiente 'FIREBASE_SERVICE_ACCOUNT_KEY' não definida.");
  process.exit(1);
}

let db;
try {
  const serviceAccount = JSON.parse(serviceAccountKey);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log('Firebase ligado com sucesso via Admin SDK.');
} catch (err) {
  console.error('Erro ao inicializar Firebase:', err.message);
  process.exit(1);
}

// Rules for writing
function isMatchBeforeKickoff(match, now = new Date()) {
  if (!match || !match.date) return false;
  const kickoff = new Date(`${match.date}T${match.time || '12:00'}:00`);
  return now < kickoff;
}

function ggamesMatchKickoffStillFuture(existingData) {
  if (!existingData || !existingData.kickoff) return false;
  const kickoffDate = existingData.kickoff.toDate ? existingData.kickoff.toDate() : new Date(existingData.kickoff);
  return Date.now() < kickoffDate.getTime();
}

async function runSync() {
  console.log('A obter dados das APIs...');
  const [wcList, espnList, ssList] = await Promise.all([
    fetchWorldCup26(),
    fetchEspn(),
    fetchSofaScore()
  ]);

  // Merge findings (ESPN > SofaScore > worldcup26.ir)
  const merged = {};
  const lists = [wcList, ssList, espnList]; // Last has priority
  lists.forEach(list => {
    list.forEach(game => {
      merged[game.id] = game;
    });
  });

  const gamesToUpdate = Object.values(merged);
  console.log(`Encontrados ${gamesToUpdate.length} jogos mapeados com dados ativos.`);

  if (gamesToUpdate.length === 0) {
    console.log('Sem dados novos para atualizar.');
    return;
  }

  // Load current Firestore states
  console.log('A carregar documentos atuais do Firestore...');
  const snapshot = await db.collection(FIREBASE_MATCHES_COLLECTION).get();
  const currentDocs = {};
  snapshot.forEach(doc => {
    currentDocs[doc.id] = doc.data();
  });

  const batch = db.batch();
  let updateCount = 0;

  for (const game of gamesToUpdate) {
    const docId = `match_${String(game.id).padStart(3, '0')}`;
    const existing = currentDocs[docId] || null;
    const local = localMatches.find(m => String(m.id) === String(game.id));

    // Regra 1: Kickoff no futuro
    if (ggamesMatchKickoffStillFuture(existing) || (local && isMatchBeforeKickoff(local))) {
      console.log(`Jogo ${game.id} saltado: Kickoff ainda no futuro.`);
      continue;
    }

    // Regra 2: Status já é finished
    if (existing?.status === 'finished') {
      continue;
    }

    // Regra 3: Documento foi atualizado de forma manual
    if (existing && (existing.syncOrigin === 'manual-logic-panel' || existing.syncOrigin === 'manual')) {
      console.log(`Jogo ${game.id} saltado: Atualizado manualmente.`);
      continue;
    }

    // Prepare state
    const nextStatus = game.finished ? 'finished' : 'live';
    const nextLive = !!(game.live && !game.finished);
    const nextFinished = !!game.finished;

    // Check if change is needed
    const sameCoreState =
      existing &&
      existing.status === nextStatus &&
      !!existing.live === nextLive &&
      !!existing.finished === nextFinished &&
      existing.homeGoals === game.homeGoals &&
      existing.awayGoals === game.awayGoals &&
      String(existing.timeElapsed || '') === String(game.timeElapsed || '');

    if (sameCoreState) {
      continue;
    }

    // Calculate winner if finished
    let winnerTeam = null;
    if (nextFinished && game.homeGoals !== null && game.awayGoals !== null) {
      if (game.homeGoals > game.awayGoals) winnerTeam = local?.home || '';
      else if (game.awayGoals > game.homeGoals) winnerTeam = local?.away || '';
      else winnerTeam = 'Empate';
    }

    const ref = db.collection(FIREBASE_MATCHES_COLLECTION).doc(docId);
    batch.set(ref, {
      documentId: docId,
      matchDocId: docId,
      matchId: Number(game.id),
      status: nextStatus,
      live: nextLive,
      finished: nextFinished,
      stage: local?.stage || null,
      group: local?.group || null,
      date: local?.date || null,
      time: local?.time || null,
      homeTeam: local?.home || null,
      awayTeam: local?.away || null,
      homeGoals: game.homeGoals,
      awayGoals: game.awayGoals,
      winnerTeam,
      timeElapsed: game.timeElapsed || null,
      source: game.source,
      syncOrigin: 'api',
      apiUpdatedAt: new Date().toISOString(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`Jogo ${game.id} (${local?.home} vs ${local?.away}): a agendar atualização -> ${game.homeGoals}-${game.awayGoals} (${nextStatus})`);
    updateCount++;
  }

  if (updateCount > 0) {
    await batch.commit();
    console.log(`Sincronização concluída. ${updateCount} jogos atualizados.`);
  } else {
    console.log('Sem atualizações necessárias no Firestore.');
  }
}

runSync()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erro durante a execução do Sync:', err);
    process.exit(1);
  });
