// market/market.js
import { db, auth } from '../core/firebase.js';
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, Timestamp, addDoc, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { fetchUniqueSeasons, getPlayerSeasonData, hasPlayerDataForSeason } from "../admin/js/player-season-helper.js";
import { compactSeason, getLatestSeason, getSeasonData } from "../core/user-season.js";

const activeListeners = new Map();

function logUserAction(actionDescription) {
    if (!auth.currentUser) {
        console.log("Nenhum utilizador logado para registar a ação.");
        return;
    }
    
    try {
        const eyeCollection = collection(db, 'eye');
        void addDoc(eyeCollection, {
            dataacao: serverTimestamp(),
            acao: actionDescription,
            userId: auth.currentUser.uid
        }).catch((error) => console.error("Erro ao registar a acção na coleção 'eye':", error));
    } catch (error) {
        console.error("Erro ao registar ação na coleção 'eye':", error);
    }
}

// --- DOM Elements ---
const loadingScreen = document.getElementById('loading-screen');
const content = document.querySelector('.content');

// --- Global State ---
let currentUserEstatuto = null;
let countdownInterval; // Variável global para controlar o cronómetro

// --- Helper Functions ---

/**
 * Fetches the user's 'estatuto' from Firestore.
 * @param {string} userId - The Firebase Authentication user ID.
 * @returns {Promise<string|null>} The user's 'estatuto' or null if not found/accepted/error.
 */
async function getUserEstatuto(userId) {
    if (!userId) return null;
    const userDocRef = doc(db, 'users', userId);
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists() && docSnap.data()?.aceite === "Yes") {
            return docSnap.data().estatuto;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching user status:", error);
        return null;
    }
}

/**
 * Fetches a username from Firestore based on user ID.
 * @param {string} userId - The user ID to look up.
 * @returns {Promise<string>} The username or the original user ID as fallback.
 */
async function getUsername(userId) {
    if (!userId) return userId;
    const userDoc = doc(db, 'users', userId);
    try {
        const docSnap = await getDoc(userDoc);
        if (docSnap.exists()) {
            return docSnap.data()?.nometabela || userId;
        } else {
            return userId;
        }
    } catch (error) {
        console.error(`Error fetching username for userId ${userId}:`, error);
        return userId;
    }
}

/**
 * Removes any existing success or error messages from the popup.
 */
function clearPopupMessages() {
    const popupContent = document.querySelector('.popup-content');
    if (!popupContent) return;
    const existingError = popupContent.querySelector('.error-message');
    const existingSuccess = popupContent.querySelector('.success-message');
    if (existingError) existingError.remove();
    if (existingSuccess) existingSuccess.remove();
}

/**
 * Displays an error message within the popup content area.
 * @param {HTMLElement} popupContent - The popup's content element.
 * @param {string} message - The error message to display.
 */
function displayErrorMessage(popupContent, message) {
    if (!popupContent) return;
    clearPopupMessages();
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    const statsSection = popupContent.querySelector('.popup-stats');
    if (statsSection) {
        statsSection.insertAdjacentElement('afterend', errorElement);
    } else {
        popupContent.appendChild(errorElement);
    }
}

/**
 * Displays a success message within the popup content area.
 * @param {HTMLElement} popupContent - The popup's content element.
 * @param {string} message - The success message to display.
 */
function displaySuccessMessage(popupContent, message) {
    if (!popupContent) return;
    clearPopupMessages();
    const successElement = document.createElement('div');
    successElement.className = 'success-message';
    successElement.textContent = message;
    const statsSection = popupContent.querySelector('.popup-stats');
    if (statsSection) {
        statsSection.insertAdjacentElement('afterend', successElement);
    } else {
        popupContent.appendChild(successElement);
    }
}

/**
 * Determines the CSS class based on player tier ('casta').
 * @param {string} casta - The player's tier string.
 * @returns {string} The corresponding CSS class name ('gold', 'silver', etc.).
 */
function getTierClass(casta) {
    switch (casta) {
        case 'Jogador Ouro': return 'gold';
        case 'Jogador Prata': return 'silver';
        case 'Jogador Bronze': return 'bronze';
        case 'Jogador Platina': return 'platinum';
        default: return '';
    }
}

// --- Core Logic Functions ---

/**
 * Creates a player card element with data and event listeners.
 * @param {object} player - The player data object from Firestore.
 * @returns {Promise<HTMLElement>} The created card element.
 */
