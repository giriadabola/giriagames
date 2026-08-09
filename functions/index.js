// =================================================================
//          CÓDIGO COMPLETO E FINAL PARA index.js (v2 + CORS)
// =================================================================

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const {
    processMarketNotifications,
    sendManualMarketNotification,
    sendInboxNotification,
} = require("./market-notifications");

admin.initializeApp();
const db = admin.firestore();

function compactSeason(season) {
    return String(season || '').replace(/\//g, '').trim();
}

function sortSeasons(seasons) {
    return [...new Set((seasons || []).filter((season) => typeof season === 'string' && season.trim()))]
        .sort((a, b) => {
            const getEndYear = (value) => Number(value.match(/\d{4}\s*\/\s*(\d{4})/)?.[1] || 0);
            return getEndYear(b) - getEndYear(a) || b.localeCompare(a);
        });
}

async function getLatestSeason() {
    const settingsSnapshot = await db.collection('settings').doc('temporadas').get();
    const latestConfiguredSeason = sortSeasons(settingsSnapshot.data()?.temporadas)[0];
    if (latestConfiguredSeason) return latestConfiguredSeason;

    const configSnapshot = await db.collection('paineis').doc('configuracoes_gerais').get();
    const fallbackSeason = configSnapshot.data()?.temporadaAtual;
    if (fallbackSeason) return fallbackSeason;

    throw new Error('Época mais recente não configurada.');
}

function getSeasonData(userData, season) {
    const data = userData?.[season];
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

exports.processMarketNotifications = processMarketNotifications;
exports.sendManualMarketNotification = sendManualMarketNotification;
exports.sendInboxNotification = sendInboxNotification;

// =====================================================================
//   footballProxy — Proxy HTTP para SofaScore (sem CORS no servidor)
//   Uso: GET https://<region>-g-games-8a8fc.cloudfunctions.net/footballProxy?team=NK+Varazdin
// =====================================================================
exports.footballProxy = onRequest({
    cors: true,
    invoker: "public",
}, async (req, res) => {
    const teamName = req.query.team || '';
    if (!teamName || teamName.length < 2) {
        return res.status(400).json({ error: 'Parâmetro "team" é obrigatório' });
    }

    try {
        // Função normalizadora de nomes (igual à do browser)
        const normalizeName = (name) => name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

        // Variações de nome a tentar
        const baseName = teamName.replace(/\b(NK|FC|FK|AC|CF|UD|CD|SC|SL|RC|BV|AS|SD)\b\s*/gi, '').trim();
        const namesToTry = [...new Set([teamName, baseName])].filter(n => n && n.length > 1);

        let teamId = null;
        let teamFoundName = '';

        // 1. Pesquisa no SofaScore (servidor não tem restrições CORS)
        for (const name of namesToTry) {
            try {
                const searchResp = await fetch(
                    `https://api.sofascore.com/api/v1/search/all?q=${encodeURIComponent(name)}&page=0`,
                    {
                        headers: {
                            'Accept': 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                            'Referer': 'https://www.sofascore.com/',
                            'Origin': 'https://www.sofascore.com',
                        }
                    }
                );
                if (!searchResp.ok) continue;
                const searchData = await searchResp.json();
                const teams = (searchData.results || []).filter(r => r.type === 'team');
                if (teams.length > 0) {
                    const normName = normalizeName(name);
                    const best = teams.find(t => normalizeName(t.entity.name) === normName) || teams[0];
                    teamId = best.entity.id;
                    teamFoundName = best.entity.name;
                    break;
                }
            } catch (e) {
                console.error(`SofaScore search error for "${name}":`, e.message);
            }
        }

        if (!teamId) {
            return res.status(404).json({ error: `Equipa "${teamName}" não encontrada no SofaScore` });
        }

        // 2. Obter últimos jogos
        const eventsResp = await fetch(
            `https://api.sofascore.com/api/v1/team/${teamId}/events/last/0`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'Referer': 'https://www.sofascore.com/',
                    'Origin': 'https://www.sofascore.com',
                }
            }
        );

        if (!eventsResp.ok) {
            return res.status(502).json({ error: `SofaScore respondeu com status ${eventsResp.status}` });
        }

        const eventsData = await eventsResp.json();
        const events = eventsData.events || [];

        const mappedMatches = events
            .filter(ev =>
                (ev.status?.type === 'finished' || ev.status?.description === 'Ended') &&
                ev.homeScore?.current !== undefined &&
                ev.awayScore?.current !== undefined
            )
            .map(ev => {
                const ts = (ev.startTimestamp || 0) * 1000;
                const d = new Date(ts);
                const day   = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year  = d.getFullYear();
                return {
                    equipa1: ev.homeTeam?.name || '',
                    equipa2: ev.awayTeam?.name || '',
                    dataJogo: `${day}/${month}/${year}`,
                    resultado: `${ev.homeScore.current}-${ev.awayScore.current}`
                };
            })
            .filter(m => m.equipa1 && m.equipa2)
            .reverse()  // Do mais recente para o mais antigo
            .slice(0, 5);

        return res.status(200).json({
            teamId,
            teamName: teamFoundName,
            matches: mappedMatches
        });

    } catch (err) {
        console.error('footballProxy error:', err);
        return res.status(500).json({ error: err.message });
    }
});


