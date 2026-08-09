import { db, auth } from "../core/firebase.js";
import { doc, getDoc, collection, getDocs, query, where, updateDoc, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { buildAlfredoGiftMessage, CADERNETA_GIFT_OFFERS_COLLECTION, CADERNETA_GIFT_REDIRECT_PARAM } from "../caderneta/pack-offers.js";

async function logUserAction(actionDescription) {
    if (!auth.currentUser) {
        console.log("Nenhum utilizador logado para registar a ação.");
        return;
    }
    
    try {
        const eyeCollection = collection(db, 'eye');
        await addDoc(eyeCollection, {
            dataacao: serverTimestamp(),
            acao: actionDescription,
            userId: auth.currentUser.uid
        });
    } catch (error) {
        console.error("Erro ao registar ação na coleção 'eye':", error);
    }
}

const modCache = new Map();
const userCache = new Map();
const gameCache = new Map();

const loadingScreen = document.getElementById('loading-screen');
const content = document.querySelector('.content');
const rankingsBody = document.getElementById('rankings-body');
const alfredoPackPopup = document.getElementById('alfredo-pack-popup');
const alfredoPackMessage = document.getElementById('alfredo-pack-message');
const openAlfredoPackButton = document.getElementById('open-alfredo-pack-btn');
let currentUserStatus = null; // Store user status (estatuto)
let toastTimeout; 
let pendingGiftOfferCount = 0;
let mostRecentSeason; // <-- Variável global para a época mais recente

// --- Function to load Menu Settings ---
async function loadMenuSettings() {
    try {
        const menuSettingsDocRef = doc(db, 'paineis', 'paineis menu');
        const docSnap = await getDoc(menuSettingsDocRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null; // Return null if document doesn't exist
        }
    } catch (error) {
        return null; // Return null on error
    }
}

// --- Function to check page access based on status and menu settings ---
function checkPageAccess(userStatus, menuSettings) {
    if (!menuSettings) {
        // Default behavior if settings are missing: only ruler access
        return userStatus === 'ruler';
    }

    const rankingsEnabled = menuSettings['rankings'] === 'on';

    if (rankingsEnabled) {
        return true; // Access granted if rankings are 'on'
    } else {
        // Access granted only if rankings are 'off' BUT user is 'ruler'
        return userStatus === 'ruler';
    }
}

// Função para buscar o nome do Mod
async function getModName(modId) {
    if (modCache.has(modId)) {
        return modCache.get(modId);
    }
    try {
        const modDocRef = doc(db, 'mods', modId);
        const modDocSnap = await getDoc(modDocRef);
        if (modDocSnap.exists()) {
            const modName = modDocSnap.data().nomeMod;
            modCache.set(modId, modName); // Guarda em cache
            return modName;
        }
    } catch (error) {
        console.error("Erro ao buscar nome do mod:", error);
    }
    return 'Mod Desconhecido';
}

const gameDetailsCache = new Map();

// Função para buscar detalhes de um jogo (incluindo dataJogo)
async function getGameDetails(gameId) {
    if (!gameId) return null;
    if (gameDetailsCache.has(gameId)) {
        return gameDetailsCache.get(gameId);
    }
    try {
        const gameDocRef = doc(db, 'jogos', gameId);
        const gameDocSnap = await getDoc(gameDocRef);
        if (gameDocSnap.exists()) {
            const gameData = gameDocSnap.data();
            // Adiciona o nome limpo ao objeto para facilitar o uso
            gameData.nomeJogoLimpo = (gameData.nomeJogo || '').split(' - ')[0]; // <--- LINHA A REMOVER
            gameDetailsCache.set(gameId, gameData); 
            return gameData;
        }
    } catch (error) {
        console.error("Erro ao buscar detalhes do jogo:", error);
    }
    return null;
}

// Função para buscar o nome de tabela de um utilizador
async function getUserTableName(userId) {
    if (userCache.has(userId)) {
        return userCache.get(userId);
    }
    try {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userName = userDocSnap.data().nometabela;
            userCache.set(userId, userName); // Guarda em cache
            return userName;
        }
    } catch (error) {
        console.error("Erro ao buscar nometabela do user:", error);
    }
    return 'Utilizador Desconhecido';
}

// Função para buscar o nome de um jogo (assumindo que estão na coleção 'jogos')
async function getGameName(gameId) {
    if (!gameId) return 'Jogo Inválido'; // Adiciona uma verificação
    if (gameCache.has(gameId)) {
        return gameCache.get(gameId);
    }
    try {
        const gameDocRef = doc(db, 'jogos', gameId); 
        const gameDocSnap = await getDoc(gameDocRef);
        if (gameDocSnap.exists()) {
            const rawGameName = gameDocSnap.data().nomeJogo || '';
            const cleanGameName = rawGameName.split(' - ')[0];
            gameCache.set(gameId, cleanGameName); // Guarda em cache
            return cleanGameName;
        }
    } catch (error) {
        console.error("Erro ao buscar nome do jogo:", error);
    }
    return 'Jogo Desconhecido';
}

// --- Function to get User Status (estatuto) ---
async function getUserStatus(userId) {
    try {
        const userDocRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            if (userData.aceite !== "Yes") {
                return null; // Treat as not valid if terms not accepted
            }
            return userData.estatuto || null; // Return estatuto or null if missing
        } else {
            return null; // User document doesn't exist
        }
    } catch (error) {
        console.error('Error fetching user status:', error);
        return null; // Return null on error
    }
}