async function createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = `player-card ${getTierClass(player.casta)}`;
    card.dataset.playerId = player.id;
    card.dataset.paisId = player.paisId || '';

    let paisImagem = '';
    if (player.paisId) {
        try {
            const paisDoc = await getDoc(doc(db, 'paises', player.paisId));
            paisImagem = paisDoc.exists() ? paisDoc.data()?.imagem || '' : '';
        } catch (error) {
            console.warn(`Could not fetch country data for ID: ${player.paisId}`, error);
        }
    }

    let initialButtonText = 'Comprar';
    let initialButtonClass = 'available';
    let initialButtonDisabled = false;
    if (player.compradopor) {
        initialButtonClass = 'purchased';
        initialButtonDisabled = true;
        initialButtonText = `Comprado por ${player.compradopor}`; // Temp ID
        getUsername(player.compradopor).then(username => {
            const buttonElement = card.querySelector('.buy-button');
            if (buttonElement) buttonElement.textContent = `Comprado por ${username || player.compradopor}`;
        }).catch(err => console.error("Error fetching initial card username:", err));
    }

    card.innerHTML = `
        ${paisImagem ? `<img src="${paisImagem}" alt="Country flag" class="country-flag">` : ''}
        <img src="${player.imagem || ''}" alt="${player.nome || 'Player'}" class="player-image">
        <div class="player-info">
            <div class="player-name">${player.nome || '-'}</div>
            <div class="player-club">${player.clube || '-'}</div>
            <div class="player-stats">
                <div class="stat-column">
                    <div class="stat-label">Overall:</div>
                    <div class="stat-value">${player.overall || '-'}</div>
                </div>
                <div class="stat-column">
                    <div class="stat-value price">${player.preco || 0}</div>
                    <div class="stat-label">gCoins</div>
                </div>
            </div>
            <button class="buy-button ${initialButtonClass}" ${initialButtonDisabled ? 'disabled' : ''}>
                ${initialButtonText}
            </button>
        </div>
    `;
    const buyButtonCard = card.querySelector('.buy-button');

    const playerDocRef = doc(db, 'jogadores', player.id);
    const unsubscribeCard = onSnapshot(playerDocRef, async (docSnapshot) => {
        if (!buyButtonCard) return;

        if (docSnapshot.exists()) {
            const updatedPlayer = docSnapshot.data();
            const compradorUserId = updatedPlayer?.compradopor;
            if (compradorUserId) {
                const compradorUsernameCard = await getUsername(compradorUserId);
                buyButtonCard.textContent = `Comprado por ${compradorUsernameCard || compradorUserId}`;
                buyButtonCard.classList.add('purchased');
                buyButtonCard.classList.remove('available');
                buyButtonCard.disabled = true;
            } else {
                buyButtonCard.textContent = 'Comprar';
                buyButtonCard.classList.remove('purchased');
                buyButtonCard.classList.add('available');
                buyButtonCard.disabled = false;
            }
        } else {
            console.warn(`Player card listener: Document ${player.id} does not exist. Removing card.`);
            if (unsubscribeCard && typeof unsubscribeCard === 'function') {
                try {
                    unsubscribeCard();
                } catch (e) { /* ignore */ }
            }
            card.remove();
        }
    }, (error) => {
        console.error(`Error in player card listener for ${player.id}:`, error);
        if (buyButtonCard) {
            buyButtonCard.textContent = 'Erro';
            buyButtonCard.disabled = true;
        }
    });

    activeListeners.set(`card-${player.id}`, unsubscribeCard);

    card.addEventListener('click', async (event) => {
        const clickedButton = event.target.closest('.buy-button');
        if (clickedButton?.classList.contains('purchased')) {
            return;
        }

        card.classList.add('card-loading');

        const popup = document.getElementById('playerPopup');
        if (!popup) {
            console.error("Popup element not found!");
            card.classList.remove('card-loading');
            return;
        }

        popup.dataset.currentPlayerId = player.id;

        const existingUnsubscribeRef = popup.dataset.unsubscribePopupListener;
        if (existingUnsubscribeRef) {
            const existingUnsubscribe = window[existingUnsubscribeRef];
            if (existingUnsubscribe && typeof existingUnsubscribe === 'function') {
                try {
                    existingUnsubscribe();
                } catch (e) {
                    console.error("Error detaching previous popup listener:", e);
                }
            }
        }
        delete popup.dataset.unsubscribePopupListener;
        clearPopupMessages();

        const popupImage = document.getElementById('popupPlayerImage');
        const popupName = document.getElementById('popupPlayerName');
        const popupClub = document.getElementById('popupPlayerClub');
        const popupOverall = document.getElementById('popupPlayerOverall');
        const popupPrice = document.getElementById('popupPlayerPrice');
        const popupCasta = document.getElementById('popupPlayerCasta');
        const popupBuyButton = document.getElementById('popupBuyButton');
        const popupCountryFlag = document.getElementById('popupCountryFlag');
        const popupPlayerPosicaoElement = document.getElementById('popupPlayerPosicao');
        const playerPopupContent = document.querySelector('.popup-content');

        if (!popupImage || !popupName || !popupClub || !popupOverall || !popupPrice || !popupCasta || !popupBuyButton || !popupCountryFlag || !popupPlayerPosicaoElement || !playerPopupContent) {
            console.error("One or more essential popup elements were not found!");
            card.classList.remove('card-loading');
            alert("Erro ao carregar o popup do jogador.");
            return;
        }

        try {
            const playerDocRefPopup = doc(db, 'jogadores', player.id);
            const freshPlayerSnap = await getDoc(playerDocRefPopup);
            if (!freshPlayerSnap.exists()) {
                console.error("Player data not found for popup.");
                card.classList.remove('card-loading');
                alert("Detalhes do jogador não encontrados.");
                return;
            }
            const currentPlayerPopupData = freshPlayerSnap.data();

            let popupPaisImagem = '';
            if (currentPlayerPopupData?.paisId) {
                try {
                    const popupPaisDoc = await getDoc(doc(db, 'paises', currentPlayerPopupData.paisId));
                    popupPaisImagem = popupPaisDoc.exists() ? popupPaisDoc.data()?.imagem || '' : '';
                } catch (error) {
                    console.warn(`Could not fetch country data for popup (ID: ${currentPlayerPopupData.paisId})`, error);
                }
            }

            popupImage.src = currentPlayerPopupData?.imagem || '';
            popupImage.alt = currentPlayerPopupData?.nome || 'Player Image';
            popupName.textContent = currentPlayerPopupData?.nome || 'Nome Indisponível';
            popupClub.textContent = currentPlayerPopupData?.clube || 'Clube Indisponível';
            popupOverall.textContent = currentPlayerPopupData?.overall || '-';
            popupPrice.textContent = `${currentPlayerPopupData?.preco || 0} gCoins`;
            popupPlayerPosicaoElement.textContent = currentPlayerPopupData?.posicao || '-';
            popupCasta.textContent = currentPlayerPopupData?.casta || '-';
            popupCountryFlag.style.display = popupPaisImagem ? 'block' : 'none';
            if (popupPaisImagem) popupCountryFlag.src = popupPaisImagem;
            popupCountryFlag.alt = 'Country flag';

            // Check if there is history for this player in movimentos
            const historyBtn = document.getElementById('popupHistoryButton');
            if (historyBtn) {
                historyBtn.style.display = 'none';
                try {
                    const movQuery = query(collection(db, 'movimentos'), where('jogadorId', '==', player.id));
                    const movSnap = await getDocs(movQuery);
                    if (!movSnap.empty) {
                        historyBtn.style.display = 'inline-block';
                        historyBtn.onclick = async () => {
                            const historyPopup = document.getElementById('historyPopup');
                            const historyList = document.getElementById('playerHistoryList');
                            if (historyPopup && historyList) {
                                historyList.innerHTML = '<p style="text-align: center; color: #8892b0;">A carregar histórico...</p>';
                                historyPopup.classList.add('active');
                                
                                try {
                                    const promises = movSnap.docs.map(async (docSnap) => {
                                        const mov = docSnap.data();
                                        let desc = mov.descricao || '';
                                        
                                        let targetName = 'Utilizador';
                                        let needsUserFetch = !desc || (desc.startsWith("Vendido à Banca") && !desc.includes(" por "));
                                        
                                        if (needsUserFetch && mov.userId) {
                                            try {
                                                const uSnap = await getDoc(doc(db, 'users', mov.userId));
                                                if (uSnap.exists()) {
                                                    targetName = uSnap.data().nometabela || uSnap.data().nomeDeUsuario || 'Utilizador';
                                                }
                                            } catch (err) {
                                                console.warn("Could not fetch user name for description:", err);
                                            }
                                        }

                                        if (!desc) {
                                            desc = `${mov.estado || 'Movimento'} por ${targetName}`;
                                        } else if (desc.startsWith("Vendido à Banca") && !desc.includes(" por ")) {
                                            desc = desc.replace("Vendido à Banca", `Vendido à Banca por ${targetName}`);
                                        }
                                        
                                        return {
                                            mov,
                                            desc,
                                            dateStr: mov.movimentoData ? mov.movimentoData.toDate().toLocaleString('pt-PT') : 'Data Indisponível'
                                        };
                                    });
                                    
                                    const itemsData = await Promise.all(promises);
                                    
                                    const sortedItems = itemsData.sort((a, b) => {
                                        const dateA = a.mov.movimentoData ? a.mov.movimentoData.toDate() : 0;
                                        const dateB = b.mov.movimentoData ? b.mov.movimentoData.toDate() : 0;
                                        return dateB - dateA;
                                    });

                                    historyList.innerHTML = '';
                                    if (sortedItems.length === 0) {
                                        historyList.innerHTML = '<p style="text-align: center; color: #8892b0;">Sem movimentos registados.</p>';
                                        return;
                                    }

                                    sortedItems.forEach(itemData => {
                                        const { mov, desc, dateStr } = itemData;
                                        const item = document.createElement('div');
                                        item.style.cssText = 'background: #1f2736; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); font-size: 13px; margin-bottom: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
                                        
                                        let priceText = '';
                                        if (mov.preco !== undefined) {
                                            priceText = `<strong style="color: #ffb703; font-weight: 700;">${mov.preco} gCoins</strong>`;
                                        } else if (mov.valorreal !== undefined) {
                                            priceText = `<strong style="color: #ffb703; font-weight: 700;">${mov.valorreal} gCoins</strong>`;
                                        }
                                        
                                        item.innerHTML = `
                                            <div style="background: #273144; padding: 8px 12px; font-size: 11px; color: #a2a8ba; font-weight: 600; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15);">
                                                <span>${dateStr}</span>
                                                <span style="font-weight: 700; text-transform: uppercase; color: #3498db; font-size: 9px; letter-spacing: 0.5px; padding: 2px 6px; background: rgba(52, 152, 219, 0.15); border-radius: 4px;">${mov.tipo || 'Movimento'}</span>
                                            </div>
                                            <div style="padding: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                                                <span style="color: #cbd5e1; line-height: 1.4; font-size: 12px;">${desc}</span>
                                                <span style="white-space: nowrap;">${priceText}</span>
                                            </div>
                                        `;
                                        historyList.appendChild(item);
                                    });
                                } catch (err) {
                                    console.error("Error building player history list:", err);
                                    historyList.innerHTML = '<p style="text-align: center; color: red;">Erro ao carregar lista.</p>';
                                }
                            }
                        };
                    }
                } catch (e) {
                    console.error("Error loading player history:", e);
                }
            }

            const unsubscribePopupListener = onSnapshot(playerDocRefPopup, async (docSnapshot) => {
                if (!popupBuyButton) return;
                if (docSnapshot.exists()) {
                    const updatedPlayerForPopup = docSnapshot.data();
                    const compradorUserIdPopup = updatedPlayerForPopup?.compradopor;
                    if (compradorUserIdPopup) {
                        const compradorUsernamePopup = await getUsername(compradorUserIdPopup);
                        popupBuyButton.disabled = true;
                        popupBuyButton.textContent = `Comprado por ${compradorUsernamePopup || compradorUserIdPopup}`;
                        popupBuyButton.classList.add('purchased');
                        popupBuyButton.classList.remove('buy');
                        popupBuyButton.style.cursor = 'not-allowed';
                    } else {
                        popupBuyButton.disabled = false;
                        popupBuyButton.textContent = 'Comprar';
                        popupBuyButton.classList.remove('purchased');
                        popupBuyButton.classList.add('buy');
                        popupBuyButton.style.cursor = 'pointer';
                    }
                } else {
                    console.warn(`Popup listener: Document ${player.id} no longer exists.`);
                    popupBuyButton.disabled = true;
                    popupBuyButton.textContent = 'Jogador Indisponível';
                    popupBuyButton.classList.add('purchased');
                    popupBuyButton.classList.remove('buy');
                }
            }, (error) => {
                console.error(`Error in popup listener for ${player.id}:`, error);
                if (popupBuyButton) {
                    popupBuyButton.disabled = true;
                    popupBuyButton.textContent = 'Erro';
                }
            });
            activeListeners.set(`popup-${player.id}`, unsubscribePopupListener);

            popupBuyButton.onclick = async () => {
                clearPopupMessages();
                popupBuyButton.disabled = true;
                popupBuyButton.textContent = 'Verificando...';

                try {
                    const checkPlayerSnap = await getDoc(playerDocRefPopup);
                    if (!checkPlayerSnap.exists()) {
                        displayErrorMessage(playerPopupContent, "Este jogador já não está disponível.");
                        popupBuyButton.disabled = true;
                        return;
                    }
                    const checkPlayerData = checkPlayerSnap.data();
                    checkPlayerData.id = checkPlayerSnap.id;

                    if (checkPlayerData.compradopor) {
                        const compradorUsername = await getUsername(checkPlayerData.compradopor);
                        displayErrorMessage(playerPopupContent, `Este jogador já foi comprado por ${compradorUsername || checkPlayerData.compradopor}.`);
                        popupBuyButton.textContent = `Comprado por ${compradorUsername || checkPlayerData.compradopor}`;
                        popupBuyButton.classList.add('purchased');
                        popupBuyButton.classList.remove('buy');
                        popupBuyButton.disabled = true;
                        return;
                    }

                    const schedulesRef = collection(db, 'paineis', 'Banca', 'horarioMercado');
                    const schedulesSnapshot = await getDocs(schedulesRef);

                    if (schedulesSnapshot.empty) {
                        displayErrorMessage(playerPopupContent, "O mercado está globalmente fechado. Nenhuma janela de transferências está ativa.");
                        popupBuyButton.disabled = false;
                        popupBuyButton.textContent = 'Comprar';
                        return;
                    }

                    const agora = new Date();
                    let isMarketCurrentlyOpen = false;

                    schedulesSnapshot.forEach(doc => {
                        const schedule = doc.data();
                        const abertura = schedule.abertura.toDate();
                        const fechamento = schedule.fechamento.toDate();
                        if (agora >= abertura && agora <= fechamento) {
                            isMarketCurrentlyOpen = true;
                        }
                    });

                    if (!isMarketCurrentlyOpen) {
                        displayErrorMessage(playerPopupContent, "O mercado está fechado. Por favor, aguarde pela próxima janela de transferências.");
                        popupBuyButton.disabled = false;
                        popupBuyButton.textContent = 'Comprar';
                        return;
                    }

                    if (!auth.currentUser) {
                        displayErrorMessage(playerPopupContent, "Utilizador não autenticado.");
                        popupBuyButton.disabled = false;
                        popupBuyButton.textContent = 'Comprar';
                        return;
                    }
                    const userRef = doc(db, 'users', auth.currentUser.uid);
                    const userSnap = await getDoc(userRef);
                    if (!userSnap.exists()) {
                        displayErrorMessage(playerPopupContent, "Erro ao verificar os seus fundos.");
                        popupBuyButton.disabled = false;
                        popupBuyButton.textContent = 'Comprar';
                        return;
                    }
                    const userData = userSnap.data();
                    const playerPrice = checkPlayerData.preco || 0;
                    const mostRecentSeason = await getLatestSeason(db);
                    const seasonData = getSeasonData(userData, mostRecentSeason);
                    const gCoinsField = 'GCoins';
                    const userGcoins = typeof seasonData.GCoins === 'number' ? seasonData.GCoins : 0;
                    if (userGcoins < playerPrice) {
                        displayErrorMessage(playerPopupContent, "Fundos insuficientes.");
                        popupBuyButton.disabled = false;
                        popupBuyButton.textContent = 'Comprar';
                        return;
                    }
                    if (!gCoinsField) {
                        displayErrorMessage(playerPopupContent, "Não foi possível determinar a época para a transação.");
                        popupBuyButton.disabled = false;
                        popupBuyButton.textContent = 'Comprar';
                        return;
                    }

                    popupBuyButton.textContent = 'Processando...';
                    const currentSeason = compactSeason(mostRecentSeason);

                    try {
                        await setDoc(playerDocRefPopup, {
                            [mostRecentSeason]: {
                                compradopor: auth.currentUser.uid,
                                dataCompra: Timestamp.now()
                            },
                            compradopor: auth.currentUser.uid,
                            dataCompra: Timestamp.now()
                        }, { merge: true });
                    } catch (error) {
                        console.error("ERRO CRÍTICO AO ATUALIZAR O JOGADOR:", error);
                        displayErrorMessage(playerPopupContent, "Falha na Etapa 1: Atualizar jogador.");
                        popupBuyButton.disabled = false;
                        popupBuyButton.textContent = 'Comprar';
                        return;
                    }

                    try {
                        await addDoc(collection(db, 'movimentos'), {
                            userId: auth.currentUser.uid,
                            jogadorId: checkPlayerData.id,
                            posicao: checkPlayerData.posicao,
                            preco: playerPrice,
                            estado: "Comprado",
                            valorreal: -playerPrice,
                            de: auth.currentUser.uid,
                            para: null,
                            mediapontos: null,
                            movimentoData: Timestamp.now(),
                            temporada: currentSeason,
                            tipo: "Mercado",
                            descricao: `Comprado por ${userData.nometabela || userData.nomeDeUsuario || 'Utilizador'}`
                        });
                    } catch (error) {
                        console.error("ERRO CRÍTICO AO CRIAR O MOVIMENTO:", error);
                        displayErrorMessage(playerPopupContent, "Falha na Etapa 2: Registar movimento.");
                        popupBuyButton.disabled = false;
                        popupBuyButton.textContent = 'Tentar Novamente';
                        return;
                    }

                    const movimentosRef = collection(db, 'movimentos');
                    const q = query(movimentosRef, where('userId', '==', auth.currentUser.uid), where('temporada', '==', currentSeason));
                    const movimentosSnap = await getDocs(q);

                    let totalValorReal = 0;

                    // --- APLICAÇÃO DA LÓGICA CORRETA ---
                    movimentosSnap.forEach((movDoc) => {
                        const data = movDoc.data();
                        // Apenas somar se o estado NÃO for 'WhoWins Paid'
                        if (data?.estado !== 'WhoWins Paid') {
                            totalValorReal += data?.valorreal || 0;
                        }
                    });

                    // Agora o saldo será atualizado com o valor correto
                    await updateDoc(userRef, {
                        [mostRecentSeason]: {
                            ...seasonData,
                            [gCoinsField]: totalValorReal
                        }
                    });

                    displaySuccessMessage(playerPopupContent, "Jogador comprado com sucesso!");

                } catch (geralError) {
                    console.error("Erro geral na verificação antes da compra:", geralError);
                    displayErrorMessage(playerPopupContent, "Ocorreu um erro inesperado. Tente novamente.");
                    popupBuyButton.disabled = false;
                    popupBuyButton.textContent = 'Comprar';
                }
            };

            setTimeout(() => {
                card.classList.remove('card-loading');
                popup.classList.add('active');
            }, 500);

        } catch (error) {
            console.error("Error preparing player popup:", error);
            card.classList.remove('card-loading');
            alert("Erro ao carregar detalhes do jogador.");
        }
    });

    return card;
}