// =================================================================
//          FUNÇÃO ATUALIZADA: payDebt (v2 com CORS)
// =================================================================
// Adicionada a opção { cors: ["https://giriagames.com"] }
exports.payDebt = onCall({ cors: ["https://giriagames.com", "http://127.0.0.1:5502"] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "O utilizador deve estar autenticado.");
    }
    const userId = request.auth.uid;
    const paymentAmount = request.data.amount;
    if (typeof paymentAmount !== "number" || paymentAmount <= 0) {
        throw new HttpsError("invalid-argument", "O valor do pagamento é inválido.");
    }
    try {
        const debtQuery = db.collection("movimentos").where("userId", "==", userId).where("estado", "==", "Por Pagar").where("tipo", "==", "Empréstimo");
        const initialDebtSnapshot = await debtQuery.get();
        let totalDebt = 0;
        const debtDocRefs = [];
        initialDebtSnapshot.forEach((doc) => {
            totalDebt += doc.data().valorTotalAPagar || 0;
            debtDocRefs.push(doc.ref);
        });
        if (paymentAmount > totalDebt) {
            throw new HttpsError("failed-precondition", "O pagamento não pode exceder a dívida total.");
        }
        const latestSeason = await getLatestSeason();
        await db.runTransaction(async (transaction) => {
            const userRef = db.doc(`users/${userId}`);
            const bancaRef = db.doc("paineis/Banca");
            const [userDoc, bancaSnap, ...debtDocs] = await transaction.getAll(userRef, bancaRef, ...debtDocRefs);
            if (!userDoc.exists) {
                throw new HttpsError("not-found", "Utilizador não encontrado.");
            }
            const userData = userDoc.data();
            const userName = userData.nometabela || userId;
            const latestSeasonData = getSeasonData(userData, latestSeason);
            const currentUserGCoins = latestSeasonData.GCoins || 0;
            if (paymentAmount > currentUserGCoins) {
                throw new HttpsError("failed-precondition", "Não tem GCoins suficientes.");
            }
            const userDebtDocuments = [];
            debtDocs.forEach(doc => {
                if (doc.exists) {
                    userDebtDocuments.push({id: doc.id, ...doc.data()});
                }
            });
            const currentSeason = compactSeason(latestSeason);
            transaction.set(db.collection("movimentos").doc(), {
                userId: userId, valorreal: -paymentAmount, tipo: "Pagamento Dívida", estado: "Pago",
                movimentoData: admin.firestore.FieldValue.serverTimestamp(), temporada: currentSeason, descricao: "Pagamento à Banca",
            });
            transaction.set(db.collection("movimentos").doc(), {
                tipo: "Banca", preco: paymentAmount, movimentoData: admin.firestore.FieldValue.serverTimestamp(),
                temporada: currentSeason, descricao: `Pagamento de dívida de ${userName}`,
            });
            userDebtDocuments.sort((a, b) => a.movimentoData.toMillis() - b.movimentoData.toMillis());
            let remainingPayment = paymentAmount;
            for (const debtDoc of userDebtDocuments) {
                if (remainingPayment <= 0) break;
                const debtRef = db.collection("movimentos").doc(debtDoc.id);
                const amountToPayFromThisDebt = Math.min(remainingPayment, debtDoc.valorTotalAPagar);
                const newDebtAmount = debtDoc.valorTotalAPagar - amountToPayFromThisDebt;
                const updateData = {
                    valorTotalAPagar: newDebtAmount,
                    estado: newDebtAmount <= 0 ? "Pago" : "Por Pagar",
                };
                transaction.update(debtRef, updateData);
                remainingPayment -= amountToPayFromThisDebt;
            }
            const newUserBalance = currentUserGCoins - paymentAmount;
            transaction.update(userRef, {
                [latestSeason]: {
                    ...latestSeasonData,
                    GCoins: newUserBalance
                }
            });
            const currentBancaValue = bancaSnap.exists ? (bancaSnap.data().valor || 0) : 0;
            const newBancaValue = currentBancaValue + paymentAmount;
            transaction.set(bancaRef, {valor: newBancaValue}, {merge: true});
        });
        return { success: true };
    } catch (error) {
        console.error("ERRO FINAL NA FUNÇÃO payDebt:", error);
        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError("internal", "Ocorreu um erro interno ao processar o pagamento.");
        }
    }
});