async function fetchPendingCadernetaGiftOffersCount(userId) {
    const offersQuery = query(
        collection(db, CADERNETA_GIFT_OFFERS_COLLECTION),
        where('userId', '==', userId),
        where('status', '==', 'pending')
    );
    const offersSnapshot = await getDocs(offersQuery);
    return offersSnapshot.size;
}

function showAlfredoGiftPopup() {
    if (!alfredoPackPopup || pendingGiftOfferCount <= 0) {
        return;
    }

    alfredoPackMessage.textContent = buildAlfredoGiftMessage(pendingGiftOfferCount);
    alfredoPackPopup.style.display = 'block';
}

function hideAlfredoGiftPopup() {
    if (alfredoPackPopup) {
        alfredoPackPopup.style.display = 'none';
    }
}

// --- Consolidated Authentication and Initialization Logic ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserStatus = await getUserStatus(user.uid);
        if (currentUserStatus === null) {
            window.location.href = '404.html';
            return;
        }

        try {
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
                ultimoacesso: serverTimestamp()
            });
        } catch (error) {
            console.error("Erro ao atualizar o campo ultimoacesso: ", error);
        }

        const menuSettings = await loadMenuSettings();
        const hasAccess = checkPageAccess(currentUserStatus, menuSettings);

        if (hasAccess) {
            // Regista a entrada na página
            await logUserAction(`Entrou em ${document.title}`);
            
            if (typeof updateMenuVisibility === 'function') {
                updateMenuVisibility(menuSettings);
            }
            await loadSeasons();
            
            if (mostRecentSeason) {
                await checkForRankingUpdateAndShowAnimation();
            }

            pendingGiftOfferCount = await fetchPendingCadernetaGiftOffersCount(user.uid);
            
            loadingScreen.style.display = 'none';
            content.style.display = 'block';

            if (pendingGiftOfferCount > 0 && animationPopup.style.display !== 'block') {
                showAlfredoGiftPopup();
            }
        } else {
            window.location.href = '404.html';
        }
    } else {
        loadingScreen.style.display = 'none';
        window.location.href = 'index.html';
    }
});

function showToast(message) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function updateStatusIndicator(isPending) {
    const indicator = document.getElementById('status-indicator');
    if (indicator) {
        indicator.onclick = null;
        indicator.style.cursor = 'default';
        if (isPending) {
            indicator.innerHTML = '🟠 Tabela Pendente';
            indicator.setAttribute('title', 'Ainda faltam atribuir pontos em alguns palpites.');
            indicator.style.cursor = 'pointer';
            indicator.onclick = () => {
                showToast('Ainda faltam atribuir pontos em alguns palpites.');
            };
        } else {
            indicator.innerHTML = '🟢 Tabela Atualizada';
            indicator.removeAttribute('title');
        }
    }
}

async function checkPendingPredictionsStatus(season) {
    try {
        const palpitesRef = collection(db, 'palpites');
        const q = query(palpitesRef,
            where('temporada', '==', season),
            where('Analisado', '!=', 'Sim')
        );
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error("Erro ao verificar o status dos palpites:", error);
        return true;
    }
}

async function loadSeasons() {
    const palpitesRef = collection(db, 'palpites');
    const palpitesSnap = await getDocs(palpitesRef);
    const seasons = new Set();

    palpitesSnap.forEach(doc => {
        const temporada = doc.data().temporada;
        if (temporada) seasons.add(temporada);
    });

    const sortedSeasons = Array.from(seasons).sort((a, b) => b.localeCompare(a));

    if (sortedSeasons.length > 0) {
        mostRecentSeason = sortedSeasons[0]; // <-- Define a variável global
        const isPending = await checkPendingPredictionsStatus(mostRecentSeason);
        updateStatusIndicator(isPending);
        await loadRankings(mostRecentSeason);
        await loadRoundHighlights(mostRecentSeason); // <-- Carrega os destaques da ronda
    } else {
        rankingsBody.innerHTML = '<tr><td colspan="4">Sem épocas disponíveis.</td></tr>';
        document.getElementById('status-indicator').style.display = 'none';
    }
}

