/* Submissao: validacao, Firebase, pontuacao e texto dos prognosticos. */
function completionInfo() {
  if (!data) return { filled: 0, total: 0, complete: false, missingName: true, missingMatches: [] };
  const currentName = ($('#userName')?.value || state.name || '').trim();
  const missingMatches = data.matches.filter(match => !isPredictionComplete(match, getPrediction(match.id)));
  return {
    filled: data.matches.length - missingMatches.length,
    total: data.matches.length,
    complete: !!currentName && missingMatches.length === 0,
    missingName: !currentName,
    missingMatches
  };
}

function updateSaveButton() {
  const btn = $('#saveFirebaseBtn');
  const status = $('#firebaseStatus');
  if (!btn || !status) return;
  const info = completionInfo();
  btn.disabled = !info.complete || !firestoreDb || isVotingClosed();

  const dateText = formatVotingDeadline();
  if (isVotingClosed()) {
    status.textContent = dateText ? `As votações encerraram em ${dateText}.` : 'As votações já estão encerradas.';
  } else if (!firestoreDb) {
    status.textContent = 'A gravação ainda não está pronta. Confirma que estás com internet.';
  } else if (info.complete) {
    status.textContent = dateText ? `Tudo preenchido. Podes gravar até ${dateText}.` : 'Tudo preenchido. Já podes gravar o teu prognóstico.';
  } else if (info.missingName) {
    status.textContent = `Falta o nome do participante e faltam ${info.missingMatches.length} jogos.`;
  } else {
    status.textContent = `Faltam ${info.missingMatches.length} jogos para poderes gravar.`;
  }
}

function updateSummary() {
  $('#participantName').textContent = state.name || 'Sem nome';
  $('#userName').value = state.name || '';
  $('#lastSaved').textContent = state.lastSaved || '—';
  const info = completionInfo();
  $('#progressCount').textContent = `${info.filled}/${info.total || 104}`;
  updateSaveButton();
}

function validateMatch(card) {
  const id = card.dataset.matchId;
  const match = data.matches.find(m => String(m.id) === String(id));
  if (!match || !isKnockout(match)) return true;

  const p = getPrediction(id);
  const score = scoreState(p);
  const valid = !score.filled || !score.tied || ((p.method === 'et' || p.method === 'pens') && !!p.winner);

  card.classList.toggle('invalid', !valid);
  return valid;
}

function validateAllVisible() {
  document.querySelectorAll('.match-card').forEach(validateMatch);
}

function autoWinner(matchId) {
  const match = data.matches.find(m => String(m.id) === String(matchId));
  const p = getPrediction(matchId);
  if (!match || !isKnockout(match) || !isFilledScore(p)) return;

  const home = Number(p.homeGoals);
  const away = Number(p.awayGoals);
  if (home > away) {
    p.winner = 'home';
    p.method = '90';
  } else if (away > home) {
    p.winner = 'away';
    p.method = '90';
  } else {
    p.winner = '';
    p.method = '';
  }
  state.predictions[String(matchId)] = p;
}


let realtimeMatchesListener = null;
let realtimeSecureMatchesListener = null;

