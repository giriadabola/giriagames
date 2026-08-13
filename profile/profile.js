import { app, db, auth } from "../core/firebase.js";
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import { doc, getDoc, collection, getDocs, query, orderBy, limit, where, updateDoc, addDoc, serverTimestamp, onSnapshot, writeBatch, increment } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { buildUserPredictionStats, renderUserStats } from "./profile-stats.js";
import { initProfileNotifications } from "./profile-notifications.js";
import { compactSeason, getLatestSeason, getSeasonData, mergeUserSeasonData } from "../core/user-season.js";
import { checkPageContentAccess } from "../js/page-content-guard.js";

const functions = getFunctions(app, 'us-central1');

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

// Get DOM elements
const returnDisplay = document.getElementById('returnDisplay');
const returnPlayersPopup = document.getElementById('returnPlayersPopup');
const returnPlayersList = document.getElementById('returnPlayersList');
const closeReturnPopupIcon = document.getElementById('closeReturnPopupIcon');
const profileUsernameSpan = document.getElementById('profileUsername');
const loadingScreen = document.getElementById('loading-screen');
const content = document.querySelector('.content');
const gcoinsDisplay = document.getElementById('gcoinsDisplay');
const gcoinsPopup = document.getElementById('gcoinsPopup');
const closeGcoinsPopupButton = document.getElementById('closeGcoinsPopupIcon');
const gcoinsTransactionsList = document.getElementById('gcoinsTransactions');
const debtDisplay = document.querySelector('.debt-display');
const myTeamSection = document.getElementById('myTeamSection');
const minigamesDisplay = document.querySelector('.minigames-display');
const statsDisplay = document.getElementById('statsDisplay');
const userStatsSection = document.getElementById('userStatsSection');
const userStatsGrid = document.getElementById('userStatsGrid');
const userStatsSeasonLabel = document.getElementById('userStatsSeasonLabel');
const predictionsSection = document.getElementById('predictionsSection');
const gcoinsChangePopup = document.getElementById('gcoinsChangePopup');
const gcoinsChangeMessage = document.getElementById('gcoinsChangeMessage');
const closeGcoinsChangePopupBtn = document.getElementById('closeGcoinsChangePopupBtn');
const miniGamesSection = document.getElementById('miniGamesSection');
const jornadaEuroDisplay = document.getElementById('sec-jornada');
const quemGanhaDisplay = document.getElementById('sec-quemganha');
const mythsDisplay = document.getElementById('sec-myths');
const logoutBtn = document.getElementById('logoutBtn');
const trophiesDisplay = document.getElementById('trophiesDisplay');
const bancaValue = document.getElementById('bancaValue');
const bancaDisplay = document.getElementById('bancaDisplay');

// Bottom Menu Items
const debtValueElement = document.getElementById('debtValue');

// Testing Simulator Elements
const testMockBtn = document.getElementById('testMockBtn');
const testMockContainer = document.getElementById('testMockContainer');
const testMockSelect = document.getElementById('testMockSelect');

function placeStatsSectionBelowTeam() {
    if (!myTeamSection || !userStatsSection || myTeamSection.nextElementSibling === userStatsSection) {
        return;
    }

    myTeamSection.insertAdjacentElement('afterend', userStatsSection);
}

placeStatsSectionBelowTeam();
statsDisplay?.remove();


// Map values for predictions categorization
const group1Cats = ["Resultado", "Resultado Exato", "Resultado Handicap", "Por Parte", "Tempo"];
const group2Cats = ["Golos", "Cantos", "Remates à Baliza", "Remates Totais"];
const group3Cats = ["Cartões Amarelos", "Faltas", "Foras de Jogo", "Mercados Combinados", "Mercados Especiais"];
const group4Cats = ["Específicos por Equipa", "Jogadores"];

let userPredictionsList = [];
let clubsLogoMap = {};

function getGroupForPrediction(text) {
    if (!text) return null;
    const cleanText = text.trim();
    for (const cat of group1Cats) {
        if (cleanText.startsWith(cat)) return 1;
    }
    for (const cat of group2Cats) {
        if (cleanText.startsWith(cat)) return 2;
    }
    for (const cat of group3Cats) {
        if (cleanText.startsWith(cat)) return 3;
    }
    for (const cat of group4Cats) {
        if (cleanText.startsWith(cat)) return 4;
    }
    return null;
}

function getPredictionIcon(text) {
    if (!text) return 'fa-question';
    const cleanText = text.trim();
    if (cleanText.startsWith('Resultado Exato')) return 'fa-bullhorn';
    if (cleanText.startsWith('Resultado Handicap')) return 'fa-balance-scale';
    if (cleanText.startsWith('Resultado')) return 'fa-poll';
    if (cleanText.startsWith('Por Parte')) return 'fa-hourglass-half';
    if (cleanText.startsWith('Tempo')) return 'fa-clock';
    if (cleanText.startsWith('Golos')) return 'fa-futbol';
    if (cleanText.startsWith('Cantos')) return 'fa-flag';
    if (cleanText.startsWith('Remates à Baliza')) return 'fa-crosshairs';
    if (cleanText.startsWith('Remates Totais')) return 'fa-shoe-prints';
    if (cleanText.startsWith('Cartões Amarelos')) return 'fa-square';
    if (cleanText.startsWith('Faltas')) return 'fa-hand-paper';
    if (cleanText.startsWith('Foras de Jogo')) return 'fa-running';
    if (cleanText.startsWith('Mercados Combinados')) return 'fa-compress-arrows-alt';
    if (cleanText.startsWith('Mercados Especiais')) return 'fa-magic';
    if (cleanText.startsWith('Específicos por Equipa')) return 'fa-shield-alt';
    if (cleanText.startsWith('Jogadores')) return 'fa-user-ninja';
    return 'fa-question';
}

// Variables for listener and state
let unsubscribePanelListener = null;
let initialPanelSettings = null;
let isInitialPanelLoad = true;
let previousMythsValue = null;
let totalUserDebt = 0;
let currentUserGCoins = 0;
let userDebtDocuments = [];

// Function to update mini-games visibility based on panel settings
async function updateMiniGamesVisibility(panelSettings) {
    const mythsDisplay = miniGamesSection.querySelector('.myths-display');
    const currentMythsValue = panelSettings?.myths;
    mythsDisplay.style.display = currentMythsValue === 'off' ? 'none' : 'flex';

    if (previousMythsValue !== null && previousMythsValue !== currentMythsValue) {
        location.reload();
    }
    previousMythsValue = currentMythsValue;
}

async function loadDynamicMiniGames(userData) {
    const grid = document.querySelector('.minigames-grid');
    if (!grid) return;
    grid.innerHTML = '';

    try {
        const mgDocRef = doc(db, 'settings', 'mini-ggames');
        const mgSnap = await getDoc(mgDocRef);
        
        if (mgSnap.exists()) {
            const data = mgSnap.data();
            const gamesArray = Object.entries(data).map(([key, val]) => ({ key, ...val }));
            gamesArray.sort((a, b) => {
                const orderA = a.ordem !== undefined ? parseInt(a.ordem, 10) : 999;
                const orderB = b.ordem !== undefined ? parseInt(b.ordem, 10) : 999;
                return orderA - orderB;
            });

            const gradients = [
                ['rgba(74, 20, 140, 0.85)', 'rgba(49, 27, 146, 0.85)'],      // Purple
                ['rgba(19, 78, 74, 0.85)', 'rgba(6, 95, 70, 0.85)'],          // Teal
                ['rgba(15, 76, 129, 0.85)', 'rgba(3, 105, 161, 0.85)'],       // Ocean Blue
                ['rgba(128, 0, 32, 0.85)', 'rgba(153, 27, 27, 0.85)'],        // Maroon
                ['rgba(194, 65, 12, 0.85)', 'rgba(154, 52, 18, 0.85)'],       // Orange
                ['rgba(139, 69, 19, 0.85)', 'rgba(101, 67, 33, 0.85)'],       // Bronze
                ['rgba(30, 41, 59, 0.85)', 'rgba(15, 23, 42, 0.85)'],         // Charcoal
                ['rgba(134, 25, 143, 0.85)', 'rgba(107, 33, 168, 0.85)'],     // Violet
                ['rgba(180, 83, 9, 0.85)', 'rgba(146, 64, 14, 0.85)'],        // Amber
                ['rgba(20, 83, 45, 0.85)', 'rgba(21, 128, 61, 0.85)']         // Green
            ];

            let gameIndex = 0;
            for (const game of gamesArray) {
                const isUserAllowed = userData && userData.minigames && userData.minigames[game.key] === 'on';
                if (game.status && isUserAllowed) {
                    let existingEl = document.getElementById(`sec-dynamic-${game.key}`);
                    if (!existingEl) {
                        const gameDiv = document.createElement('div');
                        gameDiv.id = `sec-dynamic-${game.key}`;
                        gameDiv.className = 'mini-game-display';
                        
                        const gradient = gradients[gameIndex % gradients.length];
                        
                        if (game.imagemUrl) {
                            gameDiv.style.background = `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]}), url('${game.imagemUrl}') center/cover no-repeat`;
                        } else {
                            gameDiv.style.background = `linear-gradient(135deg, ${gradient[0].replace('0.85', '1')}, ${gradient[1].replace('0.85', '1')})`;
                        }
                        
                        gameDiv.innerHTML = `
                            <h3>${game.nome}</h3>
                            <div class="display-icon"><i class="fas fa-gamepad"></i></div>
                        `;
                        
                        gameDiv.addEventListener('click', () => {
                            window.location.href = game.path || `${game.key}.html`;
                        });
                        
                        grid.appendChild(gameDiv);
                    }
                    gameIndex++;
                }
            }
        }
    } catch (error) {
        console.error("Erro ao carregar mini-games dinâmicos:", error);
    }
}

