const {HttpsError} = require("firebase-functions/v2/https");
const {createHash} = require("node:crypto");
const {callable, buildFinanceCommon, readWallet, bankData} = require("./finance-common");

// These collections deliberately have no client rules. Inbox is only a UI projection:
// its participants can edit it, so it cannot establish the seller's consent.
const fail = (message, code = "failed-precondition") => { throw new HttpsError(code, message); };
const object = value => value && typeof value === "object" && !Array.isArray(value);
function id(value) {
    if (typeof value !== "string" || !value.trim() || value.includes("/") ||
        value === "." || value === ".." || Buffer.byteLength(value) > 500) {
        fail("Identificador inválido.", "invalid-argument");
    }
    return value;
}
function money(value, signed = false) {
    if (typeof value !== "number" || !Number.isFinite(value) ||
        Math.abs(value) > Number.MAX_SAFE_INTEGER || (!signed && value < 0)) {
        fail("Valor financeiro inválido.");
    }
    return value;
}
function playerContext(player, season) {
    if (object(player[season])) return {data: player[season], nested: true};
    if (Object.keys(player).some(key => /^\d{4}\/\d{4}$/.test(key)) ||
        (player.temporadaCompra && player.temporadaCompra !== season)) {
        fail("O jogador não tem dados para a época ativa.");
    }
    return {data: player, nested: false};
}
function allowedUser(user) {
    if (user.aceite !== "Yes") fail("Utilizador sem autorização.", "permission-denied");
}
function saleAvailable(player, data, bank) {
    if ((player.ativo ?? data.ativo) === false || (player.retirado ?? data.retirado) === true) {
        fail("Este jogador não está disponível para venda.");
    }
    if (bank.dataVendaBanca) {
        const date = bank.dataVendaBanca;
        const millis = typeof date.toMillis === "function" ? date.toMillis() : new Date(date).getTime();
        if (!Number.isFinite(millis) || Date.now() < millis) fail("A venda de jogadores está bloqueada.");
    }
}
function documentData(snapshot) {
    if (!snapshot.exists) fail("Registo não encontrado.", "not-found");
    return snapshot.data();
}

