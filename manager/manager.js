// manager/manager.js
import { db, auth } from '../core/firebase.js';
import { getDoc, doc, collection, query, where, getDocs, updateDoc, runTransaction, serverTimestamp, writeBatch, orderBy, addDoc, arrayUnion, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

console.log("Manager Page Script: Module loading initiated.");

// --- Global State Variables ---
let currentUser = null; // Stores { uid, estatuto, mentalidade, estadio, data: fullUserData }
let selectedMentalidade = null; // For mentalidade choice flow
let selectedStadiumForPurchase = null; // For stadium purchase flow
let selectedItemForPurchase = null; // For item purchase flow
let managerParentItemIds = null;
let isProcessingPurchase = false; // Flag para prevenir cliques duplos na compra de itens
let isShowingOtherManagers = false;

// --- Utility Functions ---

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

/** Fetches user status and essential data */
async function getUserStatus(userId) {
    console.log(`getUserStatus: Fetching status for user ID: ${userId}`);
    if (!userId) { console.error("getUserStatus: No userId provided."); return null; }
    const userDocRef = doc(db, 'users', userId);
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists() && docSnap.data().aceite === "Yes") {
            const userData = docSnap.data();
            const status = { uid: userId, estatuto: userData.estatuto, mentalidade: userData.mentalidade || null, estadio: userData.estadio || null, data: userData };
            console.log("getUserStatus: User found and accepted.", status); return status;
        } else if (docSnap.exists()) {
            console.log(`getUserStatus: User document found but not accepted (aceite != "Yes").`, docSnap.data()); return null;
        } else {
            console.log(`getUserStatus: User document not found for ${userId}.`); return null;
        }
    } catch (error) { console.error(`getUserStatus: Error fetching user document for ${userId}:`, error); return null; }
}

/** Shows a simple informational popup */
function showInfoPopup(title, message, persistent = false) {
    console.log(`showInfoPopup: Title: "${title}", Message: "${message}", Persistent: ${persistent}`);
    const popup = document.getElementById('info-popup');
    const titleEl = document.getElementById('info-popup-title');
    const msgEl = document.getElementById('info-popup-message');
    const okButton = popup?.querySelector('.popup-button');

    if (popup && titleEl && msgEl && okButton) {
        titleEl.textContent = title;
        msgEl.innerHTML = message;
        okButton.style.display = persistent ? 'none' : 'flex';
        popup.classList.add('active');
    } else {
        console.error("showInfoPopup: Info popup elements (popup, title, message, or button) not found.");
    }
}

/** Closes the simple informational popup */
function closeInfoPopup() {
    console.log("closeInfoPopup: Closing info popup."); const popup = document.getElementById('info-popup'); if (popup) popup.classList.remove('active');
}

/** Updates the loading screen progress */
function updateLoadingProgress(percentage) {
    const percEl = document.querySelector('.loading-percentage'); const barEl = document.querySelector('.progress-bar'); if (percEl) percEl.textContent = `${Math.round(percentage)}%`; if (barEl) barEl.style.width = `${percentage}%`;
}

/** Hides the loading screen */
function hideLoadingScreen() {
    console.log("hideLoadingScreen: Attempting to hide loading screen."); const loadingScreen = document.getElementById('loading-screen'); if (loadingScreen && loadingScreen.style.display !== 'none') { loadingScreen.style.opacity = '0'; setTimeout(() => { const currentLoadingScreen = document.getElementById('loading-screen'); if (currentLoadingScreen) currentLoadingScreen.style.display = 'none'; console.log("hideLoadingScreen: Loading screen hidden via display: none."); }, 500); } else if (!loadingScreen) { console.warn("hideLoadingScreen: Loading screen element not found."); } else { console.log("hideLoadingScreen: Loading screen already hidden or hiding."); }
}

/** Fetches global menu visibility settings */
async function getMenuSettings() {
    console.log("getMenuSettings: Fetching menu settings..."); const paineisMenuRef = doc(db, 'paineis', 'paineis menu'); try { const docSnap = await getDoc(paineisMenuRef); const settings = docSnap.exists() ? docSnap.data() : null; console.log("getMenuSettings: Settings fetched:", settings); return settings; } catch (error) { console.error("getMenuSettings: Error fetching menu settings:", error); return null; }
}

/** Checks if the user has access to this page */
async function checkPageAccess(userStatus, menuSettings) {
    console.log("checkPageAccess: A verificar acesso para:", userStatus, "com as configurações:", menuSettings);

    // REGRA 1 (PRIORIDADE MÁXIMA): Acesso de Administrador ('ruler')
    if (userStatus && userStatus.estatuto === 'ruler') {
        console.log("Acesso Concedido: O utilizador é um 'ruler'.");
        return true;
    }

    // CONDIÇÃO A: O "interruptor" global no painel de controlo deve estar ligado.
    const globalAccessOn = menuSettings && menuSettings['manager'] === 'on';

    // CONDIÇÃO B (NOVA REGRA): O utilizador deve ter a permissão específica no seu perfil.
    const hasIndividualPermission = userStatus?.data?.permissoes?.manager === 'yes';

    // A função retorna 'true' apenas se a Condição A E a Condição B forem verdadeiras.
    if (globalAccessOn && hasIndividualPermission) {
        console.log("Acesso Concedido: Permissões globais e individuais satisfeitas.");
        return true;
    } else {
        // Se uma ou ambas as condições falharem, o acesso é negado.
        console.log(`Acesso Negado. Status: Global=${globalAccessOn}, Individual=${hasIndividualPermission}`);
        window.location.href = '404.html';
        return false;
    }
}

async function getLatestSeason() {
    console.log("getLatestSeason: Fetching seasons from 'jogos' collection..."); const jogosCollectionRef = collection(db, 'jogos'); const fieldNameHoldingSeasonString = 'temporada'; try { const querySnapshot = await getDocs(jogosCollectionRef); let latestSeasonVal = "0"; let latestFormattedSeason = null; querySnapshot.forEach((doc) => { const gameData = doc.data(); const seasonString = gameData[fieldNameHoldingSeasonString]; if (seasonString && typeof seasonString === 'string') { const parts = seasonString.split('/'); if (parts.length === 2 && parts[0].length === 4 && parts[1].length === 4 && !isNaN(parts[0]) && !isNaN(parts[1])) { const startYear = parts[0]; const endYear = parts[1]; const sortableVal = endYear; const formatted = startYear + endYear; if (sortableVal > latestSeasonVal) { latestSeasonVal = sortableVal; latestFormattedSeason = formatted; } } else { console.warn(`getLatestSeason: Invalid season string format: "${seasonString}" in doc ${doc.id}`); } } }); if (latestFormattedSeason) { console.log("getLatestSeason: Latest season determined:", latestFormattedSeason); return latestFormattedSeason; } else { console.error("getLatestSeason: Could not determine latest season from 'jogos'."); return null; } } catch (error) { console.error("getLatestSeason: Error fetching documents from 'jogos':", error); return null; }
}

function daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000; const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate()); const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate()); return Math.round(Math.abs((d1.getTime() - d2.getTime()) / oneDay));
}
function findFirstDayOfWeekInYear(year, targetDayIndex) {
    const date = new Date(year, 0, 1); while (date.getDay() !== targetDayIndex) { date.setDate(date.getDate() + 1); if (date.getFullYear() !== year) return null; } return date;
}

async function loadManagerParentMap() {
    if (managerParentItemIds !== null) {
        console.log("loadManagerParentMap: Mapa de pais já está em cache. A saltar a leitura da BD.");
        return;
    }
    console.log("loadManagerParentMap: Primeira chamada. A ler a BD para construir o mapa de pais...");
    try {
        const allItemsSnapshot = await getDocs(collection(db, 'managerItens'));
        const parentIds = new Set();
        allItemsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.anexadoItemId) {
                parentIds.add(data.anexadoItemId);
            }
        });
        managerParentItemIds = parentIds;
        console.log(`loadManagerParentMap: Mapa construído. ${managerParentItemIds.size} itens pais encontrados.`);
    } catch (error) {
        console.error("loadManagerParentMap: Falha ao construir o mapa de pais:", error);
        managerParentItemIds = new Set();
    }
}

function setPageBackground(imageUrl, opacity = 1) {
    const existingBg = document.getElementById('dynamic-page-background');
    if (existingBg) {
        existingBg.remove();
    }
    if (imageUrl) {
        const backgroundDiv = document.createElement('div');
        backgroundDiv.id = 'dynamic-page-background';
        Object.assign(backgroundDiv.style, {
            position: 'fixed', top: 0, left: 0,
            width: '100vw', height: '100vh',
            backgroundImage: `url('${imageUrl}')`,
            backgroundSize: 'cover', backgroundPosition: 'center center',
            opacity: opacity, zIndex: '-1', pointerEvents: 'none',
            transition: 'opacity 0.5s ease-in-out'
        });
        document.body.insertBefore(backgroundDiv, document.body.firstChild);
    }
}

