const {HttpsError} = require('firebase-functions/v2/https');
const {callable, buildFinanceCommon, requireAccepted, readWallet} = require('./finance-common');
const {finite} = require('./finance-logic');

// Os pontos de performance do Endless não são gCoins. Só o resgate cria mini-gCoins.
function buildEndlessRewardFunction(deps) {
    const {db, getLatestSeason, compactSeason, now = () => new Date()} = deps;
    const {runOperation, writeWallet, movement} = buildFinanceCommon(deps);
    return callable(async request => {
        const date = now();
        const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Lisbon',
            year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
        const part = name => parts.find(p => p.type === name).value;
        const week = Math.floor((Number(part('day')) - 1) / 7) + 1;
        const period = `${part('year')}-${part('month')}`;
        const season = await getLatestSeason();
        return runOperation(request, 'claimEndlessSeasonWinnings', async tx => {
            const clubRef = db.doc(`endlessclubes/${request.auth.uid}`);
            const userRef = db.doc(`users/${request.auth.uid}`);
            const [clubSnap, userSnap, configSnap, simulationSnap] = await tx.getAll(clubRef, userRef,
                db.doc('paineis/configuracoes_gerais'), db.doc('paineis/endless_configuracoes'));
            const user = requireAccepted(userSnap);
            if (!clubSnap.exists) throw new HttpsError('not-found', 'O seu clube não foi encontrado.');
            const club = clubSnap.data();
            const gameSeason = configSnap.data()?.temporadaAtual;
            const simulation = simulationSnap.data();
            if (week !== 4 || !gameSeason || club.temporada !== gameSeason || club.ativo !== true ||
                simulation?.lastSimulationMonth !== Number(part('month')) - 1 ||
                (simulation.lastSimulationPeriod && simulation.lastSimulationPeriod !== period) || !(simulation?.ultimaSemanaSimulada >= 4) ||
                club.lastWeekViewed?.season !== gameSeason || club.lastWeekViewed?.week !== 4) {
                throw new HttpsError('failed-precondition', 'É necessário concluir a 4.ª semana da temporada activa para resgatar o prémio.');
            }
            if (club.winningsClaimed || club.rewardPeriod === period) {
                throw new HttpsError('already-exists', 'Já resgatou o prémio desta temporada.');
            }
            const points = finite(club.pontos ?? 0);
            const spent = finite(club.pontosGastosNestaTemporada ?? 0);
            const reward = Math.floor(points / 2) - spent;
            if (spent < 0 || !Number.isSafeInteger(reward) || reward <= 0) {
                throw new HttpsError('failed-precondition', 'Não tem pontos de performance disponíveis para resgatar.');
            }
            const balance = readWallet(user, season, 'mini-gcoins');
            writeWallet(tx, userRef, season, 'mini-gcoins', balance + reward);
            tx.update(clubRef, {winningsClaimed: true, rewardPeriod: period});
            movement(tx, {userId: request.auth.uid, tipo: 'Endless', estado: 'Endless Paid',
                currency: 'mini-gcoins', temporada: compactSeason(season), valorreal: reward,
                saldoAnterior: balance, saldoPosterior: balance + reward, rewardPeriod: period,
                operationId: request.data.operationId, descricao: 'Prémio de performance do Endless'});
            return {success: true, reward, newBalance: balance + reward,
                message: `Recebeu ${reward} mini-gCoins!`};
        });
    });
}

module.exports = {buildEndlessRewardFunction};
