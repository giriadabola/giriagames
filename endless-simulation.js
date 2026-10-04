const {onSchedule} = require('firebase-functions/v2/scheduler');

// A repetição da tarefa não volta a atribuir pontos nem a reabrir prémios.
function buildEndlessSimulation({admin, db, now: nowProvider = () => new Date()}) {
    const handler = async () => db.runTransaction(async transaction => {
    console.log('v7: Iniciando simulação semanal com reinício de temporada...');
    const globalConfigRef = db.doc('paineis/configuracoes_gerais');
    const endlessConfigRef = db.doc('paineis/endless_configuracoes');
    const [globalConfigSnap, endlessConfigSnap] = await transaction.getAll(globalConfigRef, endlessConfigRef, db.doc('endlessLeagueLocks/main'));
    if (!globalConfigSnap.exists || !endlessConfigSnap.exists) {
        console.error("Documento de configurações (gerais ou endless) não encontrado!");
        return null;
    }
    const seasonIdentifier = globalConfigSnap.data().temporadaAtual;
    const JORNADAS_PER_SEASON = endlessConfigSnap.data().jornadasPorTemporada || 28;
    const now = nowProvider();
    const lisbon = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now);
    const part = name => Number(lisbon.find(p => p.type === name).value);
    const month = part('month') - 1;
    const simulationPeriod = `${part('year')}-${String(month + 1).padStart(2, '0')}`;
    const dayOfMonth = part('day');
    const semanaAtual = Math.floor((dayOfMonth - 1) / 7) + 1;
    const currentEndlessConfig = endlessConfigSnap.data();
    const previousPeriod = currentEndlessConfig.lastSimulationPeriod ??
        (currentEndlessConfig.lastSimulationMonth === month ? simulationPeriod : null);
    const reset = previousPeriod !== simulationPeriod;
    const lastSimulatedWeekForThisMonth = reset ? 0 : currentEndlessConfig.ultimaSemanaSimulada;
    if (semanaAtual <= lastSimulatedWeekForThisMonth) {
        console.log(`A semana ${semanaAtual} já foi simulada este mês. A sair.`);
        return null;
    }
    const clubsQuery = db.collection('endlessclubes').where("temporada", "==", seasonIdentifier).where("ativo", "==", true);
    const clubsSnapshot = await transaction.get(clubsQuery);
    let leagueClubs = clubsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (leagueClubs.length < 2) {
        console.log("Não há clubes ativos suficientes para simular.");
        return null;
    }
    function generateRoundRobinSchedule(clubs) {
        const schedule = [];
        const localClubs = [...clubs]; 
        if (localClubs.length % 2 !== 0) localClubs.push({ id: 'BYE', nome: 'Folga' });
        const numRounds = localClubs.length - 1;
        const numMatchesPerRound = localClubs.length / 2;
        const teams = [...localClubs];
        for (let round = 0; round < numRounds; round++) {
            const roundMatches = [];
            for (let match = 0; match < numMatchesPerRound; match++) {
                const home = teams[match];
                const away = teams[teams.length - 1 - match];
                if (home.id !== 'BYE' && away.id !== 'BYE') {
                   if (round % 2 === 0) roundMatches.push({ home, away });
                   else roundMatches.push({ home: away, away: home });
                }
            }
            schedule.push(roundMatches);
            const lastTeam = teams.pop();
            teams.splice(1, 0, lastTeam);
        }
        return schedule;
    }
    const firstHalfSchedule = generateRoundRobinSchedule(leagueClubs);
    const secondHalfSchedule = firstHalfSchedule.map(round => round.map(match => ({ home: match.away, away: match.home })));
    const fullSeasonSchedule = [...firstHalfSchedule, ...secondHalfSchedule];
    const calculateTeamOverall = (club) => {
        if (!club.plantel || !club.treinador) return 100;
        const plantelOverall = club.plantel.reduce((sum, p) => sum + p.overall, 0);
        return plantelOverall + (club.treinador.overall || 0) + (club.formacaoatualpontos || 5);
    };
    const calculateTeamChemistry = (club) => {
        if (!club.treinador || !club.estadio) return 50;
        return (club.treinador.quimica || 0) + (club.estadio.ambiente || 15);
    };
    const generateScore = (winnerProbability) => {
        let homeScore = 0, awayScore = 0;
        if (Math.random() < 0.20) { homeScore = awayScore = Math.floor(Math.random() * 3); } 
        else {
            const winnerScore = Math.floor(Math.random() * 3) + 1;
            const loserScore = Math.floor(Math.random() * 2);
            if (Math.random() < winnerProbability) { homeScore = winnerScore; awayScore = loserScore; }
            else { homeScore = loserScore; awayScore = winnerScore; }
        }
        return { homeScore, awayScore };
    };
    const simulateMatch = (homeTeam, awayTeam) => {
        const homeOverall = calculateTeamOverall(homeTeam);
        const awayOverall = calculateTeamOverall(awayTeam);
        const homeChem = calculateTeamChemistry(homeTeam);
        const awayChem = calculateTeamChemistry(awayTeam);
        const overallDiff = homeOverall - awayOverall;
        let probBase = 0.50 + (overallDiff / 500);
        const chemDiff = homeChem - awayChem;
        const chemModifier = chemDiff / 200;
        const homeAdvantage = 0.05;
        let finalHomeWinProb = Math.max(0.05, Math.min(0.95, probBase + chemModifier + homeAdvantage));
        const { homeScore, awayScore } = generateScore(finalHomeWinProb);
        let outcome = homeScore > awayScore ? 'home' : (awayScore > homeScore ? 'away' : 'draw');
        return { homeTeam, awayTeam, homeScore, awayScore, outcome };
    };
    const jornadaInicialDaSemana = (semanaAtual - 1) * 7;
    const batch = transaction;
    if (reset) clubsSnapshot.forEach(document => batch.update(document.ref, {
        pontos: 0, pontosGastosNestaTemporada: 0, vitorias: 0, empates: 0, derrotas: 0,
        jogosDisputados: 0, golosMarcados: 0, golosSofridos: 0, winningsClaimed: false,
        lastWeekViewed: admin.firestore.FieldValue.delete()
    }));
    const statsUpdates = {};
    for (let i = 0; i < 7; i++) {
        const jornadaIndex = jornadaInicialDaSemana + i;
        if (jornadaIndex >= fullSeasonSchedule.length || (jornadaIndex + 1) > JORNADAS_PER_SEASON) break;
        const jornadaNumber = jornadaIndex + 1;
        const matchesForThisJornada = fullSeasonSchedule[jornadaIndex];
        for (const match of matchesForThisJornada) {
            const result = simulateMatch(match.home, match.away);
            const homeTeam = result.homeTeam;
            const awayTeam = result.awayTeam;
            if (!statsUpdates[homeTeam.id]) statsUpdates[homeTeam.id] = { vitorias: 0, empates: 0, derrotas: 0, golosMarcados: 0, golosSofridos: 0, pontos: 0, jogosDisputados: 0 };
            if (!statsUpdates[awayTeam.id]) statsUpdates[awayTeam.id] = { vitorias: 0, empates: 0, derrotas: 0, golosMarcados: 0, golosSofridos: 0, pontos: 0, jogosDisputados: 0 };
            statsUpdates[homeTeam.id].jogosDisputados += 1;
            statsUpdates[awayTeam.id].jogosDisputados += 1;
            statsUpdates[homeTeam.id].golosMarcados += result.homeScore;
            statsUpdates[homeTeam.id].golosSofridos += result.awayScore;
            statsUpdates[awayTeam.id].golosMarcados += result.awayScore;
            statsUpdates[awayTeam.id].golosSofridos += result.homeScore;
            if (result.outcome === 'draw') {
                statsUpdates[homeTeam.id].pontos += 1; statsUpdates[homeTeam.id].empates += 1;
                statsUpdates[awayTeam.id].pontos += 1; statsUpdates[awayTeam.id].empates += 1;
            } else if (result.outcome === 'home') {
                statsUpdates[homeTeam.id].pontos += 3; statsUpdates[homeTeam.id].vitorias += 1;
                statsUpdates[awayTeam.id].derrotas += 1;
            } else { 
                statsUpdates[awayTeam.id].pontos += 3; statsUpdates[awayTeam.id].vitorias += 1;
                statsUpdates[homeTeam.id].derrotas += 1;
            }
            const gameLogRef = db.collection('endlessjogos').doc();
            batch.set(gameLogRef, {
                seasonId: seasonIdentifier, jornada: jornadaNumber, homeTeamId: result.homeTeam.id,
                awayTeamId: result.awayTeam.id, homeScore: result.homeScore, awayScore: result.awayScore,
                simulatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
    for (const clubId in statsUpdates) {
        const clubRef = db.doc(`endlessclubes/${clubId}`);
        const updatesForThisClub = {};
        for (const stat in statsUpdates[clubId]) {
            if (statsUpdates[clubId][stat] > 0) {
                updatesForThisClub[stat] = admin.firestore.FieldValue.increment(statsUpdates[clubId][stat]);
            }
        }
        if (Object.keys(updatesForThisClub).length > 0) {
            batch.update(clubRef, updatesForThisClub);
        }
    }
    batch.update(endlessConfigRef, {
        ultimaSemanaSimulada: semanaAtual,
        lastSimulationMonth: month,
        lastSimulationPeriod: simulationPeriod
    });
    // Resultados, reinício mensal e marcador semanal confirmam-se na mesma transacção.
    console.log(`Simulação da semana ${semanaAtual} (v7) para a temporada ${seasonIdentifier} concluída.`);
    return null;

    });
    return {handler, scheduled: onSchedule({schedule: 'every monday 01:00', timeZone: 'Europe/Lisbon'}, handler)};
}
module.exports = {buildEndlessSimulation};