/**
 * Loads player data from Firestore and populates the market grids.
 */
async function loadPlayers() {
    let playersLoadedCount = 0;
    let totalMarketPlayers = 0;
    const progressStart = 40;
    const progressForPlayers = 55;

    try {
        updateLoadingProgress(5);
        
        // Obter a temporada mais recente
        const seasonsList = await fetchUniqueSeasons(db);
        const mostRecentSeason = seasonsList[0] || '2025/2026';
        const defaultBaseSeason = seasonsList[seasonsList.length - 1] || '2025/2026';

        const jogadoresRef = collection(db, 'jogadores');
        const snapshot = await getDocs(jogadoresRef);
        updateLoadingProgress(10);

        const castaOrder = {
            'Jogador Platina': 4,
            'Jogador Ouro': 3,
            'Jogador Prata': 2,
            'Jogador Bronze': 1
        };

        // Filtrar apenas os jogadores com ficha na temporada mais recente E noMercado == true
        const marketPlayers = [];
        snapshot.docs.forEach(docSnap => {
            const rawData = docSnap.data();
            if (hasPlayerDataForSeason(rawData, mostRecentSeason, defaultBaseSeason)) {
                const sData = getPlayerSeasonData(rawData, mostRecentSeason);
                if (sData && sData.noMercado === true) {
                    marketPlayers.push({
                        id: docSnap.id,
                        ...sData
                    });
                }
            }
        });

        marketPlayers.sort((a, b) => {
            const rankA = castaOrder[a.casta] || 0;
            const rankB = castaOrder[b.casta] || 0;
            if (rankA !== rankB) {
                return rankB - rankA;
            }
            const overallA = a.overall || 0;
            const overallB = b.overall || 0;
            return overallB - overallA;
        });

        const playersGrids = {
            'Guarda-Redes': document.getElementById('guarda-redes-grid'),
            'Defesa': document.getElementById('defesas-grid'),
            'Médio': document.getElementById('medios-grid'),
            'Avançado': document.getElementById('avancados-grid')
        };
        Object.values(playersGrids).forEach(grid => {
            if (grid) grid.innerHTML = '';
        });

        totalMarketPlayers = marketPlayers.length;
        const marketContent = document.querySelector('.content');
        const existingMsg = marketContent?.querySelector('.no-players-message');

        if (totalMarketPlayers === 0) {
            if (marketContent && !existingMsg) {
                const noPlayersMsg = document.createElement('p');
                noPlayersMsg.textContent = "Nenhum jogador no mercado neste momento.";
                noPlayersMsg.className = 'no-players-message';
                noPlayersMsg.style.textAlign = 'center';
                noPlayersMsg.style.marginTop = '30px';
                marketContent.appendChild(noPlayersMsg);
            }
            updateLoadingProgress(0, progressStart + progressForPlayers);
            return;
        } else {
            if (existingMsg) existingMsg.remove();
        }

        const cardCreationPromises = marketPlayers.map(player => {
            const grid = playersGrids[player.posicao];
            if (grid) {
                return createPlayerCard(player)
                    .then(card => ({
                        grid,
                        card
                    }))
                    .catch(cardError => {
                        console.error(`Failed to create card for player ${player.id}:`, cardError);
                        return null;
                    });
            } else {
                console.warn(`No grid found for position: ${player.posicao}`);
                return Promise.resolve(null);
            }
        });

        const results = await Promise.all(cardCreationPromises);
        results.forEach(result => {
            if (result?.card && result?.grid) {
                result.grid.appendChild(result.card);
            }
            playersLoadedCount++;
            const currentPlayerProgress = progressStart + Math.floor((playersLoadedCount / totalMarketPlayers) * progressForPlayers);
            updateLoadingProgress(0, currentPlayerProgress);
        });

        updateSectionCounts();
        setupSectionToggles();

    } catch (error) {
        console.error("Error loading players:", error);
        updateLoadingProgress(0, 100);
    } finally {
        if (loadingProgress < 100) updateLoadingProgress(0, 100);
    }
}

