const sofa$ = (selector) => document.querySelector(selector);
const sofaEscape = (text) => String(text ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#039;',
  '"': '&quot;'
}[char]));

let sofaDb = null;
let sofaAuth = null;
let sofaTools = null;
let sofaCurrentUser = null;
let sofaMatches = [];
let sofaDocs = {};
let sofaSquads = {};
let sofaFilters = { stage: 'all', group: 'all', q: '' };

function sofaMatchDocId(matchId) {
  return `match_${String(matchId).padStart(3, '0')}`;
}

function sofaStageLabel(stage) {
  return SOFA_STAGE_LABELS[stage] || stage || 'Sem fase';
}

function sofaStoredMatch(matchId) {
  return sofaDocs[String(matchId)] || {};
}

function sofaGoalId() {
  return `goal_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sofaNormalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sofaNormalizeGoals(goals) {
  return Array.isArray(goals)
    ? goals.map((goal) => ({
        id: goal.id || sofaGoalId(),
        minute: goal.minute == null ? '' : String(goal.minute),
        player: goal.ownGoal ? 'Autogolo' : String(goal.player || ''),
        ownGoal: goal.ownGoal === true || String(goal.type || '').toLowerCase() === 'own-goal'
      }))
    : [];
}

function sofaNormalizeMinute(value) {
  const text = String(value || '').trim().replace(/\s+/g, '');
  if (!text) return '';
  const match = text.match(/^(\d{1,3})(?:\+(\d{1,2}))?$/);
  if (!match) return text;
  const base = Math.max(1, Math.min(130, Number(match[1])));
  const added = match[2] == null ? '' : `+${Math.max(0, Math.min(30, Number(match[2])))}`;
  return `${base}${added}`;
}

async function sofaLoadSchedule() {
  const response = await fetch('matches.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`matches.json ${response.status}`);
  const payload = await response.json();
  sofaMatches = Array.isArray(payload.matches) ? payload.matches : [];
}

async function sofaLoadSquads() {
  try {
    const response = await fetch('squads.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`squads.json ${response.status}`);
    const payload = await response.json();
    sofaSquads = payload.teams || {};
  } catch (error) {
    sofaSquads = {};
    console.warn('Nao foi possivel carregar squads.json.', error);
  }
}

function sofaPlayersForTeam(teamName) {
  const wanted = sofaNormalizeText(teamName);
  const entry = Object.values(sofaSquads).find((team) => {
    return [team?.name, team?.officialName, team?.code].some((value) => sofaNormalizeText(value) === wanted);
  });
  return (entry?.players || [])
    .map((player) => player.shirtName || player.name || player.officialPlayerName)
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b), 'pt-PT'));
}

async function sofaInitFirebase() {
  const appModule = await import(`https://www.gstatic.com/firebasejs/${SOFA_FIREBASE_SDK_VERSION}/firebase-app.js`);
  const authModule = await import(`https://www.gstatic.com/firebasejs/${SOFA_FIREBASE_SDK_VERSION}/firebase-auth.js`);
  const firestoreModule = await import(`https://www.gstatic.com/firebasejs/${SOFA_FIREBASE_SDK_VERSION}/firebase-firestore.js`);
  const app = appModule.initializeApp(SOFA_FIREBASE_CONFIG);
  sofaAuth = authModule.getAuth(app);
  sofaDb = firestoreModule.getFirestore(app);
  sofaTools = {
    collection: firestoreModule.collection,
    doc: firestoreModule.doc,
    getDoc: firestoreModule.getDoc,
    getDocs: firestoreModule.getDocs,
    setDoc: firestoreModule.setDoc,
    serverTimestamp: firestoreModule.serverTimestamp,
    signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
    signOut: authModule.signOut,
    onAuthStateChanged: authModule.onAuthStateChanged
  };
  sofaTools.onAuthStateChanged(sofaAuth, sofaHandleAuthState);
}

