import { doc, getDoc, collection, setDoc, updateDoc, arrayUnion, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let cloudflareDetectedGlobal = false;
const footyStatsHtmlCache = new Map();

export function isCloudflareDetected() {
    return cloudflareDetectedGlobal;
}

export function setCloudflareDetected(value) {
    cloudflareDetectedGlobal = value;
}

export function logUserAction(db, auth, actionDescription) {
    if (!auth || !auth.currentUser) return;
    try {
        const eyeCollection = collection(db, 'eye');
        void addDoc(eyeCollection, {
            dataacao: serverTimestamp(),
            acao: actionDescription,
            userId: auth.currentUser.uid
        }).catch((error) => console.error("Erro ao registar a ação na coleção 'eye':", error));
    } catch (error) {
        console.error("Erro ao registar ação na coleção 'eye':", error);
    }
}

export function isCloudflareResponse(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return lower.includes('verificação de segurança') ||
           lower.includes('executando verificação') ||
           lower.includes('cf-challenge') ||
           lower.includes('cloudflare') ||
           lower.includes('just a moment') ||
           lower.includes('security check') ||
           lower.includes('checking your browser') ||
           lower.includes('enable javascript') ||
           lower.includes('turnstile') ||
           lower.includes('verify you are human');
}

export function setCloudflareLoadingState() {
    cloudflareDetectedGlobal = true;
    const loadingScreen = document.getElementById('loading-screen');
    const loadingText = document.getElementById('loading-text');
    if (loadingScreen) {
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';
    }
    if (loadingText) {
        loadingText.innerHTML = '<i class="fas fa-shield-alt" style="color: #f59e0b; margin-right: 6px;"></i> A aguardar verificação de segurança do FootyStats (Cloudflare)... Por favor aguarde um momento.';
    }
}

export async function fetchFootyStatsHtmlWithCloudflareCheck(footystatsId, maxAttempts = 2) {
    if (!footystatsId) return '';
    if (footyStatsHtmlCache.has(footystatsId)) {
        return footyStatsHtmlCache.get(footystatsId);
    }

    const embedUrl = 'https://footystats.org/api/club?id=' + footystatsId;
    const proxies = [
        'https://corsproxy.io/?' + encodeURIComponent(embedUrl),
        'https://api.allorigins.win/raw?url=' + encodeURIComponent(embedUrl),
        'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(embedUrl)
    ];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        for (let i = 0; i < proxies.length; i++) {
            try {
                const resp = await fetch(proxies[i]);
                if (resp.ok) {
                    const text = await resp.text();
                    if (text && text.indexOf('id="matches"') !== -1) {
                        footyStatsHtmlCache.set(footystatsId, text);
                        return text;
                    }
                    if (isCloudflareResponse(text)) {
                        console.warn(`[Cloudflare] Deteção de verificação de segurança no proxy ${proxies[i]}`);
                        setCloudflareLoadingState();
                    }
                }
            } catch(e) {}
        }
        if (attempt < maxAttempts - 1) {
            await new Promise(res => setTimeout(res, 600));
        }
    }
    return '';
}

export function getClubArena(clube, compMapById = {}, compMapByName = {}, compMapByClubId = {}) {
    if (!clube) return null;

    if (clube.competicaoId && compMapById[clube.competicaoId]) {
        return compMapById[clube.competicaoId];
    }

    if (clube.id && compMapByClubId[clube.id]) {
        return compMapByClubId[clube.id];
    }

    if (clube.competicao && compMapByName[String(clube.competicao).trim().toLowerCase()]) {
        return compMapByName[String(clube.competicao).trim().toLowerCase()];
    }

    if (clube.investimentos && Array.isArray(clube.investimentos) && clube.investimentos.length > 0) {
        const invArena = clube.investimentos[0].arena;
        if (invArena && String(invArena).trim() !== '') return invArena;
    }

    return null;
}

export function getClubCountry(clube, compPaisMap = {}, paisesMap = {}, paisesByName = {}) {
    if (!clube) return { id: null, nome: 'Outro', imagem: '' };

    if (clube.paisId && paisesMap[clube.paisId]) {
        return paisesMap[clube.paisId];
    }

    if (clube.competicaoId && compPaisMap[clube.competicaoId] && paisesMap[compPaisMap[clube.competicaoId]]) {
        return paisesMap[compPaisMap[clube.competicaoId]];
    }

    if (clube.pais && paisesByName[String(clube.pais).trim().toLowerCase()]) {
        return paisesByName[String(clube.pais).trim().toLowerCase()];
    }

    return { id: null, nome: clube.pais || 'Outro', imagem: '' };
}

export function canUserAddTeam(clube, userArenaNum) {
    if (!clube) return false;
    const rawArena = clube.resolvedArena || (clube.investimentos && clube.investimentos[0] && clube.investimentos[0].arena);
    if (rawArena === null || rawArena === undefined || String(rawArena).trim() === '') {
        return false;
    }

    const clubArenaNum = parseInt(String(rawArena).replace(/\D/g, ''));
    if (isNaN(clubArenaNum) || clubArenaNum <= 0) {
        return false;
    }

    return clubArenaNum <= userArenaNum;
}

