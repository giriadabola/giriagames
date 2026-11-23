import { db } from './auth-guard.js';
import { collection, query, getDocs, doc, getDoc, updateDoc, Timestamp, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { callFinance } from '../../core/finance-client.js';

document.addEventListener('DOMContentLoaded', () => {
    const temporadaSelect = document.getElementById('temporada-select');
    const rondaSelect = document.getElementById('ronda-select');
    const launchBtn = document.getElementById('launch-results-btn');
    const gamesList = document.getElementById('games-list');
    const placeholder = document.getElementById('placeholder-message');
    const feedbackMessage = document.getElementById('feedback-message');
    
    let allGamesData = [];
    let currentlyDisplayedGames = [];
    let isProcessing = false;
    const clubCache = new Map();
    let feedbackTimeout;

    function showFeedback(message, type = 'success', duration = 5000) {
        clearTimeout(feedbackTimeout);
        feedbackMessage.textContent = message;
        feedbackMessage.className = type;
        feedbackMessage.style.display = 'block';
        feedbackTimeout = setTimeout(() => { feedbackMessage.style.display = 'none'; }, duration);
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    const MOVEMENT_CHUNK_SIZE = 50;
    const FIRESTORE_BATCH_SIZE = 450;

    async function postMovementEntries(entries) {
        for (let index = 0; index < entries.length; index += MOVEMENT_CHUNK_SIZE) {
            await callFinance('adminPostMovements', {
                entries: entries.slice(index, index + MOVEMENT_CHUNK_SIZE)
            });
        }
    }

    async function commitPredictionUpdates(updates, extraWrites = []) {
        const writes = [...extraWrites, ...updates];
        for (let index = 0; index < writes.length; index += FIRESTORE_BATCH_SIZE) {
            const batch = writeBatch(db);
            writes.slice(index, index + FIRESTORE_BATCH_SIZE).forEach(({ref, data}) => {
                batch.update(ref, data);
            });
            await batch.commit();
        }
    }

    async function getClubData(clubId) {
        if (clubCache.has(clubId)) return clubCache.get(clubId);
        const clubRef = doc(db, 'clubes', clubId);
        const clubSnap = await getDoc(clubRef);
        const clubData = clubSnap.exists() ? clubSnap.data() : { imagem: '', nome: 'Clube Desconhecido' };
        clubCache.set(clubId, clubData);
        return clubData;
    }
    
    async function recalculateUserFameForSeason(userIds, season) {
        const ids = [...userIds];
        const concurrency = 10;
        for (let index = 0; index < ids.length; index += concurrency) {
            await Promise.all(ids.slice(index, index + concurrency).map(userId =>
                callFinance('adminUserReconcile', { userId, season, fields: ['fame'] })
            ));
        }
        return ids.length;
    }

    async function initializeFilters() {
        placeholder.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A carregar dados...';
        try {
            const gamesQuery = query(collection(db, 'whowinsJogos'));
            const snapshot = await getDocs(gamesQuery);
            allGamesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (allGamesData.length === 0) {
                placeholder.textContent = 'Nenhum jogo "WhoWins" encontrado.';
                temporadaSelect.innerHTML = '<option>N/A</option>';
                rondaSelect.innerHTML = '<option>N/A</option>';
                return;
            }
            const temporadas = [...new Set(allGamesData.map(g => g.temporada))].sort().reverse();
            temporadaSelect.innerHTML = temporadas.map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join('');
            temporadaSelect.addEventListener('change', updateRondaOptions);
            rondaSelect.addEventListener('change', displayFilteredGames);
            launchBtn.addEventListener('click', handleLaunchResults);
            updateRondaOptions();
        } catch (error) { console.error("Erro ao inicializar filtros:", error); placeholder.textContent = 'Erro ao carregar dados.'; }
    }

    function updateRondaOptions() {
        const selectedTemporada = temporadaSelect.value;
        const rondas = [...new Set(allGamesData.filter(g => g.temporada === selectedTemporada).map(g => g.ronda))].sort((a, b) => b - a);
        rondaSelect.innerHTML = rondas.map(r => `<option value="${r}">${r}</option>`).join('');
        displayFilteredGames();
    }

    async function displayFilteredGames() {
        // A filtragem inicial por temporada e ronda permanece a mesma
        currentlyDisplayedGames = allGamesData.filter(g => g.temporada === temporadaSelect.value && g.ronda === parseInt(rondaSelect.value, 10));
        
        gamesList.innerHTML = '';
        if (currentlyDisplayedGames.length === 0) {
            placeholder.style.display = 'block';
            placeholder.textContent = 'Nenhum jogo encontrado para esta seleção.';
            return;
        }
        placeholder.style.display = 'none';

        // --- INÍCIO DA NOVA LÓGICA DE AGRUPAMENTO ---

        // 1. Criar um objeto para agrupar os jogos por liga
        const leaguesGames = {};
        for (const game of currentlyDisplayedGames) {
            const leagueName = game.competicao || 'Competição Desconhecida';
            if (!leaguesGames[leagueName]) {
                leaguesGames[leagueName] = []; // Cria uma lista para a nova liga
            }
            leaguesGames[leagueName].push(game);
        }

        // 2. Ordenar os nomes das ligas alfabeticamente para uma exibição consistente
        const sortedLeagues = Object.keys(leaguesGames).sort();

        // 3. Gerar o HTML iterando sobre as ligas agrupadas
        for (const leagueName of sortedLeagues) {
            // Adiciona o título da liga à lista
            const titleElement = document.createElement('li');
            titleElement.className = 'league-title-admin';
            titleElement.textContent = leagueName;
            gamesList.appendChild(titleElement);

            const gamesInLeague = leaguesGames[leagueName];
            // Ordena os jogos dentro da liga por data
            gamesInLeague.sort((a, b) => (a.dataJogo?.toDate() || 0) - (b.dataJogo?.toDate() || 0));

            // Gera o HTML para cada jogo DENTRO desta liga
            for (const game of gamesInLeague) {
                const [homeTeamData, awayTeamData] = await Promise.all([ getClubData(game.equipaCasaId), getClubData(game.equipaForaId) ]);
                let formattedDateTime = 'N/A';
                if (game.dataJogo instanceof Timestamp) { const d = game.dataJogo.toDate(); formattedDateTime = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`; }
                const homeSelected = game.resultado === game.equipaCasaId ? 'selected' : '';
                const drawSelected = game.resultado === 'draw' ? 'selected' : '';
                const awaySelected = game.resultado === game.equipaForaId ? 'selected' : '';
                const li = document.createElement('li');
                li.className = 'game-item';
                li.dataset.gameId = game.id;
                li.innerHTML = `<div class="teams-container"><div class="team-info ${homeSelected}" data-result-id="${escapeHTML(game.equipaCasaId)}"><img src="${escapeHTML(homeTeamData.imagem)}" alt="${escapeHTML(homeTeamData.nome)}" class="team-logo"><span>${escapeHTML(game.equipaCasa)}</span></div><span class="versus ${drawSelected}" data-result-id="draw">EMPATE<div class="game-date-time">${formattedDateTime}</div></span><div class="team-info ${awaySelected}" data-result-id="${escapeHTML(game.equipaForaId)}"><img src="${escapeHTML(awayTeamData.imagem)}" alt="${escapeHTML(awayTeamData.nome)}" class="team-logo"><span>${escapeHTML(game.equipaFora)}</span></div></div><button class="no-result-btn">Sem Resultado</button>`;
                gamesList.appendChild(li);
            }
        }

        // --- FIM DA NOVA LÓGICA DE AGRUPAMENTO ---

        // Os event listeners são adicionados no final, como antes, a todos os elementos gerados
        document.querySelectorAll('.game-item .team-info, .game-item .versus').forEach(el => el.addEventListener('click', handleResultClick));
        document.querySelectorAll('.game-item .no-result-btn').forEach(btn => btn.addEventListener('click', handleNoResultClick));
    }
    
    async function handleResultClick(event) {
        if (isProcessing) return;
        isProcessing = true;
        launchBtn.disabled = true;
        const clickedElement = event.currentTarget;
        const gameItem = clickedElement.closest('.game-item');
        const gameId = gameItem.dataset.gameId;
        const resultId = clickedElement.dataset.resultId;
        try {
            const gameRef = doc(db, 'whowinsJogos', gameId);
            await updateDoc(gameRef, { resultado: resultId });
            gameItem.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            clickedElement.classList.add('selected');
            const gameIndex = allGamesData.findIndex(g => g.id === gameId);
            if (gameIndex > -1) allGamesData[gameIndex].resultado = resultId;
        } catch (error) {
            console.error("Erro ao definir resultado:", error);
            showFeedback("Ocorreu um erro ao salvar o resultado.", 'error');
        } finally {
            launchBtn.disabled = false;
            isProcessing = false;
        }
    }
    
    async function handleNoResultClick(event) {
        if (isProcessing) return;
        isProcessing = true;
        const clickedButton = event.currentTarget;
        const gameItem = clickedButton.closest('.game-item');
        const gameId = gameItem.dataset.gameId;

        clickedButton.disabled = true;
        launchBtn.disabled = true;
        clickedButton.textContent = 'A limpar...';
        
        const affectedUserIds = new Set();
        const currentSeason = temporadaSelect.value;

        try {
            const gameRef = doc(db, 'whowinsJogos', gameId);
            const predictionsQuery = query(collection(db, 'palpiteswhowins'), where("nomeJogo", "==", gameId));
            const predictionsSnapshot = await getDocs(predictionsQuery);
            const movementEntries = [];
            const predictionUpdates = [];
            const movementUserIds = new Set();

            for (const predictionDoc of predictionsSnapshot.docs) {
                const {userId} = predictionDoc.data();
                if (!userId) throw new Error(`O palpite ${predictionDoc.id} não tem utilizador associado.`);
                affectedUserIds.add(userId);
                predictionUpdates.push({
                    ref: predictionDoc.ref,
                    data: { resultado: null, acertou: null, valorreal: null }
                });
                if (!movementUserIds.has(userId)) {
                    movementUserIds.add(userId);
                    movementEntries.push({
                        userId, jogoId: gameId, estado: 'WhoWins Paid',
                        temporada: currentSeason, valorreal: 0
                    });
                }
            }

            // Os movimentos são transaccionais; depois sincronizamos os palpites em lotes seguros.
            await postMovementEntries(movementEntries);
            await commitPredictionUpdates(predictionUpdates, [{ref: gameRef, data: {resultado: null}}]);
            const updatedFameCount = await recalculateUserFameForSeason(affectedUserIds, currentSeason);

            gameItem.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            const gameIndex = allGamesData.findIndex(g => g.id === gameId);
            if (gameIndex > -1) allGamesData[gameIndex].resultado = null;
            
            showFeedback(`Resultado e ${predictionsSnapshot.size} palpites limpos. Fama recalculada para ${updatedFameCount} utilizador(es).`, 'info');
        } catch (error) {
            console.error("Erro ao remover resultado:", error);
            showFeedback(error.message || "Ocorreu um erro ao remover o resultado.", 'error');
        } finally {
            clickedButton.disabled = false;
            clickedButton.textContent = 'Sem Resultado';
            launchBtn.disabled = false;
            isProcessing = false;
        }
    }

    async function handleLaunchResults() {
        if (isProcessing) return;
        isProcessing = true;
        launchBtn.disabled = true;
        launchBtn.textContent = 'A processar...';

        const gamesToProcess = [...currentlyDisplayedGames];
        const selectedSeason = temporadaSelect.value;
        const affectedUserIds = new Set();
        const movementEntries = [];
        const predictionUpdates = [];
        const settlementAmounts = new Map();

        try {
            const arenaDocSnap = await getDoc(doc(db, 'paineis', 'paineis arena'));
            const arenaPrizes = arenaDocSnap.exists() ? arenaDocSnap.data() : {};

            for (const game of gamesToProcess) {
                if (!game.resultado) continue;

                const configuredPrize = Number(arenaPrizes[game.arena]?.ganhos ?? 0);
            if (!Number.isFinite(configuredPrize) || configuredPrize < 0 || configuredPrize > 1e12) {
                throw new Error(`O prémio configurado para a arena ${game.arena || 'desconhecida'} é inválido.`);
            }
            const prizeValue = configuredPrize;
                const predictionsQuery = query(
                    collection(db, 'palpiteswhowins'),
                    where('nomeJogo', '==', game.id)
                );
                const predictionsSnapshot = await getDocs(predictionsQuery);

                for (const predictionDoc of predictionsSnapshot.docs) {
                    const prediction = predictionDoc.data();
                    if (!prediction.userId) {
                        throw new Error(`O palpite ${predictionDoc.id} não tem utilizador associado.`);
                    }

                    const guessedCorrectly = prediction.winsId === game.resultado;
                    const prize = guessedCorrectly ? prizeValue : 0;
                    const settlementKey = JSON.stringify([game.id, prediction.userId]);
                    if (settlementAmounts.has(settlementKey) && settlementAmounts.get(settlementKey) !== prize) {
                        throw new Error(`O utilizador ${prediction.userId} tem palpites duplicados e contraditórios no jogo ${game.nomeJogo}.`);
                    }
                    affectedUserIds.add(prediction.userId);
                    predictionUpdates.push({
                        ref: predictionDoc.ref,
                        data: {
                            resultado: game.resultado,
                            acertou: guessedCorrectly ? 'sim' : 'nao',
                            valorreal: prize
                        }
                    });
                    if (!settlementAmounts.has(settlementKey)) {
                        settlementAmounts.set(settlementKey, prize);
                        movementEntries.push({
                            estado: 'WhoWins Paid',
                            jogoId: game.id,
                            nomeJogo: game.nomeJogo,
                            temporada: game.temporada,
                            userId: prediction.userId,
                            valorreal: prize
                        });
                    }
                }
            }

            // O ledger altera a carteira em transações determinísticas; os palpites ficam em batches separados.
            await postMovementEntries(movementEntries);
            await commitPredictionUpdates(predictionUpdates);
            const updatedFameCount = await recalculateUserFameForSeason(affectedUserIds, selectedSeason);

            showFeedback(
                `Resultados lançados! ${predictionUpdates.length} palpites atualizados. Fama recalculada para ${updatedFameCount} utilizador(es).`,
                'success'
            );
        } catch (error) {
            console.error('Erro ao lançar resultados:', error);
            showFeedback(error.message || 'Ocorreu um erro ao processar os resultados.', 'error');
        } finally {
            launchBtn.disabled = false;
            launchBtn.textContent = 'Lançar Resultados';
            isProcessing = false;
        }
    }

    initializeFilters();
});
