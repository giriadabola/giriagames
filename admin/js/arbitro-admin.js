// Importa a conexão 'db' do guardião central. A inicialização do Firebase já foi feita lá.
import { db } from './auth-guard.js';

// Importa as outras funções do Firestore que esta página específica precisa.
import { collection, getDocs, doc, getDoc, updateDoc, where, addDoc, serverTimestamp, getCountFromServer, query, limit, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { CADERNETA_FREE_PACK_TYPE, CADERNETA_GIFT_OFFERS_COLLECTION, CADERNETA_GIFT_SOURCE_NAME, buildCadernetaGiftOfferId, isEligibleFreePackRound, normalizeSeasonKey } from "../../caderneta/pack-offers.js";

// ========================================================================
// === INTERAÇÃO DO POPUP & DRAGGING (Movido de arbitro.html) ===
// ========================================================================

function handlePaste(event) {
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData('text');
    const textarea = event.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    textarea.value = currentText.substring(0, start) + text + currentText.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    setTimeout(() => {
        textarea.value = textarea.value.trimRight() + '\n/////////////////////////////////////////////////////////////////////////////////////////////////////////\n';
    }, 0);
}

const inputTextArea = document.getElementById("inputTextArea");
if (inputTextArea) {
    inputTextArea.addEventListener('paste', handlePaste);
}

const popup = document.getElementById('settings-popup');
const settingsIcon = document.getElementById('settings-icon-container');
const closeButtonTopRight = document.getElementById('popup-close');
const closeButtonScrollable = document.getElementById('popup-close-scrollable');

const togglePopup = () => {
     if (popup.style.display === 'none' || !popup.style.display) {
        popup.style.display = 'block';
        popup.style.transform = 'none';
        // Calcular posição centralizada em pixels para evitar o pulo do transform translate(-50%, -50%)
        const popupWidth = popup.offsetWidth;
        const popupHeight = popup.offsetHeight;
        popup.style.left = Math.max(0, (window.innerWidth - popupWidth) / 2) + 'px';
        popup.style.top = Math.max(0, (window.innerHeight - popupHeight) / 2) + 'px';
        
        setTimeout(() => {
            popup.style.opacity = '1';
            popup.style.visibility = 'visible';
        }, 10);
    } else {
        popup.style.opacity = '0';
        popup.style.visibility = 'hidden';
        setTimeout(() => {
            popup.style.display = 'none';
        }, 300);
    }
};

const closePopup = () => {
    popup.style.opacity = '0';
    popup.style.visibility = 'hidden';
    setTimeout(() => {
        popup.style.display = 'none';
    }, 300);
};

if (settingsIcon && popup && closeButtonTopRight && closeButtonScrollable) {
     settingsIcon.addEventListener('click', togglePopup);
     closeButtonTopRight.addEventListener('click', closePopup);
     closeButtonScrollable.addEventListener('click', closePopup);
}

const clipboardPasteBtn = document.getElementById('clipboard-paste-button');
if (clipboardPasteBtn) {
     clipboardPasteBtn.addEventListener('click', async () => {
         try {
             const text = await navigator.clipboard.readText();
             const textarea = document.getElementById('inputTextArea');
             if (textarea) {
                 textarea.value = text;
                 textarea.dispatchEvent(new Event('input', { bubbles: true }));
                 textarea.dispatchEvent(new Event('change', { bubbles: true }));
                 if (typeof window.convertToTable === 'function') {
                     window.convertToTable();
                 }
             }
         } catch (err) {
             console.error('Falha ao ler a área de transferência: ', err);
             alert('Não foi possível ler a área de transferência automaticamente. Por favor, dê permissão ao navegador ou cole usando Ctrl+V.');
         }
     });
}

let isDragging = false;
let offsetX = 0;
let offsetY = 0;
let initialPopupX = 0;
let initialPopupY = 0;

if (popup) {
    const popupHeader = popup.querySelector('h2');
    if (popupHeader) {
        popupHeader.style.cursor = 'grab';
        popupHeader.style.userSelect = 'none';
    }

    popup.addEventListener('mousedown', (e) => {
         const clickedElement = e.target;
         const isHeader = clickedElement.tagName === 'H2' || clickedElement.closest('h2');
         const isCloseButton = clickedElement.id === 'popup-close' ||
                              clickedElement.closest('#popup-close') ||
                              clickedElement.id === 'popup-close-scrollable' ||
                              clickedElement.closest('#popup-close-scrollable');

         if (isHeader && !isCloseButton) {
            isDragging = true;
            const rect = popup.getBoundingClientRect();
            initialPopupX = rect.left;
            initialPopupY = rect.top;
            offsetX = e.clientX;
            offsetY = e.clientY;
            popup.style.cursor = 'grabbing';
            if (popupHeader) popupHeader.style.cursor = 'grabbing';
            popup.style.userSelect = 'none';
         }
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - offsetX;
        const dy = e.clientY - offsetY;
        let newX = initialPopupX + dx;
        let newY = initialPopupY + dy;
        const popupWidth = popup.offsetWidth;
        const popupHeight = popup.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        newX = Math.max(0, Math.min(newX, windowWidth - popupWidth));
        newY = Math.max(0, Math.min(newY, windowHeight - popupHeight));
        popup.style.left = newX + 'px';
        popup.style.top = newY + 'px';
    });
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            popup.style.cursor = '';
            const popupHeader = popup.querySelector('h2');
            if (popupHeader) popupHeader.style.cursor = 'grab';
            popup.style.userSelect = '';
        }
    });
}

