/* Secção 2 — reformulação de prognósticos a partir dos 16 avos.
   Este ficheiro é carregado depois do script principal e reaproveita os dados/funções já existentes. */
(() => {
  const KO_STAGES = ['round32', 'round16', 'quarterfinals', 'semifinals', 'third_place', 'final'];
  const SECTION2_STATUS = 'section2';
  const SECTION2_TYPE = 'knockoutRevision';
  const SECTION2_NAME_KEY = 'worldcup2026_section2_name';
  let section2Docs = [];
  let section2ActiveStage = 'round32';

  const normalizeKey = (name) => normalizeParticipantName(name || '');
  const teamKey = (name) => String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

  const matchKickoff = (match) => new Date(`${match.date}T${match.time || '12:00'}:00`);
  const stageStart = (stage) => {
    const matches = data?.matches?.filter(m => m.stage === stage) || [];
    if (!matches.length) return null;
    return matches.map(matchKickoff).sort((a, b) => a - b)[0];
  };
  const hasStageStarted = (stage) => {
    const start = stageStart(stage);
    return !!start && new Date() >= start;
  };
  const matchStillOpen = (match) => !getOfficialResult(match.id) && new Date() < matchKickoff(match);

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
    const used = new Set();
    const assignments = {};
    const bestThirds = qualified.bestThirds || [];
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
    return getSection2Doc(key, matchId);
  }

  function sameTeamsSameSides(pred, official) {
    return teamKey(pred?.homeTeam) === teamKey(official?.homeTeam) && teamKey(pred?.awayTeam) === teamKey(official?.awayTeam);
  }

  function sameMatchupAnySide(pred, official) {
    const a = [teamKey(pred?.homeTeam), teamKey(pred?.awayTeam)].sort().join('|');
    const b = [teamKey(official?.homeTeam), teamKey(official?.awayTeam)].sort().join('|');
    return a && a === b;
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

  function predictedWinnerTeam(pred) {
    if (!pred) return '';
    if (pred.winnerTeam) return pred.winnerTeam;
    const ph = Number(pred.homeGoals);
    const pa = Number(pred.awayGoals);
    if (ph > pa) return pred.homeTeam;
    if (pa > ph) return pred.awayTeam;
    return 'Empate';
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
    const exact = sidesOk && ph === oh && pa === oa;
    const winnerHit = teamKey(predictedWinnerTeam(pred)) === teamKey(officialWinnerTeam(official));
    const group = stage === 'groups';
    const final = stage === 'final';

    let points = 0;
    if (exact) points = group ? 3 : final ? 8 : 6;
    else if (final && winnerHit) points = 4;
    else if (group) points = sidesOk && predictionOutcome(pred) === actualOutcome(official) ? 1 : 0;
    else points = winnerHit ? 2 : 0;

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
    const exact = ph === oh && pa === oa;
    const matchupBonus = sameMatchupAnySide(initialPred, official) ? (final ? 4 : 2) : 0;
    const resultPoints = exact ? (final ? 3 : 2) : 0;
    const points = matchupBonus + resultPoints;
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
    if (!override || override.mode === 'replicate') return scoreInitialPrediction(pred, official);
    return scoreSection2Changed(pred, override, official);
  };

  const baseLoadPublicPredictions = loadPublicPredictions;
  loadPublicPredictions = async function() {
    await baseLoadPublicPredictions();
    const collectionRef = firebaseTools.collection(firestoreDb, FIREBASE_COLLECTION);
    const snapshot = await firebaseTools.getDocs(collectionRef);
    const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    section2Docs = allDocs.filter(doc => doc.status === SECTION2_STATUS || doc.type === SECTION2_TYPE);
    return publicPredictions;
  };

  calculateGgamesTable = function() {
    const rows = publicPredictions.map(item => {
      const stats = {
        id: item.id,
        participantKey: item.participantKey || normalizeKey(item.participantName),
        name: item.participantName || 'Participante',
        points: 0,
        correctPredictions: 0,
        failedPredictions: 0,
        goalsHit: 0,
        goalsMissed: 0,
        winsHit: 0,
        drawsHit: 0,
        lossesHit: 0,
        exactResults: 0
      };
      (item.matches || []).forEach(pred => {
        const official = getOfficialResult(pred.id);
        if (!official) return;
        const override = getSection2DocForPlayer(item, pred.id);
        const score = scoreOnePrediction(pred, official, override);
        stats.points += score.points;
        stats.correctPredictions += score.points > 0 ? 1 : 0;
        stats.failedPredictions += score.points === 0 ? 1 : 0;
        stats.goalsHit += score.goalsHit;
        stats.goalsMissed += score.goalsMissed;
        stats.winsHit += score.winHit;
        stats.drawsHit += score.drawHit;
        stats.lossesHit += score.lossHit;
        stats.exactResults += score.exact ? 1 : 0;
      });
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

  renderPublicByGame = function(stage = publicViewerStage, filter = publicGameFilter) {
    const now = new Date();
    const stageMatches = data.matches.filter(match => match.stage === stage).filter(match => {
      const official = getOfficialResult(match.id);
      const matchDate = getMatchDateObj(match);
      if (filter === 'played') return !!official;
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
          })).filter(row => row.match);
          return `
            <section class="viewer-game-card">
              <div class="viewer-game-head">
                <div>
                  <h3>Jogo ${match.id} · ${escapeHtml(STAGE_LABELS[match.stage])}</h3>
                  <p class="modal-muted">${escapeHtml(officialHome)} vs ${escapeHtml(officialAway)} · ${escapeHtml(match.date)} ${escapeHtml(match.time || '')}</p>
                </div>
                ${official ? `<strong class="official-chip">Oficial: ${escapeHtml(official.homeTeam || match.home)} ${official.homeGoals}-${official.awayGoals} ${escapeHtml(official.awayTeam || match.away)}</strong>` : '<span class="future-chip">Ainda por jogar</span>'}
              </div>
              <div class="viewer-picks">
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
      </div>
      <div id="viewerBody">
        ${active === 'players' ? renderPublicPlayerList() : active === 'table' ? renderGgamesTable() : renderPublicByGame(publicViewerStage, publicGameFilter)}
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

  openPublicPredictionsModal = async function() {
    if (isVotingClosed()) {
      await openLiveResultsModal();
      return;
    }
    openModal('<h2>Outros jogadores</h2><p class="modal-muted">A carregar prognósticos...</p>');
    try {
      await loadPublicPredictions();
      openModal(renderPublicViewer('games'));
    } catch (error) {
      console.error(error);
      openModal('<h2>Outros jogadores</h2><p class="modal-muted">Não foi possível carregar os prognósticos. Confirma as permissões de leitura.</p>');
    }
  };

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

/*
  CORREÇÃO FINAL DO MODO PÓS-VOTAÇÃO
  - A Central Ggames fica no site principal.
  - O botão "Vê prognósticos de outros jogadores" abre apenas o popup de consulta antiga/detalhada.
  - Evita que fase2.js volte a abrir a Central dentro do popup.
*/
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
    openPublicPredictionsModal = async function() {
      if (typeof openModal === 'function') {
        openModal('<h2>Outros jogadores</h2><p class="modal-muted">A carregar prognósticos...</p>');
      }

      try {
        await Promise.allSettled([
          typeof loadApiWorldCupData === 'function' ? loadApiWorldCupData({ sync: false }) : Promise.resolve(),
          typeof loadPublicPredictions === 'function' ? loadPublicPredictions() : Promise.resolve()
        ]);

        if (typeof openModal === 'function' && typeof renderPublicViewer === 'function') {
          openModal(renderPublicViewer('games'));
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
