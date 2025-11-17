// =================================================================
//          CÓDIGO COMPLETO E FINAL PARA index.js
// =================================================================

const { defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");

// INICIALIZAR O ADMIN SDK O MAIS CEDO POSSÍVEL
admin.initializeApp();

const fetch = require("node-fetch");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const sgMail = require("@sendgrid/mail");

const db = admin.firestore();

// =================================================================
//          CONFIGURAÇÃO DO SERVIÇO DE EMAIL (SendGrid)
// =================================================================
const sendgridApiKey = defineString("SENDGRID_KEY");

if (sendgridApiKey.value()) {
    sgMail.setApiKey(sendgridApiKey.value());
} else {
    console.warn("Chave API do SendGrid não configurada (variável de ambiente SENDGRID_KEY). A função de envio de email não funcionará.");
}

// ▼▼▼ CORREÇÃO CORS: Definir os domínios permitidos num só sítio para ser fácil de manter ▼▼▼
const corsOptions = { cors: ["https://giriagames.com", "https://g-games-8a8fc.web.app"] };


// Função Helper para encontrar o campo GCoins mais recente de um utilizador
function findLatestGcoinsField(userData) {
    let latestSeason = 0;
    let latestGcoinsField = null;
    for (const key in userData) {
        if (key.endsWith("GCoins")) {
            const season = parseInt(key.slice(0, 8));
            if (!isNaN(season) && season > latestSeason) {
                latestSeason = season;
                latestGcoinsField = key;
            }
        }
    }
    return latestGcoinsField;
}

// =====================================================================
//          FUNÇÃO PARA RESOLVER O PROBLEMA DE CORS (SINTAXE ATUALIZADA)
// =====================================================================
// ▼▼▼ CORREÇÃO CORS 1/5: Adicionar as opções de CORS ▼▼▼
exports.getRandomUsers = onCall(corsOptions, async (data, context) => {
    const count = parseInt(data.count, 10);
    if (isNaN(count) || count <= 0) {
        throw new HttpsError("invalid-argument", "A contagem deve ser um número positivo.");
    }
    const apiUrl = `https://randomuser.me/api/?gender=male&results=${count}&inc=name,nat`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new HttpsError("unavailable", `O serviço de utilizadores aleatórios falhou com o status: ${response.status}`);
        }
        const responseData = await response.json();
        return responseData.results;
    } catch (error) {
        console.error("Erro ao chamar a API randomuser.me:", error);
        throw new HttpsError("internal", "Ocorreu um erro ao buscar os dados externos.");
    }
});