async function loadRankings(season) {
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    const rankings = [];

    usersSnap.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.aceite === "Yes" && userData.estatuto && userData.natabela === "Yes") {
            const seasonPointsKey = season.replace('/', '') + 'Pontos';
            const seasonPoints = userData[seasonPointsKey] || 0;
            rankings.push({
                userId: userDoc.id,
                username: userData.nometabela || 'Utilizador Desconhecido',
                points: seasonPoints
            });
        }
    });

    rankings.sort((a, b) => b.points - a.points);
    rankingsBody.innerHTML = '';

    const totalUsers = rankings.length;
    if (totalUsers === 0) {
        rankingsBody.innerHTML = '<tr><td colspan="4">Sem jogadores classificados para esta época.</td></tr>';
        return;
    }

    rankings.forEach((rank, index) => {
        const row = document.createElement('tr');
        const position = index + 1;
        const positionCell = document.createElement('td');
        const playerCell = document.createElement('td');
        const pointsCell = document.createElement('td');
        const infoCell = document.createElement('td');

        const percentage = totalUsers > 1 ? position / totalUsers : 0;
        let backgroundColor;
        if (percentage <= 0.33) {
            const factor = percentage / 0.33;
            const green = Math.floor(200 - 100 * factor);
            backgroundColor = `rgba(50, ${green}, 50, 0.2)`;
        } else if (percentage <= 0.67) {
            const factor = (percentage - 0.33) / 0.34;
            const yellowComp = Math.floor(200 - 100 * factor);
            backgroundColor = `rgba(${yellowComp}, ${yellowComp}, 50, 0.2)`;
        } else {
            const factor = (percentage - 0.67) / 0.33;
            const red = Math.floor(200 - 100 * factor);
            backgroundColor = `rgba(${red}, 50, 50, 0.2)`;
        }

        if (position === 1) {
            positionCell.innerHTML = `<div class="podium-badge-container"><img src="assets/tabela/Emblema dourado de primeiro lugar.png" alt="1º" class="podium-badge" oncontextmenu="return false;" ondragstart="return false;"></div>`;
        } else if (position === 2) {
            positionCell.innerHTML = `<div class="podium-badge-container"><img src="assets/tabela/Emblema de prata em segundo lugar.png" alt="2º" class="podium-badge" oncontextmenu="return false;" ondragstart="return false;"></div>`;
        } else if (position === 3) {
            positionCell.innerHTML = `<div class="podium-badge-container"><img src="assets/tabela/Medal de bronze com coroa e louros.png" alt="3º" class="podium-badge" oncontextmenu="return false;" ondragstart="return false;"></div>`;
        } else {
            positionCell.innerHTML = `<div class="position-circle">${position}</div>`;
        }
        playerCell.innerHTML = `<span>${rank.username}</span>`;
        pointsCell.textContent = rank.points;
        infoCell.innerHTML = `<i class="fas fa-info-circle info-icon" data-userid="${rank.userId}" data-season="${season}"></i>`;
        row.style.backgroundColor = backgroundColor;
        row.appendChild(positionCell);
        row.appendChild(playerCell);
        row.appendChild(pointsCell);
        row.appendChild(infoCell);
        const infoIcon = infoCell.querySelector('.info-icon');
        infoIcon.addEventListener('click', () => togglePredictions(rank.userId, season));
        rankingsBody.appendChild(row);
    });
}

let selectedRounds = {};