// ========================================================================
// === SCRIPT PRINCIPAL DO ÁRBITRO ===
// ========================================================================

let currentRound = null;
let currentGame = null;
let currentGPlayer = null;
let allPredictions = [];
let isProcessingLaunch = false;
let totalEligibleVoters = 0;

async function loadPredictions() {
    let qualifiedGPlayers = [];
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("aceite", "==", "Yes"), where("natabela", "==", "Yes"));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            qualifiedGPlayers.push({
                id: doc.id,
                nometabela: doc.data().nometabela
            });
        });
        qualifiedGPlayers.sort((a, b) => a.nometabela.localeCompare(b.nometabela));
    } catch (error) {
        console.error("Erro ao buscar GPlayers qualificados:", error);
    }

    try {
        const predictionsContainer = document.getElementById('predictions-container');
        const roundFilter = document.getElementById('round-filter');
        const palpitesSnapshot = await getDocs(collection(db, 'palpites'));
        allPredictions = [];
        const rounds = new Set();
        if (palpitesSnapshot.empty) {
            predictionsContainer.innerHTML = '<div class="prediction-card">Nenhum palpite encontrado.</div>';
            return;
        }
        const uniqueJogoIdsFromPalpites = [...new Set(palpitesSnapshot.docs.map(d => d.data().jogoId).filter(Boolean))];
        const jogoPromises = uniqueJogoIdsFromPalpites.map(id => getDoc(doc(db, 'jogos', id)));
        const jogoDocs = await Promise.all(jogoPromises);
        const jogosDataMap = jogoDocs.reduce((acc, docSnap) => {
            if (docSnap.exists()) acc[docSnap.id] = docSnap.data();
            return acc;
        }, {});
        for (const palpiteDoc of palpitesSnapshot.docs) {
            const palpite = palpiteDoc.data();
            const jogoData = palpite.jogoId ? jogosDataMap[palpite.jogoId] : null;
            const numeroPalpites = jogoData && typeof jogoData.numeroPalpites === 'number' ? jogoData.numeroPalpites : 0;
            if (palpite.ronda) {
                rounds.add(palpite.ronda);
            }
            allPredictions.push({
                id: palpiteDoc.id,
                ...palpite,
                numeroPalpites: numeroPalpites
            });
        }
        const sortedRounds = Array.from(rounds).sort((a, b) => b - a);
        roundFilter.innerHTML = '<option value="">Todas as Rondas</option>';
        sortedRounds.forEach(round => {
            roundFilter.innerHTML += `<option value="${round}">Ronda ${round}</option>`;
        });
        function updateGameFilter() {
            const gameFilter = document.getElementById('game-filter');
            const filteredByRound = currentRound ? allPredictions.filter(p => p.ronda === currentRound) : allPredictions;
            const games = new Set(filteredByRound.map(p => p.nomeJogo).filter(Boolean));
            const sortedGames = Array.from(games).sort();
            gameFilter.innerHTML = '<option value="">Todos os Jogos</option>';
            sortedGames.forEach(game => {
                const teamNamesMatch = game.match(/^([^-]+ vs [^-]+)/);
                const displayGameName = teamNamesMatch ? teamNamesMatch[1].trim() : game;
                gameFilter.innerHTML += `<option value="${game}">${displayGameName}</option>`;
            });
            gameFilter.value = currentGame || '';
        }
        const gameFilter = document.getElementById('game-filter');
        const gplayerFilter = document.getElementById('gplayer-filter');
        roundFilter.replaceWith(roundFilter.cloneNode(true));
        gameFilter.replaceWith(gameFilter.cloneNode(true));
        gplayerFilter.replaceWith(gplayerFilter.cloneNode(true));
        document.getElementById('round-filter').addEventListener('change', (e) => {
            currentRound = e.target.value === "" ? null : Number(e.target.value);
            currentGame = null;
            updateGameFilter();
            loadPredictions();
        });
        document.getElementById('game-filter').addEventListener('change', (e) => {
            currentGame = e.target.value || null;
            loadPredictions();
        });
        document.getElementById('gplayer-filter').addEventListener('change', (e) => {
            currentGPlayer = e.target.value || null;
            loadPredictions();
        });
        if (sortedRounds.length > 0 && currentRound === null) {
            currentRound = sortedRounds[0];
            document.getElementById('round-filter').value = currentRound;
        } else {
           document.getElementById('round-filter').value = currentRound || '';
        }
        updateGameFilter();

        const gplayerFilterElement = document.getElementById('gplayer-filter');
        gplayerFilterElement.innerHTML = '<option value="">Todos os GPlayers</option>';
        qualifiedGPlayers.forEach(player => {
            gplayerFilterElement.innerHTML += `<option value="${player.id}">${player.nometabela}</option>`;
        });
        gplayerFilterElement.value = currentGPlayer || '';
        
        let filteredPredictions = allPredictions;
        if (currentRound) {
            filteredPredictions = filteredPredictions.filter(p => p.ronda === currentRound);
        }
        if (currentGame) {
            filteredPredictions = filteredPredictions.filter(p => p.nomeJogo === currentGame);
        }
        
        if (currentGPlayer) {
            filteredPredictions = filteredPredictions.filter(p => p.userId === currentGPlayer);
        }

        filteredPredictions.sort((a, b) => {
            const jogoA_data = jogosDataMap[a.jogoId];
            const jogoB_data = jogosDataMap[b.jogoId];
            if (!jogoA_data || !jogoB_data || !jogoA_data.dataJogo || !jogoB_data.dataJogo) return 0;
            const dateA = jogoA_data.dataJogo.toDate();
            const dateB = jogoB_data.dataJogo.toDate();
            const dateDifference = dateA - dateB; 

            if (dateDifference !== 0) {
                return dateDifference;
            }
            const nomeJogoA = jogoA_data.nomeJogo || '';
            const nomeJogoB = jogoB_data.nomeJogo || '';
            return nomeJogoA.localeCompare(nomeJogoB);
        });

       const voterCountDisplay = document.getElementById('voter-count-display');
        if (currentGame && totalEligibleVoters > 0) {
            const votedUserIds = new Set(filteredPredictions.map(p => p.userId));
            const votedCount = votedUserIds.size;
            voterCountDisplay.textContent = `(${votedCount}/${totalEligibleVoters})`;
            if (votedCount === totalEligibleVoters) {
                voterCountDisplay.style.color = '#28a745';
            } else {
                voterCountDisplay.style.color = '#dc3545';
            }
        } else {
            voterCountDisplay.textContent = '';
        }

        let predictionsHTML = '';
        predictionsContainer.innerHTML = '<div class="loading">Carregando palpites...</div>';
        if (filteredPredictions.length === 0) {
            predictionsContainer.innerHTML = '<div class="prediction-card">Nenhum palpite encontrado para os filtros selecionados.</div>';
            return;
        }
        const uniqueUserIds = [...new Set(filteredPredictions.map(p => p.userId).filter(Boolean))];
        const userPromises = uniqueUserIds.map(id => getDoc(doc(db, 'users', id)));
        const uniqueClubIds = new Set();
        filteredPredictions.forEach(p => {
            const jogo = p.jogoId ? jogosDataMap[p.jogoId] : null;
            if (jogo) {
                if (jogo.equipaCasaId) uniqueClubIds.add(jogo.equipaCasaId);
                if (jogo.equipaForaId) uniqueClubIds.add(jogo.equipaForaId);
            }
        });
        const clubPromises = Array.from(uniqueClubIds).map(id => getDoc(doc(db, 'clubes', id)));
        const [userDocs, clubDocs] = await Promise.all([
            Promise.all(userPromises),
            Promise.all(clubPromises)
        ]);
        const usersData = userDocs.reduce((acc, docSnap) => {
            if (docSnap.exists()) acc[docSnap.id] = docSnap.data();
            return acc;
        }, {});
        const clubsData = clubDocs.reduce((acc, docSnap) => {
            if (docSnap.exists()) acc[docSnap.id] = docSnap.data();
            return acc;
        }, {});

        for (const palpite of filteredPredictions) {
            try {
                if (!palpite.jogoId) {
                    console.warn('Palpite sem jogoId encontrado:', palpite.id);
                    continue;
                }
                const jogo = jogosDataMap[palpite.jogoId];
                if (!jogo) {
                    console.warn(`Dados do Jogo com ID ${palpite.jogoId} não encontrados ou carregados.`);
                    continue;
                }
                if (!jogo.equipaCasaId || !jogo.equipaForaId) {
                    console.warn(`Jogo com ID ${palpite.jogoId} tem IDs de equipa em falta:`, jogo);
                    continue;
                }
                const equipaCasaData = clubsData[jogo.equipaCasaId];
                const equipaForaData = clubsData[jogo.equipaForaId];
                const equipaCasa = equipaCasaData?.nome || 'Equipa Casa?';
                const equipaFora = equipaForaData?.nome || 'Equipa Fora?';
                let dataFormatada = 'Data?';
                try {
                    if (jogo.dataJogo && typeof jogo.dataJogo.toDate === 'function') {
                        const dataJogo = jogo.dataJogo.toDate();
                        dataFormatada = dataJogo.toLocaleDateString('pt-PT');
                    }
                } catch (error) {
                    console.warn('Erro ao formatar data do jogo:', jogo.jogoId, error);
                }
                const userData = palpite.userId ? usersData[palpite.userId] : null;
                const userName = userData?.nometabela || palpite.nometabela || 'GPlayer?';

                let statusIndicatorHTML = '';
                if (palpite.Analisado === "Sim") {
                    statusIndicatorHTML = `<span class="status-indicator" title="Este palpite já foi lançado ao público.">🟢</span>`;
                } else {
                    statusIndicatorHTML = `<span class="status-indicator" title="Este palpite ainda não foi analisado e lançado.">🟠</span>`;
                }
                
                let palpitesHTML = '';
                for (let i = 1; i <= 10; i++) {
                    const palpiteKey = `palpite${i}`;
                    const pontosKey = `Palpite${i}PontosQuanto`;
                    const statusKey = `palpite${i}Status`;
                    if (palpite[palpiteKey]) {
                        const status = palpite[statusKey] || 'neutro';
                        palpitesHTML += `
                            <div class="prediction-value">
                                <div class="prediction-points">
                                    <span class="prediction-label">Palpite ${i}</span>
                                    <span class="prediction-number ${status}">${palpite[palpiteKey]}</span>
                                </div>
                                <input type="number" class="points-input" min="0" max="999" value="${palpite[pontosKey] || ''}" data-palpite-id="${palpite.id}" data-pontos-key="${pontosKey}" placeholder="Pts">
                                <select class="status-select ${status}" data-palpite-id="${palpite.id}" data-status-key="${statusKey}">
                                    <option value="neutro" ${status === 'neutro' ? 'selected' : ''}>Neutro</option>
                                    <option value="acerto" ${status === 'acerto' ? 'selected' : ''}>Acerto</option>
                                    <option value="falha" ${status === 'falha' ? 'selected' : ''}>Falha</option>
                                </select>
                            </div>`;
                   }
                }
                predictionsHTML += `
                    <div class="prediction-card" data-prediction-id="${palpite.id}">
                        <div class="prediction-header">
                            <div class="prediction-teams">${equipaCasa} vs ${equipaFora}${statusIndicatorHTML}</div>
                            <div class="prediction-date">${dataFormatada} - ${userName}</div>
                        </div>
                        <div class="prediction-values">${palpitesHTML}</div>
                    </div>`;
            } catch (error) {
                console.error('Erro ao processar o palpite com ID:', palpite?.id, error);
            }
        }
        predictionsContainer.innerHTML = predictionsHTML;
        addDynamicEventListeners();
    } catch (error) {
        console.error('Error loading predictions:', error);
        document.getElementById('predictions-container').innerHTML =
            '<div class="prediction-card">Erro ao carregar palpites. Tente atualizar a página.</div>';
    }
}