// Add click event listeners
if (returnDisplay) {
    returnDisplay.addEventListener('click', () => {
        loadReturnPlayers();
        returnPlayersPopup.style.display = 'flex';
    });
}
if (closeReturnPopupIcon) {
    closeReturnPopupIcon.addEventListener('click', () => {
        returnPlayersPopup.style.display = 'none';
    });
}
if (gcoinsDisplay) {
    gcoinsDisplay.addEventListener('click', () => {
        gcoinsPopup.style.display = 'flex';
        loadTransactions();
    });
}
if (closeGcoinsPopupButton) {
    closeGcoinsPopupButton.addEventListener('click', () => {
        gcoinsPopup.style.display = 'none';
    });
}
if (closeGcoinsChangePopupBtn) {
    closeGcoinsChangePopupBtn.addEventListener('click', () => {
        gcoinsChangePopup.style.display = 'none';
    });
}
if (minigamesDisplay) {
    minigamesDisplay.addEventListener('click', () => {
        if (miniGamesSection) {
            miniGamesSection.style.display = 'block';
            minigamesDisplay.style.display = 'none';
        }
    });
}
const closeMiniGamesSectionBtn = document.getElementById('closeMiniGamesSection');
if (closeMiniGamesSectionBtn) {
    closeMiniGamesSectionBtn.addEventListener('click', () => {
        if (miniGamesSection) miniGamesSection.style.display = 'none';
        if (minigamesDisplay) minigamesDisplay.style.display = 'flex';
    });
}
if (jornadaEuroDisplay) {
    jornadaEuroDisplay.addEventListener('click', () => {
        window.location.href = 'world26.html';
    });
}
if (quemGanhaDisplay) {
    quemGanhaDisplay.addEventListener('click', () => {
        window.location.href = 'whowins.html';
    });
}

// Lógica para o clique no card "Dívidas"
if (debtDisplay) {
    debtDisplay.addEventListener('click', () => {
        if (totalUserDebt > 0) {
            window.location.href = 'banca.html?action=paydebt';
        } else {
            alert("Você não tem dívidas pendentes.");
        }
    });
}

// Check Firebase panel settings for myths visibility
const checkMythsVisibility = async () => {
    if (!auth.currentUser) return;

    try {
        const painelDoc = await getDoc(doc(db, 'paineis', 'paineis perfil'));
        if (painelDoc.exists()) {
            const painelData = painelDoc.data();
            if (mythsDisplay) {
                mythsDisplay.style.display = painelData.myths === 'off' ? 'none' : 'block';
            }
        }
    } catch (error) {
        console.error('Error checking myths visibility:', error);
    }
};

checkMythsVisibility();

if (mythsDisplay) {
    mythsDisplay.addEventListener('click', () => {
        window.location.href = 'myths.html';
    });
}

// Logout button functionality
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (unsubscribePanelListener) {
            unsubscribePanelListener();
            unsubscribePanelListener = null;
        }
        try {
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Erro ao fazer logout.');
        }
    });
}

async function loadReturnPlayers() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const q = query(collection(db, 'jogadores'), where('compradopor', '==', user.uid));
        const querySnapshot = await getDocs(q);
        returnPlayersList.innerHTML = '';

        const positionOrder = ['Guarda-Redes', 'Defesa', 'Médio', 'Avançado'];
        const playersByPosition = {};
        positionOrder.forEach(pos => {
            playersByPosition[pos] = [];
        });

        const promises = querySnapshot.docs.map(async playerDoc => {
            const player = playerDoc.data();
            const paisRef = doc(db, 'paises', player.paisId);
            const paisDoc = await getDoc(paisRef);
            const paisData = paisDoc.exists() ? paisDoc.data() : null;
            return { playerDoc, player, paisData };
        });

        const players = await Promise.all(promises);

        players.forEach(({ playerDoc, player, paisData }) => {
            if (positionOrder.includes(player.posicao)) {
                playersByPosition[player.posicao].push({ playerDoc, player, paisData });
            }
        });

        let hasPlayers = false;
        positionOrder.forEach(position => {
            if (playersByPosition[position].length > 0) {
                hasPlayers = true;
                const header = document.createElement('h3');
                header.textContent = position;
                header.style.color = '#333';
                header.style.marginTop = '20px';
                header.style.marginBottom = '10px';
                header.style.fontSize = '18px';
                returnPlayersList.appendChild(header);

                playersByPosition[position].forEach(({ playerDoc, player, paisData }) => {
                    const playerCard = document.createElement('div');
                    playerCard.className = 'player-card';

                    let castaClassName = '';
                    const castaValue = player.casta;

                    if (castaValue === "Jogador Ouro") castaClassName = 'golden';
                    else if (castaValue === "Jogador Prata") castaClassName = 'silver';
                    else if (castaValue === "Jogador Bronze") castaClassName = 'bronze';
                    else if (castaValue === "Jogador Platina") castaClassName = 'platina';
                    
                    if (castaClassName) playerCard.classList.add(castaClassName);

                    playerCard.innerHTML = `
                        <img src="${player.imagem}" alt="${player.nome}" class="player-image">
                        ${paisData ? `<img src="${paisData.imagem}" alt="${paisData.nome}" class="country-flag">` : ''}
                        <div class="player-name">${player.nome}</div>
                        <div class="player-position">${player.posicao}</div>
                        <div class="player-price">
                            <i class="fas fa-coins"></i>
                            ${player.preco}
                        </div>
                        <button class="return-button" data-player-id="${playerDoc.id}" data-player-position="${player.posicao}">Devolver</button>
                    `;

                    const returnButton = playerCard.querySelector('.return-button');
                    returnButton.addEventListener('click', async () => {
                        const confirmPopup = document.createElement('div');
                        confirmPopup.className = 'popup-overlay';
                        confirmPopup.style.display = 'flex';
                        confirmPopup.innerHTML = `
                            <div class="popup-content">
                                <h2 style="font-size: 1.2rem;">Devolver para o Mercado? (não será reembolsado)</h2>
                                <div class="popup-buttons">
                                    <button class="popup-btn confirm-return" style="background-color: #4CAF50;">Sim</button>
                                    <button class="popup-btn cancel-return" style="background-color: #f44336;">Não</button>
                                </div>
                            </div>
                        `;
                        document.body.appendChild(confirmPopup);

                        const confirmButton = confirmPopup.querySelector('.confirm-return');
                        const cancelButton = confirmPopup.querySelector('.cancel-return');

                        cancelButton.addEventListener('click', () => {
                            confirmPopup.remove();
                        });

                        confirmButton.addEventListener('click', async () => {
                            try {
                                const seasonsQuery = query(collection(db, 'palpites'), orderBy('temporada', 'desc'), limit(1));
                                const seasonsSnapshot = await getDocs(seasonsQuery);
                                let latestSeason = seasonsSnapshot.docs[0]?.data()?.temporada || '';
                                latestSeason = latestSeason.replace('/', '');

                                await updateDoc(doc(db, 'jogadores', playerDoc.id), {
                                    compradopor: null
                                });

                                await addDoc(collection(db, 'movimentos'), {
                                    de: user.uid,
                                    estado: 'Devolvido',
                                    jogadorId: playerDoc.id,
                                    mediapontos: null,
                                    movimentoData: serverTimestamp(),
                                    posicao: player.posicao,
                                    preco: 0,
                                    temporada: latestSeason,
                                    userId: user.uid,
                                    tipo: 'Mercado'
                                });

                                const successMessage = document.createElement('div');
                                successMessage.className = 'success-message';
                                successMessage.textContent = 'Jogador Devolvido';
                                successMessage.style.position = 'fixed';
                                successMessage.style.top = '50%';
                                successMessage.style.left = '50%';
                                successMessage.style.transform = 'translate(-50%, -50%)';
                                successMessage.style.padding = '20px';
                                successMessage.style.backgroundColor = '#4CAF50';
                                successMessage.style.color = 'white';
                                successMessage.style.borderRadius = '5px';
                                document.body.appendChild(successMessage);

                                setTimeout(() => {
                                    confirmPopup.remove();
                                    successMessage.remove();
                                    location.reload();
                                }, 1500);

                            } catch (error) {
                                console.error('Error returning player:', error);
                                alert('Erro ao devolver jogador. Tente novamente.');
                                confirmPopup.remove();
                            }
                        });
                    });

                    returnPlayersList.appendChild(playerCard);
                });
            }
        });

        if (!hasPlayers) {
            const noPlayersMessage = document.createElement('p');
            noPlayersMessage.textContent = "Sem jogadores para devolver.";
            noPlayersMessage.style.textAlign = 'center';
            noPlayersMessage.style.color = '#777';
            noPlayersMessage.style.padding = '20px';
            returnPlayersList.appendChild(noPlayersMessage);
        }

    } catch (error) {
        console.error('Error loading return players:', error);
    }
}