async function togglePredictions(userId, season) {
    console.log(`%c[LOG] Iniciando busca de palpites para UserID: ${userId}, Época: ${season}`, 'background-color: #2176ff; color: white; padding: 2px 5px; border-radius: 3px;');
    const popup = document.getElementById('predictions-popup');
    const popupBody = document.getElementById('popup-predictions-body');
    const roundFilter = document.getElementById('round-filter');
    popupBody.innerHTML = 'A carregar previsões...';
    popup.style.display = "block";
    try {
        const palpitesRef = collection(db, 'palpites');
        const q = query(palpitesRef, where('userId', '==', userId), where('temporada', '==', season));
        const palpitesSnap = await getDocs(q);
        const modPalpitesRef = collection(db, 'palpitesmods');
        const attacksMadeQuery = query(modPalpitesRef, where('userId', '==', userId), where('temporada', '==', season));
        const attacksMadeSnap = await getDocs(attacksMadeQuery);
        const attacksMadeByRound = new Map();
        attacksMadeSnap.forEach(doc => {
            const data = doc.data();
            if (data.ronda) { attacksMadeByRound.set(String(data.ronda), { id: doc.id, ...data }); }
        });
        const allModsQuery = query(modPalpitesRef, where('temporada', '==', season));
        const allModsSnap = await getDocs(allModsQuery);
        const attacksReceivedByRound = new Map();
        allModsSnap.forEach(doc => {
            const modData = doc.data();
            if (modData.selecoes) {
                for (const key in modData.selecoes) {
                    const selection = modData.selecoes[key];
                    if (selection.copiedFromUserId === userId) {
                        const roundStr = String(modData.ronda);
                        if (!attacksReceivedByRound.has(roundStr)) { attacksReceivedByRound.set(roundStr, []); }
                        attacksReceivedByRound.get(roundStr).push({
                            attackerUserId: modData.userId,
                            modId: modData.modId,
                            ronda: modData.ronda,
                            gameId: selection.jogoId,
                            selection: selection
                        });
                    }
                }
            }
        });
        const predictions = [];
        const rounds = new Set();
        palpitesSnap.forEach(doc => {
            const data = doc.data();
            predictions.push({ ...data, id: doc.id, timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(0) });
            if (data.ronda) rounds.add(String(data.ronda));
        });
        attacksMadeByRound.forEach((mod) => rounds.add(String(mod.ronda)));
        attacksReceivedByRound.forEach((attacks, round) => rounds.add(round));
        const sortedRounds = Array.from(rounds).sort((a, b) => parseInt(a) - parseInt(b));
        const userSeasonKey = `${userId}-${season}`;
        const currentSelection = selectedRounds[userSeasonKey] || '';
        roundFilter.innerHTML = '<option value="">Todas as Rondas</option>';
        sortedRounds.forEach(round => {
            const option = document.createElement('option');
            option.value = round;
            option.textContent = `Ronda ${round}`;
            if (String(currentSelection) === String(round)) { option.selected = true; }
            roundFilter.appendChild(option);
        });
        roundFilter.value = currentSelection;
        const selectedRound = roundFilter.value;
        const filteredPredictions = selectedRound ? predictions.filter(p => String(p.ronda) === selectedRound) : predictions;
        const predictionsByRound = {};
        filteredPredictions.forEach(prediction => {
            const round = prediction.ronda || 'Desconhecida';
            if (!predictionsByRound[round]) { predictionsByRound[round] = []; }
            predictionsByRound[round].push(prediction);
        });
        const allRoundsInView = new Set();
        if (selectedRound) { allRoundsInView.add(selectedRound); } 
        else { sortedRounds.forEach(r => allRoundsInView.add(r)); }
        const roundStats = {};
        for (const round of allRoundsInView) {
            let totalPoints = 0; let isPending = false;
            const currentRoundPredictions = predictionsByRound[round] || [];
            for (const prediction of currentRoundPredictions) {
                if (prediction.Analisado !== "Sim") { isPending = true; break; }
                for (let i = 1; i <= 10; i++) { totalPoints += prediction[`Palpite${i}PontosGanhos`] || 0; }
            }
            if (isPending) { roundStats[round] = { text: '[em análise]' }; continue; }
            const attackMadeData = attacksMadeByRound.get(round);
            if (attackMadeData) {
                for (const key in attackMadeData.selecoes) {
                    const selection = attackMadeData.selecoes[key];
                    if (selection.hasOwnProperty('pontosGanhosJogador')) { totalPoints += selection.pontosGanhosJogador || 0; } 
                    else { isPending = true; break; }
                }
            }
            if (isPending) { roundStats[round] = { text: '[em análise]' }; continue; }
            const attacksReceivedData = attacksReceivedByRound.get(round);
            if (attacksReceivedData) {
                for (const attack of attacksReceivedData) {
                    if (attack.selection.hasOwnProperty('pontosGanhosJogadorAlvo')) { totalPoints += attack.selection.pontosGanhosJogadorAlvo || 0; } 
                    else { isPending = true; break; }
                }
            }
            if (isPending) { roundStats[round] = { text: '[em análise]' }; } 
            else { roundStats[round] = { text: `[${totalPoints} gPoints]` }; }
        }
        let predictionsHTML = '';
        const displaySortedRounds = Array.from(allRoundsInView).sort((a, b) => parseInt(b) - parseInt(a));
        if (displaySortedRounds.length === 0) { predictionsHTML = 'Nenhuma previsão encontrada para esta seleção.'; } 
        else {
            const roundToOpen = selectedRound || displaySortedRounds[0];
            for (const round of displaySortedRounds) {
                let hasContent = false;
                const isOpen = String(round) === String(roundToOpen);
                const roundPredictions = predictionsByRound[round] || [];
                let roundContentHTML = '';
                if (roundPredictions.length > 0) {
                    hasContent = true;
                    const enrichedPredictionsPromises = roundPredictions.map(async (prediction) => {
                        const gameDetails = await getGameDetails(prediction.jogoId);
                        return { ...prediction, dataJogo: gameDetails ? gameDetails.dataJogo : null, nomeJogoCompleto: gameDetails ? gameDetails.nomeJogo : (prediction.nomeJogo || 'Jogo Desconhecido') };
                    });
                    let enrichedPredictions = await Promise.all(enrichedPredictionsPromises);
                    enrichedPredictions.sort((a, b) => {
                        if (!a.dataJogo) return 1;
                        if (!b.dataJogo) return -1;
                        return a.dataJogo.toDate() - b.dataJogo.toDate();
                    });
                    enrichedPredictions.forEach(prediction => {
                        console.groupCollapsed(`[LOG JOGO] ${prediction.nomeJogoCompleto}`);
                        console.log('Objeto completo do palpite recebido do Firestore:', prediction);
                        let palpitesHTML = '';
                        for (let i = 1; i <= 10; i++) {
                            if (prediction[`palpite${i}`]) {
                                let pointsContent = '';
                                if (prediction.Analisado === "Sim") {
                                    const fieldName = `Palpite${i}PontosGanhos`;
                                    const rawValue = prediction[fieldName];
                                    const points = rawValue || 0;
                                    const pointsClass = points > 0 ? 'prediction-points' : 'prediction-points-negative';
                                    pointsContent = `<span class="${pointsClass}">(${points} pts)</span>`;
                                } else { pointsContent = `<span class="in-analysis"><em>(em análise)</em></span>`; }
                                palpitesHTML += `<div class="prediction-item">→ ${prediction[`palpite${i}`]} ${pointsContent}</div>`;
                            }
                        }
                        if (palpitesHTML) { roundContentHTML += `<div class="game-header">${prediction.nomeJogoCompleto}</div>${palpitesHTML}`; }
                        console.groupEnd();
                    });
                }
                const attackMadeData = attacksMadeByRound.get(round);
                if (attackMadeData) {
                    hasContent = true;
                    let modHTML = '';
                    const modName = await getModName(attackMadeData.modId);
                    modHTML += `<div class="game-header" style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; color: #E67E22;">Mod: ${modName} | Ataque | Ronda ${attackMadeData.ronda}</div>`;
                    for (const key in attackMadeData.selecoes) {
                        const selection = attackMadeData.selecoes[key];
                        const jogoId = selection.jogoId;
                        const targetUserName = await getUserTableName(selection.copiedFromUserId);
                        const gameName = await getGameName(jogoId);
                        let pointsContent = '';
                        if (selection.hasOwnProperty('pontosGanhosJogador')) {
                            const points = selection.pontosGanhosJogador;
                            const pointsClass = points > 0 ? 'prediction-points' : 'prediction-points-negative';
                            pointsContent = `<span class="${pointsClass}">(${points} pts)</span>`;
                        } else { pointsContent = `<span class="in-analysis"><em>(em análise)</em></span>`; }
                        modHTML += `<div class="prediction-item">→ Atacou: ${targetUserName} | ${gameName} | ${selection.palpiteSelecionado} ${pointsContent}</div>`;
                    }
                    roundContentHTML += modHTML;
                }
                const attacksReceivedData = attacksReceivedByRound.get(round);
                if (attacksReceivedData) {
                    hasContent = true;
                    let modHTML = '';
                    const firstAttack = attacksReceivedData[0];
                    const modName = await getModName(firstAttack.modId);
                    modHTML += `<div class="game-header" style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; color: #E67E22;">Mod: ${modName} | Defesa | Ronda ${firstAttack.ronda}</div>`;
                    for (const attack of attacksReceivedData) {
                        const attackerName = await getUserTableName(attack.attackerUserId);
                        const gameName = await getGameName(attack.gameId);
                        let pointsContent = '';
                        if (attack.selection.hasOwnProperty('pontosGanhosJogadorAlvo')) {
                            const points = attack.selection.pontosGanhosJogadorAlvo;
                            const pointsClass = points > 0 ? 'prediction-points' : 'prediction-points-negative';
                            pointsContent = `<span class="${pointsClass}">(${points} pts)</span>`;
                        } else { pointsContent = `<span class="in-analysis"><em>(em análise)</em></span>`; }
                        modHTML += `<div class="prediction-item">→ Alvo de: ${attackerName} | ${gameName} | ${attack.selection.palpiteSelecionado} ${pointsContent}</div>`;
                    }
                    roundContentHTML += modHTML;
                }
                if (hasContent) {
                    const roundInfoText = roundStats[round] ? roundStats[round].text : '';
                    predictionsHTML += `<div class="round-section"><div class="round-header" data-round="${round}"><div style="display: flex; align-items: baseline; gap: 8px;"><span>Ronda ${round}</span><span style="font-style: italic; font-size: 0.7em; font-weight: normal;">${roundInfoText}</span></div><span class="toggle-arrow ${isOpen ? 'open' : ''}">▶</span></div><div class="round-content ${isOpen ? 'open' : ''}">${roundContentHTML}</div></div>`;
                }
            }
        }
        if (!predictionsHTML) { predictionsHTML = 'Nenhuma previsão encontrada para esta seleção.'; }
        popupBody.innerHTML = predictionsHTML;
        document.querySelectorAll('.round-header').forEach(header => {
            header.removeEventListener('click', toggleRoundContent);
            header.addEventListener('click', toggleRoundContent);
        });
        roundFilter.onchange = () => {
            selectedRounds[userSeasonKey] = roundFilter.value;
            togglePredictions(userId, season);
        };
    } catch (error) {
        console.error("Error loading predictions:", error);
        popupBody.innerHTML = 'Erro ao carregar previsões.';
    }
}

