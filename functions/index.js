// =================================================================
//          CÓDIGO COMPLETO E FINAL PARA index.js (v2 + CORS)
// =================================================================

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const {
    processMarketNotifications,
    sendManualMarketNotification,
    sendInboxNotification,
} = require("./market-notifications");
const {
    buildAccountInvitationFunctions,
} = require("./account-invitations");
const {
    buildMarketPurchaseFunction,
} = require("./market-purchases");
const {
    buildBalanceReconciliationFunction,
} = require("./balance-reconciliation");

admin.initializeApp();
const db = admin.firestore();

function compactSeason(season) {
    return String(season || '').replace(/\//g, '').trim();
}

function sortSeasons(seasons) {
    return [...new Set((seasons || []).filter((season) => typeof season === 'string' && season.trim()))]
        .sort((a, b) => {
            const getEndYear = (value) => Number(value.match(/\d{4}\s*\/\s*(\d{4})/)?.[1] || 0);
            return getEndYear(b) - getEndYear(a) || b.localeCompare(a);
        });
}

async function getLatestSeason() {
    const settingsSnapshot = await db.collection('settings').doc('temporadas').get();
    const latestConfiguredSeason = sortSeasons(settingsSnapshot.data()?.temporadas)[0];
    if (latestConfiguredSeason) return latestConfiguredSeason;

    const configSnapshot = await db.collection('paineis').doc('configuracoes_gerais').get();
    const fallbackSeason = configSnapshot.data()?.temporadaAtual;
    if (fallbackSeason) return fallbackSeason;

    throw new Error('Época mais recente não configurada.');
}

const accountInvitationFunctions = buildAccountInvitationFunctions({
    admin,
    db,
    getLatestSeason,
});
exports.createAccountInvite = accountInvitationFunctions.createAccountInvite;
exports.acceptAccountInvite = accountInvitationFunctions.acceptAccountInvite;
exports.purchaseMarketPlayer = buildMarketPurchaseFunction({
    admin,
    db,
    getLatestSeason,
    compactSeason,
});
exports.reconcileUserBalances = buildBalanceReconciliationFunction({
    admin,
    db,
    getLatestSeason,
});

exports.createGPlayer = onCall({
    cors: [
        "https://giriagames.win",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5502",
        "http://localhost:5174",
        "http://localhost:5502",
    ],
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Login necessário.");
    }

    const callerSnapshot = await db.collection("users")
        .doc(request.auth.uid)
        .get();
    if (!callerSnapshot.exists || callerSnapshot.data().estatuto !== "ruler") {
        throw new HttpsError(
            "permission-denied",
            "Apenas um ruler pode criar GPlayers.",
        );
    }

    const data = request.data || {};
    const email = String(data.email || "").trim().toLowerCase();
    const password = String(data.password || "");
    const nomeDeUsuario = String(data.nomeDeUsuario || "").trim();
    const nomeTabela = String(data.nomeTabela || "").trim();
    const naTabela = String(data.naTabela || "").trim();
    const arena = String(data.arena || "").trim();
    const estatuto = String(data.estatuto || "gplayer").trim();
    const aceite = String(data.aceite || "No").trim();
    const allowedRoles = ["gplayer", "ruler", "estafeta"];
    const allowedAcceptance = ["Yes", "No"];

    if (!email || !password || !nomeDeUsuario) {
        throw new HttpsError(
            "invalid-argument",
            "Email, password e nome de utilizador são obrigatórios.",
        );
    }
    if (password.length < 6) {
        throw new HttpsError(
            "invalid-argument",
            "A password deve ter pelo menos 6 caracteres.",
        );
    }
    if (!allowedRoles.includes(estatuto) ||
        !allowedAcceptance.includes(aceite)) {
        throw new HttpsError(
            "invalid-argument",
            "As permissões indicadas não são válidas.",
        );
    }

    let createdUser = null;
    try {
        createdUser = await admin.auth().createUser({email, password});
        const seasonLabel = await getLatestSeason();
        await db.collection("users").doc(createdUser.uid).set({
            email,
            nomeDeUsuario,
            nometabela: nomeTabela,
            estatuto,
            aceite,
            [seasonLabel]: {
                uid: createdUser.uid,
                natabela: naTabela,
                arena,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
        });

        return {success: true, uid: createdUser.uid};
    } catch (error) {
        if (createdUser) {
            await admin.auth().deleteUser(createdUser.uid).catch((rollbackError) => {
                console.error(
                    "Erro ao reverter a criação do utilizador:",
                    rollbackError,
                );
            });
        }

        if (error.code === "auth/email-already-exists") {
            throw new HttpsError(
                "already-exists",
                "Este email já está a ser utilizado.",
            );
        }
        if (error instanceof HttpsError) throw error;

        console.error("Erro ao criar GPlayer:", error);
        throw new HttpsError(
            "internal",
            "Não foi possível criar o GPlayer.",
        );
    }
});

function getSeasonData(userData, season) {
    const data = userData?.[season];
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

exports.processMarketNotifications = processMarketNotifications;
exports.sendManualMarketNotification = sendManualMarketNotification;
exports.sendInboxNotification = sendInboxNotification;

// =====================================================================
//   footballProxy — Proxy HTTP para SofaScore (sem CORS no servidor)
//   Uso: GET https://<region>-g-games-8a8fc.cloudfunctions.net/footballProxy?team=NK+Varazdin
// =====================================================================
exports.footballProxy = onRequest({
    cors: true,
    invoker: "public",
}, async (req, res) => {
    const teamName = req.query.team || '';
    if (!teamName || teamName.length < 2) {
        return res.status(400).json({ error: 'Parâmetro "team" é obrigatório' });
    }

    try {
        // Função normalizadora de nomes (igual à do browser)
        const normalizeName = (name) => name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

        // Variações de nome a tentar
        const baseName = teamName.replace(/\b(NK|FC|FK|AC|CF|UD|CD|SC|SL|RC|BV|AS|SD)\b\s*/gi, '').trim();
        const namesToTry = [...new Set([teamName, baseName])].filter(n => n && n.length > 1);

        let teamId = null;
        let teamFoundName = '';

        // 1. Pesquisa no SofaScore (servidor não tem restrições CORS)
        for (const name of namesToTry) {
            try {
                const searchResp = await fetch(
                    `https://api.sofascore.com/api/v1/search/all?q=${encodeURIComponent(name)}&page=0`,
                    {
                        headers: {
                            'Accept': 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                            'Referer': 'https://www.sofascore.com/',
                            'Origin': 'https://www.sofascore.com',
                        }
                    }
                );
                if (!searchResp.ok) continue;
                const searchData = await searchResp.json();
                const teams = (searchData.results || []).filter(r => r.type === 'team');
                if (teams.length > 0) {
                    const normName = normalizeName(name);
                    const best = teams.find(t => normalizeName(t.entity.name) === normName) || teams[0];
                    teamId = best.entity.id;
                    teamFoundName = best.entity.name;
                    break;
                }
            } catch (e) {
                console.error(`SofaScore search error for "${name}":`, e.message);
            }
        }

        if (!teamId) {
            return res.status(404).json({ error: `Equipa "${teamName}" não encontrada no SofaScore` });
        }

        // 2. Obter últimos jogos
        const eventsResp = await fetch(
            `https://api.sofascore.com/api/v1/team/${teamId}/events/last/0`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'Referer': 'https://www.sofascore.com/',
                    'Origin': 'https://www.sofascore.com',
                }
            }
        );

        if (!eventsResp.ok) {
            return res.status(502).json({ error: `SofaScore respondeu com status ${eventsResp.status}` });
        }

        const eventsData = await eventsResp.json();
        const events = eventsData.events || [];

        const mappedMatches = events
            .filter(ev =>
                (ev.status?.type === 'finished' || ev.status?.description === 'Ended') &&
                ev.homeScore?.current !== undefined &&
                ev.awayScore?.current !== undefined
            )
            .map(ev => {
                const ts = (ev.startTimestamp || 0) * 1000;
                const d = new Date(ts);
                const day   = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year  = d.getFullYear();
                return {
                    equipa1: ev.homeTeam?.name || '',
                    equipa2: ev.awayTeam?.name || '',
                    dataJogo: `${day}/${month}/${year}`,
                    resultado: `${ev.homeScore.current}-${ev.awayScore.current}`
                };
            })
            .filter(m => m.equipa1 && m.equipa2)
            .reverse()  // Do mais recente para o mais antigo
            .slice(0, 5);

        return res.status(200).json({
            teamId,
            teamName: teamFoundName,
            matches: mappedMatches
        });

    } catch (err) {
        console.error('footballProxy error:', err);
        return res.status(500).json({ error: err.message });
    }
});