/**
 * Sets up event listeners for section title toggles and the main toggle button.
 */
function setupSectionToggles() {
    const toggleButton = document.getElementById('toggleAllSections');
    if (!toggleButton) return;

    const openSpan = toggleButton.querySelector('.toggle-open');
    const closeSpan = toggleButton.querySelector('.toggle-close');

    const updateToggleButtonState = () => {
        const allTitles = document.querySelectorAll('.section-title');
        if (allTitles.length === 0) return;
        const allCollapsed = Array.from(allTitles).every(t => t.classList.contains('collapsed'));
        toggleButton.classList.toggle('active', allCollapsed);
        if (openSpan) openSpan.classList.toggle('active', !allCollapsed);
        if (closeSpan) closeSpan.classList.toggle('active', allCollapsed);
    };

    function toggleAllSections(collapse) {
        document.querySelectorAll('.section-title').forEach(title => {
            const grid = title.parentElement?.querySelector('.players-grid');
            if (grid) {
                title.classList.toggle('collapsed', collapse);
                grid.classList.toggle('collapsed', collapse);
            }
        });
        updateToggleButtonState();
    }

    if (!toggleButton.dataset.listenerAttached) {
        toggleButton.addEventListener('click', () => {
            const shouldCollapse = !toggleButton.classList.contains('active');
            toggleAllSections(shouldCollapse);
        });
        toggleButton.dataset.listenerAttached = 'true';
    }

    document.querySelectorAll('.section-title').forEach(title => {
        if (!title.dataset.listenerAttached) {
            title.addEventListener('click', () => {
                const grid = title.parentElement?.querySelector('.players-grid');
                if (grid) {
                    const isCollapsing = !title.classList.contains('collapsed');
                    title.classList.toggle('collapsed', isCollapsing);
                    grid.classList.toggle('collapsed', isCollapsing);
                    updateToggleButtonState();
                }
            });
            title.dataset.listenerAttached = 'true';
        }
    });

    toggleAllSections(true);
}

