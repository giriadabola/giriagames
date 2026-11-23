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
    const processingOverlay = document.getElementById('processing-overlay');
    const processingCard = processingOverlay.querySelector('.processing-card');
    const processingTitle = document.getElementById('processing-title');
    const processingDetail = document.getElementById('processing-detail');
    const processingCount = document.getElementById('processing-count');
    const processingBar = document.getElementById('processing-progress');
    const processingTrack = processingBar.parentElement;
    const processingSteps = [...processingOverlay.querySelectorAll('[data-processing-step]')];
    
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

    function updateProcessing({step, progress, title, detail, count = ''}) {
        if (title) processingTitle.textContent = title;
        if (detail) processingDetail.textContent = detail;
        processingCount.textContent = count;
        processingBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
        processingTrack.setAttribute('aria-valuenow', String(Math.round(progress)));

        processingSteps.forEach((item, index) => {
            item.classList.toggle('is-active', index === step);
            item.classList.toggle('is-complete', step >= processingSteps.length || index < step);
            if (index === step) item.setAttribute('aria-current', 'step');
            else item.removeAttribute('aria-current');
        });
    }

    function beginProcessing(title, {clearing = false} = {}) {
        processingCard.classList.remove('has-success', 'has-error');
        const labels = clearing
            ? [['A ler palpites', 'Jogo e previsões'], ['A anular prémios', 'Movimentos e carteiras'], ['A limpar resultados', 'Palpites e acertos'], ['A recalcular fama', 'Totais dos utilizadores']]
            : [['A ler palpites', 'Jogos e previsões'], ['A distribuir pontos e prémios', 'Pontos, moedas e movimentos'], ['A guardar resultados', 'Palpites e acertos'], ['A recalcular fama', 'Totais dos utilizadores']];
        processingSteps.forEach((item, index) => {
            item.querySelector('strong').textContent = labels[index][0];
            item.querySelector('small').textContent = labels[index][1];
        });
        processingOverlay.hidden = false;
        processingOverlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('processing-active');
        updateProcessing({step: 0, progress: 2, title, detail: 'A iniciar a leitura dos palpites.', count: 'A preparar…'});
    }

    async function finishProcessing(success, message = '') {
        processingCard.classList.toggle('has-success', success);
        processingCard.classList.toggle('has-error', !success);
        updateProcessing({
            step: success ? processingSteps.length : -1,
            progress: success ? 100 : Number(processingTrack.getAttribute('aria-valuenow')),
            title: success ? 'Processamento concluído' : 'O processamento foi interrompido',
            detail: success ? 'Os resultados e os totais foram atualizados.' : (message || 'Ocorreu um erro durante o processamento.'),
            count: success ? 'Concluído' : 'Verifica a mensagem de erro no painel.'
        });
        await new Promise(resolve => setTimeout(resolve, success ? 650 : 1000));
        processingOverlay.hidden = true;
        processingOverlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('processing-active');
    }

    const MOVEMENT_CHUNK_SIZE = 50;
    const FIRESTORE_BATCH_SIZE = 450;

    async function postMovementEntries(entries, onProgress = () => {}) {
        if (entries.length === 0) {
            onProgress(0, 0);
            return;
        }
        let completed = 0;
        for (let index = 0; index < entries.length; index += MOVEMENT_CHUNK_SIZE) {
            const chunk = entries.slice(index, index + MOVEMENT_CHUNK_SIZE);
            await callFinance('adminPostMovements', {entries: chunk});
            completed += chunk.length;
            onProgress(completed, entries.length);
        }
    }

    async function commitPredictionUpdates(updates, extraWrites = [], onProgress = () => {}) {
        const writes = [...extraWrites, ...updates];
        if (writes.length === 0) {
            onProgress(0, 0);
            return;
        }
        let completed = 0;
        for (let index = 0; index < writes.length; index += FIRESTORE_BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = writes.slice(index, index + FIRESTORE_BATCH_SIZE);
            chunk.forEach(({ref, data}) => {
                batch.update(ref, data);
            });
            await batch.commit();
            completed += chunk.length;
            onProgress(completed, writes.length);
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
    
    async function recalculateUserFameForSeason(userIds, season, onProgress = () => {}) {
        const ids = [...userIds];
        const concurrency = 10;
        if (ids.length === 0) {
            onProgress(0, 0);
            return 0;
        }
        let completed = 0;
        for (let index = 0; index < ids.length; index += concurrency) {
            const chunk = ids.slice(index, index + concurrency);
            await Promise.all(chunk.map(userId =>
                callFinance('adminUserReconcile', { userId, season, fields: ['fame'] })
            ));
            completed += chunk.length;
            onProgress(completed, ids.length);
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
        beginProcessing('A anular resultado', {clearing: true});
        
        const affectedUserIds = new Set();
        const currentSeason = temporadaSelect.value;

        try {
            const gameRef = doc(db, 'whowinsJogos', gameId);
            const predictionsQuery = query(collection(db, 'palpiteswhowins'), where("nomeJogo", "==", gameId));
            const predictionsSnapshot = await getDocs(predictionsQuery);
            updateProcessing({
                step: 0,
                progress: 30,
                title: 'A ler palpites',
                detail: 'A preparar a anulação deste jogo.',
                count: `${predictionsSnapshot.size} palpite(s) encontrado(s)`
            });
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
            updateProcessing({step: 1, progress: 38, title: 'A anular prémios', detail: 'A corrigir os movimentos financeiros.', count: `0 / ${movementEntries.length} movimento(s)`});
            await postMovementEntries(movementEntries, (done, total) => updateProcessing({
                step: 1, progress: total ? 38 + (done / total) * 24 : 62,
                title: 'A anular prémios', detail: 'A corrigir as carteiras e o ledger.', count: `${done} / ${total} movimento(s)`
            }));
            updateProcessing({step: 2, progress: 65, title: 'A limpar resultados', detail: 'A guardar a anulação dos palpites.', count: `0 / ${predictionUpdates.length + 1} registo(s)`});
            await commitPredictionUpdates(predictionUpdates, [{ref: gameRef, data: {resultado: null}}], (done, total) => updateProcessing({
                step: 2, progress: total ? 65 + (done / total) * 20 : 85,
                title: 'A limpar resultados', detail: 'A atualizar os palpites e o jogo.', count: `${done} / ${total} registo(s)`
            }));
            updateProcessing({step: 3, progress: 88, title: 'A recalcular fama', detail: 'A atualizar os totais dos utilizadores afetados.', count: `0 / ${affectedUserIds.size} utilizador(es)`});
            const updatedFameCount = await recalculateUserFameForSeason(affectedUserIds, currentSeason, (done, total) => updateProcessing({
                step: 3, progress: total ? 88 + (done / total) * 10 : 98,
                title: 'A recalcular fama', detail: 'A fechar a cascata de processamento.', count: `${done} / ${total} utilizador(es)`
            }));

            gameItem.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            const gameIndex = allGamesData.findIndex(g => g.id === gameId);
            if (gameIndex > -1) allGamesData[gameIndex].resultado = null;
            
            showFeedback(`Resultado e ${predictionsSnapshot.size} palpites limpos. Fama recalculada para ${updatedFameCount} utilizador(es).`, 'info');
            await finishProcessing(true);
        } catch (error) {
            console.error("Erro ao remover resultado:", error);
            showFeedback(error.message || "Ocorreu um erro ao remover o resultado.", 'error');
            await finishProcessing(false, error.message);
        } finally {
            clickedButton.disabled = false;
            clickedButton.textContent = 'Sem Resultado';
            launchBtn.disabled = false;
            isProcessing = false;
        }
    }

    async function handleLaunchResults() {
        if (isProcessing) return;
        const gamesToProcess = currentlyDisplayedGames.filter(game => Boolean(game.resultado));
        if (gamesToProcess.length === 0) {
            showFeedback('Escolhe o resultado de pelo menos um jogo antes de lançar.', 'info');
            return;
        }

        isProcessing = true;
        launchBtn.disabled = true;
        launchBtn.textContent = 'A processar...';
        beginProcessing('A preparar resultados');

        const selectedSeason = temporadaSelect.value;
        const affectedUserIds = new Set();
        const movementEntries = [];
        const predictionUpdates = [];
        const settlementAmounts = new Map();

        try {
            const arenaDocSnap = await getDoc(doc(db, 'paineis', 'paineis arena'));
            const arenaPrizes = arenaDocSnap.exists() ? arenaDocSnap.data() : {};
            updateProcessing({step: 0, progress: 5, title: 'A ler palpites', detail: 'A procurar os palpites dos jogos com resultado.', count: `0 / ${gamesToProcess.length} jogo(s)`});

            for (let gameIndex = 0; gameIndex < gamesToProcess.length; gameIndex++) {
                const game = gamesToProcess[gameIndex];
                const configuredPrize = Number(arenaPrizes[game.arena]?.ganhos ?? 0);
                if (!Number.isFinite(configuredPrize) || configuredPrize < 0 || configuredPrize > 1e12) {
                    throw new Error(`O prémio configurado para a arena ${game.arena || 'desconhecida'} é inválido.`);
                }
                const prizeValue = configuredPrize;
                updateProcessing({
                    step: 0,
                    progress: 5 + (gameIndex / gamesToProcess.length) * 30,
                    title: 'A ler palpites',
                    detail: `A carregar palpites de ${game.nomeJogo || 'um jogo'}.`,
                    count: `${gameIndex} / ${gamesToProcess.length} jogo(s) lido(s)`
                });
                const predictionsQuery = query(
                    collection(db, 'palpiteswhowins'),
                    where('nomeJogo', '==', game.id)
                );
                const predictionsSnapshot = await getDocs(predictionsQuery);

                for (let predictionIndex = 0; predictionIndex < predictionsSnapshot.docs.length; predictionIndex++) {
                    const predictionDoc = predictionsSnapshot.docs[predictionIndex];
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

                    if ((predictionIndex + 1) % 25 === 0 || predictionIndex + 1 === predictionsSnapshot.size) {
                        const readRatio = (gameIndex + (predictionIndex + 1) / predictionsSnapshot.size) / gamesToProcess.length;
                        updateProcessing({
                            step: 0,
                            progress: 5 + readRatio * 30,
                            title: 'A ler palpites',
                            detail: `A calcular os prémios de ${game.nomeJogo || 'um jogo'}.`,
                            count: `${predictionUpdates.length} palpite(s) lido(s)`
                        });
                        await new Promise(resolve => requestAnimationFrame(resolve));
                    }
                }

                if (predictionsSnapshot.empty) {
                    updateProcessing({
                        step: 0,
                        progress: 5 + ((gameIndex + 1) / gamesToProcess.length) * 30,
                        title: 'A ler palpites',
                        detail: `Não há palpites para ${game.nomeJogo || 'este jogo'}.`,
                        count: `${gameIndex + 1} / ${gamesToProcess.length} jogo(s) lido(s)`
                    });
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            }

            // O ledger altera a carteira em transações determinísticas; os palpites ficam em batches separados.
            updateProcessing({
                step: 1,
                progress: 38,
                title: 'A distribuir pontos e prémios',
                detail: 'A atualizar carteiras e movimentos financeiros.',
                count: `0 / ${movementEntries.length} movimento(s)`
            });
            await postMovementEntries(movementEntries, (done, total) => updateProcessing({
                step: 1,
                progress: total ? 38 + (done / total) * 25 : 63,
                title: 'A distribuir pontos e prémios',
                detail: 'A gravar os prémios no ledger financeiro.',
                count: `${done} / ${total} movimento(s)`
            }));
            updateProcessing({step: 2, progress: 66, title: 'A guardar resultados', detail: 'A registar acertos e prémios nos palpites.', count: `0 / ${predictionUpdates.length} palpite(s)`});
            await commitPredictionUpdates(predictionUpdates, [], (done, total) => updateProcessing({
                step: 2, progress: total ? 66 + (done / total) * 19 : 85,
                title: 'A guardar resultados', detail: 'A gravar os resultados na base de dados.', count: `${done} / ${total} palpite(s)`
            }));
            updateProcessing({step: 3, progress: 87, title: 'A recalcular fama', detail: 'A atualizar os totais dos utilizadores premiados.', count: `0 / ${affectedUserIds.size} utilizador(es)`});
            const updatedFameCount = await recalculateUserFameForSeason(affectedUserIds, selectedSeason, (done, total) => updateProcessing({
                step: 3, progress: total ? 87 + (done / total) * 11 : 98,
                title: 'A recalcular fama', detail: 'A fechar o processamento dos resultados.', count: `${done} / ${total} utilizador(es)`
            }));

            showFeedback(
                `Resultados lançados! ${predictionUpdates.length} palpites atualizados. Fama recalculada para ${updatedFameCount} utilizador(es).`,
                'success'
            );
            await finishProcessing(true);
        } catch (error) {
            console.error('Erro ao lançar resultados:', error);
            showFeedback(error.message || 'Ocorreu um erro ao processar os resultados.', 'error');
            await finishProcessing(false, error.message);
        } finally {
            launchBtn.disabled = false;
            launchBtn.textContent = 'Lançar Resultados';
            isProcessing = false;
        }
    }

    initializeFilters();
});
