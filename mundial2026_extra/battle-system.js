
/* Ggames Battles Live:
   - lê/grava battles live em worldcupextraLiveBattles
   - permite escolha de marcador por PIN a partir dos 16 avos
   - calcula BW e pontos extra na Tabela Ggames
*/
(() => {
  const LIVE_BATTLES_COLLECTION = 'worldcupextraLiveBattles';
  const BATTLE_SCORERS_COLLECTION = 'worldcupextraBattleScorers';
  const LIVE_BATTLE_MATCHES_COLLECTION = 'worldcupextraLiveBattleMatches';
  const BATTLE_KO_STAGES = ['round32', 'round16', 'quarterfinals', 'semifinals', 'third_place', 'final'];

  let ggamesBattleDocs = [];
      window.ggamesBattleDocs = ggamesBattleDocs;
  let ggamesBattleScorerPicks = [];
  let flagsData = {};
  const liveBattlePersistInFlight = new Set();

  function getTeamFlagUrl(teamName) {
    if (!teamName) return '';
    const key = teamName.toLowerCase().trim();
    return flagsData[key]?.flagRound || '';
  }


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
    return `live_match_${String(matchId).padStart(3, '0')}_battle_${String(battleNo).padStart(2, '0')}`;
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

  function canPersistLiveBattleMatch(match) {
    if (match?.source === 'future') return true;
    return !!match?.id && !match.finished && isMatchInLiveWindow(match);
  }

  function battleStage(battle) {
    return battle.stage || localMatch(battle.matchId)?.stage || '';
  }

  function predictionFor(player, matchId) {
    const match = localMatch(matchId);
    const isKnockout = match ? match.stage !== 'groups' : true;
    const initialPred = (player?.matches || []).find(pred => Number(pred.id) === Number(matchId)) || null;
    
    if (isKnockout) {
      const override = typeof getSection2DocForPlayer === 'function' ? getSection2DocForPlayer(player, matchId) : null;
      if (!override) return null;
      
      if (override.mode === 'changed') {
        return {
          ...initialPred,
          homeGoals: override.homeGoals,
          awayGoals: override.awayGoals,
          winnerTeam: override.winnerTeam,
          method: override.method,
          homeTeam: override.homeTeam,
          awayTeam: override.awayTeam
        };
      } else if (override.mode === 'replicate' && initialPred) {
        return initialPred;
      }
      return null;
    }
    
    return initialPred;
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
    if (typeof isOfficialResultFinished === 'function' && isOfficialResultFinished(official)) return official;
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
    const isFinished = !!official && (typeof isOfficialResultFinished === 'function' ? isOfficialResultFinished(official) : (official.finished || official._finished));

    if (!isFinished || !official || official.homeGoals == null || official.awayGoals == null || !playerA || !playerB) {
      return {
        status: 'pending',
        playerAFactors: battle.playerAFactors ?? 0,
        playerBFactors: battle.playerBFactors ?? 0,
        winnerKey: '',
        draw: false
      };
    }

    const a = battleFactors(playerA, battle, official);
    const b = battleFactors(playerB, battle, official);
    const winnerKey = a.total > b.total ? battle.playerAKey : b.total > a.total ? battle.playerBKey : '';
    return {
      status: 'finished',
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
      const battleSnap = await firebaseTools.getDocs(firebaseTools.collection(firestoreDb, LIVE_BATTLES_COLLECTION));
      ggamesBattleDocs = battleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      window.ggamesBattleDocs = ggamesBattleDocs;
    } catch (error) {
      console.warn('Não foi possível carregar as Battles.', error);
      ggamesBattleDocs = [];
      window.ggamesBattleDocs = ggamesBattleDocs;
    }

    try {
      const pickSnap = await firebaseTools.getDocs(firebaseTools.collection(firestoreDb, BATTLE_SCORERS_COLLECTION));
      ggamesBattleScorerPicks = pickSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Não foi possível carregar as escolhas de marcador.', error);
      ggamesBattleScorerPicks = [];
    }

    try {
      const flagsRes = await fetch('./mundial2026_bandeiras_redondas.json').catch(() => null);
      if (flagsRes) {
        const flagsJson = await flagsRes.json();
        flagsJson.teams.forEach(t => {
          flagsData[t.nome.toLowerCase()] = t;
          flagsData[t.name.toLowerCase()] = t;
          if (t.aliases) {
            t.aliases.forEach(alias => {
              flagsData[alias.toLowerCase()] = t;
            });
          }
        });
      }
    } catch (e) {
      console.warn('Não foi possível carregar as bandeiras redondas.', e);
    }
  }

  function calculateCurrentRanksForAutoGeneration() {
    const rows = publicPredictions.map(item => {
      const stats = {
        id: item.id,
        name: item.participantName || 'Participante',
        participantKey: participantKeyOf(item),
        points: 0,
        correctPredictions: 0
      };
      (item.matches || []).forEach(pred => {
        const official = officialWithApi(pred.id);
        if (!official || official.homeGoals == null || official.awayGoals == null || official.homeGoals === '' || official.awayGoals === '') return;
        
        const ph = Number(pred.homeGoals);
        const pa = Number(pred.awayGoals);
        const oh = Number(official.homeGoals);
        const oa = Number(official.awayGoals);
        
        const outcomeHit = (ph > pa && oh > oa) || (pa > ph && oa > oh) || (ph === pa && oh === oa);
        const exact = ph === oh && pa === oa;
        
        let pts = 0;
        if (exact) pts = 3;
        else if (outcomeHit) pts = 1;
        
        stats.points += pts;
        stats.correctPredictions += pts > 0 ? 1 : 0;
      });
      return stats;
    });

    return rows.sort((a, b) => (b.points - a.points) || (b.correctPredictions - a.correctPredictions) || a.name.localeCompare(b.name, 'pt-PT'))
               .map((row, index) => ({ ...row, rank: index + 1 }));
  }

  async function autoGenerateMissingFinishedBattles() {
    if (!firestoreDb || !firebaseTools || !publicPredictions.length) return;
    
    const finishedMatches = (data?.matches || []).filter(match => {
      const official = officialWithApi(match.id);
      return official && (official.finished || official.homeGoals != null) && official.homeGoals !== '' && official.awayGoals !== '';
    });

    let generatedAny = false;

    for (const match of finishedMatches) {
      const matchId = match.id;
      const hasBattles = ggamesBattleDocs.some(b => Number(b.matchId) === Number(matchId));
      if (!hasBattles) {
        console.log(`Auto-gerar battles para o jogo terminado ${matchId}...`);
        const ranks = calculateCurrentRanksForAutoGeneration();
        const pairs = buildSavedDiverseLiveBattlePairs(ranks, { id: matchId }, 8);
        if (!pairs.length) continue;
        
        const created = pairs.map((pair, index) => {
          const a = pair.a.row;
          const b = pair.b.row;
          const battleId = battleDocId(matchId, index + 1);
          
          const battleBase = {
            id: battleId,
            matchDocId: matchDocId(matchId),
            matchId: Number(matchId),
            stage: match.stage || 'groups',
            group: match.group || null,
            homeTeam: match.home || match.homeTeam || '',
            awayTeam: match.away || match.awayTeam || '',
            playerAKey: a.participantKey,
            playerAName: a.name,
            playerARank: a.rank,
            playerBKey: b.participantKey,
            playerBName: b.name,
            playerBRank: b.rank,
            createdOrder: index + 1,
            lockedAtKickoff: true,
            status: 'finished',
            _contrast: predictionOutcome(pair.a.pred) !== predictionOutcome(pair.b.pred) ? 'Vencedores diferentes' : 'Resultados diferentes'
          };

          const result = calculateBattleResult(battleBase);
          return { ...battleBase, ...result };
        });

        try {
          await Promise.all(created.map(battleDoc => {
            const { id, ...payload } = battleDoc;
            delete payload.playerADetails;
            delete payload.playerBDetails;
            return firebaseTools.setDoc(
              firebaseTools.doc(firestoreDb, LIVE_BATTLES_COLLECTION, id),
              payload,
              { merge: true }
            );
          }));

          await firebaseTools.setDoc(
            firebaseTools.doc(firestoreDb, LIVE_BATTLE_MATCHES_COLLECTION, matchDocId(matchId)),
            {
              matchId: Number(matchId),
              matchDocId: matchDocId(matchId),
              status: 'finished',
              battlesCreated: true,
              battlesCount: created.length,
              sourceCollection: LIVE_BATTLES_COLLECTION,
              stage: match.stage || '',
              homeTeam: match.home || '',
              awayTeam: match.away || '',
              createdAt: firebaseTools.serverTimestamp ? firebaseTools.serverTimestamp() : new Date().toISOString(),
              updatedAt: firebaseTools.serverTimestamp ? firebaseTools.serverTimestamp() : new Date().toISOString()
            },
            { merge: true }
          );

          ggamesBattleDocs = [
            ...ggamesBattleDocs.filter(b => String(b.matchId) !== String(matchId)),
            ...created
          ];
          window.ggamesBattleDocs = ggamesBattleDocs;
          generatedAny = true;
          console.log(`Jogo ${matchId}: Battles auto-geradas e gravadas com sucesso.`);
        } catch (err) {
          console.warn(`Erro ao auto-gerar battles para o jogo ${matchId}:`, err);
        }
      }
    }

    if (generatedAny && typeof refreshLiveDashboardView === 'function') {
      refreshLiveDashboardView();
    }
  }

  const baseLoadPublicPredictionsForBattles = loadPublicPredictions;
  loadPublicPredictions = async function() {
    const result = await baseLoadPublicPredictionsForBattles();
    await loadGgamesBattlesData();
    await autoGenerateMissingFinishedBattles();
    return result;
  };

  const baseCalculateGgamesTableForBattles = calculateGgamesTable;

  function calculateBattleEnhancedRows(options = {}) {
    const includeLive = options.includeLive !== false;
    const showBw = window.ggamesShowBwBonus !== false;
    const showPp = window.ggamesShowPp !== false;
    const originalOfficialResults = officialResults;
    if (!includeLive) {
      officialResults = Object.fromEntries(
        Object.entries(originalOfficialResults || {}).filter(([, value]) => !value?._live)
      );
    }

    try {
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
          points: (row.points || 0) - (showPp ? 0 : (row.matchupPoints || 0)) + (showBw ? (b.battleBonusPoints || 0) : 0)
        };
      });

      return rows.sort((a, b) =>
        (b.points - a.points) ||
        (b.correctPredictions - a.correctPredictions) ||
        (b.goalsHit - a.goalsHit) ||
        (a.goalsMissed - b.goalsMissed) ||
        a.name.localeCompare(b.name, 'pt-PT')
      ).map((row, index) => ({ ...row, rank: index + 1 }));
    } finally {
      officialResults = originalOfficialResults;
    }
  }

  calculateGgamesTable = function() {
    return calculateBattleEnhancedRows({ includeLive: true });
  };

  function ggamesSortHeaderSafe(key, label, title = '') {
    return typeof ggamesSortHeader === 'function'
      ? ggamesSortHeader(key, label, title)
      : `<th title="${escapeHtml(title || label)}">${escapeHtml(label)}</th>`;
  }

  function movementIndicator(previousRank, currentRank) {
    if (!previousRank || previousRank === currentRank) return '<span class="ggames-rank-move same">•</span>';
    if (currentRank < previousRank) return `<span class="ggames-rank-move up" title="Subiu ${previousRank - currentRank} lugar(es)">▲ ${previousRank - currentRank}</span>`;
    return `<span class="ggames-rank-move down" title="Desceu ${currentRank - previousRank} lugar(es)">▼ ${currentRank - previousRank}</span>`;
  }

  renderGgamesTable = function(options = {}) {
    const showBattles = options.battles !== false;
    const liveIds = currentLiveMatchIds();
    const liveMode = liveIds.size > 0;
    const rows = sortedGgamesRows(calculateBattleEnhancedRows({ includeLive: true }));
    const baseRows = calculateBattleEnhancedRows({ includeLive: false });
    const baseRankById = Object.fromEntries(baseRows.map(row => [String(row.id), row.rank]));
    const basePointsById = Object.fromEntries(baseRows.map(row => [String(row.id), row.points]));
    if (!rows.length) return '<div class="empty-state">Ainda não há jogadores para mostrar.</div>';
    
    const showBw = window.ggamesShowBwBonus !== false;
    const showPp = window.ggamesShowPp !== false;

    return `
      <div class="leaderboard-layout">
        <section class="leaderboard-card ${liveMode ? 'leaderboard-card-live' : ''}">
          <div class="table-header-row" style="display:flex; justify-content:flex-start; align-items:center; flex-wrap:wrap; gap:30px; margin-bottom:12px; border-bottom:1px solid var(--line); padding-bottom:8px;">
            <h3 style="margin:0;">Tabela Ggames ${liveMode ? '<span class="table-live-badge">AO VIVO</span>' : ''}</h3>
            <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.82rem; color:var(--muted); cursor:pointer; font-weight:normal; user-select:none; margin-left: 10px;">
              <input type="checkbox" id="ggamesBwToggle" ${showBw ? 'checked' : ''} style="cursor:pointer; margin:0; width:14px; height:14px;">
              BW
            </label>
            <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.82rem; color:var(--muted); cursor:pointer; font-weight:normal; user-select:none; margin-left: 10px;">
              <input type="checkbox" id="ggamesPpToggle" ${showPp ? 'checked' : ''} style="cursor:pointer; margin:0; width:14px; height:14px;">
              PP
            </label>
          </div>
          <div class="table-scroll">
            <table class="ggames-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jogador</th>
                  ${ggamesSortHeaderSafe('points', 'Pontos')}
                  ${ggamesSortHeaderSafe('battleWins', 'BW', 'Battle Wins')}
                  ${ggamesSortHeaderSafe('matchupPoints', 'PP', 'Prognósticos Pontos (Confrontos certos)')}
                  ${ggamesSortHeaderSafe('correctPredictions', 'A', 'Acertados')}
                  ${ggamesSortHeaderSafe('failedPredictions', 'E', 'Errados')}
                  ${ggamesSortHeaderSafe('goalsHit', 'GM', 'Golos marcados')}
                  ${ggamesSortHeaderSafe('goalsMissed', 'GF', 'Golos falhados')}
                  ${ggamesSortHeaderSafe('winsHit', 'V', 'Vitórias/desfechos certos')}
                  ${ggamesSortHeaderSafe('drawsHit', 'E', 'Empates certos')}
                  ${ggamesSortHeaderSafe('lossesHit', 'D', 'Derrotas/desfechos certos')}
                </tr>
              </thead>
              <tbody>
                ${rows.map(row => {
                  const previousRank = baseRankById[String(row.id)] || row.rank;
                  const previousPoints = basePointsById[String(row.id)] || 0;
                  const liveDelta = liveMode ? (row.points - previousPoints) : 0;
                  return `<tr class="ggames-player-row ${liveMode ? 'ggames-player-row-live' : ''}" data-live-player="${escapeHtml(row.id)}" title="Ver histórico de ${escapeHtml(row.name)}">
                    <td><div class="ggames-rank-cell"><strong>${row.rank}</strong>${liveMode ? movementIndicator(previousRank, row.rank) : ''}</div></td>
                    <td><button type="button" class="ggames-player-link" data-live-player="${escapeHtml(row.id)}"><strong>${renderParticipantIdentity(row.name, row.icon, 'participant-ident--compact')}</strong></button></td>
                    <td><strong>${row.points}</strong>${showBw && row.battleBonusPoints ? `<small class="battle-bonus-note">+${row.battleBonusPoints} BW</small>` : ''}${liveMode && liveDelta > 0 ? `<small class="live-points-note">+${liveDelta} live</small>` : ''}</td>
                    <td title="Battle Wins">${showBw ? (row.battleWins || 0) : 0}</td>
                    <td title="Prognósticos Pontos (Confrontos certos)">${row.matchupPoints || 0}</td>
                    <td>${row.correctPredictions}</td>
                    <td>${row.failedPredictions}</td>
                    <td title="Golos marcados">${row.goalsHit}</td>
                    <td title="Golos falhados">${row.goalsMissed}</td>
                    <td title="Vitórias/desfechos certos">${row.winsHit}</td>
                    <td title="Empates certos">${row.drawsHit}</td>
                    <td title="Derrotas/desfechos certos">${row.lossesHit}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div class="ggames-info-row">
            <button type="button" class="ggames-info-btn" data-ggames-info aria-label="Ver regras de pontuação e desempate">i</button>
            <span>${liveMode ? 'Classificação em atualização ao vivo, com subidas e descidas automáticas.' : 'Regras de pontuação, BW e desempate'}</span>
          </div>
        </section>
        ${showBattles ? `<aside class="battles-card ${liveMode ? 'battles-card-live' : ''}">
          <h3 style="margin-bottom:12px;">Ggames Battles Live ${liveMode ? '<span class="table-live-badge">AO VIVO</span>' : ''}</h3>
          ${renderGiriaBattles(rows)}
        </aside>` : ''}
      </div>
    `;
  };

  function currentLiveMatchIds() {
    const ids = new Set(liveMatchesForBattles().map(game => String(game.id)));
    return ids;
  }

  function apiMatchForBattle(matchId) {
    const api = (worldCupApi?.games || []).find(game => String(game.id) === String(matchId)) || null;
    if (api) return api;
    return liveMatchesForBattles().find(game => String(game.id) === String(matchId)) || null;
  }

  function battleLiveContext(battle) {
    const api = apiMatchForBattle(battle.matchId);
    const official = officialWithApi(battle.matchId);
    const live = !!(api?.live && !api?.finished);
    const elapsed = official?.timeElapsed ?? api?.timeElapsed ?? null;
    const statusText = live ? (typeof liveStatusLabel === 'function' ? liveStatusLabel(elapsed) : `${elapsed || 0}'`) : '';
    return { api, official, live, statusText };
  }


  function liveMatchesForBattles() {
    const seen = new Set();
    const matches = [];

    const addMatch = (match) => {
      if (!match?.id) return;
      const key = String(match.id);
      if (seen.has(key)) return;
      seen.add(key);
      matches.push(match);
    };

    if (typeof getCurrentLiveGameForDashboard === 'function') {
      const currentLive = getCurrentLiveGameForDashboard();
      if (canPersistLiveBattleMatch(currentLive)) addMatch(currentLive);
    }

    (worldCupApi?.games || [])
      .filter(game => game.live && canPersistLiveBattleMatch(game))
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach(addMatch);

    (data?.matches || [])
      .filter(match => isMatchInLiveWindow(match))
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach(localLive => {
        addMatch({
          id: String(localLive.id),
          matchId: String(localLive.id),
          stage: localLive.stage,
          group: localLive.group || null,
          date: localLive.date,
          time: localLive.time,
          homeTeam: localLive.home,
          awayTeam: localLive.away,
          live: true,
          finished: false,
          timeElapsed: `~${elapsedMinuteFromSchedule(localLive)}`,
          source: 'matches.json'
        });
      });

    if (matches.length === 0) {
      const now = new Date();
      const source = (worldCupApi?.games && worldCupApi.games.length)
        ? worldCupApi.games
        : (data?.matches || []).map(m => ({...m, id: String(m.id), homeTeam: m.home, awayTeam: m.away, homeGoals: null, awayGoals: null, finished: false, live: false}));
      const futureMatches = source.filter(g => !g.finished && !g.live && getMatchDateObj({ date: g.date, time: g.time }) >= now);
      if (futureMatches.length) {
        const nextFuture = futureMatches[0];
        const nextStage = nextFuture.stage || localMatch(nextFuture.id)?.stage || '';
        if (BATTLE_KO_STAGES.includes(nextStage)) {
          addMatch({
            id: String(nextFuture.id),
            matchId: String(nextFuture.id),
            stage: nextStage,
            group: nextFuture.group || null,
            date: nextFuture.date,
            time: nextFuture.time,
            homeTeam: nextFuture.homeTeam || nextFuture.home,
            awayTeam: nextFuture.awayTeam || nextFuture.away,
            live: false,
            finished: false,
            timeElapsed: 'Pre-jogo',
            source: 'future'
          });
        }
      }
    }

    return matches.sort((a, b) => Number(a.id) - Number(b.id));
  }

  function firstLiveMatchForBattles() {
    const liveMatches = liveMatchesForBattles();
    if (liveMatches.length) return liveMatches[0];

    if (typeof getCurrentLiveGameForDashboard === 'function') {
      const currentLive = getCurrentLiveGameForDashboard();
      if (canPersistLiveBattleMatch(currentLive)) return currentLive;
    }

    const apiLive = (worldCupApi?.games || [])
      .filter(game => game.live && canPersistLiveBattleMatch(game))
      .sort((a, b) => Number(a.id) - Number(b.id))[0];
    if (apiLive) return apiLive;

    const localLive = (data?.matches || [])
      .filter(match => isMatchInLiveWindow(match))
      .sort((a, b) => Number(a.id) - Number(b.id))[0];
    if (!localLive) return null;

    return {
      id: String(localLive.id),
      matchId: String(localLive.id),
      stage: localLive.stage,
      group: localLive.group || null,
      date: localLive.date,
      time: localLive.time,
      homeTeam: localLive.home,
      awayTeam: localLive.away,
      live: true,
      finished: false,
      timeElapsed: `~${elapsedMinuteFromSchedule(localLive)}`,
      source: 'matches.json'
    };
  }


  function battlePredictionOutcomeForSavedPair(pred) {
    return typeof predictionOutcome === 'function' ? predictionOutcome(pred) : '';
  }

  function battlePredictionScoreKeyForSavedPair(pred) {
    if (!pred) return '';
    return `${Number(pred.homeGoals)}-${Number(pred.awayGoals)}-${pred.winnerTeam || ''}`;
  }

  function savedLiveBattlePairScore(a, b, liveMatch, indexA, indexB) {
    const differentOutcome = battlePredictionOutcomeForSavedPair(a.pred) !== battlePredictionOutcomeForSavedPair(b.pred);
    const differentScore = battlePredictionScoreKeyForSavedPair(a.pred) !== battlePredictionScoreKeyForSavedPair(b.pred);
    const differentWinner = String(a.pred?.winnerTeam || '') !== String(b.pred?.winnerTeam || '');
    const rankGap = Math.abs(Number(a.row.rank || indexA) - Number(b.row.rank || indexB));
    const seed = Number(liveMatch?.id || 0);
    const rotation = ((indexA + 1) * 19 + (indexB + 1) * 29 + seed * 11) % 23;

    let score = 0;
    if (differentOutcome) score += 120;
    if (differentWinner) score += 80;
    if (differentScore) score += 45;
    score += Math.max(0, 35 - rankGap);
    score += rotation / 10;
    return score;
  }

  function buildSavedDiverseLiveBattlePairs(rows, liveMatch, limit = 10) {
    const candidates = rows
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((row, index) => {
        const player = playerByKey(row.participantKey || row.id);
        const pred = predictionFor(player, liveMatch.id);
        return player && pred ? { row, player, pred, index } : null;
      })
      .filter(Boolean);

    const allPairs = [];
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];
        allPairs.push({ a, b, score: savedLiveBattlePairScore(a, b, liveMatch, i, j) });
      }
    }

    allPairs.sort((x, y) => y.score - x.score);

    const selected = [];
    const usedPlayers = new Set();

    for (const pair of allPairs) {
      const keyA = String(pair.a.row.id);
      const keyB = String(pair.b.row.id);
      if (usedPlayers.has(keyA) || usedPlayers.has(keyB)) continue;
      selected.push(pair);
      usedPlayers.add(keyA);
      usedPlayers.add(keyB);
      if (selected.length >= limit) break;
    }

    if (selected.length < limit) {
      const usedPairKeys = new Set(selected.map(pair => [pair.a.row.id, pair.b.row.id].sort().join('|')));
      for (const pair of allPairs) {
        const pairKey = [pair.a.row.id, pair.b.row.id].sort().join('|');
        if (usedPairKeys.has(pairKey)) continue;
        selected.push(pair);
        usedPairKeys.add(pairKey);
        if (selected.length >= limit) break;
      }
    }

    return selected;
  }

  function liveBattleCandidates(rows, limit = 10, liveMatch = firstLiveMatchForBattles()) {
    if (!liveMatch) return [];

    const existing = ggamesBattleDocs
      .filter(b => String(b.matchId) === String(liveMatch.id))
      .sort((a, b) => Number(a.matchId) - Number(b.matchId));

    if (existing.length) return existing.slice(0, limit);

    const pairs = buildSavedDiverseLiveBattlePairs(rows, liveMatch, limit);
    return pairs.map((pair, index) => {
      const a = pair.a.row;
      const b = pair.b.row;
      const pA = pair.a.player;
      const pB = pair.b.player;
      return {
        id: `live_${String(liveMatch.id).padStart(3, '0')}_${index + 1}`,
        matchId: liveMatch.id,
        stage: liveMatch.stage,
        homeTeam: liveMatch.homeTeam,
        awayTeam: liveMatch.awayTeam,
        playerAKey: participantKeyOf(pA),
        playerAName: pA.participantName,
        playerARank: a.rank,
        playerBKey: participantKeyOf(pB),
        playerBName: pB.participantName,
        playerBRank: b.rank,
        status: 'live-preview',
        _contrast: battlePredictionOutcomeForSavedPair(pair.a.pred) !== battlePredictionOutcomeForSavedPair(pair.b.pred)
          ? 'Vencedores diferentes'
          : battlePredictionScoreKeyForSavedPair(pair.a.pred) !== battlePredictionScoreKeyForSavedPair(pair.b.pred)
            ? 'Resultados diferentes'
            : 'Duelo equilibrado'
      };
    });
  }


  function battleSnapshotPayload(battle, extra = {}) {
    const result = calculateBattleResult(battle);
    return {
      ...extra,
      status: result.status === 'finished' ? 'finished' : (extra.status || battle.status || 'live'),
      playerAFactors: result.playerAFactors ?? battle.playerAFactors ?? 0,
      playerBFactors: result.playerBFactors ?? battle.playerBFactors ?? 0,
      winnerKey: result.winnerKey || '',
      draw: !!result.draw,
      officialHomeGoals: result.officialHomeGoals ?? null,
      officialAwayGoals: result.officialAwayGoals ?? null,
      updatedAt: firebaseTools?.serverTimestamp ? firebaseTools.serverTimestamp() : new Date().toISOString()
    };
  }


  async function firestoreBattlesForMatch(matchId, limit = 12) {
    if (!firestoreDb || !firebaseTools || !matchId) return [];
    const existingLocal = ggamesBattleDocs
      .filter(b => String(b.matchId) === String(matchId))
      .sort((a, b) => Number(a.createdOrder || 0) - Number(b.createdOrder || 0));

    if (existingLocal.length) return existingLocal;

    // Procura primeiro pelos IDs determinísticos que o sistema usa para este jogo.
    const reads = [];
    for (let i = 1; i <= limit; i++) {
      reads.push(firebaseTools.getDoc(firebaseTools.doc(firestoreDb, LIVE_BATTLES_COLLECTION, battleDocId(matchId, i))));
    }

    try {
      const snaps = await Promise.all(reads);
      const docs = snaps
        .filter(snap => snap.exists())
        .map(snap => ({ id: snap.id, ...snap.data() }))
        .filter(doc => String(doc.matchId) === String(matchId))
        .sort((a, b) => Number(a.createdOrder || 0) - Number(b.createdOrder || 0));

      if (docs.length) {
        ggamesBattleDocs = [
          ...ggamesBattleDocs.filter(b => String(b.matchId) !== String(matchId)),
          ...docs
        ];
        window.ggamesBattleDocs = ggamesBattleDocs;
      }
      return docs;
    } catch (error) {
      console.warn('Não foi possível confirmar battles existentes no Firebase.', error);
      return existingLocal;
    }
  }

  async function battleMatchMarker(matchId) {
    if (!firestoreDb || !firebaseTools || !matchId) return null;
    try {
      const ref = firebaseTools.doc(firestoreDb, LIVE_BATTLE_MATCHES_COLLECTION, matchDocId(matchId));
      const snap = await firebaseTools.getDoc(ref);
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch {
      return null;
    }
  }

  async function markBattleMatchCreated(liveMatch, count = 0) {
    if (!firestoreDb || !firebaseTools || !liveMatch?.id) return;
    if (!liveMatch.finished && !canPersistLiveBattleMatch(liveMatch)) return;
    try {
      await firebaseTools.setDoc(
        firebaseTools.doc(firestoreDb, LIVE_BATTLE_MATCHES_COLLECTION, matchDocId(liveMatch.id)),
        {
          matchId: Number(liveMatch.id),
          matchDocId: matchDocId(liveMatch.id),
          status: liveMatch.finished ? 'finished' : 'live',
          battlesCreated: true,
          battlesCount: count,
          sourceCollection: LIVE_BATTLES_COLLECTION,
          stage: liveMatch.stage || localMatch(liveMatch.id)?.stage || '',
          group: liveMatch.group || localMatch(liveMatch.id)?.group || null,
          homeTeam: liveMatch.homeTeam || localMatch(liveMatch.id)?.home || '',
          awayTeam: liveMatch.awayTeam || localMatch(liveMatch.id)?.away || '',
          createdAt: firebaseTools.serverTimestamp(),
          updatedAt: firebaseTools.serverTimestamp()
        },
        { merge: true }
      );
    } catch (error) {
      console.warn('Não foi possível marcar o jogo como tendo battles criadas.', error);
    }
  }

  async function persistLiveBattlesForMatch(liveMatch, rows, limit = 8) {
    if (!firestoreDb || !firebaseTools || !canPersistLiveBattleMatch(liveMatch)) return [];

    // 1) Verificação local + Firestore por matchId/IDs determinísticos.
    // Se já existirem battles deste jogo, nunca cria novas.
    const existing = await firestoreBattlesForMatch(liveMatch.id, Math.max(limit, 12));
    if (existing.length) {
      await markBattleMatchCreated(liveMatch, existing.length);
      await finalizeBattlesIfMatchFinished(liveMatch, existing);
      return existing;
    }

    // 2) Verifica também o marcador do jogo. Se o jogo já foi marcado como criado
    // mas os docs ainda não carregaram, tenta recarregar uma vez e não duplica.
    const marker = await battleMatchMarker(liveMatch.id);
    if (marker?.battlesCreated) {
      await loadGgamesBattlesData();
      const afterReload = ggamesBattleDocs
        .filter(b => String(b.matchId) === String(liveMatch.id))
        .sort((a, b) => Number(a.createdOrder || 0) - Number(b.createdOrder || 0));
      if (afterReload.length) return afterReload;
      // Se o marcador existe mas não há docs, continua para autocorrigir criando os docs determinísticos.
    }

    const pairs = buildSavedDiverseLiveBattlePairs(rows, liveMatch, limit);
    if (!pairs.length) return [];

    const created = pairs.map((pair, index) => {
      const a = pair.a.row;
      const b = pair.b.row;
      const pA = pair.a.player;
      const pB = pair.b.player;
      const id = battleDocId(liveMatch.id, index + 1);
      return {
        id,
        matchDocId: matchDocId(liveMatch.id),
        matchId: Number(liveMatch.id),
        stage: liveMatch.stage || localMatch(liveMatch.id)?.stage || 'groups',
        group: liveMatch.group || localMatch(liveMatch.id)?.group || null,
        homeTeam: liveMatch.homeTeam || localMatch(liveMatch.id)?.home || '',
        awayTeam: liveMatch.awayTeam || localMatch(liveMatch.id)?.away || '',
        playerAKey: participantKeyOf(pA),
        playerAName: pA.participantName || pA.name || a.name || '',
        playerARank: a.rank || index + 1,
        playerBKey: participantKeyOf(pB),
        playerBName: pB.participantName || pB.name || b.name || '',
        playerBRank: b.rank || index + 2,
        status: 'live',
        createdOrder: index + 1,
        lockedAtKickoff: true,
        _contrast: battlePredictionOutcomeForSavedPair(pair.a.pred) !== battlePredictionOutcomeForSavedPair(pair.b.pred)
          ? 'Vencedores diferentes'
          : battlePredictionScoreKeyForSavedPair(pair.a.pred) !== battlePredictionScoreKeyForSavedPair(pair.b.pred)
            ? 'Resultados diferentes'
            : 'Duelo equilibrado',
        createdAt: firebaseTools.serverTimestamp(),
        updatedAt: firebaseTools.serverTimestamp()
      };
    });

    try {
      // IDs determinísticos + setDoc merge = mesmo que duas pessoas abram a app ao mesmo tempo,
      // ambas gravam nos mesmos documentos, sem criar duplicados.
      await Promise.all(created.map(battleDoc => {
        const { id, ...payload } = battleDoc;
        return firebaseTools.setDoc(
          firebaseTools.doc(firestoreDb, LIVE_BATTLES_COLLECTION, id),
          payload,
          { merge: true }
        );
      }));

      await markBattleMatchCreated(liveMatch, created.length);

      ggamesBattleDocs = [
        ...ggamesBattleDocs.filter(b => String(b.matchId) !== String(liveMatch.id)),
        ...created
      ];
      window.ggamesBattleDocs = ggamesBattleDocs;
      return created;
    } catch (error) {
      console.warn('Não foi possível gravar as battles live. A usar apenas nesta sessão.', error);
      return created;
    }
  }

  async function finalizeBattlesIfMatchFinished(match, battles) {
    if (!firestoreDb || !firebaseTools || !match?.finished) return;
    
    // Se o jogo terminou mas ainda não tem os golos oficiais na base de dados, não finaliza as battles ainda.
    if (match.homeGoals == null || match.awayGoals == null || match.homeGoals === '' || match.awayGoals === '') return;

    // Procura battles que ainda não estão finalizadas, OU que estão finalizadas mas com dados/golos desatualizados
    const toFinalize = (battles || []).filter(b => {
      if (b.status !== 'finished') return true;
      const diffGoals = (b.officialHomeGoals !== match.homeGoals) || (b.officialAwayGoals !== match.awayGoals);
      return diffGoals;
    });

    if (!toFinalize.length) return;

    try {
      await Promise.all(toFinalize.map(battle => {
        const payload = battleSnapshotPayload(battle, {
          status: 'finished',
          finishedAt: firebaseTools.serverTimestamp()
        });
        return firebaseTools.setDoc(
          firebaseTools.doc(firestoreDb, LIVE_BATTLES_COLLECTION, battle.id),
          payload,
          { merge: true }
        );
      }));
      toFinalize.forEach(b => {
        const result = calculateBattleResult(b);
        Object.assign(b, {
          status: 'finished',
          playerAFactors: result.playerAFactors,
          playerBFactors: result.playerBFactors,
          winnerKey: result.winnerKey || '',
          draw: !!result.draw,
          officialHomeGoals: result.officialHomeGoals ?? null,
          officialAwayGoals: result.officialAwayGoals ?? null
        });
      });
      await markBattleMatchCreated({ ...match, finished: true }, battles?.length || toFinalize.length);
    } catch (error) {
      console.warn('Não foi possível finalizar battles no Firebase.', error);
    }
  }

  async function ensurePersistedBattlesForCurrentLiveMatch(rows, limit = 8) {
    const liveMatches = liveMatchesForBattles();
    if (!liveMatches.length) return [];
    const persisted = await Promise.all(liveMatches.map(liveMatch => persistLiveBattlesForMatch(liveMatch, rows, limit)));
    return persisted.flat();
  }


  function persistLiveBattlesOnce(liveMatch, rows, limit = 8) {
    if (!liveMatch?.id) return Promise.resolve([]);
    const key = String(liveMatch.id);
    if (liveBattlePersistInFlight.has(key)) return Promise.resolve([]);
    liveBattlePersistInFlight.add(key);

    return persistLiveBattlesForMatch(liveMatch, rows, limit)
      .finally(() => liveBattlePersistInFlight.delete(key));
  }


  function savedBattlesForMainView() {
    const now = new Date();
    const liveIds = currentLiveMatchIds();

    if (liveIds.size) {
      return ggamesBattleDocs
        .filter(b => liveIds.has(String(b.matchId)))
        .sort((a, b) => (Number(a.matchId) - Number(b.matchId)) || (Number(a.createdOrder || 0) - Number(b.createdOrder || 0)))
        .slice(0, 12);
    }

    // Se não há jogo em LIVE, mostrar as battles do jogo imediatamente anterior ao próximo jogo futuro
    const source = (worldCupApi?.games && worldCupApi.games.length)
      ? worldCupApi.games
      : (data?.matches || []).map(m => ({...m, id: String(m.id), homeTeam: m.home, awayTeam: m.away, homeGoals: null, awayGoals: null, finished: false, live: false}));
    const futureMatches = source.filter(g => !g.finished && !g.live && getMatchDateObj({ date: g.date, time: g.time }) >= now);

    if (futureMatches.length) {
      const nextFuture = futureMatches[0];
      const nextStage = nextFuture.stage || localMatch(nextFuture.id)?.stage || '';
      const nextMatchId = Number(nextFuture.id);

      if (BATTLE_KO_STAGES.includes(nextStage)) {
        const nextBattles = ggamesBattleDocs.filter(b => Number(b.matchId) === nextMatchId);
        if (nextBattles.length) {
          return nextBattles
            .sort((a, b) => Number(a.createdOrder || 0) - Number(b.createdOrder || 0))
            .slice(0, 12);
        }
      } else {
        const prevMatchesBattles = ggamesBattleDocs.filter(b => Number(b.matchId) < nextMatchId);
        if (prevMatchesBattles.length) {
          const maxPrevMatchId = Math.max(...prevMatchesBattles.map(b => Number(b.matchId)));
          return ggamesBattleDocs
            .filter(b => Number(b.matchId) === maxPrevMatchId)
            .sort((a, b) => Number(a.createdOrder || 0) - Number(b.createdOrder || 0))
            .slice(0, 12);
        }
      }
    }

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
    const liveCtx = battleLiveContext(battle);
    const leadA = liveCtx.live && result.playerAFactors > result.playerBFactors;
    const leadB = liveCtx.live && result.playerBFactors > result.playerAFactors;
    const isWinnerA = result.status === 'finished' && result.winnerKey === battle.playerAKey;
    const isWinnerB = result.status === 'finished' && result.winnerKey === battle.playerBKey;
    const status = result.status === 'finished'
      ? `Resultado Battle: ${result.playerAFactors}-${result.playerBFactors}${result.draw ? ' · empate' : result.winnerKey === battle.playerAKey ? ` · vence ${escapeHtml(battle.playerAName)}` : ` · vence ${escapeHtml(battle.playerBName)}`}`
      : liveCtx.live
        ? `Battle live · fatores agora: ${result.playerAFactors}-${result.playerBFactors}${result.draw ? ' · empate' : result.playerAFactors > result.playerBFactors ? ` · na frente ${escapeHtml(battle.playerAName)}` : result.playerBFactors > result.playerAFactors ? ` · na frente ${escapeHtml(battle.playerBName)}` : ''}`
        : canPick ? 'Clica para escolher marcador da Battle' : 'Battle pendente';

    return `
      <div class="battle-card live-battle battle-card-horizontal battle-card-clickable ${liveCtx.live ? 'battle-card-is-live' : ''}" data-battle-id="${escapeHtml(battle.id)}">
        <span class="battle-match">Jogo ${escapeHtml(battle.matchId)} · ${escapeHtml(match?.home || battle.homeTeam || '')} vs ${escapeHtml(match?.away || battle.awayTeam || '')}${battle._contrast ? ` <em class="battle-contrast-chip">${escapeHtml(battle._contrast)}</em>` : ''}</span>
        <div class="battle-duel-row">
          <div class="battle-player battle-player-a ${leadA ? 'battle-player-leading' : ''}">
            <strong>${renderParticipantIdentity(`#${escapeHtml(battle.playerARank || '')} ${battle.playerAName || pA.participantName}`, pA.icon || pA.participantIcon || pA.playerIcon || '', 'participant-ident--compact')}${(leadA || isWinnerA) ? ' <span style="font-size:1rem; margin-left:4px;">👑</span>' : ''}</strong>
            <span>${predictionResultText(predA)}</span>
            ${pickA ? `<small>Marcador: ${escapeHtml(pickA.pickedPlayerName)}</small>` : ''}
            ${leadA && liveCtx.live ? '<div class="battle-fans" aria-hidden="true"><span>🙌</span><span>⚑</span><span>🙌</span><span>⚑</span><span>🙌</span></div>' : ''}
          </div>
          <b class="battle-versus">VS</b>
          <div class="battle-player battle-player-b ${leadB ? 'battle-player-leading' : ''}">
            <strong>${renderParticipantIdentity(`#${escapeHtml(battle.playerBRank || '')} ${battle.playerBName || pB.participantName}`, pB.icon || pB.participantIcon || pB.playerIcon || '', 'participant-ident--compact')}${(leadB || isWinnerB) ? ' <span style="font-size:1rem; margin-left:4px;">👑</span>' : ''}</strong>
            <span>${predictionResultText(predB)}</span>
            ${pickB ? `<small>Marcador: ${escapeHtml(pickB.pickedPlayerName)}</small>` : ''}
            ${leadB && liveCtx.live ? '<div class="battle-fans" aria-hidden="true"><span>🙌</span><span>⚑</span><span>🙌</span><span>⚑</span><span>🙌</span></div>' : ''}
          </div>
        </div>
        <p class="${result.status === 'finished' ? 'battle-result-line' : 'battle-state'}">${status}</p>
      </div>
    `;
  }

  function generatedFallbackBattles(rows) {
    const liveMatch = (worldCupApi?.games || []).find(game => game.live && !game.finished && game.id);
    const now = new Date();
    const source = (worldCupApi?.games && worldCupApi.games.length)
      ? worldCupApi.games
      : (data?.matches || []).map(m => ({...m, id: String(m.id), homeTeam: m.home, awayTeam: m.away, homeGoals: null, awayGoals: null, finished: false, live: false}));
    const futureMatches = source.filter(g => !g.finished && !g.live && getMatchDateObj({ date: g.date, time: g.time }) >= now);
    if (!liveMatch && !futureMatches.length) return [];
    const nextGame = futureMatches[0];
    const match = liveMatch
      ? { id: liveMatch.id, stage: liveMatch.stage, home: liveMatch.homeTeam, away: liveMatch.awayTeam }
      : { id: nextGame.id, stage: nextGame.stage, home: nextGame.homeTeam || nextGame.home, away: nextGame.awayTeam || nextGame.away };
    const sorted = rows.slice().sort((a, b) => a.rank - b.rank);
    const battles = [];
    for (let i = 0; i < sorted.length - 1; i += 2) {
      const a = sorted[i], b = sorted[i + 1];
      const pA = playerByKey(a.id);
      const pB = playerByKey(b.id);
      if (!pA || !pB) continue;
      const predA = predictionFor(pA, match.id);
      const predB = predictionFor(pB, match.id);
      if (!predA || !predB) continue;
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

    const liveMatches = liveMatchesForBattles();
    if (liveMatches.length) {
      const saved = savedBattlesForMainView();
      if (saved.length) {
        liveMatches.forEach(liveMatch => {
          const matchBattles = saved.filter(b => String(b.matchId) === String(liveMatch.id));
          if (matchBattles.length) finalizeBattlesIfMatchFinished(liveMatch, matchBattles);
        });
        return saved.slice(0, 10).map(b => renderBattleCard(b, true)).join('');
      }
      const temp = liveMatches.flatMap(liveMatch => liveBattleCandidates(rows, 10, liveMatch)).slice(0, 10);
      Promise.all(liveMatches.map(liveMatch => persistLiveBattlesOnce(liveMatch, rows, 10))).then(createdSets => {
        if (createdSets.some(created => created?.length)) loadGgamesBattlesData().then(() => refreshLiveDashboardView());
      });
      return temp.length
        ? temp.slice(0, 10).map(b => renderBattleCard(b, true)).join('')
        : '<p class="modal-muted">Este jogo está em direto, mas ainda não há prognósticos suficientes para criar battles live.</p>';
    }

    const battles = savedBattlesForMainView();
    const display = battles.length ? battles : generatedFallbackBattles(rows);
    return display.length
      ? display.slice(0, 10).map(b => renderBattleCard(b, true)).join('')
      : '<p class="modal-muted">Ainda não há battles geradas.</p>';
  };

  renderGiriaBattles = function(rows) {
    const liveMatches = liveMatchesForBattles();
    const saved = savedBattlesForMainView();

    if (liveMatches.length) {
      if (saved.length) {
        liveMatches.forEach(liveMatch => {
          const matchBattles = saved.filter(b => String(b.matchId) === String(liveMatch.id));
          if (matchBattles.length) finalizeBattlesIfMatchFinished(liveMatch, matchBattles);
        });
        return saved.slice(0, 8).map(b => renderBattleCard(b, true)).join('');
      }

      // Primeira entrada do jogo live: cria e grava no Firebase.
      // Até a gravação terminar, mostra os mesmos pares que serão gravados.
      const temp = liveMatches.flatMap(liveMatch => liveBattleCandidates(rows, 8, liveMatch)).slice(0, 8);
      Promise.all(liveMatches.map(liveMatch => persistLiveBattlesOnce(liveMatch, rows, 8))).then(createdSets => {
        if (createdSets.some(created => created?.length)) {
          loadGgamesBattlesData().then(() => refreshLiveDashboardView());
        }
      });
      return temp.length
        ? temp.slice(0, 8).map(b => renderBattleCard(b, true)).join('')
        : '<p class="modal-muted">Este jogo está em direto, mas ainda não há prognósticos suficientes para criar battles live.</p>';
    }

    const display = saved.length ? saved : generatedFallbackBattles(rows);
    return display.length
      ? display.slice(0, 8).map(b => renderBattleCard(b, true)).join('')
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
      openModal('<h2>Battle</h2><p class="modal-muted">Esta Battle ainda não está pronta. Tenta novamente mais tarde.</p>');
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
        body.innerHTML = '<p class="error-text">Este participante ainda não está preparado para escolher marcador. Fala com o organizador.</p>';
        return;
      }

      const homeTeam = match?.home || battle.homeTeam;
      const awayTeam = match?.away || battle.awayTeam;

      // Inject style for scorer selection
      const styleId = 'ggames-battle-scorer-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .battle-scorer-countries-lines {
            margin-top: 15px;
          }
          .battle-scorer-country-line-btn {
            display: flex;
            align-items: center;
            gap: 15px;
            width: 100%;
            padding: 14px 20px;
            margin-bottom: 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            color: #fff;
            font-size: 1.1rem;
            font-weight: 600;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .battle-scorer-country-line-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
          }
          .battle-scorer-flag {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid rgba(255, 255, 255, 0.2);
          }
          .battle-scorer-player-popup-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(2, 8, 23, 0.85);
            backdrop-filter: blur(8px);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            animation: ggamesFadeIn 0.2s ease-out;
          }
          .battle-scorer-player-popup-content {
            background: linear-gradient(135deg, #071a3f 0%, #020817 100%);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            width: 100%;
            max-width: 500px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            animation: ggamesSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .battle-scorer-player-popup-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }
          .battle-scorer-player-popup-header h3 {
            margin: 0;
            flex-grow: 1;
            font-size: 1.2rem;
            color: #fff;
          }
          .battle-scorer-popup-close {
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 1.8rem;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            transition: color 0.2s;
          }
          .battle-scorer-popup-close:hover {
            color: #fff;
          }
          .battle-scorer-player-popup-body {
            padding: 20px;
            overflow-y: auto;
            flex-grow: 1;
          }
          .battle-scorer-player-popup-footer {
            padding: 16px 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            justify-content: flex-end;
          }
          @keyframes ggamesFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes ggamesSlideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }

      body.innerHTML = `
        <div class="battle-scorer-countries-lines">
          <button type="button" class="battle-scorer-country-line-btn" data-team="${escapeHtml(homeTeam)}">
            <img src="${escapeHtml(getTeamFlagUrl(homeTeam))}" alt="" class="battle-scorer-flag">
            <span>${escapeHtml(homeTeam)}</span>
          </button>
          <button type="button" class="battle-scorer-country-line-btn" data-team="${escapeHtml(awayTeam)}">
            <img src="${escapeHtml(getTeamFlagUrl(awayTeam))}" alt="" class="battle-scorer-flag">
            <span>${escapeHtml(awayTeam)}</span>
          </button>
        </div>
      `;

      body.querySelectorAll('.battle-scorer-country-line-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const teamName = btn.dataset.team;

          // Remove existing popup if any
          document.getElementById('battleScorerPlayerPopup')?.remove();

          const popupHtml = `
            <div id="battleScorerPlayerPopup" class="battle-scorer-player-popup-overlay">
              <div class="battle-scorer-player-popup-content">
                <div class="battle-scorer-player-popup-header">
                  <img src="${escapeHtml(getTeamFlagUrl(teamName))}" class="battle-scorer-flag" alt="">
                  <h3>Jogadores de ${escapeHtml(teamName)}</h3>
                  <button type="button" class="battle-scorer-popup-close" id="closeScorerPlayerPopup">&times;</button>
                </div>
                <div class="battle-scorer-player-popup-body">
                  ${renderScorerPlayers(teamName)}
                </div>
                <div class="battle-scorer-player-popup-footer">
                  <button id="battleScorerSave" type="button" class="primary">Gravar escolha</button>
                </div>
              </div>
            </div>
          `;
          document.body.insertAdjacentHTML('beforeend', popupHtml);

          const closePopup = () => {
            document.getElementById('battleScorerPlayerPopup')?.remove();
          };

          document.getElementById('closeScorerPlayerPopup')?.addEventListener('click', closePopup);
          document.getElementById('battleScorerPlayerPopup')?.addEventListener('click', (e) => {
            if (e.target.id === 'battleScorerPlayerPopup') closePopup();
          });

          document.getElementById('battleScorerSave')?.addEventListener('click', async () => {
            const selected = document.querySelector('input[name="battleScorerPick"]:checked');
            if (!selected) {
              alert('Escolhe um jogador antes de gravar.');
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
              closePopup();
              body.innerHTML = `<p class="success-text">Marcador gravado: <strong>${escapeHtml(pickedPlayerName)}</strong>.</p>`;
              refreshLiveDashboardView();
            } catch (error) {
              alert(`Não foi possível gravar: ${error.message}`);
            }
          });
        });
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


  window.ensurePersistedBattlesForCurrentLiveMatch = ensurePersistedBattlesForCurrentLiveMatch;
  window.finalizeBattlesIfMatchFinished = finalizeBattlesIfMatchFinished;

  window.ggamesShowBwBonus = localStorage.getItem('ggames_show_bw_bonus') !== 'false';
  window.ggamesShowPp = localStorage.getItem('ggames_show_pp') !== 'false';

  document.addEventListener('change', event => {
    if (event.target && event.target.id === 'ggamesBwToggle') {
      window.ggamesShowBwBonus = event.target.checked;
      localStorage.setItem('ggames_show_bw_bonus', event.target.checked ? 'true' : 'false');
      
      if (typeof refreshLiveDashboardView === 'function') {
        refreshLiveDashboardView();
      }
      
      const viewerBody = document.querySelector('#viewerBody');
      if (viewerBody && document.querySelector('.viewer-tab[data-view-tab="table"].active')) {
        viewerBody.innerHTML = renderGgamesTable();
      }
    } else if (event.target && event.target.id === 'ggamesPpToggle') {
      window.ggamesShowPp = event.target.checked;
      localStorage.setItem('ggames_show_pp', event.target.checked ? 'true' : 'false');
      
      if (typeof refreshLiveDashboardView === 'function') {
        refreshLiveDashboardView();
      }
      
      const viewerBody = document.querySelector('#viewerBody');
      if (viewerBody && document.querySelector('.viewer-tab[data-view-tab="table"].active')) {
        viewerBody.innerHTML = renderGgamesTable();
      }
    }
  });

  document.body.addEventListener('click', event => {
    const battleCard = event.target.closest('[data-battle-id]');
    if (!battleCard) return;
    if (event.target.closest('[data-live-player]')) return;
    event.stopPropagation();
    openBattleScorerModal(battleCard.dataset.battleId);
  });
})();
