const {randomInt, randomUUID} = require('node:crypto');
const {HttpsError} = require('firebase-functions/v2/https');
const {finite} = require('./finance-logic');
const {stadiumNames} = require('./endless-catalog');

const fail = message => {throw new HttpsError('failed-precondition', message);};
const normalize = name => String(name || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
function shuffle(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
function period(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit'}).formatToParts(date);
    return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
}
function renewalDue(club, now) {
    const last = club.plantelLastUpdated?.toDate?.() || new Date(0);
    return period(last) < period(now);
}
async function randomPeople(count, fetchImpl = globalThis.fetch) {
    try {
        const response = await fetchImpl(`https://randomuser.me/api/?results=${count}&inc=name,nat`,
            {redirect: 'error', signal: AbortSignal.timeout(5000)});
        if (!response.ok) throw Error('Provider unavailable');
        const json = await response.json();
        const clean = value => String(value || '').replace(/[^\p{L}\p{M} '-]/gu, '').slice(0, 70);
        const people = (json.results || []).slice(0, count).map(p => ({name: {first: clean(p.name?.first), last: clean(p.name?.last)},
            nat: /^[A-Z]{2}$/.test(p.nat) ? p.nat : 'PT'}));
        if (people.length !== count || people.some(p => !p.name.first)) throw Error('Invalid names');
        return people;
    } catch {
        // Mesmo fallback genérico que a página já usava quando o fornecedor falhava.
        return Array.from({length: count}, (_, i) => ({name: {first: 'Jogador', last: `Genérico ${i + 1}`}, nat: 'PT'}));
    }
}
function generator(people = [], existing = []) {
    let index = 0;
    const usedPlayers = new Set(existing.flatMap(c => c.plantel || []).map(p => normalize(p.name)));
    const usedStadiums = new Set(existing.map(c => c.estadio?.name));
    function person() {
        const p = people[index++] || {name: {first: 'Jogador', last: 'Genérico'}, nat: 'PT'};
        let name = `${p.name.first} ${p.name.last}`;
        while (usedPlayers.has(normalize(name))) name = `${p.name.first} ${p.name.last} ${randomUUID().slice(0, 8)}`;
        usedPlayers.add(normalize(name));
        return {name, countryCode: p.nat, overall: randomInt(2, 51)};
    }
    return {
        squad: () => ['GR', 'DEF', 'DEF', 'MED', 'MED', 'AVA'].map(position => ({...person(), position})),
        coach: () => {
            const formations = shuffle(['1-2-2-1', '1-3-1-1']).slice(0, randomInt(1, 3));
            return {...person(), quimica: randomInt(2, 51), temporadas: 1,
                formacaoAtual: formations[0], formacoesDisponiveis: formations};
        },
        stadium: () => {
            const name = shuffle(stadiumNames.filter(n => !usedStadiums.has(n)))[0] || `Estádio Genérico ${randomUUID().slice(0, 8)}`;
            usedStadiums.add(name);
            return {name, ambiente: 0};
        },
    };
}
function initialClub({name, uid, squad, coach, stadium, season, gameSeason, timestamp}) {
    return {nome: name, userId: uid, dataDeCriacao: timestamp, ativo: true, plantel: squad,
        treinador: {...coach, formacaoAtual: '1-2-2-1', formacoesDisponiveis: [...new Set([...coach.formacoesDisponiveis, '1-2-2-1'])]},
        estadio: {...stadium, nivel: 1, ambiente: 15},
        overall: squad.reduce((sum, p) => sum + p.overall, 0) + coach.overall + 5,
        quimica: coach.quimica + 15, formacaoatualpontos: 5, numerorealtemporada: 1,
        plantelLastUpdated: timestamp, pontos: 0, pontosGastosNestaTemporada: 0,
        vitorias: 0, empates: 0, derrotas: 0, jogosDisputados: 0, golosMarcados: 0, golosSofridos: 0,
        temporada: season, seasonGame: gameSeason, estado: uid ? 'real' : 'temporario'};
}
function performance(club) {
    const spent = finite(club.pontosGastosNestaTemporada ?? 0);
    if (spent < 0 || club.winningsClaimed) fail('Os pontos de performance já foram resgatados ou são inválidos.');
    const available = Math.floor(finite(club.pontos ?? 0) / 2) - spent;
    return {spent, available, price: Math.max(45, Math.floor(available * (2 / 3)))};
}
module.exports = {fail, normalize, shuffle, period, renewalDue, randomPeople, generator, initialClub, performance};