async function unifiedLaunchHandler() {
    const launchButton = document.getElementById('launch-button');
    const roundFilter = document.getElementById('round-filter');
    const ronda = Number(roundFilter.value);

    if (!ronda) {
        alert("Por favor, selecione uma ronda para lançar.");
        return;
    }

    launchButton.disabled = true;
    isProcessingLaunch = true;
    launchButton.classList.add('button--loading');
    launchButton.innerHTML = `A Lançar... <i class="fas fa-spinner fa-spin spinner"></i>`;
    
    console.log(`--- INICIANDO LANÇAMENTO UNIFICADO PARA A RONDA ${ronda} ---`);

    try {
        const allAffectedUserIds = new Set();

        console.log("==> Etapa 1: Processando Palpites Normais...");
        const palpitesAffectedUsers = await processNormalPalpites(ronda);
        palpitesAffectedUsers.forEach(id => allAffectedUserIds.add(id));
        console.log("==> Etapa 1: Concluída.");

        console.log("==> Etapa 2: Processando Mods de Jogo...");
        const modsAffectedUsers = await processGameMods(ronda);
        modsAffectedUsers.forEach(id => allAffectedUserIds.add(id));
        console.log("==> Etapa 2: Concluída.");
        
        if (allAffectedUserIds.size > 0) {
            console.log(`==> Etapa Final: Recalculando totais para ${allAffectedUserIds.size} utilizadores...`);
            const q = query(collection(db, "palpites"), where("ronda", "==", ronda), limit(1));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const temporada = querySnapshot.docs[0].data().temporada;
                const temporadaKey = temporada.replace('/', '');
                await recalculateUserTotals(Array.from(allAffectedUserIds), temporadaKey);
                await grantSeasonStarterCadernetaPacks({
                    round: ronda,
                    seasonLabel: temporada
                });
            }
            console.log("==> Etapa Final: Concluída.");
        }

        alert(`Lançamento da ronda ${ronda} concluído com sucesso!`);

    } catch (error) {
        console.error("ERRO GERAL no lançamento unificado:", error);
        alert("Ocorreu um erro durante o lançamento. Verifique a consola para mais detalhes.");
    } finally {
        console.log(`--- LANÇAMENTO UNIFICADO FINALIZADO ---`);
        launchButton.disabled = false;
        isProcessingLaunch = false;
        launchButton.classList.remove('button--loading');
        launchButton.innerHTML = 'Lançar';
    }
}

