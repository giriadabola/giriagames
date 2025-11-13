// =================================================================
//          CÓDIGO COMPLETO E FINAL PARA index.js
// =================================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

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

// =================================================================
//          FUNÇÃO EXISTENTE: payDebt (sem alterações)
// =================================================================
exports.payDebt = functions.https.onCall(async (data, context) => {
    // ... O código da sua função payDebt permanece aqui, exatamente como estava ...
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "O utilizador deve estar autenticado.");
    }
    const userId = context.auth.uid;
    const paymentAmount = data.amount;
    if (typeof paymentAmount !== "number" || paymentAmount <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "O valor do pagamento é inválido.");
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
            throw new functions.https.HttpsError("failed-precondition", "O pagamento não pode exceder a dívida total.");
        }
        await db.runTransaction(async (transaction) => {
            const userRef = db.doc(`users/${userId}`);
            const bancaRef = db.doc("paineis/Banca");
            const [userDoc, bancaSnap, ...debtDocs] = await transaction.getAll(userRef, bancaRef, ...debtDocRefs);
            if (!userDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Utilizador não encontrado.");
            }
            const userData = userDoc.data();
            const userName = userData.nometabela || userId;
            const latestGcoinsField = findLatestGcoinsField(userData);
            if (!latestGcoinsField) {
                 throw new functions.https.HttpsError("failed-precondition", "Campo GCoins do utilizador não encontrado.");
            }
            const currentUserGCoins = userData[latestGcoinsField] || 0;
            if (paymentAmount > currentUserGCoins) {
                throw new functions.https.HttpsError("failed-precondition", "Não tem GCoins suficientes.");
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
        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError("internal", "Ocorreu um erro interno ao processar o pagamento.");
        }
    }
});

// =====================================================================
//          FUNÇÃO EXISTENTE: convertCoins (sem alterações)
// =====================================================================
exports.convertCoins = functions.https.onCall(async (data, context) => {
    // ... O código da sua função convertCoins permanece aqui, exatamente como estava ...
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "O utilizador deve estar autenticado para converter moedas.");
    }
    const userId = context.auth.uid;
    const amountToConvert = data.amount;
    if (typeof amountToConvert !== "number" || amountToConvert <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "O valor para conversão deve ser um número positivo.");
    }
    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.doc(`users/${userId}`);
            const bancaRef = db.doc("paineis/Banca");
            const configRef = db.doc("paineis/configuracoes_gerais");
            const [userDoc, bancaDoc, configDoc] = await transaction.getAll(userRef, bancaRef, configRef);
            if (!userDoc.exists || !bancaDoc.exists || !configDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Dados essenciais (utilizador, banca ou config) não encontrados.");
            }
            const userData = userDoc.data();
            const bancaData = bancaDoc.data();
            const configData = configDoc.data();
            const currentUserMiniGCoins = userData.whowinsgCoins || 0;
            const conversionRate = bancaData.taxaWhoWins || 0;
            if (conversionRate <= 0) {
                throw new functions.https.HttpsError("failed-precondition", "A taxa de conversão não está ativa.");
            }
            if (amountToConvert % conversionRate !== 0) {
                throw new functions.https.HttpsError("invalid-argument", `O valor a converter deve ser um múltiplo de ${conversionRate} para não gerar gCoins decimais.`);
            }
            const currentSeason = (configData.temporadaAtual || "").replace("/", "");
            if (!currentSeason) {
                throw new functions.https.HttpsError("failed-precondition", "A temporada atual não está configurada.");
            }
            const gcoinsField = `${currentSeason}GCoins`;
            const currentUserGCoins = userData[gcoinsField] || 0;
            if (amountToConvert > currentUserMiniGCoins) {
                throw new functions.https.HttpsError("failed-precondition", "Não tem mini-gCoins suficientes para esta conversão.");
            }
            const gCoinsGained = Math.floor(amountToConvert / conversionRate); 
            const bankProfit = amountToConvert - gCoinsGained;
            const newMiniGCoins = currentUserMiniGCoins - amountToConvert;
            const newGCoins = currentUserGCoins + gCoinsGained;
            transaction.update(userRef, {
                whowinsgCoins: newMiniGCoins,
                [gcoinsField]: newGCoins,
            });
            if (bankProfit > 0) {
                transaction.update(bancaRef, {
                    valor: admin.firestore.FieldValue.increment(bankProfit),
                });
            }
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
        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError("internal", "Ocorreu um erro interno ao processar a conversão.");
        }
    }
});

// =====================================================================
//          NOVA FUNÇÃO ADICIONADA: simulateWeeklyMatches
// =====================================================================

