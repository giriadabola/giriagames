const {createHash} = require("node:crypto");
const {HttpsError} = require("firebase-functions/v2/https");
const {callable, buildFinanceCommon, readWallet} = require("./finance-common");

const MINI_STATES = new Set(["WhoWins Paid", "Investimentos Paid", "Endless Paid"]);
const POINT_STATES = new Set(["Palpite Paid", "Mod Play"]);
const WALLET = {gcoins: "GCoins", "mini-gcoins": "mini-gcoins"};

function invalid(message) {
    throw new HttpsError("invalid-argument", message);
}

function text(value, name, max = 500) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
        invalid(`Campo inválido: ${name}.`);
    }
    return value.trim();
}

function identifier(value, name) {
    const result = text(value, name, 200);
    if (result.includes("/") || result === "." || result === "..") invalid(`ID inválido: ${name}.`);
    return result;
}

function seasonLabel(value) {
    const match = String(value || "").match(/^(\d{4})\/?(\d{4})$/);
    if (!match || Number(match[2]) !== Number(match[1]) + 1) invalid("Época inválida.");
    return `${match[1]}/${match[2]}`;
}

function currencyOf(entry) {
    if (entry.currency !== undefined) {
        if (!Object.hasOwn(WALLET, entry.currency)) invalid("Moeda inválida.");
        return entry.currency;
    }
    return MINI_STATES.has(entry.estado) ? "mini-gcoins" : "gcoins";
}

function amount(value) {
    // Legacy numeric strings are accepted, but never partial numbers or empty values.
    if ((typeof value !== "number" && typeof value !== "string") ||
        String(value).trim() === "" || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > 1e12) {
        invalid("Valor do movimento inválido.");
    }
    return Number(value);
}

function businessKey(entry) {
    const details = entry.detalhes || {};
    if (entry.estado === "Palpite Paid") return ["palpite", identifier(details.jogoId, "jogoId")];
    if (entry.estado === "Mod Play") return ["mod", identifier(details.modId, "modId"),
        identifier(details.autorUserId, "autorUserId"), identifier(details.alvoUserId, "alvoUserId"),
        identifier(details.jogoId, "jogoId"), text(details.palpiteAlvo, "palpiteAlvo")];
    if (entry.estado === "WhoWins Paid") return ["whowins", identifier(entry.jogoId, "jogoId")];
    return ["manual", identifier(entry.operationId, "operationId")];
}

function prepareEntry(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) invalid("Movimento inválido.");
    const entry = {
        userId: identifier(raw.userId, "userId"), temporada: seasonLabel(raw.temporada),
        estado: text(raw.estado, "estado", 100), valorreal: amount(raw.valorreal),
        currency: currencyOf(raw),
    };
    for (const key of ["jogoId", "operationId", "nomeJogo", "ronda", "tipo", "managerTipo", "itemManager", "userName", "descricao"]) {
        if (raw[key] !== undefined) entry[key] = text(key === 'ronda' && Number.isInteger(raw[key]) ? String(raw[key]) : raw[key], key);
    }
    if (raw.preco !== undefined) entry.preco = amount(raw.preco);
    if (raw.detalhes !== undefined) {
        if (!raw.detalhes || typeof raw.detalhes !== "object" || Array.isArray(raw.detalhes)) invalid("Detalhes inválidos.");
        entry.detalhes = {};
        for (const key of ["transacaoId", "transacaoModId", "jogoId", "modId", "nomeMod", "autorUserId", "alvoUserId", "palpiteAlvo"]) {
            if (raw.detalhes[key] !== undefined) entry.detalhes[key] = text(raw.detalhes[key], key);
        }
    }
    const key = [entry.temporada, entry.userId, ...businessKey(entry)];
    entry.id = `admin_${createHash("sha256").update(JSON.stringify(key)).digest("hex")}`;
    return entry;
}