async function loadBancaValue() {
    try {
        const bancaRef = doc(db, 'paineis', 'Banca');
        const bancaSnap = await getDoc(bancaRef);
        if (bancaSnap.exists() && bancaSnap.data().valor !== undefined) {
            const valor = bancaSnap.data().valor;
            bancaValue.textContent = valor.toFixed(0) + ' ₲₵'; 
        } else {
            bancaValue.textContent = "0 ₲₵";
        }
    } catch (error) { 
        console.error("Erro ao carregar o valor da banca:", error);
        bancaValue.textContent = "Erro";
    }
}

async function loadUserDebts() {
    const user = auth.currentUser;
    if (!user) return;

    const debtQuery = query(
        collection(db, 'movimentos'),
        where('userId', '==', user.uid),
        where('estado', '==', 'Por Pagar'),
        where('tipo', '==', 'Empréstimo')
    );

    try {
        const querySnapshot = await getDocs(debtQuery);
        let totalDebt = 0;
        userDebtDocuments = []; 

        querySnapshot.forEach(doc => {
            const debtData = doc.data();
            totalDebt += debtData.valorTotalAPagar || 0;
            userDebtDocuments.push({ id: doc.id, ...debtData }); 
        });

        totalUserDebt = totalDebt; 
        debtValueElement.textContent = totalDebt.toFixed(0) + ' ₲₵';

        userDebtDocuments.sort((a, b) => a.movimentoData.toMillis() - b.movimentoData.toMillis());

    } catch (error) {
        console.error("Erro ao carregar dívidas do utilizador:", error);
        debtValueElement.textContent = 'Erro';
    }
}

async function updateGCoinsDisplay() {
    const user = auth.currentUser;
    const gcoinsValue = document.getElementById('gcoinsValue');

    if (user) {
        try {
            const userRef = doc(db, 'users', user.uid);

            const [seasonLabel, userSnap] = await Promise.all([
                getLatestSeason(db),
                getDoc(userRef)
            ]);

            if (userSnap.exists()) {
                if (seasonLabel) {
                    const gcoins = getSeasonData(userSnap.data(), seasonLabel).GCoins || 0;
                    gcoinsValue.textContent = gcoins.toFixed(0);

                    return gcoins; 
                }
            }
            gcoinsValue.textContent = '0';
            return 0;

        } catch (error) {
            console.error("Erro ao atualizar o display de GCoins:", error);
            gcoinsValue.textContent = 'Erro';
            return 0; 
        }
    }
    return 0; 
}

async function loadTransactions() {
    gcoinsTransactionsList.innerHTML = '';

    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'transactions-loading-spinner';
    loadingSpinner.style.display = 'block';

    const loadingText = document.createElement('p');
    loadingText.textContent = 'A carregar transações...';
    loadingText.style.textAlign = 'center';
    loadingText.style.padding = '20px';
    loadingText.style.display = 'block';

    gcoinsTransactionsList.appendChild(loadingSpinner);
    gcoinsTransactionsList.appendChild(loadingText);

    const user = auth.currentUser;
    if (!user) {
        gcoinsTransactionsList.innerHTML = '<p style="text-align:center; padding: 20px;">Utilizador não autenticado.</p>';
        return;
    }

    try {
        const seasonsQuery = query(collection(db, 'palpites'), orderBy('temporada', 'desc'), limit(1));
        const seasonsSnapshot = await getDocs(seasonsQuery);
        let latestSeason = seasonsSnapshot.docs[0]?.data()?.temporada || '';
        latestSeason = latestSeason.replace('/', '');

        const movementsQuery = query(
            collection(db, 'movimentos'),
            where('userId', '==', user.uid),
            where('temporada', '==', latestSeason),
            where('estado', '!=', 'Dívida'),
            orderBy('movimentoData', 'desc')
        );
        const movementsSnapshot = await getDocs(movementsQuery);

        if (movementsSnapshot.empty) {
            gcoinsTransactionsList.innerHTML = '<p style="text-align:center; padding: 20px;">Sem transações registadas.</p>';
            return;
        }

        const transactionsHTML = document.createElement('ul');
        transactionsHTML.style.listStyleType = 'none';
        transactionsHTML.style.padding = '0';

        for (const docSnapshot of movementsSnapshot.docs) {
            const transaction = docSnapshot.data();
            if (transaction.estado === 'WhoWins Paid') {
                continue; 
            }
            const listItem = document.createElement('li');
            let itemName = '';
            if (transaction.managerTipo) {
                const itemManagerValue = transaction.itemManager || ''; 
                itemName = transaction.managerTipo + " " + itemManagerValue;
            } else if (transaction.nomeJogo) {
                itemName = transaction.nomeJogo;
            } else if (transaction.jogadorId) {
                try {
                    const playerDoc = await getDoc(doc(db, 'jogadores', transaction.jogadorId));
                    itemName = playerDoc.exists() ? playerDoc.data().nome : 'Jogador Indisponível';
                } catch (playerError) {
                    console.error('Error fetching player name:', playerError);
                    itemName = 'Erro ao carregar nome';
                }
            } else if (transaction.descricao) { 
                itemName = transaction.descricao; 
            } else {
                itemName = 'N/A';
            }

            const date = transaction.movimentoData ? transaction.movimentoData.toDate().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'Data Indisponível';
            let valorReal = transaction.valorreal !== undefined ? transaction.valorreal : 0;
            let valorRealColor = 'black';
            if (valorReal > 0) valorRealColor = 'green';
            else if (valorReal < 0) valorRealColor = 'red';

            listItem.innerHTML = `
                <p>${transaction.estado}</p>
                <p>${itemName}</p>
                <p><span style="color: ${valorRealColor}">${valorReal}</span></p>
                <p>${date}</p>
            `;
            transactionsHTML.appendChild(listItem);
        }

        gcoinsTransactionsList.innerHTML = '';
        gcoinsTransactionsList.appendChild(transactionsHTML);

    } catch (error) {
        console.error('Error loading transactions:', error);
        gcoinsTransactionsList.innerHTML = '<p style="text-align:center; padding: 20px;">Erro ao carregar transações. Tente novamente.</p>';
    }
}

async function getUserStatus(userId) {
    const userDoc = doc(db, 'users', userId);
    const docSnap = await getDoc(userDoc);
    if (docSnap.exists() && docSnap.data().aceite === "Yes") {
        return docSnap.data().estatuto;
    } else {
        return null;
    }
}

