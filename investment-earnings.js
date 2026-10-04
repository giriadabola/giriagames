const {createHash} = require('node:crypto');
const {HttpsError} = require('firebase-functions/v2/https');
const {callable, buildFinanceCommon, requireAccepted, readWallet} = require('./finance-common');
const {finite} = require('./finance-logic');

const hash = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const fail = (code, message) => { throw new HttpsError(code, message); };
const arenaNumber = value => Number(String(value || '').replace(/^arena\s*/i, ''));
const disabled = value => [false, 0, 'false', 'no', 'off', 'nao', 'não'].includes(
    typeof value === 'string' ? value.trim().toLowerCase() : value);

function calculateInvestmentReturn(arena, result) {
    return ({4: {W: 4, L: -3}, 5: {W: 7, L: -4}})[arena]?.[result] || 0;
}

function configuredFootyStatsId(club) {
    const raw = String(club.investimentoembed || '').trim();
    const id = /^\d+$/.test(raw) ? raw : raw.match(/[?&]id=(\d+)(?:[&"'\s>]|$)/i)?.[1];
    if (!id) fail('failed-precondition', 'O clube não tem um identificador FootyStats válido.');
    return id;
}

const textOnly = value => value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').trim();
function classText(html, name) {
    return textOnly(html.match(new RegExp(`<[^>]+class=["'][^"']*\\b${name}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'))?.[1] || '');
}

// Fail closed on ambiguous dates: an omitted year must never become today's date.
function parseFootyStatsMatches(html) {
    if (typeof html !== 'string' || /cf-challenge|just a moment|verify you are human/i.test(html)) {
        fail('unavailable', 'O FootyStats não devolveu resultados verificáveis.');
    }
    const list = html.match(/<ul\b[^>]*class=["'][^"']*\bmatches\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1];
    if (list === undefined) fail('unavailable', 'Formato de resultados FootyStats não reconhecido.');
    const matches = new Map();
    for (const row of list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
        const body = row[1];
        const badge = classText(body, 'result').toUpperCase();
        if (!['W', 'L', 'D'].includes(badge)) continue;
        const date = classText(body, 'date');
        const cleanDate = date.replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s*/i, '')
            .replace(/(\d+)(st|nd|rd|th)/gi, '$1');
        const validDate = /^(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$/i.test(cleanDate) ||
            /^\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i.test(cleanDate) || /^\d{4}-\d{2}-\d{2}$/.test(cleanDate);
        const timestamp = validDate ? Date.parse(cleanDate + ' UTC') : NaN;
        const link = body.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
        const score = textOnly(link || '').match(/(\d+)\s*-\s*(\d+)\s+vs\s+(.+)/i);
        if (!Number.isFinite(timestamp) || !score) {
            fail('unavailable', 'O FootyStats devolveu um resultado sem data ou marcador inequívoco.');
        }
        const opponent = score[3].trim();
        const id = hash(timestamp, opponent.toLowerCase());
        const match = {id, timestamp, date, opponent, score: `${score[1]}-${score[2]}`, badge};
        if (matches.has(id) && JSON.stringify(matches.get(id)) !== JSON.stringify(match)) {
            fail('unavailable', 'O FootyStats devolveu resultados contraditórios.');
        }
        matches.set(id, match);
    }
    if (matches.size > 100) fail('unavailable', 'Demasiados resultados na resposta FootyStats.');
    return [...matches.values()];
}

async function fetchTrustedMatches(club, fetchImpl = globalThis.fetch) {
    const id = configuredFootyStatsId(club);
    try {
        const response = await fetchImpl(`https://footystats.org/api/club?id=${id}`, {
            redirect: 'error', signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error('FootyStats indisponível');
        const html = await response.text();
        if (html.length > 2000000) throw new Error('Resposta demasiado grande');
        return parseFootyStatsMatches(html);
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        fail('unavailable', 'Não foi possível validar os resultados no FootyStats. Tenta novamente mais tarde.');
    }
}

function buildInvestmentEarningsFunctions({admin, db, getLatestSeason, fetchImpl = globalThis.fetch, now = Date.now}) {
    const {runOperation, writeWallet, movement} = buildFinanceCommon({admin, db});
    const refs = (uid, season) => ({
        user: db.collection('users').doc(uid),
        // No client writes are permitted to this collection (default deny).
        state: db.collection('investmentEarningsState').doc(hash(uid, season)),
    });
    const validateClub = data => {
        if (typeof data.clubeId !== 'string' || !data.clubeId || data.clubeId.includes('/') || data.clubeId.length > 200) {
            fail('invalid-argument', 'Clube inválido.');
        }
        return data.clubeId;
    };
    const seasonKey = async () => {
        const season = await getLatestSeason();
        if (typeof season !== 'string' || !season.trim()) fail('failed-precondition', 'Época não configurada.');
        return season;
    };
    async function changeSelection(request, adding) {
        const uid = request.auth.uid;
        const data = request.data || {};
        const clubeId = validateClub(data);
        const season = await seasonKey();
        const {user, state} = refs(uid, season);
        return runOperation(request, adding ? 'selectInvestment' : 'removeInvestment', async tx => {
            const [userSnap, stateSnap, clubSnap, settingsSnap, arenaSnap] = await tx.getAll(
                user, state, db.collection('clubes').doc(clubeId),
                db.collection('settings').doc('investimentos'), db.collection('paineis').doc('paineis arena'));
            requireAccepted(userSnap);
            const slots = {...(stateSnap.data()?.slots || {})};
            const key = hash(clubeId);
            const old = slots[key];
            const timestamp = now();
            if (adding && !old?.active) {
                if (!clubSnap.exists) fail('not-found', 'Clube não encontrado.');
                const club = clubSnap.data();
                const competitions = await tx.get(db.collection('competicoes'));
                const comp = competitions.docs.find(d => d.id === club.competicaoId) ||
                    competitions.docs.find(d => Array.isArray(d.data().clubes) && d.data().clubes.includes(clubeId)) ||
                    competitions.docs.find(d => club.competicao && String(d.data().nome).toLowerCase() === String(club.competicao).toLowerCase());
                const arena = arenaNumber(comp?.data()?.arena || club.investimentos?.[0]?.arena || club.arena);
                const u = userSnap.data();
                const seasonalUser = u[season] || {};
                let userArena = arenaNumber(seasonalUser.arena ?? u.arena) || 0;
                let startArena = 1;
                for (const [name, config] of Object.entries(arenaSnap.data() || {})) {
                    if (config.start === true) startArena = arenaNumber(name);
                    if (Number.isFinite(Number(config.fama)) && Number(seasonalUser.fame ?? u.fame ?? 0) >= Number(config.fama)) {
                        userArena = Math.max(userArena, arenaNumber(name) || 0);
                    }
                }
                if (!Number.isInteger(arena) || arena < 1 || arena > 5 || arena > userArena || userArena < startArena ||
                    [club.ativo, club.status, club.investimentos?.[0]?.status].some(disabled)) {
                    fail('failed-precondition', 'Esta equipa não está disponível na tua arena.');
                }
                const limit = Number(settingsSnap.data()?.porpessoa ?? 5);
                if (!Number.isInteger(limit) || limit < 1 || limit > 20) fail('failed-precondition', 'Limite de investimentos inválido.');
                if (Object.values(slots).filter(s => s.active).length >= limit) fail('resource-exhausted', 'Atingiste o limite de investimentos.');
                configuredFootyStatsId(club);
                slots[key] = {clubeId, arena, active: true, timestamp,
                    investimentoDocId: hash(uid, season, clubeId),
                    // Earlier windows are not reopened by removing and selecting again.
                    intervals: [...(old?.intervals || []), {start: timestamp, end: null, arena}]};
            } else if (!adding && old?.active) {
                slots[key] = {...old, active: false, intervals: old.intervals.map((interval, i) =>
                    i === old.intervals.length - 1 ? {...interval, end: timestamp} : interval)};
            }
            const selected = slots[key];
            tx.set(state, {uid, season, slots}, {merge: true});
            tx.update(user, {investimentos: Object.values(slots).filter(s => s.active).map(s => ({
                clubeId: s.clubeId, timestamp: s.timestamp, data: s.timestamp, investimentoDocId: s.investimentoDocId,
            }))});
            if (selected) tx.set(db.collection('investimentos').doc(selected.investimentoDocId), {
                id: selected.investimentoDocId, userId: uid, clubeId, timestamp: selected.timestamp,
                dataInvestimento: selected.timestamp, status: selected.active ? 'on' : 'off', temporada: season,
            }, {merge: true});
            return {success: true, season, investmentId: selected?.investimentoDocId || null};
        });
    }

    async function settle(request) {
        const uid = request.auth.uid;
        const season = await seasonKey();
        const {user, state} = refs(uid, season);
        const initial = await state.get();
        if (!initial.exists) {
            const currentUser = requireAccepted(await user.get());
            if (!Array.isArray(currentUser.investimentos) || currentUser.investimentos.length === 0) {
                return {success: true, season, movements: 0, delta: 0};
            }
            fail('failed-precondition', 'Seleciona novamente os investimentos para ativar a validação segura.');
        }
        const initialSlots = initial.data().slots || {};
        const candidates = [];
        const currentTime = now();
        for (const slot of Object.values(initialSlots)) {
            const clubSnap = await db.collection('clubes').doc(slot.clubeId).get();
            if (!clubSnap.exists) fail('failed-precondition', 'Clube não encontrado.');
            const matches = await fetchTrustedMatches(clubSnap.data(), fetchImpl);
            for (const match of matches) {
                const interval = slot.intervals.find(i => match.timestamp >= i.start && (i.end === null || match.timestamp < i.end));
                if (match.timestamp > currentTime || !interval) continue;
                const id = hash(uid, season, slot.investimentoDocId, match.id);
                candidates.push({id, slot, match, value: calculateInvestmentReturn(interval.arena, match.badge)});
            }
        }
        if (candidates.length > 200) fail('resource-exhausted', 'Demasiados movimentos para processar numa operação.');
        return runOperation(request, 'settleInvestmentEarnings', async tx => {
            const [userSnap, stateSnap] = await tx.getAll(user, state);
            requireAccepted(userSnap);
            if (JSON.stringify(stateSnap.data()?.slots) !== JSON.stringify(initialSlots)) {
                fail('aborted', 'Os investimentos foram alterados. Repete a sincronização.');
            }
            const receiptRefs = candidates.map(c => state.collection('receipts').doc(c.id));
            const receipts = receiptRefs.length ? await tx.getAll(...receiptRefs) : [];
            const fresh = candidates.filter((c, i) => !receipts[i].exists);
            const seasonData = userSnap.data()[season] || {};
            const balance = readWallet(userSnap.data(), season, 'mini-gcoins');
            const previousEarnings = finite(seasonData.investimentosgCoins ?? 0);
            const delta = fresh.reduce((sum, c) => sum + c.value, 0);
            for (const c of fresh) {
                tx.create(state.collection('receipts').doc(c.id), {matchId: c.match.id, value: c.value});
                movement(tx, {
                    userId: uid, clubeId: c.slot.clubeId, investmentId: c.slot.investimentoDocId,
                    matchId: c.match.id, valorreal: c.value, estado: 'Investimentos Paid', tipo: 'Investimento',
                    currency: 'mini-gcoins', temporada: season.replace(/\//g, ''),
                    jogo: `${c.slot.clubeId} vs ${c.match.opponent} - ${c.match.date}`,
                    data: c.match.date, timestamp: c.match.timestamp,
                }, `investment_${c.id}`);
            }
            if (fresh.length) {
                writeWallet(tx, user, season, 'mini-gcoins', balance + delta);
                tx.update(user, new admin.firestore.FieldPath(season, 'investimentosgCoins'), finite(previousEarnings + delta));
            }
            return {success: true, season, movements: fresh.length, delta};
        });
    }
    return {
        selectInvestment: callable(request => changeSelection(request, true)),
        removeInvestment: callable(request => changeSelection(request, false)),
        settleInvestmentEarnings: callable(settle),
    };
}

module.exports = {buildInvestmentEarningsFunctions, calculateInvestmentReturn,
    configuredFootyStatsId, parseFootyStatsMatches, fetchTrustedMatches};
