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

  const SECTION2_COLLECTION = 'worldcupextraReforms';
  const baseLoadPublicPredictions = loadPublicPredictions;
  loadPublicPredictions = async function() {
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
      console.warn('Não foi possível carregar worldcupextraReforms.', error);
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

/* Secção 2 aprovada — janelas Firebase + dropdown de participante + PIN + gravação em worldcupextraReforms */
(function approvedReformWindowsWithPin() {
  const REFORM_COLLECTION = 'worldcupextraReforms';
  const REFORM_SETTINGS_COLLECTION = 'settings';
  const REFORM_SETTINGS_DOC = 'worldcupReformWindows';
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

  function matchKickoffLocal(match) {
    return new Date(`${match.date}T${match.time || '12:00'}:00`);
  }

  function sameMatchupAnySideLocal(pred, official) {
    const a = [teamKeyLocal(pred?.homeTeam), teamKeyLocal(pred?.awayTeam)].sort().join('|');
    const b = [teamKeyLocal(official?.homeTeam), teamKeyLocal(official?.awayTeam)].sort().join('|');
    return a && a === b;
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
    return !!open && !!close && now >= open && now <= close;
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
      console.warn('Não foi possível carregar settings/worldcupReformWindows.', error);
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

  function resolveOfficialPreviousLocal(label) {
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
          <p>Cria/atualiza o documento <strong>settings/worldcupReformWindows</strong> com a janela da fase que queres abrir.</p>
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

    return `
      <div class="modal-head">
        <div>
          <p class="eyebrow small">Secção 2 — PIN validado</p>
          <h2>${escapeHtml(item.participantName || 'Participante')}</h2>
          <p class="modal-muted">Reformula apenas os jogos da fase aberta. A Secção 1 fica guardada intacta.</p>
        </div>
      </div>
      <section class="reform-box">
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
    const unresolved = /Grupo|Vencedor Jogo|Perdedor Jogo/.test(`${home} ${away}`);
    const open = isStageWindowOpen(match.stage) && !unresolved && new Date() < matchKickoffLocal(match);
    const initialPred = (item.matches || []).find(row => Number(row.id) === Number(match.id));
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
    openModal('<h2>Reformular prognósticos</h2><p class="modal-muted">A carregar jogadores, PIN e janelas...</p>');
    await Promise.allSettled([
      loadApiWorldCupData({ sync: false }),
      loadPublicPredictions(),
      loadReformWindows(true),
      loadReformsCache()
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
      openModal(renderReformLogin('Este participante ainda não tem PIN no documento do Firebase.'));
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
    if (/Grupo|Vencedor Jogo|Perdedor Jogo/.test(`${homeTeam} ${awayTeam}`)) {
      alert('Ainda falta definir oficialmente as seleções deste jogo.');
      return;
    }

    const participantKey = getParticipantKey(item);
    const initialPred = (item.matches || []).find(row => Number(row.id) === Number(match.id));
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
      if (msg) msg.textContent = 'Não foi possível gravar. Confirma as regras do Firebase.';
      alert('Não foi possível gravar a reformulação. Confirma as regras do Firebase.');
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

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => loadReformWindows(true), 600);
  });
})();
