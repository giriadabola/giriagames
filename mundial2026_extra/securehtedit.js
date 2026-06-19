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
const AUTO_LOGIN_STORAGE_KEY = 'mundial2026_secureht_autologin_v1';
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
const escapeHtml = (text) => String(text ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#039;',
  '"': '&quot;'
}[char]));

const SECUREHT_ALLOWED_HOSTS = new Set([
  window.location.host,
  'www.gstatic.com',
  'identitytoolkit.googleapis.com',
  'firestore.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'g-games-8a8fc.firebaseapp.com'
]);

const secureHtNativeFetch = window.fetch.bind(window);
window.fetch = function secureHtIsolatedFetch(input, init) {
  const url = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
  try {
    const parsed = new URL(url, window.location.href);
    const isAllowed = SECUREHT_ALLOWED_HOSTS.has(parsed.host) || 
                     parsed.host.endsWith('.googleapis.com') || 
                     parsed.host.endsWith('.firebaseapp.com');
    if (parsed.origin !== window.location.origin && !isAllowed) {
      console.warn('securehtedit bloqueou fetch externo:', parsed.href);
      return Promise.reject(new Error(`securehtedit bloqueou fetch externo: ${parsed.host}`));
    }
  } catch {
    // Mantém o comportamento normal para URLs relativas ou inválidas.
  }
  return secureHtNativeFetch(input, init);
};

let auth = null;
let db = null;
let tools = null;
let currentUser = null;
let googleProvider = null;
let secureMatches = [];
let activeStageFilter = 'all';
let loginWatchdog = null;
let authStateBusy = false;
let autoLoginAttempted = false;

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

function readStoredAutoLogin() {
  try {
    const raw = window.localStorage.getItem(AUTO_LOGIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email || !parsed?.password) return null;
    return {
      email: String(parsed.email).trim(),
      password: String(parsed.password)
    };
  } catch {
    return null;
  }
}

function saveStoredAutoLogin(email, password) {
  if (!email || !password) return;
  window.localStorage.setItem(AUTO_LOGIN_STORAGE_KEY, JSON.stringify({
    email: String(email).trim(),
    password: String(password)
  }));
}

function clearStoredAutoLogin() {
  window.localStorage.removeItem(AUTO_LOGIN_STORAGE_KEY);
}

function readAutoLoginFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const email = (params.get('email') || '').trim();
  const password = params.get('password') || '';
  const autologin = (params.get('autologin') || '1').toLowerCase();
  if (!email || !password) return null;
  if (autologin === '0' || autologin === 'false' || autologin === 'no') return null;
  return { email, password };
}

function getAutoLoginCredentials() {
  const fromQuery = readAutoLoginFromQuery();
  if (fromQuery) {
    saveStoredAutoLogin(fromQuery.email, fromQuery.password);
    return fromQuery;
  }
  return readStoredAutoLogin();
}

function fillLoginForm(email = '', password = '') {
  $('#adminEmail').value = email;
  $('#adminPassword').value = password;
}

function filteredMatches() {
  if (activeStageFilter === 'all') return secureMatches;
  return secureMatches.filter((match) => String(match.stage || '') === activeStageFilter);
}