function isItemAvailableToday(availabilityRule) {
    if (!availabilityRule || typeof availabilityRule !== 'string' || availabilityRule.trim() === '') {
        return true;
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const year = today.getFullYear(); const dayOfWeek = today.getDay();
    const daysPortuguese = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]; const currentDayName = daysPortuguese[dayOfWeek];
    const ruleTrimmed = availabilityRule.trim();

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(ruleTrimmed)) {
        const parts = ruleTrimmed.split('-');
        const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        targetDate.setHours(0, 0, 0, 0);
        return targetDate.getTime() === today.getTime();
    }

    const isDayNameOnly = daysPortuguese.some(name => name.toLowerCase() === ruleTrimmed.toLowerCase());
    if (isDayNameOnly && !/^\d/.test(ruleTrimmed)) {
        return currentDayName.toLowerCase() === ruleTrimmed.toLowerCase();
    }

    const recurringRegex = /^(\d{1,2})(Domingo|Segunda|Terça|Quarta|Quinta|Sexta|Sábado)$/i; const match = ruleTrimmed.match(recurringRegex);
    if (match) {
        const interval = parseInt(match[1], 10);
        const requiredDayName = match[2];
        const requiredDayIndex = daysPortuguese.findIndex(name => name.toLowerCase() === requiredDayName.toLowerCase());

        if (dayOfWeek !== requiredDayIndex) {
            return false;
        }
        if (interval === 7) {
            return true;
        }
        if (interval > 0 && requiredDayIndex !== -1) {
            const firstOccurrenceDate = findFirstDayOfWeekInYear(year, requiredDayIndex);
            if (!firstOccurrenceDate) { return false; }
            firstOccurrenceDate.setHours(0, 0, 0, 0);
            const daysSinceFirst = daysBetween(firstOccurrenceDate, today);
            return daysSinceFirst % interval === 0;
        } else { return false; }
    }
    return false;
}

// --- Mentalidade Choice Flow Functions ---
async function showPopup(mentalidade) {
    console.log("showPopup (Smart Click): Mostrando popup para a mentalidade:", mentalidade);
    selectedMentalidade = mentalidade;
    const popup = document.getElementById('popup-overlay');
    const popupTitle = popup?.querySelector('.popup-title');
    const itemsGrid = popup?.querySelector('.items-grid');
    const escolherButton = document.getElementById('escolher-mentalidade-btn');

    if (!popup || !popupTitle || !itemsGrid || !escolherButton) return;

    popupTitle.textContent = mentalidade.nome || 'Escolha a Mentalidade';
    itemsGrid.innerHTML = '<p>A carregar itens...</p>';
    escolherButton.style.display = 'inline-block';
    popup.classList.add('active');

    try {
        await loadManagerParentMap();

        const mentalidadeItemsQuery = query(collection(db, 'managerItens'), where('anexadoItemId', '==', mentalidade.id), where('noMercado', '==', true), orderBy('ordem', 'asc'));
        const snapshot = await getDocs(mentalidadeItemsQuery);
        const itemsToDisplay = [];
        snapshot.forEach(doc => itemsToDisplay.push({ id: doc.id, ...doc.data() }));

        itemsGrid.innerHTML = '';
        if (itemsToDisplay.length === 0) {
            itemsGrid.innerHTML = '<p>Nenhum item associado.</p>';
            return;
        }

        itemsToDisplay.forEach((item, itemIndex) => {
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';
            const imageUrl = item.imagem || 'placeholder.png';
            
            let priceHTML = '';
            if (item.valor !== undefined && item.valor !== null) {
                priceHTML = `<div class="item-nota" style="color: #c9a959; font-weight: bold; margin-top: 10px;">${item.valor} GCoins</div>`;
            } else {
                priceHTML = `<div style="min-height: 2.2em;"></div>`;
            }

            itemCard.innerHTML = `
                <img 
                    src="${imageUrl}" 
                    alt="${item.nome || ''}" 
                    class="item-image" 
                    onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0i,#Zk6MDQyIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjIiIHJ5PSIyIj48L3JlY3Q+PGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiPjwvY2lyY2xlPjxwb2x5bGluZSBwb2ludHM9IjIxIDE1IDExIDUgMyAxMyI+PC9wb2x5bGluZT48L3N2Zz4=';"
                >
                <div class="item-name">${item.nome || 'Item'}</div>
                <div class="item-nota">${item.nota || 'N/A'}</div>
                ${priceHTML}
            `;

            if (managerParentItemIds.has(item.id)) {
                itemCard.style.cursor = 'pointer';
                itemCard.addEventListener('click', () => window.showNestedPopup(item));
            } else {
                itemCard.style.cursor = 'default';
            }

            itemsGrid.appendChild(itemCard);
            requestAnimationFrame(() => {
                setTimeout(() => itemCard.classList.add('visible'), itemIndex * 100);
            });
        });
    } catch (error) {
        console.error(`showPopup: Erro ao obter itens para a mentalidade ${mentalidade.id}:`, error);
        itemsGrid.innerHTML = '<p style="color:red;">Erro ao carregar itens.</p>';
    }
}

function closePopup() {
    console.log("closePopup: Closing mentalidade selection popup."); const popup = document.getElementById('popup-overlay'); if (popup) popup.classList.remove('active'); selectedMentalidade = null;
}
function showConfirmation() {
    if (!selectedMentalidade) { console.warn("showConfirmation called without selectedMentalidade."); return; } console.log("showConfirmation: Showing mentalidade confirmation for:", selectedMentalidade); const popup = document.getElementById('confirmation-popup'); if (popup) popup.classList.add('active');
}
function closeConfirmation() {
    console.log("closeConfirmation: Closing mentalidade confirmation popup."); const popup = document.getElementById('confirmation-popup'); if (popup) popup.classList.remove('active');
}
async function confirmChoice(confirmed) {
    console.log(`confirmChoice: User action - confirmed: ${confirmed}`); closeConfirmation(); if (!confirmed) { console.log("confirmChoice: Choice cancelled."); return; } if (!selectedMentalidade || !currentUser) { console.error("confirmChoice: Missing mentalidade or user data."); showInfoPopup("Erro", "Dados em falta."); return; } showInfoPopup("Processando...", "A gravar..."); try { const userDocRef = doc(db, 'users', currentUser.uid); await updateDoc(userDocRef, { mentalidade: selectedMentalidade.id }); console.log('confirmChoice: User mentalidade updated.'); try { const latestSeason = await getLatestSeason(); if (latestSeason) { const precoMentalidade = selectedMentalidade.valor ?? 0; const valorRealMentalidade = -precoMentalidade; const movimentoData = { estado: "Escolhido", itemManager: selectedMentalidade.nome || "?", temporada: latestSeason, movimentoData: serverTimestamp(), preco: precoMentalidade, tipo: "Manager", userId: currentUser.uid, valorreal: valorRealMentalidade, managerTipo: selectedMentalidade.tipo || "Mentalidade", nivel: selectedMentalidade.nivel || 'Nível 1' }; console.log("confirmChoice: Creating movement data:", movimentoData); const movRef = await addDoc(collection(db, 'movimentos'), movimentoData); console.log("confirmChoice: Movement record created:", movRef.id); } else { console.warn("confirmChoice: No season. Skipping movement."); } } catch (movError) { console.error("confirmChoice: Error creating movement:", movError); showInfoPopup("Aviso", "Escolha salva, erro no registo."); await new Promise(resolve => setTimeout(resolve, 1500)); } console.log('confirmChoice: Refreshing page...'); closePopup(); closeInfoPopup(); location.reload(); } catch (error) { console.error('confirmChoice: Error updating user:', error); closeInfoPopup(); showInfoPopup('Erro', 'Falha ao salvar. Tente novamente.'); }
}

