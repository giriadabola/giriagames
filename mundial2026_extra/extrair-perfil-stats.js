const STAGE_LABELS = {
  groups: 'Fase de grupos',
  round32: '16 avos',
  round16: 'Oitavos',
  quarterfinals: 'Quartos',
  semifinals: 'Meias-finais',
  third_place: '3.º lugar',
  final: 'Final'
};

export const FILTERS = {
  lost: { title: 'Perdidos', text: 'Golos que tiraram pontos ao prognóstico.' },
  dramaticLost: { title: 'Dramaticamente perdidos', text: 'Perdas provocadas por golos a partir dos 90 minutos.' },
  commonResult: { title: 'Resultado comum', text: 'Resultados mais repetidos e os que mais acertam/falham.' },
  checkpoint: { title: 'Intervalo/90', text: 'Prognósticos em posição de pontuar ao intervalo, aos 90 e no fim.' },
  badScorers: { title: 'Marcador Azia', text: 'Marcadores que mais roubaram pontos.' },
  goodScorers: { title: 'Marcador Querido', text: 'Marcadores que mais deram pontos.' },
  lateGains: { title: 'Ganhos por uma unha', text: 'Ganhos provocados por golos a partir dos 90 minutos.' },
  gains: { title: 'Ganhos', text: 'Golos que deram pontos ao prognóstico.' },
  aloneInFame: { title: 'Sozinho na Fama', text: 'Jogos em que foi o único jogador a acertar no resultado exato.' },
  wonWithStyle: { title: 'Ganho com estilo', text: 'Jogos em que o Jogador acertou no Resultado exato' },
  selections: { title: 'Seleções', text: 'Impacto das seleções nos prognósticos.' },
  stadiums: { title: 'Estádios', text: 'Impacto dos estádios nos prognósticos.' },
  starsPath: { title: 'Rumo ao Estrelato', text: 'Evolução da posição do jogador na tabela classificativa jogo a jogo.' },
  leaderboard: { title: 'Tabela Classificativa', text: 'Tabela classificativa geral do torneio.' },
  sequence: { title: 'Sequência', text: 'Sequência de prognósticos jogo a jogo com pontuação obtida.' },
  prediction: { title: 'Prognóstico', text: 'Previsões dos jogadores para um jogo selecionado.' }
};

const PLAYER_GROUP_FILTERS = new Set(['lost', 'dramaticLost', 'commonResult', 'checkpoint', 'lateGains', 'gains', 'aloneInFame', 'wonWithStyle', 'selections', 'stadiums', 'sequence']);

export function buildProfile({ data, scopeId, activeFilters, groupByPlayer = false, selectedSelection = 'all', selectedStadium = 'all', selectedMatch = '', includeBw = true, includePp = true, compareOffset = 'none' }) {
  const selectedPlayers = scopeId === 'total'
    ? data.players
    : data.players.filter((player) => player.id === scopeId);
  const scopeLabel = scopeId === 'total' ? 'Total dos jogadores' : selectedPlayers[0]?.participantName || 'Jogador';
  const rows = buildRows(data, selectedPlayers);
  const transitions = rows.flatMap((row) => row.transitions);
  const summaries = Object.fromEntries(activeFilters.map((key) => [
    key,
    groupByPlayer && scopeId === 'total' && PLAYER_GROUP_FILTERS.has(key)
      ? summarizeFilterByPlayer(key, rows, transitions, data)
      : (key === 'selections'
          ? selectionsSummary(data, selectedSelection, rows, transitions, selectedPlayers)
          : (key === 'stadiums'
              ? stadiumsSummary(data, selectedStadium, rows, transitions, selectedPlayers)
              : (key === 'starsPath'
                  ? starsPathSummary(data, selectedPlayers, { includeBw, includePp })
                  : (key === 'leaderboard'
                      ? leaderboardSummary(data, selectedMatch, { includeBw, includePp, compareOffset })
                      : (key === 'sequence'
                          ? sequenceSummary(data, selectedPlayers)
                          : (key === 'prediction'
                              ? predictionSummary(data, selectedMatch, selectedPlayers)
                              : summarizeFilter(key, rows, transitions, data, selectedPlayers)))))))
  ]));

  return {
    scopeLabel,
    selectedPlayers,
    rows,
    transitions,
    summaries,
    totals: {
      players: selectedPlayers.length,
      predictions: rows.length,
      matchesWithGoals: new Set(rows.map((row) => String(row.match.id))).size,
      goalEvents: rows.reduce((sum, row) => sum + row.events.length, 0)
    }
  };
}

function summarizeFilterByPlayer(key, rows, transitions, data) {
  if (key === 'lost') return transitionByPlayerSummary(transitions.filter((item) => item.delta < 0), 'bad', true);
  if (key === 'dramaticLost') return transitionByPlayerSummary(transitions.filter((item) => item.delta < 0 && item.event.minuteValue >= 90), 'bad', true);
  if (key === 'gains') return transitionByPlayerSummary(transitions.filter((item) => item.delta > 0), 'good', false);
  if (key === 'lateGains') return transitionByPlayerSummary(transitions.filter((item) => item.delta > 0 && item.event.minuteValue >= 90), 'good', false);
  if (key === 'commonResult') return commonResultByPlayerSummary(rows);
  if (key === 'checkpoint') return checkpointByPlayerSummary(rows);
  if (key === 'aloneInFame') return aloneInFameByPlayerSummary(data);
  if (key === 'wonWithStyle') return wonWithStyleByPlayerSummary(rows);
  return { count: 0, tone: 'warn', rows: [] };
}

function buildRows(data, players) {
  return players.flatMap((player) => {
    return (player.matches || []).map((prediction) => {
      const matchId = String(prediction.id);
      const match = data.matches.find((item) => String(item.id) === matchId) || prediction;
      const official = normalizeOfficial(match, data.officialByMatchId[matchId], data.sofaByMatchId[matchId]);
      const sofa = data.sofaByMatchId[matchId];
      const events = goalEvents(match, sofa);
      const transitions = buildTransitions(player, prediction, match, events, data.scoringRules);
      return { player, prediction, match, official, sofa, events, transitions, scoringRules: data.scoringRules };
    }).filter((row) => row.prediction && row.official && hasScore(row.official));
  });
}

function normalizeOfficial(match, official, sofa) {
  const source = sofa || official;
  if (!source || !hasScore(source)) return null;
  return {
    ...source,
    stage: source.stage || match.stage,
    homeTeam: source.homeTeam || source.home || match.home || match.homeTeam,
    awayTeam: source.awayTeam || source.away || match.away || match.awayTeam,
    homeGoals: Number(source.homeGoals),
    awayGoals: Number(source.awayGoals)
  };
}

function goalEvents(match, sofa) {
  const homeTeam = sofa?.homeTeam || match.home || match.homeTeam;
  const awayTeam = sofa?.awayTeam || match.away || match.awayTeam;
  const home = normalizeGoalList(sofa?.homeGoalsList, 'home', homeTeam);
  const away = normalizeGoalList(sofa?.awayGoalsList, 'away', awayTeam);
  let homeGoals = 0;
  let awayGoals = 0;

  return [...home, ...away]
    .sort((a, b) => a.minuteValue - b.minuteValue)
    .map((event) => {
      const before = { homeGoals, awayGoals };
      if (event.side === 'home') homeGoals += 1;
      if (event.side === 'away') awayGoals += 1;
      return {
        ...event,
        before,
        after: { homeGoals, awayGoals },
        scoreText: `${homeGoals}-${awayGoals}`
      };
    });
}

function normalizeGoalList(list = [], side, teamName) {
  return list
    .map((goal, index) => {
      const minute = goal.minute ?? goal.minuteLabel ?? '';
      return {
        side,
        teamName,
        index,
        minuteLabel: formatMinuteLabel(minute),
        minuteValue: minuteValue(minute),
        scorer: goal.ownGoal ? `Autogolo (${teamName})` : (goal.player || goal.scorer || teamName || 'Marcador'),
        ownGoal: !!goal.ownGoal
      };
    })
    .filter((goal) => Number.isFinite(goal.minuteValue));
}

