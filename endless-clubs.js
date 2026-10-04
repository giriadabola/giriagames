const {callable, buildFinanceCommon, requireAccepted} = require('./finance-common');
const {teamNames} = require('./endless-catalog');
const {fail, normalize, shuffle, randomPeople, generator, initialClub, period} = require('./endless-logic');

function buildEndlessClubFunctions(deps) {
    const {db, admin, peopleProvider = randomPeople} = deps;
    const {runOperation} = buildFinanceCommon(deps);
    const stamp = () => admin.firestore.FieldValue.serverTimestamp();
    async function context(tx, uid) {
        const [user, access, config] = await tx.getAll(db.doc(`users/${uid}`),
            db.doc('paineis/paineis perfil'), db.doc('paineis/configuracoes_gerais'));
        const data = requireAccepted(user);
        if (data.estatuto !== 'ruler' && (data.permissoes?.endless !== 'yes' || access.data()?.endless !== 'on')) {
            fail('Sem acesso ao Endless.');
        }
        const season = config.data()?.temporadaAtual;
        if (!season || typeof season !== 'string') fail('Época do Endless não configurada.');
        return season;
    }
    const getEndlessDraft = callable(async request => {
        const uid = request.auth.uid;
        const ref = db.doc(`endlessDrafts/${uid}`);
        const cached = await ref.get();
        const people = cached.exists ? [] : await peopleProvider(21);
        return runOperation(request, 'getEndlessDraft', async tx => {
            const season = await context(tx, uid);
            const [draft, club, clubs] = await Promise.all([tx.get(ref), tx.get(db.doc(`endlessclubes/${uid}`)), tx.get(db.collection('endlessclubes'))]);
            if (club.exists) fail('Já tem um clube no Endless.');
            if (draft.exists && draft.data().season === season) return draft.data();
            const gen = generator(people, clubs.docs.map(d => d.data()));
            const options = {season, squads: Array.from({length: 3}, () => ({players: gen.squad()})),
                coaches: Array.from({length: 3}, () => gen.coach()), stadiums: Array.from({length: 3}, () => gen.stadium())};
            tx.set(ref, options);
            return options;
        });
    });

    const foundEndlessClub = callable(async request => {
        const uid = request.auth.uid;
        const name = String(request.data?.name || '').trim();
        if (name.length < 3 || name.length > 80 || !/^[\p{L}\p{M}\p{N} .'-]+$/u.test(name) || !normalize(name) || teamNames.some(n => normalize(n) === normalize(name))) {
            fail('Nome de clube inválido ou reservado.');
        }
        const choices = ['squad', 'coach', 'stadium'].map(key => request.data?.[key]);
        if (choices.some(value => !Number.isInteger(value) || value < 0 || value > 2)) fail('Escolhas inválidas.');
        // Os nomes não atribuem qualquer vantagem: atributos e sorteios são sempre do servidor.
        const people = await peopleProvider(140);
        return runOperation(request, 'foundEndlessClub', async tx => {
            const season = await context(tx, uid);
            const ref = db.doc(`endlessclubes/${uid}`);
            const [existing, draftSnap, clubs, games, settings, lock] = await Promise.all([
                tx.get(ref), tx.get(db.doc(`endlessDrafts/${uid}`)), tx.get(db.collection('endlessclubes')),
                tx.get(db.collection('endlessjogos').where('seasonId', '==', season)),
                tx.get(db.doc('paineis/endless_configuracoes')), tx.get(db.doc('endlessLeagueLocks/main'))]);
            if (existing.exists) fail('Já tem um clube no Endless.');
            const draft = draftSnap.data();
            if (!draft || draft.season !== season) fail('Reabra as opções iniciais do clube.');
            const all = clubs.docs.map(d => ({id: d.id, ...d.data()}));
            if (all.some(c => normalize(c.nome) === normalize(name))) fail('Este nome de clube já existe.');
            const active = all.filter(c => c.ativo && c.temporada === season);
            const bot = active.length >= 20 ? active.find(c => c.estado === 'temporario') : null;
            if (active.length >= 20 && !bot) fail('A liga está cheia.');
            const rounds = settings.data()?.jornadasPorTemporada ?? 28;
            if (!Number.isInteger(rounds) || rounds <= 0) fail('Número de jornadas inválido.');
            const gameSeason = Math.floor(Math.floor(games.size / 10) / rounds) + 1;
            const base = {season, gameSeason, timestamp: stamp()};
            const club = initialClub({...base, name, uid, squad: draft.squads[choices[0]].players,
                coach: draft.coaches[choices[1]], stadium: draft.stadiums[choices[2]]});
            if (all.some(c => c.estadio?.name === club.estadio.name)) fail('O estádio foi entretanto escolhido. Contacte a administração para renovar as opções.');
            const adjustments = bot ? games.docs.filter(d => {
                const game = d.data();
                return (game.homeTeamId === bot.id || game.awayTeamId === bot.id) &&
                    game.simulatedAt?.toDate && period(game.simulatedAt.toDate()) === period();
            }) : [];
            if (adjustments.length > 150) fail('Demasiados jogos para ajustar numa única operação.');
            // Todas as leituras precedem a fundação, substituição e acertos de resultados.
            tx.create(ref, club);
            tx.set(db.doc('endlessLeagueLocks/main'), {revision: (lock.data()?.revision || 0) + 1});
            if (bot) {
                tx.update(db.doc(`endlessclubes/${bot.id}`), {ativo: false});
                for (const document of adjustments) {
                    const game = document.data();
                    const botHome = game.homeTeamId === bot.id;
                    const opponent = botHome ? game.awayTeamId : game.homeTeamId;
                    if (!all.some(c => c.id === opponent)) fail('Adversário inexistente no histórico.');
                    const scored = botHome ? game.awayScore : game.homeScore;
                    const conceded = botHome ? game.homeScore : game.awayScore;
                    const oldPoints = scored > conceded ? 3 : scored === conceded ? 1 : 0;
                    const inc = admin.firestore.FieldValue.increment;
                    tx.update(document.ref, {homeScore: botHome ? 0 : 3, awayScore: botHome ? 3 : 0});
                    tx.update(db.doc(`endlessclubes/${opponent}`), {pontos: inc(3 - oldPoints),
                        vitorias: inc(oldPoints === 3 ? 0 : 1), derrotas: inc(oldPoints === 0 ? -1 : 0),
                        empates: inc(oldPoints === 1 ? -1 : 0), golosMarcados: inc(3 - scored), golosSofridos: inc(-conceded)});
                }
            } else {
                const gen = generator(people, [...all, club]);
                const names = shuffle(teamNames.filter(n => !all.some(c => normalize(c.nome) === normalize(n))));
                for (let i = active.length + 1; i < 20; i++) {
                    const botName = names.pop();
                    if (!botName) fail('Não existem nomes disponíveis para completar a liga.');
                    tx.create(db.collection('endlessclubes').doc(), initialClub({...base, name: botName, uid: null,
                        squad: gen.squad(), coach: gen.coach(), stadium: gen.stadium()}));
                }
            }
            return {success: true, clubId: uid};
        });
    });
    const getRandomUsers = callable(async request => {
        requireAccepted(await db.doc(`users/${request.auth.uid}`).get());
        const count = request.data?.count ?? 1;
        if (!Number.isInteger(count) || count < 1 || count > 25) fail('Quantidade de nomes inválida.');
        return peopleProvider(count);
    });
    return {getEndlessDraft, foundEndlessClub, getRandomUsers};
}
module.exports = {buildEndlessClubFunctions};
