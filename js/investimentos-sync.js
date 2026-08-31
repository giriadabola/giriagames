import { doc, getDoc, collection, setDoc, updateDoc, arrayUnion, addDoc, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getLatestSeason, getSeasonData } from '../core/user-season.js';

export function parseMatchDateStringToTimestamp(dateStr) {
    if (!dateStr) return Date.now();
    try {
        let clean = dateStr.replace(/^[A-Za-z]+,\s*/, '');
        clean = clean.replace(/(\d+)(st|nd|rd|th)/i, '$1');
        const parsedDate = new Date(clean);
        if (!isNaN(parsedDate.getTime())) {
            if (!/\d{4}/.test(clean)) {
                parsedDate.setFullYear(new Date().getFullYear());
            }
            return parsedDate.getTime();
        }
    } catch(e) {}
    return Date.now();
}

export function extractMatchesFromEmbedHtml(html) {
    const matches = [];
    if (!html) return matches;
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const liElements = doc.querySelectorAll('#matches ul.matches li, ul.matches li');

        for (let i = 0; i < liElements.length; i++) {
            const li = liElements[i];
            const linkEl = li.querySelector('a');
            const dateEl = li.querySelector('.date');
            const resultEl = li.querySelector('.result');
            if (!linkEl) continue;

            const matchText = linkEl.textContent.trim();
            const matchDate = dateEl ? dateEl.textContent.trim() : '';
            const resultBadge = resultEl ? resultEl.textContent.trim().toLowerCase() : 'd';
            
            let score = '';
            let opponent = matchText;

            const matchReg = matchText.match(/(\d+-\d+)\s+vs\s+(.+)/i);
            if (matchReg) {
                score = matchReg[1].trim();
                opponent = matchReg[2].trim();
            }

            matches.push({
                date: matchDate,
                score: score,
                opponent: opponent,
                resultBadge: resultBadge
            });
        }
    } catch(e) {
        console.error("Erro ao extrair jogos do HTML:", e);
    }
    return matches;
}

export function calculateValorReal(arenaNum, badge) {
    const b = String(badge || '').toUpperCase();
    if (arenaNum === 4) {
        if (b === 'W') return 4;
        if (b === 'L') return -3;
        return 0;
    } else if (arenaNum === 5) {
        if (b === 'W') return 7;
        if (b === 'L') return -4;
        return 0;
    }
    return 0;
}

export async function syncMatchesToFirestoreInvestmentHistory(db, userId, clubeId, docId, matches, investmentTimestamp, arenaNum) {
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
                const badge = (m.resultBadge || 'd').toUpperCase();
                const valorreal = calculateValorReal(arenaNum, badge);
                newEntries.push({
                    data: m.date || new Date().toLocaleDateString('pt-PT'),
                    resultadoBadge: badge,
                    resultado: m.score || '0-0',
                    rival: m.opponent || 'Desconhecido',
                    timestamp: matchTimestamp || Date.now(),
                    valorreal: valorreal
                });
            }
        });

        if (newEntries.length > 0) {
            console.log(`[Sync] A gravar ${newEntries.length} novo(s) jogo(s) no histórico de 'investimentos/${targetDocId}'...`);
            await updateDoc(invDocRef, {
                status: 'on',
                historico: arrayUnion(...newEntries)
            });
        }
    } catch (err) {
        console.error("Erro ao sincronizar histórico na coleção 'investimentos':", err);
    }
}

