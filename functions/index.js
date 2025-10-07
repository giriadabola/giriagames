// =================================================================
//          CÓDIGO FINAL E CORRIGIDO PARA index.js
// =================================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// Helper function to find the latest GCoins field for a user
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


exports.payDebt = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "O utilizador deve estar autenticado.");
    }

    const userId = context.auth.uid;
    const paymentAmount = data.amount;

    if (typeof paymentAmount !== "number" || paymentAmount <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "O valor do pagamento é inválido.");
    }

    const userRef = db.doc(`users/${userId}`);

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
            // ======================== FASE DE LEITURAS ========================
            const userRef = db.doc(`users/${userId}`);
            const bancaRef = db.doc("paineis/Banca");

            // Ler todos os documentos necessários ANTES de qualquer escrita
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

            // ======================== FASE DE ESCRITAS ========================
            
            // Obter a temporada (esta leitura não é transacional, por isso é segura)
            const currentSeasonDoc = await db.collection("palpites").orderBy("temporada", "desc").limit(1).get();
            const currentSeason = (currentSeasonDoc.docs[0]?.data()?.temporada || "").replace("/", "");

            // Criar movimentos de pagamento
            transaction.set(db.collection("movimentos").doc(), {
                userId: userId, valorreal: -paymentAmount, tipo: "Pagamento Dívida", estado: "Pago",
                movimentoData: admin.firestore.FieldValue.serverTimestamp(), temporada: currentSeason, descricao: "Pagamento à Banca",
            });

            transaction.set(db.collection("movimentos").doc(), {
                tipo: "Banca", preco: paymentAmount, movimentoData: admin.firestore.FieldValue.serverTimestamp(),
                temporada: currentSeason, descricao: `Pagamento de dívida de ${userName}`,
            });

            // Atualizar os documentos de dívida originais
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

            // Atualizar saldo do utilizador
            const newUserBalance = currentUserGCoins - paymentAmount;
            transaction.update(userRef, {[latestGcoinsField]: newUserBalance});

            // Atualizar saldo da banca
            const currentBancaValue = bancaSnap.exists ? (bancaSnap.data().valor || 0) : 0;
            const newBancaValue = currentBancaValue + paymentAmount;
            transaction.set(bancaRef, {valor: newBancaValue}, {merge: true});
        });

        return { success: true };

    } catch (error) {
        console.error("ERRO FINAL NA FUNÇÃO:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError("internal", "Ocorreu um erro interno ao processar o pagamento.");
        }
    }
});