async function sofaHandleAuthState(user) {
  sofaCurrentUser = user;
  if (!user) {
    sofa$('#authStatus').textContent = 'Inicia sessao para continuar.';
    sofa$('#loginArea').hidden = false;
    sofa$('#appArea').hidden = true;
    sofa$('#logoutBtn').hidden = true;
    return;
  }

  sofa$('#authStatus').textContent = 'A confirmar permissoes...';
  const userSnap = await sofaTools.getDoc(sofaTools.doc(sofaDb, 'users', user.uid));
  const estatuto = userSnap.exists() ? userSnap.data().estatuto : '';
  if (estatuto !== 'ruler') {
    sofa$('#authStatus').textContent = 'Esta conta nao tem permissao ruler.';
    sofa$('#loginArea').hidden = false;
    sofa$('#appArea').hidden = true;
    sofa$('#logoutBtn').hidden = false;
    return;
  }

  sofa$('#loginArea').hidden = true;
  sofa$('#appArea').hidden = false;
  sofa$('#logoutBtn').hidden = false;
  await sofaLoadStoredDocs();
  sofaRenderFilters();
  sofaRenderMatches();
}

async function sofaLoadStoredDocs() {
  try {
    const snap = await sofaTools.getDocs(sofaTools.collection(sofaDb, SOFA_COLLECTION));
    sofaDocs = Object.fromEntries(
      snap.docs.map((docSnap) => {
        const row = { id: docSnap.id, ...docSnap.data() };
        const matchId = String(row.matchId ?? String(docSnap.id).replace(/^match_/, ''));
        return [matchId, row];
      })
    );
  } catch (error) {
    sofaDocs = {};
    console.warn('Nao foi possivel ler worldcupSofa. Confirma as regras Firebase.', error);
    sofa$('#authStatus').textContent = 'Login feito, mas falta permissao para ler worldcupSofa.';
  }
}

function sofaRenderFilters() {
  const stages = ['all', ...Object.keys(SOFA_STAGE_LABELS)];
  sofa$('#stageFilter').innerHTML = stages
    .map((stage) => `<option value="${sofaEscape(stage)}">${stage === 'all' ? 'Todas' : sofaEscape(sofaStageLabel(stage))}</option>`)
    .join('');

  const groups = ['all', ...new Set(sofaMatches.map((match) => match.group).filter(Boolean))].sort((a, b) => {
    if (a === 'all') return -1;
    if (b === 'all') return 1;
    return String(a).localeCompare(String(b), 'pt-PT');
  });
  sofa$('#groupFilter').innerHTML = groups
    .map((group) => `<option value="${sofaEscape(group)}">${group === 'all' ? 'Todos' : `Grupo ${sofaEscape(group)}`}</option>`)
    .join('');
}