function buildPlayerSaleFunctions({admin, db, getLatestSeason, compactSeason}) {
    const finance = buildFinanceCommon({admin, db});
    const ref = (collection, key) => db.collection(collection).doc(key);
    const timestamp = () => admin.firestore.FieldValue.serverTimestamp();
    const field = (...parts) => new admin.firestore.FieldPath(...parts);
    const balance = (user, season) => money(readWallet(user, season, "gcoins"), true);
    const setBalance = (tx, userRef, season, value) =>
        finance.writeWallet(tx, userRef, season, "gcoins", money(value, true));
    const digest = parts => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

    async function execute(kind, request) {
        const uid = request.auth?.uid;
        if (!uid) fail("É necessário iniciar sessão.", "unauthenticated");
        const input = request.data || {};
        const proposing = kind === "accept" && input.action === "propose";
        if (input.action !== undefined && !proposing) fail("Ação inválida.", "invalid-argument");
        const accepting = kind === "accept" && !proposing;
        const key = accepting ? id(input.proposalId) : id(input.operationId);
        const operationRef = ref("playerSaleOperations", digest(accepting ?
            ["accept", key] : [kind, proposing, uid, key]));
        const season = await getLatestSeason();
        if (!/^\d{4}\/\d{4}$/.test(season)) fail("Época ativa inválida.");

        return finance.runOperation(request, `player-sale-${kind}`, async tx => {
            const receipt = await tx.get(operationRef);
            if (receipt.exists) {
                const saved = receipt.data();
                if (saved.uid !== uid) fail("Operação não autorizada.", "permission-denied");
                if (!accepting && (saved.result.playerId !== input.playerId ||
                    saved.result.season !== input.season ||
                    (proposing && saved.result.buyerId !== input.buyerId))) {
                    fail("Este identificador já foi usado noutra operação.");
                }
                return saved.result;
            }
            let offer;
            let inboxRef;
            if (accepting) {
                inboxRef = ref("inbox", key);
                const [offerSnap, inboxSnap] = await tx.getAll(ref("playerSaleOffers", key), inboxRef);
                if (!offerSnap.exists) fail("Esta proposta deve ser reenviada pelo vendedor.");
                offer = offerSnap.data();
                if (offer.para !== uid) fail("Esta proposta não lhe é dirigida.", "permission-denied");
                if (offer.temporada !== season || !inboxSnap.exists || inboxSnap.data().status !== true) {
                    fail("Esta proposta já não está disponível.");
                }
            } else if (input.season !== season) {
                fail("A época mudou. Atualize a página.");
            }
            const playerId = id(accepting ? offer.jogadorId : input.playerId);
            const sellerId = accepting ? id(offer.de) : uid;
            const buyerId = proposing ? id(input.buyerId) : (accepting ? uid : null);
            if (buyerId === sellerId) fail("Não pode vender a si próprio.", "invalid-argument");
            const playerRef = ref("jogadores", playerId);
            const sellerRef = ref("users", sellerId);
            const bankRef = ref("paineis", "Banca");
            const [playerSnap, sellerSnap] = await tx.getAll(playerRef, sellerRef);
            const player = documentData(playerSnap);
            const seller = documentData(sellerSnap);
            const context = playerContext(player, season);
            const data = context.data;
            allowedUser(seller);
            if (data.compradopor !== sellerId) fail("O jogador já não pertence ao vendedor.");
            let bank, buyer, buyerRef, price = 0, fee = 0, proceeds = 0;
            if (kind !== "return") {
                bank = bankData(documentData(await tx.get(bankRef)), season);
                saleAvailable(player, data, bank);
                price = money(data.preco);
                if (buyerId) {
                    if (seller.permissoes?.vender !== "yes") fail("Sem permissão para vender jogadores.", "permission-denied");
                    buyerRef = ref("users", buyerId);
                    buyer = documentData(await tx.get(buyerRef));
                    allowedUser(buyer);
                    if (buyer[season]?.natabela !== "Yes") fail("O destinatário não é um gPlayer disponível.");
                    fee = Math.min(price, money(bank.comissaoBancaVenda ?? 0));
                    proceeds = price - fee;
                } else {
                    proceeds = Math.max(0, price - money(bank.descontoBanca ?? 0));
                }
            }
            if (proposing) {
                const proposalId = operationRef.id;
                const proposal = {de: uid, para: buyerId, jogadorId: playerId, preco: price,
                    temporada: season, ownershipDate: data.dataCompra || null,
                    status: true, tipo: "Venda", data: timestamp()};
                const result = {success: true, proposalId, playerId, buyerId, season, price};
                tx.create(ref("playerSaleOffers", proposalId), proposal);
                tx.create(ref("inbox", proposalId), proposal);
                tx.create(operationRef, {uid, result, createdAt: timestamp()});
                return result;
            }
            if (accepting) {
                if (offer.preco !== price) fail("O preço mudou. Peça uma nova proposta.");
                const toMillis = date => date?.toMillis?.() ?? date ?? null;
                if (toMillis(offer.ownershipDate) !== toMillis(data.dataCompra)) {
                    fail("Esta proposta pertence a uma aquisição anterior.");
                }
            }
            // Read competitors before writes; bounding the query keeps the transaction
            // within Firestore's write limit. Never settle without invalidating them.
            const pending = await tx.get(db.collection("inbox").where("jogadorId", "==", playerId).limit(401));
            if (pending.size > 400) fail("Existem demasiadas propostas. Contacte o administrador.");
            let previousBalance, newBalance;
            if (kind !== "return") {
                previousBalance = balance(seller, season);
                newBalance = money(previousBalance + proceeds, true);
                const bankBalance = money(bank.valor);
                if (!accepting && bankBalance < proceeds) fail("A Banca não tem saldo suficiente.");
                if (accepting && balance(buyer, season) < price) fail("Não tem GCoins suficientes.");
                setBalance(tx, sellerRef, season, newBalance);
                if (accepting) setBalance(tx, buyerRef, season, balance(buyer, season) - price);
                finance.writeBank(tx, bankRef, season, money(bankBalance + (accepting ? fee : -proceeds)));
            }
            const ownerPath = context.nested ? field(season, "compradopor") : field("compradopor");
            tx.update(playerRef, ownerPath, buyerId);
            if (accepting) tx.update(playerRef,
                context.nested ? field(season, "dataCompra") : field("dataCompra"), timestamp(),
                "temporadaCompra", season);
            for (const proposal of pending.docs) {
                if (proposal.data().status === true) tx.update(proposal.ref, {
                    status: false, estado: accepting && proposal.id === key ? "Aceite" : "Expirado",
                });
            }
            if (accepting) tx.update(inboxRef, {status: false, estado: "Aceite"});
            const movement = (suffix, details) => finance.movement(tx, {
                jogadorId: playerId, posicao: data.posicao || "", mediapontos: null,
                movimentoData: timestamp(), temporada: compactSeason(season),
                tipo: "Mercado", currency: "gcoins", operationId: operationRef.id, ...details,
            }, `${operationRef.id}-${suffix}`);
            movement("seller", {userId: sellerId, de: sellerId, para_userId: buyerId,
                estado: accepting ? "Vendido" : "Devolvido", preco: accepting ? price : proceeds,
                valorreal: proceeds,
                ...(kind === "return" ? {} : {saldoAnterior: previousBalance, saldoPosterior: newBalance}),
                descricao: kind === "return" ? "Devolvido ao Mercado sem reembolso" : accepting ?
                    `Venda de jogador ${player.nome || ""} (Comissão da Banca: ${fee} gCoins)` :
                    `Vendido à Banca com desconto de ${bank.descontoBanca ?? 0} gCoins`,
            });
            if (accepting) movement("buyer", {userId: buyerId, de: sellerId, para_userId: buyerId,
                estado: "Comprado", preco: -price, valorreal: -price,
                saldoAnterior: balance(buyer, season), saldoPosterior: balance(buyer, season) - price,
                descricao: `Compra de jogador ${player.nome || ""}`});
            if (kind !== "return") movement("bank", {tipo: "Banca", preco: accepting ? fee : -proceeds,
                para_userId: sellerId, descricao: accepting ? "Comissão de venda de jogador" : `Compra de jogador ${player.nome || ""}`});
            const result = {success: true, playerId, season, price, proceeds, fee};
            tx.create(operationRef, {uid, result, createdAt: timestamp()});
            return result;
        });
    }
    const endpoint = kind => callable(async request => {
        try { return await execute(kind, request); } catch (error) {
            if (error instanceof HttpsError) throw error;
            console.error("Erro na operação de jogador:", error);
            throw new HttpsError("internal", "Não foi possível concluir a operação. Tente novamente.");
        }
    });
    return {sellPlayerToBank: endpoint("bank"), acceptPlayerSale: endpoint("accept"), returnPlayer: endpoint("return")};
}

module.exports = {buildPlayerSaleFunctions};