function buildTransitions(player, prediction, match, events, scoringRules) {
  return events.map((event) => {
    const beforeOfficial = stateAt(match, event.before);
    const afterOfficial = stateAt(match, event.after);
    const beforeScore = scorePrediction(prediction, beforeOfficial, scoringRules);
    const afterScore = scorePrediction(prediction, afterOfficial, scoringRules);
    return {
      player,
      prediction,
      match,
      event,
      beforePoints: beforeScore.points,
      afterPoints: afterScore.points,
      delta: afterScore.points - beforeScore.points
    };
  });
}

function stateAt(match, score) {
  return {
    ...match,
    homeTeam: match.homeTeam || match.home,
    awayTeam: match.awayTeam || match.away,
    homeGoals: score.homeGoals,
    awayGoals: score.awayGoals
  };
}

function summarizeFilter(key, rows, transitions, data, selectedPlayers) {
  if (key === 'lost') return transitionSummary(transitions.filter((item) => item.delta < 0), 'bad');
  if (key === 'dramaticLost') return transitionSummary(transitions.filter((item) => item.delta < 0 && item.event.minuteValue >= 90), 'bad');
  if (key === 'gains') return transitionSummary(transitions.filter((item) => item.delta > 0), 'good');
  if (key === 'lateGains') return transitionSummary(transitions.filter((item) => item.delta > 0 && item.event.minuteValue >= 90), 'good');
  if (key === 'badScorers') return scorerSummary(transitions.filter((item) => item.delta < 0), 'bad');
  if (key === 'goodScorers') return scorerSummary(transitions.filter((item) => item.delta > 0), 'good');
  if (key === 'commonResult') return commonResultSummary(rows);
  if (key === 'checkpoint') return checkpointSummary(rows);
  if (key === 'aloneInFame') return aloneInFameSummary(data, selectedPlayers);
  if (key === 'wonWithStyle') return wonWithStyleSummary(rows);
  return { count: 0, rows: [] };
}

function transitionSummary(items, tone) {
  const sorted = [...items].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.event.minuteValue - a.event.minuteValue);
  const totalPoints = items.reduce((sum, item) => sum + Math.abs(item.delta), 0);
  return {
    count: items.length,
    points: totalPoints,
    tone,
    rows: sorted.slice(0, 8).map((item) => ({
      title: `${item.player.participantName} · ${matchLabel(item.match)}`,
      meta: `${item.event.minuteLabel} · ${item.event.scorer} · ${item.event.scoreText}`,
      value: `${item.delta > 0 ? '+' : ''}${item.delta} pts`
    }))
  };
}

function transitionByPlayerSummary(items, tone, absoluteImpact) {
  const byPlayer = new Map();
  let totalPoints = 0;
  items.forEach((item) => {
    const id = item.player.id || item.player.participantName;
    const current = byPlayer.get(id) || { title: item.player.participantName, impact: 0, count: 0, examples: [] };
    const p = absoluteImpact ? Math.abs(item.delta) : item.delta;
    current.impact += p;
    totalPoints += p;
    current.count += 1;
    if (current.examples.length < 2) current.examples.push(`${matchLabel(item.match)} ${item.event.minuteLabel}`);
    byPlayer.set(id, current);
  });
  const rows = [...byPlayer.values()]
    .sort((a, b) => b.impact - a.impact || b.count - a.count || a.title.localeCompare(b.title, 'pt-PT'))
    .slice(0, 20)
    .map((item) => ({
      title: item.title,
      meta: `${item.count} momento(s) · ${item.examples.join(' · ')}`,
      value: `${item.impact} pts`
    }));
  return { count: items.length, points: totalPoints, tone, rows };
}

function scorerSummary(items, tone) {
  const byScorer = new Map();
  items.forEach((item) => {
    let scorerName = item.event.scorer || 'Marcador';
    if (!item.event.ownGoal && item.event.teamName && !scorerName.toLowerCase().includes(item.event.teamName.toLowerCase())) {
      scorerName = `${scorerName} (${item.event.teamName.toLowerCase()})`;
    }
    const current = byScorer.get(scorerName) || { title: scorerName, count: 0, impact: 0, examples: [] };
    current.count += 1;
    current.impact += item.delta;
    if (current.examples.length < 2) current.examples.push(`${item.player.participantName}, ${matchLabel(item.match)} ${item.event.minuteLabel}`);
    byScorer.set(scorerName, current);
  });
  const rows = [...byScorer.values()]
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact) || b.count - a.count)
    .slice(0, 8)
    .map((item) => ({
      title: item.title,
      meta: item.examples.join(' · '),
      value: `${item.impact > 0 ? '+' : ''}${item.impact} pts`
    }));
  return { count: items.length, tone, rows };
}

function commonResultSummary(rows) {
  const byResult = new Map();
  rows.forEach((row) => {
    const key = predictionText(row.prediction);
    const score = scorePrediction(row.prediction, row.official, row.scoringRules || {});
    const current = byResult.get(key) || { title: key, count: 0, exact: 0, failed: 0, points: 0 };
    current.count += 1;
    current.exact += score.exact ? 1 : 0;
    current.failed += score.points <= 0 ? 1 : 0;
    current.points += score.points;
    byResult.set(key, current);
  });

  const values = [...byResult.values()];
  const mostCommon = top(values, (item) => item.count);
  const mostExact = top(values, (item) => item.exact);
  const mostFailed = top(values, (item) => item.failed);

  return {
    count: rows.length,
    tone: 'warn',
    rows: [
      mostCommon && { title: 'Mais comum', meta: `${mostCommon.count} prognóstico(s)`, value: mostCommon.title },
      mostExact && { title: 'Mais certeiro', meta: `${mostExact.exact} resultado(s) exato(s)`, value: mostExact.title },
      mostFailed && { title: 'Mais falhado', meta: `${mostFailed.failed} falha(s) sem pontos`, value: mostFailed.title }
    ].filter(Boolean)
  };
}

