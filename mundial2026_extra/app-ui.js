/* UI principal: cards, modais, deadline e Central Ggames base. */
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

  await loadScoringRules();
  await loadPublicPredictions();
  await loadApiWorldCupData({ sync: true });

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

  await loadPublicPredictions();
  await loadApiWorldCupData({ sync: true });
  const body = $('#liveViewerBody');
  if (body) body.innerHTML = renderLiveDashboard();
  startLiveApiSync();
}

function refreshLiveDashboardView() {
  if (window.publicViewerActiveTab === 'minigames_play') {
    // Prevent the live sync from re-rendering and resetting the active minigame iframe
    return;
  }
  const body = $('#liveViewerBody') || $('#closedLiveDashboard') || $('#closedViewerBody');
  if (body) {
    const scrollState = captureLiveDashboardScrollState(body);
    body.innerHTML = renderLiveDashboard();
    restoreLiveDashboardScrollState(body, scrollState);
  }
  updateMobileAppNav();
}

function captureLiveDashboardScrollState(container) {
  if (!container) return null;
  const state = {
    containerScrollTop: container.scrollTop,
    windowScrollY: window.scrollY,
    keyed: {}
  };
  container.querySelectorAll('[data-scroll-key]').forEach(node => {
    state.keyed[node.dataset.scrollKey] = node.scrollTop;
  });
  return state;
}

function restoreLiveDashboardScrollState(container, state) {
  if (!container || !state) return;
  container.scrollTop = state.containerScrollTop || 0;
  container.querySelectorAll('[data-scroll-key]').forEach(node => {
    const saved = state.keyed?.[node.dataset.scrollKey];
    if (typeof saved === 'number') node.scrollTop = saved;
  });
  window.scrollTo(window.scrollX, state.windowScrollY || 0);
}



