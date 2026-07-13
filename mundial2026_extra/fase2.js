/* Secção 2 — reformulação de prognósticos a partir dos 16 avos.
   Este ficheiro é carregado depois do script principal e reaproveita os dados/funções já existentes. */
(() => {
  const KO_STAGES = ['round32', 'round16', 'quarterfinals', 'semifinals', 'third_place', 'final'];
  const SECTION2_STATUS = 'section2';
  const SECTION2_TYPE = 'knockoutRevision';
  const SECTION2_NAME_KEY = 'worldcup2026_section2_name';
  let section2Docs = [];
  let section2ActiveStage = 'round32';
  let endateworldConfig = null;

  const normalizeKey = (name) => normalizeParticipantName(name || '');
  const teamKey = (name) => String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

  function isTeamUnresolved(name) {
    if (!name) return true;
    const clean = String(name).trim().toLowerCase();
    if (!clean || clean === 'none' || clean === 'tbd' || clean === 'tbc' || clean === 'a definir' || clean === 'a confirmar' || clean === '?') return true;
    return /grupo|vencedor|perdedor|jogo|venc\.|perd\./i.test(clean);
  }
  window.isTeamUnresolved = isTeamUnresolved;

  const matchKickoff = (match) => new Date(`${match.date}T${match.time || '12:00'}:00`);
  const stageStart = (stage) => {
    const matches = data?.matches?.filter(m => m.stage === stage) || [];
    if (!matches.length) return null;
    return matches.map(matchKickoff).sort((a, b) => a - b)[0];
  };

  const STAGE_DATE_PREFIX = {
    'round32': 'dezasseisAvos',
    'round16': 'oitavos',
    'quarterfinals': 'quartos',
    'semifinals': 'meias',
    'third_place': 'final',
    'final': 'final'
  };
  const MATCHUP_PP_BY_STAGE = {
    round32: 2,
    round16: 2,
    quarterfinals: 4,
    semifinals: 6,
    third_place: 7,
    final: 10
  };

  const hasStageStarted = (stage) => {
    if (endateworldConfig) {
      const prefix = STAGE_DATE_PREFIX[stage];
      if (prefix) {
        const openVal = endateworldConfig[`${prefix}Open`];
        if (openVal) {
          const openDate = openVal.toDate ? openVal.toDate() : new Date(openVal);
          return new Date() >= openDate;
        }
      }
    }
    const start = stageStart(stage);
    return !!start && new Date() >= start;
  };

  const isStageClosed = (stage) => {
    if (endateworldConfig) {
      const prefix = STAGE_DATE_PREFIX[stage];
      if (prefix) {
        const closeVal = endateworldConfig[`${prefix}Close`];
        if (closeVal) {
          const closeDate = closeVal.toDate ? closeVal.toDate() : new Date(closeVal);
          return new Date() > closeDate;
        }
      }
    }
    return false;
  };

  const matchStillOpen = (match) => {
    if (getOfficialResult(match.id)) return false;
    if (isStageClosed(match.stage)) return false;
    return new Date() < matchKickoff(match);
  };

  async function loadEndateworldConfig() {
    if (!firestoreDb || !firebaseTools) return;
    try {
      const ref = firebaseTools.doc(firestoreDb, 'settings', 'endateworld');
      const snap = await firebaseTools.getDoc(ref);
      if (snap.exists()) {
        endateworldConfig = snap.data();
      }
    } catch (e) {
      console.warn('Erro ao carregar endateworld no fase2.js:', e);
    }
  }

  function getOfficialGroupTables() {
    if (!data) return {};
    const tables = {};
    GROUPS.forEach(group => {
      const teams = new Set();
      data.matches.filter(m => m.stage === 'groups' && m.group === group).forEach(m => {
        teams.add(m.home); teams.add(m.away);
      });
      const stats = Object.fromEntries([...teams].map(team => [team, blankTeam(team, group)]));
      data.matches.filter(m => m.stage === 'groups' && m.group === group).forEach(m => {
        const r = getOfficialResult(m.id);
        if (!r) return;
        const hg = Number(r.homeGoals);
        const ag = Number(r.awayGoals);
        const home = stats[m.home];
        const away = stats[m.away];
        if (!home || !away || Number.isNaN(hg) || Number.isNaN(ag)) return;
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

  function getOfficialQualified() {
    const tables = getOfficialGroupTables();
    const first = {}, second = {}, third = {};
    GROUPS.forEach(group => {
      first[group] = tables[group]?.[0] || null;
      second[group] = tables[group]?.[1] || null;
      third[group] = tables[group]?.[2] || null;
    });
    const bestThirds = getBestThirds(tables).filter(row => row.qualifiedThird);
    return { first, second, third, bestThirds, tables };
  }

  function buildThirdAssignments() {
    const qualified = getOfficialQualified();
    const assignments = {};
    const bestThirds = qualified.bestThirds || [];
    const groups = bestThirds.map(t => t.group);
    const sortedGroupsStr = [...groups].sort().join('');

    // Override for the official qualified third-placed groups combination (B, D, E, F, H, I, J, K)
    if (sortedGroupsStr === 'BDEFHIJK') {
      const teamByGroup = Object.fromEntries(bestThirds.map(t => [t.group, t.team]));
      const mapping = {
        '74:away': 'D', // Paraguai
        '77:away': 'F', // Suécia
        '79:away': 'E', // Equador
        '80:away': 'K', // RD Congo
        '81:away': 'I', // Senegal
        '82:away': 'B', // Bósnia
        '85:away': 'J', // Argélia
        '87:away': 'H'  // Cabo Verde
      };
      for (const [key, grp] of Object.entries(mapping)) {
        if (teamByGroup[grp]) {
          assignments[key] = teamByGroup[grp];
        }
      }
      return assignments;
    }

    // Override for the alternative combination with Group L (B, D, E, F, I, J, K, L)
    if (sortedGroupsStr === 'BDEFIJKL') {
      const teamByGroup = Object.fromEntries(bestThirds.map(t => [t.group, t.team]));
      const mapping = {
        '74:away': 'D', // Paraguai
        '77:away': 'F', // Suécia
        '79:away': 'E', // Equador
        '80:away': 'K', // RD Congo
        '81:away': 'I', // Senegal
        '82:away': 'B', // Bósnia
        '85:away': 'J', // Argélia
        '84:away': 'L'  // Croácia
      };
      for (const [key, grp] of Object.entries(mapping)) {
        if (teamByGroup[grp]) {
          assignments[key] = teamByGroup[grp];
        }
      }
      return assignments;
    }

    const used = new Set();
    (data?.matches || [])
      .filter(m => m.stage === 'round32')
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach(match => {
        ['home', 'away'].forEach(side => {
          const raw = String(match[side] || '');
          const m = raw.match(/^3\.º Grupo ([A-L](?:\/[A-L])*)$/);
          if (!m) return;
          const candidates = m[1].split('/');
          const chosen = bestThirds.find(row => candidates.includes(row.group) && !used.has(row.group));
          if (chosen) {
            used.add(chosen.group);
            assignments[`${match.id}:${side}`] = chosen.team;
          }
        });
      });
    return assignments;
  }

  function resolveOfficialPrevious(label) {
    const text = String(label || '');
    const win = text.match(/^Vencedor Jogo (\d+)$/);
    if (win) return getOfficialResult(win[1])?.winnerTeam || text;
    const loss = text.match(/^Perdedor Jogo (\d+)$/);
    if (loss) {
      const result = getOfficialResult(loss[1]);
      if (!result) return text;
      return result.winnerTeam === result.homeTeam ? result.awayTeam : result.homeTeam;
    }
    return text;
  }

  function resolveOfficialTeam(match, side) {
    const raw = String(match?.[side] || '');
    if (!match || match.stage === 'groups') return raw;
    const q = getOfficialQualified();
    const pos = raw.match(/^(1|2)\.º Grupo ([A-L])$/);
    if (pos) {
      const source = pos[1] === '1' ? q.first[pos[2]] : q.second[pos[2]];
      return source?.team || raw;
    }
    if (/^3\.º Grupo/.test(raw)) {
      return buildThirdAssignments()[`${match.id}:${side}`] || raw;
    }
    return resolveOfficialPrevious(raw);
  }

  function getInitialSubmissionByName(name) {
    const key = normalizeKey(name);
    return publicPredictions.find(p => (p.participantKey || normalizeKey(p.participantName)) === key) || null;
  }

  function getSection2Doc(participantKey, matchId) {
    return section2Docs.find(doc => String(doc.participantKey) === String(participantKey) && Number(doc.matchId) === Number(matchId)) || null;
  }

  function getSection2DocForPlayer(item, matchId) {
    const key = item?.participantKey || normalizeKey(item?.participantName);
    const match = (data?.matches || []).find(m => Number(m.id) === Number(matchId));
    const homeTeam = match ? String(match.home || match.homeTeam || '').trim().toLowerCase() : '';
    const awayTeam = match ? String(match.away || match.awayTeam || '').trim().toLowerCase() : '';
    const stage = match ? String(match.stage || '').trim().toLowerCase() : '';
    const docs = section2Docs.filter(doc => String(doc.participantKey) === String(key));
    if (!docs.length) return null;

    const exactIdAndTeams = docs.find(doc => {
      const sameId = Number(doc.matchId) === Number(matchId);
      const sameStage = !stage || String(doc.stage || '').trim().toLowerCase() === stage;
      const sameTeams = homeTeam && awayTeam
        && String(doc.homeTeam || '').trim().toLowerCase() === homeTeam
        && String(doc.awayTeam || '').trim().toLowerCase() === awayTeam;
      return sameId && sameStage && sameTeams;
    });
    if (exactIdAndTeams) return exactIdAndTeams;

    const teamsMatch = docs.find(doc => {
      const sameStage = !stage || String(doc.stage || '').trim().toLowerCase() === stage;
      const sameTeams = homeTeam && awayTeam
        && String(doc.homeTeam || '').trim().toLowerCase() === homeTeam
        && String(doc.awayTeam || '').trim().toLowerCase() === awayTeam;
      return sameStage && sameTeams;
    });
    if (teamsMatch) return teamsMatch;

    return docs.find(doc => Number(doc.matchId) === Number(matchId)) || null;
  }

  function sameTeamsSameSides(pred, official) {
    return teamKey(pred?.homeTeam) === teamKey(official?.homeTeam) && teamKey(pred?.awayTeam) === teamKey(official?.awayTeam);
  }

  function sameMatchupAnySide(pred, official) {
    const a = [teamKey(pred?.homeTeam), teamKey(pred?.awayTeam)].sort().join('|');
    const b = [teamKey(official?.homeTeam), teamKey(official?.awayTeam)].sort().join('|');
    return a && a === b;
  }

  function matchupPointsForStage(stage) {
    return Number(MATCHUP_PP_BY_STAGE?.[stage] || 0);
  }

  function calculateMatchupPointsSummary(item) {
    return (data?.matches || []).reduce((summary, match) => {
      if (!KO_STAGES.includes(match.stage)) return summary;
      const bonusPerMatchup = matchupPointsForStage(match.stage);
      if (!bonusPerMatchup) return summary;
      const home = resolveOfficialTeam(match, 'home');
      const away = resolveOfficialTeam(match, 'away');
      if (isTeamUnresolved(home) || isTeamUnresolved(away)) return summary;
      const pred = findInitialPredictionForMatch(item, match, home, away);
      if (!pred || !sameMatchupAnySide(pred, { homeTeam: home, awayTeam: away })) {
        return summary;
      }
      summary.total += bonusPerMatchup;
      summary.entries.push({
        matchId: Number(match.id),
        stage: match.stage,
        stageLabel: STAGE_LABELS[match.stage] || match.stage,
        homeTeam: home,
        awayTeam: away,
        date: match.date || '',
        time: match.time || '',
        points: bonusPerMatchup
      });
      return summary;
    }, { total: 0, entries: [] });
  }

  function calculateResolvedRound32MatchupPoints(item) {
    return calculateMatchupPointsSummary(item).total;
  }

  function officialWinnerTeam(official) {
    if (!official) return '';
    if (official.winnerTeam && official.winnerTeam !== 'Empate') return official.winnerTeam;
    const oh = Number(official.homeGoals);
    const oa = Number(official.awayGoals);
    if (oh > oa) return official.homeTeam;
    if (oa > oh) return official.awayTeam;
    return 'Empate';
  }

  window.getSection2DocForPlayer = getSection2DocForPlayer;
  window.resolveSection2OfficialTeam = resolveOfficialTeam;
  
  function findInitialPredictionForMatch(item, match, home = null, away = null) {
    if (!item || !match) return null;
    const matches = item.matches || [];
    const exactPred = matches.find(row => Number(row.id) === Number(match.id || match.matchId));
    if (match.stage && match.stage !== 'groups') {
      const h = home || resolveOfficialTeam(match, 'home');
      const a = away || resolveOfficialTeam(match, 'away');
      if (exactPred && sameMatchupAnySide(exactPred, { homeTeam: h, awayTeam: a })) {
        return exactPred;
      }
      const matchupPred = matches.find(p => p.stage === match.stage && sameMatchupAnySide(p, { homeTeam: h, awayTeam: a }));
      if (matchupPred) return matchupPred;
    }
    if (exactPred) return exactPred;
    return null;
  }
  window.findInitialPredictionForMatch = findInitialPredictionForMatch;

  function predictedWinnerTeam(pred) {
    if (!pred) return '';
    if (pred.winnerTeam) return pred.winnerTeam;
    const ph = Number(pred.homeGoals);
    const pa = Number(pred.awayGoals);
    if (ph > pa) return pred.homeTeam;
    if (pa > ph) return pred.awayTeam;
    return 'Empate';
  }

  function knockoutMethodKey(entry, stage = '') {
    if (stage === 'groups') return 'group';
    const raw = String(entry?.method || '').trim().toLowerCase();
    if (raw === 'pens') return 'pens';
    if (raw === 'et') return 'et';
    if (raw === '90') return '90';
    return '90';
  }

  function exactKnockoutPrediction(pred, official, stage, sameSides = true) {
    const ph = Number(pred?.homeGoals);
    const pa = Number(pred?.awayGoals);
    const oh = Number(official?.homeGoals);
    const oa = Number(official?.awayGoals);
    if (!sameSides || ph !== oh || pa !== oa) return false;
    if (stage === 'groups') return true;

    const predMethod = knockoutMethodKey(pred, stage);
    const officialMethodRaw = String(official?.method || '').trim().toLowerCase();
    if (!officialMethodRaw) {
      // Alguns resultados oficiais antigos/espelhados ficaram sem "method".
      // Nesses casos, um KO com score final igual e vencedor igual não deve cair para "acertou só o vencedor".
      if (predMethod === 'et' || predMethod === 'pens') {
        return teamKey(predictedWinnerTeam(pred)) === teamKey(officialWinnerTeam(official));
      }
      return true;
    }

    const officialMethod = knockoutMethodKey(official, stage);
    if (predMethod !== officialMethod) return false;

    if (predMethod === 'et' || predMethod === 'pens') {
      return teamKey(predictedWinnerTeam(pred)) === teamKey(officialWinnerTeam(official));
    }

    return true;
  }

  function scoreInitialPrediction(pred, official) {
    if (!pred || !official || pred.homeGoals == null || pred.awayGoals == null) {
      return { points: 0, exact: false, outcomeHit: false, goalsHit: 0, goalsMissed: 0, winHit: 0, drawHit: 0, lossHit: 0, played: false, source: 'section1' };
    }

    const stage = official.stage || pred.stage;
    const ph = Number(pred.homeGoals);
    const pa = Number(pred.awayGoals);
    const oh = Number(official.homeGoals);
    const oa = Number(official.awayGoals);
    const sidesOk = sameTeamsSameSides(pred, official);
    const winnerHit = teamKey(predictedWinnerTeam(pred)) === teamKey(officialWinnerTeam(official));
    const exact = exactKnockoutPrediction(pred, official, stage, sidesOk);
    const group = stage === 'groups';
    const final = stage === 'final';

    let points = 0;
    if (group) {
      points = exact ? numericRule('groupExact') : (sidesOk && predictionOutcome(pred) === actualOutcome(official) ? numericRule('groupOutcome') : 0);
    } else {
      if (exact) {
        if (stage === 'round32') points = numericRule('initialExact32');
        else if (stage === 'round16') points = numericRule('initialExact16');
        else if (stage === 'quarterfinals') points = numericRule('initialExact8');
        else if (stage === 'semifinals') points = numericRule('initialExact4');
        else if (stage === 'third_place') points = numericRule('initialExact3rd');
        else if (stage === 'final') points = numericRule('initialExactFinal');
        else points = final ? numericRule('finalInitialExact') : numericRule('knockoutInitialExact');
      } else if (winnerHit) {
        if (stage === 'round32') points = numericRule('initialWinner32');
        else if (stage === 'round16') points = numericRule('initialWinner16');
        else if (stage === 'quarterfinals') points = numericRule('initialWinner8');
        else if (stage === 'semifinals') points = numericRule('initialWinner4');
        else if (stage === 'third_place') points = numericRule('initialWinner3rd');
        else if (stage === 'final') points = numericRule('initialWinnerFinal');
        else points = final ? numericRule('finalInitialWinner') : numericRule('knockoutInitialWinner');
      }
    }

    const goalsHit = (sidesOk && ph === oh ? oh : 0) + (sidesOk && pa === oa ? oa : 0);
    const goalsMissed = sidesOk ? Math.abs(ph - oh) + Math.abs(pa - oa) : oh + oa;
    const actual = actualOutcome(official);
    const outcomeHit = points > 0 && !exact;
    return {
      points,
      exact,
      outcomeHit,
      goalsHit,
      goalsMissed,
      winHit: points > 0 && actual === 'home' ? 1 : 0,
      drawHit: points > 0 && actual === 'draw' ? 1 : 0,
      lossHit: points > 0 && actual === 'away' ? 1 : 0,
      played: true,
      source: 'section1'
    };
  }

  function scoreSection2Changed(initialPred, override, official) {
    const final = (official.stage || override.stage) === 'final';
    const oh = Number(official.homeGoals);
    const oa = Number(official.awayGoals);
    const ph = Number(override.homeGoals);
    const pa = Number(override.awayGoals);
    const stage = official.stage || override.stage;
    const winnerHit = teamKey(predictedWinnerTeam(override)) === teamKey(officialWinnerTeam(official));
    const exact = exactKnockoutPrediction(override, official, stage, true);

    let resultPoints = 0;
    if (stage === 'round32') {
      resultPoints = exact ? numericRule('reformExact32') : (winnerHit ? numericRule('reformWinner32') : 0);
    } else if (stage === 'round16') {
      resultPoints = exact ? numericRule('reformExact16') : (winnerHit ? numericRule('reformWinner16') : 0);
    } else if (stage === 'quarterfinals') {
      resultPoints = exact ? numericRule('reformExact8') : (winnerHit ? numericRule('reformWinner8') : 0);
    } else if (stage === 'semifinals') {
      resultPoints = exact ? numericRule('reformExact4') : (winnerHit ? numericRule('reformWinner4') : 0);
    } else if (stage === 'third_place') {
      resultPoints = exact ? numericRule('reformExact3rd') : (winnerHit ? numericRule('reformWinner3rd') : 0);
    } else if (stage === 'final') {
      resultPoints = exact ? numericRule('finalReformExact') : (winnerHit ? numericRule('reformWinnerFinal') : 0);
    } else {
      resultPoints = exact ? (final ? numericRule('finalReformExact') : numericRule('knockoutReformExact')) : 0;
    }

    const matchupBonus = sameMatchupAnySide(initialPred, official) ? matchupPointsForStage(stage) : 0;
    const points = resultPoints;
    const goalsHit = (ph === oh ? oh : 0) + (pa === oa ? oa : 0);
    const goalsMissed = Math.abs(ph - oh) + Math.abs(pa - oa);
    const actual = actualOutcome(official);
    return {
      points,
      exact,
      outcomeHit: points > 0 && !exact,
      goalsHit,
      goalsMissed,
      winHit: points > 0 && actual === 'home' ? 1 : 0,
      drawHit: points > 0 && actual === 'draw' ? 1 : 0,
      lossHit: points > 0 && actual === 'away' ? 1 : 0,
      played: true,
      source: 'section2',
      matchupBonus,
      resultPoints
    };
  }

  scoreOnePrediction = function(pred, official, override = null) {
    let result;
    if (!override || override.mode === 'replicate') {
      result = scoreInitialPrediction(pred, official);
    } else {
      result = scoreSection2Changed(pred, override, official);
    }

    return result;
  };

  function scorePredictionForTable(item, match, pred, official, override = null) {
    if (!pred || !official) {
      return {
        points: 0,
        exact: false,
        outcomeHit: false,
        goalsHit: 0,
        goalsMissed: 0,
        winHit: 0,
        drawHit: 0,
        lossHit: 0,
        played: false,
        source: override?.mode === 'changed' ? 'section2' : 'section1',
        matchupBonus: 0,
        resultPoints: 0
      };
    }

    const home = resolveOfficialTeam(match, 'home');
    const away = resolveOfficialTeam(match, 'away');
    const unresolved = isTeamUnresolved(home) || isTeamUnresolved(away);
    const stage = official.stage || match?.stage || pred.stage;
    const scorePred = (override && override.mode === 'replicate')
      ? {
          ...(override.initialPrediction || pred),
          homeTeam: override.homeTeam || (override.initialPrediction?.homeTeam) || pred.homeTeam || home,
          awayTeam: override.awayTeam || (override.initialPrediction?.awayTeam) || pred.awayTeam || away,
          stage: override.stage || override.initialPrediction?.stage || pred.stage || stage,
          id: override.matchId || override.initialPrediction?.id || pred.id || match?.id
        }
      : pred;
    const baseScore = scoreOnePrediction(scorePred, official, override);
    const shouldApplyStandaloneMatchupBonus = (!override || override.mode === 'replicate') && KO_STAGES.includes(stage) && !unresolved;
    const matchupBonus = shouldApplyStandaloneMatchupBonus && sameMatchupAnySide(scorePred, { homeTeam: home, awayTeam: away })
      ? matchupPointsForStage(stage)
      : 0;

    return {
      ...baseScore,
      points: Number(baseScore.points || 0),
      matchupBonus: Number(baseScore.matchupBonus || 0) + matchupBonus,
      resultPoints: Number(baseScore.resultPoints ?? baseScore.points ?? 0)
    };
  }
  window.scorePredictionForTable = scorePredictionForTable;

  const SECTION2_COLLECTION = 'worldcupextraReforms';
  const baseLoadPublicPredictions = loadPublicPredictions;
  loadPublicPredictions = async function() {
    await loadEndateworldConfig();
    await baseLoadPublicPredictions();

    const legacyRef = firebaseTools.collection(firestoreDb, FIREBASE_COLLECTION);
    const legacySnapshot = await firebaseTools.getDocs(legacyRef);
    const legacyDocs = legacySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(doc => doc.status === SECTION2_STATUS || doc.type === SECTION2_TYPE);

    let reformDocs = [];
    try {
      const reformRef = firebaseTools.collection(firestoreDb, SECTION2_COLLECTION);
      const reformSnapshot = await firebaseTools.getDocs(reformRef);
      reformDocs = reformSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Não foi possível carregar as reformulações.', error);
    }

    section2Docs = [...legacyDocs, ...reformDocs]
      .filter(doc => doc.status === SECTION2_STATUS || doc.type === SECTION2_TYPE)
      .filter(doc => doc.matchId != null);

    return publicPredictions;
  };

  calculateGgamesTable = function() {
    const rows = publicPredictions.map(item => {
      const stats = {
        id: item.id,
        participantKey: item.participantKey || normalizeKey(item.participantName),
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
        exactResults: 0,
        matchupPoints: 0,
        matchupPointEntries: []
      };
      (data?.matches || []).forEach(match => {
        const home = resolveOfficialTeam(match, 'home');
        const away = resolveOfficialTeam(match, 'away');
        const unresolved = isTeamUnresolved(home) || isTeamUnresolved(away);
        
        const pred = findInitialPredictionForMatch(item, match, home, away);
        
        const override = getSection2DocForPlayer(item, match.id);

        const official = getOfficialResult(match.id);
        if (!official) return;
        if (!pred) return;

        const score = scorePredictionForTable(item, match, pred, official, override);
        
        stats.points += score.resultPoints ?? score.points;
        
        stats.correctPredictions += score.points > 0 ? 1 : 0;
        stats.failedPredictions += score.points === 0 ? 1 : 0;
        stats.goalsHit += score.goalsHit;
        stats.goalsMissed += score.goalsMissed;
        stats.winsHit += score.winHit;
        stats.drawsHit += score.drawHit;
        stats.lossesHit += score.lossHit;
        stats.exactResults += score.exact ? 1 : 0;
      });
      const matchupSummary = calculateMatchupPointsSummary(item);
      stats.matchupPoints = matchupSummary.total;
      stats.matchupPointEntries = matchupSummary.entries;
      return stats;
    });

    return rows.sort((a, b) =>
      (b.points - a.points) ||
      (b.correctPredictions - a.correctPredictions) ||
      (b.goalsHit - a.goalsHit) ||
      (a.goalsMissed - b.goalsMissed) ||
      a.name.localeCompare(b.name, 'pt-PT')
    ).map((row, index) => ({ ...row, rank: index + 1 }));
  };

  function availableSection2Stages() {
    return KO_STAGES.filter(stage => hasStageStarted(stage));
  }

  function section2ActiveName() {
    return ($('#section2Name')?.value || localStorage.getItem(SECTION2_NAME_KEY) || state.name || '').trim();
  }

  function renderSection2Panel() {
    const stages = availableSection2Stages();
    if (!stages.length) return '';
    if (!stages.includes(section2ActiveStage)) section2ActiveStage = stages[stages.length - 1] || 'round32';
    const name = section2ActiveName();
    const initial = getInitialSubmissionByName(name);

    return `
      <section class="section2-panel">
        <div class="section2-head">
          <div>
            <p class="eyebrow small">Nova oportunidade</p>
            <h2>Reformular prognósticos das eliminatórias</h2>
            <p class="modal-muted">Escreve exatamente o mesmo nome usado no primeiro prognóstico. Quando uma fase começar, podes manter o teu prognóstico inicial ou reformular o resultado dos jogos ainda por começar.</p>
          </div>
        </div>
        <div class="section2-name-row">
          <input id="section2Name" type="text" value="${escapeHtml(name)}" placeholder="O mesmo nome do primeiro prognóstico" autocomplete="name">
          <button type="button" class="primary" data-section2-load>Ver jogos disponíveis</button>
        </div>
        <div id="section2Body">
          ${!name ? '<p class="modal-muted">Escreve o teu nome para veres os jogos disponíveis.</p>' : !initial ? '<p class="modal-muted">Não encontrei um prognóstico inicial com esse nome. O nome tem de ser exatamente o mesmo.</p>' : renderSection2Stage(initial, stages)}
        </div>
      </section>
    `;
  }

  function renderSection2Stage(initial, stages) {
    const matches = data.matches.filter(match => match.stage === section2ActiveStage);
    return `
      <div class="section2-stage-tabs">
        ${stages.map(stage => `<button type="button" class="section2-stage-tab ${stage === section2ActiveStage ? 'active' : ''}" data-section2-stage="${stage}">${escapeHtml(STAGE_LABELS[stage])}</button>`).join('')}
      </div>
      <div class="section2-games">
        ${matches.map(match => renderSection2Match(match, initial)).join('')}
      </div>
    `;
  }

  function renderSection2Match(match, initial) {
    const participantKey = initial.participantKey || normalizeKey(initial.participantName);
    const saved = getSection2Doc(participantKey, match.id);
    const initialPred = (initial.matches || []).find(row => Number(row.id) === Number(match.id));
    const home = resolveOfficialTeam(match, 'home');
    const away = resolveOfficialTeam(match, 'away');
    const unresolved = /Grupo|Vencedor Jogo|Perdedor Jogo/.test(`${home} ${away}`);
    const open = !unresolved && matchStillOpen(match);
    const initialMatchupOk = initialPred && sameMatchupAnySide(initialPred, { homeTeam: home, awayTeam: away });
    const mustRedo = !initialMatchupOk;
    const mode = saved?.mode || (mustRedo ? 'changed' : 'replicate');
    const homeGoals = saved?.homeGoals ?? '';
    const awayGoals = saved?.awayGoals ?? '';
    const method = saved?.method || '90';
    const winnerTeam = saved?.winnerTeam || '';

    return `
      <article class="section2-card" data-section2-match="${match.id}">
        <div class="section2-card-head">
          <div>
            <span class="badge">Jogo ${match.id} · ${escapeHtml(STAGE_LABELS[match.stage])}</span>
            <h3>${escapeHtml(home)} vs ${escapeHtml(away)}</h3>
            <p class="modal-muted">${escapeHtml(match.date)} ${escapeHtml(match.time || '')} · ${escapeHtml(match.venue || '')}</p>
          </div>
          ${saved ? '<strong class="saved-chip">Gravado</strong>' : open ? '<span class="future-chip">Aberto</span>' : '<span class="official-chip">Fechado</span>'}
        </div>

        ${unresolved ? '<p class="modal-muted">Ainda falta definir oficialmente as seleções deste jogo.</p>' : `
          <div class="section2-initial">
            <strong>O teu prognóstico inicial:</strong>
            <span>${initialPred ? predictionResultText(initialPred) : 'Não existia para este jogo.'}</span>
            <em>${initialMatchupOk ? 'Tinhas acertado nas seleções deste jogo.' : 'As seleções do teu prognóstico inicial não correspondem a este jogo.'}</em>
          </div>
          ${initialMatchupOk ? `
            <div class="section2-mode">
              <label><input type="radio" name="s2mode-${match.id}" value="replicate" ${mode === 'replicate' ? 'checked' : ''} ${!open ? 'disabled' : ''}> Manter prognóstico inicial</label>
              <label><input type="radio" name="s2mode-${match.id}" value="changed" ${mode === 'changed' ? 'checked' : ''} ${!open ? 'disabled' : ''}> Alterar resultado</label>
            </div>
          ` : '<p class="modal-muted">Como o jogo inicial não correspondeu, precisas de fazer um novo prognóstico para este jogo.</p>'}
          <div class="section2-form ${mode === 'replicate' && initialMatchupOk ? 'is-hidden' : ''}">
            <div class="score-row compact">
              <span>${escapeHtml(home)}</span>
              <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-field="homeGoals" value="${escapeHtml(homeGoals)}" ${!open ? 'disabled' : ''}>
              <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-field="awayGoals" value="${escapeHtml(awayGoals)}" ${!open ? 'disabled' : ''}>
              <span>${escapeHtml(away)}</span>
            </div>
            <div class="ko-row">
              <select data-field="method" ${!open ? 'disabled' : ''}>
                <option value="90" ${method === '90' ? 'selected' : ''}>90 minutos</option>
                <option value="et" ${method === 'et' ? 'selected' : ''}>Prolongamento</option>
                <option value="pens" ${method === 'pens' ? 'selected' : ''}>Penáltis</option>
              </select>
              <select data-field="winnerTeam" ${!open ? 'disabled' : ''}>
                <option value="" ${!winnerTeam ? 'selected' : ''}>Vencedor</option>
                <option value="${escapeHtml(home)}" ${winnerTeam === home ? 'selected' : ''}>${escapeHtml(home)}</option>
                <option value="${escapeHtml(away)}" ${winnerTeam === away ? 'selected' : ''}>${escapeHtml(away)}</option>
              </select>
            </div>
          </div>
          <button type="button" class="primary" data-section2-save ${!open ? 'disabled' : ''}>Gravar este jogo</button>
          <p class="admin-message" data-section2-message>${open ? 'Podes gravar até ao início deste jogo.' : 'Este jogo já não aceita alterações.'}</p>
        `}
      </article>
    `;
  }

  function renderSection2PanelOnly() {
    const panel = document.querySelector('.section2-panel');
    if (!panel) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderSection2Panel().trim();
    panel.replaceWith(wrapper.firstElementChild);
  }

  async function saveSection2Match(card) {
    const name = section2ActiveName();
    const initial = getInitialSubmissionByName(name);
    if (!initial) {
      alert('Não encontrei o teu prognóstico inicial. Usa exatamente o mesmo nome.');
      return;
    }
    const match = data.matches.find(m => Number(m.id) === Number(card.dataset.section2Match));
    if (!match || !matchStillOpen(match)) {
      alert('Este jogo já não aceita alterações.');
      return;
    }
    const participantKey = initial.participantKey || normalizeKey(initial.participantName);
    const homeTeam = resolveOfficialTeam(match, 'home');
    const awayTeam = resolveOfficialTeam(match, 'away');
    const initialPred = (initial.matches || []).find(row => Number(row.id) === Number(match.id));
    const initialMatchupOk = initialPred && sameMatchupAnySide(initialPred, { homeTeam, awayTeam });
    const selectedMode = card.querySelector(`input[name="s2mode-${match.id}"]:checked`)?.value || (initialMatchupOk ? 'replicate' : 'changed');
    const mode = initialMatchupOk ? selectedMode : 'changed';
    let homeGoals = null, awayGoals = null, method = '90', winnerTeam = '';

    if (mode === 'changed') {
      homeGoals = Number(card.querySelector('[data-field="homeGoals"]')?.value);
      awayGoals = Number(card.querySelector('[data-field="awayGoals"]')?.value);
      method = card.querySelector('[data-field="method"]')?.value || '90';
      winnerTeam = card.querySelector('[data-field="winnerTeam"]')?.value || '';
      if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) {
        alert('Preenche o resultado antes de gravares.');
        return;
      }
      if (homeGoals === awayGoals && !winnerTeam) {
        alert('Em caso de empate, escolhe quem passa.');
        return;
      }
      if (homeGoals > awayGoals) winnerTeam = homeTeam;
      if (awayGoals > homeGoals) winnerTeam = awayTeam;
    }

    const docId = `section2-${participantKey}-${match.id}`;
    const payload = {
      status: SECTION2_STATUS,
      type: SECTION2_TYPE,
      participantName: initial.participantName || name,
      participantKey,
      matchId: Number(match.id),
      stage: match.stage,
      stageLabel: STAGE_LABELS[match.stage],
      matchDate: match.date,
      matchTime: match.time || null,
      matchStartsAt: matchKickoff(match).toISOString(),
      homeTeam,
      awayTeam,
      mode,
      initialMatchupOk: !!initialMatchupOk,
      initialPrediction: initialPred || null,
      homeGoals,
      awayGoals,
      method,
      winnerTeam: mode === 'replicate' ? (initialPred?.winnerTeam || predictedWinnerTeam(initialPred)) : winnerTeam,
      updatedAt: firebaseTools.serverTimestamp(),
      clientTimestamp: new Date().toISOString()
    };

    const msg = card.querySelector('[data-section2-message]');
    try {
      await firebaseTools.setDoc(firebaseTools.doc(firestoreDb, FIREBASE_COLLECTION, docId), payload);
      localStorage.setItem(SECTION2_NAME_KEY, name);
      if (msg) msg.textContent = 'Gravado com sucesso.';
      await loadPublicPredictions();
      renderSection2PanelOnly();
    } catch (error) {
      console.error(error);
      if (msg) msg.textContent = 'Não foi possível gravar. Confirma as permissões.';
      alert('Não foi possível gravar este prognóstico.');
    }
  }

  function renderSemifinalBundle(item, semifinalMatches) {
    const thirdPlaceOptions = buildSemifinalScenarioEntries('third_place');
    const finalOptions = buildSemifinalScenarioEntries('final');
    return `
      <div class="reform-stage-cluster">
        <section class="reform-stage-section reform-stage-section--semifinals">
          <div class="reform-stage-section__head">
            <p class="eyebrow small">Meias-finais</p>
            <h3>Jogos reais desta fase</h3>
          </div>
          <div class="section2-games">
            ${semifinalMatches.map(match => renderReformMatch(match, item)).join('') || '<p class="modal-muted">Nao ha jogos nas meias-finais.</p>'}
          </div>
        </section>
        <section class="reform-stage-section reform-stage-section--third-place">
          <div class="reform-stage-section__head">
            <p class="eyebrow small">3.º/4.º lugar</p>
            <h3>Quatro hipoteses possiveis</h3>
            <p class="modal-muted">Como as meias ainda nao aconteceram, podes preparar qualquer combinacao possivel.</p>
          </div>
          <div class="section2-games">
            ${thirdPlaceOptions.map(entry => renderReformMatch(entry.match, item, entry)).join('') || '<p class="modal-muted">Ainda nao foi possivel gerar as combinacoes do 3.º/4.º lugar.</p>'}
          </div>
        </section>
        <section class="reform-stage-section reform-stage-section--final">
          <div class="reform-stage-section__head">
            <p class="eyebrow small">Final</p>
            <h3>Quatro hipoteses possiveis</h3>
            <p class="modal-muted">A final fica separada para tornares a escolha mais clara.</p>
          </div>
          <div class="section2-games">
            ${finalOptions.map(entry => renderReformMatch(entry.match, item, entry)).join('') || '<p class="modal-muted">Ainda nao foi possivel gerar as combinacoes da final.</p>'}
          </div>
        </section>
      </div>
    `;
  }

  function renderReformStage() {
    const item = getParticipantByKey(reformSession.participantKey);
    const activeStages = reformWindows.activeStages || openStagesNow();
    if (!item || !reformSession.pinOk) return renderReformLogin();
    if (!activeStages.includes(reformSession.activeStage)) reformSession.activeStage = activeStages[0] || 'round32';
    const stage = reformSession.activeStage;
    const windowInfo = findWindowPair(stage);
    const matches = (data?.matches || []).filter(match => match.stage === stage);
    const showFinalBundle = stage === 'semifinals';
    const correctMatchups = matches.map(match => {
      const home = resolveOfficialTeamLocal(match, 'home');
      const away = resolveOfficialTeamLocal(match, 'away');
      if (isTeamUnresolved(home) || isTeamUnresolved(away)) return null;
      const initialPred = findInitialPredictionForMatch(item, match, home, away);
      if (!initialPred || !sameMatchupAnySideLocal(initialPred, { homeTeam: home, awayTeam: away })) return null;
      const canonicalMatch = findCanonicalStageMatchLocal(match, home, away);
      return { match: canonicalMatch || match, home, away };
    }).filter(Boolean);
    const correctMatchesSummaryHtml = correctMatchups.length > 0 ? `
      <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 14px 18px; margin-bottom: 20px; font-size: 0.9rem; text-align: left;">
        <strong style="color: #4ade80; display: block; margin-bottom: 6px; font-weight: 800;">Confrontos que acertaste no prognostico inicial (${correctMatchups.length}):</strong>
        <ul style="margin: 0; padding-left: 18px; line-height: 1.6; color: #a8b7cf; font-weight: 600;">
          ${correctMatchups.map(entry => `<li>Jogo ${escapeHtml(entry.match?.id ?? '')}: <strong>${escapeHtml(entry.home)} vs ${escapeHtml(entry.away)}</strong></li>`).join('')}
        </ul>
      </div>
    ` : `
      <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 16px; padding: 14px 18px; margin-bottom: 20px; font-size: 0.9rem; text-align: left;">
        <strong style="color: #f87171; display: block; font-weight: 800;">Nao acertaste nenhum confronto inicial para esta fase.</strong>
      </div>
    `;
    return `
      <div class="modal-head">
        <div>
          <p class="eyebrow small">Seccao 2 - PIN validado</p>
          <h2>${escapeHtml(item.participantName || 'Participante')}</h2>
          <p class="modal-muted">Reformula apenas os jogos da fase aberta. A Seccao 1 fica guardada intacta.</p>
        </div>
      </div>
      <section class="reform-box">
        ${correctMatchesSummaryHtml}
        <div class="reform-window-note">
          <strong>${escapeHtml(STAGE_LABELS[stage])}</strong>
          <span>Fecha em ${formatDateTime(windowInfo?.close)}</span>
        </div>
        <div class="section2-stage-tabs">
          ${activeStages.map(s => `<button type="button" class="section2-stage-tab ${s === stage ? 'active' : ''}" data-reform-stage="${escapeHtml(s)}">${escapeHtml(STAGE_LABELS[s])}</button>`).join('')}
        </div>
        ${showFinalBundle ? renderSemifinalBundle(item, matches) : `
          <div class="section2-games">
            ${matches.map(match => renderReformMatch(match, item)).join('') || '<p class="modal-muted">Nao ha jogos nesta fase.</p>'}
          </div>
        `}
      </section>
    `;
  }

  function renderReformMatch(match, item, scenario = null) {
    const home = scenario?.homeTeam || resolveOfficialTeamLocal(match, 'home');
    const away = scenario?.awayTeam || resolveOfficialTeamLocal(match, 'away');
    const unresolved = isTeamUnresolved(home) || isTeamUnresolved(away);
    const windowStage = scenario?.scenarioStage || match.stage;
    const visualStage = match.stage;
    const open = isStageWindowOpen(windowStage) && !unresolved && new Date() < matchKickoffLocal(match);
    const initialPred = findInitialPredictionForMatch(item, match, home, away);
    const initialMatchupOk = initialPred && sameMatchupAnySideLocal(initialPred, { homeTeam: home, awayTeam: away });
    const saved = findSavedReformDoc(getParticipantKey(item), match.id, home, away);
    const mode = saved?.mode || (initialMatchupOk ? 'replicate' : 'changed');
    const homeGoals = saved?.homeGoals ?? '';
    const awayGoals = saved?.awayGoals ?? '';
    const method = saved?.method || '90';
    const winnerTeam = saved?.winnerTeam || '';
    const homeDisplay = renderTeamWithFlag(home);
    const awayDisplay = renderTeamWithFlag(away);
    return `
      <article class="section2-card section2-card--${escapeHtml(visualStage)} ${scenario ? 'section2-card--scenario' : ''}" data-reform-match="${escapeHtml(match.id)}" data-reform-home="${escapeHtml(home)}" data-reform-away="${escapeHtml(away)}" data-reform-window-stage="${escapeHtml(windowStage)}" data-reform-scenario-key="${escapeHtml(scenario?.scenarioKey || buildScenarioDocKey(match.id, home, away))}">
        <div class="section2-card-head">
          <div>
            <span class="badge">Jogo ${escapeHtml(match.id)} · ${escapeHtml(STAGE_LABELS[match.stage])}</span>
            <h3 class="section2-match-title">${homeDisplay}<span class="section2-match-vs">vs</span>${awayDisplay}</h3>
            <p class="modal-muted">${escapeHtml(match.date)} ${escapeHtml(match.time || '')} · ${escapeHtml(match.venue || '')}</p>
            ${scenario?.scenarioLabel ? `<p class="section2-scenario-label">${escapeHtml(scenario.scenarioLabel)}</p>` : ''}
          </div>
          ${saved ? '<strong class="saved-chip">Gravado</strong>' : open ? '<span class="future-chip">Aberto</span>' : '<span class="official-chip">Fechado</span>'}
        </div>
        ${unresolved ? '<p class="modal-muted">Ainda falta definir oficialmente as selecoes deste jogo.</p>' : `
          <div class="section2-initial">
            <strong>O teu prognostico inicial:</strong>
            <span>${initialPred ? predictionResultText(initialPred) : 'Nao existia para este jogo.'}</span>
            <em>${initialMatchupOk ? 'Tinhas acertado nas selecoes deste confronto.' : 'Este confronto real nao existia no teu prognostico inicial.'}</em>
          </div>
          ${initialMatchupOk ? `
            <div class="section2-mode">
              <label><input type="radio" name="reform-mode-${match.id}-${teamKeyLocal(home)}-${teamKeyLocal(away)}" value="replicate" ${mode === 'replicate' ? 'checked' : ''} ${!open ? 'disabled' : ''}> Manter prognostico inicial</label>
              <label><input type="radio" name="reform-mode-${match.id}-${teamKeyLocal(home)}-${teamKeyLocal(away)}" value="changed" ${mode === 'changed' ? 'checked' : ''} ${!open ? 'disabled' : ''}> Alterar resultado</label>
            </div>
          ` : '<p class="modal-muted">Como nao acertaste este confronto, tens de fazer um novo prognostico.</p>'}
          <div class="section2-form ${mode === 'replicate' && initialMatchupOk ? 'is-hidden' : ''}">
            <div class="score-row compact">
              <span>${homeDisplay}</span>
              <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-reform-field="homeGoals" value="${escapeHtml(homeGoals)}" ${!open ? 'disabled' : ''}>
              <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-reform-field="awayGoals" value="${escapeHtml(awayGoals)}" ${!open ? 'disabled' : ''}>
              <span>${awayDisplay}</span>
            </div>
            <div class="ko-row">
              <select data-reform-field="method" ${!open ? 'disabled' : ''}>
                <option value="90" ${method === '90' ? 'selected' : ''}>90 minutos</option>
                <option value="et" ${method === 'et' ? 'selected' : ''}>Prolongamento</option>
                <option value="pens" ${method === 'pens' ? 'selected' : ''}>Penaltis</option>
              </select>
              <select data-reform-field="winnerTeam" ${!open ? 'disabled' : ''}>
                <option value="" ${!winnerTeam ? 'selected' : ''}>Vencedor se houver empate</option>
                <option value="${escapeHtml(home)}" ${winnerTeam === home ? 'selected' : ''}>${escapeHtml(home)}</option>
                <option value="${escapeHtml(away)}" ${winnerTeam === away ? 'selected' : ''}>${escapeHtml(away)}</option>
              </select>
            </div>
          </div>
          <button type="button" class="primary section2-save-btn section2-save-btn--${escapeHtml(visualStage)}" data-reform-save ${!open ? 'disabled' : ''}>Gravar reformulacao</button>
          <p class="admin-message" data-reform-message>${open ? `Podes gravar enquanto a janela de ${escapeHtml(String(STAGE_LABELS[windowStage] || windowStage).toLowerCase())} estiver aberta.` : 'Este jogo ja nao aceita alteracoes.'}</p>
        `}
      </article>
    `;
  }

  async function saveReformMatch(card) {
    const item = getParticipantByKey(reformSession.participantKey);
    if (!item || !reformSession.pinOk) {
      alert('Tens de validar o PIN antes de gravar.');
      return;
    }
    const match = data.matches.find(m => Number(m.id) === Number(card.dataset.reformMatch));
    const windowStage = card.dataset.reformWindowStage || match?.stage || '';
    if (!match || !isStageWindowOpen(windowStage) || new Date() >= matchKickoffLocal(match)) {
      alert('A janela deste jogo/fase ja nao esta aberta.');
      return;
    }
    const homeTeam = card.dataset.reformHome || resolveOfficialTeamLocal(match, 'home');
    const awayTeam = card.dataset.reformAway || resolveOfficialTeamLocal(match, 'away');
    if (isTeamUnresolved(homeTeam) || isTeamUnresolved(awayTeam)) {
      alert('Ainda falta definir oficialmente as selecoes deste jogo.');
      return;
    }
    const participantKey = getParticipantKey(item);
    const initialPred = findInitialPredictionForMatch(item, match, homeTeam, awayTeam);
    const initialMatchupOk = initialPred && sameMatchupAnySideLocal(initialPred, { homeTeam, awayTeam });
    const radioName = `reform-mode-${match.id}-${teamKeyLocal(homeTeam)}-${teamKeyLocal(awayTeam)}`;
    const selectedMode = card.querySelector(`input[name="${radioName}"]:checked`)?.value || (initialMatchupOk ? 'replicate' : 'changed');
    const mode = initialMatchupOk ? selectedMode : 'changed';
    let homeGoals = null, awayGoals = null, method = '90', winnerTeam = '';
    if (mode === 'changed') {
      homeGoals = Number(card.querySelector('[data-reform-field="homeGoals"]')?.value);
      awayGoals = Number(card.querySelector('[data-reform-field="awayGoals"]')?.value);
      method = card.querySelector('[data-reform-field="method"]')?.value || '90';
      winnerTeam = card.querySelector('[data-reform-field="winnerTeam"]')?.value || '';
      if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) {
        alert('Preenche o resultado antes de gravares.');
        return;
      }
      if (homeGoals === awayGoals && !winnerTeam) {
        alert('Em caso de empate, escolhe quem passa.');
        return;
      }
      if (homeGoals > awayGoals) winnerTeam = homeTeam;
      if (awayGoals > homeGoals) winnerTeam = awayTeam;
    }
    const docId = `${participantKey}_${match.stage}_${match.id}_${teamKeyLocal(homeTeam)}_${teamKeyLocal(awayTeam)}`;
    const payload = {
      status: 'section2',
      type: 'knockoutRevision',
      participantName: item.participantName || reformSession.participantName,
      participantKey,
      stage: match.stage,
      stageLabel: STAGE_LABELS[match.stage],
      matchId: Number(match.id),
      matchDate: match.date,
      matchTime: match.time || null,
      matchStartsAt: matchKickoffLocal(match).toISOString(),
      homeTeam,
      awayTeam,
      mode,
      initialMatchupOk: !!initialMatchupOk,
      initialPrediction: initialPred || null,
      homeGoals,
      awayGoals,
      method,
      winnerTeam: mode === 'replicate' ? (initialPred?.winnerTeam || '') : winnerTeam,
      scenarioKey: card.dataset.reformScenarioKey || buildScenarioDocKey(match.id, homeTeam, awayTeam),
      windowStage,
      pinVerified: true,
      updatedAt: firebaseTools.serverTimestamp(),
      clientTimestamp: new Date().toISOString()
    };
    const msg = card.querySelector('[data-reform-message]');
    try {
      await firebaseTools.setDoc(firebaseTools.doc(firestoreDb, REFORM_COLLECTION, docId), payload, { merge: true });
      if (msg) msg.textContent = 'Gravado com sucesso.';
      await Promise.allSettled([loadPublicPredictions(), loadReformsCache()]);
      openModal(renderReformStage());
    } catch (error) {
      console.error(error);
      if (msg) msg.textContent = 'Nao foi possivel gravar. Tenta novamente mais tarde ou fala com o organizador.';
      alert('Nao foi possivel gravar a reformulacao. Tenta novamente mais tarde ou fala com o organizador.');
    }
  }

  document.addEventListener('click', async (event) => {
    const loadBtn = event.target.closest('[data-section2-load]');
    if (loadBtn) {
      const name = section2ActiveName();
      localStorage.setItem(SECTION2_NAME_KEY, name);
      renderSection2PanelOnly();
      return;
    }

    const stageBtn = event.target.closest('[data-section2-stage]');
    if (stageBtn) {
      section2ActiveStage = stageBtn.dataset.section2Stage;
      renderSection2PanelOnly();
      return;
    }

    const saveBtn = event.target.closest('[data-section2-save]');
    if (saveBtn) {
      const card = saveBtn.closest('[data-section2-match]');
      if (card) await saveSection2Match(card);
    }
  });

  document.addEventListener('change', (event) => {
    const modeInput = event.target.closest('.section2-mode input[type="radio"]');
    if (modeInput) {
      const card = modeInput.closest('[data-section2-match]');
      const form = card?.querySelector('.section2-form');
      if (form) form.classList.toggle('is-hidden', modeInput.value === 'replicate');
    }
  });
})();
/* Secção 2 aprovada — janelas Firebase + dropdown de participante + PIN + gravação em worldcupextraReforms */
(function approvedReformWindowsWithPin() {
  const isTeamUnresolved = window.isTeamUnresolved;
  const REFORM_COLLECTION = 'worldcupextraReforms';
  const REFORM_SETTINGS_COLLECTION = 'settings';
  const REFORM_SETTINGS_DOC = 'endateworld';
  const REFORM_STAGES = ['round32', 'round16', 'quarterfinals', 'semifinals', 'third_place', 'final'];
  const REFORM_STAGE_FIELDS = {
    round32: [
      ['dezasseisAvosOpen', 'dezasseisAvosClose'],
      ['dezasseisavosOpen', 'dezasseisavosClose'],
      ['16avosOpen', '16avosClose'],
      ['round32Open', 'round32Close']
    ],
    round16: [
      ['oitavosOpen', 'oitavosClose'],
      ['round16Open', 'round16Close']
    ],
    quarterfinals: [
      ['quartosOpen', 'quartosClose'],
      ['quarterfinalsOpen', 'quarterfinalsClose']
    ],
    semifinals: [
      ['meiasOpen', 'meiasClose'],
      ['semifinalsOpen', 'semifinalsClose']
    ],
    third_place: [
      ['terceiroLugarOpen', 'terceiroLugarClose'],
      ['thirdPlaceOpen', 'thirdPlaceClose']
    ],
    final: [
      ['finalOpen', 'finalClose']
    ]
  };

  let reformWindows = { loaded: false, data: {}, activeStages: [] };
  let reformSession = { participantKey: '', participantName: '', pinOk: false, activeStage: '' };
  let reformFlagsMap = null;

  function valueToDate(value) {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDateTime(value) {
    const date = valueToDate(value);
    if (!date) return '—';
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function normalizeKeyLocal(name) {
    return typeof normalizeParticipantName === 'function'
      ? normalizeParticipantName(name || '')
      : String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  function teamKeyLocal(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  function winnerFromResultLike(result) {
    if (!result) return '';
    if (result.winnerTeam && result.winnerTeam !== 'Empate') return result.winnerTeam;
    const homeGoals = Number(result.homeGoals ?? result.homeGoalsLive);
    const awayGoals = Number(result.awayGoals ?? result.awayGoalsLive);
    if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) return '';
    if (homeGoals > awayGoals) return result.homeTeam || '';
    if (awayGoals > homeGoals) return result.awayTeam || '';
    const winnerSide = String(result.winnerSide || '').trim().toLowerCase();
    if (winnerSide === 'home') return result.homeTeam || '';
    if (winnerSide === 'away') return result.awayTeam || '';
    return '';
  }

  function resultSourceByMatchId(matchId) {
    return getOfficialResult(matchId)
      || worldCupApi?.games?.find?.(game => String(game.id) === String(matchId))
      || null;
  }

  async function loadReformFlags() {
    if (reformFlagsMap) return reformFlagsMap;
    reformFlagsMap = {};
    try {
      const response = await fetch('./mundial2026_bandeiras_redondas.json');
      const json = await response.json();
      (json?.teams || []).forEach(team => {
        const add = (value) => {
          const key = teamKeyLocal(value);
          if (key) reformFlagsMap[key] = team;
        };
        add(team.nome);
        add(team.name);
        add(team.fifaCode);
        (team.aliases || []).forEach(add);
      });
    } catch (error) {
      console.warn('Nao foi possivel carregar as bandeiras das selecoes.', error);
    }
    return reformFlagsMap;
  }

  function findTeamFlag(teamName) {
    const key = teamKeyLocal(teamName);
    return key ? reformFlagsMap?.[key] || null : null;
  }

  function renderTeamWithFlag(teamName) {
    const flag = findTeamFlag(teamName);
    const flagHtml = flag?.flagRound
      ? `<img class="section2-team-flag" src="${escapeHtml(flag.flagRound)}" alt="${escapeHtml(teamName)}">`
      : '<span class="section2-team-flag section2-team-flag--placeholder" aria-hidden="true"></span>';
    return `<span class="section2-team-name">${flagHtml}<span>${escapeHtml(teamName)}</span></span>`;
  }

  function matchKickoffLocal(match) {
    return new Date(`${match.date}T${match.time || '12:00'}:00`);
  }

  function sameMatchupAnySideLocal(pred, official) {
    const a = [teamKeyLocal(pred?.homeTeam), teamKeyLocal(pred?.awayTeam)].sort().join('|');
    const b = [teamKeyLocal(official?.homeTeam), teamKeyLocal(official?.awayTeam)].sort().join('|');
    return a && a === b;
  }

  function findCanonicalStageMatchLocal(match, homeTeam, awayTeam) {
    if (!match) return null;
    const stage = String(match.stage || '');
    const direct = (data?.matches || []).find(item => Number(item.id) === Number(match.id));
    if (direct && stage && String(direct.stage || '') === stage) {
      return direct;
    }
    if (!homeTeam || !awayTeam) return direct || match;
    return (data?.matches || []).find(item =>
      String(item.stage || '') === stage &&
      sameMatchupAnySideLocal(
        { homeTeam, awayTeam },
        {
          homeTeam: resolveOfficialTeamLocal(item, 'home'),
          awayTeam: resolveOfficialTeamLocal(item, 'away')
        }
      )
    ) || direct || match;
  }

  function findWindowPair(stage) {
    const source = reformWindows.data || {};
    const pairs = REFORM_STAGE_FIELDS[stage] || [];
    for (const [openField, closeField] of pairs) {
      const open = valueToDate(source[openField]);
      const close = valueToDate(source[closeField]);
      if (open || close) return { open, close, openField, closeField };
    }
    return { open: null, close: null, openField: '', closeField: '' };
  }

  function isStageWindowOpen(stage) {
    const { open, close } = findWindowPair(stage);
    const now = new Date();
    return !!open && !!close && now >= open && now < close;
  }

  function openStagesNow() {
    return REFORM_STAGES.filter(isStageWindowOpen);
  }

  async function loadReformWindows(force = false) {
    if (reformWindows.loaded && !force) return reformWindows;
    reformWindows.loaded = true;
    reformWindows.data = {};
    try {
      if (!firestoreDb || !firebaseTools) return reformWindows;
      const ref = firebaseTools.doc(firestoreDb, REFORM_SETTINGS_COLLECTION, REFORM_SETTINGS_DOC);
      const snap = await firebaseTools.getDoc(ref);
      reformWindows.data = snap.exists() ? snap.data() : {};
    } catch (error) {
      console.warn('Não foi possível carregar settings/endateworld.', error);
    }
    reformWindows.activeStages = openStagesNow();
    updateReformButton();
    return reformWindows;
  }

  function getOfficialGroupTablesLocal() {
    if (!data) return {};
    const tables = {};
    GROUPS.forEach(group => {
      const teams = new Set();
      data.matches.filter(m => m.stage === 'groups' && m.group === group).forEach(m => {
        teams.add(m.home); teams.add(m.away);
      });
      const stats = Object.fromEntries([...teams].map(team => [team, blankTeam(team, group)]));
      data.matches.filter(m => m.stage === 'groups' && m.group === group).forEach(m => {
        const r = getOfficialResult(m.id);
        if (!r) return;
        const hg = Number(r.homeGoals);
        const ag = Number(r.awayGoals);
        const home = stats[m.home];
        const away = stats[m.away];
        if (!home || !away || Number.isNaN(hg) || Number.isNaN(ag)) return;
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

  function getOfficialQualifiedLocal() {
    const tables = getOfficialGroupTablesLocal();
    const first = {}, second = {}, third = {};
    GROUPS.forEach(group => {
      first[group] = tables[group]?.[0] || null;
      second[group] = tables[group]?.[1] || null;
      third[group] = tables[group]?.[2] || null;
    });
    const bestThirds = getBestThirds(tables).filter(row => row.qualifiedThird);
    return { first, second, third, bestThirds, tables };
  }

  function buildThirdAssignmentsLocal() {
    const qualified = getOfficialQualifiedLocal();
    const assignments = {};
    const bestThirds = qualified.bestThirds || [];
    const groups = bestThirds.map(t => t.group);
    const sortedGroupsStr = [...groups].sort().join('');

    // Override for the official qualified third-placed groups combination (B, D, E, F, H, I, J, K)
    if (sortedGroupsStr === 'BDEFHIJK') {
      const teamByGroup = Object.fromEntries(bestThirds.map(t => [t.group, t.team]));
      const mapping = {
        '74:away': 'D', // Paraguai
        '77:away': 'F', // Suécia
        '79:away': 'E', // Equador
        '80:away': 'K', // RD Congo
        '81:away': 'I', // Senegal
        '82:away': 'B', // Bósnia
        '85:away': 'J', // Argélia
        '87:away': 'H'  // Cabo Verde
      };
      for (const [key, grp] of Object.entries(mapping)) {
        if (teamByGroup[grp]) {
          assignments[key] = teamByGroup[grp];
        }
      }
      return assignments;
    }

    // Override for the alternative combination with Group L (B, D, E, F, I, J, K, L)
    if (sortedGroupsStr === 'BDEFIJKL') {
      const teamByGroup = Object.fromEntries(bestThirds.map(t => [t.group, t.team]));
      const mapping = {
        '74:away': 'D', // Paraguai
        '77:away': 'F', // Suécia
        '79:away': 'E', // Equador
        '80:away': 'K', // RD Congo
        '81:away': 'I', // Senegal
        '82:away': 'B', // Bósnia
        '85:away': 'J', // Argélia
        '84:away': 'L'  // Croácia
      };
      for (const [key, grp] of Object.entries(mapping)) {
        if (teamByGroup[grp]) {
          assignments[key] = teamByGroup[grp];
        }
      }
      return assignments;
    }

    const used = new Set();
    (data?.matches || [])
      .filter(m => m.stage === 'round32')
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach(match => {
        ['home', 'away'].forEach(side => {
          const raw = String(match[side] || '');
          const m = raw.match(/^3\.º Grupo ([A-L](?:\/[A-L])*)$/);
          if (!m) return;
          const candidates = m[1].split('/');
          const chosen = bestThirds.find(row => candidates.includes(row.group) && !used.has(row.group));
          if (chosen) {
            used.add(chosen.group);
            assignments[`${match.id}:${side}`] = chosen.team;
          }
        });
      });
    return assignments;
  }

  function resolveOfficialPreviousLocal(label) {
    const text = String(label || '');
    const win = text.match(/^Vencedor Jogo (\d+)$/);
    if (win) {
      const official = resultSourceByMatchId(win[1]);
      return winnerFromResultLike(official) || text;
    }
    const loss = text.match(/^Perdedor Jogo (\d+)$/);
    if (loss) {
      const result = resultSourceByMatchId(loss[1]);
      if (!result) return text;
      const winner = winnerFromResultLike(result);
      if (!winner) return text;
      return winner === result.homeTeam ? result.awayTeam : result.homeTeam;
    }
    return text;
  }

  function resolveOfficialTeamLocal(match, side) {
    const raw = String(match?.[side] || '');
    if (!match || match.stage === 'groups') return raw;
    const q = getOfficialQualifiedLocal();
    const pos = raw.match(/^(1|2)\.º Grupo ([A-L])$/);
    if (pos) {
      const source = pos[1] === '1' ? q.first[pos[2]] : q.second[pos[2]];
      return source?.team || raw;
    }
    if (/^3\.º Grupo/.test(raw)) {
      return buildThirdAssignmentsLocal()[`${match.id}:${side}`] || raw;
    }
    return resolveOfficialPreviousLocal(raw);
  }

  function getParticipantKey(item) {
    return item?.participantKey || normalizeKeyLocal(item?.participantName || item?.name || '');
  }

  function getParticipantByKey(key) {
    return publicPredictions.find(item => getParticipantKey(item) === key) || null;
  }

  function buildScenarioDocKey(matchId, homeTeam, awayTeam) {
    return `${Number(matchId)}:${teamKeyLocal(homeTeam)}:${teamKeyLocal(awayTeam)}`;
  }

  function findSavedReformDoc(participantKey, matchId, homeTeam = '', awayTeam = '') {
    const docs = window.__worldcupReformsCache?.filter?.(doc =>
      String(doc.participantKey) === String(participantKey) &&
      Number(doc.matchId) === Number(matchId)
    ) || [];
    if (!docs.length) return null;

    const exact = docs.find(doc =>
      teamKeyLocal(doc.homeTeam) === teamKeyLocal(homeTeam) &&
      teamKeyLocal(doc.awayTeam) === teamKeyLocal(awayTeam)
    );
    return exact || docs[0] || null;
  }

  function buildSemifinalScenarioEntries(stage) {
    if (!['third_place', 'final'].includes(stage)) return [];
    const baseMatch = (data?.matches || []).find(match => match.stage === stage);
    if (!baseMatch) return [];

    const semifinals = (data?.matches || [])
      .filter(match => match.stage === 'semifinals')
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map(match => ({
        teams: [resolveOfficialTeamLocal(match, 'home'), resolveOfficialTeamLocal(match, 'away')]
          .filter(team => !isTeamUnresolved(team))
      }));

    if (semifinals.length < 2 || semifinals.some(item => item.teams.length < 2)) return [];

    return semifinals[0].teams.flatMap(homeTeam =>
      semifinals[1].teams.map(awayTeam => ({
        match: baseMatch,
        homeTeam,
        awayTeam,
        scenarioStage: 'semifinals',
        scenarioKey: buildScenarioDocKey(baseMatch.id, homeTeam, awayTeam),
        scenarioLabel: stage === 'third_place'
          ? 'Hipotese possivel do 3.º/4.º lugar'
          : 'Hipotese possivel da final'
      }))
    );
  }

  function existingReformFor(participantKey, matchId) {
    if (typeof section2Docs !== 'undefined') {
      // section2Docs é privada no primeiro módulo, por isso este caminho normalmente não existe.
      return null;
    }
    return null;
  }

  function updateReformButton() {
    const btn = document.querySelector('#reformPredictionsBtnClosed');
    if (!btn) return;
    const active = reformWindows.activeStages || openStagesNow();
    if (!active.length) {
      btn.hidden = true;
      btn.textContent = 'Reformular prognósticos';
      return;
    }
    const label = STAGE_LABELS[active[0]] || 'eliminatórias';
    btn.hidden = false;
    btn.textContent = `Reformular prognósticos dos ${label.toLowerCase()}`;
  }
  window.refreshReformButtonState = async function(force = true) {
    await loadReformWindows(force);
    updateReformButton();
  };

  function renderReformLogin(message = '') {
    const activeStages = reformWindows.activeStages || openStagesNow();
    const currentStage = activeStages[0] || '';
    const windowInfo = currentStage ? findWindowPair(currentStage) : null;
    const players = [...publicPredictions]
      .filter(item => item.status !== 'official' && item.type !== 'officialResult' && Array.isArray(item.matches))
      .sort((a, b) => String(a.participantName || '').localeCompare(String(b.participantName || ''), 'pt-PT'));

    if (!activeStages.length) {
      return `
        <div class="modal-head">
          <div>
            <p class="eyebrow small">Secção 2</p>
            <h2>Reformular prognósticos</h2>
            <p class="modal-muted">Neste momento não há nenhuma fase aberta para reformulação.</p>
          </div>
        </div>
        <section class="reform-box">
          <p>Cria/atualiza o documento <strong>settings/endateworld</strong> com a janela da fase que queres abrir.</p>
        </section>
      `;
    }

    return `
      <div class="modal-head">
        <div>
          <p class="eyebrow small">Secção 2</p>
          <h2>Reformular prognósticos — ${escapeHtml(STAGE_LABELS[currentStage])}</h2>
          <p class="modal-muted">Escolhe o teu nome e escreve o PIN que está associado ao teu prognóstico inicial.</p>
        </div>
      </div>
      <section class="reform-box">
        <div class="reform-window-note">
          <strong>Janela aberta:</strong>
          <span>${formatDateTime(windowInfo?.open)} até ${formatDateTime(windowInfo?.close)}</span>
        </div>
        <div class="reform-login-grid">
          <label>Participante
            <select id="reformParticipant">
              <option value="">Escolhe o participante</option>
              ${players.map(item => {
                const key = getParticipantKey(item);
                return `<option value="${escapeHtml(key)}" ${reformSession.participantKey === key ? 'selected' : ''}>${escapeHtml(item.participantName || key)}</option>`;
              }).join('')}
            </select>
          </label>
          <label>PIN
            <input id="reformPin" type="password" inputmode="numeric" autocomplete="one-time-code" placeholder="Ex.: 482917">
          </label>
          <button type="button" class="primary" data-reform-login>Entrar</button>
        </div>
        ${message ? `<p class="admin-message error">${escapeHtml(message)}</p>` : ''}
      </section>
    `;
  }

  function renderReformStage() {
    const item = getParticipantByKey(reformSession.participantKey);
    const activeStages = reformWindows.activeStages || openStagesNow();
    if (!item || !reformSession.pinOk) return renderReformLogin();
    if (!activeStages.includes(reformSession.activeStage)) reformSession.activeStage = activeStages[0] || 'round32';
    const stage = reformSession.activeStage;
    const windowInfo = findWindowPair(stage);
    const matches = (data?.matches || []).filter(match => match.stage === stage);
    const showFinalBundle = stage === 'semifinals';

    const correctMatchups = matches.map(match => {
      const home = resolveOfficialTeamLocal(match, 'home');
      const away = resolveOfficialTeamLocal(match, 'away');
      const unresolved = isTeamUnresolved(home) || isTeamUnresolved(away);
      if (unresolved) return null;
      const initialPred = findInitialPredictionForMatch(item, match, home, away);
      if (!initialPred || !sameMatchupAnySideLocal(initialPred, { homeTeam: home, awayTeam: away })) {
        return null;
      }
      const canonicalMatch = findCanonicalStageMatchLocal(match, home, away);
      return {
        match: canonicalMatch || match,
        home,
        away
      };
    }).filter(Boolean);

    let correctMatchesSummaryHtml = '';
    if (correctMatchups.length > 0) {
      correctMatchesSummaryHtml = `
        <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 14px 18px; margin-bottom: 20px; font-size: 0.9rem; text-align: left;">
          <strong style="color: #4ade80; display: block; margin-bottom: 6px; font-weight: 800;">✅ Confrontos que acertaste no prognóstico inicial (${correctMatchups.length}):</strong>
          <ul style="margin: 0; padding-left: 18px; line-height: 1.6; color: #a8b7cf; font-weight: 600;">
            ${correctMatchups.map(entry => {
              const matchId = entry.match?.id ?? '';
              return `<li>Jogo ${escapeHtml(matchId)}: <strong>${escapeHtml(entry.home)} vs ${escapeHtml(entry.away)}</strong></li>`;
            }).join('')}
          </ul>
        </div>
      `;
    } else {
      correctMatchesSummaryHtml = `
        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 16px; padding: 14px 18px; margin-bottom: 20px; font-size: 0.9rem; text-align: left;">
          <strong style="color: #f87171; display: block; font-weight: 800;">❌ Não acertaste nenhum confronto inicial para esta fase.</strong>
        </div>
      `;
    }

    return `
      <div class="modal-head">
        <div>
          <p class="eyebrow small">Secção 2 — PIN validado</p>
          <h2>${escapeHtml(item.participantName || 'Participante')}</h2>
          <p class="modal-muted">Reformula apenas os jogos da fase aberta. A Secção 1 fica guardada intacta.</p>
        </div>
      </div>
      <section class="reform-box">
        ${correctMatchesSummaryHtml}
        <div class="reform-window-note">
          <strong>${escapeHtml(STAGE_LABELS[stage])}</strong>
          <span>Fecha em ${formatDateTime(windowInfo?.close)}</span>
        </div>
        <div class="section2-stage-tabs">
          ${activeStages.map(s => `<button type="button" class="section2-stage-tab ${s === stage ? 'active' : ''}" data-reform-stage="${escapeHtml(s)}">${escapeHtml(STAGE_LABELS[s])}</button>`).join('')}
        </div>
        <div class="section2-games">
          ${matches.map(match => renderReformMatch(match, item)).join('') || '<p class="modal-muted">Não há jogos nesta fase.</p>'}
        </div>
      </section>
    `;
  }

  function findSavedReform(item, matchId) {
    const key = getParticipantKey(item);
    return window.__worldcupReformsCache?.find?.(doc => String(doc.participantKey) === String(key) && Number(doc.matchId) === Number(matchId)) || null;
  }

  async function loadReformsCache() {
    window.__worldcupReformsCache = [];
    try {
      const ref = firebaseTools.collection(firestoreDb, REFORM_COLLECTION);
      const snap = await firebaseTools.getDocs(ref);
      window.__worldcupReformsCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Não foi possível carregar reformulações.', error);
    }
  }

  function renderReformMatch(match, item) {
    const home = resolveOfficialTeamLocal(match, 'home');
    const away = resolveOfficialTeamLocal(match, 'away');
    const unresolved = isTeamUnresolved(home) || isTeamUnresolved(away);
    const open = isStageWindowOpen(match.stage) && !unresolved && new Date() < matchKickoffLocal(match);
    const initialPred = findInitialPredictionForMatch(item, match, home, away);
    const initialMatchupOk = initialPred && sameMatchupAnySideLocal(initialPred, { homeTeam: home, awayTeam: away });
    const saved = findSavedReform(item, match.id);
    const mode = saved?.mode || (initialMatchupOk ? 'replicate' : 'changed');
    const homeGoals = saved?.homeGoals ?? '';
    const awayGoals = saved?.awayGoals ?? '';
    const method = saved?.method || '90';
    const winnerTeam = saved?.winnerTeam || '';

    return `
      <article class="section2-card" data-reform-match="${escapeHtml(match.id)}">
        <div class="section2-card-head">
          <div>
            <span class="badge">Jogo ${escapeHtml(match.id)} · ${escapeHtml(STAGE_LABELS[match.stage])}</span>
            <h3>${escapeHtml(home)} vs ${escapeHtml(away)}</h3>
            <p class="modal-muted">${escapeHtml(match.date)} ${escapeHtml(match.time || '')} · ${escapeHtml(match.venue || '')}</p>
          </div>
          ${saved ? '<strong class="saved-chip">Gravado</strong>' : open ? '<span class="future-chip">Aberto</span>' : '<span class="official-chip">Fechado</span>'}
        </div>
        ${unresolved ? '<p class="modal-muted">Ainda falta definir oficialmente as seleções deste jogo.</p>' : `
          <div class="section2-initial">
            <strong>O teu prognóstico inicial:</strong>
            <span>${initialPred ? predictionResultText(initialPred) : 'Não existia para este jogo.'}</span>
            <em>${initialMatchupOk ? 'Tinhas acertado nas seleções deste confronto.' : 'Este confronto real não existia no teu prognóstico inicial.'}</em>
          </div>
          ${initialMatchupOk ? `
            <div class="section2-mode">
              <label><input type="radio" name="reform-mode-${match.id}" value="replicate" ${mode === 'replicate' ? 'checked' : ''} ${!open ? 'disabled' : ''}> Manter prognóstico inicial</label>
              <label><input type="radio" name="reform-mode-${match.id}" value="changed" ${mode === 'changed' ? 'checked' : ''} ${!open ? 'disabled' : ''}> Alterar resultado</label>
            </div>
          ` : '<p class="modal-muted">Como não acertaste este confronto, tens de fazer um novo prognóstico.</p>'}
          <div class="section2-form ${mode === 'replicate' && initialMatchupOk ? 'is-hidden' : ''}">
            <div class="score-row compact">
              <span>${escapeHtml(home)}</span>
              <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-reform-field="homeGoals" value="${escapeHtml(homeGoals)}" ${!open ? 'disabled' : ''}>
              <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-reform-field="awayGoals" value="${escapeHtml(awayGoals)}" ${!open ? 'disabled' : ''}>
              <span>${escapeHtml(away)}</span>
            </div>
            <div class="ko-row">
              <select data-reform-field="method" ${!open ? 'disabled' : ''}>
                <option value="90" ${method === '90' ? 'selected' : ''}>90 minutos</option>
                <option value="et" ${method === 'et' ? 'selected' : ''}>Prolongamento</option>
                <option value="pens" ${method === 'pens' ? 'selected' : ''}>Penáltis</option>
              </select>
              <select data-reform-field="winnerTeam" ${!open ? 'disabled' : ''}>
                <option value="" ${!winnerTeam ? 'selected' : ''}>Vencedor se houver empate</option>
                <option value="${escapeHtml(home)}" ${winnerTeam === home ? 'selected' : ''}>${escapeHtml(home)}</option>
                <option value="${escapeHtml(away)}" ${winnerTeam === away ? 'selected' : ''}>${escapeHtml(away)}</option>
              </select>
            </div>
          </div>
          <button type="button" class="primary" data-reform-save ${!open ? 'disabled' : ''}>Gravar reformulação</button>
          <p class="admin-message" data-reform-message>${open ? 'Podes gravar enquanto a janela desta fase estiver aberta.' : 'Este jogo já não aceita alterações.'}</p>
        `}
      </article>
    `;
  }

  async function openReformModal() {
    openModal('<h2>Reformular prognósticos</h2><p class="modal-muted">A carregar jogadores, PIN e janelas<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></p>');
    await Promise.allSettled([
      loadApiWorldCupData({ sync: false }),
      loadPublicPredictions(),
      loadReformWindows(true),
      loadReformsCache(),
      loadReformFlags()
    ]);
    const active = reformWindows.activeStages || openStagesNow();
    reformSession.activeStage = active[0] || '';
    reformSession.pinOk = false;
    openModal(renderReformLogin());
  }

  async function handleReformLogin() {
    const key = document.querySelector('#reformParticipant')?.value || '';
    const pin = String(document.querySelector('#reformPin')?.value || '').trim();
    const item = getParticipantByKey(key);
    if (!item) {
      openModal(renderReformLogin('Escolhe um participante.'));
      return;
    }
    if (!String(item.pin || '').trim()) {
      openModal(renderReformLogin('Este participante ainda não tem PIN associado. Fala com o organizador.'));
      return;
    }
    if (String(item.pin || '').trim() !== pin) {
      openModal(renderReformLogin('PIN incorreto. Confirma o PIN desse participante.'));
      return;
    }
    reformSession.participantKey = key;
    reformSession.participantName = item.participantName || key;
    reformSession.pinOk = true;
    localStorage.setItem('worldcup2026_reform_participant', key);
    openModal(renderReformStage());
  }

  async function saveReformMatch(card) {
    const item = getParticipantByKey(reformSession.participantKey);
    if (!item || !reformSession.pinOk) {
      alert('Tens de validar o PIN antes de gravar.');
      return;
    }
    const match = data.matches.find(m => Number(m.id) === Number(card.dataset.reformMatch));
    if (!match || !isStageWindowOpen(match.stage) || new Date() >= matchKickoffLocal(match)) {
      alert('A janela deste jogo/fase já não está aberta.');
      return;
    }
    const homeTeam = resolveOfficialTeamLocal(match, 'home');
    const awayTeam = resolveOfficialTeamLocal(match, 'away');
    if (isTeamUnresolved(homeTeam) || isTeamUnresolved(awayTeam)) {
      alert('Ainda falta definir oficialmente as seleções deste jogo.');
      return;
    }

    const participantKey = getParticipantKey(item);
    const initialPred = findInitialPredictionForMatch(item, match, homeTeam, awayTeam);
    const initialMatchupOk = initialPred && sameMatchupAnySideLocal(initialPred, { homeTeam, awayTeam });
    const selectedMode = card.querySelector(`input[name="reform-mode-${match.id}"]:checked`)?.value || (initialMatchupOk ? 'replicate' : 'changed');
    const mode = initialMatchupOk ? selectedMode : 'changed';
    let homeGoals = null, awayGoals = null, method = '90', winnerTeam = '';

    if (mode === 'changed') {
      homeGoals = Number(card.querySelector('[data-reform-field="homeGoals"]')?.value);
      awayGoals = Number(card.querySelector('[data-reform-field="awayGoals"]')?.value);
      method = card.querySelector('[data-reform-field="method"]')?.value || '90';
      winnerTeam = card.querySelector('[data-reform-field="winnerTeam"]')?.value || '';
      if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) {
        alert('Preenche o resultado antes de gravares.');
        return;
      }
      if (homeGoals === awayGoals && !winnerTeam) {
        alert('Em caso de empate, escolhe quem passa.');
        return;
      }
      if (homeGoals > awayGoals) winnerTeam = homeTeam;
      if (awayGoals > homeGoals) winnerTeam = awayTeam;
    }

    const docId = `${participantKey}_${match.stage}_${match.id}`;
    const payload = {
      status: 'section2',
      type: 'knockoutRevision',
      participantName: item.participantName || reformSession.participantName,
      participantKey,
      stage: match.stage,
      stageLabel: STAGE_LABELS[match.stage],
      matchId: Number(match.id),
      matchDate: match.date,
      matchTime: match.time || null,
      matchStartsAt: matchKickoffLocal(match).toISOString(),
      homeTeam,
      awayTeam,
      mode,
      initialMatchupOk: !!initialMatchupOk,
      initialPrediction: initialPred || null,
      homeGoals,
      awayGoals,
      method,
      winnerTeam: mode === 'replicate' ? (initialPred?.winnerTeam || '') : winnerTeam,
      pinVerified: true,
      updatedAt: firebaseTools.serverTimestamp(),
      clientTimestamp: new Date().toISOString()
    };

    const msg = card.querySelector('[data-reform-message]');
    try {
      await firebaseTools.setDoc(firebaseTools.doc(firestoreDb, REFORM_COLLECTION, docId), payload, { merge: true });
      if (msg) msg.textContent = 'Gravado com sucesso.';
      await Promise.allSettled([loadPublicPredictions(), loadReformsCache()]);
      openModal(renderReformStage());
    } catch (error) {
      console.error(error);
      if (msg) msg.textContent = 'Não foi possível gravar. Tenta novamente mais tarde ou fala com o organizador.';
      alert('Não foi possível gravar a reformulação. Tenta novamente mais tarde ou fala com o organizador.');
    }
  }

  document.addEventListener('click', async (event) => {
    const openBtn = event.target.closest('#reformPredictionsBtnClosed');
    if (openBtn) {
      await openReformModal();
      return;
    }

    const loginBtn = event.target.closest('[data-reform-login]');
    if (loginBtn) {
      await handleReformLogin();
      return;
    }

    const stageBtn = event.target.closest('[data-reform-stage]');
    if (stageBtn) {
      reformSession.activeStage = stageBtn.dataset.reformStage;
      openModal(renderReformStage());
      return;
    }

    const saveBtn = event.target.closest('[data-reform-save]');
    if (saveBtn) {
      const card = saveBtn.closest('[data-reform-match]');
      if (card) await saveReformMatch(card);
    }
  });

  document.addEventListener('change', (event) => {
    const modeInput = event.target.closest('.section2-mode input[type="radio"][name^="reform-mode-"]');
    if (!modeInput) return;
    const card = modeInput.closest('[data-reform-match]');
    const form = card?.querySelector('.section2-form');
    if (form) form.classList.toggle('is-hidden', modeInput.value === 'replicate');
  });

  const previousRenderClosed = typeof renderClosedPublicView === 'function' ? renderClosedPublicView : null;
  if (previousRenderClosed) {
    renderClosedPublicView = async function() {
      await previousRenderClosed();
      await loadReformWindows(true);
      updateReformButton();
    };
  }

  function renderSemifinalBundle(item, semifinalMatches) {
    const thirdPlaceOptions = buildSemifinalScenarioEntries('third_place');
    const finalOptions = buildSemifinalScenarioEntries('final');
    return `
      <div class="reform-stage-cluster">
        <section class="reform-stage-section">
          <div class="reform-stage-section__head">
            <p class="eyebrow small">Meias-finais</p>
            <h3>Jogos reais desta fase</h3>
          </div>
          <div class="section2-games">
            ${semifinalMatches.map(match => renderReformMatch(match, item)).join('') || '<p class="modal-muted">Nao ha jogos nas meias-finais.</p>'}
          </div>
        </section>
        <section class="reform-stage-section">
          <div class="reform-stage-section__head">
            <p class="eyebrow small">3.º/4.º lugar</p>
            <h3>Quatro hipoteses possiveis</h3>
            <p class="modal-muted">Como as meias ainda nao aconteceram, podes preparar qualquer combinacao possivel.</p>
          </div>
          <div class="section2-games">
            ${thirdPlaceOptions.map(entry => renderReformMatch(entry.match, item, entry)).join('') || '<p class="modal-muted">Ainda nao foi possivel gerar as combinacoes do 3.º/4.º lugar.</p>'}
          </div>
        </section>
        <section class="reform-stage-section">
          <div class="reform-stage-section__head">
            <p class="eyebrow small">Final</p>
            <h3>Quatro hipoteses possiveis</h3>
            <p class="modal-muted">A final fica separada para tornares a escolha mais clara.</p>
          </div>
          <div class="section2-games">
            ${finalOptions.map(entry => renderReformMatch(entry.match, item, entry)).join('') || '<p class="modal-muted">Ainda nao foi possivel gerar as combinacoes da final.</p>'}
          </div>
        </section>
      </div>
    `;
  }

  function renderReformStage() {
    const item = getParticipantByKey(reformSession.participantKey);
    const activeStages = reformWindows.activeStages || openStagesNow();
    if (!item || !reformSession.pinOk) return renderReformLogin();
    if (!activeStages.includes(reformSession.activeStage)) reformSession.activeStage = activeStages[0] || 'round32';
    const stage = reformSession.activeStage;
    const windowInfo = findWindowPair(stage);
    const matches = (data?.matches || []).filter(match => match.stage === stage);
    const showFinalBundle = stage === 'semifinals';
    const correctMatchups = matches.map(match => {
      const home = resolveOfficialTeamLocal(match, 'home');
      const away = resolveOfficialTeamLocal(match, 'away');
      if (isTeamUnresolved(home) || isTeamUnresolved(away)) return null;
      const initialPred = findInitialPredictionForMatch(item, match, home, away);
      if (!initialPred || !sameMatchupAnySideLocal(initialPred, { homeTeam: home, awayTeam: away })) return null;
      const canonicalMatch = findCanonicalStageMatchLocal(match, home, away);
      return { match: canonicalMatch || match, home, away };
    }).filter(Boolean);
    const correctMatchesSummaryHtml = correctMatchups.length > 0 ? `
      <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 14px 18px; margin-bottom: 20px; font-size: 0.9rem; text-align: left;">
        <strong style="color: #4ade80; display: block; margin-bottom: 6px; font-weight: 800;">Confrontos que acertaste no prognostico inicial (${correctMatchups.length}):</strong>
        <ul style="margin: 0; padding-left: 18px; line-height: 1.6; color: #a8b7cf; font-weight: 600;">
          ${correctMatchups.map(entry => `<li>Jogo ${escapeHtml(entry.match?.id ?? '')}: <strong>${escapeHtml(entry.home)} vs ${escapeHtml(entry.away)}</strong></li>`).join('')}
        </ul>
      </div>
    ` : `
      <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 16px; padding: 14px 18px; margin-bottom: 20px; font-size: 0.9rem; text-align: left;">
        <strong style="color: #f87171; display: block; font-weight: 800;">Nao acertaste nenhum confronto inicial para esta fase.</strong>
      </div>
    `;
    return `
      <div class="modal-head">
        <div>
          <p class="eyebrow small">Seccao 2 - PIN validado</p>
          <h2>${escapeHtml(item.participantName || 'Participante')}</h2>
          <p class="modal-muted">Reformula apenas os jogos da fase aberta. A Seccao 1 fica guardada intacta.</p>
        </div>
      </div>
      <section class="reform-box">
        ${correctMatchesSummaryHtml}
        <div class="reform-window-note">
          <strong>${escapeHtml(STAGE_LABELS[stage])}</strong>
          <span>Fecha em ${formatDateTime(windowInfo?.close)}</span>
        </div>
        <div class="section2-stage-tabs">
          ${activeStages.map(s => `<button type="button" class="section2-stage-tab ${s === stage ? 'active' : ''}" data-reform-stage="${escapeHtml(s)}">${escapeHtml(STAGE_LABELS[s])}</button>`).join('')}
        </div>
        ${showFinalBundle ? renderSemifinalBundle(item, matches) : `
          <div class="section2-games">
            ${matches.map(match => renderReformMatch(match, item)).join('') || '<p class="modal-muted">Nao ha jogos nesta fase.</p>'}
          </div>
        `}
      </section>
    `;
  }

  function renderReformMatch(match, item, scenario = null) {
    const home = scenario?.homeTeam || resolveOfficialTeamLocal(match, 'home');
    const away = scenario?.awayTeam || resolveOfficialTeamLocal(match, 'away');
    const unresolved = isTeamUnresolved(home) || isTeamUnresolved(away);
    const windowStage = scenario?.scenarioStage || match.stage;
    const visualStage = match.stage;
    const open = isStageWindowOpen(windowStage) && !unresolved && new Date() < matchKickoffLocal(match);
    const initialPred = findInitialPredictionForMatch(item, match, home, away);
    const initialMatchupOk = initialPred && sameMatchupAnySideLocal(initialPred, { homeTeam: home, awayTeam: away });
    const saved = findSavedReformDoc(getParticipantKey(item), match.id, home, away);
    const mode = saved?.mode || (initialMatchupOk ? 'replicate' : 'changed');
    const homeGoals = saved?.homeGoals ?? '';
    const awayGoals = saved?.awayGoals ?? '';
    const method = saved?.method || '90';
    const winnerTeam = saved?.winnerTeam || '';
    const homeDisplay = renderTeamWithFlag(home);
    const awayDisplay = renderTeamWithFlag(away);
    return `
      <article class="section2-card section2-card--${escapeHtml(visualStage)} ${scenario ? 'section2-card--scenario' : ''}" data-reform-match="${escapeHtml(match.id)}" data-reform-home="${escapeHtml(home)}" data-reform-away="${escapeHtml(away)}" data-reform-window-stage="${escapeHtml(windowStage)}" data-reform-scenario-key="${escapeHtml(scenario?.scenarioKey || buildScenarioDocKey(match.id, home, away))}">
        <div class="section2-card-head">
          <div>
            <span class="badge">Jogo ${escapeHtml(match.id)} · ${escapeHtml(STAGE_LABELS[match.stage])}</span>
            <h3 class="section2-match-title">${homeDisplay}<span class="section2-match-vs">vs</span>${awayDisplay}</h3>
            <p class="modal-muted">${escapeHtml(match.date)} ${escapeHtml(match.time || '')} · ${escapeHtml(match.venue || '')}</p>
            ${scenario?.scenarioLabel ? `<p class="section2-scenario-label">${escapeHtml(scenario.scenarioLabel)}</p>` : ''}
          </div>
          ${saved ? '<strong class="saved-chip">Gravado</strong>' : open ? '<span class="future-chip">Aberto</span>' : '<span class="official-chip">Fechado</span>'}
        </div>
        ${unresolved ? '<p class="modal-muted">Ainda falta definir oficialmente as selecoes deste jogo.</p>' : `
          <div class="section2-initial">
            <strong>O teu prognostico inicial:</strong>
            <span>${initialPred ? predictionResultText(initialPred) : 'Nao existia para este jogo.'}</span>
            <em>${initialMatchupOk ? 'Tinhas acertado nas selecoes deste confronto.' : 'Este confronto real nao existia no teu prognostico inicial.'}</em>
          </div>
          ${initialMatchupOk ? `
            <div class="section2-mode">
              <label><input type="radio" name="reform-mode-${match.id}-${teamKeyLocal(home)}-${teamKeyLocal(away)}" value="replicate" ${mode === 'replicate' ? 'checked' : ''} ${!open ? 'disabled' : ''}> Manter prognostico inicial</label>
              <label><input type="radio" name="reform-mode-${match.id}-${teamKeyLocal(home)}-${teamKeyLocal(away)}" value="changed" ${mode === 'changed' ? 'checked' : ''} ${!open ? 'disabled' : ''}> Alterar resultado</label>
            </div>
          ` : '<p class="modal-muted">Como nao acertaste este confronto, tens de fazer um novo prognostico.</p>'}
          <div class="section2-form ${mode === 'replicate' && initialMatchupOk ? 'is-hidden' : ''}">
            <div class="score-row compact">
              <span>${homeDisplay}</span>
              <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-reform-field="homeGoals" value="${escapeHtml(homeGoals)}" ${!open ? 'disabled' : ''}>
              <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-reform-field="awayGoals" value="${escapeHtml(awayGoals)}" ${!open ? 'disabled' : ''}>
              <span>${awayDisplay}</span>
            </div>
            <div class="ko-row">
              <select data-reform-field="method" ${!open ? 'disabled' : ''}>
                <option value="90" ${method === '90' ? 'selected' : ''}>90 minutos</option>
                <option value="et" ${method === 'et' ? 'selected' : ''}>Prolongamento</option>
                <option value="pens" ${method === 'pens' ? 'selected' : ''}>Penaltis</option>
              </select>
              <select data-reform-field="winnerTeam" ${!open ? 'disabled' : ''}>
                <option value="" ${!winnerTeam ? 'selected' : ''}>Vencedor se houver empate</option>
                <option value="${escapeHtml(home)}" ${winnerTeam === home ? 'selected' : ''}>${escapeHtml(home)}</option>
                <option value="${escapeHtml(away)}" ${winnerTeam === away ? 'selected' : ''}>${escapeHtml(away)}</option>
              </select>
            </div>
          </div>
          <button type="button" class="primary section2-save-btn section2-save-btn--${escapeHtml(visualStage)}" data-reform-save ${!open ? 'disabled' : ''}>Gravar reformulacao</button>
          <p class="admin-message" data-reform-message>${open ? `Podes gravar enquanto a janela de ${escapeHtml(String(STAGE_LABELS[windowStage] || windowStage).toLowerCase())} estiver aberta.` : 'Este jogo ja nao aceita alteracoes.'}</p>
        `}
      </article>
    `;
  }

  async function saveReformMatch(card) {
    const item = getParticipantByKey(reformSession.participantKey);
    if (!item || !reformSession.pinOk) {
      alert('Tens de validar o PIN antes de gravar.');
      return;
    }
    const match = data.matches.find(m => Number(m.id) === Number(card.dataset.reformMatch));
    const windowStage = card.dataset.reformWindowStage || match?.stage || '';
    if (!match || !isStageWindowOpen(windowStage) || new Date() >= matchKickoffLocal(match)) {
      alert('A janela deste jogo/fase ja nao esta aberta.');
      return;
    }
    const homeTeam = card.dataset.reformHome || resolveOfficialTeamLocal(match, 'home');
    const awayTeam = card.dataset.reformAway || resolveOfficialTeamLocal(match, 'away');
    if (isTeamUnresolved(homeTeam) || isTeamUnresolved(awayTeam)) {
      alert('Ainda falta definir oficialmente as selecoes deste jogo.');
      return;
    }
    const participantKey = getParticipantKey(item);
    const initialPred = findInitialPredictionForMatch(item, match, homeTeam, awayTeam);
    const initialMatchupOk = initialPred && sameMatchupAnySideLocal(initialPred, { homeTeam, awayTeam });
    const radioName = `reform-mode-${match.id}-${teamKeyLocal(homeTeam)}-${teamKeyLocal(awayTeam)}`;
    const selectedMode = card.querySelector(`input[name="${radioName}"]:checked`)?.value || (initialMatchupOk ? 'replicate' : 'changed');
    const mode = initialMatchupOk ? selectedMode : 'changed';
    let homeGoals = null, awayGoals = null, method = '90', winnerTeam = '';
    if (mode === 'changed') {
      homeGoals = Number(card.querySelector('[data-reform-field="homeGoals"]')?.value);
      awayGoals = Number(card.querySelector('[data-reform-field="awayGoals"]')?.value);
      method = card.querySelector('[data-reform-field="method"]')?.value || '90';
      winnerTeam = card.querySelector('[data-reform-field="winnerTeam"]')?.value || '';
      if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) {
        alert('Preenche o resultado antes de gravares.');
        return;
      }
      if (homeGoals === awayGoals && !winnerTeam) {
        alert('Em caso de empate, escolhe quem passa.');
        return;
      }
      if (homeGoals > awayGoals) winnerTeam = homeTeam;
      if (awayGoals > homeGoals) winnerTeam = awayTeam;
    }
    const docId = `${participantKey}_${match.stage}_${match.id}_${teamKeyLocal(homeTeam)}_${teamKeyLocal(awayTeam)}`;
    const payload = {
      status: 'section2',
      type: 'knockoutRevision',
      participantName: item.participantName || reformSession.participantName,
      participantKey,
      stage: match.stage,
      stageLabel: STAGE_LABELS[match.stage],
      matchId: Number(match.id),
      matchDate: match.date,
      matchTime: match.time || null,
      matchStartsAt: matchKickoffLocal(match).toISOString(),
      homeTeam,
      awayTeam,
      mode,
      initialMatchupOk: !!initialMatchupOk,
      initialPrediction: initialPred || null,
      homeGoals,
      awayGoals,
      method,
      winnerTeam: mode === 'replicate' ? (initialPred?.winnerTeam || winnerFromResultLike(initialPred) || '') : winnerTeam,
      scenarioKey: card.dataset.reformScenarioKey || buildScenarioDocKey(match.id, homeTeam, awayTeam),
      windowStage,
      pinVerified: true,
      updatedAt: firebaseTools.serverTimestamp(),
      clientTimestamp: new Date().toISOString()
    };
    const msg = card.querySelector('[data-reform-message]');
    console.log("Saving reform payload:", payload);
    try {
      await firebaseTools.setDoc(firebaseTools.doc(firestoreDb, REFORM_COLLECTION, docId), payload, { merge: true });
      if (msg) msg.textContent = 'Gravado com sucesso.';
      await Promise.allSettled([loadPublicPredictions(), loadReformsCache()]);
      openModal(renderReformStage());
    } catch (error) {
      console.error(error);
      if (msg) msg.textContent = 'Nao foi possivel gravar. Tenta novamente mais tarde ou fala com o organizador.';
      alert('Nao foi possivel gravar a reformulacao. Tenta novamente mais tarde ou fala com o organizador.');
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => loadReformWindows(true), 600);
  });
})();
