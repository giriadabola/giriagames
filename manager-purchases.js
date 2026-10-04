const {HttpsError} = require('firebase-functions/v2/https');
const {callable, buildFinanceCommon, readWallet} = require('./finance-common');

// Strict local validation also rejects malformed canonical balances.
function fail(message, code = 'failed-precondition') { throw new HttpsError(code, message); }
function identifier(value) {
    if (typeof value !== 'string' || !value || value.length > 180 || value.includes('/')) {
        fail('Identificador inválido.', 'invalid-argument');
    }
    return value;
}
function amount(value, allowZero = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
        (!allowZero && value === 0) || value > Number.MAX_SAFE_INTEGER) fail('Valor inválido.');
    return value;
}
function lisbonDay(value = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(value);
    return ['year', 'month', 'day'].map(key => parts.find(p => p.type === key).value).join('-');
}
function available(rule, day) {
    if (!rule || (typeof rule === 'string' && !rule.trim())) return true;
    if (typeof rule !== 'string') return false;
    rule = rule.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(rule)) return rule === day;
    const date = new Date(`${day}T00:00:00Z`);
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    if (days[date.getUTCDay()].toLowerCase() === rule.toLowerCase()) return true;
    const match = rule.match(/^(\d{1,2})(Domingo|Segunda|Terça|Quarta|Quinta|Sexta|Sábado)$/i);
    if (!match || !Number(match[1])) return false;
    const weekday = days.findIndex(d => d.toLowerCase() === match[2].toLowerCase());
    if (date.getUTCDay() !== weekday) return false;
    const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    first.setUTCDate(1 + (weekday - first.getUTCDay() + 7) % 7);
    return ((date - first) / 86400000) % Number(match[1]) === 0;
}

// handler must finish all reads before writing. Its result is persisted for retries.
function operationHandler(deps, name, targetKey, handler) {
    const {db, admin, getLatestSeason} = deps;
    const {runOperation} = buildFinanceCommon(deps);
    return async request => {
        if (!request.auth?.uid) fail('É necessário iniciar sessão.', 'unauthenticated');
        const uid = request.auth.uid;
        const operationId = identifier(request.data?.operationId);
        const target = identifier(request.data?.[targetKey]);
        const userRef = db.collection('users').doc(uid);
        const season = await getLatestSeason();
        if (typeof season !== 'string' || !/^\d{4}\/\d{4}$/.test(season)) fail('Época inválida.');
        return runOperation(request, name, async tx => {
            const snapshot = await tx.get(userRef);
            if (!snapshot.exists || snapshot.data().aceite !== 'Yes') fail('Utilizador sem autorização.', 'permission-denied');
            const user = snapshot.data();
            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            const result = await handler({tx, uid, user, userRef, season, target, timestamp, operationId});
            return result;
        });
    };
}