function startRealtimeMatchesListener() {
  if (!firestoreDb || !firebaseTools || !firebaseTools.onSnapshot) return;
  if (realtimeMatchesListener || realtimeSecureMatchesListener) return;

  try {
    const matchesCollectionRef = firebaseTools.collection(firestoreDb, FIREBASE_MATCHES_COLLECTION);
    realtimeMatchesListener = firebaseTools.onSnapshot(matchesCollectionRef, (snapshot) => {
      let changed = false;
      snapshot.docChanges().forEach((change) => {
        const docId = change.doc.id;
        const rawData = change.doc.data();
        const normalized = normalizeMatchStateDoc(docId, rawData);
        
        if (change.type === "added" || change.type === "modified") {
          if (shouldTrackMatchDocAsOfficial(normalized)) {
            matchStateOfficialResults[String(normalized.matchId)] = normalized;
          } else if (normalized.matchId && matchStateOfficialResults[String(normalized.matchId)]) {
            delete matchStateOfficialResults[String(normalized.matchId)];
          }
          syncMatchStateDocToSecureCollection(docId, rawData);
          changed = true;
        } else if (change.type === "removed") {
          const matchId = normalized.matchId || String(docId).replace(/^match_/, '').replace(/^official-match-/, '');
          if (matchId && matchStateOfficialResults[String(matchId)]) {
            delete matchStateOfficialResults[String(matchId)];
            changed = true;
          }
        }
      });

      if (changed) {
        rebuildOfficialResults();
        mergeApiResultsIntoOfficialResults();
        if (typeof refreshLiveDashboardView === 'function' && isVotingClosed()) {
          refreshLiveDashboardView();
        }
        window.dispatchEvent(new CustomEvent('ggames-live-updated', { detail: { updatedAt: new Date() } }));
      }
    }, (error) => {
      console.warn('Erro no listener real-time:', error);
    });
  } catch (error) {
    console.error('Não foi possível iniciar o listener real-time:', error);
  }
  try {
    const secureCollectionRef = firebaseTools.collection(firestoreDb, FIREBASE_SECURE_FINISHED_COLLECTION);
    realtimeSecureMatchesListener = firebaseTools.onSnapshot(secureCollectionRef, (snapshot) => {
      let changed = false;
      snapshot.docChanges().forEach((change) => {
        const docId = change.doc.id;
        const normalized = normalizeMatchStateDoc(docId, change.doc.data());
        const matchId = normalized.matchId || String(docId).replace(/^match_/, '');

        if ((change.type === 'added' || change.type === 'modified') && shouldTrackMatchDocAsOfficial(normalized)) {
          secureOfficialResults[String(matchId)] = normalized;
          changed = true;
        } else if (change.type === 'removed' && secureOfficialResults[String(matchId)]) {
          delete secureOfficialResults[String(matchId)];
          changed = true;
        }
      });

      if (changed) {
        rebuildOfficialResults();
        mergeApiResultsIntoOfficialResults();
        if (typeof refreshLiveDashboardView === 'function' && isVotingClosed()) {
          refreshLiveDashboardView();
        }
        window.dispatchEvent(new CustomEvent('ggames-live-updated', { detail: { updatedAt: new Date() } }));
      }
    }, (error) => {
      console.warn('Erro no listener da colecao segura:', error);
    });
  } catch (error) {
    console.error('Nao foi possivel iniciar o listener da colecao segura:', error);
  }
}

async function initFirebase() {
  try {
    const appModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`);
    const firestoreModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`);
    const authModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`);
    const app = appModule.initializeApp(FIREBASE_CONFIG);
    const auth = authModule.getAuth(app);
    authModule.onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log(`[Firebase Auth] Autenticado como ${user.email} (UID: ${user.uid})`);
      } else {
        console.log('[Firebase Auth] Sessão anónima / Não autenticado.');
      }
    });
    firestoreDb = firestoreModule.getFirestore(app);
    firebaseTools = {
      addDoc: firestoreModule.addDoc,
      collection: firestoreModule.collection,
      serverTimestamp: firestoreModule.serverTimestamp,
      getDocs: firestoreModule.getDocs,
      getDoc: firestoreModule.getDoc,
      query: firestoreModule.query,
      where: firestoreModule.where,
      orderBy: firestoreModule.orderBy,
      doc: firestoreModule.doc,
      setDoc: firestoreModule.setDoc,
      limit: firestoreModule.limit,
      writeBatch: firestoreModule.writeBatch,
      runTransaction: firestoreModule.runTransaction,
      onSnapshot: firestoreModule.onSnapshot
    };
    updateSaveButton();
    await loadScoringRules();
    await loadVotingDeadline();
    startRealtimeMatchesListener();
    if (typeof startSecureFinishedMirrorSweep === 'function') {
      startSecureFinishedMirrorSweep();
    }
  } catch (error) {
    console.error('Erro ao preparar ligação:', error);
    const status = $('#firebaseStatus');
    if (status) status.textContent = 'Não foi possível preparar a gravação. Confirma a internet.';
    updateSaveButton();
  }
}

function resolvedWinner(match, pred, q) {
  if (!isKnockout(match)) {
    if (!isFilledScore(pred)) return '';
    const score = scoreState(pred);
    if (score.home > score.away) return match.home;
    if (score.away > score.home) return match.away;
    return 'Empate';
  }
  if (!isFilledScore(pred)) return '';
  const score = scoreState(pred);
  if (!score.tied) return score.home > score.away ? resolveTeam(match, 'home', q) : resolveTeam(match, 'away', q);
  return pred.winner ? resolveTeam(match, pred.winner, q) : '';
}

async function hashPinForParticipant(participantKey, pin) {
  const text = `${participantKey}:${pin}`;
  if (window.crypto?.subtle) {
    const data = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  // fallback simples caso crypto.subtle não esteja disponível
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fnv-${(hash >>> 0).toString(16)}`;
}