export async function addInvestment(db, userId, clubeId, limitPorPessoa, userChosenIds) {
    if (!clubeId || !userId) return false;

    if (userChosenIds.length >= limitPorPessoa) {
        alert(`Atingiste o limite máximo de ${limitPorPessoa} investimentos por pessoa! Remove um investimento antes de adicionar outra equipa.`);
        return false;
    }

    const nowTs = Date.now();
    const uniqueDocId = `${userId}_${clubeId}_${nowTs}`;

    try {
        const investmentObj = {
            clubeId: clubeId,
            timestamp: nowTs,
            data: nowTs,
            investimentoDocId: uniqueDocId
        };
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            investimentos: arrayUnion(investmentObj)
        });

        const invDocRef = doc(db, 'investimentos', uniqueDocId);
        await setDoc(invDocRef, {
            id: uniqueDocId,
            userId: userId,
            clubeId: clubeId,
            timestamp: nowTs,
            dataInvestimento: nowTs,
            status: 'on',
            historico: []
        }, { merge: true });

        return true;
    } catch (err) {
        console.error("Erro ao adicionar investimento:", err);
        alert("Erro ao adicionar investimento. Tenta novamente.");
        return false;
    }
}

export async function removeInvestment(db, userId, clubeId, userInvestmentDocIdMap) {
    if (!clubeId || !userId) return false;

    try {
        const targetDocId = userInvestmentDocIdMap[clubeId];
        if (targetDocId) {
            try {
                const invDocRef = doc(db, 'investimentos', targetDocId);
                await updateDoc(invDocRef, {
                    status: 'off',
                    dataRemocao: Date.now()
                });
            } catch (se) {
                console.warn("Erro ao atualizar status do investimento para 'off':", se);
            }
        }

        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && Array.isArray(userSnap.data().investimentos)) {
            const currentArr = userSnap.data().investimentos;
            const updatedArr = currentArr.filter(item => {
                if (typeof item === 'string') return item !== clubeId;
                if (item && item.clubeId) return item.clubeId !== clubeId;
                return true;
            });
            await updateDoc(userRef, {
                investimentos: updatedArr
            });
        }
        return true;
    } catch (err) {
        console.error("Erro ao remover investimento:", err);
        alert("Erro ao remover investimento. Tenta novamente.");
        return false;
    }
}

export async function syncMatchesToFirestoreInvestmentHistory(db, userId, clubeId, docId, matches, investmentTimestamp, parseMatchDateStringToTimestamp) {
    if (!userId || !clubeId || !matches || matches.length === 0) return;

    try {
        const targetDocId = docId || `${userId}_${clubeId}`;
        const invDocRef = doc(db, 'investimentos', targetDocId);
        const invSnap = await getDoc(invDocRef);

        let existingHistorico = [];
        let baseTimestamp = investmentTimestamp || 0;

        if (invSnap.exists()) {
            const data = invSnap.data();
            existingHistorico = data.historico || [];
            if (!baseTimestamp && data.timestamp) {
                baseTimestamp = data.timestamp;
            }
        } else {
            await setDoc(invDocRef, {
                id: targetDocId,
                userId: userId,
                clubeId: clubeId,
                timestamp: baseTimestamp || Date.now(),
                dataInvestimento: baseTimestamp || Date.now(),
                status: 'on',
                historico: []
            }, { merge: true });
        }

        const newEntries = [];

        matches.forEach(m => {
            const matchTimestamp = parseMatchDateStringToTimestamp(m.date);

            const isAfterInvestment = baseTimestamp === 0 || matchTimestamp >= (baseTimestamp - (24 * 60 * 60 * 1000));

            const isAlreadyRecorded = existingHistorico.some(h => {
                if (h.data && m.date && h.data.trim().toLowerCase() === m.date.trim().toLowerCase()) return true;
                if (h.rival && m.opponent && h.rival.trim().toLowerCase() === m.opponent.trim().toLowerCase() && h.resultado === m.score) return true;
                return false;
            });

            if (isAfterInvestment && !isAlreadyRecorded) {
                newEntries.push({
                    data: m.date || new Date().toLocaleDateString('pt-PT'),
                    resultadoBadge: (m.resultBadge || 'd').toUpperCase(),
                    resultado: m.score || '0-0',
                    rival: m.opponent || 'Desconhecido',
                    timestamp: matchTimestamp || Date.now()
                });
            }
        });

        if (newEntries.length > 0) {
            console.log(`A gravar ${newEntries.length} jogo(s) no histórico do documento 'investimentos/${targetDocId}'...`);
            await updateDoc(invDocRef, {
                status: 'on',
                historico: arrayUnion(...newEntries)
            });
        }
    } catch (err) {
        console.error("Erro ao sincronizar histórico na coleção 'investimentos':", err);
    }
}
