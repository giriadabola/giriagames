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
const SECURE_COLLECTION = 'WoldCupSecureHT';
const STAGE_LABELS = {
  groups: 'Fase de grupos',
  round32: '16 avos',
  round16: 'Oitavos',
  quarterfinals: 'Quartos de final',
  semifinals: 'Meias-finais',
  third_place: '3.º lugar',
  final: 'Final'
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (text) => String(text ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c]));

let auth = null;
let db = null;
let tools = null;
let currentUser = null;
let secureMatches = [];
let activeStageFilter = 'all';
let loginWatchdog = null;

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

function stageLabel(stage) {
  return STAGE_LABELS[stage] || stage || 'Sem fase';
}

function kickoffText(row) {
  const kickoffMs = firebaseTimestampToMillis(row.kickoff) || Date.parse(row.kickoffIso || '');
  if (!kickoffMs) return row.date && row.time ? `${row.date} ${row.time}` : 'Sem kickoff';
  return new Date(kickoffMs).toLocaleString('pt-PT');
}

function numericOptions(selected) {
  const current = Number.isFinite(Number(selected)) ? Number(selected) : 0;
  let html = '';
  for (let i = 0; i <= 10; i++) {
    html += `<option value="${i}" ${i === current ? 'selected' : ''}>${i}</option>`;
  }
  return html;
}

function filteredMatches() {
  if (activeStageFilter === 'all') return secureMatches;
  return secureMatches.filter(match => String(match.stage || '') === activeStageFilter);
}

function renderStageFilter() {
  const select = $('#stageFilter');
  if (!select) return;
  const stages = [...new Set(secureMatches.map(match => String(match.stage || '')).filter(Boolean))];
  select.innerHTML = [
    '<option value="all">Todas as fases</option>',
    ...stages.map(stage => `<option value="${escapeHtml(stage)}">${escapeHtml(stageLabel(stage))}</option>`)
  ].join('');
  select.value = stages.includes(activeStageFilter) || activeStageFilter === 'all' ? activeStageFilter : 'all';
}

function renderMatches() {
  const list = $('#matchesList');
  if (!list) return;
  const rows = filteredMatches();
  if (!rows.length) {
    list.innerHTML = '<div class="secureht-empty">Não encontrei jogos nesta coleção com o filtro atual.</div>';
    return;
  }

  list.innerHTML = rows.map(row => `
    <article class="secureht-match" data-doc-id="${escapeHtml(row.id)}">
      <div class="secureht-match-head">
        <div>
          <h2>Jogo ${escapeHtml(row.matchId ?? row.id)} · ${escapeHtml(row.homeTeam || 'Casa')} vs ${escapeHtml(row.awayTeam || 'Fora')}</h2>
          <div class="secureht-meta">
            <span>${escapeHtml(stageLabel(row.stage))}</span>
            <span>${escapeHtml(row.group ? `Grupo ${row.group}` : 'Sem grupo')}</span>
            <span>${escapeHtml(kickoffText(row))}</span>
            <span>${escapeHtml(row.documentId || row.id)}</span>
          </div>
        </div>
        <span class="secureht-badge">${escapeHtml(String(row.status || 'sem status'))}</span>
      </div>

      <div class="secureht-grid">
        <div class="secureht-field">
          <label for="homeGoals_${escapeHtml(row.id)}">${escapeHtml(row.homeTeam || 'Casa')} · homeGoals</label>
          <select id="homeGoals_${escapeHtml(row.id)}" data-field="homeGoals">
            ${numericOptions(row.homeGoals)}
          </select>
        </div>
        <div class="secureht-field">
          <label for="awayGoals_${escapeHtml(row.id)}">${escapeHtml(row.awayTeam || 'Fora')} · awayGoals</label>
          <select id="awayGoals_${escapeHtml(row.id)}" data-field="awayGoals">
            ${numericOptions(row.awayGoals)}
          </select>
        </div>
      </div>

      <div class="secureht-actions">
        <button type="button" class="primary" data-save-match>Gravar</button>
        <span class="secureht-message" data-message></span>
      </div>
    </article>
  `).join('');
}