// =====================================================================
//          FUNÇÃO ATUALIZADA: convertCoins (v2 com CORS)
// =====================================================================
// Adicionada a opção { cors: ["https://giriagames.com"] }
exports.convertCoins = onCall({ cors: ["https://giriagames.com", "http://127.0.0.1:5502"] }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
    
    const userId = request.auth.uid;
    const amountToConvert = request.data.amount; // O que o user gasta (Mini-gCoins)
    
    if (typeof amountToConvert !== "number" || amountToConvert <= 0) throw new HttpsError("invalid-argument", "Valor inválido.");

    try {
        const latestSeason = await getLatestSeason();
        await db.runTransaction(async (transaction) => {
            const userRef = db.doc(`users/${userId}`);
            const bancaRef = db.doc("paineis/Banca");
            const configRef = db.doc("paineis/configuracoes_gerais");
            const [userDoc, bancaDoc, configDoc] = await transaction.getAll(userRef, bancaRef, configRef);

            if (!userDoc.exists || !bancaDoc.exists || !configDoc.exists) throw new HttpsError("not-found", "Erro de sistema.");

            const userData = userDoc.data();
            const bancaData = bancaDoc.data();
            const configData = configDoc.data();
            const latestSeasonData = getSeasonData(userData, latestSeason);

            const currentUserMiniGCoins = latestSeasonData.whowinsgCoins || 0;
            const conversionRate = bancaData.taxaWhoWins || 0;
            const bankFeeFactor = bancaData.taxaBanca || 0; // Fator decimal (Ex: 0.5 para 50%)

            if (conversionRate <= 0) throw new HttpsError("failed-precondition", "Taxa inativa.");
            if (amountToConvert > currentUserMiniGCoins) throw new HttpsError("failed-precondition", "Saldo insuficiente.");

            // 1. Calcular o TOTAL BRUTO gerado pela conversão
            const grossGCoins = amountToConvert / conversionRate;

            // 2. Calcular a FATIA DA BANCA (Retirada do Bruto)
            const bankCut = grossGCoins * bankFeeFactor; 
            
            // 3. Calcular o LÍQUIDO DO USER (O que sobra)
            const userCut = grossGCoins - bankCut;

            // REGRA DE OURO: Tudo tem de ser número inteiro
            const isInteger = (num) => Math.abs(num - Math.round(num)) < 1e-9;

            if (!isInteger(grossGCoins)) throw new HttpsError("invalid-argument", `O valor inserido gera gCoins decimais (${grossGCoins}). Ajuste a quantidade.`);
            if (!isInteger(bankCut) || !isInteger(userCut)) throw new HttpsError("invalid-argument", "A conversão não permite dividir gCoins. Aumente o valor para que a parte da banca seja inteira.");

            const finalUserGCoins = Math.round(userCut);
            const finalBankGCoins = Math.round(bankCut);
            const currentSeason = compactSeason(latestSeason);

            // Atualizar User: Perde Mini-gCoins, Ganha GCoins Líquidos
            transaction.update(userRef, {
                [latestSeason]: {
                    ...latestSeasonData,
                    whowinsgCoins: currentUserMiniGCoins - amountToConvert,
                    GCoins: (latestSeasonData.GCoins || 0) + finalUserGCoins
                }
            });

            // Atualizar Banca: Ganha a comissão
            if (finalBankGCoins > 0) {
                transaction.update(bancaRef, { valor: (bancaData.valor || 0) + finalBankGCoins });
            }

            // Extrato
            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            
            // Registo de Saída dos Mini
            transaction.set(db.collection("movimentos").doc(), {
                estado: "WhoWins Paid", valorreal: -amountToConvert, userId: userId, para: userId,
                movimentoData: timestamp, temporada: currentSeason, descricao: "Conversão (Custo)", taxa: conversionRate, tipo: "Conversão"
            });

            // Registo de Entrada dos GCoins (LÍQUIDO)
            transaction.set(db.collection("movimentos").doc(), {
                estado: "Conversão", valorreal: finalUserGCoins, userId: userId, para: userId,
                movimentoData: timestamp, temporada: currentSeason, descricao: "Recebido por conversão (Líquido)", tipo: "Conversão"
            });

            // Registo da Banca (Opcional, para controlo)
            if (finalBankGCoins > 0) {
                transaction.set(db.collection("movimentos").doc(), {
                    tipo: "Banca", preco: finalBankGCoins, movimentoData: timestamp, temporada: currentSeason,
                    descricao: `Comissão Conversão (${userId})`, origem_userId: userId
                });
            }
        });
        return { success: true, message: "Sucesso!" };
    } catch (error) {
        console.error(error);
        throw error;
    }
});