function getOrCreateParticipantPin(participantKey) {
  const key = `worldcup2026_pin_${participantKey || 'participante'}`;
  let pin = localStorage.getItem(key);
  if (!/^\d{6}$/.test(String(pin || ''))) {
    const array = new Uint32Array(1);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(array);
    const n = window.crypto?.getRandomValues ? array[0] : Math.floor(Math.random() * 1000000);
    pin = String(100000 + (n % 900000));
    localStorage.setItem(key, pin);
  }
  return pin;
}

function buildSubmissionPayload(participantKey = '', visitorKey = '') {
  const ctx = getTournamentContext();
  const participantName = ($('#userName')?.value || state.name || '').trim();
  const matches = data.matches.map(match => {
    const pred = getPrediction(match.id);
    const homeTeam = isKnockout(match) ? resolveTeam(match, 'home', ctx.qualified) : match.home;
    const awayTeam = isKnockout(match) ? resolveTeam(match, 'away', ctx.qualified) : match.away;
    return {
      id: match.id,
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
      homeTeam,
      awayTeam,
      homeGoals: Number(pred.homeGoals),
      awayGoals: Number(pred.awayGoals),
      method: isKnockout(match) ? (pred.method || '90') : 'group',
      winnerSide: isKnockout(match) ? (pred.winner || (Number(pred.homeGoals) > Number(pred.awayGoals) ? 'home' : 'away')) : null,
      winnerTeam: resolvedWinner(match, pred, ctx.qualified)
    };
  });

  return {
    participantName,
    participantKey,
    visitorKey,
    pin: getOrCreateParticipantPin(participantKey),
    createdAt: firebaseTools.serverTimestamp(),
    clientTimestamp: new Date().toISOString(),
    locale: 'pt-PT',
    source: 'worldcup-2026-predictor-web',
    totalMatches: data.matches.length,
    completedMatches: matches.length,
    predictionsRaw: state.predictions,
    matches,
    standings: ctx.tables,
    qualified: ctx.qualified,
    champion: matches.find(m => m.stage === 'final')?.winnerTeam || null,
    runnerUp: (() => {
      const finalMatch = matches.find(m => m.stage === 'final');
      if (!finalMatch) return null;
      return finalMatch.winnerTeam === finalMatch.homeTeam ? finalMatch.awayTeam : finalMatch.homeTeam;
    })()
  };
}


function normalizeParticipantName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'participante';
}

function getOrCreateDeviceId() {
  const key = 'worldcup2026_device_id';
  let value = localStorage.getItem(key);
  if (!value) {
    value = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-]/g, '');
    localStorage.setItem(key, value);
  }
  return value;
}