function renderStageFilter() {
  const select = $('#stageFilter');
  if (!select) return;
  const stages = [...new Set(secureMatches.map((match) => String(match.stage || '')).filter(Boolean))];
  select.innerHTML = [
    '<option value="all">Todas as fases</option>',
    ...stages.map((stage) => `<option value="${escapeHtml(stage)}">${escapeHtml(stageLabel(stage))}</option>`)
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

  list.innerHTML = rows.map((row) => `
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
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
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

    const row = secureMatches.find((match) => String(match.id) === String(docId));
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

function startLoginWatchdog() {
  if (loginWatchdog) clearTimeout(loginWatchdog);
  loginWatchdog = setTimeout(() => {
    $('#authStatus').textContent = 'Login pendente há demasiado tempo. Confirma internet, domínio autorizado e consola.';
  }, 12000);
}

function stopLoginWatchdog() {
  if (!loginWatchdog) return;
  clearTimeout(loginWatchdog);
  loginWatchdog = null;
}

async function loginWithEmail(email, password, options = {}) {
  const automatic = options.automatic === true;
  $('#authStatus').textContent = automatic ? 'A entrar automaticamente...' : 'A entrar...';
  startLoginWatchdog();

  try {
    const credential = await tools.signInWithEmailAndPassword(auth, email, password);
    saveStoredAutoLogin(email, password);
    autoLoginAttempted = true;
    stopLoginWatchdog();
    $('#authStatus').textContent = 'Login feito. A confirmar permissões...';
    await handleAuthState(credential.user);
  } catch (error) {
    console.error(error);
    stopLoginWatchdog();
    if (automatic) {
      clearStoredAutoLogin();
      $('#authStatus').textContent = `Falhou o login automático${error?.code ? ` (${error.code})` : ''}.`;
    } else {
      $('#authStatus').textContent = `Não foi possível entrar${error?.code ? ` (${error.code})` : ''}.`;
    }
  }
}

async function handleAuthState(user) {
  if (authStateBusy) return;
  authStateBusy = true;

  try {
    currentUser = user;
    stopLoginWatchdog();

    if (!user) {
      const autoLogin = getAutoLoginCredentials();
      fillLoginForm(autoLogin?.email || '', autoLogin?.password || '');

      if (autoLogin && !autoLoginAttempted) {
        autoLoginAttempted = true;
        $('#loginArea').hidden = false;
        $('#adminPanel').hidden = true;
        $('#logoutBtn').hidden = true;
        void loginWithEmail(autoLogin.email, autoLogin.password, { automatic: true });
        return;
      }

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
  } finally {
    authStateBusy = false;
  }
}

async function initFirebase() {
  const appModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`);
  const authModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`);
  const firestoreModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`);

  const app = appModule.initializeApp(FIREBASE_CONFIG);
  auth = authModule.getAuth(app);
  db = firestoreModule.getFirestore(app);
  googleProvider = new authModule.GoogleAuthProvider();

  try {
    await authModule.setPersistence(auth, authModule.browserLocalPersistence);
  } catch (error) {
    console.warn('Não consegui ativar persistência local do login:', error);
  }

  tools = {
    collection: firestoreModule.collection,
    doc: firestoreModule.doc,
    getDoc: firestoreModule.getDoc,
    getDocs: firestoreModule.getDocs,
    setDoc: firestoreModule.setDoc,
    serverTimestamp: firestoreModule.serverTimestamp,
    signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
    signOut: authModule.signOut,
    onAuthStateChanged: authModule.onAuthStateChanged,
    signInWithPopup: authModule.signInWithPopup,
    signInWithRedirect: authModule.signInWithRedirect,
    getRedirectResult: authModule.getRedirectResult
  };

  tools.getRedirectResult(auth).catch(error => console.warn('Redirect login:', error));
  tools.onAuthStateChanged(auth, handleAuthState);
}

function bindEvents() {
  $('#loginBtn').addEventListener('click', async () => {
    autoLoginAttempted = true;
    await loginWithEmail($('#adminEmail').value.trim(), $('#adminPassword').value);
  });

  $('#googleLoginBtn').addEventListener('click', async () => {
    autoLoginAttempted = true;
    $('#authStatus').textContent = 'A abrir login Google...';
    try {
      await tools.signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.warn('Popup falhou. A tentar redirect:', error);
      $('#authStatus').textContent = 'Popup bloqueado/fechado. A tentar login por redirecionamento...';
      try {
        await tools.signInWithRedirect(auth, googleProvider);
      } catch (redirectError) {
        console.error('Redirect login falhou:', redirectError);
        $('#authStatus').textContent = `Erro no login: ${redirectError?.code || redirectError?.message || 'desconhecido'}`;
      }
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    clearStoredAutoLogin();
    autoLoginAttempted = true;
    await tools.signOut(auth);
  });

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