function commonResultByPlayerSummary(rows) {
  const byPlayer = new Map();
  rows.forEach((row) => {
    const id = row.player.id || row.player.participantName;
    const score = scorePrediction(row.prediction, row.official, row.scoringRules || {});
    const current = byPlayer.get(id) || {
      title: row.player.participantName,
      exact: 0,
      failed: 0,
      points: 0,
      predictions: 0,
      results: new Map()
    };
    const predText = predictionText(row.prediction);
    current.predictions += 1;
    current.exact += score.exact ? 1 : 0;
    current.failed += score.points <= 0 ? 1 : 0;
    current.points += score.points;
    current.results.set(predText, (current.results.get(predText) || 0) + 1);
    byPlayer.set(id, current);
  });

  const rowsByPlayer = [...byPlayer.values()]
    .sort((a, b) => b.exact - a.exact || b.points - a.points || a.failed - b.failed || a.title.localeCompare(b.title, 'pt-PT'))
    .slice(0, 20)
    .map((item) => {
      const common = [...item.results.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      return {
        title: item.title,
        meta: `Mais comum: ${common?.[0] || '-'} (${common?.[1] || 0}x) · ${item.failed} falha(s)`,
        value: `${item.exact} exatos`
      };
    });

  return { count: rows.length, tone: 'warn', rows: rowsByPlayer };
}

function checkpointSummary(rows) {
  const totals = { ht: 0, ft90: 0, final: 0 };
  rows.forEach((row) => {
    const ht = scoreAtMinute(row, 45);
    const ft90 = scoreAtMinute(row, 90);
    const final = scorePrediction(row.prediction, row.official, row.scoringRules || {});
    if (ht.points > 0) totals.ht += 1;
    if (ft90.points > 0) totals.ft90 += 1;
    if (final.points > 0) totals.final += 1;
  });
  return {
    count: rows.length,
    tone: 'good',
    rows: [
      { title: 'Intervalo', meta: 'Prognósticos em zona de pontos aos 45 minutos', value: totals.ht },
      { title: '90 minutos', meta: 'Prognósticos em zona de pontos aos 90 minutos', value: totals.ft90 },
      { title: 'Final', meta: 'Prognósticos pontuados no resultado final', value: totals.final }
    ]
  };
}

function checkpointByPlayerSummary(rows) {
  const byPlayer = new Map();
  rows.forEach((row) => {
    const id = row.player.id || row.player.participantName;
    const current = byPlayer.get(id) || { title: row.player.participantName, ht: 0, ft90: 0, final: 0, total: 0 };
    const ht = scoreAtMinute(row, 45);
    const ft90 = scoreAtMinute(row, 90);
    const final = scorePrediction(row.prediction, row.official, row.scoringRules || {});
    current.total += 1;
    current.ht += ht.points > 0 ? 1 : 0;
    current.ft90 += ft90.points > 0 ? 1 : 0;
    current.final += final.points > 0 ? 1 : 0;
    byPlayer.set(id, current);
  });

  const rowsByPlayer = [...byPlayer.values()]
    .sort((a, b) => b.final - a.final || b.ft90 - a.ft90 || b.ht - a.ht || a.title.localeCompare(b.title, 'pt-PT'))
    .slice(0, 20)
    .map((item) => ({
      title: item.title,
      meta: `Intervalo: ${item.ht} · 90: ${item.ft90} · Final: ${item.final}`,
      value: `${item.final}/${item.total}`
    }));

  return { count: rows.length, tone: 'good', rows: rowsByPlayer };
}

function scoreAtMinute(row, minute) {
  const last = row.events.filter((event) => event.minuteValue <= minute).at(-1);
  const score = last?.after || { homeGoals: 0, awayGoals: 0 };
  return scorePrediction(row.prediction, stateAt(row.match, score), row.scoringRules || {});
}

function sameTeamsSameSides(a, b) {
  if (!a || !b) return false;
  const ah = a.homeTeam || a.home;
  const aa = a.awayTeam || a.away;
  const bh = b.homeTeam || b.home;
  const ba = b.awayTeam || b.away;
  return sameTeamName(ah, bh) && sameTeamName(aa, ba);
}

export function scorePrediction(pred, official, scoringRules) {
  if (!pred || !hasScore(pred) || !hasScore(official)) return { points: 0, exact: false, outcomeHit: false, goalsHit: 0, goalsMissed: 0 };
  const ph = Number(pred.homeGoals);
  const pa = Number(pred.awayGoals);
  const oh = Number(official.homeGoals);
  const oa = Number(official.awayGoals);
  
  const sidesOk = sameTeamsSameSides(pred, official);
  const officialWinner = (official.winnerTeam && official.winnerTeam !== 'Empate') ? official.winnerTeam : (oh > oa ? official.homeTeam : oa > oh ? official.awayTeam : 'Empate');
  const winnerHit = pred.winnerTeam && officialWinner !== 'Empate' && sameTeamName(pred.winnerTeam, officialWinner);
  const outcomeHit = outcome(ph, pa) === outcome(oh, oa);
  const stage = pred.stage || official.stage || 'groups';
  
  let exact = sidesOk && ph === oh && pa === oa;
  if (!exact && sidesOk && ph === pa && pred.method === 'et' && official.method === 'et' && winnerHit) {
    const implied90 = Math.min(oh, oa);
    if (ph === implied90 && pa === implied90) {
      exact = true;
    }
  }
  
  let points = 0;
  if (stage === 'groups') {
    points = exact ? (scoringRules.groupExact ?? 3) : (sidesOk && outcomeHit ? (scoringRules.groupOutcome ?? 1) : 0);
  } else {
    if (exact) {
      if (stage === 'round32') points = scoringRules.initialExact32 ?? 7;
      else if (stage === 'round16') points = scoringRules.initialExact16 ?? 7;
      else if (stage === 'quarterfinals') points = scoringRules.initialExact8 ?? 7;
      else if (stage === 'semifinals') points = scoringRules.initialExact4 ?? 9;
      else if (stage === 'third_place') points = scoringRules.initialExact3rd ?? 9;
      else if (stage === 'final') points = scoringRules.initialExactFinal ?? 10;
      else points = stage === 'final' ? (scoringRules.finalInitialExact ?? 6) : (scoringRules.knockoutInitialExact ?? 5);
    } else if (winnerHit) {
      if (stage === 'round32') points = scoringRules.initialWinner32 ?? 2;
      else if (stage === 'round16') points = scoringRules.initialWinner16 ?? 2;
      else if (stage === 'quarterfinals') points = scoringRules.initialWinner8 ?? 2;
      else if (stage === 'semifinals') points = scoringRules.initialWinner4 ?? 3;
      else if (stage === 'third_place') points = scoringRules.initialWinner3rd ?? 3;
      else if (stage === 'final') points = scoringRules.initialWinnerFinal ?? 4;
      else points = stage === 'final' ? (scoringRules.finalInitialWinner ?? 4) : (scoringRules.knockoutInitialWinner ?? 3);
    }
  }

  const goalsHit = (ph === oh ? oh : 0) + (pa === oa ? oa : 0);
  const goalsMissed = Math.abs(ph - oh) + Math.abs(pa - oa);
  const actual = outcome(oh, oa);
  return {
    points: Number(points) || 0,
    exact,
    outcomeHit: outcomeHit || winnerHit,
    goalsHit,
    goalsMissed,
    winHit: (outcomeHit || winnerHit) && actual === 'home' ? 1 : 0,
    drawHit: outcomeHit && actual === 'draw' ? 1 : 0,
    lossHit: (outcomeHit || winnerHit) && actual === 'away' ? 1 : 0
  };
}

function hasScore(item) {
  return item && item.homeGoals != null && item.homeGoals !== '' && item.awayGoals != null && item.awayGoals !== '';
}

function outcome(home, away) {
  return Number(home) > Number(away) ? 'home' : Number(away) > Number(home) ? 'away' : 'draw';
}

function sameTeamName(a, b) {
  return normalizeText(a) === normalizeText(b);
}

function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function minuteValue(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  if (!match) return Number.NaN;
  return Number(match[1]) + Number(match[2] || 0);
}

function formatMinuteLabel(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  if (!match) return text || '?';
  return match[2] ? `${Number(match[1])}+${Number(match[2])}'` : `${Number(match[1])}'`;
}

function predictionText(pred) {
  return `${Number(pred.homeGoals)}-${Number(pred.awayGoals)}`;
}

function matchLabel(match) {
  const stage = STAGE_LABELS[match.stage] || match.stage || 'Jogo';
  return `Jogo ${match.id} · ${match.home || match.homeTeam} vs ${match.away || match.awayTeam} · ${stage}`;
}

function top(items, getter) {
  return [...items].sort((a, b) => getter(b) - getter(a) || b.count - a.count)[0] || null;
}

function aloneInFameSummary(data, selectedPlayers) {
  const exactHitsByMatch = new Map();
  data.players.forEach(player => {
    (player.matches || []).forEach(prediction => {
      const matchId = String(prediction.id);
      const match = data.matches.find(item => String(item.id) === matchId);
      if (!match) return;
      const official = normalizeOfficial(match, data.officialByMatchId[matchId], data.sofaByMatchId[matchId]);
      if (!official || !hasScore(official)) return;
      
      const score = scorePrediction(prediction, official, data.scoringRules || {});
      if (score.exact) {
        if (!exactHitsByMatch.has(matchId)) {
          exactHitsByMatch.set(matchId, []);
        }
        exactHitsByMatch.get(matchId).push({ player, prediction, match, official, points: score.points });
      }
    });
  });

  const aloneMatches = [];
  for (const [matchId, hits] of exactHitsByMatch.entries()) {
    if (hits.length === 1) {
      const hit = hits[0];
      if (selectedPlayers.some(p => p.id === hit.player.id)) {
        aloneMatches.push(hit);
      }
    }
  }

  aloneMatches.sort((a, b) => Number(b.match.id) - Number(a.match.id));
  const totalPoints = aloneMatches.reduce((sum, hit) => sum + hit.points, 0);

  return {
    count: aloneMatches.length,
    points: totalPoints,
    tone: 'good',
    rows: aloneMatches.map(hit => ({
      title: `${hit.player.participantName} · ${matchLabel(hit.match)}`,
      meta: `Prognóstico: ${predictionText(hit.prediction)} · Resultado: ${hit.official.homeGoals}-${hit.official.awayGoals}`,
      value: `+${hit.points} Pts`
    }))
  };
}

function aloneInFameByPlayerSummary(data) {
  const exactHitsByMatch = new Map();
  data.players.forEach(player => {
    (player.matches || []).forEach(prediction => {
      const matchId = String(prediction.id);
      const match = data.matches.find(item => String(item.id) === matchId);
      if (!match) return;
      const official = normalizeOfficial(match, data.officialByMatchId[matchId], data.sofaByMatchId[matchId]);
      if (!official || !hasScore(official)) return;
      
      const score = scorePrediction(prediction, official, data.scoringRules || {});
      if (score.exact) {
        if (!exactHitsByMatch.has(matchId)) {
          exactHitsByMatch.set(matchId, []);
        }
        exactHitsByMatch.get(matchId).push({ player, match, points: score.points });
      }
    });
  });

  const byPlayer = new Map();
  data.players.forEach(p => {
    byPlayer.set(p.id, { title: p.participantName, count: 0, points: 0, examples: [] });
  });

  let totalPoints = 0;
  for (const [matchId, hits] of exactHitsByMatch.entries()) {
    if (hits.length === 1) {
      const hit = hits[0];
      const current = byPlayer.get(hit.player.id);
      if (current) {
        current.count += 1;
        current.points += hit.points;
        totalPoints += hit.points;
        if (current.examples.length < 2) {
          current.examples.push(`Jogo ${hit.match.id}`);
        }
      }
    }
  }

  const rows = [...byPlayer.values()]
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'pt-PT'))
    .slice(0, 20)
    .map(item => ({
      title: item.title,
      meta: item.examples.length ? `${item.count} vez(es) · ${item.examples.join(' · ')}` : 'Nenhuma vez',
      value: `${item.count}x`
    }));

  return {
    count: [...byPlayer.values()].reduce((sum, item) => sum + item.count, 0),
    points: totalPoints,
    tone: 'good',
    rows
  };
}