async function fetchPanelSettings() {
    try {
        const panelSettingsDocRef = doc(db, 'paineis', 'paineis perfil');
        const docSnap = await getDoc(panelSettingsDocRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching 'paineis perfil' settings:", error);
        return null;
    }
}

async function fetchMenuSettings() {
    try {
        const menuSettingsDocRef = doc(db, 'paineis', 'paineis menu');
        const docSnap = await getDoc(menuSettingsDocRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return { '1x': 'off', bank: 'off', manager: 'off', market: 'off', profile: 'off', rankings: 'off', team: 'off' };
        }
    } catch (error) {
        console.error("Error fetching menu settings:", error);
        return { '1x': 'off', bank: 'off', manager: 'off', market: 'off', profile: 'off', rankings: 'off', team: 'off', manual: 'off', trofeus: 'off' };
    }
}

onAuthStateChanged(auth, async (user) => {
    // Limpa qualquer listener anterior para evitar múltiplas execuções se o estado de auth mudar
    if (unsubscribePanelListener) {
        unsubscribePanelListener();
        unsubscribePanelListener = null;
        initialPanelSettings = null;
        isInitialPanelLoad = true;
    }

    // Se o utilizador estiver autenticado, prossiga
    if (user) {
        try {
            // Inicializa as notificações antes dos restantes carregamentos do perfil.
            // Assim, um erro noutra secção não impede o registo do dispositivo.
            await initProfileNotifications(user);

            // Inicia um listener em tempo real para as configurações do painel de perfil
            const panelDocRef = doc(db, 'paineis', 'paineis perfil');
            isInitialPanelLoad = true; // Flag para ignorar a primeira chamada do listener (que é o estado inicial)
            unsubscribePanelListener = onSnapshot(panelDocRef, (docSnap) => {
                if (isInitialPanelLoad) {
                    isInitialPanelLoad = false;
                    return; // Ignora a primeira execução
                }
                if (docSnap.exists()) {
                    const currentSettings = docSnap.data();
                    // Compara as configurações atuais com as iniciais para detetar mudanças
                    const fieldsToCheck = ['GCoin', 'dividas', 'devolver', 'myteam', 'minigames', 'world26', 'quemganha', 'myths', 'manual', 'trofeus', 'banca', 'estatisticas', 'palpites', 'inbox'];
                    let changed = false;
                    for (const field of fieldsToCheck) {
                        if (initialPanelSettings && currentSettings && currentSettings[field] !== initialPanelSettings[field]) {
                            changed = true;
                            break;
                        }
                    }
                    if (changed) {
                        location.reload(); // Recarrega a página se uma configuração relevante mudar
                    }
                }
            }, (error) => {
                console.error("Erro no listener 'paineis perfil':", error);
            });
            
            // Busca dados essenciais em paralelo para maior eficiência
            const userDocRef = doc(db, 'users', user.uid);
            const [userDocSnap, panelSettings, menuSettings] = await Promise.all([
                getDoc(userDocRef),
                fetchPanelSettings(),
                fetchMenuSettings()
            ]);

            // Validação de acesso: o utilizador existe, está aceite e tem permissão para ver a página?
            if (!userDocSnap.exists() || userDocSnap.data().aceite !== "Yes") {
                loadingScreen.style.display = 'none';
                window.location.href = 'index.html';
                return;
            }

            await logUserAction(`Entrou em ${document.title}`);
            const latestSeason = await getLatestSeason(db);
            const userData = mergeUserSeasonData(userDocSnap.data(), latestSeason);
            const userStatus = userData.estatuto || null;

            if (testMockBtn) {
                testMockBtn.style.display = userStatus === 'ruler' ? 'inline-block' : 'none';
            }

            if (menuSettings.profile !== 'on' && userStatus !== 'ruler') {
                loadingScreen.style.display = 'none';
                window.location.href = '404.html';
                return;
            }

            if (typeof updateMenuVisibility === 'function' && menuSettings) {
                updateMenuVisibility(menuSettings); // Controla APENAS o menu inferior
            }

            const hasContentAccess = await checkPageContentAccess('profile', userStatus, db);
            if (!hasContentAccess) {
                loadingScreen.style.display = 'none';
                return;
            }

            // Atualiza o campo de último acesso do utilizador
            try {
                await updateDoc(userDocRef, { ultimoacesso: serverTimestamp() });
            } catch (error) {
                console.error("Erro ao atualizar o campo ultimoacesso: ", error);
            }

            initialPanelSettings = panelSettings; // Guarda as configurações iniciais para o listener

            if (panelSettings) {
                // Este bloco agora controla TODOS os cards da PÁGINA DE PERFIL
                gcoinsDisplay.style.display = panelSettings.GCoin === 'on' ? 'flex' : 'none';
                debtDisplay.style.display = panelSettings.dividas === 'on' ? 'flex' : 'none';
                returnDisplay.style.display = panelSettings.devolver === 'on' ? 'flex' : 'none';
                if (myTeamSection) myTeamSection.style.display = panelSettings.myteam === 'on' ? 'block' : 'none';
                minigamesDisplay.style.display = panelSettings.minigames === 'on' ? 'flex' : 'none';
                if (userStatsSection) userStatsSection.style.display = panelSettings.estatisticas === 'on' ? 'block' : 'none';
                bancaDisplay.style.display = panelSettings.banca === 'on' ? 'flex' : 'none';
                if (predictionsSection) predictionsSection.style.display = panelSettings.palpites === 'on' ? 'block' : 'none';
                
                const topManualBtn = document.getElementById('top-manual-btn');
                if (topManualBtn) topManualBtn.style.display = panelSettings.manual === 'on' ? 'flex' : 'none';
                if (trophiesDisplay) trophiesDisplay.style.display = panelSettings.trofeus === 'on' ? 'flex' : 'none';
                
                // Sub-itens dentro do popup de minigames
                const miniGamesDisplayVisible = panelSettings.minigames === 'on';
                if (jornadaEuroDisplay) jornadaEuroDisplay.style.display = miniGamesDisplayVisible && panelSettings.world26 === 'on' ? 'block' : 'none';
                if (quemGanhaDisplay) quemGanhaDisplay.style.display = miniGamesDisplayVisible && panelSettings.quemganha === 'on' ? 'block' : 'none';
            }

            // --- LÓGICA FINANCEIRA PRINCIPAL ---
            currentUserGCoins = await updateGCoinsDisplay();
            await loadUserDebts();
            await loadBancaValue(); 
            // --- FIM DA LÓGICA FINANCEIRA ---

            // --- CARREGAR PALPITES DO UTILIZADOR ---
            initUserPredictions(user.uid);

            // --- CARREGAR EQUIPA DO UTILIZADOR ---
            initUserTeam(user.uid);

            // --- CARREGAR MINI-GAMES DINÂMICOS ---
            await loadDynamicMiniGames(userData);

            // --- CARREGAR CAIXA DE ENTRADA (PROPOSTAS) ---
            if (panelSettings && panelSettings.inbox === 'on') {
                await loadInbox(user.uid);
            } else {
                const inboxSection = document.getElementById('inboxSection');
                if (inboxSection) inboxSection.style.display = 'none';
            }

            // Preenche o nome de utilizador e mostra o conteúdo da página
            profileUsernameSpan.textContent = userData.nomeDeUsuario || "Username Not Found";
            loadingScreen.style.display = 'none';
            content.style.display = 'block';

        } catch (error) {
            console.error("Erro durante o processamento do estado de autenticação:", error);
            alert("Erro Perfil: " + error.message + "\nStack: " + error.stack);
            loadingScreen.style.display = 'none';
            window.location.href = '404.html';
        }

    } else {
        loadingScreen.style.display = 'none';
        window.location.href = 'index.html';
    }
});

async function updatePanelSetting(fieldName, isChecked) {
    const settingValue = isChecked ? 'on' : 'off';
    try {
        const panelSettingsDocRef = doc(db, 'paineis', 'paineis perfil');
        await updateDoc(panelSettingsDocRef, {
            [fieldName]: settingValue
        });
    } catch (error) {
        console.error("Error updating panel setting:", error);
        alert('Failed to update setting. Please try again.');
    }
}

document.addEventListener('click', async (event) => {
    // Selector adaptado para esta página: apanha botões, links e os cards clicáveis.
    const clickableElement = event.target.closest('button, a, [class*="-display"]');

    if (!clickableElement) {
        return; // Se não for um elemento de interesse, não faz nada
    }

    // Lógica melhorada para obter um nome de ação claro
    let actionName = '';
    const labelElement = clickableElement.querySelector('.display-label');
    
    if (clickableElement.id) {
        actionName = clickableElement.id; // Prioridade 1: ID do elemento
    } else if (labelElement) {
        actionName = labelElement.textContent.trim(); // Prioridade 2: Texto do label dentro do card
    } else {
        actionName = clickableElement.textContent.trim(); // Fallback: Texto completo do elemento
    }

    if (!actionName) {
        return; // Se não conseguirmos um nome, não faz nada
    }

    const isNavLink = clickableElement.tagName === 'A' && clickableElement.href && clickableElement.target !== '_blank';

    if (isNavLink) {
        // 1. Impede a navegação imediata
        event.preventDefault();
        
        // 2. Regista a ação e espera que termine
        await logUserAction(`Clicou em: ${actionName}`);
        
        // 3. Agora, navega para o destino
        window.location.href = clickableElement.href;
    } else {
        // Para botões, divs clicáveis ou links para outras abas, apenas regista a ação
        logUserAction(`Clicou em: ${actionName}`);
    }
});


// ==========================================
// SEÇÃO MEUS PALPITES (WIDGET COMPONENTE LOGIC)
// ==========================================

async function initUserPredictions(userId) {
    const predictionsGrid = document.getElementById('predictionsGrid');
    if (!predictionsGrid) return;
    
    try {
        // Obter logotipos dos clubes uma única vez
        const clubsSnapshot = await getDocs(collection(db, 'clubes'));
        clubsLogoMap = {};
        clubsSnapshot.forEach(docSnap => {
            clubsLogoMap[docSnap.id] = docSnap.data().imagem || '';
        });
        
        // Obter palpites do utilizador
        const palpiteQuery = query(collection(db, 'palpites'), where('userId', '==', userId));
        const querySnapshot = await getDocs(palpiteQuery);
        const predictionDocs = querySnapshot.docs.map(docSnap => docSnap.data());
        const predictionStats = buildUserPredictionStats(predictionDocs);

        if (userStatsSeasonLabel) {
            userStatsSeasonLabel.textContent = predictionStats.currentSeason || 'Sem temporada';
        }
        renderUserStats(userStatsGrid, predictionStats);
        
        userPredictionsList = [];
        
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const timestamp = data.dataPalpite ? data.dataPalpite.toDate() : new Date();
            
            // Ciclo de palpite1 a palpite10
            for (let i = 1; i <= 10; i++) {
                const text = data[`palpite${i}`];
                if (text) {
                    const status = data[`palpite${i}Status`] || 'neutro'; // 'acerto', 'falha', 'neutro'
                    const group = getGroupForPrediction(text);
                    
                    userPredictionsList.push({
                        id: docSnap.id + '_' + i,
                        text: text,
                        status: status,
                        group: group,
                        equipaCasa: data.equipaCasa || 'Casa',
                        equipaFora: data.equipaFora || 'Fora',
                        equipaCasaId: data.equipaCasaId || '',
                        equipaForaId: data.equipaForaId || '',
                        competicao: data.competicao || '',
                        timestamp: timestamp
                    });
                }
            }
        });
        
        // Ordenar por data mais recente
        userPredictionsList.sort((a, b) => b.timestamp - a.timestamp);
        
        // Renderizar a aba padrão (Grupo 1)
        renderActiveTabPredictions(1);
        
        // Configurar eventos nas abas
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const group = parseInt(btn.dataset.group);
                const tabLabel = btn.querySelector('span')?.textContent?.trim() || `Grupo ${group}`;
                logUserAction(`Mudou a aba de estatísticas no perfil para: ${tabLabel}`);
                renderActiveTabPredictions(group);
            });
        });
        
    } catch (error) {
        console.error("Erro ao carregar palpites:", error);
        predictionsGrid.innerHTML = `<div class="predictions-status-msg" style="color: #e74c3c;">Erro ao carregar os palpites.</div>`;
        if (userStatsGrid) {
            userStatsGrid.innerHTML = `<div class="predictions-status-msg" style="color: #e74c3c;">Erro ao carregar estatísticas.</div>`;
        }
    }
}

