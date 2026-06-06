
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
const FIREBASE_SDK_VERSION = '10.14.1';
let firestoreDb = null;
let firebaseTools = null;


let data = null;
let squadsData = null;
let publicPredictions = [];
let publicViewerStage = 'groups';
let state = { name: '', predictions: {}, activeStage: 'groups', lastSaved: '' };

const $ = (selector) => document.querySelector(selector);

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
  btn.disabled = !info.complete || !firestoreDb;

  if (!firestoreDb) {
    status.textContent = 'A gravação ainda não está pronta. Confirma que estás com internet.';
  } else if (info.complete) {
    status.textContent = 'Tudo preenchido. Já podes gravar o teu prognóstico.';
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
      query: firestoreModule.query,
      where: firestoreModule.where,
      orderBy: firestoreModule.orderBy,
      doc: firestoreModule.doc,
      setDoc: firestoreModule.setDoc,
      limit: firestoreModule.limit,
      writeBatch: firestoreModule.writeBatch
    };
    updateSaveButton();
  } catch (error) {
    console.error('Erro ao iniciar Firebase:', error);
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
  if (!firestoreDb || !firebaseTools) throw new Error('A ligação ainda não está pronta.');
  const collectionRef = firebaseTools.collection(firestoreDb, FIREBASE_COLLECTION);
  let snapshot;
  try {
    snapshot = await firebaseTools.getDocs(firebaseTools.query(collectionRef, firebaseTools.orderBy('clientTimestamp', 'desc')));
  } catch {
    snapshot = await firebaseTools.getDocs(collectionRef);
  }
  publicPredictions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return publicPredictions;
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
          <strong>${escapeHtml(item.participantName || 'Participante')}</strong>
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
  return `<h3>${escapeHtml(item.participantName || 'Participante')}</h3>${grouped}`;
}

function renderPublicByGame(stage = publicViewerStage) {
  const stageMatches = data.matches.filter(match => match.stage === stage);
  return `
    <div class="viewer-stage-tabs">
      ${Object.entries(STAGE_LABELS).map(([key, label]) => `<button type="button" class="viewer-stage-tab ${key === stage ? 'active' : ''}" data-view-stage="${key}">${escapeHtml(label)}</button>`).join('')}
    </div>
    <div class="viewer-games">
      ${stageMatches.map(match => {
        const predictions = publicPredictions.map(item => ({
          player: item.participantName || 'Participante',
          match: (item.matches || []).find(row => Number(row.id) === Number(match.id))
        })).filter(row => row.match);
        return `
          <section class="viewer-game-card">
            <h3>Jogo ${match.id} · ${escapeHtml(STAGE_LABELS[match.stage])}</h3>
            <p class="modal-muted">${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</p>
            <div class="viewer-picks">
              ${predictions.length ? predictions.map(row => `<div class="viewer-pick"><strong>${escapeHtml(row.player)}</strong><span>${predictionResultText(row.match)}</span></div>`).join('') : '<p class="modal-muted">Ainda não há prognósticos para este jogo.</p>'}
            </div>
          </section>
        `;
      }).join('')}
    </div>
  `;
}

function renderPublicViewer(active = 'players') {
  return `
    <div class="modal-head">
      <div>
        <p class="eyebrow small">Prognósticos gravados</p>
        <h2>Outros jogadores</h2>
        <p class="modal-muted">Consulta os prognósticos por jogador ou por jogo.</p>
      </div>
    </div>
    <div class="viewer-tabs">
      <button type="button" class="viewer-tab ${active === 'players' ? 'active' : ''}" data-view-tab="players">Por jogador</button>
      <button type="button" class="viewer-tab ${active === 'games' ? 'active' : ''}" data-view-tab="games">Por jogo</button>
    </div>
    <div id="viewerBody">
      ${active === 'players' ? renderPublicPlayerList() : renderPublicByGame(publicViewerStage)}
    </div>
  `;
}

async function openPublicPredictionsModal() {
  openModal('<h2>Outros jogadores</h2><p class="modal-muted">A carregar prognósticos...</p>');
  try {
    await loadPublicPredictions();
    openModal(renderPublicViewer('players'));
  } catch (error) {
    console.error(error);
    openModal('<h2>Outros jogadores</h2><p class="modal-muted">Não foi possível carregar os prognósticos. Confirma as permissões de leitura.</p>');
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
    status.textContent = 'Prognóstico gravado com sucesso.';
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
    const card = event.target.closest('.match-card');
    if (card) openMatchModal(card.dataset.matchId);
  });

  document.body.addEventListener('click', (event) => {
    const viewerTab = event.target.closest('[data-view-tab]');
    if (viewerTab) {
      event.stopPropagation();
      $('#viewerBody').innerHTML = viewerTab.dataset.viewTab === 'players' ? renderPublicPlayerList() : renderPublicByGame(publicViewerStage);
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
      $('#viewerBody').innerHTML = renderPublicByGame(publicViewerStage);
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
    const ok = confirm('Queres mesmo apagar todos os prognósticos guardados neste navegador?');
    if (!ok) return;
    state.predictions = {};
    saveState();
    renderMatches();
  });

  $('#viewOthersBtn').addEventListener('click', openPublicPredictionsModal);

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
    updateSummary();
    renderMatches();
    initFirebase();
  } catch (error) {
    $('#matchesContainer').innerHTML = `<div class="empty-state">Erro ao carregar o calendário e as equipas. Abre o site através de um servidor local, por exemplo VS Code + Live Server.</div>`;
    console.error(error);
  }
}

init();
