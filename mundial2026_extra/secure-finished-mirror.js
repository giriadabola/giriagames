/* Secure HT: espelho imutavel de jogos terminados. */
(() => {
const SECURE_FINISHED_MIN_DELAY_MS = 3 * 60 * 60 * 1000;
const SECURE_FINISHED_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const secureMirrorInFlight = new Set();
let secureFinishedSweepTimer = null;

function resolveMatchStateKickoffMs(matchDoc = {}) {
  const kickoffMs = ggamesFirestoreTimestampToMillis(matchDoc.kickoff);
  if (kickoffMs) return kickoffMs;
  if (matchDoc.date) {
    const dateMs = getMatchDateObj({ date: matchDoc.date, time: matchDoc.time || '12:00' }).getTime();
    if (!Number.isNaN(dateMs)) return dateMs;
  }
  const local = (data?.matches || []).find(m => String(m.id) === String(matchDoc.matchId));
  if (!local) return null;
  const localMs = getMatchDateObj({ date: local.date, time: local.time || '12:00' }).getTime();
  return Number.isNaN(localMs) ? null : localMs;
}

function shouldMirrorMatchStateDocToSecure(docId, raw = {}) {
  const normalized = normalizeMatchStateDoc(docId, raw);
  if (!normalized.matchId || raw.status !== 'finished' || normalized.status !== 'finished' || normalized.finished !== true) return false;
  const kickoffMs = ggamesFirestoreTimestampToMillis(raw.kickoff);
  return kickoffMs != null && Date.now() >= kickoffMs + SECURE_FINISHED_MIN_DELAY_MS;
}

function shouldFinalizeMissingMatchStatus(raw = {}) {
  if (raw.status === 'finished') return false;
  if (raw.finished !== true) return false;
  const kickoffMs = ggamesFirestoreTimestampToMillis(raw.kickoff);
  return kickoffMs != null && Date.now() >= kickoffMs + SECURE_FINISHED_MIN_DELAY_MS;
}

function buildSecureFinishedPayload(docId, raw = {}) {
  const normalized = normalizeMatchStateDoc(docId, raw);
  return {
    documentId: raw.documentId || raw.matchDocId || docId,
    matchDocId: raw.matchDocId || docId,
    matchId: normalized.matchId,
    homeTeam: raw.homeTeam || normalized.homeTeam || null,
    awayTeam: raw.awayTeam || normalized.awayTeam || null,
    stage: raw.stage || normalized.stage || null,
    stageLabel: raw.stageLabel || normalized.stageLabel || null,
    group: raw.group || normalized.group || null,
    date: raw.date || normalized.date || null,
    time: raw.time || normalized.time || null,
    timezone: raw.timezone || normalized.timezone || null,
    city: raw.city || normalized.city || null,
    country: raw.country || normalized.country || null,
    venue: raw.venue || normalized.venue || null,
    kickoff: raw.kickoff || null,
    kickoffIso: raw.kickoffIso || null,
    status: 'finished',
    finished: true,
    live: false,
    homeGoals: normalized.homeGoals ?? raw.homeGoals ?? null,
    awayGoals: normalized.awayGoals ?? raw.awayGoals ?? null,
    winnerTeam: raw.winnerTeam || normalized.winnerTeam || null,
    timeElapsed: 'FT',
    sealedAt: firebaseTools?.serverTimestamp ? firebaseTools.serverTimestamp() : new Date().toISOString()
  };
}

async function ensureFinishedStatusOnMatchStateDoc(docId, raw = {}) {
  if (!firestoreDb || !firebaseTools?.doc || !firebaseTools?.setDoc) return raw;
  if (!shouldFinalizeMissingMatchStatus(raw)) return raw;

  try {
    const ref = firebaseTools.doc(firestoreDb, FIREBASE_MATCHES_COLLECTION, String(docId));
    await firebaseTools.setDoc(ref, { status: 'finished' }, { merge: true });
    console.info(`[SecureHT] Status finished gerado em ${docId}.`);
    return { ...raw, status: 'finished' };
  } catch (error) {
    console.warn(`[SecureHT] Nao foi possivel gerar status finished em ${docId}.`, error);
    return raw;
  }
}

async function createSecureFinishedOnce(ref, payload) {
  if (firebaseTools?.runTransaction) {
    await firebaseTools.runTransaction(firestoreDb, async (transaction) => {
      const snap = await transaction.get(ref);
      if (snap.exists()) return;
      transaction.set(ref, payload);
    });
    return;
  }

  const snap = await firebaseTools.getDoc(ref);
  if (!snap.exists()) {
    await firebaseTools.setDoc(ref, payload);
  }
}

async function syncMatchStateDocToSecureCollection(docId, raw = {}) {
  if (!firestoreDb || !firebaseTools || !firebaseTools.getDoc || !firebaseTools.setDoc) return;
  if (!shouldMirrorMatchStateDocToSecure(docId, raw)) return;

  const syncKey = String(docId);
  if (secureMirrorInFlight.has(syncKey)) return;
  secureMirrorInFlight.add(syncKey);

  try {
    const payload = buildSecureFinishedPayload(docId, raw);
    const ref = firebaseTools.doc(firestoreDb, FIREBASE_SECURE_FINISHED_COLLECTION, syncKey);
    await createSecureFinishedOnce(ref, payload);
  } catch (error) {
    console.warn('Nao foi possivel selar o resultado final na colecao segura.', error);
  } finally {
    secureMirrorInFlight.delete(syncKey);
  }
}

async function scanMatchStateDocsToSecureCollection() {
  if (!firestoreDb || !firebaseTools?.getDocs || !firebaseTools?.collection) return;
  try {
    const snap = await firebaseTools.getDocs(firebaseTools.collection(firestoreDb, FIREBASE_MATCHES_COLLECTION));
    console.info(`[SecureHT] A verificar ${snap.docs.length} jogos para selar.`);
    await Promise.all(snap.docs.map(async (docSnap) => {
      const raw = docSnap.data();
      const repaired = await ensureFinishedStatusOnMatchStateDoc(docSnap.id, raw);
      await syncMatchStateDocToSecureCollection(docSnap.id, repaired);
    }));
  } catch (error) {
    console.warn('Nao foi possivel fazer a verificacao periodica da colecao segura.', error);
  }
}

function startSecureFinishedMirrorSweep() {
  if (secureFinishedSweepTimer) clearInterval(secureFinishedSweepTimer);
  void scanMatchStateDocsToSecureCollection();
  secureFinishedSweepTimer = setInterval(scanMatchStateDocsToSecureCollection, SECURE_FINISHED_SWEEP_INTERVAL_MS);
}

window.resolveMatchStateKickoffMs = resolveMatchStateKickoffMs;
window.shouldMirrorMatchStateDocToSecure = shouldMirrorMatchStateDocToSecure;
window.shouldFinalizeMissingMatchStatus = shouldFinalizeMissingMatchStatus;
window.buildSecureFinishedPayload = buildSecureFinishedPayload;
window.ensureFinishedStatusOnMatchStateDoc = ensureFinishedStatusOnMatchStateDoc;
window.syncMatchStateDocToSecureCollection = syncMatchStateDocToSecureCollection;
window.scanMatchStateDocsToSecureCollection = scanMatchStateDocsToSecureCollection;
window.startSecureFinishedMirrorSweep = startSecureFinishedMirrorSweep;
})();