async function grantSeasonStarterCadernetaPacks({ round, seasonLabel }) {
    if (!isEligibleFreePackRound(round) || !seasonLabel) {
        return 0;
    }

    const seasonKey = normalizeSeasonKey(seasonLabel);
    const eligibleUsersQuery = query(
        collection(db, 'users'),
        where("aceite", "==", "Yes"),
        where("natabela", "==", "Yes")
    );
    const eligibleUsersSnapshot = await getDocs(eligibleUsersQuery);

    if (eligibleUsersSnapshot.empty) {
        return 0;
    }

    let createdOffers = 0;

    for (const userDoc of eligibleUsersSnapshot.docs) {
        const userId = userDoc.id;
        const offerId = buildCadernetaGiftOfferId({
            seasonKey,
            round,
            userId
        });
        const offerRef = doc(db, CADERNETA_GIFT_OFFERS_COLLECTION, offerId);
        const offerSnap = await getDoc(offerRef);

        if (offerSnap.exists()) {
            continue;
        }

        await setDoc(offerRef, {
            userId,
            temporada: seasonLabel,
            temporadaKey: seasonKey,
            ronda: round,
            sourceName: CADERNETA_GIFT_SOURCE_NAME,
            packType: CADERNETA_FREE_PACK_TYPE,
            status: 'pending',
            offeredAt: serverTimestamp()
        });
        createdOffers++;
    }

    console.log(`Ofertas de saquetas da caderneta criadas: ${createdOffers} para a ronda ${round}.`);
    return createdOffers;
}