// --- Nested Item Popup Logic ---
async function showNestedPopup(parentItem) {
    console.log("showNestedPopup (FINAL COM REGRA PAI): Mostrando popup para:", parentItem);
    if (!parentItem || !parentItem.id) return;

    const nestedPopup = document.getElementById('nested-popup');
    const popupTitle = nestedPopup?.querySelector('.popup-title');
    const itemsGrid = nestedPopup?.querySelector('.items-grid');
    if (!nestedPopup || !popupTitle || !itemsGrid) return;

    popupTitle.textContent = `Itens anexados a: ${parentItem.nome || 'Item'}`;
    itemsGrid.innerHTML = '<p>A carregar itens...</p>';
    nestedPopup.classList.add('active');

    try {
        await loadManagerParentMap();
        let userHasBoughtToday = false;
        let ownedItemNamesSet = new Set();
        let ownedTypeLevelSet = new Set();
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(todayStart.getDate() + 1);

        const dailyPurchaseQuery = query(collection(db, 'movimentos'), where('userId', '==', currentUser.uid), where('tipo', '==', 'Manager'), where('movimentoData', '>=', todayStart), where('movimentoData', '<', tomorrowStart), limit(1));
        const ownedItemsQuery = query(collection(db, 'movimentos'), where('userId', '==', currentUser.uid), where('tipo', '==', 'Manager'));
        const [dailyPurchaseSnapshot, ownedItemsSnapshot] = await Promise.all([getDocs(dailyPurchaseQuery), getDocs(ownedItemsQuery)]);

        userHasBoughtToday = !dailyPurchaseSnapshot.empty;
        ownedItemsSnapshot.forEach(doc => {
            const movData = doc.data();
            if (movData.itemManager) ownedItemNamesSet.add(movData.itemManager);
            if (movData.managerTipo && movData.nivel) ownedTypeLevelSet.add(`${movData.managerTipo}:${movData.nivel}`);
        });

        const itemsQuery = query(collection(db, 'managerItens'), where('anexadoItemId', '==', parentItem.id), where('noMercado', '==', true), orderBy('ordem', 'asc'));
        const snapshot = await getDocs(itemsQuery);

        const itemsToDisplay = [];
        snapshot.forEach(doc => itemsToDisplay.push({ id: doc.id, ...doc.data() }));

        itemsGrid.innerHTML = '';
        if (itemsToDisplay.length === 0) {
            itemsGrid.innerHTML = '<p>Nenhum item anexado.</p>';
            return;
        }

        itemsToDisplay.forEach((item, itemIndex) => {
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';

            const isOwned = ownedItemNamesSet.has(item.nome);
            const isAvailableToday = isItemAvailableToday(item.diaDisponivel || item.dataMercado);
            let needsLevel1 = item.nivel === 'Nível 2';
            let hasLevel1 = needsLevel1 ? ownedTypeLevelSet.has(`${item.tipo}:Nível 1`) : true;
            const isPurchasable = item.valor !== undefined && item.valor !== null;
            const hasParentItem = ownedItemNamesSet.has(parentItem.nome);
            const isDisabled = isOwned || !isAvailableToday || userHasBoughtToday || (needsLevel1 && !hasLevel1) || !isPurchasable || !hasParentItem;

            let disabledReason =
                !hasParentItem ? `Requer: ${parentItem.nome}` :
                (isOwned ? 'Já Possuído' :
                (userHasBoughtToday ? 'Limite Diário Atingido' :
                (!isAvailableToday ? 'Indisponível Hoje' :
                (needsLevel1 && !hasLevel1 ? 'Requer Nível 1' :
                (!isPurchasable ? 'Não está à venda' : '')))));

            const purchaseBlockHTML = isPurchasable ? `
                <div class="item-nota" style="color: #c9a959; font-weight: bold; margin-bottom: 10px;">${item.valor} GCoins</div>
                <button class="popup-button buy-item-btn" style="padding: 5px 10px; font-size: 14px;" ${isDisabled ? 'disabled' : ''}>Comprar</button>
                <span class="disabled-reason">${disabledReason}</span>
            ` : `<div style="min-height: 4.5em;"></div>`;

            itemCard.innerHTML = `
                <img src="${item.imagem || 'placeholder.png'}" alt="${item.nome || ''}" class="item-image">
                <div class="item-name">${item.nome || 'Item'}</div>
                <div class="item-nota" style="min-height: 2em; margin-bottom: 8px;">${item.nota || '...'}</div>
                ${purchaseBlockHTML}
            `;

            if (!isDisabled && isPurchasable) {
                const buyButton = itemCard.querySelector('.buy-item-btn');
                if (buyButton) buyButton.onclick = (event) => { event.stopPropagation(); initiateItemPurchase(item); };
            }

            const hasChildren = managerParentItemIds.has(item.id);
            if (hasChildren) {
                itemCard.style.cursor = 'pointer';
                itemCard.addEventListener('click', (event) => {
                    if (event.target.tagName !== 'BUTTON') {
                        window.showNestedPopup(item);
                    }
                });
            } else {
                itemCard.style.cursor = 'default';
            }

            itemsGrid.appendChild(itemCard);
            requestAnimationFrame(() => {
                setTimeout(() => itemCard.classList.add('visible'), itemIndex * 100);
            });
        });
    } catch (error) {
        console.error(`showNestedPopup (FINAL): Erro ao obter itens para ${parentItem.id}:`, error);
        itemsGrid.innerHTML = '<p style="color:red;">Erro ao carregar.</p>';
    }
}

function closeNestedPopup() {
    console.log("closeNestedPopup: Closing nested popup."); const popup = document.getElementById('nested-popup'); if (popup) popup.classList.remove('active');
}

// --- Stadium-Specific Popup Logic ---
async function showStadiumDetailsPopup(stadium) {
    console.log("showStadiumDetailsPopup (Smart Click): Mostrando ITENS ANEXADOS para o estádio:", stadium);
    const popup = document.getElementById('stadium-details-popup');
    const title = popup?.querySelector('.popup-title');
    const itemsGrid = document.getElementById('stadium-attached-items-grid');
    if (!popup || !title || !itemsGrid) return;

    title.textContent = `Itens Anexados a: ${stadium.nome || 'Estádio'}`;
    itemsGrid.innerHTML = '<p>A carregar...</p>';
    popup.classList.add('active');

    try {
        await loadManagerParentMap();

        const attachedItemsQuery = query(collection(db, 'managerItens'), where('anexadoItemId', '==', stadium.id), where('noMercado', '==', true), orderBy('ordem', 'asc'));
        const snapshot = await getDocs(attachedItemsQuery);

        const itemsToDisplay = [];
        snapshot.forEach(doc => itemsToDisplay.push({ id: doc.id, ...doc.data() }));

        itemsGrid.innerHTML = '';
        if (itemsToDisplay.length === 0) {
            itemsGrid.innerHTML = '<p>Nenhum item anexado.</p>';
            return;
        }

        itemsToDisplay.forEach((item, itemIndex) => {
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';
            itemCard.innerHTML = `<img src="${item.imagem || 'placeholder.png'}" alt="${item.nome || ''}" class="item-image"><div class="item-name">${item.nome || 'Item'}</div><div class="item-nota">${item.nota || 'N/A'}</div>`;

            if (managerParentItemIds.has(item.id)) {
                itemCard.style.cursor = 'pointer';
                itemCard.addEventListener('click', () => window.showNestedPopup(item));
            } else {
                itemCard.style.cursor = 'default';
            }

            itemsGrid.appendChild(itemCard);
            requestAnimationFrame(() => {
                setTimeout(() => itemCard.classList.add('visible'), itemIndex * 100);
            });
        });
    } catch (error) {
        console.error(`showStadiumDetailsPopup: Erro ao carregar itens para ${stadium.id}:`, error);
        itemsGrid.innerHTML = '<p style="color:red;">Erro ao carregar.</p>';
    }
}

function closeStadiumDetailsPopup() {
    console.log("closeStadiumDetailsPopup: Closing stadium details popup."); const popup = document.getElementById('stadium-details-popup'); if (popup) popup.classList.remove('active');
}

