const {randomInt} = require('node:crypto');
const {callable, buildFinanceCommon} = require('./finance-common');
const {operationHandler, amount, readWallet, fail} = require('./manager-purchases');

// Same lore and weights as caderneta/pack-engine.js. Tests enforce parity.
const PACK_ODDS = {
    normal: {comum: 70, raro: 20, epico: 8, lendario: 2},
    rara: {comum: 40, raro: 40, epico: 15, lendario: 5},
    epica: {comum: 15, raro: 35, epico: 40, lendario: 10},
    lendaria: {comum: 5, raro: 15, epico: 40, lendario: 40},
};
const PACK_KEYS = {normal: 'comum', rara: 'raro', epica: 'epico', lendaria: 'lendario'};
function hasCadernetaAccess(user) {
    const legacy = user.minigames?.caderneta;
    const modern = user.miniGames;
    return legacy === 'on' || legacy === true || modern?.caderneta === true ||
        modern?.caderneta?.estado === true || (Array.isArray(modern) && modern.includes('caderneta'));
}
function drawPlayers(players, packType, count, pick = randomInt) {
    const odds = PACK_ODDS[packType];
    if (!Object.hasOwn(PACK_ODDS, packType)) fail('Saqueta inválida.', 'invalid-argument');
    const groups = Object.keys(odds).map(rarity => ({rarity, weight: odds[rarity],
        players: players.filter(p => (p.miniGames?.caderneta?.casta || 'comum') === rarity),
    })).filter(group => group.players.length);
    if (!groups.length) fail('Não existem jogadores válidos na Caderneta.');
    const total = groups.reduce((sum, group) => sum + group.weight, 0);
    return Array.from({length: count}, () => {
        let roll = pick(total);
        const group = groups.find(entry => (roll -= entry.weight) < 0);
        return {player: group.players[pick(group.players.length)], rarity: group.rarity};
    });
}
function eligiblePlayers(snapshot, season, baseSeason) {
    return snapshot.docs.flatMap(doc => {
        const raw = doc.data();
        const hasSeasons = Object.keys(raw).some(key => /^\d{4}\/\d{4}$/.test(key));
        const data = raw[season] || (!hasSeasons && season === baseSeason ? raw : null);
        if (!data || data.miniGames?.caderneta?.estado !== true ||
            !Object.hasOwn(PACK_ODDS.normal, data.miniGames.caderneta.casta || 'comum')) return [];
        // Return only the public fields needed by the reveal UI; never ownership/private data.
        const player = {id: doc.id, miniGames: {caderneta: data.miniGames.caderneta}};
        for (const key of ['nome', 'imagem', 'pais', 'paisId', 'clube', 'clubeId', 'posicao', 'numero', 'numeroCamisola', 'camisola']) {
            if (['nome', 'imagem', 'pais', 'paisId'].includes(key)) player[key] = raw[key] ?? data[key] ?? '';
            else player[key] = data[key] ?? '';
        }
        return [player];
    });
}
function validateOffer(offer, offerId, uid, compactSeason) {
    if (!offer || offer.userId !== uid) fail('Esta oferta não lhe pertence.', 'permission-denied');
    if (offer.status !== 'pending') fail('Esta oferta já foi resgatada.', 'already-exists');
    const round = Number(offer.ronda);
    const season = offer.temporada;
    if (typeof season !== 'string' || !/^\d{4}\/\d{4}$/.test(season) ||
        !Number.isInteger(round) || round < 1 || round > 5 ||
        offerId !== `${compactSeason(season)}_${round}_${uid}_alfredo` ||
        compactSeason(offer.temporadaKey) !== compactSeason(season) ||
        offer.sourceName !== 'Sr Alfredo' || offer.packType !== 'normal') fail('Configuração da oferta inválida.');
    const count = round >= 4 ? 6 : 1;
    if (offer.cardsCount !== undefined && offer.cardsCount !== count) fail('Quantidade da oferta inválida.');
    return {season, count};
}
function buildCadernetaPurchaseHandlers(deps) {
    const {db, compactSeason} = deps;
    const {writeWallet, movement} = buildFinanceCommon(deps);
    function handler(gift) {
        return operationHandler(deps, gift ? 'claimCadernetaOffer' : 'purchaseCadernetaPack', gift ? 'offerId' : 'packType', async ctx => {
            const {tx, uid, user, userRef, target, timestamp, operationId} = ctx;
            if (!hasCadernetaAccess(user)) fail('Sem acesso à Caderneta.', 'permission-denied');
            let season = ctx.season;
            let packType = target;
            let count = 6;
            let price = 0;
            let currency = 'gcoins';
            let offerRef;
            if (gift) {
                offerRef = db.collection('cadernetaPackOffers').doc(target);
                const snapshot = await tx.get(offerRef);
                ({season, count} = validateOffer(snapshot.data(), target, uid, compactSeason));
                packType = 'normal';
            } else {
                if (!Object.hasOwn(PACK_KEYS, packType)) fail('Saqueta inválida.', 'invalid-argument');
                const settings = await tx.get(db.collection('settings').doc('mini-ggames'));
                const config = settings.data()?.caderneta?.packPricing?.[PACK_KEYS[packType]];
                price = amount(config?.price);
                currency = config?.currency ?? 'gcoins';
                if (!['gcoins', 'mini-gcoins'].includes(currency)) fail('Moeda inválida.');
                const predictions = await tx.get(db.collection('palpites').where('userId', '==', uid));
                const games = new Set(predictions.docs.map(d => d.data())
                    .filter(p => compactSeason(p.temporada) === compactSeason(season) && p.jogoId)
                    .map(p => p.jogoId));
                if (games.size < 30) fail('São necessários 30 jogos palpitados nesta época.');
            }
            const seasons = await tx.get(db.collection('settings').doc('temporadas'));
            const baseSeason = [...(seasons.data()?.temporadas || [])].sort()[0] || '2025/2026';
            const players = eligiblePlayers(await tx.get(db.collection('jogadores')), season, baseSeason);
            const previousBalance = gift ? 0 : readWallet(user, season, currency);
            if (previousBalance < price) fail('Saldo insuficiente.');
            const newBalance = previousBalance - price;
            const drawnPlayers = drawPlayers(players, packType, count);
            // All reads are complete before wallet, offer, stickers, ledger and receipt writes.
            if (gift) tx.update(offerRef, {status: 'claimed', claimedAt: timestamp, claimedFrom: 'caderneta'});
            else writeWallet(tx, userRef, season, currency, newBalance);
            const stickerIds = drawnPlayers.map(draw => {
                const ref = db.collection('caderneta').doc();
                tx.create(ref, {userId: uid, idplayer: draw.player.id, clube: draw.player.clube || '',
                    casta: draw.rarity, estado: true, timestamp, historico: null, Nacaderneta: false,
                    emTroca: false, tradeProposalId: null, temporada: season});
                return ref.id;
            });
            const movementId = movement(tx, {
                descricao: gift ? (count === 1 ? 'Cromo Oferecido' : 'Saqueta Oferecida') : 'Comprou Saqueta',
                para: uid, de: gift ? 'Sr Alfredo' : null,
                estado: gift ? 'CadernetaOffer' : currency === 'mini-gcoins' ? 'WhoWins Paid' : 'CadernetaPaid',
                taxa: null, temporada: compactSeason(season), userId: uid, tipo: 'Caderneta',
                currency, preco: price, valorreal: -price, saldoAnterior: previousBalance, saldoPosterior: newBalance,
                operationId, packType, ...(gift ? {offerId: target} : {}),
            });
            return {success: true, season, packType, currency, price, newBalance, drawnPlayers, stickerIds, movementId};
        });
    }
    return {purchaseCadernetaPack: handler(false), claimCadernetaOffer: handler(true)};
}
function buildCadernetaPurchaseFunctions(deps) {
    const handlers = buildCadernetaPurchaseHandlers(deps);
    return Object.fromEntries(Object.entries(handlers).map(([name, handler]) => [name, callable(handler)]));
}
module.exports = {buildCadernetaPurchaseFunctions, buildCadernetaPurchaseHandlers, PACK_ODDS, drawPlayers, eligiblePlayers, validateOffer};
