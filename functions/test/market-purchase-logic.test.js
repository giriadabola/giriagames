const test = require("node:test");
const assert = require("node:assert/strict");
const {
    MarketPurchaseError,
    calculateMarketPurchase,
} = require("../market-purchase-logic");

const season = "2026/2027";

function buildPlayer(overrides = {}) {
    return {
        nome: "Jogador",
        ativo: true,
        retirado: false,
        [season]: {
            noMercado: true,
            compradopor: "",
            preco: 50,
            posicao: "Guarda-Redes",
            ...overrides,
        },
    };
}

function buildUser(balance = 73) {
    return {
        nometabela: "Utilizador",
        [season]: {
            GCoins: balance,
            Pontos: 10,
        },
    };
}

test("desconta o preço ao saldo atual sem recalcular ganhos anteriores", () => {
    const result = calculateMarketPurchase({
        playerData: buildPlayer(),
        userData: buildUser(73),
        season,
        marketOpen: true,
    });

    assert.equal(result.previousBalance, 73);
    assert.equal(result.price, 50);
    assert.equal(result.newBalance, 23);
});

test("recusa a compra quando o saldo é insuficiente", () => {
    assert.throws(() => calculateMarketPurchase({
        playerData: buildPlayer(),
        userData: buildUser(49),
        season,
        marketOpen: true,
    }), (error) => (
        error instanceof MarketPurchaseError &&
        error.code === "failed-precondition"
    ));
});

test("recusa jogadores já comprados", () => {
    assert.throws(() => calculateMarketPurchase({
        playerData: buildPlayer({compradopor: "outro-utilizador"}),
        userData: buildUser(),
        season,
        marketOpen: true,
    }), (error) => (
        error instanceof MarketPurchaseError &&
        error.code === "already-exists"
    ));
});

test("recusa compras com o mercado fechado", () => {
    assert.throws(() => calculateMarketPurchase({
        playerData: buildPlayer(),
        userData: buildUser(),
        season,
        marketOpen: false,
    }), (error) => (
        error instanceof MarketPurchaseError &&
        error.code === "failed-precondition"
    ));
});