function buildManagerPurchaseHandler(deps) {
    const {db, admin, compactSeason} = deps;
    return operationHandler(deps, 'purchaseManagerItem', 'itemId', async ctx => {
        const {tx, uid, user, userRef, season, target, timestamp, operationId} = ctx;
        const itemRef = db.collection('managerItens').doc(target);
        const itemSnap = await tx.get(itemRef);
        const menu = await tx.get(db.collection('paineis').doc('paineis menu'));
        if (user.estatuto !== 'ruler' && (menu.data()?.manager !== 'on' || user.permissoes?.manager !== 'yes')) {
            fail('Sem acesso ao Manager.', 'permission-denied');
        }
        if (!itemSnap.exists) fail('Item inexistente.', 'not-found');
        const item = itemSnap.data();
        if (item.noMercado !== true || !item.nome || !item.tipo) fail('Item indisponível.');
        const mentalidade = item.tipo === 'Mentalidade';
        const stadium = item.tipo === 'Estádio';
        const price = amount(item.valor ?? (mentalidade ? 0 : undefined), true);
        const data = user[season] || {};
        const day = lisbonDay();
        if (!available(item.diaDisponivel || item.dataMercado, day)) fail('Item não disponível hoje.');
        const history = await tx.get(db.collection('movimentos').where('userId', '==', uid).where('tipo', '==', 'Manager'));
        const owned = history.docs.map(d => d.data()).filter(m => compactSeason(m.temporada) === compactSeason(season));
        if (owned.some(m => m.itemManager === item.nome) || (mentalidade && data.mentalidade) || (stadium && data.estadio)) {
            fail('Já possui este item.', 'already-exists');
        }
        // The item shop has a daily limit; initial mentality/stadium choices retain their existing flow.
        if (!mentalidade && !stadium && (data.managerPurchaseDay === day || owned.some(m => {
            const date = m.movimentoData?.toDate?.() || m.movimentoData;
            return date && lisbonDay(date) === day;
        }))) fail('Limite Diário Atingido');
        if (item.nivel === 'Nível 2' && !owned.some(m => m.managerTipo === item.tipo && m.nivel === 'Nível 1')) {
            fail('Requisito: Nível 1 necessário.');
        }
        // Verify the configured attachment chain against this season's chosen branch.
        let parentId = item.anexadoItemId;
        const visited = new Set([target]);
        while (parentId) {
            identifier(parentId);
            if (visited.has(parentId) || visited.size > 30) fail('Hierarquia de itens inválida.');
            visited.add(parentId);
            const parentSnap = await tx.get(db.collection('managerItens').doc(parentId));
            if (!parentSnap.exists) fail('Item principal inexistente.');
            const parent = parentSnap.data();
            if (parent.tipo === 'Mentalidade' && data.mentalidade !== parentId) fail('Mentalidade incompatível.');
            if (parent.tipo === 'Estádio' && data.estadio !== parent.nome) fail('É necessário possuir o estádio.');
            if (!['Mentalidade', 'Estádio'].includes(parent.tipo) && !owned.some(m => m.itemManager === parent.nome)) {
                fail('É necessário possuir o item principal.');
            }
            parentId = parent.anexadoItemId;
        }
        if (stadium && !item.anexadoItemId) fail('Estádio sem mentalidade configurada.');
        let lockRef;
        if (stadium) {
            lockRef = db.collection('stadiumLocks').doc(identifier(item.nome));
            const lock = await tx.get(lockRef);
            const previous = await tx.get(db.collection('movimentos').where('tipo', '==', 'Manager').where('itemManager', '==', item.nome));
            if (lock.exists || previous.docs.some(d => d.data().managerTipo === 'Estádio')) fail('Este estádio já foi adquirido.');
        }
        const previousBalance = readWallet(user, season, 'gcoins');
        if (previousBalance < price) fail('Saldo insuficiente');
        const newBalance = previousBalance - price;
        const fields = [new admin.firestore.FieldPath(season, 'GCoins'), newBalance,
            new admin.firestore.FieldPath(season, 'managerPurchaseDay'), day];
        if (mentalidade) fields.push(new admin.firestore.FieldPath(season, 'mentalidade'), target);
        if (stadium) fields.push(new admin.firestore.FieldPath(season, 'estadio'), item.nome);
        if (item.tipo === 'Formações') fields.push(new admin.firestore.FieldPath(season, 'tática'), admin.firestore.FieldValue.arrayUnion(item.nome));
        tx.update(userRef, ...fields);
        if (lockRef) tx.create(lockRef, {boughtByUid: uid, boughtByName: user.nomeDeUsuario || '', boughtAt: timestamp, stadiumId: target});
        const movementRef = db.collection('movimentos').doc();
        tx.create(movementRef, {
            userId: uid, itemId: target, itemManager: item.nome, managerTipo: item.tipo,
            nivel: item.nivel || 'Nível 1', imagem: item.imagem || null,
            estado: mentalidade ? 'Escolhido' : 'Comprado', tipo: 'Manager',
            currency: 'gcoins', preco: price, valorreal: -price, saldoAnterior: previousBalance,
            saldoPosterior: newBalance, temporada: compactSeason(season), movimentoData: timestamp, operationId,
        });
        if (!mentalidade && !stadium) {
            tx.update(itemRef, {compradoPorUids: admin.firestore.FieldValue.arrayUnion(uid)});
            tx.create(db.collection('managerMercado').doc(), {
                itemNome: item.nome, itemPreco: price, compradorId: uid,
                compradorNome: user.nomeDeUsuario || 'Nome Desconhecido', dataCompra: timestamp,
                tipoItem: item.tipo, nivelItem: item.nivel || 'Nível 1', temporada: compactSeason(season),
            });
        }
        return {success: true, itemId: target, season, currency: 'gcoins', price, previousBalance, newBalance, movementId: movementRef.id};
    });
}
function buildManagerPurchaseFunction(deps) {
    return callable(buildManagerPurchaseHandler(deps));
}
module.exports = {buildManagerPurchaseFunction, buildManagerPurchaseHandler,
    operationHandler, identifier, amount, readWallet, fail, available, lisbonDay};