async function processNormalPalpites(ronda) {
    const affectedUserIds = new Set();
    
    const palpitesQuery = query(collection(db, 'palpites'), where("ronda", "==", ronda));
    const palpitesSnapshot = await getDocs(palpitesQuery);
    
    if (palpitesSnapshot.empty) {
        console.log("Nenhum palpite normal encontrado para a ronda.");
        return affectedUserIds;
    }
    const allPalpitesDaRonda = palpitesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const palpite of allPalpitesDaRonda) {
        if (!palpite.userId || !palpite.jogoId || !palpite.temporada) {
            console.warn("Palpite com dados essenciais em falta, ignorado:", palpite.id);
            continue;
        }

        let cardTotalPontosPossiveis = 0;
        let cardTotalPontosGanhos = 0;
        let hasAtLeastOnePalpite = false;
        let containsNeutro = false;
        
        const palpiteUpdateData = {};

        for (let i = 1; i <= 10; i++) {
            if (palpite.hasOwnProperty(`palpite${i}`)) {
                hasAtLeastOnePalpite = true;
                const pontosValue = palpite[`Palpite${i}PontosQuanto`] || 0;
                const status = palpite[`palpite${i}Status`] || 'neutro';

                let pontosGanhosParaEstePalpite = 0;
                
                if (status === 'acerto') {
                    pontosGanhosParaEstePalpite = pontosValue;
                    cardTotalPontosGanhos += pontosValue;
                }

                palpiteUpdateData[`Palpite${i}PontosGanhos`] = pontosGanhosParaEstePalpite;

                if (status === 'neutro') {
                    containsNeutro = true;
                }
                cardTotalPontosPossiveis += pontosValue;
            }
        }
        
        if (hasAtLeastOnePalpite) {
            palpiteUpdateData["Analisado"] = !containsNeutro ? "Sim" : "Não";
            palpiteUpdateData["TotalPontosGanhos"] = cardTotalPontosGanhos;
            palpiteUpdateData["TotalPontosPossiveis"] = cardTotalPontosPossiveis;
            
            await updateDoc(doc(db, 'palpites', palpite.id), palpiteUpdateData);

            const temporadaKey = palpite.temporada.replace('/', '');
            const transacaoId = `palpite-${palpite.userId}-${palpite.jogoId}`;
            const movQuery = query(collection(db, 'movimentos'), where("detalhes.transacaoId", "==", transacaoId));
            const movSnapshot = await getDocs(movQuery);

            const movimentoData = {
                userId: palpite.userId,
                para: palpite.userId,
                de: 'ADMIN_USER_ID',
                valorreal: cardTotalPontosGanhos,
                preco: cardTotalPontosGanhos,
                estado: "Palpite Paid",
                temporada: temporadaKey,
                nomeJogo: palpite.nomeJogo,
                detalhes: { transacaoId: transacaoId, jogoId: palpite.jogoId }
            };

            if (movSnapshot.empty) {
                if (cardTotalPontosGanhos > 0) {
                    movimentoData.movimentoData = serverTimestamp();
                    await addDoc(collection(db, 'movimentos'), movimentoData);
                }
            } else {
                const docId = movSnapshot.docs[0].id;
                await updateDoc(doc(db, 'movimentos', docId), movimentoData);
            }
            
            affectedUserIds.add(palpite.userId);
        }
    }
    
    return affectedUserIds;
}

async function processGameMods(ronda) {
    const affectedUserIds = new Set();
    
    const pModsQuery = query(collection(db, 'palpitesmods'), where("ronda", "==", ronda));
    const pModsSnapshot = await getDocs(pModsQuery);
    const allPalpitesMods = pModsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (allPalpitesMods.length === 0) {
        return affectedUserIds;
    }

    const pOriginaisQuery = query(collection(db, 'palpites'), where("ronda", "==", ronda));
    const pOriginaisSnapshot = await getDocs(pOriginaisQuery);
    const allPalpitesDaRonda = pOriginaisSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const modsRules = {};

    const groupedByMod = allPalpitesMods.reduce((acc, p) => {
        acc[p.modId] = acc[p.modId] || [];
        acc[p.modId].push(p);
        return acc;
    }, {});

    for (const modId in groupedByMod) {
        if (!modsRules[modId]) {
            const modRef = doc(db, 'mods', modId);
            const modSnap = await getDoc(modRef);
            if (modSnap.exists()) {
                modsRules[modId] = modSnap.data();
            }
        }
        
        const modData = modsRules[modId];
        if (!modData) continue;

        if (modData.nomeMod === 'CRUSH BONES') {
            for (const pMod of groupedByMod[modId]) {
                const jogadorId = pMod.userId;
                const selecoesComPontos = []; 

                for (const aposta of pMod.selecoes) {
                    const jogoId = aposta.jogoId;
                    const alvoUserId = aposta.copiedFromUserId;
                    const palpiteAlvoTexto = aposta.palpiteSelecionado;
                    
                    const apostaAtualizada = { ...aposta };

                    const palpiteDoAlvo = allPalpitesDaRonda.find(p => p.userId === alvoUserId && p.jogoId === jogoId);
                    
                    if (!palpiteDoAlvo) {
                        selecoesComPontos.push(apostaAtualizada); 
                        continue;
                    }

                    let statusDoAlvo = null;
                    for (let i = 1; i <= 10; i++) {
                        if (palpiteDoAlvo[`palpite${i}`] === palpiteAlvoTexto) {
                            statusDoAlvo = palpiteDoAlvo[`palpite${i}Status`];
                            break;
                        }
                    }

                    if (statusDoAlvo !== 'acerto' && statusDoAlvo !== 'falha') {
                        selecoesComPontos.push(apostaAtualizada);
                        continue;
                    }

                    let pontosJogador = 0, pontosAlvo = 0;
                    if (statusDoAlvo === 'falha') {
                        pontosJogador = modData.regras.onAcerto.jogador;
                        pontosAlvo = modData.regras.onAcerto.alvo;
                    } else { // 'acerto'
                        pontosJogador = modData.regras.onFalha.jogador;
                        pontosAlvo = modData.regras.onFalha.alvo;
                    }

                    apostaAtualizada.pontosGanhosJogador = pontosJogador;
                    apostaAtualizada.pontosGanhosJogadorAlvo = pontosAlvo;

                    const transacaoModId = `${jogadorId}-${alvoUserId}-${jogoId}`;
                    const movQuery = query(collection(db, 'movimentos'), where("detalhes.transacaoModId", "==", transacaoModId));
                    const movSnapshot = await getDocs(movQuery);
                    
                    const temporadaKey = pMod.temporada.replace('/', '');
                    const commonDetails = {
                        modId: modId, nomeMod: modData.nomeMod, jogoId: jogoId,
                        transacaoModId: transacaoModId, autorUserId: jogadorId,
                        alvoUserId: alvoUserId, palpiteAlvo: palpiteAlvoTexto
                    };

                    if (movSnapshot.empty) {
                        const movJogador = { userId: jogadorId, valorreal: pontosJogador, estado: "Mod Play", temporada: temporadaKey, ronda: ronda, movimentoData: serverTimestamp(), detalhes: commonDetails };
                        const movAlvo = { userId: alvoUserId, valorreal: pontosAlvo, estado: "Mod Play", temporada: temporadaKey, ronda: ronda, movimentoData: serverTimestamp(), detalhes: commonDetails };
                        await Promise.all([
                            addDoc(collection(db, 'movimentos'), movJogador),
                            addDoc(collection(db, 'movimentos'), movAlvo)
                        ]);
                    } else {
                        const updatePromises = movSnapshot.docs.map(docSnap => {
                            const movData = docSnap.data();
                            const novoValor = movData.userId === jogadorId ? pontosJogador : pontosAlvo;
                            return updateDoc(doc(db, 'movimentos', docSnap.id), { valorreal: novoValor, detalhes: commonDetails, ronda: ronda });
                        });
                        await Promise.all(updatePromises);
                    }
                    
                    affectedUserIds.add(jogadorId);
                    affectedUserIds.add(alvoUserId);
                    
                    selecoesComPontos.push(apostaAtualizada);
                }

                if (selecoesComPontos.length > 0) {
                    await updateDoc(doc(db, 'palpitesmods', pMod.id), { selecoes: selecoesComPontos });
                }
            }
        }
    }
    
    return affectedUserIds;
}

