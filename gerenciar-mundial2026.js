const STAGE_LABELS = {
  groups: 'Fase de grupos',
  round32: '16 avos',
  round16: 'Oitavos',
  quarterfinals: 'Quartos de final',
  semifinals: 'Meias-finais',
  third_place: '3.º lugar',
  final: 'Final'
};

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD8WcFD7jC55feYYqdY7aJSgxXyXkEjTX0',
  authDomain: 'g-games-8a8fc.firebaseapp.com',
  projectId: 'g-games-8a8fc',
  storageBucket: 'g-games-8a8fc.firebasestorage.app',
  messagingSenderId: '689897349449',
  appId: '1:689897349449:web:536599794579901beb7a98',
  measurementId: 'G-GTTPJ6G5MD'
};

const FIREBASE_SDK_VERSION = '10.14.1';
const COLLECTION = 'worldcupextra';
const MATCHES_COLLECTION = 'worldcupextraMatches';
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (text) => String(text ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

let data = null;
let app = null;
let db = null;
let auth = null;
let tools = null;
let currentUser = null;
let officialResults = {};
let activeStage = 'groups';

function matchDocId(matchId) {
  return `match_${String(matchId).padStart(3, '0')}`;
}

function isTrackedMatchDoc(row) {
  if (!row) return false;
  return row.status === 'live' || row.status === 'finished' || row.live === true || row.finished === true || (row.homeGoals != null && row.awayGoals != null);
}

function getOfficial(matchId) {
  return officialResults[String(matchId)] || null;
}

function isKnockout(match) {
  return match.stage !== 'groups';
}

function resolvePreviousWinner(label) {
  const text = String(label || '');
  const win = text.match(/^Vencedor Jogo (\d+)$/);
  if (win) return getOfficial(win[1])?.winnerTeam || text;
  const loss = text.match(/^Perdedor Jogo (\d+)$/);
  if (loss) {
    const result = getOfficial(loss[1]);
    if (!result) return text;
    return result.winnerTeam === result.homeTeam ? result.awayTeam : result.homeTeam;
  }
  return text;
}

function resolvedTeam(match, side) {
  const raw = match[side];
  if (!isKnockout(match)) return raw;
  if (/^(1|2|3)\.º Grupo/.test(String(raw))) return raw;
  return resolvePreviousWinner(raw);
}

function firebaseTimestampToMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000);
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

async function canWriteOfficialMatch(matchId) {
  const ref = tools.doc(db, MATCHES_COLLECTION, matchDocId(matchId));
  const snap = await tools.getDoc(ref);
  if (!snap.exists()) return false;
  const kickoffMs = firebaseTimestampToMillis(snap.data()?.kickoff);
  if (!kickoffMs) return false;
  const now = Date.now();
  return now >= kickoffMs && now <= kickoffMs + 180 * 60 * 1000;
}

