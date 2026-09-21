const test = require("node:test");
const assert = require("node:assert/strict");
const {
    calculateMovementBalance,
} = require("../balance-reconciliation-logic");

const season = "2026/2027";

test("corrige para 23 quando o utilizador ganhou 73 e gastou 50", () => {
    const result = calculateMovementBalance([
        {temporada: "20262027", estado: "Palpite Paid", valorreal: 8},
        {temporada: "20262027", estado: "Palpite Paid", valorreal: 8},
        {temporada: "20262027", estado: "Palpite Paid", valorreal: 6},
        {temporada: "20262027", estado: "Palpite Paid", valorreal: 14},
        {temporada: "20262027", estado: "Palpite Paid", valorreal: 12},
        {temporada: "20262027", estado: "Palpite Paid", valorreal: 9},
        {temporada: "20262027", estado: "Palpite Paid", valorreal: 13},
        {temporada: "20262027", estado: "Palpite Paid", valorreal: 3},
        {temporada: "20262027", estado: "CadernetaOffer", valorreal: 0},
        {temporada: "20262027", estado: "Comprado", valorreal: -50},
    ], season);

    assert.equal(result.balance, 23);
    assert.equal(result.movementCount, 10);
});

test("ignora movimentos de mini-gCoins marcados como WhoWins Paid", () => {
    const result = calculateMovementBalance([
        {temporada: "20262027", estado: "WhoWins Paid", valorreal: -100},
        {temporada: "20262027", estado: "Conversão", valorreal: 10},
    ], season);

    assert.equal(result.balance, 10);
    assert.equal(result.movementCount, 1);
});

test("ignora movimentos de outras épocas", () => {
    const result = calculateMovementBalance([
        {temporada: "20252026", estado: "Palpite Paid", valorreal: 90},
        {temporada: "20262027", estado: "Palpite Paid", valorreal: 8},
    ], season);

    assert.equal(result.balance, 8);
    assert.equal(result.movementCount, 1);
});