function sameBusiness(document, entry) {
    const old = document.data();
    if (old.userId !== entry.userId || seasonLabel(old.temporada) !== entry.temporada) return false;
    if (document.id === entry.id) return true;
    if (old.estado !== entry.estado) return false;
    if (entry.estado === "Palpite Paid") return old.detalhes?.transacaoId === `palpite-${entry.userId}-${entry.detalhes.jogoId}` ||
        old.detalhes?.jogoId === entry.detalhes.jogoId;
    if (entry.estado === "WhoWins Paid") return document.id === `whowins_${entry.userId}_${entry.jogoId}` || old.jogoId === entry.jogoId;
    if (entry.estado === "Mod Play") {
        return ["modId", "autorUserId", "alvoUserId", "jogoId", "palpiteAlvo"].every(key => old.detalhes?.[key] === entry.detalhes[key]);
    }
    return false;
}

function readBalance(user, season, field) {
    if (field === "GCoins" || field === "mini-gcoins") return readWallet(user, season, field === "GCoins" ? "gcoins" : "mini-gcoins");
    return amount(user[season]?.[field] ?? user[season.replace("/", "")]?.[field] ??
        user[`${season.replace("/", "")}${field}`] ?? user[field] ?? 0);
}

async function requireAdmin(transaction, db, request) {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "É necessário iniciar sessão.");
    const caller = await transaction.get(db.collection("users").doc(request.auth.uid));
    if (!caller.exists || !["ruler", "estafeta"].includes(caller.data().estatuto)) {
        throw new HttpsError("permission-denied", "Acesso reservado à administração.");
    }
}