async function initFirebase() {
  const appModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`);
  const authModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`);
  const firestoreModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`);
  app = appModule.initializeApp(FIREBASE_CONFIG);
  auth = authModule.getAuth(app);
  db = firestoreModule.getFirestore(app);
  tools = {
    doc: firestoreModule.doc,
    getDoc: firestoreModule.getDoc,
    getDocs: firestoreModule.getDocs,
    setDoc: firestoreModule.setDoc,
    collection: firestoreModule.collection,
    query: firestoreModule.query,
    where: firestoreModule.where,
    serverTimestamp: firestoreModule.serverTimestamp,
    signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
    signOut: authModule.signOut,
    onAuthStateChanged: authModule.onAuthStateChanged
  };

  tools.onAuthStateChanged(auth, handleAuthState);
}

async function handleAuthState(user) {
  currentUser = user;
  if (!user) {
    $('#authStatus').textContent = 'Inicia sessão para continuar.';
    $('#loginArea').hidden = false;
    $('#adminPanel').hidden = true;
    $('#logoutBtn').hidden = true;
    return;
  }

  $('#authStatus').textContent = 'A confirmar permissões...';
  const userSnap = await tools.getDoc(tools.doc(db, 'users', user.uid));
  const estatuto = userSnap.exists() ? userSnap.data().estatuto : '';
  if (estatuto !== 'ruler') {
    $('#authStatus').innerHTML = '<span class="locked-note">Esta conta não tem permissão ruler.</span>';
    $('#loginArea').hidden = false;
    $('#adminPanel').hidden = true;
    $('#logoutBtn').hidden = false;
    return;
  }

  $('#loginArea').hidden = true;
  $('#adminPanel').hidden = false;
  $('#logoutBtn').hidden = false;
  await loadOfficialResults();
  renderAdminMatches();
}

async function loadOfficialResults() {
  const [matchSnap, legacySnap] = await Promise.all([
    tools.getDocs(tools.collection(db, MATCHES_COLLECTION)),
    tools.getDocs(tools.query(tools.collection(db, COLLECTION), tools.where('status', '==', 'official')))
  ]);
  const fromMatches = matchSnap.docs
    .map(doc => {
      const row = { id: doc.id, ...doc.data() };
      const isLive = !!(row.live === true || row.status === 'live');
      if (isLive) {
        row.homeGoals = row.homeGoalsLive ?? row.homeGoals ?? null;
        row.awayGoals = row.awayGoalsLive ?? row.awayGoals ?? null;
      }
      return row;
    })
    .filter(isTrackedMatchDoc)
    .map(row => [String(row.matchId ?? String(row.id).replace('match_', '')), row]);
  const legacy = legacySnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .map(row => [String(row.matchId ?? row.id.replace('official-match-', '')), row]);
  officialResults = Object.fromEntries([...legacy, ...fromMatches]);
}

function renderAdminMatch(match) {
  const result = getOfficial(match.id) || {};
  const home = result.homeTeam || resolvedTeam(match, 'home');
  const away = result.awayTeam || resolvedTeam(match, 'away');
  const tied = String(result.homeGoals ?? '') !== '' && Number(result.homeGoals) === Number(result.awayGoals);
  return `
    <article class="admin-match-card" data-match-id="${match.id}">
      <div>
        <span class="badge">Jogo ${match.id}</span>
        <strong>${escapeHtml(home)} vs ${escapeHtml(away)}</strong>
        <p class="modal-muted">${escapeHtml(STAGE_LABELS[match.stage])}${match.group ? ` · Grupo ${escapeHtml(match.group)}` : ''} · ${escapeHtml(match.date)} ${escapeHtml(match.time || '')} · ${escapeHtml(match.venue || '')}</p>
      </div>
      <div class="admin-score-row">
        <span>${escapeHtml(home)}</span>
        <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-field="homeGoals" value="${escapeHtml(result.homeGoals ?? '')}" aria-label="Golos ${escapeHtml(home)}">
        <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-field="awayGoals" value="${escapeHtml(result.awayGoals ?? '')}" aria-label="Golos ${escapeHtml(away)}">
        <span>${escapeHtml(away)}</span>
        <button type="button" class="primary" data-save-official>Gravar</button>
      </div>
      ${isKnockout(match) ? `
        <div class="admin-team-override">
          <label>Seleção casa <input type="text" data-field="homeTeamOverride" value="${escapeHtml(result.homeTeam || '')}" placeholder="${escapeHtml(home)}"></label>
          <label>Seleção fora <input type="text" data-field="awayTeamOverride" value="${escapeHtml(result.awayTeam || '')}" placeholder="${escapeHtml(away)}"></label>
        </div>
        <div class="ko-row">
          <select data-field="method">
            <option value="90" ${!result.method || result.method === '90' ? 'selected' : ''}>90 minutos</option>
            <option value="et" ${result.method === 'et' ? 'selected' : ''}>Prolongamento</option>
            <option value="pens" ${result.method === 'pens' ? 'selected' : ''}>Penáltis</option>
          </select>
          <select data-field="winnerSide">
            <option value="" ${!result.winnerSide ? 'selected' : ''}>Vencedor</option>
            <option value="home" ${result.winnerSide === 'home' ? 'selected' : ''}>${escapeHtml(home)}</option>
            <option value="away" ${result.winnerSide === 'away' ? 'selected' : ''}>${escapeHtml(away)}</option>
          </select>
        </div>
      ` : ''}
      <p class="admin-message" data-admin-message>${result.updatedAt ? 'Resultado oficial já gravado.' : 'Ainda não gravado.'}</p>
    </article>
  `;
}

function renderAdminMatches() {
  const stageMatches = data.matches.filter(match => match.stage === activeStage);
  const grouped = stageMatches.reduce((acc, match) => {
    const key = activeStage === 'groups' ? `Grupo ${match.group}` : match.date;
    acc[key] ||= [];
    acc[key].push(match);
    return acc;
  }, {});
  $('#adminMatches').innerHTML = Object.entries(grouped).map(([key, matches]) => `
    <section class="day-block">
      <h2 class="admin-stage-title">${escapeHtml(key)}</h2>
      ${matches.map(renderAdminMatch).join('')}
    </section>
  `).join('');
}

function buildOfficialPayload(match, card) {
  const defaultHome = resolvedTeam(match, 'home');
  const defaultAway = resolvedTeam(match, 'away');
  const home = (card.querySelector('[data-field="homeTeamOverride"]')?.value || '').trim() || defaultHome;
  const away = (card.querySelector('[data-field="awayTeamOverride"]')?.value || '').trim() || defaultAway;
  const homeGoals = Number(card.querySelector('[data-field="homeGoals"]').value);
  const awayGoals = Number(card.querySelector('[data-field="awayGoals"]').value);
  const method = isKnockout(match) ? card.querySelector('[data-field="method"]')?.value || '90' : 'group';
  let winnerSide = null;
  if (homeGoals > awayGoals) winnerSide = 'home';
  else if (awayGoals > homeGoals) winnerSide = 'away';
  else if (isKnockout(match)) winnerSide = card.querySelector('[data-field="winnerSide"]')?.value || '';
  else winnerSide = 'draw';

  const winnerTeam = winnerSide === 'home' ? home : winnerSide === 'away' ? away : 'Empate';

  return {
    documentId: matchDocId(match.id),
    matchDocId: matchDocId(match.id),
    matchId: Number(match.id),
    status: 'finished',
    live: false,
    finished: true,
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
    homeTeam: home,
    awayTeam: away,
    homeGoals,
    awayGoals,
    method,
    winnerSide,
    winnerTeam,
    source: 'admin',
    updatedAt: tools.serverTimestamp(),
    updatedBy: currentUser.uid,
    updatedByEmail: currentUser.email || null
  };
}

async function saveOfficialMatch(card) {
  const id = card.dataset.matchId;
  const match = data.matches.find(m => String(m.id) === String(id));
  const msg = card.querySelector('[data-admin-message]');
  const homeInput = card.querySelector('[data-field="homeGoals"]');
  const awayInput = card.querySelector('[data-field="awayGoals"]');
  homeInput.value = homeInput.value.replace(/\D/g, '').slice(0, 2);
  awayInput.value = awayInput.value.replace(/\D/g, '').slice(0, 2);

  if (homeInput.value === '' || awayInput.value === '') {
    msg.textContent = 'Preenche o resultado antes de gravar.';
    msg.className = 'admin-message error';
    return;
  }
  if (isKnockout(match) && Number(homeInput.value) === Number(awayInput.value) && !card.querySelector('[data-field="winnerSide"]').value) {
    msg.textContent = 'Como houve empate, escolhe o vencedor.';
    msg.className = 'admin-message error';
    return;
  }
  if (!await canWriteOfficialMatch(id)) {
    msg.textContent = 'O kickoff ainda nao foi ultrapassado. Nao podes gravar este jogo agora.';
    msg.className = 'admin-message error';
    return;
  }

  msg.textContent = 'A gravar...';
  msg.className = 'admin-message';
  try {
    const payload = buildOfficialPayload(match, card);
    const ref = tools.doc(db, MATCHES_COLLECTION, matchDocId(id));
    await tools.setDoc(ref, payload, { merge: true });
    officialResults[String(id)] = { id: matchDocId(id), ...payload };
    msg.textContent = 'Resultado oficial gravado.';
    msg.className = 'admin-message ok';
    setTimeout(renderAdminMatches, 250);
  } catch (error) {
    console.error(error);
    msg.textContent = 'Não foi possível gravar. Confirma as permissões.';
    msg.className = 'admin-message error';
  }
}

function bindEvents() {
  $('#loginBtn').addEventListener('click', async () => {
    const email = $('#adminEmail').value.trim();
    const pass = $('#adminPassword').value;
    $('#authStatus').textContent = 'A entrar...';
    try {
      await tools.signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error(error);
      $('#authStatus').textContent = 'Não foi possível entrar. Confirma email e password.';
    }
  });

  $('#logoutBtn').addEventListener('click', () => tools.signOut(auth));

  $('#adminTabs').addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;
    activeStage = tab.dataset.stage;
    document.querySelectorAll('#adminTabs .tab').forEach(btn => btn.classList.toggle('active', btn === tab));
    renderAdminMatches();
  });

  $('#adminMatches').addEventListener('input', (event) => {
    if (event.target.matches('input[data-field]')) {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 2);
    }
  });

  $('#adminMatches').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-save-official]');
    if (!btn) return;
    saveOfficialMatch(btn.closest('.admin-match-card'));
  });
}

async function init() {
  try {
    const response = await fetch('matches.json');
    data = await response.json();
    bindEvents();
    await initFirebase();
  } catch (error) {
    console.error(error);
    $('#authStatus').textContent = 'Erro ao carregar a página de gestão.';
  }
}

init();
