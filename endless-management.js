const {callable, buildFinanceCommon, requireAccepted} = require('./finance-common');
const {finite} = require('./finance-logic');
const {randomInt} = require('node:crypto');
const {fail, shuffle, renewalDue, performance, generator, randomPeople} = require('./endless-logic');

function buildEndlessManagementFunctions(deps) {
    const {db, admin, now = () => new Date(), peopleProvider = randomPeople} = deps;
    const {runOperation} = buildFinanceCommon(deps);
    const timestamp = () => admin.firestore.FieldValue.serverTimestamp();
    async function readContext(tx, uid) {
        const clubRef = db.doc(`endlessclubes/${uid}`);
        const [userSnap, clubSnap, accessSnap, configSnap] = await tx.getAll(db.doc(`users/${uid}`), clubRef,
            db.doc('paineis/paineis perfil'), db.doc('paineis/configuracoes_gerais'));
        const user = requireAccepted(userSnap);
        if (user.estatuto !== 'ruler' && (user.permissoes?.endless !== 'yes' || accessSnap.data()?.endless !== 'on')) fail('Sem acesso ao Endless.');
        if (!clubSnap.exists) fail('O seu clube não foi encontrado.');
        const club = clubSnap.data();
        if (!club.ativo || club.temporada !== configSnap.data()?.temporadaAtual) fail('O clube não pertence à temporada activa.');
        return {clubRef, club};
    }
    const manageEndlessClub = callable(async request => {
        const action = request.data?.action;
        if (!['evolve', 'prepareRenewal', 'renew', 'formation'].includes(action)) fail('Acção inválida.');
        const pack = request.data?.pack;
        if (action === 'renew' && !['players', 'coach', 'stadium'].includes(pack)) fail('Pack inválido.');
        const people = action === 'renew' && pack !== 'stadium' ? await peopleProvider(6) : [];
        return runOperation(request, 'manageEndlessClub', async tx => {
            const {clubRef, club} = await readContext(tx, request.auth.uid);
            const updates = {};
            let message = 'Clube actualizado.';
            if (action === 'formation') {
                const formation = request.data?.formation;
                const config = (await tx.get(db.doc('paineis/infoformacoes'))).data()?.formacoes?.[formation];
                if (!config || !club.treinador?.formacoesDisponiveis?.includes(formation)) fail('Esta táctica não lhe pertence.');
                const points = finite(config.pontos);
                updates['treinador.formacaoAtual'] = formation;
                updates.formacaoatualpontos = points;
                updates.overall = finite(club.overall) - finite(club.formacaoatualpontos) + points;
            } else {
                if (!renewalDue(club, now())) fail('O clube já foi renovado este mês.');
                if (action === 'prepareRenewal') updates.renewalState = 'pendingChoice';
                if (action === 'evolve') {
                    if (club.renewalState === 'pendingChoice') fail('Conclua a alteração estrutural que escolheu.');
                    const clubs = await tx.get(db.collection('endlessclubes').where('temporada', '==', club.temporada));
                    const league = clubs.docs.filter(d => d.data().ativo).map(d => ({id: d.id, ...d.data()}))
                        .sort((a, b) => b.pontos - a.pontos ||
                            (b.golosMarcados - b.golosSofridos) - (a.golosMarcados - a.golosSofridos) || b.golosMarcados - a.golosMarcados);
                    const place = league.findIndex(c => c.id === request.auth.uid) + 1;
                    const coach = {...club.treinador};
                    const change = randomInt(2, 5);
                    const improves = (place > 0 && place <= 5) || randomInt(2) === 1;
                    coach.quimica = improves ? finite(coach.quimica) + change : Math.max(10, finite(coach.quimica) - change);
                    const squad = shuffle(club.plantel).map((player, index) => {
                        const change = randomInt(2, 7);
                        return {...player, overall: index < 4 || randomInt(2) === 1 ? finite(player.overall) + change : Math.max(10, finite(player.overall) - change)};
                    });
                    Object.assign(updates, {plantel: squad, treinador: coach,
                        overall: squad.reduce((sum, p) => sum + p.overall, 0) + finite(coach.overall) + finite(club.formacaoatualpontos),
                        quimica: coach.quimica + finite(club.estadio.ambiente),
                        numerorealtemporada: finite(club.numerorealtemporada || 1) + 1, plantelLastUpdated: timestamp()});
                    message = `Equipa evoluída. A química do treinador ${improves ? 'aumentou' : 'diminuiu'} ${change} pontos.`;
                }
                if (action === 'renew') {
                    if (club.renewalState !== 'pendingChoice') fail('Escolha primeiro a alteração estrutural.');
                    const clubs = await tx.get(db.collection('endlessclubes'));
                    const gen = generator(people, clubs.docs.map(d => d.data()));
                    if (pack === 'players') {
                        updates.plantel = gen.squad();
                        updates.overall = updates.plantel.reduce((sum, p) => sum + p.overall, 0) + finite(club.treinador.overall) + finite(club.formacaoatualpontos) - 6;
                        message = 'Novo plantel recrutado, com a penalização de 6 pontos de overall.';
                    } else if (pack === 'coach') {
                        updates.treinador = gen.coach();
                        updates.quimica = updates.treinador.quimica + finite(club.estadio.ambiente) - 5;
                        message = 'Novo treinador contratado, com a penalização de 5 pontos de química.';
                    } else {
                        updates.estadio = {...gen.stadium(), nivel: 1};
                        message = 'Novo estádio seleccionado.';
                    }
                    updates.renewalState = admin.firestore.FieldValue.delete();
                    updates.plantelLastUpdated = timestamp();
                }
            }
            tx.update(clubRef, updates);
            return {success: true, message};
        });
    });

    const purchaseUpgrade = callable(async request => {
        const type = request.data?.upgradeType;
        if (!['stadium', 'tactic'].includes(type)) fail('Melhoria inválida.');
        return runOperation(request, 'purchaseUpgrade', async tx => {
            const {clubRef, club} = await readContext(tx, request.auth.uid);
            const {spent, available, price} = performance(club);
            const configSnap = await tx.get(db.doc(type === 'stadium' ? 'paineis/infoestadios' : 'paineis/infoformacoes'));
            const itemId = type === 'stadium' ? String(finite(club.estadio.nivel) + 1) : request.data.itemId;
            const config = type === 'stadium' ? configSnap.data()?.niveis?.[itemId] : configSnap.data()?.formacoes?.[itemId];
            if (!config || !Number.isFinite(Number(config.temporadaReq)) || club.numerorealtemporada < Number(config.temporadaReq)) fail('Melhoria ainda não desbloqueada.');
            if (available < price) fail('Pontos de performance insuficientes.');
            const updates = {pontosGastosNestaTemporada: spent + price};
            if (type === 'stadium') {
                updates['estadio.nivel'] = Number(itemId);
                // Não inventar ganhos: só aplicar ambiente quando estiver configurado.
                if (config.ambiente !== undefined) {
                    const ambience = finite(config.ambiente);
                    updates['estadio.ambiente'] = ambience;
                    updates.quimica = finite(club.quimica) - finite(club.estadio.ambiente) + ambience;
                }
            } else {
                if (club.treinador.formacoesDisponiveis.includes(itemId)) fail('Já possui esta táctica.');
                updates['treinador.formacoesDisponiveis'] = admin.firestore.FieldValue.arrayUnion(itemId);
            }
            tx.update(clubRef, updates);
            tx.create(db.collection('endlessPerformanceMovements').doc(), {userId: request.auth.uid, type, itemId, price,
                season: club.temporada, createdAt: timestamp(), operationId: request.data.operationId});
            return {success: true, price, message: `Melhoria adquirida por ${price} pontos de performance.`};
        });
    });
    return {manageEndlessClub, purchaseUpgrade};
}
module.exports = {buildEndlessManagementFunctions};