// --- Stadium Purchase Flow Functions ---
function showStadiumConfirmation() {
    if (!selectedStadiumForPurchase || selectedStadiumForPurchase.valor === undefined) { console.error("showStadiumConfirmation: Invalid stadium data."); showInfoPopup("Erro", "Estádio inválido."); return; } if (currentUser && currentUser.estadio) { console.warn("showStadiumConfirmation: User already owns a stadium."); showInfoPopup("Informação", `Já possui: ${currentUser.estadio}.`); return; } console.log("showStadiumConfirmation: Showing confirmation for:", selectedStadiumForPurchase); const nameEl = document.getElementById('confirm-stadium-name'); const priceEl = document.getElementById('confirm-stadium-price'); const popup = document.getElementById('stadium-confirmation-popup'); if (nameEl) nameEl.textContent = selectedStadiumForPurchase.nome || 'este estádio'; if (priceEl) priceEl.textContent = selectedStadiumForPurchase.valor; if (popup) popup.classList.add('active');
}
function closeStadiumConfirmation() {
    console.log("closeStadiumConfirmation: Closing stadium confirmation."); const popup = document.getElementById('stadium-confirmation-popup'); if (popup) popup.classList.remove('active');
}
async function confirmStadiumPurchase(confirmed) {
    console.log(`confirmStadiumPurchase: User action - confirmed: ${confirmed}`);
    closeStadiumConfirmation();
    if (!confirmed) {
        console.log("confirmStadiumPurchase: Cancelled.");
        selectedStadiumForPurchase = null;
        return;
    }

    if (!selectedStadiumForPurchase?.id || selectedStadiumForPurchase.valor === undefined || !selectedStadiumForPurchase.tipo || !selectedStadiumForPurchase.nome || !currentUser) {
        console.error("confirmStadiumPurchase: Pre-transaction check failed (missing data).", { stadium: selectedStadiumForPurchase, user: currentUser });
        showInfoPopup("Erro", "Dados inválidos para iniciar a compra (nome do estádio em falta?).");
        selectedStadiumForPurchase = null;
        return;
    }

    const stadiumToPurchase = selectedStadiumForPurchase;
    const stadiumPrice = stadiumToPurchase.valor;
    const userDocRef = doc(db, 'users', currentUser.uid);
    const stadiumLockRef = doc(db, 'stadiumLocks', stadiumToPurchase.nome);

    console.log(`confirmStadiumPurchase: Processing purchase for ${stadiumToPurchase.nome}`);
    showInfoPopup("Processando", "A processar compra...");

    let latestSeason;
    try {
        latestSeason = await getLatestSeason();
        if (!latestSeason) throw new Error("Temporada atual não pôde ser determinada.");

        await runTransaction(db, async (transaction) => {
            console.log(`confirmStadiumPurchase: Transaction started.`);

            const userDocSnap = await transaction.get(userDocRef);
            const lockDocSnap = await transaction.get(stadiumLockRef);

            if (!userDocSnap.exists()) throw new Error("Documento do utilizador não encontrado na transação.");
            const userData = userDocSnap.data();

            if (lockDocSnap.exists()) {
                throw new Error("Este estádio já foi adquirido por outro manager (lock existente).");
            }
            if (userData.estadio) {
                throw new Error("Já possui um estádio. Compra cancelada.");
            }

            console.log("confirmStadiumPurchase: Lock/Ownership checks passed inside transaction. Preparing updates.");

            transaction.set(stadiumLockRef, {
                boughtByUid: currentUser.uid,
                boughtByName: userData.nomeDeUsuario || '???',
                boughtAt: serverTimestamp(),
                stadiumId: stadiumToPurchase.id
            });

            transaction.update(userDocRef, {
                estadio: stadiumToPurchase.nome
            });

            const movimentoDocRef = doc(collection(db, 'movimentos'));
            const movimentoData = {
                estado: "Comprado",
                itemManager: stadiumToPurchase.nome,
                temporada: latestSeason,
                movimentoData: serverTimestamp(),
                preco: stadiumPrice,
                tipo: "Manager",
                userId: currentUser.uid,
                valorreal: -stadiumPrice,
                managerTipo: stadiumToPurchase.tipo,
                nivel: stadiumToPurchase.nivel || 'Nível 1',
                imagem: stadiumToPurchase.imagem || null
            };
            transaction.set(movimentoDocRef, movimentoData);

            console.log("confirmStadiumPurchase: Transaction updates prepared (User estadio update + New movement + Lock set).");
        });

        console.log("confirmStadiumPurchase: Transaction successful (Lock acquired, Movement created, User estadio set)!");

        console.log("confirmStadiumPurchase: Recalculating total GCoins based on all movements...");
        let calculatedTotalGCoins = 0;
        const gcoinsField = `${latestSeason}GCoins`;
        try {
            const allMovimentosQuery = query(collection(db, 'movimentos'), where('userId', '==', currentUser.uid));
            const allMovimentosSnapshot = await getDocs(allMovimentosQuery);

            allMovimentosSnapshot.forEach(doc => {
                calculatedTotalGCoins += doc.data().valorreal || 0;
            });
            console.log(`confirmStadiumPurchase: Calculated total GCoins from ${allMovimentosSnapshot.size} movements: ${calculatedTotalGCoins}`);

            await updateDoc(userDocRef, {
                [gcoinsField]: calculatedTotalGCoins
            });
            console.log(`confirmStadiumPurchase: User GCoins (${gcoinsField}) updated successfully with calculated total value.`);

        } catch (recalcError) {
            console.error("confirmStadiumPurchase: ERROR during GCoins recalculation and update:", recalcError);
            showInfoPopup("Aviso Importante", `O estádio foi adquirido, mas houve um erro ao recalcular o seu saldo final (${recalcError.message}). O seu saldo pode estar incorreto. Contacte o suporte.`);
        }

        closeInfoPopup();
        if (!document.getElementById('info-popup').classList.contains('active')) {
            showInfoPopup("Sucesso!", `Estádio ${stadiumToPurchase.nome} adquirido com sucesso! Saldo atualizado.`);
        }
        selectedStadiumForPurchase = null;
        console.log("confirmStadiumPurchase: Reloading page...");
        setTimeout(() => location.reload(), 3000);

    } catch (error) {
        console.error("confirmStadiumPurchase: A operação falhou:", error);
        closeInfoPopup();
        let displayError;
        if (error.message.includes("lock existente")) {
            displayError = "Este estádio já foi adquirido por outro manager.";
        } else if (error.message.includes("Já possui um estádio")) {
            displayError = "A sua conta já possui um estádio.";
        } else {
            displayError = "Ocorreu uma falha inesperada. Tente novamente.";
        }
        showInfoPopup("Erro na Compra", displayError);
        selectedStadiumForPurchase = null;
    }
}

// --- Manager Shop & Item Purchase Flow Functions ---
async function showManagerShopPopup(stadiumId, ownedTypeLevelSet) {
    console.log(`%c[DEBUG] showManagerShopPopup (Chip+Nivel2+SmartClick): Called`, 'color: cyan; font-weight: bold;');
    const shopPopup = document.getElementById('manager-shop-popup');
    const itemsGrid = document.getElementById('manager-shop-items-grid');
    if (!shopPopup || !itemsGrid || !currentUser) return;

    itemsGrid.innerHTML = '<p style="color: #a99a7c; text-align: center; grid-column: 1 / -1;">A carregar itens disponíveis...</p>';
    shopPopup.classList.add('active');

    try {
        await loadManagerParentMap();

        let userHasBoughtToday = false;
        let ownedItemNamesSet = new Set();
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(todayStart.getDate() + 1);

        const dailyPurchaseQuery = query(collection(db, 'movimentos'), where('userId', '==', currentUser.uid), where('tipo', '==', 'Manager'), where('movimentoData', '>=', todayStart), where('movimentoData', '<', tomorrowStart), limit(1));
        const ownedItemsQuery = query(collection(db, 'movimentos'), where('userId', '==', currentUser.uid), where('tipo', '==', 'Manager'));
        
        const [dailyPurchaseSnapshot, ownedItemsSnapshot] = await Promise.all([getDocs(dailyPurchaseQuery), getDocs(ownedItemsQuery)]);

        userHasBoughtToday = !dailyPurchaseSnapshot.empty;
        ownedItemsSnapshot.forEach(doc => {
            const movData = doc.data();
            if (movData.itemManager) ownedItemNamesSet.add(movData.itemManager);
        });

        const purchasableItemsQuery = query(collection(db, 'managerItens'), where('anexadoItemId', '==', stadiumId), where('noMercado', '==', true));
        const querySnapshot = await getDocs(purchasableItemsQuery);
        const rawFetchedItems = [];
        querySnapshot.forEach(doc => rawFetchedItems.push({ id: doc.id, ...doc.data() }));

        const itemsToDisplay = rawFetchedItems.filter(item => item.valor !== undefined && item.valor !== null);
        itemsGrid.innerHTML = '';

        if (itemsToDisplay.length === 0) {
            itemsGrid.innerHTML = '<p>Nenhum item adicional encontrado.</p>';
            return;
        }

        itemsToDisplay.forEach((item, index) => {
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';
            itemCard.style.opacity = 0; itemCard.style.transform = 'translateY(20px)';

            const isOwned = ownedItemNamesSet.has(item.nome);
            const isAvailableToday = isItemAvailableToday(item.diaDisponivel || item.dataMercado);
            let needsLevel1 = item.nivel === 'Nível 2';
            let hasLevel1 = needsLevel1 ? ownedTypeLevelSet.has(`${item.tipo}:Nível 1`) : true;
            const isDisabled = isOwned || !isAvailableToday || userHasBoughtToday || (needsLevel1 && !hasLevel1);
            let disabledReason = isOwned ? 'Já Possuído' : (userHasBoughtToday ? 'Limite Diário Atingido' : (!isAvailableToday ? 'Indisponível Hoje' : (needsLevel1 && !hasLevel1 ? 'Requer Nível 1' : '')));

            const itemType = item.tipo || '???';
            const nivelDisplay = item.nivel ? ` <span style="font-size:0.8em; color:#aaa;">(${item.nivel})</span>` : '';
            itemCard.innerHTML = `
                <span class="item-type-chip">${itemType}</span>
                <img src="${item.imagem || 'placeholder.png'}" alt="${item.nome || ''}" class="item-image">
                <div class="item-name">${item.nome || 'Item'}${nivelDisplay}</div>
                <div class="item-nota" style="min-height: 3em; margin-bottom: 8px;">${item.nota || '...'}</div>
                <div class="item-nota" style="color: #c9a959; font-weight: bold; margin-bottom: 10px;">${item.valor || '?'} GCoins</div>
                <button class="popup-button buy-item-btn" style="padding: 5px 10px; font-size: 14px;" ${isDisabled ? 'disabled' : ''}>Comprar</button>
                <span class="disabled-reason">${disabledReason}</span>
            `;

            if (!isDisabled) {
                const buyButton = itemCard.querySelector('.buy-item-btn');
                if (buyButton) buyButton.onclick = (event) => { event.stopPropagation(); initiateItemPurchase(item); };
            }

            const hasChildren = managerParentItemIds.has(item.id);

            if (hasChildren) {
                itemCard.style.cursor = 'pointer';
                itemCard.addEventListener('click', (event) => {
                    if (event.target.tagName !== 'BUTTON' || event.target.disabled) {
                        window.showNestedPopup(item);
                    }
                });
            } else {
                itemCard.style.cursor = 'default';
            }

            itemsGrid.appendChild(itemCard);
            requestAnimationFrame(() => {
                setTimeout(() => {
                    itemCard.style.opacity = '1';
                    itemCard.style.transform = 'translateY(0)';
                    itemCard.classList.add('visible');
                }, index * 100);
            });
        });
    } catch (error) {
        console.error("%c[DEBUG] Error during showManagerShopPopup:", 'color: red;', error);
        itemsGrid.innerHTML = `<p style="color:red;">Erro loja: ${error.message}</p>`;
    }
    console.log(`%c[DEBUG] showManagerShopPopup (Chip+Nivel2+SmartClick): Function End`, 'color: cyan; font-weight: bold;');
}