// =====================================================================
//          FUNÇÃO ATUALIZADA: simulateWeeklyMatches (v2)
// =====================================================================
exports.simulateWeeklyMatches = onSchedule({
    schedule: 'every monday 01:00',
    timeZone: 'Europe/Lisbon',
}, async (event) => {
    console.log('v7: Iniciando simulação semanal com reinício de temporada...');
    const globalConfigRef = db.doc('paineis/configuracoes_gerais');
    const endlessConfigRef = db.doc('paineis/endless_configuracoes');
    const [globalConfigSnap, endlessConfigSnap] = await Promise.all([globalConfigRef.get(), endlessConfigRef.get()]);
    if (!globalConfigSnap.exists || !endlessConfigSnap.exists) {
        console.error("Documento de configurações (gerais ou endless) não encontrado!");
        return null;
    }
    const seasonIdentifier = globalConfigSnap.data().temporadaAtual;
    const JORNADAS_PER_SEASON = endlessConfigSnap.data().jornadasPorTemporada || 28;
    const now = new Date();
    const dayOfMonth = now.getDate();
    const semanaAtual = Math.floor((dayOfMonth - 1) / 7) + 1;
    const lastSimulatedMonth = endlessConfigSnap.data().lastSimulationMonth;
    if (lastSimulatedMonth !== now.getMonth()) {
        console.log(`NOVA TEMPORADA DETETADA (${now.getMonth()})! A reiniciar estatísticas dos clubes...`);
        const clubsToResetQuery = db.collection('endlessclubes').where("ativo", "==", true);
        const clubsToResetSnapshot = await clubsToResetQuery.get();
        const resetBatch = db.batch();
        clubsToResetSnapshot.forEach(doc => {
            resetBatch.update(doc.ref, {
                pontos: 0, vitorias: 0, empates: 0, derrotas: 0, jogosDisputados: 0,
                golosMarcados: 0, golosSofridos: 0, winningsClaimed: false, 
                lastWeekViewed: admin.firestore.FieldValue.delete()
            });
        });
        await resetBatch.commit();
        console.log("Estatísticas dos clubes reiniciadas para a nova temporada.");
    }
    const currentEndlessConfig = (await endlessConfigRef.get()).data();
    const lastSimulatedWeekForThisMonth = currentEndlessConfig.lastSimulationMonth === now.getMonth() ? currentEndlessConfig.ultimaSemanaSimulada : 0;
    if (semanaAtual <= lastSimulatedWeekForThisMonth) {
        console.log(`A semana ${semanaAtual} já foi simulada este mês. A sair.`);
        return null;
    }
    const clubsQuery = db.collection('endlessclubes').where("temporada", "==", seasonIdentifier).where("ativo", "==", true);
    const clubsSnapshot = await clubsQuery.get();
    let leagueClubs = clubsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (leagueClubs.length < 2) {
        console.log("Não há clubes ativos suficientes para simular.");
        return null;
    }
    function generateRoundRobinSchedule(clubs) {
        const schedule = [];
        const localClubs = [...clubs]; 
        if (localClubs.length % 2 !== 0) localClubs.push({ id: 'BYE', nome: 'Folga' });
        const numRounds = localClubs.length - 1;
        const numMatchesPerRound = localClubs.length / 2;
        const teams = [...localClubs];
        for (let round = 0; round < numRounds; round++) {
            const roundMatches = [];
            for (let match = 0; match < numMatchesPerRound; match++) {
                const home = teams[match];
                const away = teams[teams.length - 1 - match];
                if (home.id !== 'BYE' && away.id !== 'BYE') {
                   if (round % 2 === 0) roundMatches.push({ home, away });
                   else roundMatches.push({ home: away, away: home });
                }
            }
            schedule.push(roundMatches);
            const lastTeam = teams.pop();
            teams.splice(1, 0, lastTeam);
        }
        return schedule;
    }
    const firstHalfSchedule = generateRoundRobinSchedule(leagueClubs);
    const secondHalfSchedule = firstHalfSchedule.map(round => round.map(match => ({ home: match.away, away: match.home })));
    const fullSeasonSchedule = [...firstHalfSchedule, ...secondHalfSchedule];
    const calculateTeamOverall = (club) => {
        if (!club.plantel || !club.treinador) return 100;
        const plantelOverall = club.plantel.reduce((sum, p) => sum + p.overall, 0);
        return plantelOverall + (club.treinador.overall || 0) + (club.formacaoatualpontos || 5);
    };
    const calculateTeamChemistry = (club) => {
        if (!club.treinador || !club.estadio) return 50;
        return (club.treinador.quimica || 0) + (club.estadio.ambiente || 15);
    };
    const generateScore = (winnerProbability) => {
        let homeScore = 0, awayScore = 0;
        if (Math.random() < 0.20) { homeScore = awayScore = Math.floor(Math.random() * 3); } 
        else {
            const winnerScore = Math.floor(Math.random() * 3) + 1;
            const loserScore = Math.floor(Math.random() * 2);
            if (Math.random() < winnerProbability) { homeScore = winnerScore; awayScore = loserScore; }
            else { homeScore = loserScore; awayScore = winnerScore; }
        }
        return { homeScore, awayScore };
    };
    const simulateMatch = (homeTeam, awayTeam) => {
        const homeOverall = calculateTeamOverall(homeTeam);
        const awayOverall = calculateTeamOverall(awayTeam);
        const homeChem = calculateTeamChemistry(homeTeam);
        const awayChem = calculateTeamChemistry(awayTeam);
        const overallDiff = homeOverall - awayOverall;
        let probBase = 0.50 + (overallDiff / 500);
        const chemDiff = homeChem - awayChem;
        const chemModifier = chemDiff / 200;
        const homeAdvantage = 0.05;
        let finalHomeWinProb = Math.max(0.05, Math.min(0.95, probBase + chemModifier + homeAdvantage));
        const { homeScore, awayScore } = generateScore(finalHomeWinProb);
        let outcome = homeScore > awayScore ? 'home' : (awayScore > homeScore ? 'away' : 'draw');
        return { homeTeam, awayTeam, homeScore, awayScore, outcome };
    };
    const jornadaInicialDaSemana = (semanaAtual - 1) * 7;
    const batch = db.batch();
    const statsUpdates = {};
    for (let i = 0; i < 7; i++) {
        const jornadaIndex = jornadaInicialDaSemana + i;
        if (jornadaIndex >= fullSeasonSchedule.length || (jornadaIndex + 1) > JORNADAS_PER_SEASON) break;
        const jornadaNumber = jornadaIndex + 1;
        const matchesForThisJornada = fullSeasonSchedule[jornadaIndex];
        for (const match of matchesForThisJornada) {
            const result = simulateMatch(match.home, match.away);
            const homeTeam = result.homeTeam;
            const awayTeam = result.awayTeam;
            if (!statsUpdates[homeTeam.id]) statsUpdates[homeTeam.id] = { vitorias: 0, empates: 0, derrotas: 0, golosMarcados: 0, golosSofridos: 0, pontos: 0, jogosDisputados: 0 };
            if (!statsUpdates[awayTeam.id]) statsUpdates[awayTeam.id] = { vitorias: 0, empates: 0, derrotas: 0, golosMarcados: 0, golosSofridos: 0, pontos: 0, jogosDisputados: 0 };
            statsUpdates[homeTeam.id].jogosDisputados += 1;
            statsUpdates[awayTeam.id].jogosDisputados += 1;
            statsUpdates[homeTeam.id].golosMarcados += result.homeScore;
            statsUpdates[homeTeam.id].golosSofridos += result.awayScore;
            statsUpdates[awayTeam.id].golosMarcados += result.awayScore;
            statsUpdates[awayTeam.id].golosSofridos += result.homeScore;
            if (result.outcome === 'draw') {
                statsUpdates[homeTeam.id].pontos += 1; statsUpdates[homeTeam.id].empates += 1;
                statsUpdates[awayTeam.id].pontos += 1; statsUpdates[awayTeam.id].empates += 1;
            } else if (result.outcome === 'home') {
                statsUpdates[homeTeam.id].pontos += 3; statsUpdates[homeTeam.id].vitorias += 1;
                statsUpdates[awayTeam.id].derrotas += 1;
            } else { 
                statsUpdates[awayTeam.id].pontos += 3; statsUpdates[awayTeam.id].vitorias += 1;
                statsUpdates[homeTeam.id].derrotas += 1;
            }
            const gameLogRef = db.collection('endlessjogos').doc();
            batch.set(gameLogRef, {
                seasonId: seasonIdentifier, jornada: jornadaNumber, homeTeamId: result.homeTeam.id,
                awayTeamId: result.awayTeam.id, homeScore: result.homeScore, awayScore: result.awayScore,
                simulatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
    for (const clubId in statsUpdates) {
        const clubRef = db.doc(`endlessclubes/${clubId}`);
        const updatesForThisClub = {};
        for (const stat in statsUpdates[clubId]) {
            if (statsUpdates[clubId][stat] > 0) {
                updatesForThisClub[stat] = admin.firestore.FieldValue.increment(statsUpdates[clubId][stat]);
            }
        }
        if (Object.keys(updatesForThisClub).length > 0) {
            batch.update(clubRef, updatesForThisClub);
        }
    }
    batch.update(endlessConfigRef, {
        ultimaSemanaSimulada: semanaAtual,
        lastSimulationMonth: now.getMonth()
    });
    await batch.commit();
    console.log(`Simulação da semana ${semanaAtual} (v7) para a temporada ${seasonIdentifier} concluída.`);
    return null;
});

// =====================================================================
//          FUNÇÃO ATUALIZADA: claimEndlessSeasonWinnings (v2 com CORS)
// =====================================================================
// Adicionada a opção { cors: ["https://giriagames.com"] }
exports.claimEndlessSeasonWinnings = onCall({ cors: ["https://giriagames.com", "http://127.0.0.1:5502"] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "O utilizador deve estar autenticado.");
    }
    const userId = request.auth.uid;
    const now = new Date();
    const dayOfMonth = now.getDate();
    const currentWeek = Math.floor((dayOfMonth - 1) / 7) + 1;
    if (currentWeek !== 4) {
        throw new HttpsError("failed-precondition", "Os prémios só podem ser resgatados na última semana da temporada.");
    }
    try {
        const userClubRef = db.doc(`endlessclubes/${userId}`);
        const userCofreRef = db.doc(`users/${userId}/cofre/geral`);
        return await db.runTransaction(async (transaction) => {
            const [clubDoc, cofreDoc] = await transaction.getAll(userClubRef, userCofreRef);
            if (!clubDoc.exists) {
                throw new HttpsError("not-found", "O seu clube não foi encontrado.");
            }
            const clubData = clubDoc.data();
            if (clubData.winningsClaimed) {
                throw new HttpsError("failed-precondition", "Já resgatou o prémio desta temporada.");
            }
            const globalConfigSnap = await db.doc('paineis/configuracoes_gerais').get();
            const seasonIdentifier = globalConfigSnap.data().temporadaAtual;
            const lastViewed = clubData.lastWeekViewed;
            const userHasSimulatedWeek4 = lastViewed && lastViewed.season === seasonIdentifier && lastViewed.week === 4;
            if (!userHasSimulatedWeek4) {
                 throw new HttpsError("failed-precondition", "Deve primeiro simular os jogos da 4ª semana para se tornar elegível para o prémio.");
            }
            const totalPoints = clubData.pontos || 0;
            const rewardAmount = Math.floor(totalPoints / 2);
            if (rewardAmount <= 0) {
                throw new HttpsError("failed-precondition", "Não tem pontos suficientes para resgatar um prémio.");
            }
            const cofreData = cofreDoc.exists() ? cofreDoc.data() : {};
            const currentEndlessGCoins = cofreData.endlessgCoins || 0;
            const newEndlessGCoins = currentEndlessGCoins + rewardAmount;
            transaction.set(userCofreRef, { endlessgCoins: newEndlessGCoins }, { merge: true });
            transaction.update(userClubRef, { winningsClaimed: true });
            return { success: true, message: `Recebeu ${rewardAmount} mini-gcoins!` };
        });
    } catch (error) {
        console.error("ERRO FINAL NA FUNÇÃO claimEndlessSeasonWinnings:", error);
        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError("internal", "Ocorreu um erro interno ao processar o seu resgate.");
        }
    }
});

// =====================================================================
//          NOVA FUNÇÃO: corsProxy (Proxy CORS seguro)
// =====================================================================
exports.corsProxy = onCall({ cors: ["https://giriagames.com", "http://127.0.0.1:5502", "http://localhost:5502"] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "O utilizador deve estar autenticado.");
    }
    const url = request.data.url;
    if (!url) {
        throw new HttpsError("invalid-argument", "O parâmetro 'url' é obrigatório.");
    }
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            }
        });
        if (!response.ok) {
            throw new HttpsError("failed-precondition", `Erro ao aceder ao destino: ${response.statusText}`);
        }
        const html = await response.text();
        return { html };
    } catch (err) {
        throw new HttpsError("internal", err.message);
    }
});