async function checkForRankingUpdateAndShowAnimation() {
    // 1. Obter todos os palpites da época mais recente
    const palpitesRef = collection(db, 'palpites');
    const q = query(palpitesRef, where('temporada', '==', mostRecentSeason));
    const palpitesSnap = await getDocs(q);

    const roundsData = {};
    let highestRoundOverall = 0; // <-- Variável para guardar a ronda mais alta de todas

    palpitesSnap.forEach(doc => {
        const data = doc.data();
        const round = data.ronda;
        if (!round) return;

        const roundNum = parseInt(round);

        // Atualiza a ronda mais alta encontrada até agora
        if (roundNum > highestRoundOverall) {
            highestRoundOverall = roundNum;
        }

        // Agrupa os dados para verificar a conclusão
        if (!roundsData[round]) {
            roundsData[round] = { total: 0, analisado: 0 };
        }
        roundsData[round].total++;
        if (data.Analisado === 'Sim') {
            roundsData[round].analisado++;
        }
    });
    
    // 2. Encontrar a ronda mais alta que está 100% analisada
    let latestCompletedRound = 0;
    for (const round in roundsData) {
        if (roundsData[round].total > 0 && roundsData[round].total === roundsData[round].analisado) {
            const roundNum = parseInt(round);
            if (roundNum > latestCompletedRound) {
                latestCompletedRound = roundNum;
            }
        }
    }

    if (latestCompletedRound === 0) return; // Nenhuma ronda completa ainda

    // 3. Verificar no localStorage se o utilizador já viu esta atualização
    const lastSeenRound = parseInt(localStorage.getItem('lastSeenRoundAnimation')) || 0;
    
    // --- NOVA CONDIÇÃO CRÍTICA ---
    // A animação só é acionada se a última ronda completa for também a ronda mais
    // alta que existe no geral, e se for uma novidade para o utilizador.
    if (latestCompletedRound === highestRoundOverall && latestCompletedRound > lastSeenRound) {
        // Gatilho! Uma nova ronda foi concluída e é a mais recente.
        console.log(`Nova ronda concluída: ${latestCompletedRound}. É a ronda mais alta. A mostrar animação.`);
        
        await showRankingAnimation(mostRecentSeason, latestCompletedRound);
        
        // Atualizar o localStorage após mostrar a animação
        localStorage.setItem('lastSeenRoundAnimation', latestCompletedRound);
    } else {
        // Log para depuração, caso a animação não apareça
        console.log(`Animação não acionada. Motivo: latestCompletedRound (${latestCompletedRound}) !== highestRoundOverall (${highestRoundOverall}) ou já foi vista (lastSeenRound: ${lastSeenRound}).`);
    }
}