async function loadSecureMatches() {
  const snap = await tools.getDocs(tools.collection(db, SECURE_COLLECTION));
  secureMatches = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => Number(a.matchId || 0) - Number(b.matchId || 0));
  renderStageFilter();
  renderMatches();
}

async function saveMatch(card) {
  const docId = card.dataset.docId;
  const message = card.querySelector('[data-message]');
  const btn = card.querySelector('[data-save-match]');
  const homeGoals = Number(card.querySelector('[data-field="homeGoals"]').value);
  const awayGoals = Number(card.querySelector('[data-field="awayGoals"]').value);

  message.textContent = 'A gravar...';
  message.className = 'secureht-message';
  btn.disabled = true;

  try {
    const ref = tools.doc(db, SECURE_COLLECTION, docId);
    await tools.setDoc(ref, {
      homeGoals,
      awayGoals,
      updatedAt: tools.serverTimestamp(),
      manualUpdatedAt: new Date().toISOString(),
      syncOrigin: 'manual-secureht-edit',
      updatedBy: currentUser?.uid || null,
      updatedByEmail: currentUser?.email || null
    }, { merge: true });

    const row = secureMatches.find(match => String(match.id) === String(docId));
    if (row) {
      row.homeGoals = homeGoals;
      row.awayGoals = awayGoals;
      row.syncOrigin = 'manual-secureht-edit';
      row.updatedBy = currentUser?.uid || null;
      row.updatedByEmail = currentUser?.email || null;
      row.manualUpdatedAt = new Date().toISOString();
    }

    message.textContent = 'Gravado.';
    message.className = 'secureht-message ok';
  } catch (error) {
    console.error(error);
    message.textContent = 'Erro ao gravar. Confirma as permissões.';
    message.className = 'secureht-message err';
  } finally {
    btn.disabled = false;
  }
}

async function handleAuthState(user) {
  try {
    currentUser = user;
    if (loginWatchdog) {
      clearTimeout(loginWatchdog);
      loginWatchdog = null;
    }

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
    await loadSecureMatches();
  } catch (error) {
    console.error('handleAuthState falhou:', error);
    $('#authStatus').textContent = `Erro a validar permissões${error?.code ? ` (${error.code})` : ''}.`;
    $('#loginArea').hidden = false;
    $('#adminPanel').hidden = true;
    $('#logoutBtn').hidden = false;
  }
}

async function initFirebase() {
  const appModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`);
  const authModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`);
  const firestoreModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`);

  const app = appModule.initializeApp(FIREBASE_CONFIG, 'secureht-edit-app');
  auth = authModule.getAuth(app);
  db = firestoreModule.getFirestore(app);
  tools = {
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

  tools.onAuthStateChanged(auth, handleAuthState);
}

function bindEvents() {
  $('#loginBtn').addEventListener('click', async () => {
    const email = $('#adminEmail').value.trim();
    const pass = $('#adminPassword').value;
    $('#authStatus').textContent = 'A entrar...';
    try {
      if (loginWatchdog) clearTimeout(loginWatchdog);
      loginWatchdog = setTimeout(() => {
        $('#authStatus').textContent = 'Login pendente há demasiado tempo. Confirma internet, domínio autorizado e consola.';
      }, 12000);
      await tools.signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error(error);
      if (loginWatchdog) {
        clearTimeout(loginWatchdog);
        loginWatchdog = null;
      }
      $('#authStatus').textContent = `Não foi possível entrar${error?.code ? ` (${error.code})` : ''}.`;
    }
  });

  $('#logoutBtn').addEventListener('click', () => tools.signOut(auth));

  $('#refreshBtn').addEventListener('click', () => loadSecureMatches());

  $('#stageFilter').addEventListener('change', (event) => {
    activeStageFilter = event.target.value;
    renderMatches();
  });

  $('#matchesList').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-save-match]');
    if (!btn) return;
    saveMatch(btn.closest('.secureht-match'));
  });
}

async function init() {
  try {
    bindEvents();
    await initFirebase();
  } catch (error) {
    console.error(error);
    $('#authStatus').textContent = 'Erro ao carregar a página de edição.';
  }
}

init();
