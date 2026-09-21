class MarketPurchaseError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "MarketPurchaseError";
        this.code = code;
    }
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getPlayerSeasonContext(playerData, season) {
    const nestedSeasonData = playerData?.[season];
    const usesSeasonData = isPlainObject(nestedSeasonData);

    return {
        usesSeasonData,
        seasonData: usesSeasonData ? nestedSeasonData : (playerData || {}),
    };
}

function calculateMarketPurchase({
    playerData,
    userData,
    season,
    marketOpen,
}) {
    if (!marketOpen) {
        throw new MarketPurchaseError(
            "failed-precondition",
            "O mercado está fechado.",
        );
    }

    if (!isPlainObject(playerData)) {
        throw new MarketPurchaseError("not-found", "Jogador não encontrado.");
    }

    if (!isPlainObject(userData)) {
        throw new MarketPurchaseError("not-found", "Utilizador não encontrado.");
    }

    const playerContext = getPlayerSeasonContext(playerData, season);
    const playerSeasonData = playerContext.seasonData;

    if (playerData.ativo === false || playerData.retirado === true || playerSeasonData.noMercado !== true) {
        throw new MarketPurchaseError(
            "failed-precondition",
            "Este jogador não está disponível no mercado.",
        );
    }

    if (playerSeasonData.compradopor) {
        throw new MarketPurchaseError(
            "already-exists",
            "Este jogador já foi comprado.",
        );
    }

    const price = playerSeasonData.preco;
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
        throw new MarketPurchaseError(
            "failed-precondition",
            "O preço deste jogador não é válido.",
        );
    }

    const userSeasonData = userData?.[season];
    if (!isPlainObject(userSeasonData)) {
        throw new MarketPurchaseError(
            "failed-precondition",
            "Não existem dados do utilizador para a época ativa.",
        );
    }

    const currentBalance = userSeasonData.GCoins;
    if (typeof currentBalance !== "number" || !Number.isFinite(currentBalance)) {
        throw new MarketPurchaseError(
            "failed-precondition",
            "O saldo de gCoins não é válido.",
        );
    }

    if (currentBalance < price) {
        throw new MarketPurchaseError(
            "failed-precondition",
            "Não tens gCoins suficientes para comprar este jogador.",
        );
    }

    return {
        ...playerContext,
        playerSeasonData,
        userSeasonData,
        price,
        previousBalance: currentBalance,
        newBalance: currentBalance - price,
    };
}

module.exports = {
    MarketPurchaseError,
    calculateMarketPurchase,
    getPlayerSeasonContext,
};