function sofaFilteredMatches() {
  const q = sofaFilters.q.toLowerCase();
  return sofaMatches.filter((match) => {
    if (sofaFilters.stage !== 'all' && match.stage !== sofaFilters.stage) return false;
    if (sofaFilters.group !== 'all' && match.group !== sofaFilters.group) return false;
    if (!q) return true;
    const haystack = [
      match.id,
      match.home,
      match.away,
      match.venue,
      match.city,
      match.country,
      match.date,
      match.time
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

function sofaRenderPlayerOptions(match, side) {
  const team = side === 'home' ? match.home : match.away;
  const players = sofaPlayersForTeam(team);
  const optionValues = ['Autogolo', ...players];
  return `
    <datalist id="players_${sofaEscape(match.id)}_${side}">
      ${optionValues.map((name) => `<option value="${sofaEscape(name)}"></option>`).join('')}
    </datalist>
  `;
}

function sofaRenderGoalRows(match, side, goals) {
  const rows = sofaNormalizeGoals(goals);
  if (!rows.length) {
    return `<div class="goal-list" data-goal-list="${side}"></div>`;
  }
  return `
    <div class="goal-list" data-goal-list="${side}">
      ${rows.map((goal) => sofaRenderGoalRow(match, side, goal)).join('')}
    </div>
  `;
}

function sofaRenderGoalRow(match, side, goal = {}) {
  const playerValue = goal.ownGoal ? 'Autogolo' : (goal.player || '');
  return `
    <div class="goal-row" data-goal-id="${sofaEscape(goal.id || sofaGoalId())}">
      <input data-goal-minute type="text" inputmode="numeric" pattern="\\d{1,3}(\\+\\d{1,2})?" placeholder="min" value="${sofaEscape(goal.minute || '')}">
      <input data-goal-player type="search" list="players_${sofaEscape(match.id)}_${side}" placeholder="Jogador ou Autogolo" value="${sofaEscape(playerValue)}">
      <button class="icon-button" type="button" data-remove-goal title="Remover golo">x</button>
    </div>
  `;
}

function sofaRenderMatch(match) {
  const stored = sofaStoredMatch(match.id);
  const homeGoals = stored.homeGoals ?? '';
  const awayGoals = stored.awayGoals ?? '';
  const homeGoalsList = sofaNormalizeGoals(stored.homeGoalsList);
  const awayGoalsList = sofaNormalizeGoals(stored.awayGoalsList);

  return `
    <article class="match-card" data-match-id="${sofaEscape(match.id)}">
      <div class="match-head">
        <div>
          <h2 class="match-title">Jogo ${sofaEscape(match.id)} · ${sofaEscape(match.home)} vs ${sofaEscape(match.away)}</h2>
          <p class="meta">${sofaEscape(sofaStageLabel(match.stage))}${match.group ? ` · Grupo ${sofaEscape(match.group)}` : ''} · ${sofaEscape(match.date)} ${sofaEscape(match.time || '')} · ${sofaEscape(match.venue || '')}</p>
        </div>
        <span class="badge">${stored.updatedAt ? 'Gravado' : 'Por gravar'}</span>
      </div>

      <div class="score-grid">
        <strong>${sofaEscape(match.home)}</strong>
        <input data-field="homeGoals" type="number" min="0" max="30" value="${sofaEscape(homeGoals)}" aria-label="Golos ${sofaEscape(match.home)}">
        <input data-field="awayGoals" type="number" min="0" max="30" value="${sofaEscape(awayGoals)}" aria-label="Golos ${sofaEscape(match.away)}">
        <strong>${sofaEscape(match.away)}</strong>
      </div>

      <div class="goals-grid">
        <section class="goals-panel">
          <h3>${sofaEscape(match.home)}</h3>
          ${sofaRenderPlayerOptions(match, 'home')}
          ${sofaRenderGoalRows(match, 'home', homeGoalsList)}
          <button class="ghost" type="button" data-add-goal="home">Adicionar golo</button>
        </section>
        <section class="goals-panel">
          <h3>${sofaEscape(match.away)}</h3>
          ${sofaRenderPlayerOptions(match, 'away')}
          ${sofaRenderGoalRows(match, 'away', awayGoalsList)}
          <button class="ghost" type="button" data-add-goal="away">Adicionar golo</button>
        </section>
      </div>

      <div class="actions">
        <button class="primary" type="button" data-save-match>Gravar</button>
        <span class="message" data-message>${stored.updatedAt ? 'Dados carregados de worldcupSofa.' : ''}</span>
      </div>
    </article>
  `;
}

function sofaRenderMatches() {
  const rows = sofaFilteredMatches();
  sofa$('#matchesList').innerHTML = rows.length
    ? rows.map(sofaRenderMatch).join('')
    : '<div class="panel">Sem jogos para estes filtros.</div>';
}

function sofaReadScore(card, field) {
  const primary = card.querySelector(`[data-field="${field}"]`);
  const value = primary?.value;
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sofaReadGoals(card, side) {
  return [...card.querySelectorAll(`[data-goal-list="${side}"] .goal-row`)]
    .map((row) => ({
      id: row.dataset.goalId || sofaGoalId(),
      minute: sofaNormalizeMinute(row.querySelector('[data-goal-minute]').value),
      player: row.querySelector('[data-goal-player]').value.trim()
    }))
    .filter((goal) => goal.minute || goal.player)
    .map((goal) => ({
      ...goal,
      minute: goal.minute || null,
      player: sofaNormalizeText(goal.player) === 'autogolo' ? '' : goal.player,
      ownGoal: sofaNormalizeText(goal.player) === 'autogolo',
      type: sofaNormalizeText(goal.player) === 'autogolo' ? 'own-goal' : 'goal'
    }));
}

function sofaBuildPayload(match, card) {
  const homeGoals = sofaReadScore(card, 'homeGoals');
  const awayGoals = sofaReadScore(card, 'awayGoals');
  return {
    documentId: sofaMatchDocId(match.id),
    matchDocId: sofaMatchDocId(match.id),
    matchId: Number(match.id),
    stage: match.stage,
    stageLabel: sofaStageLabel(match.stage),
    group: match.group || null,
    date: match.date || null,
    time: match.time || null,
    homeTeam: match.home,
    awayTeam: match.away,
    venue: match.venue || null,
    city: match.city || null,
    country: match.country || null,
    homeGoals,
    awayGoals,
    homeGoalsList: sofaReadGoals(card, 'home'),
    awayGoalsList: sofaReadGoals(card, 'away'),
    status: homeGoals != null && awayGoals != null ? 'finished' : 'draft',
    updatedAt: sofaTools.serverTimestamp(),
    updatedBy: sofaCurrentUser?.uid || null,
    updatedByEmail: sofaCurrentUser?.email || null
  };
}

async function sofaSaveMatch(card) {
  const matchId = Number(card.dataset.matchId);
  const match = sofaMatches.find((item) => Number(item.id) === matchId);
  if (!match) return;

  const message = card.querySelector('[data-message]');
  message.textContent = 'A gravar...';
  message.className = 'message';

  try {
    const payload = sofaBuildPayload(match, card);
    await sofaTools.setDoc(
      sofaTools.doc(sofaDb, SOFA_COLLECTION, sofaMatchDocId(match.id)),
      payload,
      { merge: true }
    );
    sofaDocs[String(match.id)] = { ...payload, updatedAt: new Date().toISOString() };
    message.textContent = 'Gravado em worldcupSofa.';
    message.className = 'message ok';
    card.querySelector('.badge').textContent = 'Gravado';
  } catch (error) {
    console.error(error);
    message.textContent = `Erro ao gravar${error?.code ? ` (${error.code})` : ''}.`;
    message.className = 'message err';
  }
}

function sofaBindEvents() {
  sofa$('#loginBtn').addEventListener('click', async () => {
    sofa$('#authStatus').textContent = 'A entrar...';
    try {
      await sofaTools.signInWithEmailAndPassword(
        sofaAuth,
        sofa$('#adminEmail').value.trim(),
        sofa$('#adminPassword').value
      );
    } catch (error) {
      sofa$('#authStatus').textContent = `Erro ao entrar${error?.code ? ` (${error.code})` : ''}.`;
    }
  });

  sofa$('#logoutBtn').addEventListener('click', () => sofaTools.signOut(sofaAuth));

  sofa$('#stageFilter').addEventListener('change', (event) => {
    sofaFilters.stage = event.target.value;
    sofaRenderMatches();
  });
  sofa$('#groupFilter').addEventListener('change', (event) => {
    sofaFilters.group = event.target.value;
    sofaRenderMatches();
  });
  sofa$('#searchInput').addEventListener('input', (event) => {
    sofaFilters.q = event.target.value.trim();
    sofaRenderMatches();
  });

  sofa$('#matchesList').addEventListener('click', (event) => {
    const addBtn = event.target.closest('[data-add-goal]');
    if (addBtn) {
      const side = addBtn.dataset.addGoal;
      const list = addBtn.closest('.goals-panel').querySelector(`[data-goal-list="${side}"]`);
      const card = addBtn.closest('.match-card');
      const match = sofaMatches.find((item) => String(item.id) === String(card?.dataset.matchId));
      if (!match) return;
      list.insertAdjacentHTML('beforeend', sofaRenderGoalRow(match, side));
      return;
    }

    const removeBtn = event.target.closest('[data-remove-goal]');
    if (removeBtn) {
      removeBtn.closest('.goal-row')?.remove();
      return;
    }

    const saveBtn = event.target.closest('[data-save-match]');
    if (saveBtn) {
      void sofaSaveMatch(saveBtn.closest('.match-card'));
    }
  });

}

async function sofaInit() {
  try {
    sofaBindEvents();
    await sofaLoadSchedule();
    await sofaLoadSquads();
    await sofaInitFirebase();
  } catch (error) {
    console.error(error);
    sofa$('#authStatus').textContent = 'Nao foi possivel carregar a pagina.';
  }
}

sofaInit();