function closeManagerShopPopup() {
    console.log("closeManagerShopPopup: Closing manager shop."); const popup = document.getElementById('manager-shop-popup'); if (popup) popup.classList.remove('active');
}

function initiateItemPurchase(itemData) {
    console.log("initiateItemPurchase: Initiating purchase for:", itemData); if (!itemData || itemData.valor === undefined) { console.error("initiateItemPurchase: Invalid item data."); showInfoPopup("Erro", "Item inválido."); return; } selectedItemForPurchase = itemData; const popup = document.getElementById('item-confirmation-popup'); const nameEl = document.getElementById('confirm-item-name'); const priceEl = document.getElementById('confirm-item-price'); if (popup && nameEl && priceEl) { nameEl.textContent = selectedItemForPurchase.nome || 'item'; priceEl.textContent = selectedItemForPurchase.valor; popup.classList.add('active'); } else { console.error("initiateItemPurchase: Item confirmation elements not found."); }
}

function closeItemConfirmation() {
    console.log("closeItemConfirmation: Closing item confirmation."); const popup = document.getElementById('item-confirmation-popup'); if (popup) popup.classList.remove('active');
}

function handleConfirmPurchase() {
    const yesButton = document.getElementById('confirm-item-btn-yes');
    const noButton = document.getElementById('confirm-item-btn-no');

    if (yesButton && !yesButton.disabled) {
        yesButton.disabled = true;
        yesButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aguarde...';
        if (noButton) {
            noButton.disabled = true;
        }
        confirmItemPurchase(true);
    }
}

async function confirmItemPurchase(confirmed) {
    console.log(`confirmItemPurchase: User action - confirmed: ${confirmed}`);

    if (!confirmed) {
        closeItemConfirmation();
        selectedItemForPurchase = null;
        return;
    }

    if (isProcessingPurchase) {
        console.log("confirmItemPurchase: Compra já em processamento. Ignorando.");
        return;
    }

    if (!selectedItemForPurchase?.id || selectedItemForPurchase.valor === undefined || !selectedItemForPurchase.tipo || !currentUser) {
        console.error("confirmItemPurchase: Pre-check failed.", { item: selectedItemForPurchase, user: currentUser });
        closeItemConfirmation();
        showInfoPopup("Erro", "Dados inválidos para a compra.");
        selectedItemForPurchase = null;
        return;
    }
    
    isProcessingPurchase = true;
    const itemToPurchase = selectedItemForPurchase;
    const itemPrice = itemToPurchase.valor;
    const userDocRef = doc(db, 'users', currentUser.uid);
    const managerItemRef = doc(db, 'managerItens', itemToPurchase.id);
    let latestSeason;

    try {
        latestSeason = await getLatestSeason(); if (!latestSeason) throw new Error("Temporada não determinada.");
        const gcoinsFieldCheck = `${latestSeason}GCoins`;

        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(todayStart.getDate() + 1);
        const dailyPurchaseQuery = query(collection(db, 'movimentos'), where('userId', '==', currentUser.uid), where('tipo', '==', 'Manager'), where('movimentoData', '>=', todayStart), where('movimentoData', '<', tomorrowStart), limit(1));
        const dailyPurchaseSnapshot = await getDocs(dailyPurchaseQuery);
        if (!dailyPurchaseSnapshot.empty) { throw new Error("Limite Diário Atingido"); }

        const availabilityCheckRule = itemToPurchase.diaDisponivel || itemToPurchase.dataMercado;
        if (!isItemAvailableToday(availabilityCheckRule)) { throw new Error("Item não disponível hoje."); }

        if (itemToPurchase.nivel === 'Nível 2') {
            const level1CheckQuery = query(collection(db, 'movimentos'), where('userId', '==', currentUser.uid), where('managerTipo', '==', itemToPurchase.tipo), where('nivel', '==', 'Nível 1'), limit(1));
            const level1Snapshot = await getDocs(level1CheckQuery);
            if (level1Snapshot.empty) { throw new Error(`Requisito: Nível 1 (${itemToPurchase.tipo}) necessário.`); }
        }

        await runTransaction(db, async (transaction) => {
            const userDocSnap = await transaction.get(userDocRef);
            if (!userDocSnap.exists()) throw new Error("User doc not found in transaction.");
            const userData = userDocSnap.data();
            const currentUserGCoins = userData[gcoinsFieldCheck] || 0;
            if (currentUserGCoins < itemPrice) { throw new Error(`Saldo insuficiente`); }
            
            const movimentoDocRef = doc(collection(db, 'movimentos'));
            const movimentoData = { 
                estado: "Comprado", 
                itemManager: itemToPurchase.nome, 
                temporada: latestSeason, 
                movimentoData: serverTimestamp(), 
                preco: itemPrice, 
                tipo: "Manager", 
                userId: currentUser.uid, 
                valorreal: -itemPrice, 
                managerTipo: itemToPurchase.tipo, 
                nivel: itemToPurchase.nivel || 'Nível 1',
                imagem: itemToPurchase.imagem || null
            };
            transaction.set(movimentoDocRef, movimentoData);

            const mercadoDocRef = doc(collection(db, 'managerMercado'));
            const mercadoData = {
                itemNome: itemToPurchase.nome,
                itemPreco: itemToPurchase.valor,
                compradorId: currentUser.uid,
                compradorNome: userData.nomeDeUsuario || 'Nome Desconhecido',
                dataCompra: serverTimestamp(),
                tipoItem: itemToPurchase.tipo,
                nivelItem: itemToPurchase.nivel || 'Nível 1'
            };
            transaction.set(mercadoDocRef, mercadoData);
            
            transaction.update(managerItemRef, { compradoPorUids: arrayUnion(currentUser.uid) });
            if (itemToPurchase.tipo === "Formações") {
                transaction.update(userDocRef, { tática: arrayUnion(itemToPurchase.nome) });
            }
        });

        console.log("confirmItemPurchase: Transaction OK! Recalculating GCoins...");
        const finalSeason = latestSeason; const finalGcoinsField = `${finalSeason}GCoins`;
        const allMovimentosQuery = query(collection(db, 'movimentos'), where('userId', '==', currentUser.uid));
        const allMovimentosSnapshot = await getDocs(allMovimentosQuery);
        let totalValorReal = 0;
        allMovimentosSnapshot.forEach(doc => { totalValorReal += doc.data().valorreal || 0; });
        await updateDoc(userDocRef, { [finalGcoinsField]: totalValorReal });

        closeItemConfirmation();
        setTimeout(() => location.reload(), 1000);

    } catch (error) {
        console.error("confirmItemPurchase: A compra falhou:", error);
        let displayError;
        if (error.message.includes("Saldo insuficiente")) { displayError = "Saldo Insuficiente"; }
        else if (error.message.includes("Limite Diário Atingido")) { displayError = "Você já atingiu o limite de uma compra por dia."; }
        else if (error.message.includes("Item não disponível hoje")) { displayError = "Este item não está disponível para compra hoje."; }
        else if (error.message.includes("Requisito: Nível 1")) { displayError = "É necessário possuir o Nível 1 deste tipo de item primeiro."; }
        else { displayError = "Ocorreu uma falha inesperada. Tente novamente."; }
        
        closeItemConfirmation();
        showInfoPopup("Erro na Compra", displayError);
        selectedItemForPurchase = null;

    } finally {
        isProcessingPurchase = false;
        console.log("confirmItemPurchase: Flag de processamento resetada.");

        const yesButton = document.getElementById('confirm-item-btn-yes');
        const noButton = document.getElementById('confirm-item-btn-no');
        if (yesButton) {
            yesButton.disabled = false;
            yesButton.innerHTML = 'Sim';
        }
        if (noButton) {
            noButton.disabled = false;
        }
    }
}