async function recalculateUserTotals(userIds, temporadaKey) {
    const estadosQueValemPontos = ["Palpite Paid", "Mod Play"];

    for (const userId of userIds) {
        const userRef = doc(db, 'users', userId);
        const userUpdatePayload = {};

        const gcoinsQuery = query(collection(db, 'movimentos'), where("userId", "==", userId), where("temporada", "==", temporadaKey));
        let totalGCoins = 0;
        const gcoinsSnapshot = await getDocs(gcoinsQuery);
        
        gcoinsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.estado !== 'WhoWins Paid') {
                totalGCoins += (data.valorreal || 0);
            }
        });
        userUpdatePayload[`${temporadaKey}GCoins`] = totalGCoins;

        const pontosQuery = query(collection(db, 'movimentos'), where("userId", "==", userId), where("temporada", "==", temporadaKey), where("estado", "in", estadosQueValemPontos));
        let totalPontos = 0;
        const pontosSnapshot = await getDocs(pontosQuery);
        pontosSnapshot.forEach(doc => totalPontos += (doc.data().valorreal || 0));
        userUpdatePayload[`${temporadaKey}Pontos`] = totalPontos;
        
        if (Object.keys(userUpdatePayload).length > 0) {
            await updateDoc(userRef, userUpdatePayload);
            console.log(`Utilizador ${userId} atualizado: Pontos=${totalPontos}, GCoins=${totalGCoins}`);
        }
    }
}

async function fetchTotalEligibleVoters() {
    let qualifiedGPlayers = [];
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("aceite", "==", "Yes"), where("natabela", "==", "Yes"));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            qualifiedGPlayers.push({
                id: doc.id,
                nometabela: doc.data().nometabela
            });
        });
        qualifiedGPlayers.sort((a, b) => a.nometabela.localeCompare(b.nometabela));
    } catch (error) {
        console.error("Erro ao obter a contagem total de votantes:", error);
        totalEligibleVoters = 0; 
    }
}