async function sha256(text) {
  if (!crypto?.subtle) return btoa(unescape(encodeURIComponent(text))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
  const dataBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return [...new Uint8Array(hashBuffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function getVisitorKey() {
  const cached = sessionStorage.getItem('worldcup2026_visitor_key');
  if (cached) return cached;

  const deviceId = getOrCreateDeviceId();
  let ipPart = '';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      const payload = await response.json();
      ipPart = payload.ip || '';
    }
  } catch {
    // Se o serviço de IP falhar, usa um identificador anónimo deste navegador.
  }

  const visitorKey = ipPart
    ? await sha256(`ip:${ipPart}`)
    : await sha256(`device:${navigator.userAgent}|${deviceId}`);
  sessionStorage.setItem('worldcup2026_visitor_key', visitorKey);
  return visitorKey;
}

async function findExistingSubmission(participantKey, visitorKey) {
  const collectionRef = firebaseTools.collection(firestoreDb, FIREBASE_COLLECTION);
  const byName = await firebaseTools.getDocs(
    firebaseTools.query(collectionRef, firebaseTools.where('participantKey', '==', participantKey), firebaseTools.limit(1))
  );
  if (!byName.empty) return { reason: 'name' };

  const byVisitor = await firebaseTools.getDocs(
    firebaseTools.query(collectionRef, firebaseTools.where('visitorKey', '==', visitorKey), firebaseTools.limit(1))
  );
  if (!byVisitor.empty) return { reason: 'visitor' };

  return null;
}

async function loadPublicPredictions() {
  if (!firestoreDb || !firebaseTools) throw new Error('A ligaÃ§Ã£o ainda nÃ£o estÃ¡ pronta.');
  const loaded = await loadOfficialMatchStateDocs();
  publicPredictions = loaded.allDocs.filter(doc => doc.status !== 'official' && doc.type !== 'officialResult' && Array.isArray(doc.matches));
  applyLoadedOfficialSources(loaded);
  mergeApiResultsIntoOfficialResults();
  return publicPredictions;
  if (!firestoreDb || !firebaseTools) throw new Error('A ligação ainda não está pronta.');
  const collectionRef = firebaseTools.collection(firestoreDb, FIREBASE_COLLECTION);
  const matchesCollectionRef = firebaseTools.collection(firestoreDb, FIREBASE_MATCHES_COLLECTION);
  let snapshot;
  let matchesSnapshot = null;
  try {
    snapshot = await firebaseTools.getDocs(firebaseTools.query(collectionRef, firebaseTools.orderBy('clientTimestamp', 'desc')));
  } catch {
    snapshot = await firebaseTools.getDocs(collectionRef);
  }
  try {
    matchesSnapshot = await firebaseTools.getDocs(matchesCollectionRef);
  } catch (error) {
    console.warn('NÃ£o foi possÃ­vel carregar worldcupextraMatches. A usar fallback legacy.', error);
  }
  const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  publicPredictions = allDocs.filter(doc => doc.status !== 'official' && doc.type !== 'officialResult' && Array.isArray(doc.matches));
  const legacyOfficialDocs = allDocs
    .filter(doc => doc.status === 'official' || doc.type === 'officialResult')
    .filter(doc => doc.matchId != null || doc.id?.startsWith?.('official-match-'))
    .map(doc => [String(doc.matchId ?? String(doc.id).replace('official-match-', '')), doc]);
  const matchStateDocs = (matchesSnapshot?.docs || [])
    .map(doc => normalizeMatchStateDoc(doc.id, doc.data()))
    .filter(shouldTrackMatchDocAsOfficial)
    .map(doc => [String(doc.matchId), doc]);
  officialResults = Object.fromEntries([...legacyOfficialDocs, ...matchStateDocs]);
  return publicPredictions;
}

function getOfficialResult(matchId) {
  return getVisibleOfficialResult(matchId);
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function actualOutcome(result) {
  if (!result || result.homeGoals == null || result.homeGoals === '' || result.awayGoals == null || result.awayGoals === '') return '';
  const home = Number(result.homeGoals);
  const away = Number(result.awayGoals);
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

function predictionOutcome(pred) {
  if (!pred) return '';
  const home = Number(pred.homeGoals);
  const away = Number(pred.awayGoals);
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

function sameTeamName(a, b) {
  return normalizeParticipantName(a) === normalizeParticipantName(b);
}

function teamsMatchPrediction(pred, official) {
  if (!pred || !official) return false;
  if (pred.stage === 'groups') return true;
  return sameTeamName(pred.homeTeam, official.homeTeam) && sameTeamName(pred.awayTeam, official.awayTeam);
}

function officialWinnerTeam(official) {
  return getWinnerTeamFromScore(official);
}

function scoreOnePrediction(pred, official) {
  if (!pred || !official || pred.homeGoals == null || pred.awayGoals == null || official.homeGoals == null || official.awayGoals == null || official.homeGoals === '' || official.awayGoals === '') {
    return { points: 0, exact: false, outcomeHit: false, goalsHit: 0, goalsMissed: 0, winHit: 0, drawHit: 0, lossHit: 0, played: false };
  }
  const ph = Number(pred.homeGoals);
  const pa = Number(pred.awayGoals);
  const oh = Number(official.homeGoals);
  const oa = Number(official.awayGoals);
  const stage = pred.stage || official.stage || 'groups';
  const teamsMatch = teamsMatchPrediction(pred, official);
  const exact = teamsMatch && ph === oh && pa === oa;
  const actual = actualOutcome(official);
  const predicted = predictionOutcome(pred);
  const outcomeHit = teamsMatch && actual === predicted;
  const winnerHit = pred.winnerTeam && officialWinnerTeam(official) !== 'Empate' && sameTeamName(pred.winnerTeam, officialWinnerTeam(official));

  let points = 0;
  if (stage === 'groups') {
    points = exact ? numericRule('groupExact') : outcomeHit ? numericRule('groupOutcome') : 0;
  } else if (stage === 'final') {
    points = exact ? numericRule('finalInitialExact') : winnerHit ? numericRule('finalInitialWinner') : outcomeHit ? numericRule('finalInitialMethod') : 0;
  } else {
    points = exact ? numericRule('knockoutInitialExact') : outcomeHit ? numericRule('knockoutInitialWinner') : 0;
  }

  if (stage === 'round32' && pred && official) {
    const tk = (n) => String(n || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const a = [tk(pred.homeTeam), tk(pred.awayTeam)].sort().join('|');
    const b = [tk(official.homeTeam), tk(official.awayTeam)].sort().join('|');
    if (a && a === b) {
      points += 2;
    }
  }

  const goalsHit = (ph === oh ? oh : 0) + (pa === oa ? oa : 0);
  const goalsMissed = Math.abs(ph - oh) + Math.abs(pa - oa);
  return {
    points,
    exact,
    outcomeHit: outcomeHit || winnerHit,
    goalsHit,
    goalsMissed,
    winHit: (outcomeHit || winnerHit) && actual === 'home' ? 1 : 0,
    drawHit: outcomeHit && actual === 'draw' ? 1 : 0,
    lossHit: (outcomeHit || winnerHit) && actual === 'away' ? 1 : 0,
    played: true
  };
}


function calculateGgamesTable() {
  const rows = publicPredictions.map(item => {
    const stats = {
      id: item.id,
      name: item.participantName || 'Participante',
      icon: item.icon || item.participantIcon || item.playerIcon || '',
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
      if (!official || !isOfficialResultFinished(official)) return;
      const score = scoreOnePrediction(pred, official);
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
}


function predictionResultText(matchPrediction) {
  if (!matchPrediction) return '—';
  
  const homeG = Number(matchPrediction.homeGoals);
  const awayG = Number(matchPrediction.awayGoals);
  const isDraw = homeG === awayG;
  
  // Detetar se é fase de grupos (pelo stage, ou pela falta de dados de desempate)
  const isGroup = matchPrediction.stage === 'groups' || (!matchPrediction.stage && !matchPrediction.method && !matchPrediction.winnerTeam);
  
  let winnerSuffix = '';
  if (!isGroup) {
    const hasMethod = matchPrediction.method === 'et' || matchPrediction.method === 'pens';
    if (isDraw && matchPrediction.winnerTeam && matchPrediction.winnerTeam !== 'Empate') {
      const methodLabel = matchPrediction.method === 'et' ? 'após prolongamento' : matchPrediction.method === 'pens' ? 'após penáltis' : '';
      winnerSuffix = ` · vence ${escapeHtml(matchPrediction.winnerTeam)}${methodLabel ? ` ${methodLabel}` : ''}`;
    } else if (hasMethod) {
      const methodLabel = matchPrediction.method === 'et' ? 'prolongamento' : 'penáltis';
      const winnerName = matchPrediction.winnerTeam && matchPrediction.winnerTeam !== 'Empate' ? `vence ${escapeHtml(matchPrediction.winnerTeam)} ` : '';
      winnerSuffix = ` · ${winnerName}(${methodLabel})`;
    }
  }

  return `${escapeHtml(matchPrediction.homeTeam)} ${matchPrediction.homeGoals}-${matchPrediction.awayGoals} ${escapeHtml(matchPrediction.awayTeam)}${winnerSuffix}`;
}

