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
  stadiums: { title: 'Estádios', text: 'Impacto dos estádios nos prognósticos.' }
};

const PLAYER_GROUP_FILTERS = new Set(['lost', 'dramaticLost', 'commonResult', 'checkpoint', 'lateGains', 'gains', 'aloneInFame', 'wonWithStyle', 'selections', 'stadiums']);

export function buildProfile({ data, scopeId, activeFilters, groupByPlayer = false, selectedSelection = 'all', selectedStadium = 'all' }) {
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
              : summarizeFilter(key, rows, transitions, data, selectedPlayers)))
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
  const source = official || sofa;
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

export function scorePrediction(pred, official, scoringRules) {
  if (!pred || !hasScore(pred) || !hasScore(official)) return { points: 0, exact: false, outcomeHit: false };
  const ph = Number(pred.homeGoals);
  const pa = Number(pred.awayGoals);
  const oh = Number(official.homeGoals);
  const oa = Number(official.awayGoals);
  const exact = ph === oh && pa === oa;
  const outcomeHit = outcome(ph, pa) === outcome(oh, oa);
  const officialWinner = oh > oa ? official.homeTeam : oa > oh ? official.awayTeam : 'Empate';
  const winnerHit = pred.winnerTeam && officialWinner !== 'Empate' && sameTeamName(pred.winnerTeam, officialWinner);
  const stage = pred.stage || official.stage || 'groups';
  let points = 0;
  if (stage === 'groups') points = exact ? scoringRules.groupExact : outcomeHit ? scoringRules.groupOutcome : 0;
  else if (stage === 'final') points = exact ? scoringRules.finalInitialExact : winnerHit ? scoringRules.finalInitialWinner : outcomeHit ? scoringRules.finalInitialMethod : 0;
  else points = exact ? scoringRules.knockoutInitialExact : (outcomeHit || winnerHit) ? scoringRules.knockoutInitialWinner : 0;
  return { points: Number(points) || 0, exact, outcomeHit: outcomeHit || winnerHit };
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
  
  const relevantTransitions = transitions.filter(t => {
    if (isAll) return true;
    const h = t.match.home || t.match.homeTeam;
    const a = t.match.away || t.match.awayTeam;
    return (h && h.toLowerCase() === selectedSelection.toLowerCase()) || 
           (a && a.toLowerCase() === selectedSelection.toLowerCase());
  });
  
  let pointsGained = 0;
  let pointsLost = 0;
  
  const playerGains = new Map();
  const playerLosses = new Map();
  
  selectedPlayers.forEach(p => {
    playerGains.set(p.participantName, 0);
    playerLosses.set(p.participantName, 0);
  });
  
  relevantTransitions.forEach(t => {
    const pName = t.player.participantName;
    if (!playerGains.has(pName)) {
      playerGains.set(pName, 0);
      playerLosses.set(pName, 0);
    }
    if (t.delta > 0) {
      pointsGained += t.delta;
      playerGains.set(pName, playerGains.get(pName) + t.delta);
    } else if (t.delta < 0) {
      const absDelta = Math.abs(t.delta);
      pointsLost += absDelta;
      playerLosses.set(pName, playerLosses.get(pName) + absDelta);
    }
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
      if (score.exact) {
        correctPredictionsCount += 1;
      } else if (score.points === 0) {
        wrongPredictionsCount += 1;
      }

      const predKey = `${ph}-${pa}`;
      predictionCounts.set(predKey, (predictionCounts.get(predKey) || 0) + 1);
    });
  });

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
  
  const relevantTransitions = transitions.filter(t => {
    if (isAll) return true;
    return t.match.venue && t.match.venue.toLowerCase() === selectedStadium.toLowerCase();
  });
  
  let pointsGained = 0;
  let pointsLost = 0;
  
  const playerGains = new Map();
  const playerLosses = new Map();
  
  selectedPlayers.forEach(p => {
    playerGains.set(p.participantName, 0);
    playerLosses.set(p.participantName, 0);
  });
  
  relevantTransitions.forEach(t => {
    const pName = t.player.participantName;
    if (!playerGains.has(pName)) {
      playerGains.set(pName, 0);
      playerLosses.set(pName, 0);
    }
    if (t.delta > 0) {
      pointsGained += t.delta;
      playerGains.set(pName, playerGains.get(pName) + t.delta);
    } else if (t.delta < 0) {
      const absDelta = Math.abs(t.delta);
      pointsLost += absDelta;
      playerLosses.set(pName, playerLosses.get(pName) + absDelta);
    }
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
      if (score.exact) {
        correctPredictionsCount += 1;
      } else if (score.points === 0) {
        wrongPredictionsCount += 1;
      }

      const predKey = `${ph}-${pa}`;
      predictionCounts.set(predKey, (predictionCounts.get(predKey) || 0) + 1);
    });
  });

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
