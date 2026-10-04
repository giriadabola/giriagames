const {HttpsError} = require('firebase-functions/v2/https');
const {amount, id, callable, buildFinanceCommon, requireAccepted, readWallet, bankData} = require('./finance-common');
const {calculateConversion} = require('./finance-logic');

function buildBankFunctions({admin, db, getLatestSeason, compactSeason}) {
    const {runOperation, writeWallet, writeBank, movement} = buildFinanceCommon({admin, db});
    const bankRef = db.doc('paineis/Banca');

    const convertCoins = callable(async request => {
        const spend = amount(request.data?.amount);
        const season = await getLatestSeason();
        return runOperation(request, 'convertCoins', async tx => {
            const userRef = db.doc(`users/${request.auth.uid}`);
            const [userSnap, bankSnap] = await tx.getAll(userRef, bankRef);
            const user = requireAccepted(userSnap);
            const bank = bankData(bankSnap.data(), season);
            const mini = readWallet(user, season, 'mini-gcoins');
            if (spend > mini) throw new HttpsError('failed-precondition', 'Mini-gCoins insuficientes.');
            let conversion;
            try { conversion = calculateConversion(spend, bank.taxaWhoWins, bank.taxaBanca ?? 0); }
            catch (error) { throw new HttpsError('failed-precondition', error.message); }
            const gcoins = readWallet(user, season, 'gcoins');
            writeWallet(tx, userRef, season, 'mini-gcoins', mini - spend);
            writeWallet(tx, userRef, season, 'gcoins', gcoins + conversion.user);
            writeBank(tx, bankRef, season, bank.valor + conversion.bank);
            const common = {userId: request.auth.uid, temporada: compactSeason(season), tipo: 'Conversão', operationId: request.data.operationId};
            movement(tx, {...common, currency: 'mini-gcoins', estado: 'WhoWins Paid', valorreal: -spend, saldoAnterior: mini, saldoPosterior: mini - spend, descricao: 'Conversão (custo)', taxa: bank.taxaWhoWins});
            movement(tx, {...common, currency: 'gcoins', estado: 'Conversão', valorreal: conversion.user, saldoAnterior: gcoins, saldoPosterior: gcoins + conversion.user, descricao: 'Recebido por conversão (líquido)'});
            if (conversion.bank) movement(tx, {tipo: 'Banca', currency: 'gcoins', preco: conversion.bank, temporada: compactSeason(season), descricao: 'Comissão de conversão', origem_userId: request.auth.uid, operationId: request.data.operationId});
            return {success: true, miniBalance: mini - spend, newBalance: gcoins + conversion.user};
        });
    });

    const payDebt = callable(async request => {
        const payment = amount(request.data?.amount);
        const season = await getLatestSeason();
        return runOperation(request, 'payDebt', async tx => {
            const userRef = db.doc(`users/${request.auth.uid}`);
            const [userSnap, bankSnap] = await tx.getAll(userRef, bankRef);
            const debtSnapshot = await tx.get(db.collection('movimentos').where('userId', '==', request.auth.uid));
            const user = requireAccepted(userSnap);
            const balance = readWallet(user, season, 'gcoins');
            const bank = bankData(bankSnap.data(), season);
            const latestSeason = compactSeason(season);
            const debts = debtSnapshot.docs.filter(d => {
                const debt = d.data();
                return debt.tipo === 'Empréstimo' && debt.estado === 'Por Pagar' &&
                    compactSeason(debt.temporada) === latestSeason;
            });
            const total = debts.reduce((sum, doc) => sum + amount(doc.data().valorTotalAPagar, {allowZero: true}), 0);
            if (payment > total || payment > balance) throw new HttpsError('failed-precondition', 'O pagamento excede a dívida ou o saldo disponível.');
            debts.sort((a, b) => (a.data().movimentoData?.toMillis?.() || 0) - (b.data().movimentoData?.toMillis?.() || 0) || a.id.localeCompare(b.id));
            let remaining = payment;
            const allocations = [];
            for (const debt of debts) {
                if (remaining <= 0) break;
                const value = Math.min(remaining, debt.data().valorTotalAPagar);
                const outstanding = debt.data().valorTotalAPagar - value;
                tx.update(debt.ref, {valorTotalAPagar: outstanding, estado: outstanding === 0 ? 'Pago' : 'Por Pagar'});
                allocations.push({debtId: debt.id, amount: value});
                remaining -= value;
            }
            writeWallet(tx, userRef, season, 'gcoins', balance - payment);
            writeBank(tx, bankRef, season, bank.valor + payment);
            movement(tx, {userId: request.auth.uid, currency: 'gcoins', valorreal: -payment, tipo: 'Pagamento Dívida', estado: 'Pago', temporada: compactSeason(season), allocations, operationId: request.data.operationId, saldoAnterior: balance, saldoPosterior: balance - payment});
            movement(tx, {tipo: 'Banca', currency: 'gcoins', preco: payment, temporada: compactSeason(season), origem_userId: request.auth.uid, descricao: 'Pagamento de dívida', operationId: request.data.operationId});
            return {success: true, debt: total - payment, newBalance: balance - payment};
        });
    });

    const grantLoan = callable(async request => {
        const loan = amount(request.data?.amount);
        const interest = amount(request.data?.interest ?? 0, {allowZero: true});
        amount(loan + interest);
        const uid = id(request.data?.userId);
        const season = await getLatestSeason();
        return runOperation(request, 'grantLoan', async tx => {
            const userRef = db.doc(`users/${uid}`);
            const [caller, userSnap, bankSnap] = await tx.getAll(db.doc(`users/${request.auth.uid}`), userRef, bankRef);
            if (!['ruler', 'estafeta'].includes(caller.data()?.estatuto)) throw new HttpsError('permission-denied', 'Apenas a administração pode conceder empréstimos.');
            const user = requireAccepted(userSnap);
            const requestRef = request.data.requestId ? db.doc(`pedidosEmprestimo/${id(request.data.requestId)}`) : null;
            const loanRequest = requestRef ? await tx.get(requestRef) : null;
            if (loanRequest && (!loanRequest.exists || loanRequest.data().estado !== 'Pendente' || loanRequest.data().userId !== uid)) throw new HttpsError('failed-precondition', 'O pedido já foi tratado ou não pertence a este jogador.');
            const bank = bankData(bankSnap.data(), season);
            const balance = readWallet(user, season, 'gcoins');
            writeWallet(tx, userRef, season, 'gcoins', balance + loan);
            // A regra existente permite adiantamentos; não se inventa um limite de liquidez.
            writeBank(tx, bankRef, season, bank.valor - loan);
            movement(tx, {tipo: 'Banca', currency: 'gcoins', preco: -loan, temporada: compactSeason(season), para_userId: uid, descricao: 'Empréstimo', operationId: request.data.operationId});
            const debtId = movement(tx, {userId: uid, currency: 'gcoins', valorreal: loan, tipo: 'Empréstimo', temporada: compactSeason(season), de: 'Banca', descricao: String(request.data.description || 'Empréstimo').slice(0, 500), valorJuros: interest, valorTotalAPagar: loan + interest, estado: 'Por Pagar', saldoAnterior: balance, saldoPosterior: balance + loan, operationId: request.data.operationId});
            if (requestRef) tx.update(requestRef, {estado: 'Concedido', validadoEm: admin.firestore.FieldValue.serverTimestamp(), debtId});
            return {success: true, debtId};
        });
    });

    const adjustBank = callable(async request => {
        const value = request.data?.amount;
        if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new HttpsError('invalid-argument', 'Ajuste inválido.');
        const season = await getLatestSeason();
        return runOperation(request, 'adjustBank', async tx => {
            const [caller, bankSnap] = await tx.getAll(db.doc(`users/${request.auth.uid}`), bankRef);
            if (!['ruler', 'estafeta'].includes(caller.data()?.estatuto)) throw new HttpsError('permission-denied', 'Acesso reservado à administração.');
            const bank = bankData(bankSnap.data(), season);
            writeBank(tx, bankRef, season, bank.valor + value);
            movement(tx, {tipo: 'Banca', currency: 'gcoins', preco: value, temporada: compactSeason(season), descricao: 'Ajuste manual', requestedBy: request.auth.uid, operationId: request.data.operationId});
            return {success: true, balance: bank.valor + value};
        });
    });
    return {convertCoins, payDebt, grantLoan, adjustBank};
}

module.exports = {buildBankFunctions};