exports.simulateWeeklyMatches = functions.pubsub.schedule('every monday 01:00')
    .timeZone('Europe/Lisbon')
    .onRun(async (context) => {
        
        console.log('Iniciando simulação semanal de jogos...');

        const configRef = db.doc('paineis/configuracoes_gerais');
        const configSnap = await configRef.get();
        if (!configSnap.exists) {
            console.error("Documento de configurações não encontrado!");
            return null;
        }

        const configData = configSnap.data();
        const seasonIdentifier = configData.temporadaAtual;
        const JORNADAS_PER_SEASON = configData.jornadasPorTemporada || 28;

        const now = new Date();
        const dayOfMonth = now.getDate();
        const currentMonth = now.getMonth();
        const semanaAtual = Math.floor((dayOfMonth - 1) / 7) + 1;

        // --- LÓGICA DE VERIFICAÇÃO MELHORADA ---
        const isNewMonth = currentMonth !== configData.lastSimulationMonth;
        const lastSimulatedWeekForThisMonth = isNewMonth ? 0 : configData.ultimaSemanaSimulada;

        if (semanaAtual <= lastSimulatedWeekForThisMonth) {
            console.log(`A semana ${semanaAtual} (ou uma posterior) já foi simulada este mês. A sair.`);
            return null;
        }
        
        if (isNewMonth) {
             console.log(`Novo mês detetado (${currentMonth}). A simular a semana ${semanaAtual}.`);
        }
        // --- FIM DA LÓGICA DE VERIFICAÇÃO MELHORADA ---

        const clubsQuery = db.collection('endlessclubes').where("temporada", "==", seasonIdentifier);
        const clubsSnapshot = await clubsQuery.get();
        const leagueClubs = clubsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (leagueClubs.length < 2) {
            console.log("Não há clubes suficientes para simular.");
            return null;
        }
        
        const calculateTeamOverall = (club) => {
            if (!club.plantel || !club.treinador) return 100;
            const plantelOverall = club.plantel.reduce((sum, p) => sum + p.overall, 0);
            const treinadorOverall = club.treinador.overall;
            const formacaoOverall = club.formacaoatualpontos || 5;
            return plantelOverall + treinadorOverall + formacaoOverall;
        };

        const calculateTeamChemistry = (club) => {
            if (!club.treinador || !club.estadio) return 50;
            const treinadorQuimica = club.treinador.quimica;
            const estadioAmbiente = club.estadio.ambiente || 15;
            return treinadorQuimica + estadioAmbiente;
        };
        
        const generateScore = (winnerProbability) => {
            let homeScore = 0, awayScore = 0;
            if (Math.random() < 0.20) {
                homeScore = awayScore = Math.floor(Math.random() * 3);
            } else {
                const winnerScore = Math.floor(Math.random() * 3) + 1;
                const loserScore = Math.floor(Math.random() * 2);
                if (Math.random() < winnerProbability) {
                    homeScore = winnerScore; awayScore = loserScore;
                } else {
                    homeScore = loserScore; awayScore = winnerScore;
                }
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

        const currentJornadaInSeason = (semanaAtual - 1) * 7;
        const batch = db.batch();
        const pointsUpdates = {};
        
        for (let i = 0; i < 7; i++) {
            const jornadaNumber = currentJornadaInSeason + i + 1;
            if (jornadaNumber > JORNADAS_PER_SEASON) break;

            let teamsToSchedule = [...leagueClubs].sort(() => 0.5 - Math.random());
            while (teamsToSchedule.length >= 2) {
                const homeTeam = teamsToSchedule.pop();
                const awayTeam = teamsToSchedule.pop();
                const result = simulateMatch(homeTeam, awayTeam);

                if (result.outcome === 'draw') {
                    pointsUpdates[result.homeTeam.id] = (pointsUpdates[result.homeTeam.id] || 0) + 1;
                    pointsUpdates[result.awayTeam.id] = (pointsUpdates[result.awayTeam.id] || 0) + 1;
                } else if (result.outcome === 'home') {
                    pointsUpdates[result.homeTeam.id] = (pointsUpdates[result.homeTeam.id] || 0) + 3;
                } else {
                    pointsUpdates[result.awayTeam.id] = (pointsUpdates[result.awayTeam.id] || 0) + 3;
                }

                const gameLogRef = db.collection('endlessjogos').doc();
                batch.set(gameLogRef, {
                    seasonId: seasonIdentifier,
                    jornada: jornadaNumber,
                    homeTeamId: result.homeTeam.id, awayTeamId: result.awayTeam.id,
                    homeScore: result.homeScore, awayScore: result.awayScore,
                    simulatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        }
        
        for (const clubId in pointsUpdates) {
            if(pointsUpdates[clubId] > 0){
                const clubRef = db.doc(`endlessclubes/${clubId}`);
                batch.update(clubRef, { pontos: admin.firestore.FieldValue.increment(pointsUpdates[clubId]) });
            }
        }
        
        await batch.commit();

        // --- ATUALIZAÇÃO DE CONFIGURAÇÃO CORRIGIDA ---
        // Atualiza a semana e o mês de uma só vez, no final da execução.
        await configRef.update({
            ultimaSemanaSimulada: semanaAtual,
            lastSimulationMonth: currentMonth
        });

        console.log(`Simulação da semana ${semanaAtual} concluída com sucesso.`);
        return null;
    });