function buildAdminLedgerHandlers({admin, db}) {
    const {writeWallet, runOperation} = buildFinanceCommon({admin, db});
    const field = (season, name) => new admin.firestore.FieldPath(season, name);
    // Only userId is indexed; season filtering accepts both legacy encodings.
    const movementsFor = (userId) => db.collection("movimentos").where("userId", "==", userId);
    const inSeason = (document, season) => {
        const value = document.data().temporada;
        return value === season || value === season.replace("/", "");
    };

    async function adminPostMovements(request) {
        if (!request.auth?.uid) throw new HttpsError("unauthenticated", "É necessário iniciar sessão.");
        const entries = request.data?.entries;
        if (!Array.isArray(entries) || entries.length === 0 || entries.length > 50) invalid("Envie entre 1 e 50 movimentos.");
        const prepared = entries.map((entry, index) => prepareEntry({...entry,
            operationId: entry.operationId ?? `${identifier(request.data.operationId, "operationId")}-${index}`}));
        if (new Set(prepared.map(entry => entry.id)).size !== prepared.length) invalid("Movimentos repetidos no pedido.");
        return runOperation(request, "adminPostMovements", async transaction => {
            await requireAdmin(transaction, db, request);
            const users = new Map();
            for (const {userId} of prepared) {
                if (users.has(userId)) continue;
                const ref = db.collection("users").doc(userId);
                const snapshot = await transaction.get(ref);
                if (!snapshot.exists) throw new HttpsError("not-found", "Utilizador não encontrado.");
                const movements = await transaction.get(movementsFor(userId));
                users.set(userId, {ref, data: snapshot.data(), movements: movements.docs, deltas: new Map()});
            }
            const writes = [];
            const removed = new Map();
            const add = (user, season, name, delta) => {
                const key = JSON.stringify([season, name]);
                user.deltas.set(key, (user.deltas.get(key) || 0) + delta);
            };
            for (const entry of prepared) {
                const user = users.get(entry.userId);
                const previous = user.movements.filter(document => inSeason(document, entry.temporada) && sameBusiness(document, entry));
                for (const document of previous) {
                    const old = document.data();
                    add(user, entry.temporada, WALLET[currencyOf(old)], -amount(old.valorreal));
                    if (POINT_STATES.has(old.estado)) add(user, entry.temporada, "Pontos", -amount(old.valorreal));
                    if (document.id !== entry.id) removed.set(document.ref, old);
                }
                add(user, entry.temporada, WALLET[entry.currency], entry.valorreal);
                if (POINT_STATES.has(entry.estado)) add(user, entry.temporada, "Pontos", entry.valorreal);
                const {id, ...data} = entry;
                writes.push({ref: db.collection("movimentos").doc(id), data: {
                    ...data, de: request.auth.uid, para: entry.userId,
                    movimentoData: admin.firestore.FieldValue.serverTimestamp(),
                }});
            }
            if (removed.size * 2 + writes.length + users.size * 2 > 450) throw new HttpsError("resource-exhausted", "Demasiados movimentos legados; reduza o lote.");
            for (const user of users.values()) {
                const updates = [];
                for (const [key, delta] of user.deltas) {
                    const [season, name] = JSON.parse(key);
                    if (delta === 0) continue;
                    const balance = amount(readBalance(user.data, season, name) + delta);
                    if (name === "GCoins" || name === "mini-gcoins") {
                        writeWallet(transaction, user.ref, season, name === "GCoins" ? "gcoins" : "mini-gcoins", balance);
                    } else updates.push(field(season, name), balance);
                }
                if (updates.length) transaction.update(user.ref, ...updates);
            }
            // Preservar os originais antes de substituir duplicados legados.
            for (const [ref, original] of removed) {
                transaction.create(db.collection('movementAudit').doc(), {originalId: ref.id, original,
                    reason: 'Substituição por movimento determinístico', requestedBy: request.auth.uid,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()});
                transaction.delete(ref);
            }
            for (const write of writes) transaction.set(write.ref, write.data);
            return {success: true, movementIds: prepared.map(entry => entry.id)};
        });
    }

    async function adminUserReconcile(request) {
        const userId = identifier(request.data?.userId, "userId");
        const season = seasonLabel(request.data?.season);
        const fields = request.data?.fields ?? ["GCoins", "Pontos"];
        if (!Array.isArray(fields) || !fields.length || fields.some(name => !["GCoins", "Pontos", "fame"].includes(name))) {
            invalid("Campos de reconciliação inválidos. Mini-GCoins são preservados.");
        }
        return db.runTransaction(async transaction => {
            await requireAdmin(transaction, db, request);
            const ref = db.collection("users").doc(userId);
            const user = await transaction.get(ref);
            if (!user.exists) throw new HttpsError("not-found", "Utilizador não encontrado.");
            const movements = await transaction.get(movementsFor(userId));
            const totals = {GCoins: 0, Pontos: 0, fame: 0};
            for (const document of movements.docs.filter(document => inSeason(document, season))) {
                const entry = document.data();
                const value = amount(entry.valorreal ?? 0);
                if (currencyOf(entry) === "gcoins") totals.GCoins += value;
                if (POINT_STATES.has(entry.estado)) totals.Pontos += value;
            }
            if (fields.includes("fame")) {
                const predictions = await transaction.get(db.collection("palpiteswhowins").where("userId", "==", userId));
                for (const document of predictions.docs.filter(document => inSeason(document, season))) {
                    totals.fame += amount(document.data().valorreal ?? 0);
                }
            }
            const updates = fields.flatMap(name => [field(season, name), amount(totals[name])]);
            transaction.update(ref, ...updates);
            return {success: true, userId, season, totals: Object.fromEntries(fields.map(name => [name, totals[name]])), miniPreserved: true};
        });
    }
    return {adminPostMovements, adminUserReconcile};
}

function buildAdminLedgerFunctions(dependencies) {
    return Object.fromEntries(Object.entries(buildAdminLedgerHandlers(dependencies))
        .map(([name, handler]) => [name, callable(handler)]));
}

module.exports = {buildAdminLedgerFunctions, buildAdminLedgerHandlers, prepareEntry, currencyOf, seasonLabel};
