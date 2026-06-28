/*
  Popup "Ve prognosticos de outros jogadores".
  Mantem isolada a consulta publica, a navegacao mobile e a tabela do popup.
*/
function renderPublicPlayerList() {
  if (!publicPredictions.length) return '<div class="empty-state">Ainda não há prognósticos gravados.</div>';
  return `
    <div class="viewer-list">
      ${publicPredictions.map(item => `
        <div class="viewer-player-card" data-toggle-player-id="${escapeHtml(item.id)}">
          <button type="button" class="viewer-player viewer-player-head" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <strong>
              <span class="toggle-icon-player" style="transition: transform 0.2s; display: inline-block; margin-right: 8px;">▶</span>
              ${renderParticipantIdentity(item.participantName || 'Participante', item.icon || item.participantIcon || item.playerIcon || '')}
            </strong>
            <span>${escapeHtml(item.champion ? `Campeão: ${item.champion}` : 'Prognóstico completo')}</span>
          </button>
          <div class="viewer-player-details" style="display: none; padding: 10px; border-top: 1px solid rgba(255,255,255,0.08);">
            ${renderPublicPlayerDetails(item.id)}
          </div>
        </div>
      `).join('')}
    </div>
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
  return grouped;
}

function renderPublicByGame(stage = publicViewerStage, filter = publicGameFilter) {
  const now = new Date();
  const stageMatches = data.matches.filter(match => match.stage === stage).filter(match => {
    const official = getOfficialResult(match.id);
    const matchDate = getMatchDateObj(match);
    if (filter === 'played' || filter === 'points3' || filter === 'points1') return isOfficialResultFinished(official);
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
      <button type="button" class="viewer-filter-tab ${filter === 'points3' ? 'active' : ''}" data-game-filter="points3">+3 Pts</button>
      <button type="button" class="viewer-filter-tab ${filter === 'points1' ? 'active' : ''}" data-game-filter="points1">+1 Pt</button>
    </div>
    <div class="viewer-games">
      ${stageMatches.length ? stageMatches.map(match => {
        const official = getOfficialResult(match.id);
        const predictions = publicPredictions.map(item => ({
          player: item.participantName || 'Participante',
          item,
          match: (item.matches || []).find(row => Number(row.id) === Number(match.id))
        })).filter(row => {
          if (!row.match) return false;
          if (filter === 'points3' || filter === 'points1') {
            const score = official ? scoreOnePrediction(row.match, official) : null;
            const target = filter === 'points3' ? 3 : 1;
            return score && score.points === target;
          }
          return true;
        });
        return `
          <section class="viewer-game-card" data-toggle-game-id="${match.id}">
            <div class="viewer-game-head" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <div>
                <h3 style="margin: 0; display: inline-flex; align-items: center; gap: 8px;">
                  <span class="toggle-icon" style="transition: transform 0.2s; display: inline-block;">▶</span>
                  Jogo ${match.id} · ${escapeHtml(STAGE_LABELS[match.stage])}
                </h3>
                <p class="modal-muted" style="margin: 4px 0 0 24px; font-size: 0.85rem; font-weight: bold; color: #fff;">
                  ${escapeHtml(official ? `${official.homeTeam || match.home} ${official.homeGoals}-${official.awayGoals} ${official.awayTeam || match.away}` : `${match.home} vs ${match.away}`)} · ${escapeHtml(match.date)} ${escapeHtml(match.time || '')}
                </p>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                ${official ? `<strong class="official-chip ${official._live ? 'live-chip' : ''}">${official._live ? 'Ao vivo' : 'Oficial'}</strong>` : '<span class="future-chip">Ainda por jogar</span>'}
              </div>
            </div>
            <div class="viewer-picks" style="display: none; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
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
        <li><strong>16 avos até meias/3.º lugar:</strong> resultado exato = ${numericRule('knockoutInitialExact')} pontos; acertar vencedor/apurado = ${numericRule('knockoutInitialWinner')} ponto(s). Acertar no confronto dos 16 avos dá +2 pontos extra.</li>
        <li><strong>Final:</strong> resultado exato = ${numericRule('finalInitialExact')} pontos; acertar o campeão/vencedor = ${numericRule('finalInitialWinner')} pontos; acertar apenas o desfecho = ${numericRule('finalInitialMethod')} ponto(s).</li>
      </ul>
      <h3>Secção 2 — reformulações nas eliminatórias</h3>
      <ul>
        <li><strong>16 avos, Oitavos e Quartos de final:</strong> resultado exato = 4 pontos; apenas vencedor/apurado = 1 ponto.</li>
        <li><strong>Meias-finais e 3.º lugar:</strong> resultado exato = 5 pontos; apenas vencedor/apurado = 2 pontos.</li>
        <li><strong>Final:</strong> resultado exato = ${numericRule('finalReformExact')} pontos; apenas vencedor/apurado = 2 pontos.</li>
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


function renderPublicViewerBody(tab) {
  if (tab === 'players') return renderPublicPlayerList();
  if (tab === 'games') return renderPublicByGame(publicViewerStage, publicGameFilter);
  if (tab === 'table') return renderGgamesTable();
  if (tab === 'minigames') {
    return `
      <div class="games-tab-content" style="display: flex; flex-wrap: wrap; gap: 20px; padding: 20px 10px; justify-content: flex-start;">
        <!-- Jogo 1: Não Explodas o Treinador -->
        <div style="display: inline-block; position: relative; cursor: pointer; transition: transform 0.2s; border-radius: 12px; overflow: hidden; width: calc(50% - 10px); min-width: 140px; max-width: 200px;" 
             data-action="play-minigame" data-game-url="nao-explodas-o-treinador.html"
             onmouseover="this.style.transform='scale(1.02)'; this.querySelector('.play-btn-overlay').style.opacity='1'; this.querySelector('.play-btn-overlay').style.transform='scale(1)';"
             onmouseout="this.style.transform='scale(1)'; this.querySelector('.play-btn-overlay').style.opacity='0'; this.querySelector('.play-btn-overlay').style.transform='scale(0.95)';">
          <img src="nao_explodas.png" alt="Não Explodas o Treinador" style="width: 100%; display: block; height: 140px; object-fit: contain; border-radius: 12px;">
          <div class="play-btn-overlay" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(0.95); transition: opacity 0.3s ease, transform 0.3s ease; pointer-events: none; background: rgba(7, 26, 63, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); border-radius: 12px;">
            <span style="padding: 6px 12px; font-size: 0.65rem; font-family: 'Outfit', sans-serif; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 30px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.18); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.4); white-space: nowrap;">JOGAR</span>
          </div>
        </div>

        <!-- Jogo 2: Na Prancha do Pirata -->
        <div style="display: inline-block; position: relative; cursor: pointer; transition: transform 0.2s; border-radius: 12px; overflow: hidden; width: calc(50% - 10px); min-width: 140px; max-width: 200px;" 
             data-action="play-minigame" data-game-url="na-prancha-do-pirata-v2.html"
             onmouseover="this.style.transform='scale(1.02)'; this.querySelector('.play-btn-overlay').style.opacity='1'; this.querySelector('.play-btn-overlay').style.transform='scale(1)';"
             onmouseout="this.style.transform='scale(1)'; this.querySelector('.play-btn-overlay').style.opacity='0'; this.querySelector('.play-btn-overlay').style.transform='scale(0.95)';">
          <img src="na_prancha.png" alt="Na Prancha do Pirata!" style="width: 100%; display: block; height: 140px; object-fit: contain; border-radius: 12px;">
          <div class="play-btn-overlay" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(0.95); transition: opacity 0.3s ease, transform 0.3s ease; pointer-events: none; background: rgba(7, 26, 63, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); border-radius: 12px;">
            <span style="padding: 6px 12px; font-size: 0.65rem; font-family: 'Outfit', sans-serif; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 30px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.18); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.4); white-space: nowrap;">JOGAR</span>
          </div>
        </div>

        <!-- Jogo 3: Defende a Fama -->
        <div style="display: inline-block; position: relative; cursor: pointer; transition: transform 0.2s; border-radius: 12px; overflow: hidden; width: calc(50% - 10px); min-width: 140px; max-width: 200px;" 
             data-action="play-minigame" data-game-url="defende-a-fama.html"
             onmouseover="this.style.transform='scale(1.02)'; this.querySelector('.play-btn-overlay').style.opacity='1'; this.querySelector('.play-btn-overlay').style.transform='scale(1)';"
             onmouseout="this.style.transform='scale(1)'; this.querySelector('.play-btn-overlay').style.opacity='0'; this.querySelector('.play-btn-overlay').style.transform='scale(0.95)';">
          <img src="defende_fama.png" alt="Defende a Fama!" style="width: 100%; display: block; height: 140px; object-fit: contain; border-radius: 12px;">
          <div class="play-btn-overlay" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(0.95); transition: opacity 0.3s ease, transform 0.3s ease; pointer-events: none; background: rgba(7, 26, 63, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); border-radius: 12px;">
            <span style="padding: 6px 12px; font-size: 0.65rem; font-family: 'Outfit', sans-serif; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 30px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.18); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.4); white-space: nowrap;">JOGAR</span>
          </div>
        </div>
      </div>
    `;
  }
  return '';
}

function renderPublicViewer(active = 'players') {
  if (active === 'minigames_play') {
    const url = window.activeMinigameUrl || 'nao-explodas-o-treinador.html';
    const title = window.activeMinigameTitle || 'Não Explodas o Treinador!';
    return `
      <div class="games-tab-content" style="width:100%; height: calc(100vh - 140px); display:flex; flex-direction:column; background:#000; overflow:hidden;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px; background: #071a3f; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <strong style="color:#fff; font-size:1rem;">${title}</strong>
          <button type="button" class="close-btn" onclick="window.closeMinigameMobile()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: bold;">Voltar</button>
        </div>
        <iframe src="${url}" style="width:100%; flex: 1; border:none;" allow="autoplay"></iframe>
      </div>
    `;
  }
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
      <button type="button" class="viewer-tab ${active === 'minigames' ? 'active' : ''}" data-view-tab="minigames">Gaming</button>
    </div>
    <div id="viewerBody">
      ${renderPublicViewerBody(active)}
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
}

async function openMobilePublicPredictionsPage(active = 'games') {
  mobileAppSection = 'prognostics';
  mobilePublicViewerLoading = true;
  mobilePublicViewerHtml = '<div class="live-loading-card">A carregar prognósticos dos jogadores<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></div>';
  updateMobileAppNav();
  refreshLiveDashboardView();
  try {
    await loadPublicPredictions();
    await loadApiWorldCupData({ sync: false });
    window.publicViewerActiveTab = active;
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
  openModal('<h2>Outros jogadores</h2><p class="modal-muted">A carregar prognósticos<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></p>');
  try {
    await loadPublicPredictions();
    await loadApiWorldCupData({ sync: false });
    openModal(renderPublicViewer('games'));
  } catch (error) {
    console.error(error);
    openModal('<h2>Outros jogadores</h2><p class="modal-muted">Não foi possível carregar os prognósticos. Tenta novamente mais tarde.</p>');
  }
}


/* Integra??o da Sec??o 2 no viewer p?blico. */
(function enhancePublicPredictionsWithSection2() {
  const resolveOfficialTeam = (match, side) => {
    if (typeof window.resolveSection2OfficialTeam === 'function') {
      return window.resolveSection2OfficialTeam(match, side);
    }
    return match?.[side] || '';
  };

  renderPublicByGame = function(stage = publicViewerStage, filter = publicGameFilter) {
      const now = new Date();
      const stageMatches = data.matches.filter(match => match.stage === stage).filter(match => {
        const official = getOfficialResult(match.id);
        const matchDate = getMatchDateObj(match);
        if (filter === 'played' || filter === 'points3' || filter === 'points1') return typeof isOfficialResultFinished === 'function' ? isOfficialResultFinished(official) : !!official;
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
          <button type="button" class="viewer-filter-tab ${filter === 'points3' ? 'active' : ''}" data-game-filter="points3">+3 Pts</button>
          <button type="button" class="viewer-filter-tab ${filter === 'points1' ? 'active' : ''}" data-game-filter="points1">+1 Pt</button>
        </div>
        <div class="viewer-games">
          ${stageMatches.length ? stageMatches.map(match => {
            const official = getOfficialResult(match.id);
            const officialHome = official?.homeTeam || resolveOfficialTeam(match, 'home') || match.home;
            const officialAway = official?.awayTeam || resolveOfficialTeam(match, 'away') || match.away;
            const predictions = publicPredictions.map(item => ({
              player: item.participantName || 'Participante',
              item,
              match: (item.matches || []).find(row => Number(row.id) === Number(match.id))
            })).filter(row => {
              if (!row.match) return false;
              if (filter === 'points3' || filter === 'points1') {
                const override = getSection2DocForPlayer(row.item, match.id);
                const score = official ? scoreOnePrediction(row.match, official, override) : null;
                const target = filter === 'points3' ? 3 : 1;
                return score && score.points === target;
              }
              return true;
            });
  
            const homeTeamName = officialHome || match.home;
            const awayTeamName = officialAway || match.away;
            let gameTitleText = '';
            if (official) {
              gameTitleText = `${homeTeamName} ${official.homeGoals}-${official.awayGoals} ${awayTeamName}`;
            } else {
              gameTitleText = `${homeTeamName} vs ${awayTeamName}`;
            }
            const stageLabelText = STAGE_LABELS[match.stage] || match.stage;
  
            return `
              <section class="viewer-game-card" data-toggle-game-id="${match.id}">
                <div class="viewer-game-head" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; width: 100%;">
                  <div>
                    <h3 style="margin: 0; display: inline-flex; align-items: center; gap: 8px;">
                      <span class="toggle-icon" style="transition: transform 0.2s; display: inline-block;">▶</span>
                      Jogo ${match.id} · ${escapeHtml(stageLabelText)}
                    </h3>
                    <p class="modal-muted" style="margin: 4px 0 0 24px; font-size: 0.85rem; font-weight: bold; color: #fff;">
                      ${escapeHtml(gameTitleText)} · ${escapeHtml(match.date)} ${escapeHtml(match.time || '')}
                    </p>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    ${isOfficialResultFinished(official)
                      ? `<strong class="official-chip">Oficial</strong>`
                      : isOfficialResultLive(official)
                        ? `<strong class="official-chip live-chip">🔴 Ao Vivo</strong>`
                        : '<span class="future-chip">Ainda por jogar</span>'
                    }
                  </div>
                </div>
                <div class="viewer-picks" style="display: none; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                  ${predictions.length ? predictions.map(row => {
                    const override = getSection2DocForPlayer(row.item, match.id);
                    const score = official ? scoreOnePrediction(row.match, official, override) : null;
                    const className = score ? (score.exact ? 'hit-exact' : score.points > 0 ? 'hit-outcome' : 'miss') : '';
                    const badge = score ? `<b>${score.points} pts</b>` : '';
                    const sec2 = override ? `<em class="section2-mini">${override.mode === 'replicate' ? 'manteve Secção 1' : 'reformulou'}</em>` : '';
                    const text = override && override.mode === 'changed' ? `${escapeHtml(override.homeTeam)} ${override.homeGoals}-${override.awayGoals} ${escapeHtml(override.awayTeam)} · vence ${escapeHtml(override.winnerTeam)}` : predictionResultText(row.match);
                    return `<div class="viewer-pick ${className}"><strong>${renderParticipantIdentity(row.player, row.item?.icon || row.item?.participantIcon || row.item?.playerIcon || '', 'participant-ident--compact')}</strong><span>${text}</span>${sec2}${badge}</div>`;
                  }).join('') : '<p class="modal-muted">Ainda não há prognósticos para este jogo.</p>'}
                </div>
              </section>
            `;
          }).join('') : `<div class="empty-state">Não há jogos nesta lista.</div>`}
        </div>
      `;
    };
  
    renderGiriaBattles = function(rows) {
      if (rows.length < 2) return '<p class="modal-muted">Ainda não há confrontos suficientes.</p>';
      const futureMatches = data.matches.filter(match => !getOfficialResult(match.id) && getMatchDateObj(match) >= new Date());
      const cards = [];
      for (let i = 0; i < rows.length - 1 && cards.length < 8; i++) {
        const top = rows[i];
        const below = rows[i + 1];
        if (Math.abs(top.points - below.points) > 6) continue;
        const p1 = publicPredictions.find(p => (p.participantKey || normalizeKey(p.participantName)) === top.participantKey) || publicPredictions.find(p => String(p.id) === String(top.id));
        const p2 = publicPredictions.find(p => (p.participantKey || normalizeKey(p.participantName)) === below.participantKey) || publicPredictions.find(p => String(p.id) === String(below.id));
        const nextMatch = futureMatches.find(match =>
          (p1?.matches || []).some(pred => Number(pred.id) === Number(match.id)) &&
          (p2?.matches || []).some(pred => Number(pred.id) === Number(match.id))
        );
        if (!nextMatch) continue;
        const pred1 = (p1.matches || []).find(pred => Number(pred.id) === Number(nextMatch.id));
        const pred2 = (p2.matches || []).find(pred => Number(pred.id) === Number(nextMatch.id));
        const over1 = getSection2DocForPlayer(p1, nextMatch.id);
        const over2 = getSection2DocForPlayer(p2, nextMatch.id);
        cards.push(`
          <div class="battle-card battle-card-horizontal">
            <span class="battle-match">Jogo ${nextMatch.id} · ${escapeHtml(resolveOfficialTeam(nextMatch, 'home') || nextMatch.home)} vs ${escapeHtml(resolveOfficialTeam(nextMatch, 'away') || nextMatch.away)}</span>
            <div class="battle-duel-row">
              <div class="battle-player battle-player-a"><strong>${renderParticipantIdentity(`#${top.rank} ${top.name}`, p1?.icon || p1?.participantIcon || p1?.playerIcon || top.icon, 'participant-ident--compact')}</strong><span>${over1?.mode === 'changed' ? `${escapeHtml(over1.homeTeam)} ${over1.homeGoals}-${over1.awayGoals} ${escapeHtml(over1.awayTeam)}` : predictionResultText(pred1)}</span></div>
              <b class="battle-versus">VS</b>
              <div class="battle-player battle-player-b"><strong>${renderParticipantIdentity(`#${below.rank} ${below.name}`, p2?.icon || p2?.participantIcon || p2?.playerIcon || below.icon, 'participant-ident--compact')}</strong><span>${over2?.mode === 'changed' ? `${escapeHtml(over2.homeTeam)} ${over2.homeGoals}-${over2.awayGoals} ${escapeHtml(over2.awayTeam)}` : predictionResultText(pred2)}</span></div>
            </div>
          </div>
        `);
      }
      return cards.join('') || '<p class="modal-muted">Ainda não há batalhas próximas.</p>';
    };
  
    renderPublicViewer = function(active = 'games') {
      if (active === 'minigames_play') {
        const url = window.activeMinigameUrl || 'nao-explodas-o-treinador.html';
        const title = window.activeMinigameTitle || 'Não Explodas o Treinador!';
        return `
          <div class="games-tab-content" style="width:100%; height: calc(100vh - 140px); display:flex; flex-direction:column; background:#000; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px; background: #071a3f; border-bottom: 1px solid rgba(255,255,255,0.08);">
              <strong style="color:#fff; font-size:1rem;">${title}</strong>
              <button type="button" class="close-btn" onclick="window.closeMinigameMobile()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: bold;">Voltar</button>
            </div>
            <iframe src="${url}" style="width:100%; flex: 1; border:none;" allow="autoplay"></iframe>
          </div>
        `;
      }
      return `
        <div class="modal-head">
          <div>
            <p class="eyebrow small">Prognósticos gravados</p>
            <h2>Outros jogadores</h2>
            <p class="modal-muted">Consulta os prognósticos por jogo, por jogador ou pela Tabela Ggames.</p>
          </div>
        </div>
        <div class="viewer-tabs">
          <button type="button" class="viewer-tab ${active === 'games' ? 'active' : ''}" data-view-tab="games">Por jogo</button>
          <button type="button" class="viewer-tab ${active === 'players' ? 'active' : ''}" data-view-tab="players">Por jogador</button>
          <button type="button" class="viewer-tab ${active === 'table' ? 'active' : ''}" data-view-tab="table">Tabela Ggames</button>
          <button type="button" class="viewer-tab ${active === 'minigames' ? 'active' : ''}" data-view-tab="minigames">Gaming</button>
        </div>
        <div id="viewerBody">
          ${renderPublicViewerBody(active)}
        </div>
      `;
    };
  
    renderClosedPublicView = async function() {
      const container = $('#matchesContainer');
      if (!container) return;
      container.innerHTML = '';
      if (!worldCupApi.loaded) {
        Promise.allSettled([loadApiWorldCupData({ sync: true }), loadPublicPredictions()]).then(() => {
          startLiveApiSync();
        });
      }
    };
  
    openPublicPredictionsModal = async function(activeTab = 'games') {
      if (isVotingClosed()) {
        await openLiveResultsModal();
        return;
      }
      openModal('<h2>Outros jogadores</h2><p class="modal-muted">A carregar prognósticos<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></p>');
      try {
        await loadPublicPredictions();
        openModal(renderPublicViewer(activeTab));
      } catch (error) {
        console.error(error);
        openModal('<h2>Outros jogadores</h2><p class="modal-muted">Não foi possível carregar os prognósticos. Confirma as permissões de leitura.</p>');
      }
    };
})();

/* Modo p?s-vota??o: a Central fica no ecr? principal e o bot?o abre s? este popup. */
(function fixClosedModeDashboardAndPredictionsPopup() {
  if (typeof renderClosedPublicView !== 'undefined') {
    renderClosedPublicView = async function() {
      const container = typeof $ === 'function' ? $('#matchesContainer') : document.querySelector('#matchesContainer');
      if (container) container.innerHTML = '';

      const dashboard = typeof $ === 'function' ? $('#closedLiveDashboard') : document.querySelector('#closedLiveDashboard');
      if (dashboard) dashboard.innerHTML = '<div class="live-loading-card">A carregar a Central Ggames...</div>';

      await Promise.allSettled([
        typeof loadApiWorldCupData === 'function' ? loadApiWorldCupData({ sync: true }) : Promise.resolve(),
        typeof loadPublicPredictions === 'function' ? loadPublicPredictions() : Promise.resolve()
      ]);

      if (dashboard && typeof renderLiveDashboard === 'function') {
        dashboard.innerHTML = renderLiveDashboard();
      }

      if (typeof startLiveApiSync === 'function') startLiveApiSync();
    };
  }

  if (typeof openPublicPredictionsModal !== 'undefined') {
    openPublicPredictionsModal = async function(activeTab = 'games') {
      if (typeof openModal === 'function') {
        openModal('<h2>Outros jogadores</h2><p class="modal-muted">A carregar prognósticos<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></p>');
      }

      try {
        await Promise.allSettled([
          typeof loadApiWorldCupData === 'function' ? loadApiWorldCupData({ sync: false }) : Promise.resolve(),
          typeof loadPublicPredictions === 'function' ? loadPublicPredictions() : Promise.resolve()
        ]);

        if (typeof openModal === 'function' && typeof renderPublicViewer === 'function') {
          openModal(renderPublicViewer(activeTab));
        }
      } catch (error) {
        console.error(error);
        if (typeof openModal === 'function') {
          openModal('<h2>Outros jogadores</h2><p class="modal-muted">Não foi possível carregar os prognósticos. Tenta novamente mais tarde.</p>');
        }
      }
    };
  }
})();

window.openMinigamePopup = function(gameUrl) {
  const url = gameUrl || 'nao-explodas-o-treinador.html';
  if (typeof mobileAppSection !== 'undefined' && mobileAppSection === 'prognostics') {
    window.publicViewerActiveTab = 'minigames_play';
    window.activeMinigameUrl = url;
    window.activeMinigameTitle = url.includes('prancha') 
      ? 'Na Prancha do Pirata!' 
      : url.includes('defende') 
        ? 'Defende a Fama!' 
        : 'Não Explodas o Treinador!';
    mobilePublicViewerHtml = renderPublicViewer('minigames_play');
    refreshLiveDashboardView(true);
  } else {
    window.location.href = url;
  }
};

window.closeMinigameMobile = function() {
  window.publicViewerActiveTab = 'minigames';
  mobilePublicViewerHtml = renderPublicViewer('minigames');
  refreshLiveDashboardView(true);
};