/**
 * Updates the market countdown timer and popup.
 */
async function initializeMarketCountdown() {
    const container = document.getElementById('countdown-container');
    const labelEl = document.getElementById('countdown-label');
    const timerEl = document.getElementById('countdown-timer');
    const schedulesListEl = document.getElementById('upcomingSchedulesList');

    if (countdownInterval) clearInterval(countdownInterval);

    try {
        const schedulesRef = collection(db, 'paineis', 'Banca', 'horarioMercado');
        const snapshot = await getDocs(schedulesRef);

        if (snapshot.empty) {
            container.style.display = 'none';
            return;
        }

        const agora = new Date();
        const futureWindows = [];
        let currentWindow = null;

        snapshot.forEach(doc => {
            const schedule = doc.data();
            const abertura = schedule.abertura.toDate();
            const fechamento = schedule.fechamento.toDate();

            if (agora >= abertura && agora <= fechamento) {
                currentWindow = schedule;
            } else if (abertura > agora) {
                futureWindows.push(schedule);
            }
        });

        futureWindows.sort((a, b) => a.abertura.toDate() - b.abertura.toDate());

        if (futureWindows.length > 0) {
            const dateFormatOptions = {
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit', 
                minute: '2-digit' 
            };

            schedulesListEl.innerHTML = futureWindows.map(win => {
                const aberturaFormatada = win.abertura.toDate().toLocaleString('pt-PT', dateFormatOptions);
                const fechamentoFormatado = win.fechamento.toDate().toLocaleString('pt-PT', dateFormatOptions);
                
                const tituloMercado = win.observacoes.charAt(0).toUpperCase() + win.observacoes.slice(1);

                return `
                    <div class="schedule-item">
                        <p style="font-size: 16px; font-weight: bold; color: #2176ff; margin-bottom: 8px;">
                           Mercado: ${tituloMercado}
                        </p>
                        <p><strong>Abre:</strong> ${aberturaFormatada.replace(',', ' às')}</p>
                        <p><strong>Fecha:</strong> ${fechamentoFormatado.replace(',', ' às')}</p>
                    </div>
                `;
            }).join('');
        } else {
            schedulesListEl.innerHTML = '<p>Não há mais janelas de mercado agendadas.</p>';
        }

        if (currentWindow) {
            labelEl.textContent = 'O Mercado está:';
            timerEl.textContent = 'ABERTO';
            timerEl.classList.add('open');
            container.style.display = 'flex';
        } else if (futureWindows.length > 0) {
            const nextMarket = futureWindows[0];
            labelEl.textContent = 'Próximo Mercado Abre Em:';
            timerEl.classList.remove('open');
            container.style.display = 'flex';

            countdownInterval = setInterval(() => {
                const now = new Date().getTime();
                const distance = nextMarket.abertura.toDate().getTime() - now;

                if (distance < 0) {
                    clearInterval(countdownInterval);
                    timerEl.textContent = 'ABRINDO...';
                    setTimeout(initializeMarketCountdown, 2000);
                    return;
                }

                const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                timerEl.textContent =
                    `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            }, 1000);
        } else {
            container.style.display = 'none';
        }

    } catch (error) {
        console.error("Erro ao inicializar o cronómetro do mercado:", error);
        container.style.display = 'none';
    }
}

// --- Loading Progress ---
let loadingProgress = 0;
const loadingPercentageElement = document.querySelector('.loading-percentage');
const progressBar = document.querySelector('.progress-bar');
let hideLoadingTimerId = null;

/**
 * Updates loading progress, hides screen after delay at 100%.
 */
function updateLoadingProgress(increment = 0, absoluteValue = null) {
    if (typeof hideLoadingTimerId === 'number' && loadingProgress >= 100) return;

    if (absoluteValue !== null) loadingProgress = absoluteValue;
    else loadingProgress += increment;
    loadingProgress = Math.max(0, Math.min(100, loadingProgress));

    const displayPercentage = Math.floor(loadingProgress);
    if (loadingPercentageElement) loadingPercentageElement.textContent = `${displayPercentage}%`;
    if (progressBar) progressBar.style.width = `${loadingProgress}%`;

    if (loadingProgress >= 100 && typeof hideLoadingTimerId !== 'number') {
        hideLoadingTimerId = window.setTimeout(() => {
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (content) content.style.display = 'block';
        }, 1500);
    }
}

// --- Menu Management ---

/**
 * Loads menu visibility settings from Firestore.
 */
async function loadMenuSettings() {
    try {
        const menuSettingsDocRef = doc(db, 'paineis', 'paineis menu');
        const docSnap = await getDoc(menuSettingsDocRef);
        if (docSnap.exists()) return docSnap.data();
        console.warn("Menu settings document ('paineis/paineis menu') not found.");
        return null;
    } catch (error) {
        console.error('Erro ao carregar configurações do menu:', error);
        return null;
    }
}

/**
 * Checks page access based on status and menu settings. Redirects if denied.
 */
function checkPageAccess(userEstatuto, menuSettings) {
    const marketSetting = menuSettings?.market || 'off';
    if (marketSetting !== 'on' && userEstatuto !== 'ruler') {
        if (loadingScreen) loadingScreen.style.display = 'none';
        window.location.href = '404.html';
        return false;
    }
    return true;
}

/**
 * Updates the player counts in the section titles.
 */
function updateSectionCounts() {
    const sections = {
        'guarda-redes-section': { title: 'GUARDA-REDES', icon: '<wa-icon name="mitten"></wa-icon>' },
        'defesas-section': { title: 'DEFESAS', icon: '<wa-icon name="shield"></wa-icon>' },
        'medios-section': { title: 'MÉDIOS', icon: '<wa-icon name="puzzle-piece"></wa-icon>' },
        'avancados-section': { title: 'AVANÇADOS', icon: '<wa-icon name="bullseye"></wa-icon>' }
    };

    for (const [sectionId, info] of Object.entries(sections)) {
        const sectionElement = document.getElementById(sectionId);
        if (sectionElement) {
            const titleElement = sectionElement.querySelector('.section-title');
            const gridElement = sectionElement.querySelector('.players-grid');

            if (titleElement && gridElement) {
                const count = gridElement.querySelectorAll('.player-card').length;
                titleElement.innerHTML = `${info.icon} ${info.title} (${count})`;
            }
        }
    }
}

// --- Filtering, Sorting and Coins logic ---
async function loadUserGcoins(userId) {
    if (!userId) return;
    try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const latestSeason = await getLatestSeason(db);
            const seasonData = getSeasonData(userData, latestSeason);
            const userGcoins = typeof seasonData.GCoins === 'number' ? seasonData.GCoins : 0;
            const coinValEl = document.getElementById('user-gcoins-value');
            if (coinValEl) {
                coinValEl.textContent = userGcoins.toLocaleString('pt-PT');
            }
        }
    } catch (e) {
        console.error("Error loading user gcoins:", e);
    }
}

async function populateCountryFilter() {
    const countryFilter = document.getElementById('country-filter');
    if (!countryFilter) return;
    try {
        const snapshot = await getDocs(collection(db, 'paises'));
        const countriesList = [];
        snapshot.forEach(doc => {
            countriesList.push({ id: doc.id, ...doc.data() });
        });
        countriesList.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        
        countryFilter.innerHTML = '<option value="">Todas</option>';
        countriesList.forEach(country => {
            const option = document.createElement('option');
            option.value = country.id;
            option.textContent = country.nome;
            countryFilter.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating country filter:", error);
    }
}

function filterAndSortPlayers() {
    const searchVal = document.getElementById('player-search')?.value.toLowerCase() || '';
    const countryVal = document.getElementById('country-filter')?.value || '';
    const sortVal = document.getElementById('sort-filter')?.value || 'overall-desc';
    const availableVal = document.getElementById('available-only-toggle')?.checked || false;

    const cards = Array.from(document.querySelectorAll('.player-card'));
    
    cards.forEach(card => {
        const name = card.querySelector('.player-name')?.textContent.toLowerCase() || '';
        const isPurchased = card.querySelector('.buy-button')?.classList.contains('purchased') || false;
        const paisId = card.dataset.paisId || '';

        const matchesSearch = name.includes(searchVal);
        const matchesCountry = !countryVal || paisId === countryVal;
        const matchesAvailable = !availableVal || !isPurchased;

        if (matchesSearch && matchesCountry && matchesAvailable) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });

    const grids = document.querySelectorAll('.players-grid');
    grids.forEach(grid => {
        const visibleCards = Array.from(grid.querySelectorAll('.player-card'));
        visibleCards.sort((a, b) => {
            const overallA = parseInt(a.querySelector('.stat-column:first-child .stat-value')?.textContent) || 0;
            const overallB = parseInt(b.querySelector('.stat-column:first-child .stat-value')?.textContent) || 0;
            
            const priceA = parseFloat(a.querySelector('.stat-value.price')?.textContent) || 0;
            const priceB = parseFloat(b.querySelector('.stat-value.price')?.textContent) || 0;
            
            const nameA = a.querySelector('.player-name')?.textContent.toLowerCase() || '';
            const nameB = b.querySelector('.player-name')?.textContent.toLowerCase() || '';

            if (sortVal === 'overall-desc') {
                return overallB - overallA;
            } else if (sortVal === 'price-asc') {
                return priceA - priceB;
            } else if (sortVal === 'price-desc') {
                return priceB - priceA;
            } else if (sortVal === 'name-asc') {
                return nameA.localeCompare(nameB);
            }
            return 0;
        });

        visibleCards.forEach(card => grid.appendChild(card));
    });

    updateSectionCounts();
}

// --- Initialization and Auth Handling ---

onAuthStateChanged(auth, async (user) => {
    try {
        if (user) {
            updateLoadingProgress(10);
            currentUserEstatuto = await getUserEstatuto(user.uid);
            updateLoadingProgress(10);

            try {
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, {
                    ultimoacesso: serverTimestamp()
                });
            } catch (error) {
                console.error("Erro ao atualizar o campo ultimoacesso: ", error);
            }

            if (currentUserEstatuto !== null) {
                const menuSettings = await loadMenuSettings();
                updateLoadingProgress(10);

                if (!checkPageAccess(currentUserEstatuto, menuSettings)) return;
                updateLoadingProgress(10);

                await logUserAction(`Entrou em ${document.title}`);

                const transactionButton = document.getElementById('transaction-button-link');
                if (transactionButton && menuSettings?.bank === 'off') {
                    transactionButton.style.display = 'none';
                }

                if (window.updateMenuVisibility) {
                    window.updateMenuVisibility(menuSettings);
                }

                initializeMarketCountdown();

                await loadPlayers();
                await loadUserGcoins(user.uid);
                await populateCountryFilter();

            } else {
                if (loadingScreen) loadingScreen.style.display = 'none';
                window.location.href = '404.html';
                return;
            }
        } else {
            if (loadingScreen) loadingScreen.style.display = 'none';
            window.location.href = '404.html';
            return;
        }
        updateLoadingProgress(0, 100);

    } catch (error) {
        console.error("Erro crítico durante o carregamento inicial:", error);
        if (loadingScreen) loadingScreen.style.display = 'none';
        alert("Ocorreu um erro grave ao carregar a página.");
        window.location.href = '404.html';
    }
});

// --- Event Listeners Setup ---

document.addEventListener('DOMContentLoaded', () => {
    // Player popup logic
    const popup = document.getElementById('playerPopup');
    const closePlayerPopup = document.getElementById('closePlayerPopup');

    const closePopup = () => {
        if (popup) {
            popup.classList.remove('active');

            const playerId = popup.dataset.currentPlayerId; 
            if (playerId) {
                const listenerKey = `popup-${playerId}`;
                const unsubscribeFunc = activeListeners.get(listenerKey); 

                if (typeof unsubscribeFunc === 'function') {
                    unsubscribeFunc(); 
                    activeListeners.delete(listenerKey); 
                }
                delete popup.dataset.currentPlayerId; 
            }

            clearPopupMessages();
        }
    };

    if (closePlayerPopup) closePlayerPopup.addEventListener('click', closePopup);
    if (popup) popup.addEventListener('click', (e) => {
        if (e.target === popup) closePopup();
    });

    // History popup logic
    const historyPopup = document.getElementById('historyPopup');
    const closeHistoryPopup = document.getElementById('closeHistoryPopup');
    if (closeHistoryPopup) {
        closeHistoryPopup.addEventListener('click', () => {
            if (historyPopup) historyPopup.classList.remove('active');
        });
    }
    if (historyPopup) {
        historyPopup.addEventListener('click', (e) => {
            if (e.target === historyPopup) historyPopup.classList.remove('active');
        });
    }

    // Schedules popup logic
    const countdownContainer = document.getElementById('countdown-container');
    const schedulesPopup = document.getElementById('schedulesPopup');
    const closeSchedulesPopup = document.getElementById('closeSchedulesPopup');

    if (countdownContainer) {
        countdownContainer.addEventListener('click', () => {
            schedulesPopup.classList.add('active');
        });
    }

    if (closeSchedulesPopup) {
        closeSchedulesPopup.addEventListener('click', () => {
            schedulesPopup.classList.remove('active');
        });
    }

    if (schedulesPopup) {
        schedulesPopup.addEventListener('click', (e) => {
            if (e.target === schedulesPopup) {
                schedulesPopup.classList.remove('active');
            }
        });
    }

    // View mode setup
    function setViewMode(mode) {
        const gridBtn = document.getElementById('view-mode-grid');
        const listBtn = document.getElementById('view-mode-list');
        const grids = document.querySelectorAll('.players-grid');
        
        if (mode === 'list') {
            if (gridBtn) gridBtn.classList.remove('active');
            if (listBtn) listBtn.classList.add('active');
            grids.forEach(grid => grid.classList.add('list-view'));
            localStorage.setItem('marketViewMode', 'list');
        } else {
            if (gridBtn) gridBtn.classList.add('active');
            if (listBtn) listBtn.classList.remove('active');
            grids.forEach(grid => grid.classList.remove('list-view'));
            localStorage.setItem('marketViewMode', 'grid');
        }
    }

    const savedMode = localStorage.getItem('marketViewMode') || 'grid';
    setViewMode(savedMode);

    const gridBtn = document.getElementById('view-mode-grid');
    const listBtn = document.getElementById('view-mode-list');
    if (gridBtn) gridBtn.addEventListener('click', () => setViewMode('grid'));
    if (listBtn) listBtn.addEventListener('click', () => setViewMode('list'));

    // Filter and Sort inputs setup
    const playerSearchInput = document.getElementById('player-search');
    const countryFilterSelect = document.getElementById('country-filter');
    const sortFilterSelect = document.getElementById('sort-filter');
    const availableOnlyToggle = document.getElementById('available-only-toggle');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    const searchToggleContainer = document.querySelector('.search-toggle-container');

    if (searchToggleBtn && searchToggleContainer && playerSearchInput) {
        searchToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = searchToggleContainer.classList.toggle('active');
            if (isActive) {
                playerSearchInput.focus();
            } else {
                if (playerSearchInput.value !== '') {
                    playerSearchInput.value = '';
                    filterAndSortPlayers();
                }
            }
        });

        // Close search bar if clicking outside it when it's empty
        document.addEventListener('click', (e) => {
            if (!searchToggleContainer.contains(e.target) && playerSearchInput.value === '') {
                searchToggleContainer.classList.remove('active');
            }
        });
    }

    if (playerSearchInput) playerSearchInput.addEventListener('input', filterAndSortPlayers);
    if (countryFilterSelect) countryFilterSelect.addEventListener('change', filterAndSortPlayers);
    if (sortFilterSelect) sortFilterSelect.addEventListener('change', filterAndSortPlayers);
    if (availableOnlyToggle) availableOnlyToggle.addEventListener('change', filterAndSortPlayers);

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (playerSearchInput) playerSearchInput.value = '';
            if (countryFilterSelect) countryFilterSelect.value = '';
            if (sortFilterSelect) sortFilterSelect.value = 'overall-desc';
            if (availableOnlyToggle) availableOnlyToggle.checked = false;
            if (searchToggleContainer) searchToggleContainer.classList.remove('active');
            filterAndSortPlayers();
        });
    }
});

window.addEventListener('beforeunload', () => {
    for (const unsubscribeFunc of activeListeners.values()) {
        if (typeof unsubscribeFunc === 'function') {
            try {
                unsubscribeFunc();
            } catch (e) {
                console.error("Erro ao desativar listener:", e);
            }
        }
    }
    activeListeners.clear(); 
});

document.addEventListener('click', async (event) => {
    const clickableElement = event.target.closest('.player-card, .section-title, .toggle-all-button, #countdown-container, a.transaction-button, .popup-button');

    if (!clickableElement) {
        return; 
    }

    let actionName = '';
    if (clickableElement.classList.contains('player-card')) {
        const playerName = clickableElement.querySelector('.player-name')?.textContent.trim();
        actionName = `Abriu detalhes de ${playerName || 'jogador'}`;
    } else if (clickableElement.classList.contains('popup-button')) {
        const buttonText = clickableElement.textContent.trim();
        const popupPlayerName = document.getElementById('popupPlayerName')?.textContent.trim();
        actionName = `Clicou em '${buttonText}' no popup de ${popupPlayerName || 'jogador'}`;
    } else if (clickableElement.id === 'transaction-button-link') {
        actionName = 'Clicou em Transações';
    } else {
        actionName = `Clicou em: ${clickableElement.textContent.trim().replace(/\s+/g, ' ')}`;
    }

    if (!actionName) return;

    const isNavLink = clickableElement.tagName === 'A' && clickableElement.href && clickableElement.target !== '_blank';

    if (isNavLink) {
        event.preventDefault();
        await logUserAction(actionName);
        window.location.href = clickableElement.href;
    } else {
        await logUserAction(actionName);
    }
});