// --- State Loading Functions ---
async function loadMentalidadesParaEscolha() {
    console.log("loadMentalidadesParaEscolha: Starting...");
    let container, list, title;
    try {
        container = document.getElementById('mentalidades-container');
        list = document.getElementById('mentalidades-list');
        title = container.querySelector('h2');
        if (!container || !list || !title) throw new Error("DOM elements missing");
        list.innerHTML = '<p>A carregar mentalidades...</p>';
        title.textContent = 'Escolhe uma Mentalidade';
        container.style.display = 'block';
    } catch (domError) {
        console.error("loadMentalidadesParaEscolha: DOM access ERROR:", domError);
        return;
    }
    if (!db) {
        console.error("loadMentalidadesParaEscolha: DB invalid!");
        list.innerHTML = '<p style="color:red;">Erro DB.</p>';
        return;
    }
    const mentalidadesQuery = query(collection(db, 'managerItens'), where('tipo', '==', 'Mentalidade'), where('noMercado', '==', true), orderBy('ordem', 'asc'));
    console.log("loadMentalidadesParaEscolha: Querying...");
    try {
        const querySnapshot = await getDocs(mentalidadesQuery);
        console.log(`loadMentalidadesParaEscolha: Found ${querySnapshot.size} mentalidades.`);
        const mentalidades = [];
        querySnapshot.forEach((doc) => {
            mentalidades.push({ id: doc.id, ...doc.data() });
        });
        list.innerHTML = '';
        if (mentalidades.length === 0) {
            list.innerHTML = '<p>Nenhuma mentalidade disponível.</p>';
            return;
        }
        for (let i = 0; i < mentalidades.length; i++) {
            const mentalidade = mentalidades[i];
            const card = document.createElement('div');
            card.className = 'mentalidade-card';
            card.style.opacity = 0;
            card.style.transform = 'translateY(10px)';
            card.innerHTML = `<img src="${mentalidade.imagem || 'placeholder.png'}" alt="${mentalidade.nome || 'Mentalidade'}">`;

            card.addEventListener('click', () => showPopup(mentalidade));
            
            list.appendChild(card);
            requestAnimationFrame(() => {
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, (i + 1) * 200);
            });
        }
        console.log("loadMentalidadesParaEscolha: Rendered choices.");
    } catch (error) {
        console.error("loadMentalidadesParaEscolha: ERROR:", error);
        list.innerHTML = `<p style="color:red;">Erro: ${error.message}</p>`;
    }
}

async function loadEstadios(mentalidadeId) {
    console.log(`loadEstadios: Starting for mentalidade: ${mentalidadeId}`);
    let container, list, title;
    try {
        container = document.getElementById('mentalidades-container');
        list = document.getElementById('mentalidades-list');
        title = container.querySelector('h2');
        if (!container || !list || !title) {
            throw new Error("DOM elements missing for stadium display (container, list, or title)");
        }
        list.innerHTML = '<p>A verificar estádios disponíveis...</p>';
        title.textContent = 'Escolha seu Estádio';
        container.style.display = 'block';
    } catch (domError) {
        console.error("loadEstadios: DOM access ERROR:", domError);
        return;
    }

    const boughtStadiumNamesSet = new Set();
    try {
        console.log("loadEstadios: Querying 'movimentos' for already bought stadiums...");
        const movimentosQuery = query(
            collection(db, "movimentos"),
            where("tipo", "==", "Manager"),
            where("managerTipo", "==", "Estádio")
        );
        const movimentosSnapshot = await getDocs(movimentosQuery);
        movimentosSnapshot.forEach((doc) => {
            const movData = doc.data();
            if (movData.itemManager) {
                boughtStadiumNamesSet.add(movData.itemManager);
            }
        });
        console.log(`loadEstadios: Found ${boughtStadiumNamesSet.size} unique stadium names in 'movimentos'.`, boughtStadiumNamesSet);
    } catch (error) {
        console.error("loadEstadios: Error querying 'movimentos' for bought stadiums:", error);
        list.innerHTML = `<p style="color:red;">Erro ao verificar disponibilidade dos estádios.</p>`;
        return;
    }

    const estadiosQuery = query(
        collection(db, 'managerItens'),
        where('tipo', '==', 'Estádio'),
        where('anexadoItemId', '==', mentalidadeId),
        where('noMercado', '==', true),
        orderBy('ordem', 'asc')
    );

    console.log("loadEstadios: Querying 'managerItens' for stadium details...");
    try {
        const querySnapshot = await getDocs(estadiosQuery);
        console.log(`loadEstadios: Found ${querySnapshot.size} stadium documents in 'managerItens'.`);

        list.innerHTML = '';

        if (querySnapshot.empty) {
            list.innerHTML = '<p>Nenhum estádio encontrado para esta mentalidade.</p>';
            return;
        }

        const estadios = [];
        querySnapshot.forEach((doc) => {
            estadios.push({ id: doc.id, ...doc.data() });
        });

        const userHasAnyStadium = currentUser && currentUser.estadio;

        for (let i = 0; i < estadios.length; i++) {
            const estadio = estadios[i];
            const card = document.createElement('div');
            card.className = 'item-card';
            card.style.opacity = 0;
            card.style.transform = 'translateY(20px)';

            // 1. Construir a base do card (Imagem, Nome, Nota)
            let cardContent = `
                 <img src="${estadio.imagem || 'placeholder.png'}" alt="${estadio.nome || ''}" class="item-image" style="width: 150px; height: 150px;">
                 <div class="item-name">${estadio.nome || 'Estádio'}</div>
                 <div class="item-nota">${estadio.nota || 'N/A'}</div>
             `;

            // 2. Adicionar o preço (valor) se existir
            if (estadio.valor !== undefined && estadio.valor !== null) {
                cardContent += `<div class="item-nota" style="color: #c9a959; font-weight: bold; margin-top: 10px;">${estadio.valor} GCoins</div>`;
            } else {
                cardContent += `<div style="min-height: 2.2em;"></div>`;
            }

            // 3. Adicionar o status e a ação de clique
            const isOwnedByCurrentUser = currentUser && currentUser.estadio === estadio.nome;
            const isAlreadyBoughtByAnyone = boughtStadiumNamesSet.has(estadio.nome);
            let clickHandler = null;

            if (isOwnedByCurrentUser) {
                cardContent += `<div style="color: lightgreen; font-weight: bold; margin-top: 5px;">Possuído</div>`;
                clickHandler = () => window.showStadiumDetailsPopup(estadio);
            } else if (isAlreadyBoughtByAnyone) {
                cardContent += `<div style="color: grey; font-style: italic; margin-top: 5px;">Indisponível (Já Adquirido)</div>`;
                card.style.cursor = 'not-allowed';
                card.style.filter = 'grayscale(80%)';
                clickHandler = () => window.showStadiumDetailsPopup(estadio);
            } else if (userHasAnyStadium) {
                cardContent += `<div style="margin-top: 5px;">&nbsp;</div>`;
                card.style.cursor = 'not-allowed';
                card.style.filter = 'grayscale(80%)';
                clickHandler = () => window.showStadiumDetailsPopup(estadio);
            } else if (estadio.valor !== undefined && estadio.valor !== null) {
                cardContent += `<div style="font-weight: bold; cursor: pointer; margin-top: 5px;">Comprar</div>`;
                clickHandler = () => {
                    selectedStadiumForPurchase = estadio;
                    window.showStadiumConfirmation();
                };
                card.style.cursor = 'pointer';
            } else {
                cardContent += `<div style="color: grey; margin-top: 5px;">Indisponível</div>`;
                clickHandler = () => window.showStadiumDetailsPopup(estadio);
            }

            card.innerHTML = cardContent;
            if (clickHandler) {
                card.addEventListener('click', clickHandler);
            }
            list.appendChild(card);

            requestAnimationFrame(() => {
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                    card.classList.add('visible');
                }, (i + 1) * 150);
            });
        }
        console.log("loadEstadios: Rendered estadios based on 'movimentos' availability check.");

    } catch (error) {
        console.error("loadEstadios: Firebase/Render ERROR:", error);
        if (list) {
            list.innerHTML = `<p style="color:red;">Erro ao carregar estádios: ${error.message}</p>`;
        }
    }
}

