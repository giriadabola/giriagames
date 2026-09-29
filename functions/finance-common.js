const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {createHash} = require('node:crypto');
const {finite, readWallet, bankData} = require('./finance-logic');

const ORIGINS = ['https://giriagames.win', 'https://www.giriagames.win', 'https://g-games-8a8fc.web.app',
    ...[5174, 5502, 5503].flatMap(port => [`http://localhost:${port}`, `http://127.0.0.1:${port}`])];

function amount(value, {allowZero = false} = {}) {
    try { finite(value); } catch (error) { throw new HttpsError('invalid-argument', error.message); }
    if (value < 0 || (!allowZero && value === 0)) throw new HttpsError('invalid-argument', 'O montante é inválido.');
    return value;
}

function id(value) {
    if (typeof value !== 'string' || !value.trim() || value.includes('/') || ['.', '..'].includes(value) || value.length > 200) {
        throw new HttpsError('invalid-argument', 'Identificador inválido.');
    }
    return value;
}

function callable(handler) {
    return onCall({cors: ORIGINS}, async request => {
        if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'É necessário iniciar sessão.');
        return handler(request);
    });
}

function buildFinanceCommon({admin, db}) {
    function writeWallet(tx, ref, season, currency, balance) {
        if (!['gcoins', 'mini-gcoins'].includes(currency)) throw new HttpsError('invalid-argument', 'Moeda inválida.');
        finite(balance, 'Saldo');
        tx.set(ref, {[season]: {[currency === 'gcoins' ? 'GCoins' : 'mini-gcoins']: balance}}, {merge: true});
    }
    function writeBank(tx, ref, season, value) {
        finite(value, 'Saldo da Banca');
        tx.set(ref, {[season]: {valor: value}}, {merge: true});
    }
    function movement(tx, fields, movementId) {
        const ref = movementId ? db.collection('movimentos').doc(movementId) : db.collection('movimentos').doc();
        tx.create(ref, {...fields, movimentoData: admin.firestore.FieldValue.serverTimestamp()});
        return ref.id;
    }
    // O registo de operação participa na mesma transacção que os débitos.
    async function runOperation(request, name, handler) {
        const operationId = id(request.data?.operationId);
        const requestHash = createHash('sha256').update(JSON.stringify({name, data: request.data})).digest('hex');
        const key = createHash('sha256').update(`${request.auth.uid}:${name}:${operationId}`).digest('hex');
        const ref = db.collection('financialOperations').doc(key);
        return db.runTransaction(async tx => {
            const previous = await tx.get(ref);
            if (previous.exists) {
                if (previous.data().requestHash !== requestHash) throw new HttpsError('already-exists', 'Este identificador já pertence a outra operação.');
                return previous.data().result;
            }
            const result = await handler(tx);
            tx.create(ref, {userId: request.auth.uid, name, requestHash, result, createdAt: admin.firestore.FieldValue.serverTimestamp()});
            return result;
        });
    }
    return {writeWallet, writeBank, movement, runOperation};
}

function requireAccepted(snapshot) {
    if (!snapshot.exists || snapshot.data().aceite !== 'Yes') throw new HttpsError('permission-denied', 'O utilizador não tem acesso ao jogo.');
    return snapshot.data();
}

module.exports = {amount, id, callable, buildFinanceCommon, requireAccepted, readWallet, bankData, ORIGINS};