function addDynamicEventListeners() {
     document.querySelectorAll('.status-select').forEach(select => {
         select.replaceWith(select.cloneNode(true));
     });
     document.querySelectorAll('.points-input').forEach(input => {
         input.replaceWith(input.cloneNode(true));
     });
     document.querySelectorAll('.status-select').forEach(select => {
         select.addEventListener('change', async (e) => {
            const palpiteId = e.target.dataset.palpiteId;
             const statusKey = e.target.dataset.statusKey;
             const newStatus = e.target.value;
             if (!palpiteId || !statusKey) return;
             try {
                 const palpiteRef = doc(db, 'palpites', palpiteId);
                 await updateDoc(palpiteRef, { [statusKey]: newStatus });
                 e.target.className = `status-select ${newStatus}`;
                 const predictionNumberSpan = e.target.closest('.prediction-value')?.querySelector('.prediction-number');
                 if (predictionNumberSpan) {
                     predictionNumberSpan.className = `prediction-number ${newStatus}`;
                 }
                 const localPredictionIndex = allPredictions.findIndex(p => p.id === palpiteId);
                 if(localPredictionIndex > -1) allPredictions[localPredictionIndex][statusKey] = newStatus;
             } catch (error) {
                 console.error('Error updating status:', error);
                 alert('Erro ao atualizar o status.');
                 const localPrediction = allPredictions.find(p => p.id === palpiteId);
                 if (localPrediction) {
                     e.target.value = localPrediction[statusKey] || 'neutro';
                     e.target.className = `status-select ${e.target.value}`;
                     const predictionNumberSpan = e.target.closest('.prediction-value')?.querySelector('.prediction-number');
                     if (predictionNumberSpan) {
                         predictionNumberSpan.className = `prediction-number ${e.target.value}`;
                     }
                 }
             }
         });
     });
     document.querySelectorAll('.points-input').forEach(input => {
         input.addEventListener('change', async (e) => {
             const palpiteId = e.target.dataset.palpiteId;
             const pontosKey = e.target.dataset.pontosKey;
             const value = e.target.value;
             if (!palpiteId || !pontosKey) return;
             const pointsValue = value ? parseInt(value) : 0;
             if (value && (pointsValue < 0 || pointsValue > 999)) {
                 alert('Por favor, insira um número entre 0 e 999.');
                 const localPrediction = allPredictions.find(p => p.id === palpiteId);
                 e.target.value = localPrediction ? (localPrediction[pontosKey] || '') : '';
                 return;
             }
             try {
                 const palpiteRef = doc(db, 'palpites', palpiteId);
                 await updateDoc(palpiteRef, { [pontosKey]: pointsValue });
                 const localPredictionIndex = allPredictions.findIndex(p => p.id === palpiteId);
                 if(localPredictionIndex > -1) allPredictions[localPredictionIndex][pontosKey] = pointsValue;
             } catch (error) {
                 console.error('Error updating points:', error);
                 alert('Erro ao atualizar os pontos.');
                 const localPrediction = allPredictions.find(p => p.id === palpiteId);
                 e.target.value = localPrediction ? (localPrediction[pontosKey] || '') : '';
             }
         });
     });
}

document.getElementById('launch-button').addEventListener('click', unifiedLaunchHandler);

function getBaseCategoryLocal(str) {
    if (typeof window.getBaseCategory === 'function') {
        return window.getBaseCategory(str);
    }
    if (!str || typeof str !== 'string') return '';
    return str.replace(/\s*\(?\d+(\.\d+)?\)?\s*$/, '').trim();
}

function findMatchingScore(popupTablesData, subCategoriaKey, opcaoKey) {
    if (!popupTablesData || !subCategoriaKey || !opcaoKey) return undefined;
    
    // 1. Try exact match first (e.g. "Outcome And Total Goals 2.5")
    let table = popupTablesData[subCategoriaKey];
    
    // 2. Try aliases map if exact match not found
    if (!table) {
        const subCatAliases = {
            "Primeira parte (Resultado)": "1st Half Result",
            "1st Half Result": "1st Half Result",
            "Resultado (Final)": "Match Result",
            "Match Result": "Match Result"
        };
        const mappedSub = subCatAliases[subCategoriaKey];
        if (mappedSub) table = popupTablesData[mappedSub];
    }

    // 3. Try base category (without trailing number, e.g. "Outcome And Total Goals")
    if (!table) {
        const baseKey = getBaseCategoryLocal(subCategoriaKey);
        if (baseKey && popupTablesData[baseKey]) {
            table = popupTablesData[baseKey];
        }
    }

    // 4. Fallback search across keys whose base category matches subCategoriaKey's base category
    if (!table) {
        const subBase = getBaseCategoryLocal(subCategoriaKey);
        if (subBase) {
            for (const key of Object.keys(popupTablesData)) {
                if (getBaseCategoryLocal(key) === subBase) {
                    table = popupTablesData[key];
                    break;
                }
            }
        }
    }

    if (!table) return undefined;

    // Check direct option match
    if (table[opcaoKey] !== undefined) return table[opcaoKey];

    // Check case-insensitive option match
    const opcaoLower = opcaoKey.toLowerCase().trim();
    for (const k of Object.keys(table)) {
        if (k.toLowerCase().trim() === opcaoLower) return table[k];
    }

    // Home / Draw / Away alias matching fallback
    const homeAliases = ["equipa da casa ganha", "equipa a ganha", "w1", "win1", "1", "home", "casa", "team 1"];
    const drawAliases = ["empate", "draw", "x", "tie"];
    const awayAliases = ["equipa visitante ganha", "equipa b ganha", "w2", "win2", "2", "away", "fora", "team 2"];
    const tableKeys = Object.keys(table);

    if (homeAliases.includes(opcaoLower)) {
        if (tableKeys.length >= 1) return table[tableKeys[0]];
    } else if (drawAliases.includes(opcaoLower)) {
        for (const k of tableKeys) {
            if (drawAliases.includes(k.toLowerCase())) return table[k];
        }
        if (tableKeys.length >= 2) return table[tableKeys[1]];
    } else if (awayAliases.includes(opcaoLower)) {
        if (tableKeys.length >= 3) return table[tableKeys[2]];
    }
    return undefined;
}

function parsePopupTables() {
    const tablesData = {};
    const tables = document.querySelectorAll('#settings-popup #outputTables table, #outputTables table');
    tables.forEach(table => {
        const originalCategory = table.getAttribute('data-original-category');
        const headerText = table.querySelector('thead th[colspan="3"]')?.textContent?.trim();

        const optionsMap = {};
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
                const optionText = cells[0].textContent.trim();
                const scoreText = cells[2].textContent.trim();
                const score = parseInt(scoreText, 10);
                if (!isNaN(score)) {
                    optionsMap[optionText] = score;
                }
            }
        });

        if (Object.keys(optionsMap).length > 0) {
            const keysToStore = new Set();
            if (originalCategory) keysToStore.add(originalCategory);
            if (headerText) keysToStore.add(headerText);

            keysToStore.forEach(k => {
                // Store exact category name
                tablesData[k] = Object.assign(tablesData[k] || {}, optionsMap);

                // Store & merge under base category name (without trailing numbers)
                const baseKey = getBaseCategoryLocal(k);
                if (baseKey) {
                    tablesData[baseKey] = Object.assign(tablesData[baseKey] || {}, optionsMap);
                }
            });
        }
    });
    return tablesData;
}

