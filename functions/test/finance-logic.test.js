const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readWallet, bankData, calculateConversion, movementCurrency} = require('../finance-logic');
const {calculateMovementBalance, parseMovementValue} = require('../balance-reconciliation-logic');
const {calculateMarketPurchase} = require('../market-purchase-logic');
const season = '2026/2027';

test('carteiras isolam épocas e permitem perdas dos Investimentos sem duplicar saldo', () => {
    const user = {whowinsgCoins: 900, '2025/2026': {'mini-gcoins': 500}, [season]: {GCoins: 40, whowinsgCoins: 10, investimentosgCoins: -3}};
    assert.equal(readWallet(user, season, 'mini-gcoins'), 7);
    user[season]['mini-gcoins'] = 2;
    assert.equal(readWallet(user, season, 'mini-gcoins'), 2);
    assert.equal(readWallet(user, '2027/2028', 'mini-gcoins'), 0);
    assert.equal(readWallet(user, season, 'gcoins'), 40);
});
test('conversão valida taxas e não arredonda dinheiro fraccionário silenciosamente', () => {
    assert.deepEqual(calculateConversion(20, 2, 0.2), {gross: 10, bank: 2, user: 8});
    for (const args of [[3, 2, 0.2], [10, 0, 0], [10, 1, -0.1], [10, 1, 1.1], [NaN, 2, 0]]) {
        assert.throws(() => calculateConversion(...args));
    }
});
test('Banca usa saldo e taxas da época, mantendo configuração legada como fallback', () => {
    assert.deepEqual(bankData({valor: 99, taxaWhoWins: 2, [season]: {valor: 10, taxaWhoWins: 4}}, season).valor, 10);
    assert.equal(bankData({valor: 99, [season]: {valor: 0}}, season).valor, 0);
    assert.equal(bankData({valor: 99, [season]: 0}, season).valor, 0);
});
test('reconciliação não mistura prémios mini antigos ou moedas explícitas', () => {
    const movements = ['WhoWins Paid', 'Investimentos Paid', 'Endless Paid'].map(estado => ({estado, valorreal: 99, temporada: season}));
    movements.push({currency: 'mini-gcoins', estado: 'Outro', valorreal: 99, temporada: season});
    movements.push({currency: 'gcoins', estado: 'WhoWins Paid', valorreal: 8, temporada: season});
    assert.equal(calculateMovementBalance(movements, season).balance, 8);
    assert.throws(() => movementCurrency({currency: 'unknown'}));
    assert.equal(parseMovementValue('12junk'), null);
    assert.equal(parseMovementValue(''), null);
});
test('mercado não reutiliza propriedade e preços de outra época', () => {
    assert.throws(() => calculateMarketPurchase({playerData: {noMercado: true, preco: 1, '2025/2026': {}},
        userData: {[season]: {GCoins: 100}}, season, marketOpen: true}), {code: 'failed-precondition'});
});
