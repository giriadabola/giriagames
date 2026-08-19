import { doc, getDoc, collection, setDoc, updateDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

export async function syncMatchesToFirestoreInvestmentHistory(db, userId, clubeId, docId, matches, investmentTimestamp) {
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
                await syncMatchesToFirestoreInvestmentHistory(db, userId, clubeId, invDocId, matches, invTimestamp);
            }
        }
    } catch (e) {
        console.error("Erro no sync de investimentos em background:", e);
    }
}
