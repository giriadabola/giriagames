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
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "O utilizador deve estar autenticado.");
    }

    const userId = context.auth.uid;
    const paymentAmount = data.amount;

    if (typeof paymentAmount !== "number" || paymentAmount <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "O valor do pagamento é inválido.");
    }

    try {
        const debtQuery = db.collection("movimentos")
            .where("userId", "==", userId)
            .where("estado", "==", "Por Pagar")
            .where("tipo", "==", "Empréstimo");

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
//          NOVA FUNÇÃO ADICIONADA: convertCoins
// =====================================================================
exports.convertCoins = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "O utilizador deve estar autenticado para converter moedas."
      );
    }
  
    const userId = context.auth.uid;
    const amountToConvert = data.amount;
  
    if (typeof amountToConvert !== "number" || amountToConvert <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "O valor para conversão deve ser um número positivo."
      );
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

        // --- INÍCIO DA NOVA LÓGICA DE VALIDAÇÃO ---
        // Verifica se a divisão resulta num número inteiro.
        // O operador '%' (módulo) devolve o resto de uma divisão. Se for 0, a divisão é exata.
        if (amountToConvert % conversionRate !== 0) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `O valor a converter deve ser um múltiplo de ${conversionRate} para não gerar gCoins decimais.`
            );
        }
        // --- FIM DA NOVA LÓGICA DE VALIDAÇÃO ---

        const currentSeason = (configData.temporadaAtual || "").replace("/", "");
        if (!currentSeason) {
          throw new functions.https.HttpsError("failed-precondition", "A temporada atual não está configurada.");
        }
        const gcoinsField = `${currentSeason}GCoins`;
        const currentUserGCoins = userData[gcoinsField] || 0;
  
        if (amountToConvert > currentUserMiniGCoins) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Não tem mini-gCoins suficientes para esta conversão."
          );
        }
  
        // Agora, a divisão será sempre um número inteiro, pelo que Math.floor não é estritamente necessário, mas é uma boa prática
        const gCoinsGained = Math.floor(amountToConvert / conversionRate); 
        
        // Se a taxa não for 1, o lucro continua a ser a diferença, que agora representa a "taxa"
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
