const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {
    MarketPurchaseError,
    calculateMarketPurchase,
} = require("./market-purchase-logic");

const ALLOWED_ORIGINS = [
    "https://g-games-8a8fc.web.app",
    "https://giriagames.win",
    "https://www.giriagames.win",
    "http://127.0.0.1:5174",
    "http://localhost:5174",
    "http://127.0.0.1:5502",
    "http://localhost:5502",
    "http://127.0.0.1:5503",
    "http://localhost:5503",
];

function timestampToMillis(value) {
    if (value && typeof value.toMillis === "function") {
        return value.toMillis();
    }

    if (value && typeof value.toDate === "function") {
        return value.toDate().getTime();
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isMarketOpen(scheduleSnapshot, nowMillis) {
    return scheduleSnapshot.docs.some((scheduleDocument) => {
        const schedule = scheduleDocument.data();
        const openingMillis = timestampToMillis(schedule.abertura);
        const closingMillis = timestampToMillis(schedule.fechamento);

        return Number.isFinite(openingMillis) &&
            Number.isFinite(closingMillis) &&
            nowMillis >= openingMillis &&
            nowMillis <= closingMillis;
    });
}

function validatePlayerId(value) {
    const playerId = typeof value === "string" ? value.trim() : "";

    if (!playerId || playerId.length > 1500 || playerId.includes("/")) {
        throw new HttpsError("invalid-argument", "O jogador indicado não é válido.");
    }

    return playerId;
}

function buildMarketPurchaseFunction({admin, db, getLatestSeason, compactSeason}) {
    return onCall({
        invoker: "public",
        cors: ALLOWED_ORIGINS,
    }, async (request) => {
        if (!request.auth?.uid) {
            throw new HttpsError("unauthenticated", "É necessário iniciar sessão.");
        }

        const userId = request.auth.uid;
        const playerId = validatePlayerId(request.data?.playerId);

        try {
            const season = await getLatestSeason();
            const userRef = db.collection("users").doc(userId);
            const playerRef = db.collection("jogadores").doc(playerId);
            const movementRef = db.collection("movimentos").doc();
            const schedulesQuery = db.collection("paineis")
                .doc("Banca")
                .collection("horarioMercado");

            return await db.runTransaction(async (transaction) => {
                const [userSnapshot, playerSnapshot] = await transaction.getAll(
                    userRef,
                    playerRef,
                );
                const scheduleSnapshot = await transaction.get(schedulesQuery);

                if (!userSnapshot.exists) {
                    throw new MarketPurchaseError(
                        "not-found",
                        "Utilizador não encontrado.",
                    );
                }

                if (!playerSnapshot.exists) {
                    throw new MarketPurchaseError(
                        "not-found",
                        "Jogador não encontrado.",
                    );
                }

                const userData = userSnapshot.data();
                const playerData = playerSnapshot.data();
                if (userData.aceite !== "Yes") {
                    throw new MarketPurchaseError(
                        "permission-denied",
                        "Este utilizador não tem autorização para comprar jogadores.",
                    );
                }

                const purchase = calculateMarketPurchase({
                    playerData,
                    userData,
                    season,
                    marketOpen: isMarketOpen(scheduleSnapshot, Date.now()),
                });
                const timestamp = admin.firestore.FieldValue.serverTimestamp();

                if (purchase.usesSeasonData) {
                    transaction.update(
                        playerRef,
                        new admin.firestore.FieldPath(season, "compradopor"),
                        userId,
                        new admin.firestore.FieldPath(season, "dataCompra"),
                        timestamp,
                        "temporadaCompra",
                        season,
                    );
                } else {
                    transaction.update(playerRef, {
                        compradopor: userId,
                        dataCompra: timestamp,
                        temporadaCompra: season,
                    });
                }

                transaction.update(
                    userRef,
                    new admin.firestore.FieldPath(season, "GCoins"),
                    purchase.newBalance,
                );

                transaction.create(movementRef, {
                    userId,
                    jogadorId: playerId,
                    posicao: purchase.playerSeasonData.posicao || "",
                    preco: purchase.price,
                    estado: "Comprado",
                    valorreal: -purchase.price,
                    de: userId,
                    para: null,
                    mediapontos: null,
                    movimentoData: timestamp,
                    temporada: compactSeason(season),
                    tipo: "Mercado",
                    saldoAnterior: purchase.previousBalance,
                    saldoPosterior: purchase.newBalance,
                    descricao: `Comprado por ${userData.nometabela || userData.nomeDeUsuario || "Utilizador"}`,
                });

                return {
                    success: true,
                    playerId,
                    movementId: movementRef.id,
                    season,
                    price: purchase.price,
                    previousBalance: purchase.previousBalance,
                    newBalance: purchase.newBalance,
                };
            });
        } catch (error) {
            if (error instanceof HttpsError) {
                throw error;
            }

            if (error instanceof MarketPurchaseError) {
                throw new HttpsError(error.code, error.message);
            }

            console.error("Erro ao comprar jogador no mercado:", {
                userId,
                playerId,
                error,
            });
            throw new HttpsError(
                "internal",
                "Não foi possível concluir a compra. Nenhuma alteração foi gravada.",
            );
        }
    });
}

module.exports = {
    buildMarketPurchaseFunction,
    isMarketOpen,
    timestampToMillis,
};