function renderActiveTabPredictions(groupNumber) {
    const predictionsGrid = document.getElementById('predictionsGrid');
    if (!predictionsGrid) return;
    
    const filtered = userPredictionsList.filter(p => p.group === groupNumber);
    
    if (filtered.length === 0) {
        predictionsGrid.innerHTML = `<div class="predictions-status-msg">Não tens palpites registados para esta categoria.</div>`;
        return;
    }
    
    // Obter as categorias deste grupo
    let catsInGroup = [];
    if (groupNumber === 1) catsInGroup = group1Cats;
    else if (groupNumber === 2) catsInGroup = group2Cats;
    else if (groupNumber === 3) catsInGroup = group3Cats;
    else if (groupNumber === 4) catsInGroup = group4Cats;
    
    // Agrupar palpites pelas categorias correspondentes
    const grouped = {};
    filtered.forEach(p => {
        const catMatch = catsInGroup.find(cat => p.text.trim().startsWith(cat)) || "Outros";
        if (!grouped[catMatch]) grouped[catMatch] = [];
        grouped[catMatch].push(p);
    });
    
    let html = '';
    
    // Iterar sobre as categorias para manter a ordem
    const allCategoriesToRender = [...catsInGroup, "Outros"];
    
    allCategoriesToRender.forEach(catName => {
        const list = grouped[catName];
        if (list && list.length > 0) {
            const catIcon = getPredictionIcon(catName);
            
            // Subcabeçalho da Categoria
            html += `
                <div class="prediction-cat-group-title">
                    <i class="fas ${catIcon}"></i> ${catName}
                </div>
                <div class="predictions-grid">
            `;
            
            list.forEach(p => {
                const homeLogo = clubsLogoMap[p.equipaCasaId] || 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhTl6Ljabwgx-VXdZz8FcAoygQprujSsCoXc32Y_iU0FjYVPu1B6MffWwp8gcCVuV8TWn39FRk9OIe1nc-esubVJYmdLsTptAoR9GyqNuw4R5MBaeaoWXTc3JaqH2YVNtEmfReQqohvQKvHiI0XwE5na2ty2B9Bt4oELxYv2BaZ7R3UmeylpiVEiIbiLnCB/s320/soccer-ball-png.webp';
                const awayLogo = clubsLogoMap[p.equipaForaId] || 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhTl6Ljabwgx-VXdZz8FcAoygQprujSsCoXc32Y_iU0FjYVPu1B6MffWwp8gcCVuV8TWn39FRk9OIe1nc-esubVJYmdLsTptAoR9GyqNuw4R5MBaeaoWXTc3JaqH2YVNtEmfReQqohvQKvHiI0XwE5na2ty2B9Bt4oELxYv2BaZ7R3UmeylpiVEiIbiLnCB/s320/soccer-ball-png.webp';
                
                // Separar título da categoria e o resto do texto
                const parts = p.text.split(' - ');
                const categoryTitle = parts[0] || 'Palpite';
                const description = parts.slice(1).join(' - ') || p.text;
                
                const iconClass = getPredictionIcon(p.text);
                
                html += `
                    <div class="prediction-item-card ${p.status}">
                        <div class="prediction-card-header">
                            <span class="competition-badge">${p.competicao}</span>
                            <span>${p.timestamp.toLocaleDateString('pt-PT')}</span>
                        </div>
                        
                        <div class="prediction-game-teams" style="justify-content: center; gap: 10px;">
                            <img src="${homeLogo}" alt="${p.equipaCasa}" class="team-logo-mini" title="${p.equipaCasa}">
                            <span class="vs-text-mini">VS</span>
                            <img src="${awayLogo}" alt="${p.equipaFora}" class="team-logo-mini" title="${p.equipaFora}">
                        </div>
                        
                        <div class="prediction-card-body">
                            <div class="prediction-cat-icon">
                                <i class="fas ${iconClass}"></i>
                            </div>
                            <div class="prediction-text-content">
                                <span class="prediction-text-title">${categoryTitle}</span>
                                <span class="prediction-text-desc" title="${description}">${description}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`; // Fecha .predictions-grid
        }
    });
    
    predictionsGrid.innerHTML = html;
}


// Setup Simulator behavior
if (testMockBtn && testMockContainer && testMockSelect) {
    let usersLoaded = false;
    
    testMockBtn.addEventListener('click', async () => {
        if (testMockContainer.style.display === 'none') {
            testMockContainer.style.display = 'inline-block';
            testMockBtn.style.transform = 'rotate(180deg)';
            
            if (!usersLoaded) {
                try {
                    const usersQuery = query(collection(db, 'users'), where('aceite', '==', 'Yes'));
                    const usersSnapshot = await getDocs(usersQuery);
                    
                    testMockSelect.innerHTML = '<option value="">-- Escolhe um GPlayer --</option>';
                    const usersList = [];
                    usersSnapshot.forEach(docSnap => {
                        const uData = docSnap.data();
                        usersList.push({
                            id: docSnap.id,
                            nome: uData.nomeDeUsuario || uData.nometabela || 'Utilizador sem nome'
                        });
                    });
                    
                    // Sort alphabetically
                    usersList.sort((a, b) => a.nome.localeCompare(b.nome));
                    
                    usersList.forEach(u => {
                        const opt = document.createElement('option');
                        opt.value = u.id;
                        opt.textContent = u.nome;
                        testMockSelect.appendChild(opt);
                    });
                    
                    usersLoaded = true;
                } catch (error) {
                    console.error("Erro ao carregar utilizadores para simulação:", error);
                }
            }
        } else {
            testMockContainer.style.display = 'none';
            testMockBtn.style.transform = 'none';
        }
    });
    
    testMockSelect.addEventListener('change', async () => {
        const selectedId = testMockSelect.value;
        if (selectedId) {
            const selectedText = testMockSelect.options[testMockSelect.selectedIndex].text;
            profileUsernameSpan.textContent = selectedText + " (Simulado)";
            
            // Carregar dados do usuário simulado para atualizar permissões de mini-games
            try {
                const simUserSnap = await getDoc(doc(db, 'users', selectedId));
                if (simUserSnap.exists()) {
                    const latestSeason = await getLatestSeason(db);
                    await loadDynamicMiniGames(mergeUserSeasonData(simUserSnap.data(), latestSeason));
                }
            } catch (err) {
                console.error("Erro ao carregar mini-games para utilizador simulado:", err);
            }
            
            // Reload predictions and inbox for selected simulated user
            initUserPredictions(selectedId);
            initUserTeam(selectedId);
            loadInbox(selectedId);
        }
    });
}


async function initUserTeam(userId) {
    const myTeamGrid = document.getElementById('myTeamGrid');
    if (!myTeamGrid) return;
    
    try {
        // Obter todos os países uma única vez
        const countriesSnapshot = await getDocs(collection(db, 'paises'));
        const countriesMap = {};
        countriesSnapshot.forEach(docSnap => {
            countriesMap[docSnap.id] = docSnap.data();
        });
        
        // Obter jogadores comprados pelo utilizador
        const q = query(collection(db, 'jogadores'), where('compradopor', '==', userId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            myTeamGrid.innerHTML = `<div class="my-team-status-msg">Sem jogadores na tua equipa.</div>`;
            return;
        }
        
        let html = '';
        querySnapshot.forEach(docSnap => {
            const player = docSnap.data();
            const country = countriesMap[player.paisId] || { nome: 'N/A', imagem: '' };
            
            // Mapeamento da classe de casta
            let castaClass = 'casta-bronze';
            if (player.casta === 'Jogador Ouro') castaClass = 'casta-golden';
            else if (player.casta === 'Jogador Prata') castaClass = 'casta-silver';
            else if (player.casta === 'Jogador Platina') castaClass = 'casta-platina';
            
            // Cor do badge de overall
            const rating = parseFloat(player.overall) || 0;
            let ratingClass = 'low';
            if (rating >= 8.5) ratingClass = 'high';
            else if (rating >= 7.0) ratingClass = 'good';
            else if (rating >= 5.0) ratingClass = 'average';
            
            const playerImg = player.imagem || 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhTl6Ljabwgx-VXdZz8FcAoygQprujSsCoXc32Y_iU0FjYVPu1B6MffWwp8gcCVuV8TWn39FRk9OIe1nc-esubVJYmdLsTptAoR9GyqNuw4R5MBaeaoWXTc3JaqH2YVNtEmfReQqohvQKvHiI0XwE5na2ty2B9Bt4oELxYv2BaZ7R3UmeylpiVEiIbiLnCB/s320/soccer-ball-png.webp';
            const flagImg = country.imagem || 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhTl6Ljabwgx-VXdZz8FcAoygQprujSsCoXc32Y_iU0FjYVPu1B6MffWwp8gcCVuV8TWn39FRk9OIe1nc-esubVJYmdLsTptAoR9GyqNuw4R5MBaeaoWXTc3JaqH2YVNtEmfReQqohvQKvHiI0XwE5na2ty2B9Bt4oELxYv2BaZ7R3UmeylpiVEiIbiLnCB/s320/soccer-ball-png.webp';
            
            html += `
                <div class="player-card-fut ${castaClass}">
                    <div class="player-card-fut-top">
                        <div class="player-card-fut-overall ${ratingClass}">${player.overall || 'N/A'}</div>
                        <img src="${flagImg}" alt="${country.nome}" class="player-card-fut-flag" title="${country.nome}">
                    </div>
                    
                    <div class="player-card-fut-mid">
                        <img src="${playerImg}" alt="${player.nome}" class="player-card-fut-img">
                    </div>
                    
                    <div class="player-card-fut-bottom">
                        <span class="player-card-fut-name" title="${player.nome}">${player.nome}</span>
                        <span class="player-card-fut-country">${player.posicao || 'Posição N/A'}</span>
                    </div>
                </div>
            `;
        });
        
        myTeamGrid.innerHTML = html;
        
    } catch (error) {
        console.error("Erro ao carregar equipa:", error);
        myTeamGrid.innerHTML = `<div class="my-team-status-msg" style="color: #ef4444;">Erro ao carregar equipa.</div>`;
    }
}

function parseInboxMessage(text) {
    if (!text) return '';
    // Escape HTML to prevent XSS
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // Replace images: ![alt](url) - Protected against contextmenu / drag / URL copy
    escaped = escaped.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
        return `<img src="${url}" alt="${alt}" draggable="false" oncontextmenu="return false;" onselectstart="return false;" style="max-width: 100%; max-height: 250px; object-fit: contain; border-radius: 8px; margin-top: 8px; display: block; border: 1.5px solid rgba(255,255,255,0.1); pointer-events: none; -webkit-user-drag: none; -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;">`;
    });

    // Replace links: [text](url)
    escaped = escaped.replace(/\[(.*?)\]\((.*?)\)/g, (match, label, url) => {
        if (url.startsWith('manual:')) {
            const manualId = url.replace('manual:', '').trim();
            return `<a href="#" class="inbox-manual-link" data-manual-id="${manualId}" style="color: #ffb703; text-decoration: underline; font-weight: 700; cursor: pointer; background: rgba(255, 183, 3, 0.12); padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid rgba(255, 183, 3, 0.3); transition: background 0.2s;"><i class="fas fa-book" style="font-size: 11px;"></i>${label}</a>`;
        }
        return `<a href="${url}" target="_blank" style="color: #ffb703; text-decoration: underline; font-weight: 600;">${label}</a>`;
    });

    return escaped;
}

// Bloquear clique direito e arrastar imagens na caixa de entrada para impedir copiar URL
document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('#inboxSection img, #inboxGrid img, .inbox-card img, #manualPreviewBody img')) {
        e.preventDefault();
        return false;
    }
}, true);