// =================================================================
//          FUNÇÃO EXISTENTE: payDebt (SINTAXE ATUALIZADA)
// =================================================================
// ▼▼▼ CORREÇÃO CORS 2/5: Adicionar as opções de CORS ▼▼▼
exports.payDebt = onCall(corsOptions, async (data, context) => {
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "O utilizador deve estar autenticado.");
    }
    const userId = context.auth.uid;
    const paymentAmount = data.amount;
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
        await db.runTransaction(async (transaction) => {
            const userRef = db.doc(`users/${userId}`);
            const bancaRef = db.doc("paineis/Banca");
            const [userDoc, bancaSnap, ...debtDocs] = await transaction.getAll(userRef, bancaRef, ...debtDocRefs);
            if (!userDoc.exists) {
                throw new HttpsError("not-found", "Utilizador não encontrado.");
            }
            const userData = userDoc.data();
            const userName = userData.nometabela || userId;
            const latestGcoinsField = findLatestGcoinsField(userData);
            if (!latestGcoinsField) {
                 throw new HttpsError("failed-precondition", "Campo GCoins do utilizador não encontrado.");
            }
            const currentUserGCoins = userData[latestGcoinsField] || 0;
            if (paymentAmount > currentUserGCoins) {
                throw new HttpsError("failed-precondition", "Não tem GCoins suficientes.");
            }
            const userDebtDocuments = [];
            debtDocs.forEach(doc => {
                if (doc.exists) {
                    userDebtDocuments.push({id: doc.id, ...doc.data()});
                }
            });
            const currentSeasonDoc = await db.collection("palpites").orderBy("temporada", "desc").limit(1).get();
            const currentSeason = (currentSeasonDoc.docs[0]?.data()?.temporada || "").replace("/", "");
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
            transaction.update(userRef, {[latestGcoinsField]: newUserBalance});
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
//          FUNÇÃO CORRIGIDA: convertCoins (SINTAXE ATUALIZADA)
// =====================================================================
// ▼▼▼ CORREÇÃO CORS 3/5: Adicionar as opções de CORS ▼▼▼
exports.convertCoins = onCall(corsOptions, async (data, context) => {
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "O utilizador deve estar autenticado para converter moedas.");
    }
    const userId = context.auth.uid;
    const amountToConvert = data.amount;
    if (typeof amountToConvert !== "number" || amountToConvert <= 0) {
        throw new HttpsError("invalid-argument", "O valor para conversão deve ser um número positivo.");
    }
    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.doc(`users/${userId}`);
            const bancaRef = db.doc("paineis/Banca");
            const configRef = db.doc("paineis/configuracoes_gerais");
            const [userDoc, bancaDoc, configDoc] = await transaction.getAll(userRef, bancaRef, configRef);
            if (!userDoc.exists || !bancaDoc.exists || !configDoc.exists) {
                throw new HttpsError("not-found", "Dados essenciais (utilizador, banca ou config) não encontrados.");
            }
            const userData = userDoc.data();
            const bancaData = bancaDoc.data();
            const configData = configDoc.data();
            const currentUserMiniGCoins = userData.whowinsgCoins || 0;
            const conversionRate = bancaData.taxaWhoWins || 0;
            if (conversionRate <= 0) {
                throw new HttpsError("failed-precondition", "A taxa de conversão não está ativa.");
            }
            
            const gCoinsResult = amountToConvert / conversionRate;
            
            if (Math.abs(gCoinsResult - Math.round(gCoinsResult)) > 1e-9) {
                throw new HttpsError("invalid-argument", `O valor a converter deve ser um múltiplo de ${conversionRate} para não gerar gCoins decimais.`);
            }

            const currentSeason = (configData.temporadaAtual || "").replace("/", "");
            if (!currentSeason) {
                throw new HttpsError("failed-precondition", "A temporada atual não está configurada.");
            }
            const gcoinsField = `${currentSeason}GCoins`;
            const currentUserGCoins = userData[gcoinsField] || 0;
            if (amountToConvert > currentUserMiniGCoins) {
                throw new HttpsError("failed-precondition", "Não tem mini-gCoins suficientes para esta conversão.");
            }
            
            const gCoinsGained = Math.round(gCoinsResult);

            const newMiniGCoins = currentUserMiniGCoins - amountToConvert;
            const newGCoins = currentUserGCoins + gCoinsGained;
            transaction.update(userRef, {
                whowinsgCoins: newMiniGCoins,
                [gcoinsField]: newGCoins,
            });

            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            const debitMovRef = db.collection("movimentos").doc();
            transaction.set(debitMovRef, {
                estado: "WhoWins Paid", valorreal: -amountToConvert, userId: userId, para: userId,
                movimentoData: timestamp, temporada: currentSeason, descricao: "Conversão", taxa: conversionRate,
            });
            const creditMovRef = db.collection("movimentos").doc();
            transaction.set(creditMovRef, {
                estado: "Palpite Paid", valorreal: gCoinsGained, userId: userId, para: userId,
                movimentoData: timestamp, temporada: currentSeason, descricao: "Recebido por conversão",
            });
        });
        return { success: true, message: "Conversão bem-sucedida!" };
    } catch (error) {
        console.error("ERRO FINAL NA FUNÇÃO convertCoins:", error);
        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError("internal", "Ocorreu um erro interno ao processar a conversão.");
        }
    }
});

// =====================================================================
//          FUNÇÃO simulateWeeklyMatches (SINTAXE ATUALIZADA)
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
                 lastWeekViewed: admin.firestore.FieldValue.delete(), pontosGastosNestaTemporada: 0 
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
                statsUpdates[homeTeam.id].pontos += 1;
                statsUpdates[homeTeam.id].empates += 1;
                statsUpdates[awayTeam.id].pontos += 1;
                statsUpdates[awayTeam.id].empates += 1;
            } else if (result.outcome === 'home') {
                statsUpdates[homeTeam.id].pontos += 3;
                statsUpdates[homeTeam.id].vitorias += 1;
                statsUpdates[awayTeam.id].derrotas += 1;
            } else { 
                statsUpdates[awayTeam.id].pontos += 3;
                statsUpdates[awayTeam.id].vitorias += 1;
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
        ultimaSemanaSimulada: semanaAtual, lastSimulationMonth: now.getMonth()
    });
    await batch.commit();
    console.log(`Simulação da semana ${semanaAtual} (v7) para a temporada ${seasonIdentifier} concluída.`);
    return null;
});