async function autoFillPoints() {
    const autoFillButton = document.getElementById('auto-fill-button');
    const rocketIcon = autoFillButton.querySelector('.fa-rocket');
    const loadingSpinner = autoFillButton.querySelector('.fa-spinner');
    autoFillButton.disabled = true;
    rocketIcon.style.display = 'none';
    loadingSpinner.style.display = 'inline-block';
    console.log("Auto-fill process started...");
    try {
        const popupTablesData = parsePopupTables();
        if (Object.keys(popupTablesData).length === 0) {
            alert("Nenhuma tabela de conversão encontrada no popup.\n\n1. Cole as odds na área de texto.\n2. Clique em 'Criar Tabela'.\n3. Tente preencher automaticamente novamente.");
            throw new Error("No conversion tables found in popup.");
        }
        const visiblePredictionElements = document.querySelectorAll('#predictions-container .prediction-card');
        if (visiblePredictionElements.length === 0) {
            alert("Nenhum palpite visível na página para preencher.\nVerifique os filtros de Ronda/Jogo/GPlayer.");
            throw new Error("No visible predictions to process.");
        }
        let updatesMade = 0;
        let notFoundCount = 0;
        let missingDataCount = 0;
        let saveErrors = 0;
        const savePromises = [];
        for (const cardElement of visiblePredictionElements) {
            const palpiteId = cardElement.dataset.predictionId;
            if (!palpiteId) continue;
            const palpiteData = allPredictions.find(p => p.id === palpiteId);
            if (!palpiteData) {
                console.warn(`Dados locais para o palpite visível ${palpiteId} não encontrados.`);
                missingDataCount++;
                continue;
            }
            const numeroPalpites = palpiteData.numeroPalpites || 0;
            if (numeroPalpites === 0) continue;
            for (let i = 1; i <= numeroPalpites; i++) {
                const indiceKey = `Palpite${i}IndiceIngles`;
                const pontosInputSelector = `.points-input[data-palpite-id="${palpiteId}"][data-pontos-key="Palpite${i}PontosQuanto"]`;
                const pontosInputElement = cardElement.querySelector(pontosInputSelector);
                if (!pontosInputElement) {
                    continue;
                }
                if (palpiteData[indiceKey] && palpiteData[indiceKey].PalpiteSubCategoria && palpiteData[indiceKey].PalpiteCategoria3) {
                    const subCategoriaKey = palpiteData[indiceKey].PalpiteSubCategoria;
                    const opcaoKey = palpiteData[indiceKey].PalpiteCategoria3;
                    const score = findMatchingScore(popupTablesData, subCategoriaKey, opcaoKey);
                    if (score !== undefined) {
                        if (pontosInputElement.value !== String(score)) {
                            pontosInputElement.value = score;
                            updatesMade++;
                            const pontosKey = `Palpite${i}PontosQuanto`;
                            const localPredictionIndex = allPredictions.findIndex(p => p.id === palpiteId);
                            if (localPredictionIndex > -1) {
                                allPredictions[localPredictionIndex][pontosKey] = score;
                            }
                            const updateData = { [pontosKey]: score };
                            const palpiteRef = doc(db, 'palpites', palpiteId);
                            const savePromise = updateDoc(palpiteRef, updateData)
                                .then(() => {
                                    console.log(`Auto-saved score ${score} for ${palpiteId}, field ${pontosKey}`);
                                })
                                .catch(error => {
                                    console.error(`Error auto-saving points for ${palpiteId}, field ${pontosKey}:`, error);
                                    saveErrors++;
                                });
                            savePromises.push(savePromise);
                        }
                    } else {
                        notFoundCount++;
                    }
                } else {
                    missingDataCount++;
                }
            }
        }
        await Promise.all(savePromises);
        console.log(`Auto-fill process finished. Updates: ${updatesMade}, Not Found: ${notFoundCount}, Missing Data: ${missingDataCount}, Save Errors: ${saveErrors}.`);
        let alertMessage = `Preenchimento automático concluído!\n\nCaixas atualizadas e gravadas: ${updatesMade}`;
        if (notFoundCount > 0) alertMessage += `\nCombinações não encontradas nas tabelas: ${notFoundCount}`;
        if (missingDataCount > 0) alertMessage += `\nPalpites com dados em falta: ${missingDataCount}`;
        if (saveErrors > 0) alertMessage += `\nFalhas ao gravar automaticamente: ${saveErrors}`;
        alert(alertMessage);
    } catch (error) {
         console.error('Error during auto-fill process:', error);
         if (error.message !== "No conversion tables found in popup." && error.message !== "No visible predictions to process.") {
             alert(`Ocorreu um erro durante o preenchimento automático:\n${error.message}`);
         }
    } finally {
         autoFillButton.disabled = false;
         rocketIcon.style.display = 'inline-block';
         loadingSpinner.style.display = 'none';
    }
}

const autoFillButton = document.getElementById('auto-fill-button');
if (autoFillButton) {
    autoFillButton.addEventListener('click', autoFillPoints);
} else {
    console.error("Botão de auto-preenchimento (foguetão) não encontrado!");
}

loadPredictions();
fetchTotalEligibleVoters();
