
/* Ggames Battles completas:
   - lê worldcupextraBattles e worldcupextraBattleScorers
   - permite escolha de marcador por PIN a partir dos 16 avos
   - calcula BW e pontos extra na Tabela Ggames
*/
(() => {
  const BATTLES_COLLECTION = 'worldcupextraBattles';
  const BATTLE_SCORERS_COLLECTION = 'worldcupextraBattleScorers';
  const BATTLE_MATCHES_COLLECTION = 'worldcupextraMatches';
  const BATTLE_KO_STAGES = ['round32', 'round16', 'quarterfinals', 'semifinals', 'third_place', 'final'];

  let ggamesBattleDocs = [];
  let ggamesBattleScorerPicks = [];


  async function hashPinForBattle(participantKey, pin) {
    const text = `${participantKey}:${pin}`;
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(text);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return `fnv-${(hash >>> 0).toString(16)}`;
  }

  function battleDocId(matchId, battleNo) {
    return `match_${String(matchId).padStart(3, '0')}_battle_${String(battleNo).padStart(2, '0')}`;
  }

  function matchDocId(matchId) {
    return `match_${String(matchId).padStart(3, '0')}`;
  }

  function participantKeyOf(item) {
    return item?.participantKey || normalizeParticipantName(item?.participantName || item?.name || item?.id || '');
  }

  function playerByKey(key) {
    return publicPredictions.find(p => participantKeyOf(p) === key || String(p.id) === String(key)) || null;
  }

  function localMatch(matchId) {
    return data?.matches?.find(m => Number(m.id) === Number(matchId)) || null;
  }

  function matchTitle(matchId) {
    const m = localMatch(matchId);
    return m ? `${m.home} vs ${m.away}` : `Jogo ${matchId}`;
  }

  function getMatchKickoff(matchId) {
    const m = localMatch(matchId);
    if (!m) return null;
    return new Date(`${m.date}T${m.time || '12:00'}:00`);
  }

  function isBeforeKickoff(matchId) {
    const kickoff = getMatchKickoff(matchId);
    return !!kickoff && new Date() < kickoff;
  }

  function isKnockoutStage(stage) {
    return BATTLE_KO_STAGES.includes(stage);
  }

  function battleStage(battle) {
    return battle.stage || localMatch(battle.matchId)?.stage || '';
  }

  function predictionFor(player, matchId) {
    return (player?.matches || []).find(pred => Number(pred.id) === Number(matchId)) || null;
  }

  function pickId(battleId, participantKey) {
    return `${battleId}_${participantKey}`;
  }

  function pickFor(battleId, participantKey) {
    return ggamesBattleScorerPicks.find(p =>
      String(p.battleId) === String(battleId) &&
      String(p.participantKey) === String(participantKey)
    ) || null;
  }

  function officialWithApi(matchId) {
    const id = String(matchId);
    const official = getOfficialResult(id);
    const api = worldCupApi?.games?.find(g => String(g.id) === id);
    return official || api || null;
  }

  function normalizeScorerName(name) {
    return String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function scorerArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(v => typeof v === 'string' ? v : (v.name || v.player || v.scorer || JSON.stringify(v)));
    return String(value)
      .split(/[,;|]/)
      .map(v => v.trim())
      .filter(Boolean);
  }

  function officialScorers(official) {
    return [
      ...scorerArray(official?.homeScorers || official?.home_scorers),
      ...scorerArray(official?.awayScorers || official?.away_scorers)
    ].map(normalizeScorerName);
  }

  function scorerHit(pick, official) {
    if (!pick?.pickedPlayerName || !official) return false;
    const target = normalizeScorerName(pick.pickedPlayerName);
    return officialScorers(official).some(name =>
      name === target || name.includes(target) || target.includes(name)
    );
  }

  function battleFactors(player, battle, official) {
    const pred = predictionFor(player, battle.matchId);
    if (!pred || !official || pred.homeGoals == null || pred.awayGoals == null || official.homeGoals == null || official.awayGoals == null) {
      return { total: 0, winner: 0, homeGoals: 0, awayGoals: 0, exact: 0, scorer: 0 };
    }

    const ph = Number(pred.homeGoals);
    const pa = Number(pred.awayGoals);
    const oh = Number(official.homeGoals);
    const oa = Number(official.awayGoals);
    const predicted = predictionOutcome(pred);
    const actual = actualOutcome(official);

    const participantKey = participantKeyOf(player);
    const pick = pickFor(battle.id, participantKey);
    const factors = {
      winner: predicted === actual ? 1 : 0,
      homeGoals: ph === oh ? 1 : 0,
      awayGoals: pa === oa ? 1 : 0,
      exact: ph === oh && pa === oa ? 1 : 0,
      scorer: scorerHit(pick, official) ? 1 : 0
    };
    factors.total = factors.winner + factors.homeGoals + factors.awayGoals + factors.exact + factors.scorer;
    return factors;
  }

  function calculateBattleResult(battle) {
    const official = officialWithApi(battle.matchId);
    const playerA = playerByKey(battle.playerAKey);
    const playerB = playerByKey(battle.playerBKey);
    if (!official || official.homeGoals == null || official.awayGoals == null || !playerA || !playerB) {
      return {
        status: battle.status || 'pending',
        playerAFactors: battle.playerAFactors ?? 0,
        playerBFactors: battle.playerBFactors ?? 0,
        winnerKey: battle.winnerKey || '',
        draw: !!battle.draw
      };
    }

    const a = battleFactors(playerA, battle, official);
    const b = battleFactors(playerB, battle, official);
    const winnerKey = a.total > b.total ? battle.playerAKey : b.total > a.total ? battle.playerBKey : '';
    return {
      status: official.finished || official._finished || battle.status === 'finished' ? 'finished' : (battle.status || 'pending'),
      playerAFactors: a.total,
      playerBFactors: b.total,
      playerADetails: a,
      playerBDetails: b,
      winnerKey,
      draw: !winnerKey,
      officialHomeGoals: official.homeGoals,
      officialAwayGoals: official.awayGoals
    };
  }

  function battleStatsByPlayer() {
    const stats = {};
    publicPredictions.forEach(p => {
      const key = participantKeyOf(p);
      stats[key] = { battleWins: 0, battleDraws: 0, battleLosses: 0, battleBonusPoints: 0 };
    });

    ggamesBattleDocs.forEach(battle => {
      const result = calculateBattleResult(battle);
      if (result.status !== 'finished') return;
      const a = battle.playerAKey;
      const b = battle.playerBKey;
      if (!stats[a]) stats[a] = { battleWins: 0, battleDraws: 0, battleLosses: 0, battleBonusPoints: 0 };
      if (!stats[b]) stats[b] = { battleWins: 0, battleDraws: 0, battleLosses: 0, battleBonusPoints: 0 };
      if (result.draw) {
        stats[a].battleDraws++;
        stats[b].battleDraws++;
      } else if (result.winnerKey === a) {
        stats[a].battleWins++;
        stats[b].battleLosses++;
      } else if (result.winnerKey === b) {
        stats[b].battleWins++;
        stats[a].battleLosses++;
      }
    });

    Object.values(stats).forEach(row => {
      row.battleBonusPoints = Math.floor((row.battleWins || 0) / 2);
    });
    return stats;
  }

  async function loadGgamesBattlesData() {
    if (!firestoreDb || !firebaseTools) return;
    try {
      const battleSnap = await firebaseTools.getDocs(firebaseTools.collection(firestoreDb, BATTLES_COLLECTION));
      ggamesBattleDocs = battleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Não foi possível carregar worldcupextraBattles.', error);
      ggamesBattleDocs = [];
    }

    try {
      const pickSnap = await firebaseTools.getDocs(firebaseTools.collection(firestoreDb, BATTLE_SCORERS_COLLECTION));
      ggamesBattleScorerPicks = pickSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Não foi possível carregar worldcupextraBattleScorers.', error);
      ggamesBattleScorerPicks = [];
    }
  }

  const baseLoadPublicPredictionsForBattles = loadPublicPredictions;
  loadPublicPredictions = async function() {
    const result = await baseLoadPublicPredictionsForBattles();
    await loadGgamesBattlesData();
    return result;
  };

  const baseCalculateGgamesTableForBattles = calculateGgamesTable;
  calculateGgamesTable = function() {
    const stats = battleStatsByPlayer();
    const rows = baseCalculateGgamesTableForBattles().map(row => {
      const key = row.participantKey || participantKeyOf(row);
      const p = playerByKey(key) || publicPredictions.find(item => String(item.id) === String(row.id)) || null;
      const b = stats[key] || { battleWins: 0, battleDraws: 0, battleLosses: 0, battleBonusPoints: 0 };
      return {
        ...row,
        participantKey: key,
        icon: row.icon || p?.icon || p?.participantIcon || p?.playerIcon || '',
        battleWins: b.battleWins || 0,
        battleDraws: b.battleDraws || 0,
        battleLosses: b.battleLosses || 0,
        battleBonusPoints: b.battleBonusPoints || 0,
        points: (row.points || 0) + (b.battleBonusPoints || 0)
      };
    });

    return rows.sort((a, b) =>
      (b.points - a.points) ||
      (b.correctPredictions - a.correctPredictions) ||
      (b.goalsHit - a.goalsHit) ||
      (a.goalsMissed - b.goalsMissed) ||
      a.name.localeCompare(b.name, 'pt-PT')
    ).map((row, index) => ({ ...row, rank: index + 1 }));
  };

  function ggamesSortHeaderSafe(key, label, title = '') {
    return typeof ggamesSortHeader === 'function'
      ? ggamesSortHeader(key, label, title)
      : `<th title="${escapeHtml(title || label)}">${escapeHtml(label)}</th>`;
  }

  renderGgamesTable = function(options = {}) {
    const showBattles = options.battles !== false;
    const rows = sortedGgamesRows(calculateGgamesTable());
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
                  ${ggamesSortHeaderSafe('points', 'Pontos')}
                  ${ggamesSortHeaderSafe('battleWins', 'BW', 'Battle Wins')}
                  ${ggamesSortHeaderSafe('correctPredictions', 'Acertados')}
                  ${ggamesSortHeaderSafe('failedPredictions', 'Falhados')}
                  ${ggamesSortHeaderSafe('goalsHit', 'GM', 'Golos marcados')}
                  ${ggamesSortHeaderSafe('goalsMissed', 'GF', 'Golos falhados')}
                  ${ggamesSortHeaderSafe('winsHit', 'V', 'Vitórias/desfechos certos')}
                  ${ggamesSortHeaderSafe('drawsHit', 'E', 'Empates certos')}
                  ${ggamesSortHeaderSafe('lossesHit', 'D', 'Derrotas/desfechos certos')}
                </tr>
              </thead>
              <tbody>
                ${rows.map(row => `<tr class="ggames-player-row" data-live-player="${escapeHtml(row.id)}" title="Ver histórico de ${escapeHtml(row.name)}">
                  <td>${row.rank}</td>
                  <td><button type="button" class="ggames-player-link" data-live-player="${escapeHtml(row.id)}"><strong>${renderParticipantIdentity(row.name, row.icon, 'participant-ident--compact')}</strong></button></td>
                  <td><strong>${row.points}</strong>${row.battleBonusPoints ? `<small class="battle-bonus-note">+${row.battleBonusPoints} BW</small>` : ''}</td>
                  <td title="Battle Wins">${row.battleWins || 0}</td>
                  <td>${row.correctPredictions}</td>
                  <td>${row.failedPredictions}</td>
                  <td title="Golos marcados">${row.goalsHit}</td>
                  <td title="Golos falhados">${row.goalsMissed}</td>
                  <td title="Vitórias/desfechos certos">${row.winsHit}</td>
                  <td title="Empates certos">${row.drawsHit}</td>
                  <td title="Derrotas/desfechos certos">${row.lossesHit}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="ggames-info-row">
            <button type="button" class="ggames-info-btn" data-ggames-info aria-label="Ver regras de pontuação e desempate">i</button>
            <span>Regras de pontuação, BW e desempate</span>
          </div>
        </section>
        ${showBattles ? `<aside class="battles-card">
          <h3>Ggames Battles</h3>
          ${renderGiriaBattles(rows)}
        </aside>` : ''}
      </div>
    `;
  };

  function savedBattlesForMainView() {
    const now = new Date();
    const playable = ggamesBattleDocs.filter(b => {
      const m = localMatch(b.matchId);
      if (!m) return false;
      const r = calculateBattleResult(b);
      return r.status !== 'finished' && (getMatchKickoff(b.matchId) || now) >= now;
    }).sort((a, b) => Number(a.matchId) - Number(b.matchId));

    return playable.length ? playable : ggamesBattleDocs
      .slice()
      .sort((a, b) => Number(a.matchId) - Number(b.matchId))
      .slice(0, 12);
  }

  function renderBattleCard(battle, compact = false) {
    const pA = playerByKey(battle.playerAKey);
    const pB = playerByKey(battle.playerBKey);
    if (!pA || !pB) return '';
    const match = localMatch(battle.matchId);
    const predA = predictionFor(pA, battle.matchId);
    const predB = predictionFor(pB, battle.matchId);
    const result = calculateBattleResult(battle);
    const stage = battleStage(battle);
    const canPick = isKnockoutStage(stage) && isBeforeKickoff(battle.matchId);
    const pickA = pickFor(battle.id, battle.playerAKey);
    const pickB = pickFor(battle.id, battle.playerBKey);
    const status = result.status === 'finished'
      ? `Resultado Battle: ${result.playerAFactors}-${result.playerBFactors}${result.draw ? ' · empate' : result.winnerKey === battle.playerAKey ? ` · vence ${escapeHtml(battle.playerAName)}` : ` · vence ${escapeHtml(battle.playerBName)}`}`
      : canPick ? 'Clica para escolher marcador da Battle' : 'Battle pendente';

    return `
      <div class="battle-card live-battle battle-card-horizontal battle-card-clickable" data-battle-id="${escapeHtml(battle.id)}">
        <span class="battle-match">Jogo ${escapeHtml(battle.matchId)} · ${escapeHtml(match?.home || battle.homeTeam || '')} vs ${escapeHtml(match?.away || battle.awayTeam || '')}</span>
        <div class="battle-duel-row">
          <div class="battle-player battle-player-a">
            <strong>${renderParticipantIdentity(`#${escapeHtml(battle.playerARank || '')} ${battle.playerAName || pA.participantName}`, pA.icon || pA.participantIcon || pA.playerIcon || '', 'participant-ident--compact')}</strong>
            <span>${predictionResultText(predA)}</span>
            ${pickA ? `<small>Marcador: ${escapeHtml(pickA.pickedPlayerName)}</small>` : ''}
          </div>
          <b class="battle-versus">VS</b>
          <div class="battle-player battle-player-b">
            <strong>${renderParticipantIdentity(`#${escapeHtml(battle.playerBRank || '')} ${battle.playerBName || pB.participantName}`, pB.icon || pB.participantIcon || pB.playerIcon || '', 'participant-ident--compact')}</strong>
            <span>${predictionResultText(predB)}</span>
            ${pickB ? `<small>Marcador: ${escapeHtml(pickB.pickedPlayerName)}</small>` : ''}
          </div>
        </div>
        <p class="${result.status === 'finished' ? 'battle-result-line' : 'battle-state'}">${status}</p>
      </div>
    `;
  }

  function generatedFallbackBattles(rows) {
    const futureMatches = data?.matches?.filter(match => !getOfficialResult(match.id) && getMatchDateObj(match) >= new Date()) || [];
    if (!futureMatches.length) return [];
    const match = futureMatches[0];
    const sorted = rows.slice().sort((a, b) => a.rank - b.rank);
    const battles = [];
    for (let i = 0; i < sorted.length - 1; i += 2) {
      const a = sorted[i], b = sorted[i + 1];
      const pA = playerByKey(a.id);
      const pB = playerByKey(b.id);
      if (!pA || !pB) continue;
      battles.push({
        id: `preview_${match.id}_${i}`,
        matchId: match.id,
        stage: match.stage,
        homeTeam: match.home,
        awayTeam: match.away,
        playerAKey: participantKeyOf(pA),
        playerAName: pA.participantName,
        playerARank: a.rank,
        playerBKey: participantKeyOf(pB),
        playerBName: pB.participantName,
        playerBRank: b.rank,
        status: 'preview'
      });
    }
    return battles.slice(0, 8);
  }

  renderLiveGiriaBattles = function() {
    const rows = calculateGgamesTable();
    if (rows.length < 2) return '<p class="modal-muted">Ainda não há jogadores suficientes para criar battles.</p>';
    const battles = savedBattlesForMainView();
    const display = battles.length ? battles : generatedFallbackBattles(rows);
    return display.length
      ? display.slice(0, 10).map(b => renderBattleCard(b, true)).join('')
      : '<p class="modal-muted">Ainda não há battles geradas. Usa a página gerenciar-battles.html para criar.</p>';
  };

  renderGiriaBattles = function(rows) {
    const battles = ggamesBattleDocs.length ? savedBattlesForMainView() : generatedFallbackBattles(rows);
    return battles.length
      ? battles.slice(0, 8).map(b => renderBattleCard(b, true)).join('')
      : '<p class="modal-muted">Ainda não há battles geradas.</p>';
  };

  function teamSquad(teamName) {
    const teams = squadsData?.teams || {};
    return teams[teamName] || Object.values(teams).find(team =>
      normalizeParticipantName(team.name) === normalizeParticipantName(teamName) ||
      normalizeParticipantName(team.officialName) === normalizeParticipantName(teamName)
    ) || null;
  }

  function renderScorerPlayers(teamName) {
    const squad = teamSquad(teamName);
    const players = squad?.players || [];
    if (!players.length) {
      return `<p class="modal-muted">Sem lista de jogadores para ${escapeHtml(teamName)}.</p>`;
    }
    return `
      <div class="battle-scorer-team">
        <h4>${escapeHtml(teamName)}</h4>
        <div class="battle-scorer-grid">
          ${players.map(player => `
            <label class="battle-scorer-option">
              <input type="radio" name="battleScorerPick" value="${escapeHtml(player.name)}" data-team="${escapeHtml(teamName)}">
              <span>${player.image ? `<img src="${escapeHtml(player.image)}" alt="">` : `<b>${escapeHtml(player.shirtName || player.name).slice(0,2)}</b>`}</span>
              <em>${escapeHtml(player.shirtName || player.name)} <small>${escapeHtml(player.position || '')}</small></em>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }

  function openBattleScorerModal(battleId) {
    const battle = ggamesBattleDocs.find(b => String(b.id) === String(battleId)) || null;
    if (!battle) {
      openModal('<h2>Battle</h2><p class="modal-muted">Esta battle ainda não está gravada no Firebase.</p>');
      return;
    }
    const stage = battleStage(battle);
    const match = localMatch(battle.matchId);
    const beforeKickoff = isBeforeKickoff(battle.matchId);
    const canPick = isKnockoutStage(stage) && beforeKickoff;

    openModal(`
      <div class="modal-head">
        <div>
          <p class="eyebrow small">Ggames Battle</p>
          <h2>${escapeHtml(match?.home || battle.homeTeam || '')} vs ${escapeHtml(match?.away || battle.awayTeam || '')}</h2>
          <p class="modal-muted">${canPick ? `Escolhe 1 marcador até ${escapeHtml(match?.time || '')}.` : 'A escolha de marcador está fechada ou ainda não se aplica a esta fase.'}</p>
        </div>
      </div>
      <section class="battle-scorer-modal">
        <label>Participante</label>
        <select id="battleScorerParticipant">
          <option value="">Escolher...</option>
          <option value="${escapeHtml(battle.playerAKey)}">${escapeHtml(battle.playerAName)}</option>
          <option value="${escapeHtml(battle.playerBKey)}">${escapeHtml(battle.playerBName)}</option>
        </select>
        <label>PIN</label>
        <input id="battleScorerPin" type="password" inputmode="numeric" maxlength="12" placeholder="PIN">
        <button id="battleScorerEnter" type="button" ${canPick ? '' : 'disabled'}>Entrar</button>
        <div id="battleScorerBody"></div>
      </section>
    `);

    const enter = $('#battleScorerEnter');
    if (enter) enter.addEventListener('click', async () => {
      const participantKey = $('#battleScorerParticipant')?.value || '';
      const pin = $('#battleScorerPin')?.value.trim() || '';
      const body = $('#battleScorerBody');
      if (!participantKey || !pin) {
        body.innerHTML = '<p class="error-text">Escolhe o teu nome e escreve o PIN.</p>';
        return;
      }
      const already = pickFor(battle.id, participantKey);
      if (already) {
        body.innerHTML = `<p class="modal-muted">Já escolheste marcador para esta battle: <strong>${escapeHtml(already.pickedPlayerName)}</strong>.</p>`;
        return;
      }
      const participantRef = firebaseTools.doc(firestoreDb, FIREBASE_COLLECTION, participantKey);
      const snap = await firebaseTools.getDoc(participantRef);
      const pinHash = await hashPinForBattle(participantKey, pin);
      const data = snap.exists() ? snap.data() : {};
      const hashOk = data?.pinHash && String(data.pinHash) === String(pinHash);
      const legacyOk = !data?.pinHash && String(data?.pin || '') === pin;
      if (!snap.exists() || (!hashOk && !legacyOk)) {
        body.innerHTML = '<p class="error-text">PIN incorreto para esse participante.</p>';
        return;
      }
      if (!data?.pinHash) {
        body.innerHTML = '<p class="error-text">Este participante ainda não tem pinHash. Abre gerenciar-battles.html como admin e clica em “Criar pinHash dos PINs”.</p>';
        return;
      }

      body.innerHTML = `
        <div class="battle-scorer-list">
          ${renderScorerPlayers(match?.home || battle.homeTeam)}
          ${renderScorerPlayers(match?.away || battle.awayTeam)}
        </div>
        <button id="battleScorerSave" type="button">Gravar marcador</button>
      `;
      $('#battleScorerSave')?.addEventListener('click', async () => {
        const selected = document.querySelector('input[name="battleScorerPick"]:checked');
        if (!selected) {
          body.insertAdjacentHTML('beforeend', '<p class="error-text">Escolhe um jogador.</p>');
          return;
        }
        const pickedPlayerName = selected.value;
        const pickedPlayerTeam = selected.dataset.team;
        const payload = {
          matchDocId: matchDocId(battle.matchId),
          matchId: Number(battle.matchId),
          battleId: battle.id,
          participantKey,
          participantName: snap.data()?.participantName || '',
          pinHash,
          pickedPlayerName,
          pickedPlayerTeam,
          stage,
          createdAt: firebaseTools.serverTimestamp(),
          updatedAt: firebaseTools.serverTimestamp()
        };
        try {
          await firebaseTools.setDoc(firebaseTools.doc(firestoreDb, BATTLE_SCORERS_COLLECTION, pickId(battle.id, participantKey)), payload);
          await loadGgamesBattlesData();
          body.innerHTML = `<p class="success-text">Marcador gravado: <strong>${escapeHtml(pickedPlayerName)}</strong>.</p>`;
          refreshLiveDashboardView();
        } catch (error) {
          body.insertAdjacentHTML('beforeend', `<p class="error-text">Não foi possível gravar: ${escapeHtml(error.message)}</p>`);
        }
      });
    });
  }

  const baseOpenGgamesRulesModalForBattles = openGgamesRulesModal;
  openGgamesRulesModal = function() {
    baseOpenGgamesRulesModalForBattles();
    const content = document.querySelector('.rules-modal-content');
    if (content && !content.querySelector('[data-battle-rules]')) {
      content.insertAdjacentHTML('beforeend', `
        <h3 data-battle-rules>Ggames Battles</h3>
        <ul>
          <li><strong>BW:</strong> Battle Wins. A cada 2 vitórias em Battles, o jogador ganha +1 ponto na Tabela Ggames.</li>
          <li><strong>V/E/D:</strong> vitórias, empates e derrotas/desfechos certos nos prognósticos.</li>
          <li>Nas Battles, o vencedor é quem tiver mais fatores certos: vencedor/empate, golos da casa, golos de fora, resultado exato e marcador certo.</li>
          <li>A escolha de marcador só abre a partir dos 16 avos e fecha quando o jogo começa.</li>
        </ul>
      `);
    }
  };

  document.body.addEventListener('click', event => {
    const battleCard = event.target.closest('[data-battle-id]');
    if (!battleCard) return;
    if (event.target.closest('[data-live-player]')) return;
    event.stopPropagation();
    openBattleScorerModal(battleCard.dataset.battleId);
  });
})();