async function displayOwnedManagerState(userData) {
    console.log(`displayOwnedManagerState (Chips+SmartClick): Starting for user ${userData.uid}`);
    let container, list, title, userImagePlaceholder, shopButtonPlaceholder;
    let ownedStadiumId = null;
    let acquiredItemsDetails = [];
    let ownedTypeLevelSet = new Set();

    try {
        container = document.getElementById('mentalidades-container'); 
        list = document.getElementById('mentalidades-list'); 
        title = container.querySelector('h2'); 
        userImagePlaceholder = document.getElementById('user-image-placeholder'); 
        shopButtonPlaceholder = document.getElementById('shop-button-placeholder');
        if (!container || !list || !title || !userImagePlaceholder || !shopButtonPlaceholder) throw new Error("DOM elements missing!");
        
        list.innerHTML = '<p>A carregar seu manager...</p>';
        title.textContent = 'Seu Manager Estabelecido'; 
        container.style.display = 'block'; 
        userImagePlaceholder.innerHTML = ''; 
        shopButtonPlaceholder.innerHTML = '';

        await loadManagerParentMap();

    } catch (domError) { 
        console.error("displayOwnedManagerState: DOM access ERROR:", domError); 
        return; 
    }

    try {
        const stadiumQuery = query(collection(db, 'managerItens'), where('nome', '==', userData.estadio), where('tipo', '==', 'Estádio'), limit(1));
        const stadiumSnapshot = await getDocs(stadiumQuery);
        if (!stadiumSnapshot.empty) {
            const stadiumDoc = stadiumSnapshot.docs[0];
            ownedStadiumId = stadiumDoc.id;
            const stadiumData = stadiumDoc.data();
            if (stadiumData.imagem) {
                const existingBg = document.getElementById('manager-background-image');
                if (existingBg) existingBg.remove();
                const backgroundDiv = document.createElement('div');
                backgroundDiv.id = 'manager-background-image';
                Object.assign(backgroundDiv.style, { position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh', backgroundImage: `url('${stadiumData.imagem}')`, backgroundSize: 'cover', backgroundPosition: 'center center', opacity: '0.48', zIndex: '-1', pointerEvents: 'none' });
                document.body.appendChild(backgroundDiv);
            }
        }
    } catch (error) { console.error("Error fetching stadium:", error); }

    try {
        const movimentosQuery = query(collection(db, 'movimentos'), where('userId', '==', userData.uid), where('tipo', '==', 'Manager'));
        const movimentosSnapshot = await getDocs(movimentosQuery);
        acquiredItemsDetails = []; 
        ownedTypeLevelSet.clear();
        movimentosSnapshot.forEach(doc => {
            const movData = doc.data();
            if (movData.itemManager && movData.managerTipo && movData.managerTipo !== 'Mentalidade' && movData.managerTipo !== 'Estádio') {
                const itemDetail = { name: movData.itemManager, type: movData.managerTipo, level: movData.nivel || 'Nível 1' };
                acquiredItemsDetails.push(itemDetail);
                ownedTypeLevelSet.add(`${itemDetail.type}:${itemDetail.level}`);
            }
        });

        if (acquiredItemsDetails.length === 0) {
            list.innerHTML = '<p>Não adquiriu outros itens ainda.</p>';
        } else {
            const itemPromises = acquiredItemsDetails.map(ownedItem => getDocs(query(collection(db, 'managerItens'), where('nome', '==', ownedItem.name), limit(1))));
            const itemSnapshots = await Promise.all(itemPromises);

            const itemsToDisplay = itemSnapshots.map((snapshot, index) => snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }).filter(item => item !== null);
            itemsToDisplay.sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome));
            list.innerHTML = '';

            itemsToDisplay.forEach((item, index) => {
                const itemCard = document.createElement('div');
                itemCard.className = 'item-card';
                itemCard.style.opacity = 0;
                itemCard.style.transform = 'translateY(20px)';
                const itemType = item.tipo || '???';
                const nivelDisplay = item.nivel ? ` <span style="font-size:0.8em; color:#aaa;">(${item.nivel})</span>` : '';
                itemCard.innerHTML = `
                    <span class="item-type-chip">${itemType}</span>
                    <img src="${item.imagem || 'placeholder.png'}" alt="${item.nome || ''}" class="item-image">
                    <div class="item-name">${item.nome || 'Item'}${nivelDisplay}</div>
                    <div class="item-nota">${item.nota || 'N/A'}</div>
                `;

                if (managerParentItemIds.has(item.id)) {
                    itemCard.style.cursor = 'pointer';
                    itemCard.addEventListener('click', () => window.showNestedPopup(item));
                } else {
                    itemCard.style.cursor = 'default';
                }

                list.appendChild(itemCard);
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        itemCard.style.opacity = '1';
                        itemCard.style.transform = 'translateY(0)';
                        itemCard.classList.add('visible');
                    }, index * 100);
                });
            });
        }

        if (ownedStadiumId) {
            const shopButton = document.createElement('button');
            shopButton.className = 'popup-button';
            shopButton.innerHTML = '<i class="fas fa-shopping-cart" style="margin-right: 5px;"></i>Loja';
            shopButton.style.padding = '8px 15px';
            shopButton.onclick = () => showManagerShopPopup(ownedStadiumId, ownedTypeLevelSet);
            shopButtonPlaceholder.appendChild(shopButton);
        }
    } catch (error) {
        console.error("Error displaying acquired items/UI:", error);
        list.innerHTML = `<p style="color:red;">Erro ao carregar seus itens: ${error.message}</p>`;
    }
}

// --- Funções para Popup Outros Managers ---
async function displayOtherManagersView() {
    console.log("displayOtherManagersView: Switching to other managers view.");
    const listContainer = document.getElementById('mentalidades-list');
    const title = document.querySelector('#mentalidades-container h2');
    const shopButton = document.querySelector('#shop-button-placeholder button');
    const userImagePlaceholder = document.getElementById('user-image-placeholder');
    const stadiumBackground = document.getElementById('manager-background-image');

    if (!listContainer || !title) return;

    listContainer.innerHTML = '<p>A carregar managers...</p>';
    title.textContent = 'Outros Managers';
    if (shopButton) shopButton.style.display = 'none';
    if (userImagePlaceholder) userImagePlaceholder.style.display = 'none';
    if (stadiumBackground) stadiumBackground.style.display = 'none';
    
    setPageBackground('https://lh3.googleusercontent.com/pw/AP1GczPZedYgh1QcwMzyJcb3Xe5XfxjNNvKPVvR7UetQ01ebddLxeU_ZtPAOudlBzqtDcjIyjH6V71ySDpfxykBMo52FGxMtFpa34kCRmkQ7Qvyx8nBXcu2geDy_16GThkINoio6urG7q46ItYZp9R7tVAF3=w1415-h809-s-no-gm?authuser=1', 0.48);

    try {
        const usersQuery = query(collection(db, "users"), where("estadio", ">", ""));
        const querySnapshot = await getDocs(usersQuery);
        listContainer.innerHTML = '';
        let otherManagersCount = 0;

        const userCards = [];
        querySnapshot.forEach((doc) => {
            if (doc.id === currentUser.uid) return;
            otherManagersCount++;
            const userData = doc.data();
            const userCard = document.createElement('div');
            userCard.className = 'user-manager-card';
            userCard.dataset.userId = doc.id;
            userCard.dataset.userName = userData.nomeDeUsuario || '???';
            userCard.innerHTML = `
                <img src="${userData.imagem || 'placeholder.png'}" alt="Imagem de ${userData.nomeDeUsuario || 'User'}" class="user-manager-image">
                <div class="user-manager-name">${userData.nomeDeUsuario || '???'}</div>
            `;
            userCard.addEventListener('click', handleUserCardClick);
            userCards.push(userCard);
        });

        if (otherManagersCount === 0) {
            listContainer.innerHTML = '<p>Nenhum outro manager encontrado.</p>';
        } else {
            userCards.forEach((card, index) => {
                listContainer.appendChild(card);
                requestAnimationFrame(() => {
                    setTimeout(() => card.classList.add('visible'), index * 100);
                });
            });
        }
    } catch (error) {
        console.error("displayOtherManagersView: Error:", error);
        listContainer.innerHTML = `<p style="color:red;">Erro ao carregar managers.</p>`;
    }
}

function displayMyManagerView() {
    console.log("displayMyManagerView: Switching back to my manager view.");
    const shopButton = document.querySelector('#shop-button-placeholder button');
    const userImagePlaceholder = document.getElementById('user-image-placeholder');
    const stadiumBackground = document.getElementById('manager-background-image');

    setPageBackground(null); 
    if (shopButton) shopButton.style.display = 'flex';
    if (userImagePlaceholder) userImagePlaceholder.style.display = 'block';
    if (stadiumBackground) stadiumBackground.style.display = 'block';

    displayOwnedManagerState(currentUser);
}

function toggleManagerView() {
    if (isShowingOtherManagers) {
        displayMyManagerView();
    } else {
        displayOtherManagersView();
    }
    isShowingOtherManagers = !isShowingOtherManagers;
}