document.addEventListener('dragstart', (e) => {
    if (e.target.closest('#inboxSection img, #inboxGrid img, .inbox-card img, #manualPreviewBody img')) {
        e.preventDefault();
        return false;
    }
}, true);

async function openManualPreviewModal(manualId) {
    let modal = document.getElementById('inboxManualPreviewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'inboxManualPreviewModal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(5px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 20px;';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="background: #161b26; border: 1.5px solid #ffb703; border-radius: 16px; width: 90%; max-width: 600px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 15px 35px rgba(0,0,0,0.6); overflow: hidden;">
            <div style="padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; background: #111622;">
                <h3 id="manualPreviewTitle" style="color: #ffb703; font-size: 18px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px;"><i class="fas fa-spinner fa-spin"></i> A carregar...</h3>
                <button id="closeManualPreviewBtn" style="background: none; border: none; color: #8892b0; font-size: 22px; cursor: pointer; transition: color 0.2s;"><i class="fas fa-times"></i></button>
            </div>
            <div id="manualPreviewBody" style="padding: 20px 24px; overflow-y: auto; flex: 1; color: #e2e8f0; font-size: 14px; line-height: 1.6;">
                <p style="text-align: center; color: #8892b0;"><i class="fas fa-spinner fa-spin"></i> A carregar informação do Manual...</p>
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); background: #111622; display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
                <button id="closeManualPreviewSecondaryBtn" style="background: rgba(255,255,255,0.08); color: #e2e8f0; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer;">Fechar</button>
                <a id="goToManualBtn" href="manual.html?item=${manualId}" style="background: linear-gradient(135deg, #ffb703, #e69c00); color: #090c10; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(255, 183, 3, 0.25);">ver mais no Manual <i class="fas fa-chevron-right"></i></a>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    const closeBtn = modal.querySelector('#closeManualPreviewBtn');
    const closeSecBtn = modal.querySelector('#closeManualPreviewSecondaryBtn');
    const closeModalHandler = () => { modal.style.display = 'none'; };
    closeBtn.addEventListener('click', closeModalHandler);
    closeSecBtn.addEventListener('click', closeModalHandler);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModalHandler();
    });

    try {
        const docSnap = await getDoc(doc(db, 'manual', manualId));
        const titleEl = modal.querySelector('#manualPreviewTitle');
        const bodyEl = modal.querySelector('#manualPreviewBody');

        if (docSnap.exists()) {
            const data = docSnap.data();
            titleEl.innerHTML = `<i class="fas fa-book"></i> ${data.title || 'Informação do Manual'}`;
            bodyEl.innerHTML = `
                ${data.type ? `<span style="display: inline-block; background: rgba(255, 183, 3, 0.15); color: #ffb703; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">${data.type}</span>` : ''}
                <div>${data.content || '<p style="color: #8892b0;">Sem conteúdo disponível.</p>'}</div>
            `;
        } else {
            titleEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i> Item não encontrado`;
            bodyEl.innerHTML = `<p style="color: #e74c3c;">O conteúdo especificado do manual não foi encontrado ou foi removido.</p>`;
        }
    } catch (err) {
        console.error("Erro ao carregar item do manual:", err);
        const titleEl = modal.querySelector('#manualPreviewTitle');
        const bodyEl = modal.querySelector('#manualPreviewBody');
        titleEl.innerHTML = `<i class="fas fa-exclamation-circle" style="color: #e74c3c;"></i> Erro`;
        bodyEl.innerHTML = `<p style="color: #e74c3c;">Não foi possível carregar as informações do manual.</p>`;
    }
}

document.addEventListener('click', (e) => {
    const manualLink = e.target.closest('.inbox-manual-link');
    if (manualLink) {
        e.preventDefault();
        e.stopPropagation();
        const manualId = manualLink.dataset.manualId;
        if (manualId) {
            openManualPreviewModal(manualId);
        }
    }
});

let inboxUnsubscribe = null;

function showInboxConfirm(message, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; z-index: 99999; backdrop-filter: blur(4px); animation: fadeInConfirm 0.2s ease-out;';

    const card = document.createElement('div');
    card.style.cssText = 'background: #161b26; border: 1.5px solid #ffb703; padding: 30px; border-radius: 16px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); transform: scale(0.9); animation: scaleConfirmIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; display: flex; flex-direction: column; align-items: center; gap: 15px;';

    const icon = document.createElement('div');
    icon.style.cssText = 'width: 54px; height: 54px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #ffb703; background: rgba(255, 183, 3, 0.1); border: 1.5px solid #ffb703; flex-shrink: 0;';
    icon.innerHTML = '<i class="fas fa-question"></i>';

    const text = document.createElement('p');
    text.style.cssText = 'color: #f0f2f5; font-size: 16px; font-weight: 600; line-height: 1.5; margin: 0; font-family: system-ui, -apple-system, sans-serif;';
    text.textContent = message;

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 12px; width: 100%; margin-top: 10px;';

    const yesBtn = document.createElement('button');
    yesBtn.style.cssText = 'flex: 1; background: #2ecc71; color: #0c1017; font-weight: 700; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 14px;';
    yesBtn.textContent = 'Sim';

    const noBtn = document.createElement('button');
    noBtn.style.cssText = 'flex: 1; background: #e74c3c; color: white; font-weight: 700; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 14px;';
    noBtn.textContent = 'Não';

    const close = () => {
        card.style.animation = 'scaleConfirmOut 0.15s ease-in forwards';
        overlay.style.animation = 'fadeOutConfirm 0.15s ease-in forwards';
        setTimeout(() => overlay.remove(), 150);
    };

    yesBtn.addEventListener('click', () => {
        close();
        if (onConfirm) onConfirm();
    });

    noBtn.addEventListener('click', () => {
        close();
        if (onCancel) onCancel();
    });

    actions.appendChild(yesBtn);
    actions.appendChild(noBtn);
    card.appendChild(icon);
    card.appendChild(text);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    if (!document.getElementById('custom-confirm-styles')) {
        const styles = document.createElement('style');
        styles.id = 'custom-confirm-styles';
        styles.textContent = `
            @keyframes fadeInConfirm { from { opacity: 0; } to { opacity: 1; } }
            @keyframes fadeOutConfirm { from { opacity: 1; } to { opacity: 0; } }
            @keyframes scaleConfirmIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            @keyframes scaleConfirmOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.85); opacity: 0; } }
        `;
        document.head.appendChild(styles);
    }
}

function formatInboxDate(rawDate) {
    if (!rawDate) return '';
    let d = null;
    if (typeof rawDate.toDate === 'function') {
        d = rawDate.toDate();
    } else if (rawDate && typeof rawDate.seconds === 'number') {
        d = new Date(rawDate.seconds * 1000);
    } else if (rawDate instanceof Date) {
        d = rawDate;
    } else if (typeof rawDate === 'string' || typeof rawDate === 'number') {
        d = new Date(rawDate);
    }
    if (!d || isNaN(d.getTime())) return '';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

async function loadInbox(userId) {
    const inboxSection = document.getElementById('inboxSection');
    const inboxGrid = document.getElementById('inboxGrid');
    const inboxBadge = document.getElementById('inboxBadge');
    if (!inboxSection || !inboxGrid) return;

    if (inboxUnsubscribe) {
        inboxUnsubscribe();
        inboxUnsubscribe = null;
    }

    try {
        const q = query(collection(db, 'inbox'), where('para', '==', userId), where('status', '==', true));
        
        inboxUnsubscribe = onSnapshot(q, async (snapshot) => {
            inboxSection.style.display = 'block';
            if (snapshot.empty) {
                if (inboxBadge) inboxBadge.style.display = 'none';
                inboxGrid.innerHTML = `<div class="inbox-status-msg" style="color: #8892b0; grid-column: 1 / -1; font-size: 14px;">Sem propostas pendentes de momento.</div>`;
                return;
            }

            inboxGrid.innerHTML = '';

            const promises = snapshot.docs.map(async (inboxDoc) => {
                const data = inboxDoc.data();
                
                // If it is a generic email/message
                if (data.tipo === 'email' || !data.jogadorId) {
                    return {
                        id: inboxDoc.id,
                        data,
                        senderName: data.de || 'Sistema',
                        isEmail: true
                    };
                }

                // Fetch sender name
                const senderSnap = await getDoc(doc(db, 'users', data.de));
                const senderName = senderSnap.exists() ? (senderSnap.data().nometabela || senderSnap.data().nomeDeUsuario || senderSnap.data().nome || 'Utilizador') : 'Utilizador';
                
                // Fetch player details
                const playerSnap = await getDoc(doc(db, 'jogadores', data.jogadorId));
                if (!playerSnap.exists()) return null;
                const player = playerSnap.data();

                return {
                    id: inboxDoc.id,
                    data,
                    senderName,
                    player: { id: playerSnap.id, ...player }
                };
            });

            const proposals = (await Promise.all(promises)).filter(p => p !== null);
            const emailCount = proposals.filter(p => p.isEmail).length;

            if (inboxBadge) {
                if (emailCount > 0) {
                    inboxBadge.textContent = emailCount;
                    inboxBadge.style.display = 'flex';
                } else {
                    inboxBadge.style.display = 'none';
                }
            }

            if (proposals.length === 0) {
                inboxGrid.innerHTML = `<div class="inbox-status-msg" style="color: #8892b0; grid-column: 1 / -1; font-size: 14px;">Sem propostas pendentes de momento.</div>`;
                return;
            }

            proposals.forEach(p => {
                const card = document.createElement('div');
                card.className = 'inbox-card';
                card.style.cssText = 'background: #161b26; border: 1px solid rgba(255,255,255,0.08); padding: 15px; border-radius: 10px; color: white; display: flex; flex-direction: column; gap: 10px;';
                
                if (p.isEmail) {
                    const rawDate = p.data.timestamp || p.data.data || p.data.createdAt || p.data.date;
                    const dateStr = formatInboxDate(rawDate);

                    card.style.cssText = 'background: #1b160a; border: 1px solid rgba(241, 196, 15, 0.25); padding: 12px 18px; border-radius: 12px; color: white; display: flex; flex-direction: column; gap: 0; cursor: pointer; transition: background 0.2s;';
                    card.innerHTML = `
                        <!-- Cabeçalho (Sempre Visível) -->
                        <div class="email-header" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                            <div style="display: flex; gap: 12px; align-items: center; min-width: 0; flex: 1;">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #ffb703; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #090c10; border: 1.5px solid rgba(255,255,255,0.15); flex-shrink: 0;"><i class="fas fa-envelope"></i></div>
                                <div style="min-width: 0; flex: 1;">
                                    <div style="font-weight: 700; font-size: 14px; color: #ffb703; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.data.titulo || 'Nova Mensagem'}</div>
                                    <div style="font-size: 11px; color: #a0aec0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                        <span>De: <strong style="color: #e2e8f0;">${p.senderName}</strong></span>
                                        ${dateStr ? `<span style="color: #8892b0; font-size: 11px;">• ${dateStr}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div style="margin-left: 10px; color: #ffb703; font-size: 12px; display: flex; align-items: center; gap: 5px;">
                                <span class="toggle-icon"><i class="fas fa-chevron-down"></i></span>
                            </div>
                        </div>
                        
                        <!-- Corpo e Ações (Colapsado por Padrão) -->
                        <div class="email-body" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out, margin-top 0.3s ease-out; margin-top: 0;">
                            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px; margin-top: 8px;">
                                <div style="font-size: 20px; color: #e2e8f0; line-height: 1.5; margin-bottom: 12px; white-space: pre-wrap;">${parseInboxMessage(p.data.mensagem)}</div>
                                <div style="display: flex; justify-content: flex-end;">
                                    <button class="dismiss-btn" style="background: #ffb703; color: #090c10; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px; transition: opacity 0.2s;">Lido</button>
                                </div>
                            </div>
                        </div>
                    `;

                    const dismissBtn = card.querySelector('.dismiss-btn');
                    dismissBtn.addEventListener('click', async (e) => {
                        e.stopPropagation(); // Evita expandir/colapsar ao clicar no botão
                        dismissBtn.disabled = true;
                        dismissBtn.style.opacity = '0.5';
                        try {
                            await updateDoc(doc(db, 'inbox', p.id), { status: false, estado: 'Lido' });
                            logUserAction(`Marcou mensagem '${p.data.titulo || 'Sem título'}' como lida`);
                        } catch (err) {
                            console.error(err);
                            alert("Erro ao arquivar mensagem.");
                            dismissBtn.disabled = false;
                            dismissBtn.style.opacity = '1';
                        }
                    });

                    card.addEventListener('click', () => {
                        const emailBody = card.querySelector('.email-body');
                        const toggleIcon = card.querySelector('.toggle-icon i');
                        
                        const isClosed = emailBody.style.maxHeight === '0px' || !emailBody.style.maxHeight || emailBody.style.maxHeight === '0';
                        if (isClosed) {
                            emailBody.style.maxHeight = (emailBody.scrollHeight + 120) + 'px';
                            emailBody.style.marginTop = '8px';
                            toggleIcon.className = 'fas fa-chevron-up';
                            card.style.background = '#29210c';
                            setTimeout(() => {
                                if (emailBody.style.maxHeight !== '0px') {
                                    emailBody.style.maxHeight = 'none';
                                    emailBody.style.overflow = 'visible';
                                }
                            }, 320);
                        } else {
                            emailBody.style.overflow = 'hidden';
                            emailBody.style.maxHeight = emailBody.scrollHeight + 'px';
                            setTimeout(() => {
                                emailBody.style.maxHeight = '0px';
                                emailBody.style.marginTop = '0px';
                                toggleIcon.className = 'fas fa-chevron-down';
                                card.style.background = '#1b160a';
                            }, 10);
                        }
                    });
                    
                    inboxGrid.appendChild(card);
                    return;
                }

                let castaClassName = '';
                if (p.player.casta === "Jogador Ouro") castaClassName = 'color: #ffb703;';
                else if (p.player.casta === "Jogador Prata") castaClassName = 'color: #bdc3c7;';
                else if (p.player.casta === "Jogador Bronze") castaClassName = 'color: #cd7f32;';
                else if (p.player.casta === "Jogador Platina") castaClassName = 'color: #e5e5e5;';
                
                const propRawDate = p.data.data || p.data.timestamp || p.data.createdAt || p.data.date;
                const propDateStr = formatInboxDate(propRawDate);

                card.innerHTML = `
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <img src="${p.player.imagem || 'placeholder.png'}" alt="${p.player.nome}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%; background: #0c1017; border: 1.5px solid rgba(255,255,255,0.15);">
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 15px; ${castaClassName}">${p.player.nome}</div>
                            <div style="font-size: 12px; color: #8892b0;">${p.player.posicao} | ${p.player.preco} GCoins</div>
                        </div>
                    </div>
                    <div style="font-size: 13px; color: #8892b0; margin-top: 5px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                        <span>Proposta de venda recebida de: <strong style="color: white;">${p.senderName}</strong></span>
                        ${propDateStr ? `<span style="color: #718096; font-size: 11px;">• ${propDateStr}</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button class="accept-btn" style="flex: 1; background: #2ecc71; color: #090c10; border: none; padding: 8px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; transition: opacity 0.2s;">Aceitar</button>
                        <button class="reject-btn" style="flex: 1; background: #e74c3c; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; transition: opacity 0.2s;">Recusar</button>
                    </div>
                `;

                const acceptBtn = card.querySelector('.accept-btn');
                const rejectBtn = card.querySelector('.reject-btn');

                rejectBtn.addEventListener('click', () => {
                    showInboxConfirm(`Tens a certeza de que desejas recusar a proposta de venda do jogador ${p.player.nome}?`, async () => {
                        rejectBtn.disabled = true;
                        rejectBtn.style.opacity = '0.5';
                        try {
                            await updateDoc(doc(db, 'inbox', p.id), { status: false, estado: 'Recusado' });
                        } catch (err) {
                            console.error(err);
                            alert("Erro ao rejeitar a proposta.");
                            rejectBtn.disabled = false;
                            rejectBtn.style.opacity = '1';
                        }
                    });
                });

                acceptBtn.addEventListener('click', () => {
                    showInboxConfirm(`Tens a certeza de que desejas aceitar a proposta de compra do jogador ${p.player.nome} por ${p.player.preco} GCoins?`, async () => {
                        acceptBtn.disabled = true;
                        acceptBtn.style.opacity = '0.5';
                        try {
                            const configSnap = await getDoc(doc(db, "paineis", "Banca"));
                            let comissaoBancaVenda = 0;
                            let bankBalance = 0;
                            if (configSnap.exists()) {
                                comissaoBancaVenda = configSnap.data().comissaoBancaVenda || 0;
                                bankBalance = configSnap.data().valor || 0;
                            }

                            const latestSeason = await getLatestSeason(db);

                            const buyerRef = doc(db, 'users', userId);
                            const buyerSnap = await getDoc(buyerRef);
                            if (!buyerSnap.exists()) return;
                            const buyerData = buyerSnap.data();
                            const buyerSeasonData = getSeasonData(buyerData, latestSeason);
                            const buyerGCoins = buyerSeasonData.GCoins || 0;

                            if (buyerGCoins < p.player.preco) {
                                alert(`Não tens GCoins suficientes para aceitar esta proposta! Preço: ${p.player.preco} GCoins, O teu Saldo: ${buyerGCoins} GCoins.`);
                                acceptBtn.disabled = false;
                                acceptBtn.style.opacity = '1';
                                return;
                            }

                            const sellerRef = doc(db, 'users', p.data.de);
                            const sellerSnap = await getDoc(sellerRef);
                            if (!sellerSnap.exists()) {
                                alert("Vendedor não encontrado.");
                                acceptBtn.disabled = false;
                                acceptBtn.style.opacity = '1';
                                return;
                            }
                            const sellerData = sellerSnap.data();

                            if (!sellerData.permissoes || sellerData.permissoes.vender !== 'yes') {
                                alert("Esta proposta já não é válida porque o vendedor não tem permissão para vender.");
                                await updateDoc(doc(db, 'inbox', p.id), { status: false, estado: 'Invalido' });
                                return;
                            }

                            const sellerSeasonData = getSeasonData(sellerData, latestSeason);
                            const sellerGCoins = sellerSeasonData.GCoins || 0;
                            const buyerName = buyerData.nometabela || 'Utilizador';

                            const batch = writeBatch(db);

                            batch.update(doc(db, 'jogadores', p.player.id), {
                                compradopor: userId
                            });

                            batch.update(buyerRef, {
                                [latestSeason]: {
                                    ...buyerSeasonData,
                                    GCoins: buyerGCoins - p.player.preco
                                }
                            });

                            const finalSellerGains = Math.max(0, p.player.preco - comissaoBancaVenda);
                            batch.update(sellerRef, {
                                [latestSeason]: {
                                    ...sellerSeasonData,
                                    GCoins: sellerGCoins + finalSellerGains
                                }
                            });

                            batch.update(doc(db, "paineis", "Banca"), {
                                valor: bankBalance + comissaoBancaVenda
                            });

                            batch.update(doc(db, 'inbox', p.id), {
                                status: false,
                                estado: 'Aceite'
                            });

                            batch.set(doc(collection(db, 'movimentos')), {
                                de: p.data.de,
                                para_userId: userId,
                                userId: userId,
                                estado: 'Comprado',
                                jogadorId: p.player.id,
                                posicao: p.player.posicao,
                                preco: -p.player.preco,
                                valorreal: -p.player.preco,
                                temporada: compactSeason(latestSeason),
                                tipo: 'Mercado',
                                movimentoData: serverTimestamp(),
                                descricao: `Compra de jogador ${p.player.nome} a ${p.senderName}`
                            });

                            batch.set(doc(collection(db, 'movimentos')), {
                                de: p.data.de,
                                para_userId: userId,
                                userId: p.data.de,
                                estado: 'Vendido',
                                jogadorId: p.player.id,
                                posicao: p.player.posicao,
                                preco: p.player.preco,
                                valorreal: finalSellerGains,
                                temporada: compactSeason(latestSeason),
                                tipo: 'Mercado',
                                movimentoData: serverTimestamp(),
                                descricao: `Venda de jogador ${p.player.nome} a ${buyerName} (Comissão da Banca: ${comissaoBancaVenda} gCoins)`
                            });

                            batch.set(doc(collection(db, 'movimentos')), {
                                preco: comissaoBancaVenda,
                                tipo: "Banca",
                                temporada: compactSeason(latestSeason),
                                movimentoData: serverTimestamp(),
                                descricao: `Comissão de venda de jogador ${p.player.nome} entre ${p.senderName} e ${buyerName}`
                            });

                            // Invalidate all other pending proposals for this same player
                            try {
                                const pendingQuery = query(
                                    collection(db, 'inbox'), 
                                    where('jogadorId', '==', p.player.id),
                                    where('status', '==', true)
                                );
                                const pendingSnapshot = await getDocs(pendingQuery);
                                pendingSnapshot.forEach(pendingDoc => {
                                    if (pendingDoc.id !== p.id) {
                                        batch.update(pendingDoc.ref, {
                                            status: false,
                                            estado: 'Expirado'
                                        });
                                    }
                                });
                            } catch (pendingErr) {
                                console.error("Erro ao invalidar propostas pendentes concorrentes:", pendingErr);
                            }

                            await batch.commit();

                            alert(`Jogador ${p.player.nome} adquirido com sucesso por ${p.player.preco} GCoins!`);
                            location.reload();

                        } catch (err) {
                            console.error(err);
                            alert("Erro ao aceitar proposta de venda.");
                            acceptBtn.disabled = false;
                            acceptBtn.style.opacity = '1';
                        }
                    });
                });

                inboxGrid.appendChild(card);
            });
        });
    } catch (err) {
        console.error(err);
    }
}

// DOMContentLoaded listener for initial loading trigger
document.addEventListener('DOMContentLoaded', () => {
    loadingScreen.style.display = 'flex';
    content.style.display = 'none';
});