function wonWithStyleSummary(rows) {
  const matches = rows.filter(row => {
    const score = scorePrediction(row.prediction, row.official, row.scoringRules || {});
    return score.points === 3;
  });

  matches.sort((a, b) => Number(b.match.id) - Number(a.match.id));
  const totalPoints = matches.length * 3;

  return {
    count: matches.length,
    points: totalPoints,
    tone: 'good',
    rows: matches.map(row => ({
      title: `${row.player.participantName} · ${matchLabel(row.match)}`,
      meta: `Prognóstico: ${predictionText(row.prediction)} · Resultado: ${row.official.homeGoals}-${row.official.awayGoals}`,
      value: `+3 Pts`
    }))
  };
}

function wonWithStyleByPlayerSummary(rows) {
  const byPlayer = new Map();
  rows.forEach(row => {
    const score = scorePrediction(row.prediction, row.official, row.scoringRules || {});
    if (score.points === 3) {
      const id = row.player.id || row.player.participantName;
      const current = byPlayer.get(id) || { title: row.player.participantName, count: 0, examples: [] };
      current.count += 1;
      if (current.examples.length < 2) {
        current.examples.push(`Jogo ${row.match.id}`);
      }
      byPlayer.set(id, current);
    }
  });

  const rowsByPlayer = [...byPlayer.values()]
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'pt-PT'))
    .slice(0, 20)
    .map(item => ({
      title: item.title,
      meta: item.examples.length ? `${item.count} vez(es) · ${item.examples.join(' · ')}` : 'Nenhuma vez',
      value: `${item.count}x`
    }));

  const totalPoints = [...byPlayer.values()].reduce((sum, item) => sum + item.count, 0) * 3;

  return {
    count: [...byPlayer.values()].reduce((sum, item) => sum + item.count, 0),
    points: totalPoints,
    tone: 'good',
    rows: rowsByPlayer
  };
}