// =====================================================================
//          FUNÇÃO claimEndlessSeasonWinnings (SINTAXE ATUALIZADA)
// =====================================================================
// ▼▼▼ CORREÇÃO CORS 4/5: Adicionar as opções de CORS ▼▼▼
exports.claimEndlessSeasonWinnings = onCall(corsOptions, async (data, context) => {
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "O utilizador deve estar autenticado.");
    }
    const userId = context.auth.uid;
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
//          FUNÇÃO purchaseUpgrade (SINTAXE ATUALIZADA)
// =====================================================================
// ▼▼▼ CORREÇÃO CORS 5/5: Adicionar as opções de CORS ▼▼▼
exports.purchaseUpgrade = onCall(corsOptions, async (data, context) => {
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "O utilizador deve estar autenticado.");
    }
    const userId = context.auth.uid;
    const { upgradeType, itemId } = data;
    if (!upgradeType) {
        throw new HttpsError("invalid-argument", "O tipo de melhoria é necessário.");
    }
    try {
        const clubRef = db.doc(`endlessclubes/${userId}`);
        return await db.runTransaction(async (transaction) => {
            const clubDoc = await transaction.get(clubRef);
            if (!clubDoc.exists) {
                throw new HttpsError("not-found", "O seu clube não foi encontrado.");
            }
            const clubData = clubDoc.data();
            const totalPontos = clubData.pontos || 0;
            const pontosGastos = clubData.pontosGastosNestaTemporada || 0;
            const recompensaPotencialTotal = Math.floor(totalPontos / 2);
            const dinheiroDisponivel = recompensaPotencialTotal - pontosGastos;
            const custoBase = Math.floor(dinheiroDisponivel * (2/3));
            const custoFinal = Math.max(45, custoBase);
            if (dinheiroDisponivel < custoFinal) {
                throw new HttpsError("failed-precondition", `Não tem fundos suficientes. Precisa de ${custoFinal}, mas só tem ${dinheiroDisponivel} disponíveis.`);
            }
            let updates = {};
            if (upgradeType === 'stadium') {
                const novoNivel = (clubData.estadio.nivel || 1) + 1;
                updates = { 'estadio.nivel': novoNivel };
            } else if (upgradeType === 'tactic' && itemId) {
                const formacoesAtuais = clubData.treinador.formacoesDisponiveis || [];
                if (formacoesAtuais.includes(itemId)) {
                    throw new HttpsError("already-exists", "Você já possui esta tática.");
                }
                updates = {
                    'treinador.formacoesDisponiveis': admin.firestore.FieldValue.arrayUnion(itemId)
                };
            } else {
                throw new HttpsError("invalid-argument", "Tipo de melhoria ou item inválido.");
            }
            updates.pontosGastosNestaTemporada = admin.firestore.FieldValue.increment(custoFinal);
            transaction.update(clubRef, updates);
            return { success: true, message: `Melhoria comprada com sucesso por ${custoFinal}!` };
        });
    } catch (error) {
        console.error("ERRO FINAL NA FUNÇÃO purchaseUpgrade:", error);
        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError("internal", "Ocorreu um erro interno ao processar a compra.");
        }
    }
});


// =====================================================================
//          FUNÇÃO Enviar Notificação de Jogos por Email (SINTAXE ATUALIZADA)
// =====================================================================
exports.enviarNotificacaoDeJogos = onSchedule({
    schedule: 'every 1 hours',
    timeZone: 'Europe/Lisbon',
}, async (event) => {
    
    console.log('Verificando jogos para notificação por email...');
    if (!sendgridApiKey.value()) {
        console.error("A função de email não pode ser executada porque a chave da API do SendGrid não está definida.");
        return null;
    }
    const agora = new Date();
    const umaHoraAtras = new Date(agora.getTime() - 60 * 60 * 1000);
    const jogosParaNotificarSnapshot = await db.collection('jogos')
        .where('inicioIntervalo', '<=', agora)
        .where('inicioIntervalo', '>', umaHoraAtras)
        .where('notificacaoEnviada', '==', false)
        .get();
    if (jogosParaNotificarSnapshot.empty) {
        console.log('Nenhum jogo novo para notificar.');
        return null;
    }
    const jogos = jogosParaNotificarSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const templateDoc = await db.collection('paineis').doc('Email').get();
    if (!templateDoc.exists) {
        console.error('Documento de template (paineis/Email) não encontrado!');
        return null;
    }
    const template = templateDoc.data()['1x']; 
    if (!template) {
        console.error('O campo "1x" contendo o template não foi encontrado no documento "Email".');
        return null;
    }
    const usersSnapshot = await db.collection('users').where('mailing', '==', true).get();
    if (usersSnapshot.empty) {
        console.log('Nenhum utilizador para notificar.');
        return null;
    }
    const recipients = usersSnapshot.docs.map(doc => doc.data().email).filter(Boolean);
    if (recipients.length === 0) {
        console.log('Nenhum utilizador com email válido encontrado.');
        return null;
    }
    const listaDeJogosHtml = jogos.map(jogo => {
        const dataFormatada = jogo.dataJogo.toDate().toLocaleDateString('pt-PT', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        return `<li>${jogo.equipaCasa} x ${jogo.equipaFora} - ${dataFormatada}</li>`;
    }).join('');
    const emailHtml = `
        <p>${template.textoPadrao}</p>
        <ul>${listaDeJogosHtml}</ul>
        <br>
        <img src="${template.urlImagem}" alt="Banner" style="max-width: 100%; height: auto;" />
    `;
    const msg = {
        to: 'no-reply@seu-dominio.com',
        bcc: recipients,
        from: 'notificacoes@seu-dominio.com',
        subject: template.assunto,
        html: emailHtml,
    };
    try {
        await sgMail.send(msg);
        console.log(`Email de notificação enviado para ${recipients.length} utilizadores.`);
        const batch = db.batch();
        jogos.forEach(jogo => {
            const jogoRef = db.collection('jogos').doc(jogo.id);
            batch.update(jogoRef, { notificacaoEnviada: true });
        });
        await batch.commit();
        console.log(`${jogos.length} jogos marcados como notificados.`);
    } catch (error) {
        console.error('Erro ao enviar emails via SendGrid:', error);
        if (error.response) {
            console.error(error.response.body);
        }
    }
    return null;
});