async function calculateAllUserPointsUpToRound(season, targetRound) {
    const userPoints = new Map();
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(query(usersRef, where("natabela", "==", "Yes"), where("aceite", "==", "Yes")));

    // Inicializa todos os jogadores com 0 pontos
    usersSnap.forEach(doc => {
        userPoints.set(doc.id, {
            userId: doc.id,
            username: doc.data().nometabela || 'Desconhecido',
            points: 0
        });
    });

    // Buscar todos os palpites e palpitesmods da época UMA SÓ VEZ para otimizar
    const palpitesRef = collection(db, 'palpites');
    const qPalpites = query(palpitesRef, where('temporada', '==', season), where('ronda', '<=', targetRound));
    const palpitesSnap = await getDocs(qPalpites);

    const modsRef = collection(db, 'palpitesmods');
    const qMods = query(modsRef, where('temporada', '==', season), where('ronda', '<=', targetRound));
    const modsSnap = await getDocs(qMods);

    // Processar palpites normais
    palpitesSnap.forEach(doc => {
        const data = doc.data();
        if (userPoints.has(data.userId) && data.Analisado === 'Sim') {
            let userTotal = userPoints.get(data.userId).points;
            for (let i = 1; i <= 10; i++) {
                userTotal += data[`Palpite${i}PontosGanhos`] || 0;
            }
            userPoints.get(data.userId).points = userTotal;
        }
    });

    // Processar palpites de mods
    modsSnap.forEach(doc => {
        const data = doc.data();
        // Pontos do atacante
        if (userPoints.has(data.userId)) {
            let userTotal = userPoints.get(data.userId).points;
            for (const key in data.selecoes) {
                userTotal += data.selecoes[key].pontosGanhosJogador || 0;
            }
            userPoints.get(data.userId).points = userTotal;
        }
        // Pontos do alvo
        for (const key in data.selecoes) {
            const targetId = data.selecoes[key].copiedFromUserId;
            if (userPoints.has(targetId)) {
                let targetTotal = userPoints.get(targetId).points;
                targetTotal += data.selecoes[key].pontosGanhosJogadorAlvo || 0;
                userPoints.get(targetId).points = targetTotal;
            }
        }
    });
    
    // Converter o Map para um array e ordenar
    const rankings = Array.from(userPoints.values()).sort((a, b) => b.points - a.points);
    return rankings;
}

async function showRankingAnimation(season, completedRound) {
    const roundAnterior = completedRound - 1;

    // 1. Calcular os dois rankings
    const rankingsAnteriores = roundAnterior > 0 ? await calculateAllUserPointsUpToRound(season, roundAnterior) : [];
    const rankingsAtuais = await calculateAllUserPointsUpToRound(season, completedRound);

    const posicoesAnteriores = new Map();
    rankingsAnteriores.forEach((user, index) => {
        posicoesAnteriores.set(user.userId, index + 1);
    });

    const popupList = document.getElementById('ranking-changes-list');
    popupList.innerHTML = ''; // Limpar lista anterior

    document.getElementById('animation-popup-title').textContent = `Movimentações da Ronda ${completedRound}`;

    // 2. Construir o HTML para cada jogador
    rankingsAtuais.forEach((user, index) => {
        const posAtual = index + 1;
        const posAnterior = posicoesAnteriores.get(user.userId);
        
        let changeIcon = '●';
        let changeClass = 'stable';
        let changeText = `manteve a posição`;
        
        if (posAnterior) { // Jogador já existia no ranking anterior
            const mudanca = posAnterior - posAtual;
            if (mudanca > 0) {
                changeIcon = `▲ +${mudanca}`;
                changeClass = 'up';
                changeText = `subiu da ${posAnterior}ª`;
            } else if (mudanca < 0) {
                changeIcon = `▼ ${mudanca}`;
                changeClass = 'down';
                changeText = `desceu da ${posAnterior}ª`;
            }
        } else { // Jogador novo no ranking
            changeIcon = '★';
            changeClass = 'up';
            changeText = 'entrou no ranking';
        }

        const listItem = document.createElement('li');
        listItem.style.animationDelay = `${index * 0.1}s`;

        listItem.innerHTML = `
            <span class="rank-change ${changeClass}">${changeIcon}</span>
            <span class="player-name-animation">${posAtual}º ${user.username}</span>
            <span class="rank-details">(${changeText})</span>
        `;
        popupList.appendChild(listItem);
    });

    // 3. Mostrar o popup
    const popup = document.getElementById('ranking-animation-popup');
    popup.style.display = 'block';
}

function toggleRoundContent() {
    const content = this.nextElementSibling;
    const arrow = this.querySelector('.toggle-arrow');
    if (content && arrow) {
        content.classList.toggle('open');
        arrow.classList.toggle('open');
    }
}

// Event Listeners dos Popups
const popup = document.getElementById('predictions-popup');
const closeButton = document.getElementById('close-popup');
closeButton.addEventListener('click', () => {
    popup.style.display = "none";
});
window.addEventListener('click', (event) => {
    if (event.target == popup) {
        popup.style.display = "none";
    }
});