// =================================================================
//          FUNÇÃO ATUALIZADA: payDebt (v2 com CORS)
// =================================================================
// Adicionada a opção { cors: ["https://giriagames.win"] }
Object.assign(exports, require('./bank-operations').buildBankFunctions({admin, db, getLatestSeason, compactSeason}));
Object.assign(exports, require('./player-sales').buildPlayerSaleFunctions({admin, db, getLatestSeason, compactSeason}));
exports.purchaseManagerItem = require('./manager-purchases').buildManagerPurchaseFunction({admin, db, getLatestSeason, compactSeason});
Object.assign(exports, require('./caderneta-purchases').buildCadernetaPurchaseFunctions({admin, db, getLatestSeason, compactSeason}));
Object.assign(exports, require('./investment-earnings').buildInvestmentEarningsFunctions({admin, db, getLatestSeason}));
Object.assign(exports, require('./admin-ledger').buildAdminLedgerFunctions({admin, db}));

exports.simulateWeeklyMatches = require('./endless-simulation').buildEndlessSimulation({admin, db}).scheduled;

exports.claimEndlessSeasonWinnings = require('./endless-rewards').buildEndlessRewardFunction({admin, db, getLatestSeason, compactSeason});
Object.assign(exports, require('./endless-clubs').buildEndlessClubFunctions({admin, db}));
Object.assign(exports, require('./endless-management').buildEndlessManagementFunctions({admin, db}));

// =====================================================================
//          NOVA FUNÇÃO: corsProxy (Proxy CORS seguro)
// =====================================================================
exports.corsProxy = onCall({ cors: ["https://giriagames.win", "http://127.0.0.1:5502", "http://localhost:5502"] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "O utilizador deve estar autenticado.");
    }
    const url = request.data.url;
    if (!url) {
        throw new HttpsError("invalid-argument", "O parâmetro 'url' é obrigatório.");
    }
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            }
        });
        if (!response.ok) {
            throw new HttpsError("failed-precondition", `Erro ao aceder ao destino: ${response.statusText}`);
        }
        const html = await response.text();
        return { html };
    } catch (err) {
        throw new HttpsError("internal", err.message);
    }
});