export async function processInvestmentEarningsAndBalances(db, userId) {
    if (!userId) return;
    try {
        const activeSeasonKey = await getLatestSeason(db);
        const seasonFormatted = activeSeasonKey ? activeSeasonKey.replace('/', '') : '';

        // 1. Obter registos existentes em 'movimentos' para evitar duplicações
        const movQuery = query(
            collection(db, 'movimentos'),
            where('userId', '==', userId),
            where('estado', '==', 'Investimentos Paid')
        );
        const movSnap = await getDocs(movQuery);
        const recordedGamesSet = new Set();
        movSnap.forEach(d => {
            const data = d.data();
            if (data.jogo) recordedGamesSet.add(data.jogo);
        });

        // 2. Obter investimentos do utilizador
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;

        const userInvestments = userSnap.data().investimentos || [];
        if (!Array.isArray(userInvestments) || userInvestments.length === 0) return;

        for (const item of userInvestments) {
            let clubeId = '';
            let invDocId = '';

            if (typeof item === 'string') {
                clubeId = item;
                invDocId = `${userId}_${clubeId}`;
            } else if (item && typeof item === 'object' && item.clubeId) {
                clubeId = item.clubeId;
                invDocId = item.investimentoDocId || `${userId}_${clubeId}`;
            }

            if (!clubeId) continue;

            const clubeSnap = await getDoc(doc(db, 'clubes', clubeId));
            let arenaNum = 0;
            let clubeNome = 'Equipa';
            if (clubeSnap.exists()) {
                const cData = clubeSnap.data();
                clubeNome = cData.nome || cData.clube || cData.nomeDeUsuario || 'Equipa';
                const arenaStr = cData.arena || (cData.investimentos && cData.investimentos[0] && cData.investimentos[0].arena) || '';
                arenaNum = parseInt(String(arenaStr).replace(/\D/g, '')) || 0;
            }

            const invDocRef = doc(db, 'investimentos', invDocId);
            const invSnap = await getDoc(invDocRef);
            if (!invSnap.exists()) continue;

            const invData = invSnap.data();
            const historico = invData.historico || [];
            let historicoUpdated = false;

            for (let i = 0; i < historico.length; i++) {
                const h = historico[i];
                const badge = (h.resultadoBadge || 'D').toUpperCase();
                const matchValorReal = calculateValorReal(arenaNum, badge);

                if (h.valorreal === undefined) {
                    h.valorreal = matchValorReal;
                    historicoUpdated = true;
                }

                const jogoStr = `${clubeNome} vs ${h.rival || 'Rival'} - ${h.data}`;

                if (!recordedGamesSet.has(jogoStr)) {
                    await addDoc(collection(db, 'movimentos'), {
                        userId: userId,
                        valorreal: matchValorReal,
                        estado: 'Investimentos Paid',
                        tipo: 'Investimento',
                        clubeId: clubeId,
                        jogo: jogoStr,
                        data: h.data || new Date().toLocaleDateString('pt-PT'),
                        timestamp: h.timestamp || Date.now(),
                        temporada: seasonFormatted,
                        movimentoData: serverTimestamp()
                    });
                    recordedGamesSet.add(jogoStr);
                }
            }

            if (historicoUpdated) {
                await updateDoc(invDocRef, { historico: historico });
            }
        }

        // 3. Recalcular total de investimentosgCoins
        const updatedMovSnap = await getDocs(movQuery);
        let totalInvestimentosGCoins = 0;
        updatedMovSnap.forEach(d => {
            totalInvestimentosGCoins += (d.data().valorreal || 0);
        });

        // 4. Atualizar documento do utilizador na temporada ativa
        let latestSeason = '';
        try {
            latestSeason = await getLatestSeason(db);
        } catch (se) {
            console.warn("Não foi possível obter a época mais recente:", se);
        }

        const freshUserSnap = await getDoc(userRef);
        if (freshUserSnap.exists()) {
            const userData = freshUserSnap.data();
            const seasonData = latestSeason ? getSeasonData(userData, latestSeason) : {};
            const whowins = seasonData.whowinsgCoins || userData.whowinsgCoins || 0;
            const totalMiniGCoins = whowins + totalInvestimentosGCoins;

            const updateData = {};
            if (latestSeason) {
                updateData[latestSeason] = {
                    ...seasonData,
                    investimentosgCoins: totalInvestimentosGCoins,
                    'mini-gcoins': totalMiniGCoins
                };
            }
            updateData.investimentosgCoins = totalInvestimentosGCoins;
            updateData['mini-gcoins'] = totalMiniGCoins;

            await updateDoc(userRef, updateData);
        }

    } catch (err) {
        console.error("Erro no processamento de rendimentos dos investimentos:", err);
    }
}

export async function syncUserInvestmentsHistory(db, userId) {
    if (!userId) return;
    try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (!userSnap.exists() || !Array.isArray(userSnap.data().investimentos)) return;

        const userInvestments = userSnap.data().investimentos;
        if (userInvestments.length === 0) return;

        for (const item of userInvestments) {
            let clubeId = '';
            let invTimestamp = 0;
            let invDocId = '';

            if (typeof item === 'string') {
                clubeId = item;
                invDocId = `${userId}_${clubeId}`;
            } else if (item && typeof item === 'object' && item.clubeId) {
                clubeId = item.clubeId;
                invTimestamp = item.timestamp || item.data || 0;
                invDocId = item.investimentoDocId || `${userId}_${clubeId}`;
            }

            if (!clubeId) continue;

            const clubeSnap = await getDoc(doc(db, 'clubes', clubeId));
            if (!clubeSnap.exists()) continue;

            const arenaStr = clubeSnap.data().arena || (clubeSnap.data().investimentos && clubeSnap.data().investimentos[0] && clubeSnap.data().investimentos[0].arena) || '';
            const arenaNum = parseInt(String(arenaStr).replace(/\D/g, '')) || 0;

            const rawEmbed = clubeSnap.data().investimentoembed;
            let footystatsId = '';
            if (rawEmbed) {
                const idMatch = String(rawEmbed).match(/id=(\d+)/i);
                if (idMatch && idMatch[1]) {
                    footystatsId = idMatch[1];
                } else if (/^\d+$/.test(String(rawEmbed).trim())) {
                    footystatsId = String(rawEmbed).trim();
                }
            }

            if (!footystatsId) continue;

            const embedUrl = 'https://footystats.org/api/club?id=' + footystatsId;
            let html = '';
            
            const proxies = [
                'https://corsproxy.io/?' + encodeURIComponent(embedUrl),
                'https://api.allorigins.win/raw?url=' + encodeURIComponent(embedUrl),
                'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(embedUrl)
            ];

            for (let i = 0; i < proxies.length; i++) {
                try {
                    const resp = await fetch(proxies[i]);
                    if (resp.ok) {
                        const text = await resp.text();
                        if (text && text.indexOf('id="matches"') !== -1) {
                            html = text;
                            break;
                        }
                    }
                } catch(e) {}
            }

            if (html) {
                const matches = extractMatchesFromEmbedHtml(html);
                await syncMatchesToFirestoreInvestmentHistory(db, userId, clubeId, invDocId, matches, invTimestamp, arenaNum);
            }
        }

        // Processar os ganhos e atualizar saldos em movimentos e users
        await processInvestmentEarningsAndBalances(db, userId);

    } catch (e) {
        console.error("Erro no sync de investimentos em background:", e);
    }
}