// --- NOVO EVENT LISTENER PARA O POPUP DE ANIMAÇÃO ---
const animationPopup = document.getElementById('ranking-animation-popup');
const closeAnimationButton = document.getElementById('close-animation-popup');
closeAnimationButton.addEventListener('click', () => {
    animationPopup.style.display = "none";
    if (pendingGiftOfferCount > 0) {
        showAlfredoGiftPopup();
    }
});
window.addEventListener('click', (event) => {
    if (event.target == animationPopup) {
        animationPopup.style.display = "none";
        if (pendingGiftOfferCount > 0) {
            showAlfredoGiftPopup();
        }
    }
});

const closeAlfredoPackPopupButton = document.getElementById('close-alfredo-pack-popup');
closeAlfredoPackPopupButton?.addEventListener('click', hideAlfredoGiftPopup);
openAlfredoPackButton?.addEventListener('click', async () => {
    hideAlfredoGiftPopup();
    await logUserAction(`Seguiu para a caderneta para abrir ${pendingGiftOfferCount} saqueta(s) do Sr Alfredo`);
    window.location.href = `caderneta.html?${CADERNETA_GIFT_REDIRECT_PARAM}=1`;
});
window.addEventListener('click', (event) => {
    if (event.target == alfredoPackPopup) {
        hideAlfredoGiftPopup();
    }
});

/* ---- NOVO E CORRIGIDO: Listener Global para Cliques ---- */
document.addEventListener('click', async (event) => {
    // Selector para todos os elementos interativos da página
    const clickableElement = event.target.closest('.info-icon, .round-header, .close-button, a.menu-item');

    if (!clickableElement) return;

    let actionName = '';

    if (clickableElement.matches('.info-icon')) {
        const userId = clickableElement.dataset.userid;
        // Precisamos buscar o nome do utilizador para um log mais claro
        const userName = await getUserTableName(userId);
        actionName = `Visualizou os palpites de: ${userName || 'utilizador desconhecido'}`;
    }
    else if (clickableElement.matches('.round-header')) {
        const roundNumber = clickableElement.dataset.round;
        actionName = `Filtrou os palpites para a Ronda ${roundNumber}`;
    }
    else if (clickableElement.matches('.close-button')) {
        const popup = clickableElement.closest('.predictions-popup');
        let popupName = 'um popup';
        if (popup.id === 'ranking-animation-popup') popupName = 'o popup de movimentações';
        if (popup.id === 'predictions-popup') popupName = 'o popup de palpites';
        actionName = `Fechou ${popupName}`;
    }
    else if (clickableElement.matches('a.menu-item')) {
        actionName = `Navegou para: ${clickableElement.querySelector('.menu-text')?.textContent.trim() || 'Menu'}`;
    }
    
    if (!actionName) return;

    // Lida com a navegação para outras páginas (menu inferior)
    const isNavLink = clickableElement.tagName === 'A' && clickableElement.href && clickableElement.target !== '_blank';
    
    if (isNavLink) {
        event.preventDefault();
        await logUserAction(actionName);
        window.location.href = clickableElement.href;
    } else {
        // Para todos os outros cliques
        await logUserAction(actionName);
    }
});