function selectionsSummary(data, selectedSelection, rows, transitions, selectedPlayers) {
  const isAll = selectedSelection === 'all';
  
  let pointsGained = 0;
  let pointsLost = 0;
  
  const playerGains = new Map();
  const playerLosses = new Map();
  
  selectedPlayers.forEach(p => {
    playerGains.set(p.participantName, 0);
    playerLosses.set(p.participantName, 0);
  });
  
  let correctGoalsCount = 0;
  let correctPredictionsCount = 0;
  let wrongPredictionsCount = 0;
  const predictionCounts = new Map();
  
  const relevantMatches = data.matches.filter(m => {
    if (isAll) return true;
    const h = m.home || m.homeTeam;
    const a = m.away || m.awayTeam;
    return (h && h.toLowerCase() === selectedSelection.toLowerCase()) || 
           (a && a.toLowerCase() === selectedSelection.toLowerCase());
  });
  
  relevantMatches.forEach(match => {
    const matchId = String(match.id);
    const official = normalizeOfficial(match, data.officialByMatchId[matchId], data.sofaByMatchId[matchId]);
    if (!official || !hasScore(official)) return;
    
    selectedPlayers.forEach(player => {
      const pred = (player.matches || []).find(p => String(p.id) === matchId);
      if (!pred || !hasScore(pred)) return;
      
      const oh = Number(official.homeGoals);
      const oa = Number(official.awayGoals);
      const ph = Number(pred.homeGoals);
      const pa = Number(pred.awayGoals);
      
      const homeTeam = official.homeTeam || official.home;
      const awayTeam = official.awayTeam || official.away;
      
      if (isAll) {
        if (ph === oh) correctGoalsCount += 1;
        if (pa === oa) correctGoalsCount += 1;
      } else {
        if (homeTeam && homeTeam.toLowerCase() === selectedSelection.toLowerCase()) {
          if (ph === oh) correctGoalsCount += 1;
        }
        if (awayTeam && awayTeam.toLowerCase() === selectedSelection.toLowerCase()) {
          if (pa === oa) correctGoalsCount += 1;
        }
      }

      const score = scorePrediction(pred, official, data.scoringRules || {});
      if (score.points > 0) {
        correctPredictionsCount += 1;
      } else if (score.points === 0) {
        wrongPredictionsCount += 1;
      }

      const predKey = `${ph}-${pa}`;
      predictionCounts.set(predKey, (predictionCounts.get(predKey) || 0) + 1);

      // Calcular ganho/perda de pontos olhando apenas para o final do jogo em comparação ao estado inicial (0-0)
      const beforeOfficial = stateAt(match, { homeGoals: 0, awayGoals: 0 });
      const beforeScore = scorePrediction(pred, beforeOfficial, data.scoringRules || {});
      const delta = score.points - beforeScore.points;
      const pName = player.participantName;

      if (delta > 0) {
        pointsGained += delta;
        playerGains.set(pName, playerGains.get(pName) + delta);
      } else if (delta < 0) {
        const absDelta = Math.abs(delta);
        pointsLost += absDelta;
        playerLosses.set(pName, playerLosses.get(pName) + absDelta);
      }
    });
  });

  const topBenefited = [...playerGains.entries()]
    .filter(([_, pts]) => pts > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-PT'))
    .slice(0, 5)
    .map(([name, pts]) => ({ name, value: `+${pts} Pts` }));
    
  const topHarmed = [...playerLosses.entries()]
    .filter(([_, pts]) => pts > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-PT'))
    .slice(0, 5)
    .map(([name, pts]) => ({ name, value: `-${pts} Pts` }));

  let mostFrequentPrediction = 'Nenhum';
  let maxFreq = 0;
  for (const [predKey, count] of predictionCounts.entries()) {
    if (count > maxFreq) {
      maxFreq = count;
      mostFrequentPrediction = `${predKey} (${count}x)`;
    }
  }
  
  return {
    selectedSelection,
    pointsGained,
    pointsLost,
    topBenefited,
    topHarmed,
    correctGoalsCount,
    mostFrequentPrediction,
    correctPredictionsCount,
    wrongPredictionsCount
  };
}

function stadiumsSummary(data, selectedStadium, rows, transitions, selectedPlayers) {
  const isAll = selectedStadium === 'all';
  
  let pointsGained = 0;
  let pointsLost = 0;
  
  const playerGains = new Map();
  const playerLosses = new Map();
  
  selectedPlayers.forEach(p => {
    playerGains.set(p.participantName, 0);
    playerLosses.set(p.participantName, 0);
  });
  
  let correctGoalsCount = 0;
  let correctPredictionsCount = 0;
  let wrongPredictionsCount = 0;
  const predictionCounts = new Map();
  
  const relevantMatches = data.matches.filter(m => {
    if (isAll) return true;
    return m.venue && m.venue.toLowerCase() === selectedStadium.toLowerCase();
  });
  
  relevantMatches.forEach(match => {
    const matchId = String(match.id);
    const official = normalizeOfficial(match, data.officialByMatchId[matchId], data.sofaByMatchId[matchId]);
    if (!official || !hasScore(official)) return;
    
    selectedPlayers.forEach(player => {
      const pred = (player.matches || []).find(p => String(p.id) === matchId);
      if (!pred || !hasScore(pred)) return;
      
      const oh = Number(official.homeGoals);
      const oa = Number(official.awayGoals);
      const ph = Number(pred.homeGoals);
      const pa = Number(pred.awayGoals);
      
      if (ph === oh) correctGoalsCount += 1;
      if (pa === oa) correctGoalsCount += 1;

      const score = scorePrediction(pred, official, data.scoringRules || {});
      if (score.points > 0) {
        correctPredictionsCount += 1;
      } else if (score.points === 0) {
        wrongPredictionsCount += 1;
      }

      const predKey = `${ph}-${pa}`;
      predictionCounts.set(predKey, (predictionCounts.get(predKey) || 0) + 1);

      // Calcular ganho/perda de pontos olhando apenas para o final do jogo em comparação ao estado inicial (0-0)
      const beforeOfficial = stateAt(match, { homeGoals: 0, awayGoals: 0 });
      const beforeScore = scorePrediction(pred, beforeOfficial, data.scoringRules || {});
      const delta = score.points - beforeScore.points;
      const pName = player.participantName;

      if (delta > 0) {
        pointsGained += delta;
        playerGains.set(pName, playerGains.get(pName) + delta);
      } else if (delta < 0) {
        const absDelta = Math.abs(delta);
        pointsLost += absDelta;
        playerLosses.set(pName, playerLosses.get(pName) + absDelta);
      }
    });
  });

  const topBenefited = [...playerGains.entries()]
    .filter(([_, pts]) => pts > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-PT'))
    .slice(0, 5)
    .map(([name, pts]) => ({ name, value: `+${pts} Pts` }));
    
  const topHarmed = [...playerLosses.entries()]
    .filter(([_, pts]) => pts > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-PT'))
    .slice(0, 5)
    .map(([name, pts]) => ({ name, value: `-${pts} Pts` }));

  let mostFrequentPrediction = 'Nenhum';
  let maxFreq = 0;
  for (const [predKey, count] of predictionCounts.entries()) {
    if (count > maxFreq) {
      maxFreq = count;
      mostFrequentPrediction = `${predKey} (${count}x)`;
    }
  }
  
  return {
    selectedStadium,
    pointsGained,
    pointsLost,
    topBenefited,
    topHarmed,
    correctGoalsCount,
    mostFrequentPrediction,
    correctPredictionsCount,
    wrongPredictionsCount
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

function participantKeyOf(player) {
  return player?.participantKey || normalizeParticipantName(player?.participantName || player?.name || player?.id || '');
}

function normalizeScorerName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function officialScorers(official) {
  const scorers = [];
  const list = [...(official.homeGoalsList || []), ...(official.awayGoalsList || [])];
  list.forEach(goal => {
    if (goal && !goal.ownGoal) {
      const name = goal.player || goal.scorer;
      if (name) scorers.push(normalizeScorerName(name));
    }
  });
  return scorers;
}

function scorerHit(pick, official) {
  if (!pick?.pickedPlayerName || !official) return false;
  const target = normalizeScorerName(pick.pickedPlayerName);
  return officialScorers(official).some(name =>
    name === target || name.includes(target) || target.includes(name)
  );
}

function predictionOutcome(pred) {
  const h = Number(pred.homeGoals);
  const a = Number(pred.awayGoals);
  return h > a ? 'home' : a > h ? 'away' : 'draw';
}

function actualOutcome(official) {
  const h = Number(official.homeGoals);
  const a = Number(official.awayGoals);
  return h > a ? 'home' : a > h ? 'away' : 'draw';
}

function isOfficialResultLive(result) {
  if (!result) return false;
  if (result.finished === true || result._finished === true || result.status === 'finished') return false;
  return !!(result.live === true || result._live === true || result.status === 'live');
}

function resultHasScore(result) {
  return result && result.homeGoals != null && result.homeGoals !== '' && result.awayGoals != null && result.awayGoals !== '';
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

function calculateBattleResult(battle, data) {
  const matchId = String(battle.matchId);
  const official = data.sofaByMatchId[matchId] || data.officialByMatchId[matchId];
  const playerA = data.players.find(p => participantKeyOf(p) === battle.playerAKey || String(p.id) === String(battle.playerAKey));
  const playerB = data.players.find(p => participantKeyOf(p) === battle.playerBKey || String(p.id) === String(battle.playerBKey));
  
  if (!official || official.homeGoals == null || official.awayGoals == null || !playerA || !playerB) {
    return {
      status: battle.status || 'pending',
      winnerKey: battle.winnerKey || '',
      draw: !!battle.draw
    };
  }

  const predA = playerA.matches.find(m => String(m.id) === matchId);
  const predB = playerB.matches.find(m => String(m.id) === matchId);

  const getFactors = (player, pred) => {
    if (!pred || pred.homeGoals == null || pred.awayGoals == null) {
      return { total: 0 };
    }
    const ph = Number(pred.homeGoals);
    const pa = Number(pred.awayGoals);
    const oh = Number(official.homeGoals);
    const oa = Number(official.awayGoals);
    const predicted = predictionOutcome(pred);
    const actual = actualOutcome(official);

    const pick = (data.pickDocs || []).find(p =>
      String(p.battleId) === String(battle.id) &&
      String(p.participantKey) === String(participantKeyOf(player))
    ) || null;

    const factors = {
      winner: predicted === actual ? 1 : 0,
      homeGoals: ph === oh ? 1 : 0,
      awayGoals: pa === oa ? 1 : 0,
      exact: ph === oh && pa === oa ? 1 : 0,
      scorer: scorerHit(pick, official) ? 1 : 0
    };
    factors.total = factors.winner + factors.homeGoals + factors.awayGoals + factors.exact + factors.scorer;
    return factors;
  };

  const aFactors = getFactors(playerA, predA);
  const bFactors = getFactors(playerB, predB);
  
  const winnerKey = aFactors.total > bFactors.total ? battle.playerAKey : bFactors.total > aFactors.total ? battle.playerBKey : '';
  const isFinished = isOfficialResultFinished(official) || battle.status === 'finished';
  return {
    status: isFinished ? 'finished' : 'pending',
    winnerKey,
    draw: !winnerKey
  };
}

function teamKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function sameMatchupAnySide(pred, official) {
  if (!pred || !official) return false;
  const predHome = pred.homeTeam || pred.home;
  const predAway = pred.awayTeam || pred.away;
  const offHome = official.homeTeam || official.home;
  const offAway = official.awayTeam || official.away;
  
  const a = [teamKey(predHome), teamKey(predAway)].sort().join('|');
  const b = [teamKey(offHome), teamKey(offAway)].sort().join('|');
  return a && a === b;
}

function blankTeam(team, group) {
  return { team, group, played: 0, points: 0, gf: 0, ga: 0, gd: 0, wins: 0, losses: 0, draws: 0 };
}

function getGroupTablesAtStep(stepMatches, data) {
  const tables = {};
  const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
  GROUPS.forEach(group => {
    const teams = new Set();
    data.matches.filter(m => m.stage === 'groups' && m.group === group).forEach(m => {
      teams.add(m.home); teams.add(m.away);
    });
    const stats = Object.fromEntries([...teams].map(team => [team, blankTeam(team, group)]));
    
    stepMatches.forEach(item => {
      const m = item.match;
      if (m.stage === 'groups' && m.group === group) {
        const r = item.official;
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
      }
    });
    Object.values(stats).forEach(t => { t.gd = t.gf - t.ga; });
    tables[group] = [...Object.values(stats)].sort((a, b) => {
      return (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf) || a.team.localeCompare(b.team, 'pt-PT');
    }).map((t, i) => ({ ...t, position: i + 1 }));
  });
  return tables;
}

function getBestThirdsAtStep(tables) {
  const thirds = Object.values(tables).map(t => t[2]).filter(Boolean);
  return thirds.sort((a, b) => {
    return (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf) || a.team.localeCompare(b.team, 'pt-PT');
  }).slice(0, 8);
}

function buildThirdAssignmentsAtStep(tables, bestThirds, data) {
  const groups = bestThirds.map(t => t.group);
  const sortedGroupsStr = [...groups].sort().join('');
  const assignments = {};

  if (sortedGroupsStr === 'BDEFHIJK') {
    const teamByGroup = Object.fromEntries(bestThirds.map(t => [t.group, t.team]));
    const mapping = {
      '74:away': 'D',
      '77:away': 'F',
      '79:away': 'E',
      '80:away': 'K',
      '81:away': 'I',
      '82:away': 'B',
      '85:away': 'J',
      '87:away': 'H'
    };
    for (const [key, grp] of Object.entries(mapping)) {
      if (teamByGroup[grp]) assignments[key] = teamByGroup[grp];
    }
    return assignments;
  }

  if (sortedGroupsStr === 'BDEFIJKL') {
    const teamByGroup = Object.fromEntries(bestThirds.map(t => [t.group, t.team]));
    const mapping = {
      '74:away': 'D',
      '77:away': 'F',
      '79:away': 'E',
      '80:away': 'K',
      '81:away': 'I',
      '82:away': 'B',
      '85:away': 'J',
      '84:away': 'L'
    };
    for (const [key, grp] of Object.entries(mapping)) {
      if (teamByGroup[grp]) assignments[key] = teamByGroup[grp];
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

function resolveOfficialTeamAtStep(match, side, tables, thirdAssignments) {
  const raw = String(match?.[side] || '');
  if (!match || match.stage === 'groups') return raw;
  
  const pos = raw.match(/^(1|2)\.º Grupo ([A-L])$/);
  if (pos) {
    const group = pos[2];
    const idx = Number(pos[1]) - 1;
    const groupRows = tables[group] || [];
    const totalGroupPlayed = groupRows.reduce((sum, t) => sum + t.played, 0);
    if (totalGroupPlayed === 12) {
      return groupRows[idx]?.team || raw;
    }
    return raw;
  }
  
  if (/^3\.º Grupo/.test(raw)) {
    return thirdAssignments[`${match.id}:${side}`] || raw;
  }
  
  return raw;
}

function isTeamUnresolved(name) {
  if (!name) return true;
  const clean = String(name).trim().toLowerCase();
  if (!clean || clean === 'none' || clean === 'tbd' || clean === 'tbc' || clean === 'a definir' || clean === 'a confirmar' || clean === '?') return true;
  return /grupo|vencedor|perdedor|jogo|venc\.|perd\./i.test(clean);
}

function calculateStepMatchupPointsOptimized(player, resolvedMatchups, data) {
  let matchupPoints = 0;
  resolvedMatchups.forEach(m => {
    const matchupPred = (player.matches || []).find(p => p.stage === m.stage && sameMatchupAnySide(p, { homeTeam: m.home, awayTeam: m.away }));
    if (matchupPred && sameMatchupAnySide(matchupPred, { homeTeam: m.home, awayTeam: m.away })) {
      const bonusRule = 'knockoutInitialWinner';
      const bonusVal = Number(data.scoringRules?.[bonusRule]) || 2;
      matchupPoints += bonusVal;
    }
  });
  return matchupPoints;
}

function starsPathSummary(data, selectedPlayers, options = {}) {
  const includeBw = options.includeBw !== false;
  const includePp = options.includePp !== false;
  const playedMatches = data.matches
    .map(match => {
      const matchId = String(match.id);
      const official = normalizeOfficial(match, data.officialByMatchId[matchId], data.sofaByMatchId[matchId]);
      return { match, official };
    })
    .filter(item => item.official && hasScore(item.official))
    .sort((a, b) => Number(a.match.id) - Number(b.match.id));

  const playersPoints = data.players.map(player => {
    const predictionMap = new Map();
    (player.matches || []).forEach(pred => {
      predictionMap.set(String(pred.id), pred);
    });
    return {
      id: player.id,
      name: player.participantName,
      predictionMap,
      accumulated: 0,
      correctPredictions: 0,
      goalsHit: 0,
      goalsMissed: 0,
      history: []
    };
  });

  playedMatches.forEach((item, stepIdx) => {
    const stepMatches = playedMatches.slice(0, stepIdx + 1);
    const tables = getGroupTablesAtStep(stepMatches, data);
    const bestThirds = getBestThirdsAtStep(tables);

    let thirdAssignments = {};
    const totalPlayedAllGroups = Object.values(tables).reduce((sum, g) => sum + g.reduce((s, t) => s + t.played, 0), 0);
    if (totalPlayedAllGroups === 144) {
      thirdAssignments = buildThirdAssignmentsAtStep(tables, bestThirds, data);
    }

    const resolvedMatchups = [];
    if (includePp) {
      const matches = data.matches || [];
      matches.forEach(match => {
        if (match.stage !== 'round32') return;
        const home = resolveOfficialTeamAtStep(match, 'home', tables, thirdAssignments);
        const away = resolveOfficialTeamAtStep(match, 'away', tables, thirdAssignments);
        const unresolved = isTeamUnresolved(home) || isTeamUnresolved(away);
        if (!unresolved) {
          resolvedMatchups.push({ id: match.id, stage: match.stage, home, away });
        }
      });
    }

    playersPoints.forEach(pInfo => {
      const pred = pInfo.predictionMap.get(String(item.match.id));
      const score = scorePrediction(pred, item.official, data.scoringRules || {});
      
      pInfo.accumulated += score.points;
      pInfo.correctPredictions += score.points > 0 ? 1 : 0;
      pInfo.goalsHit += score.goalsHit || 0;
      pInfo.goalsMissed += score.goalsMissed || 0;
    });

    const stepSorted = [...playersPoints].map(pInfo => {
      let wins = 0;
      if (includeBw) {
        const playedMatchIds = new Set(stepMatches.map(m => String(m.match.id)));
        (data.battleDocs || []).forEach(battle => {
          if (playedMatchIds.has(String(battle.matchId))) {
            const res = calculateBattleResult(battle, data);
            if (res.status === 'finished') {
              const playerKey = participantKeyOf(pInfo);
              if (res.winnerKey === playerKey || res.winnerKey === pInfo.id) {
                wins++;
              }
            }
          }
        });
      }
      const bonus = Math.floor(wins / 2);
      
      const playerObj = data.players.find(p => p.id === pInfo.id);
      const ppBonus = calculateStepMatchupPointsOptimized(playerObj, resolvedMatchups, data);

      return {
        ...pInfo,
        accumulatedWithBw: pInfo.accumulated + ppBonus + bonus
      };
    }).sort((a, b) => 
      (b.accumulatedWithBw - a.accumulatedWithBw) || 
      (b.correctPredictions - a.correctPredictions) || 
      (b.goalsHit - a.goalsHit) || 
      (a.goalsMissed - b.goalsMissed) || 
      a.name.localeCompare(b.name, 'pt-PT')
    );
    
    stepSorted.forEach((pInfo, index) => {
      const actualPlayer = playersPoints.find(p => p.id === pInfo.id);
      actualPlayer.history.push({
        matchId: item.match.id,
        accumulated: pInfo.accumulatedWithBw,
        position: index + 1
      });
    });
  });

  return {
    playedMatches: playedMatches.map(m => ({
      id: m.match.id,
      label: `J${m.match.id}`,
      home: m.match.home || m.match.homeTeam,
      away: m.match.away || m.match.awayTeam
    })),
    selectedIds: selectedPlayers.map(p => p.id),
    allHistories: playersPoints.map(pInfo => ({
      id: pInfo.id,
      name: pInfo.name,
      history: pInfo.history
    })),
    totalPlayers: data.players.length
  };
}

export function sequenceSummary(data, selectedPlayers) {
  const playedMatches = data.matches
    .map(match => {
      const matchId = String(match.id);
      const official = normalizeOfficial(match, data.officialByMatchId[matchId], data.sofaByMatchId[matchId]);
      return { match, official };
    })
    .filter(item => item.official && hasScore(item.official))
    .sort((a, b) => Number(a.match.id) - Number(b.match.id));

  const playerRows = [];
  playedMatches.forEach(({ match, official }) => {
    selectedPlayers.forEach(player => {
      const pred = (player.matches || []).find(p => String(p.id) === String(match.id));
      if (!pred || !hasScore(pred)) return;
      
      const score = scorePrediction(pred, official, data.scoringRules || {});
      playerRows.push({
        matchId: String(match.id),
        match,
        official,
        prediction: pred,
        points: score.points,
        exact: score.exact,
        outcomeHit: score.outcomeHit,
        player
      });
    });
  });

  return {
    tone: 'warn',
    rows: playerRows,
    totalPlayers: data.players.length
  };
}

export function computeFullPlayerRanking(key, data, options = {}) {
  const selectedPlayers = data.players;
  const rows = buildRows(data, selectedPlayers);
  const transitions = rows.flatMap((row) => row.transitions);

  const playerScores = new Map();
  data.players.forEach(p => {
    playerScores.set(p.id, {
      id: p.id,
      name: p.participantName,
      score: 0
    });
  });

  if (key === 'lost' || key === 'dramaticLost' || key === 'gains' || key === 'lateGains') {
    let filteredTransitions = transitions;
    if (key === 'lost') filteredTransitions = transitions.filter(t => t.delta < 0);
    else if (key === 'dramaticLost') filteredTransitions = transitions.filter(t => t.delta < 0 && t.event.minuteValue >= 90);
    else if (key === 'gains') filteredTransitions = transitions.filter(t => t.delta > 0);
    else if (key === 'lateGains') filteredTransitions = transitions.filter(t => t.delta > 0 && t.event.minuteValue >= 90);

    filteredTransitions.forEach(t => {
      const p = playerScores.get(t.player.id);
      if (p) {
        p.score += Math.abs(t.delta);
      }
    });
  } else if (key === 'commonResult') {
    rows.forEach(row => {
      const score = scorePrediction(row.prediction, row.official, row.scoringRules || {});
      const p = playerScores.get(row.player.id);
      if (p && score.exact) {
        p.score += 1;
      }
    });
  } else if (key === 'checkpoint') {
    rows.forEach(row => {
      const final = scorePrediction(row.prediction, row.official, row.scoringRules || {});
      const p = playerScores.get(row.player.id);
      if (p && final.points > 0) {
        p.score += 1;
      }
    });
  } else if (key === 'aloneInFame') {
    const exactHitsByMatch = new Map();
    data.players.forEach(player => {
      (player.matches || []).forEach(prediction => {
        const matchId = String(prediction.id);
        const match = data.matches.find(item => String(item.id) === matchId);
        if (!match) return;
        const official = normalizeOfficial(match, data.officialByMatchId[matchId], data.sofaByMatchId[matchId]);
        if (!official || !hasScore(official)) return;
        const score = scorePrediction(prediction, official, data.scoringRules || {});
        if (score.exact) {
          if (!exactHitsByMatch.has(matchId)) {
            exactHitsByMatch.set(matchId, []);
          }
          exactHitsByMatch.get(matchId).push(player.id);
        }
      });
    });
    for (const [matchId, playerIds] of exactHitsByMatch.entries()) {
      if (playerIds.length === 1) {
        const p = playerScores.get(playerIds[0]);
        if (p) p.score += 1;
      }
    }
  } else if (key === 'wonWithStyle') {
    rows.forEach(row => {
      const score = scorePrediction(row.prediction, row.official, row.scoringRules || {});
      const p = playerScores.get(row.player.id);
      if (p && score.points === 3) {
        p.score += 1;
      }
    });
  } else if (key === 'badScorers' || key === 'goodScorers') {
    const isBad = key === 'badScorers';
    const filteredTransitions = transitions.filter(t => isBad ? t.delta < 0 : t.delta > 0);
    filteredTransitions.forEach(t => {
      const p = playerScores.get(t.player.id);
      if (p) {
        p.score += 1;
      }
    });
  } else if (key === 'starsPath') {
    const summary = starsPathSummary(data, data.players, options);
    summary.allHistories.forEach(ph => {
      const lastHist = ph.history[ph.history.length - 1];
      const p = playerScores.get(ph.id);
      if (p && lastHist) {
        p.score = lastHist.position;
      }
    });
  } else if (key === 'selections' || key === 'stadiums') {
    transitions.forEach(t => {
      const p = playerScores.get(t.player.id);
      if (p) {
        p.score += Math.abs(t.delta);
      }
    });
  }

  const sortedList = [...playerScores.values()].sort((a, b) => {
    if (key === 'starsPath') {
      return a.score - b.score || a.name.localeCompare(b.name, 'pt-PT');
    }
    return b.score - a.score || a.name.localeCompare(b.name, 'pt-PT');
  });

  return sortedList;
}

function getKnockoutPrediction(player, matchId, data) {
  if (!data.reformDocs) return null;
  const normalizeKey = (str) => {
    return String(str || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };
  const playerKeys = [player.id, player.participantKey, player.participantName, player.name].map(k => normalizeKey(k)).filter(Boolean);
  
  const match = data.matches.find(m => Number(m.id) === Number(matchId));
  const homeTeam = match ? (match.home || match.homeTeam || '') : '';
  const awayTeam = match ? (match.away || match.awayTeam || '') : '';
  const matchStage = match ? (match.stage || '') : '';

  const reformDoc = data.reformDocs.find(doc => {
    const docKeys = [doc.participantKey, doc.playerName, doc.name, doc.participantName].map(k => normalizeKey(k)).filter(Boolean);
    const isPlayer = playerKeys.some(pk => docKeys.includes(pk));
    if (!isPlayer) return false;

    const idMatches = Number(doc.matchId) === Number(matchId);
    
    const stageMatches = doc.stage && matchStage && 
      (doc.stage.toLowerCase().trim() === matchStage.toLowerCase().trim());

    const teamsMatch = homeTeam && awayTeam && doc.homeTeam && doc.awayTeam && stageMatches &&
      (doc.homeTeam.toLowerCase().trim() === homeTeam.toLowerCase().trim()) &&
      (doc.awayTeam.toLowerCase().trim() === awayTeam.toLowerCase().trim());

    return idMatches || teamsMatch;
  });

  if (!reformDoc) return null;

  let homeGoals = reformDoc.homeGoals;
  let awayGoals = reformDoc.awayGoals;
  let winnerTeam = reformDoc.winnerTeam;
  let method = reformDoc.method;

  if ((homeGoals == null || awayGoals == null || homeGoals === '' || awayGoals === '') && reformDoc.initialPrediction) {
    homeGoals = reformDoc.initialPrediction.homeGoals;
    awayGoals = reformDoc.initialPrediction.awayGoals;
    winnerTeam = reformDoc.initialPrediction.winnerTeam;
    method = reformDoc.initialPrediction.method;
  }

  return {
    id: matchId,
    homeGoals,
    awayGoals,
    winnerTeam,
    method
  };
}

export function predictionSummary(data, selectedMatchId, selectedPlayers) {
  const matchId = String(selectedMatchId);
  const match = data.matches.find(m => String(m.id) === matchId);
  if (!match) return { match: null, predictions: [] };
  
  const official = normalizeOfficial(match, data.officialByMatchId[matchId], data.sofaByMatchId[matchId]);
  const isKO = match.stage !== 'groups';
  
  const predictions = data.players
    .filter(player => {
      if (isKO) {
        if (!data.reformDocs) return false;
        const normalizeKey = (str) => {
          return String(str || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
        };
        const playerKeys = [player.id, player.participantKey, player.participantName, player.name].map(k => normalizeKey(k)).filter(Boolean);
        
        const homeTeam = match.home || match.homeTeam || '';
        const awayTeam = match.away || match.awayTeam || '';
        const matchStage = match.stage || '';

        const hasReform = data.reformDocs.some(doc => {
          const docKeys = [doc.participantKey, doc.playerName, doc.name, doc.participantName].map(k => normalizeKey(k)).filter(Boolean);
          const isPlayer = playerKeys.some(pk => docKeys.includes(pk));
          if (!isPlayer) return false;

          const idMatches = Number(doc.matchId) === Number(matchId);
          
          const stageMatches = doc.stage && matchStage && 
            (doc.stage.toLowerCase().trim() === matchStage.toLowerCase().trim());

          const teamsMatch = homeTeam && awayTeam && doc.homeTeam && doc.awayTeam && stageMatches &&
            (doc.homeTeam.toLowerCase().trim() === homeTeam.toLowerCase().trim()) &&
            (doc.awayTeam.toLowerCase().trim() === awayTeam.toLowerCase().trim());

          return idMatches || teamsMatch;
        });
        if (!hasReform) return false;
      }
      return true;
    })
    .map(player => {
      let pred = null;
      if (isKO) {
        pred = getKnockoutPrediction(player, matchId, data);
      } else {
        pred = (player.matches || []).find(p => String(p.id) === matchId);
      }
      let score = null;
      if (pred && hasScore(pred) && official && hasScore(official)) {
        score = scorePrediction(pred, official, data.scoringRules || {});
      }
      return {
        player,
        prediction: pred,
        score,
        isSelected: selectedPlayers.some(sp => sp.id === player.id)
      };
    });
  
  return {
    match,
    official,
    predictions,
    flags: data.flags
  };
}

export function leaderboardSummary(data, selectedMatchId, options = {}) {
  const includeBw = options.includeBw !== false;
  const includePp = options.includePp !== false;
  const compareOffset = options.compareOffset || 'none';

  const playedMatches = data.matches
    .map(match => {
      const matchId = String(match.id);
      const official = normalizeOfficial(match, data.officialByMatchId[matchId], data.sofaByMatchId[matchId]);
      return { match, official };
    })
    .filter(item => item.official && hasScore(item.official))
    .sort((a, b) => Number(a.match.id) - Number(b.match.id));

  let selectedIndex = playedMatches.length - 1;
  if (selectedMatchId) {
    const idx = playedMatches.findIndex(m => String(m.match.id) === String(selectedMatchId));
    if (idx !== -1) {
      selectedIndex = idx;
    }
  }

  if (selectedIndex < 0) {
    return { rows: [], includeBw, includePp };
  }

  const computeRankingsAtStep = (stepIdx) => {
    const stepMatches = playedMatches.slice(0, stepIdx + 1);
    const stepMatchIds = new Set(stepMatches.map(m => String(m.match.id)));
    const tables = getGroupTablesAtStep(stepMatches, data);
    const bestThirds = getBestThirdsAtStep(tables);

    let thirdAssignments = {};
    const totalPlayedAllGroups = Object.values(tables).reduce((sum, g) => sum + g.reduce((s, t) => s + t.played, 0), 0);
    if (totalPlayedAllGroups === 144) {
      thirdAssignments = buildThirdAssignmentsAtStep(tables, bestThirds, data);
    }

    const resolvedMatchups = [];
    if (includePp) {
      const matches = data.matches || [];
      matches.forEach(match => {
        if (match.stage !== 'round32') return;
        const home = resolveOfficialTeamAtStep(match, 'home', tables, thirdAssignments);
        const away = resolveOfficialTeamAtStep(match, 'away', tables, thirdAssignments);
        const unresolved = isTeamUnresolved(home) || isTeamUnresolved(away);
        if (!unresolved) {
          resolvedMatchups.push({ id: match.id, stage: match.stage, home, away });
        }
      });
    }

    const playersPoints = data.players.map(player => {
      const predictionMap = new Map();
      (player.matches || []).forEach(pred => {
        predictionMap.set(String(pred.id), pred);
      });

      let accumulated = 0;
      let correctPredictions = 0;
      let failedPredictions = 0;
      let goalsHit = 0;
      let goalsMissed = 0;
      let winsHit = 0;
      let drawsHit = 0;
      let lossesHit = 0;

      stepMatches.forEach(item => {
        const pred = predictionMap.get(String(item.match.id));
        if (pred && hasScore(pred)) {
          const score = scorePrediction(pred, item.official, data.scoringRules || {});
          
          accumulated += score.points;

          if (score.points > 0) {
            correctPredictions += 1;
          } else {
            failedPredictions += 1;
          }
          goalsHit += score.goalsHit || 0;
          goalsMissed += score.goalsMissed || 0;
          winsHit += score.winHit || 0;
          drawsHit += score.drawHit || 0;
          lossesHit += score.lossHit || 0;
        }
      });

      let wins = 0;
      if (includeBw) {
        (data.battleDocs || []).forEach(battle => {
          if (stepMatchIds.has(String(battle.matchId))) {
            const res = calculateBattleResult(battle, data);
            if (res.status === 'finished') {
              const playerKey = participantKeyOf(player);
              if (res.winnerKey === playerKey || res.winnerKey === player.id) {
                wins++;
              }
            }
          }
        });
      }
      const battleBonusPoints = Math.floor(wins / 2);

      const matchupPoints = calculateStepMatchupPointsOptimized(player, resolvedMatchups, data);

      return {
        id: player.id,
        name: player.participantName,
        icon: player.icon || '',
        accumulated,
        correctPredictions,
        failedPredictions,
        goalsHit,
        goalsMissed,
        winsHit,
        drawsHit,
        lossesHit,
        battleWins: wins,
        battleBonusPoints,
        matchupPoints,
        totalPoints: accumulated + matchupPoints + battleBonusPoints
      };
    });

    const sorted = [...playersPoints].sort((a, b) => 
      (b.totalPoints - a.totalPoints) || 
      (b.correctPredictions - a.correctPredictions) || 
      (b.goalsHit - a.goalsHit) || 
      (a.goalsMissed - b.goalsMissed) || 
      a.name.localeCompare(b.name, 'pt-PT')
    );

    return sorted.map((p, idx) => ({ ...p, rank: idx + 1 }));
  };

  const currentRankings = computeRankingsAtStep(selectedIndex);

  let prevRankingsMap = null;
  if (compareOffset !== 'none') {
    const offset = parseInt(compareOffset, 10);
    const prevIdx = selectedIndex - offset;
    if (prevIdx >= 0) {
      const prevRankings = computeRankingsAtStep(prevIdx);
      prevRankingsMap = new Map(prevRankings.map(p => [p.id, p.rank]));
    }
  }

  const rows = currentRankings.map(p => {
    let movement = undefined;
    if (prevRankingsMap && prevRankingsMap.has(p.id)) {
      const prevRank = prevRankingsMap.get(p.id);
      movement = prevRank - p.rank;
    }
    return {
      id: p.id,
      name: p.name,
      icon: p.icon,
      rank: p.rank,
      points: p.totalPoints,
      battleWins: p.battleWins,
      battleBonusPoints: p.battleBonusPoints,
      matchupPoints: p.matchupPoints,
      correctPredictions: p.correctPredictions,
      failedPredictions: p.failedPredictions,
      goalsHit: p.goalsHit,
      goalsMissed: p.goalsMissed,
      winsHit: p.winsHit,
      drawsHit: p.drawsHit,
      lossesHit: p.lossesHit,
      movement
    };
  });

  return { rows, includeBw, includePp };
}