function closeOtherManagersPopup() {
    console.log("closeOtherManagersPopup: Closing."); const popup = document.getElementById('other-managers-popup'); if (popup) popup.classList.remove('active');
}
function handleUserCardClick(event) {
    const clickedCard = event.currentTarget; const userId = clickedCard.dataset.userId; const userName = clickedCard.dataset.userName;
    if (userId && userName) { console.log(`Clicked user: ${userName} (ID: ${userId})`); showUserManagerItems(userId, userName); }
    else { console.error("Could not get data from clicked card.", clickedCard.dataset); }
}
async function showUserManagerItems(targetUserId, targetUserName) {
    console.log(`showUserManagerItems: Fetching items for ${targetUserName} (ID: ${targetUserId})`);
    const popup = document.getElementById('user-items-popup'); const titleEl = document.getElementById('user-items-popup-title'); const listContainer = document.getElementById('user-items-list');
    if (!popup || !titleEl || !listContainer) { console.error("showUserManagerItems: Elements missing."); return; }
    titleEl.textContent = `Manager de: ${targetUserName}`; listContainer.innerHTML = '<p>A carregar...</p>'; popup.classList.add('active');
    try {
        const movimentosQuery = query(
            collection(db, "movimentos"),
            where("userId", "==", targetUserId),
            where("tipo", "==", "Manager"),
            orderBy("managerTipo", "asc"),
            orderBy("itemManager", "asc")
        );
        const querySnapshot = await getDocs(movimentosQuery);
        console.log(`Found ${querySnapshot.size} Manager movements for ${targetUserId}.`);
        listContainer.innerHTML = ''; let itemsFound = 0; let cardIndex = 0;
        if (querySnapshot.empty) {
            listContainer.innerHTML = '<p>Nenhum item encontrado para este manager.</p>';
        }
        else {
            querySnapshot.forEach((doc) => {
                const movData = doc.data();
                const itemName = movData.itemManager || "???";
                const itemType = movData.managerTipo || "Item Manager";
                const itemLevel = movData.nivel || '';

                itemsFound++;
                const itemCard = document.createElement('div');
                itemCard.className = 'user-owned-item-card';

                const nameEl = document.createElement('div');
                nameEl.className = 'user-owned-item-name';
                nameEl.textContent = itemName + (itemLevel ? ` (${itemLevel})` : '');

                const typeEl = document.createElement('div');
                typeEl.className = 'user-owned-item-type';
                typeEl.textContent = `Tipo: ${itemType}`;

                itemCard.appendChild(nameEl);
                itemCard.appendChild(typeEl);

                listContainer.appendChild(itemCard);

                requestAnimationFrame(() => {
                    setTimeout(() => itemCard.classList.add('visible'), cardIndex * 80);
                });
                cardIndex++;
            });
            console.log(`Displayed ${itemsFound} items.`);
        }
    } catch (error) {
        console.error(`Error fetching movements for ${targetUserId}:`, error);
        listContainer.innerHTML = `<p style="color:red;">Erro ao carregar itens: ${error.message}</p>`;
    }
}
function closeUserItemsPopup() {
    console.log("closeUserItemsPopup: Closing."); const popup = document.getElementById('user-items-popup'); if (popup) popup.classList.remove('active');
}

// --- Global Function Definitions ---
window.closePopup = closePopup;
window.showConfirmation = showConfirmation;
window.confirmChoice = confirmChoice;
window.showStadiumDetailsPopup = showStadiumDetailsPopup;
window.closeStadiumDetailsPopup = closeStadiumDetailsPopup;
window.showStadiumConfirmation = showStadiumConfirmation;
window.closeStadiumConfirmation = closeStadiumConfirmation;
window.confirmStadiumPurchase = confirmStadiumPurchase;
window.closeInfoPopup = closeInfoPopup;
window.showNestedPopup = showNestedPopup;
window.closeNestedPopup = closeNestedPopup;
window.closeManagerShopPopup = closeManagerShopPopup;
window.initiateItemPurchase = initiateItemPurchase;
window.confirmItemPurchase = confirmItemPurchase;
window.handleConfirmPurchase = handleConfirmPurchase; 
window.closeOtherManagersPopup = closeOtherManagersPopup;
window.closeUserItemsPopup = closeUserItemsPopup;

// --- Main Initialization Logic on Auth State Change ---
console.log("Manager Page Script: Setting up onAuthStateChanged listener...");
onAuthStateChanged(auth, async (user) => {
    console.log("onAuthStateChanged: Auth state changed.");
    updateLoadingProgress(10);

    if (user) {
        console.log(`onAuthStateChanged: User detected. UID: ${user.uid}`);
        try {
            try {
                await updateDoc(doc(db, 'users', user.uid), { ultimoacesso: serverTimestamp() });
                console.log("onAuthStateChanged: Último acesso atualizado.");
            } catch (updateError) {
                console.error("onAuthStateChanged: Erro ao atualizar último acesso:", updateError);
            }

            currentUser = await getUserStatus(user.uid);
            updateLoadingProgress(30);

            console.log("onAuthStateChanged: User status received:", currentUser);
            if (!currentUser) { console.warn('onAuthStateChanged: User invalid or not accepted. Redirecting.'); window.location.href = '404.html'; hideLoadingScreen(); return; }

            const menuSettings = await getMenuSettings();
            updateLoadingProgress(50);
            console.log("onAuthStateChanged: Menu settings received:", menuSettings);

            const hasAccess = await checkPageAccess(currentUser, menuSettings);
            if (!hasAccess) { console.log("Access check failed."); hideLoadingScreen(); return; }
            console.log("Access check passed.");

            await logUserAction(`Entrou em ${document.title}`);
            console.log("onAuthStateChanged: 'Entrou em Manager' logado.");

            updateMenuVisibility(menuSettings);
            updateLoadingProgress(70);
            console.log("Menu visibility updated.");

            console.log(`onAuthStateChanged: User State - Mentalidade: ${currentUser.mentalidade}, Estadio: ${currentUser.estadio}`);

            if (currentUser.mentalidade && currentUser.estadio) {
                console.log('State -> Owned Manager.');
                await displayOwnedManagerState(currentUser);
            } else if (!currentUser.mentalidade) {
                console.log('State -> Choose Mentalidade.');
                await loadMentalidadesParaEscolha();
            } else {
                console.log(`State -> Choose Estadio.`);
                await loadEstadios(currentUser.mentalidade);
            }
            console.log("Correct state loading function finished.");

            const otherManagersBtn = document.getElementById('other-managers-button');
            if (otherManagersBtn && currentUser?.estadio) {
                console.log("onAuthStateChanged: Showing 'Other Managers' button.");
                otherManagersBtn.style.display = 'flex';
                setTimeout(() => otherManagersBtn.classList.add('visible'), 100);
                otherManagersBtn.onclick = toggleManagerView;
            } else if (otherManagersBtn) {
                otherManagersBtn.style.display = 'none';
                otherManagersBtn.classList.remove('visible');
                otherManagersBtn.onclick = null;
            }

            updateLoadingProgress(100);
            console.log("Hiding loading screen.");
            hideLoadingScreen();

        } catch (error) {
            console.error('CRITICAL ERROR during init/load:', error);
            const container = document.getElementById('mentalidades-container');
            if (container) { container.innerHTML = '<h2 style="color:red;">Erro Crítico</h2><p style="color:red;">Erro ao carregar a página. Verifique a consola para detalhes.</p>'; container.style.display = 'block'; }
            hideLoadingScreen();
        }
    } else {
        console.log('No user logged in. Redirecting to index.');
        currentUser = null;
        hideLoadingScreen();
        window.location.href = 'index.html';
    }
});
console.log("Manager Page Script: onAuthStateChanged listener set up.");

document.addEventListener('click', async (event) => {
    const clickableElement = event.target.closest(
        '.mentalidade-card, .item-card, .popup-button, .close-button, #other-managers-button, .user-manager-card, a.menu-item'
    );

    if (!clickableElement) return;

    let actionName = '';

    if (clickableElement.matches('.mentalidade-card')) {
        actionName = `Abriu detalhes da Mentalidade`;
    } 
    else if (clickableElement.matches('#escolher-mentalidade-btn')) {
        actionName = 'Clicou para escolher a Mentalidade (abriu confirmação)';
    }
    else if (clickableElement.matches('#confirmation-popup .popup-button') && clickableElement.textContent.trim() === 'Sim') {
        actionName = `Confirmou a escolha da Mentalidade: ${selectedMentalidade?.nome || 'desconhecida'}`;
    }
    else if (clickableElement.matches('.item-card') && clickableElement.closest('#mentalidades-list')) {
        const itemName = clickableElement.querySelector('.item-name')?.textContent.trim();
        actionName = `Interagiu com o item/estádio: ${itemName}`;
    }
    else if (clickableElement.matches('#stadium-confirmation-popup .popup-button') && clickableElement.textContent.trim() === 'Sim') {
        actionName = `Confirmou a compra do Estádio: ${selectedStadiumForPurchase?.nome || 'desconhecido'}`;
    }
    else if (clickableElement.matches('.buy-item-btn')) {
        const itemName = clickableElement.closest('.item-card')?.querySelector('.item-name')?.textContent.trim();
        actionName = `Clicou para comprar o item: ${itemName}`;
    }
    else if (clickableElement.matches('#item-confirmation-popup .popup-button') && clickableElement.textContent.trim().startsWith('Sim')) {
        actionName = `Confirmou a compra do item: ${selectedItemForPurchase?.nome || 'desconhecido'}`;
    }
    else if (clickableElement.matches('#other-managers-button')) {
        actionName = `Alternou a vista para: ${isShowingOtherManagers ? 'Meu Manager' : 'Outros Managers'}`;
    }
    else if (clickableElement.matches('.user-manager-card')) {
        actionName = `Visualizou o manager de: ${clickableElement.dataset.userName}`;
    }
    else if (clickableElement.matches('a.menu-item')) {
        actionName = `Navegou para: ${clickableElement.querySelector('.menu-text')?.textContent.trim() || 'Menu'}`;
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