// --- FUNÇÃO PARA CARREGAR OS DESTAQUES DA ÚLTIMA RONDA ---
async function loadRoundHighlights(season) {
    const highlightsContainer = document.getElementById('highlights-container');
    if (!highlightsContainer) return;
    highlightsContainer.innerHTML = '<div style="color: #8892b0; font-size: 0.9rem; text-align: center; width: 100%;">A carregar destaques da ronda...</div>';

    try {
        const usersRef = collection(db, 'users');
        const usersSnap = await getDocs(usersRef);
        const userNames = {};
        usersSnap.forEach(doc => {
            userNames[doc.id] = doc.data().nometabela || doc.data().username || 'Desconhecido';
        });

        const palpitesRef = collection(db, 'palpites');
        const q = query(palpitesRef, where('temporada', '==', season));
        const querySnapshot = await getDocs(q);

        const roundsData = {};
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const round = data.ronda;
            if (!round) return;
            if (!roundsData[round]) {
                roundsData[round] = [];
            }
            roundsData[round].push(data);
        });

        const rounds = Object.keys(roundsData).map(r => parseInt(r));
        if (rounds.length === 0) {
            highlightsContainer.innerHTML = '';
            return;
        }

        // Encontra a ronda mais alta analisada, ou a maior ronda existente
        let targetRound = Math.max(...rounds);
        const analyzedRounds = rounds.filter(r => roundsData[r].some(p => p.Analisado === 'Sim'));
        if (analyzedRounds.length > 0) {
            targetRound = Math.max(...analyzedRounds);
        }

        const roundPredictions = roundsData[targetRound] || [];
        
        const getCategoryIcon = (catName) => {
            const lower = catName.toLowerCase();
            
            // 1. Resultado
            if (lower === 'resultado') return '<i class="fa-solid fa-list-ol"></i>';
            // 2. Resultado Exato
            if (lower.includes('resultado exato')) return '<i class="fa-solid fa-thumbtack"></i>';
            // 3. Resultado Handicap
            if (lower.includes('handicap')) return '<i class="fa-solid fa-scale-balanced"></i>';
            // 4. Por Parte
            if (lower.includes('por parte')) return '<i class="fa-solid fa-scissors"></i>';
            // 5. Tempo
            if (lower.includes('tempo')) return '<i class="fa-solid fa-stopwatch"></i>';
            // 6. Golos
            if (lower.includes('golo')) return '<i class="fa-solid fa-futbol"></i>';
            // 7. Cantos
            if (lower.includes('canto')) return '<i class="fa-solid fa-flag"></i>';
            // 8. Remates à Baliza (net SVG)
            if (lower.includes('baliza')) return `<svg viewBox="0 0 24 24" width="15" height="15" style="display: inline-block; vertical-align: middle; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-top: -2px;">
                <path d="M3,18V7h18v11" />
                <path d="M3,7l3-3h12l3,3" />
                <path d="M6,4v14" style="stroke-dasharray: 0; stroke-width: 1.2; opacity: 0.7;" />
                <path d="M18,4v14" style="stroke-dasharray: 0; stroke-width: 1.2; opacity: 0.7;" />
                <path d="M6,18h12" />
                <path d="M3,11h18 M3,15h18" style="stroke-width: 0.8; opacity: 0.4;" />
                <path d="M9,7v11 M15,7v11" style="stroke-width: 0.8; opacity: 0.4;" />
            </svg>`;
            // 9. Remates Totais
            if (lower.includes('remate')) return '<i class="fa-solid fa-bullseye"></i>';
            // 10. Cartões Amarelos
            if (lower.includes('cart')) return '<i class="fa-solid fa-square" style="font-size: 0.9em; transform: rotate(10deg); display: inline-block;"></i>';
            // 11. Faltas
            if (lower.includes('falta')) return '<i class="fa-solid fa-burst"></i>';
            // 12. Foras de Jogo
            if (lower.includes('fora')) return '<i class="fa-solid fa-flag-checkered"></i>';
            // 13. Mercados Combinados
            if (lower.includes('combinado')) return '<i class="fa-solid fa-clover"></i>';
            // 14. Mercados Especiais
            if (lower.includes('especial')) return '<i class="fa-solid fa-puzzle-piece"></i>';
            // 15. Específicos por Equipa / Defesas
            if (lower.includes('defesa') || lower.includes('equipa')) return '<i class="fa-solid fa-shield-halved"></i>';
            
            return '<i class="fa-solid fa-star"></i>';
        };

        const categoryTotals = {}; // categoria -> total de acertos
        const categoryUserStats = {}; // categoria -> { userId -> acertos }

        roundPredictions.forEach(prediction => {
            const userId = prediction.userId;
            if (!userId) return;

            for (let i = 1; i <= 10; i++) {
                const palpiteText = prediction[`palpite${i}`];
                const pontos = prediction[`Palpite${i}PontosGanhos`] || 0;
                if (palpiteText && prediction.Analisado === 'Sim' && pontos > 0) {
                    // Extrai a categoria principal (ex: "Golos" ou "Cantos") antes do traço
                    const parts = palpiteText.split(' - ');
                    const category = parts[0] ? parts[0].trim() : 'Outros';

                    categoryTotals[category] = (categoryTotals[category] || 0) + 1;

                    if (!categoryUserStats[category]) {
                        categoryUserStats[category] = {};
                    }
                    categoryUserStats[category][userId] = (categoryUserStats[category][userId] || 0) + 1;
                }
            }
        });

        // Procurar defesas de mods ativas na ronda
        const modsRef = collection(db, 'palpitesmods');
        const qMods = query(modsRef, where('temporada', '==', season), where('ronda', '==', String(targetRound)));
        const modsSnap = await getDocs(qMods);
        
        modsSnap.forEach(doc => {
            const data = doc.data();
            for (const key in data.selecoes) {
                const targetId = data.selecoes[key].copiedFromUserId;
                const targetPoints = data.selecoes[key].pontosGanhosJogadorAlvo || 0;
                if (targetId && targetPoints > 0) {
                    const category = 'Defesas';
                    categoryTotals[category] = (categoryTotals[category] || 0) + 1;
                    if (!categoryUserStats[category]) {
                        categoryUserStats[category] = {};
                    }
                    categoryUserStats[category][targetId] = (categoryUserStats[category][targetId] || 0) + 1;
                }
            }
        });

        // Ordenar as categorias pelo total de acertos na ronda
        const sortedCategories = Object.keys(categoryTotals)
            .filter(cat => categoryTotals[cat] > 0)
            .sort((a, b) => categoryTotals[b] - categoryTotals[a]);

        // Pegar no máximo 5 categorias reais
        const topCategories = sortedCategories.slice(0, 5);

        if (topCategories.length === 0) {
            highlightsContainer.innerHTML = '<div style="color: #8892b0; font-size: 0.85rem; text-align: center; width: 100%;">Sem registos ou palpites analisados nesta ronda.</div>';
            return;
        }

        const cardsHTML = topCategories.map(category => {
            const userCounts = categoryUserStats[category];
            let winnerId = null;
            let maxCount = 0;
            for (const userId in userCounts) {
                if (userCounts[userId] > maxCount) {
                    maxCount = userCounts[userId];
                    winnerId = userId;
                }
            }
            const winnerName = winnerId ? userNames[winnerId] : 'Sem registo';
            const icon = getCategoryIcon(category);

            return `
                <div class="highlight-card">
                    <div class="card-title">Ronda ${targetRound} - ${category} ${icon}</div>
                    <div class="card-user" title="${winnerName}">${winnerName}</div>
                </div>
            `;
        }).join('');

        highlightsContainer.innerHTML = cardsHTML;
    } catch (error) {
        console.error("Erro ao carregar destaques da ronda:", error);
        highlightsContainer.innerHTML = '';
    }
}
