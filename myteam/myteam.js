import { db, auth } from '../core/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, orderBy, limit, setDoc, addDoc, where, serverTimestamp, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initRivalSquadsView } from '../core/rival-squads-view.js';
import { compactSeason, getLatestSeason, getSeasonData, mergeUserSeasonData } from '../core/user-season.js';
import { checkPageContentAccess } from '../js/page-content-guard.js';

// --- Sobrescrever window.alert com Modal Personalizado ---
window.alert = function(message) {
    // Determinar se é um alerta de erro ou aviso restritivo
    const msgLower = message.toLowerCase();
    const isError = msgLower.includes('erro') || 
                    msgLower.includes('não tem') || 
                    msgLower.includes('bloqueada') || 
                    msgLower.includes('não pode') || 
                    msgLower.includes('já está') || 
                    msgLower.includes('só pode') || 
                    msgLower.includes('ocupada');
    
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; z-index: 99999; backdrop-filter: blur(4px); animation: fadeInAlert 0.2s ease-out;';

    const card = document.createElement('div');
    card.style.cssText = 'background: #161b26; border: 1.5px solid ' + (isError ? '#e74c3c' : '#2ecc71') + '; padding: 30px; border-radius: 16px; width: 90%; max-width: 450px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); transform: scale(0.9); animation: scaleAlertIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; display: flex; flex-direction: column; align-items: center; gap: 15px;';

    const icon = document.createElement('div');
    icon.style.cssText = 'width: 54px; height: 54px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; color: white; background: ' + (isError ? '#e74c3c' : '#2ecc71') + '; flex-shrink: 0;';
    icon.innerHTML = isError ? '<i class="fas fa-exclamation-triangle"></i>' : '<i class="fas fa-check"></i>';

    const text = document.createElement('p');
    text.style.cssText = 'color: #f0f2f5; font-size: 16px; font-weight: 600; line-height: 1.5; margin: 0; font-family: system-ui, -apple-system, sans-serif;';
    text.textContent = message;

    const btn = document.createElement('button');
    btn.style.cssText = 'background: ' + (isError ? '#e74c3c' : '#2ecc71') + '; color: #0c1017; font-weight: 700; border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: transform 0.1s; margin-top: 10px; width: 100%; max-width: 120px; outline: none;';
    btn.textContent = 'OK';
    btn.addEventListener('click', () => {
        card.style.animation = 'scaleAlertOut 0.15s ease-in forwards';
        overlay.style.animation = 'fadeOutAlert 0.15s ease-in forwards';
        setTimeout(() => overlay.remove(), 150);
    });

    card.appendChild(icon);
    card.appendChild(text);
    card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    if (!document.getElementById('custom-alert-styles')) {
        const styles = document.createElement('style');
        styles.id = 'custom-alert-styles';
        styles.textContent = `
            @keyframes fadeInAlert { from { opacity: 0; } to { opacity: 1; } }
            @keyframes fadeOutAlert { from { opacity: 1; } to { opacity: 0; } }
            @keyframes scaleAlertIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            @keyframes scaleAlertOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.85); opacity: 0; } }
        `;
        document.head.appendChild(styles);
    }
};

// --- Configuração Inicial ---
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

// --- Variáveis Globais ---
let currentUserStatus = null;
let currentUserUid = null;
let userOwnedPlayers = [];
let userOwnedPlayerStyles = [];
let countries = {};
let clubs = new Set();
let currentFormation = '';
let hasUnsavedChanges = false;
let assignedPlayers = {}; // Rastreia { positionId: playerId }
let playerStyleAssignments = {}; // Rastreia { positionId: styleId }
let paineisCoeficienteData = null; // --- NOVO: Cache para os dados de coeficiente
let rivalSquadsView = null;

// Mapeamento de Regras para Estilos de Jogador
const styleToPositionMap = { "Muralha": "Guarda-Redes", "Guardião": "Guarda-Redes", "General": "Defesa", "Estafeta": "Defesa", "Arqueiro": "Médio", "Provedor": "Médio", "Cometa": "Avançado", "Soldado": "Avançado" };
const posicaoMapping = { "Avançado": "FWD", "Defesa": "DEF", "Médio": "MID", "Guarda-Redes": "GK" };

// --- Seletores de Elementos DOM ---
const loadingScreen = document.getElementById('loading-screen');
const content = document.querySelector('.content');
const formationSelect = document.getElementById('formation-select');
const pitchArea = document.querySelector('.pitch-area');
const playerResultsContainer = document.querySelector('.player-results');
const playerSearchInput = document.getElementById('player-search');
const countryFilterSelect = document.getElementById('country-filter');
const clubFilterSelect = document.getElementById('club-filter');
const positionFilterSelect = document.getElementById('position-filter');
const playerListModal = document.getElementById('playerListModal');
const closePlayerListModalBtn = document.getElementById('closePlayerListModal');
const playerCardListContainer = document.getElementById('playerCardList');
const saveFormationButton = document.getElementById('saveFormationBtn');
const chooseBtn = document.getElementById('chooseBtn');

const playerStatCardOverlay = document.getElementById('player-stat-card-overlay');
const playerStatCard = document.getElementById('player-stat-card');

const formations = { 
    '4-4-2': [ { position: 'GK', top: '90%', left: '47%', positionType: 'GK' }, { position: 'DL', top: '75%', left: '12%', positionType: 'DEF' }, { position: 'DC1', top: '75%', left: '32%', positionType: 'DEF' }, { position: 'DC2', top: '75%', left: '62%', positionType: 'DEF' }, { position: 'DR', top: '75%', left: '82%', positionType: 'DEF' }, { position: 'ML', top: '40%', left: '12%', positionType: 'MID' }, { position: 'MC1', top: '40%', left: '32%', positionType: 'MID' }, { position: 'MC2', top: '40%', left: '62%', positionType: 'MID' }, { position: 'MR', top: '40%', left: '82%', positionType: 'MID' }, { position: 'FW1', top: '10%', left: '32%', positionType: 'FWD' }, { position: 'FW2', top: '10%', left: '62%', positionType: 'FWD' } ], 
    '4-3-3': [ { position: 'GK', top: '90%', left: '47%', positionType: 'GK' }, { position: 'DL', top: '75%', left: '12%', positionType: 'DEF' }, { position: 'DC1', top: '75%', left: '32%', positionType: 'DEF' }, { position: 'DC2', top: '75%', left: '62%', positionType: 'DEF' }, { position: 'DR', top: '75%', left: '82%', positionType: 'DEF' }, { position: 'MC1', top: '40%', left: '32%', positionType: 'MID' }, { position: 'MC2', top: '60%', left: '47%', positionType: 'MID' }, { position: 'MC3', top: '40%', left: '62%', positionType: 'MID' }, { position: 'AML', top: '10%', left: '25%', positionType: 'FWD' }, { position: 'AMC', top: '10%', left: '50%', positionType: 'FWD' }, { position: 'AMR', top: '10%', left: '75%', positionType: 'FWD' }, ], 
    '4-5-1': [ { position: 'GK', top: '90%', left: '47%', positionType: 'GK' }, { position: 'DL', top: '75%', left: '12%', positionType: 'DEF' }, { position: 'DC1', top: '75%', left: '32%', positionType: 'DEF' }, { position: 'DC2', top: '75%', left: '62%', positionType: 'DEF' }, { position: 'DR', top: '75%', left: '82%', positionType: 'DEF' }, { position: 'DML', top: '50%', left: '47%', positionType: 'MID' }, { position: 'MC1', top: '40%', left: '10%', positionType: 'MID' }, { position: 'AMC', top: '40%', left: '30%', positionType: 'MID' }, { position: 'MC2', top: '40%', left: '64%', positionType: 'MID' }, { position: 'DMR', top: '40%', left: '84%', positionType: 'MID' }, { position: 'FW', top: '10%', left: '47%', positionType: 'FWD' } ], 
    '3-4-3': [ { position: 'GK', top: '90%', left: '47%', positionType: 'GK' }, { position: 'DC1', top: '75%', left: '20%', positionType: 'DEF' }, { position: 'DC2', top: '75%', left: '47%', positionType: 'DEF' }, { position: 'DC3', top: '75%', left: '77%', positionType: 'DEF' }, { position: 'ML', top: '40%', left: '12%', positionType: 'MID' }, { position: 'MC1', top: '40%', left: '32%', positionType: 'MID' }, { position: 'MC2', top: '40%', left: '62%', positionType: 'MID' }, { position: 'MR', top: '40%', left: '82%', positionType: 'MID' }, { position: 'AML', top: '10%', left: '25%', positionType: 'FWD' }, { position: 'AMC', top: '10%', left: '50%', positionType: 'FWD' }, { position: 'AMR', top: '10%', left: '75%', positionType: 'FWD' }, ], 
    '5-3-2': [ { position: 'GK', top: '90%', left: '47%', positionType: 'GK' }, { position: 'SW', top: '75%', left: '10%', positionType: 'DEF' }, { position: 'WBL', top: '75%', left: '30%', positionType: 'DEF' }, { position: 'DC1', top: '75%', left: '47%', positionType: 'DEF' }, { position: 'DC2', top: '75%', left: '64%', positionType: 'DEF' }, { position: 'WBR', top: '75%', left: '84%', positionType: 'DEF' }, { position: 'MC1', top: '40%', left: '30%', positionType: 'MID' }, { position: 'MC2', top: '55%', left: '47%', positionType: 'MID' }, { position: 'MC3', top: '40%', left: '64%', positionType: 'MID' }, { position: 'FW1', top: '10%', left: '30%', positionType: 'FWD' }, { position: 'FW2', top: '10%', left: '64%', positionType: 'FWD' } ] 
};

// --- NOVO: Função para calcular os Overalls por Categoria ---
function calculateCategoryOveralls(player) { 
    const categoryTotals = {}; 
    const statsText = player.estatisticas; 
    const playerPosition = player.posicao; 
    if (!statsText || !paineisCoeficienteData) { return {}; } 
    const lines = statsText.split('\n'); 
    for (const categoria in paineisCoeficienteData) { 
        if (!categoryTotals[categoria]) { categoryTotals[categoria] = 0; } 
        const subcategorias = paineisCoeficienteData[categoria]; 
        for (const subcategoriaNome in subcategorias) { 
            const subcategoriaData = subcategorias[subcategoriaNome]; 
            if (subcategoriaData.tipo) { 
                for (const tipoItem of subcategoriaData.tipo) { 
                    if (tipoItem.name === playerPosition) { 
                        const coefficient = parseFloat(String(tipoItem.text).replace(',', '.')) || 0; 
                        let statValue = 0; 
                        for (let i = 0; i < lines.length; i++) { 
                            const line = lines[i].trim(); 
                            if (line.toLowerCase().startsWith(subcategoriaNome.toLowerCase())) { 
                                const valueLine = lines[i + 1] ? lines[i + 1].trim() : ''; 
                                if (valueLine) { 
                                    const numberMatch = valueLine.match(/^-?\d+(\.\d+)?/); 
                                    if (numberMatch) { 
                                        statValue = parseFloat(numberMatch[0].replace(',', '.')); 
                                    } 
                                } 
                                break; 
                            } 
                        } 
                        categoryTotals[categoria] += (coefficient * statValue); 
                    } 
                } 
            } 
        } 
    } 
    for (const categoria in categoryTotals) { 
        categoryTotals[categoria] = Math.round(categoryTotals[categoria]); 
    } 
    return categoryTotals; 
}

async function showPlayerCardPopup(playerId, clickedCardElement) { 
    const player = userOwnedPlayers.find(p => p.id === playerId); 
    if (!player) return; 
    
    // Create and append inline loader on the clicked card
    let inlineLoader = null;
    if (clickedCardElement) {
        inlineLoader = document.createElement('div');
        inlineLoader.className = 'card-inline-loader';
        inlineLoader.innerHTML = `
            <div class="kicking-animation-mini">
                <span class="boot-icon-mini">👟</span>
                <span class="ball-icon-mini">⚽</span>
            </div>
        `;
        clickedCardElement.appendChild(inlineLoader);
    }
    
    try {
        // 1. Fetch club data first
        const clubData = await fetchCompetitionLogo(player.clube); 
        
        // 2. Calculate category overalls
        const categoryOveralls = calculateCategoryOveralls(player); 
        
        // 3. Populate all DOM elements
        playerStatCard.querySelector('#card-player-overall').textContent = player.overall || '--'; 
        playerStatCard.querySelector('#card-player-position').textContent = posicaoMapping[player.posicao] || player.posicao; 
        playerStatCard.querySelector('#card-player-image img').src = player.imagem || 'placeholder.png'; 
        playerStatCard.querySelector('#card-player-name').textContent = player.nome; 
        
        const countryFlag = playerStatCard.querySelector('#card-country-flag'); 
        if (player.paisId && countries[player.paisId]) { 
            countryFlag.src = countries[player.paisId].imagem; 
            countryFlag.style.display = 'block'; 
        } else { 
            countryFlag.style.display = 'none'; 
        } 
        
        const clubLogo = playerStatCard.querySelector('#card-club-logo'); 
        if(clubData && clubData.clubeImagem) { 
            clubLogo.src = clubData.clubeImagem; 
            clubLogo.style.display = 'block'; 
        } else { 
            clubLogo.style.display = 'none'; 
        } 
        
        const statsGrid = playerStatCard.querySelector('.card-stats-grid'); 
        statsGrid.innerHTML = ''; 
        const statNameMapping = { 'Ataque': 'ATA', 'Passe': 'PAS', 'Defesa': 'DEF', 'Guarda-Redes': 'GK', 'Jogos': 'RIT', 'Outros': 'OUT' }; 
        const statOrder = ['Ataque', 'Passe', 'Defesa', 'Guarda-Redes', 'Jogos', 'Outros']; 
        statOrder.forEach(catName => { 
            if(categoryOveralls.hasOwnProperty(catName) && categoryOveralls[catName] > 0) { 
                const statItem = document.createElement('div'); 
                statItem.className = 'card-stat-item'; 
                const statValue = document.createElement('span'); 
                statValue.className = 'card-stat-value'; 
                statValue.textContent = categoryOveralls[catName]; 
                const statName = document.createElement('span'); 
                statName.className = 'card-stat-name'; 
                statName.textContent = statNameMapping[catName] || catName.substring(0,3).toUpperCase(); 
                statItem.appendChild(statValue); 
                statItem.appendChild(statName); 
                statsGrid.appendChild(statItem); 
            } 
        }); 
        
        // 4. Finally, make the overlay active
        playerStatCardOverlay.classList.add('active'); 
    } catch (error) {
        console.error("Erro ao carregar detalhes do jogador:", error);
    } finally {
        // Remove inline loader from card
        if (inlineLoader) {
            inlineLoader.remove();
        }
    }
}

// --- Suporte para Drag and Drop com Toque (Mobile / Touch Devices) ---
let activeTouchDrag = null;

function enableTouchDrag(element, getDragData) {
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let ghost = null;

    element.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        isDragging = false;

        const dragData = getDragData(element);
        if (!dragData) return;

        activeTouchDrag = {
            element,
            data: dragData,
            startX,
            startY
        };
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
        if (!activeTouchDrag || activeTouchDrag.element !== element) return;
        const touch = e.touches[0];
        const moveX = touch.clientX;
        const moveY = touch.clientY;
        const deltaX = Math.abs(moveX - startX);
        const deltaY = Math.abs(moveY - startY);

        if (!isDragging && (deltaX > 10 || deltaY > 10)) {
            isDragging = true;
            ghost = document.createElement('div');
            ghost.className = 'touch-drag-ghost';
            ghost.style.cssText = 'position:fixed; pointer-events:none; z-index:99999; width:56px; height:56px; border-radius:50%; background:#141923; border:2px solid #2ecc71; box-shadow:0 8px 25px rgba(0,0,0,0.6); overflow:hidden; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%);';

            const img = element.querySelector('img');
            if (img) {
                const ghostImg = document.createElement('img');
                ghostImg.src = img.src;
                ghostImg.style.cssText = 'width:100%; height:100%; object-fit:cover;';
                ghost.appendChild(ghostImg);
            }
            document.body.appendChild(ghost);
        }

        if (isDragging) {
            if (e.cancelable) e.preventDefault();
            if (ghost) {
                ghost.style.left = moveX + 'px';
                ghost.style.top = moveY + 'px';
            }

            const targetEl = document.elementFromPoint(moveX, moveY);
            const posTarget = targetEl ? targetEl.closest('.position') : null;

            document.querySelectorAll('.position').forEach(p => p.classList.remove('drag-over'));
            if (posTarget) {
                posTarget.classList.add('drag-over');
            }
        }
    }, { passive: false });

    element.addEventListener('touchend', (e) => {
        if (!activeTouchDrag || activeTouchDrag.element !== element) return;

        if (isDragging) {
            const touch = e.changedTouches[0];
            const dropX = touch.clientX;
            const dropY = touch.clientY;

            if (ghost && ghost.parentNode) {
                document.body.removeChild(ghost);
            }
            ghost = null;

            document.querySelectorAll('.position').forEach(p => p.classList.remove('drag-over'));

            const targetEl = document.elementFromPoint(dropX, dropY);
            const posTarget = targetEl ? targetEl.closest('.position') : null;

            if (posTarget) {
                const mockEvent = {
                    preventDefault: () => {},
                    currentTarget: posTarget,
                    dataTransfer: {
                        getData: (key) => activeTouchDrag.data[key] || ''
                    }
                };
                handlePositionDrop(mockEvent);
            }
        }
        activeTouchDrag = null;
        isDragging = false;
    });

    element.addEventListener('touchcancel', () => {
        if (ghost && ghost.parentNode) {
            document.body.removeChild(ghost);
        }
        ghost = null;
        document.querySelectorAll('.position').forEach(p => p.classList.remove('drag-over'));
        activeTouchDrag = null;
        isDragging = false;
    });
}

// --- Funções de Arrastar e Largar (Drag and Drop) ---
function handlePlayerCardDragStart(event) { 
    const playerCard = event.currentTarget; 
    event.dataTransfer.setData('type', 'player'); 
    event.dataTransfer.setData('playerId', playerCard.dataset.playerId); 
    event.dataTransfer.setData('source', 'list'); 
    event.dataTransfer.effectAllowed = 'move'; 
}
function handleStyleCardDragStart(event) { 
    const styleCard = event.currentTarget; 
    const styleId = styleCard.dataset.playerId; 
    const styleName = styleCard.querySelector('.player-name').textContent; 
    const styleImageSrc = styleCard.querySelector('img').src; 
    event.dataTransfer.setData('type', 'style'); 
    event.dataTransfer.setData('styleId', styleId); 
    event.dataTransfer.setData('styleName', styleName); 
    event.dataTransfer.effectAllowed = 'move'; 
    const dragGhostImage = document.createElement('img'); 
    dragGhostImage.src = styleImageSrc; 
    dragGhostImage.style.width = '40px'; 
    dragGhostImage.style.height = '40px'; 
    dragGhostImage.style.borderRadius = '50%'; 
    dragGhostImage.style.position = 'absolute'; 
    dragGhostImage.style.top = '-1000px'; 
    document.body.appendChild(dragGhostImage); 
    event.dataTransfer.setDragImage(dragGhostImage, 20, 20); 
    setTimeout(() => { document.body.removeChild(dragGhostImage); }, 0); 
}
function handlePositionDragStart(event) { 
    const positionElement = event.currentTarget; 
    const playerId = positionElement.dataset.assignedPlayerId; 
    if (playerId && playerId !== 'null') { 
        event.dataTransfer.setData('type', 'player'); 
        event.dataTransfer.setData('playerId', playerId); 
        event.dataTransfer.setData('originalPositionId', positionElement.dataset.position); 
        event.dataTransfer.setData('source', 'pitch'); 
        event.dataTransfer.effectAllowed = 'move'; 
        setTimeout(() => { 
            const img = positionElement.querySelector('img:not(.player-style-icon)'); 
            if (img) img.style.visibility = 'hidden'; 
        }, 0); 
    } else { 
        event.preventDefault(); 
    } 
}
function handlePositionDragOver(event) { 
    event.preventDefault(); 
    event.dataTransfer.dropEffect = 'move'; 
    event.currentTarget.classList.add('drag-over');
}
function handlePositionDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}
function handlePositionDrop(event) { 
    event.preventDefault(); 
    const targetPositionElement = event.currentTarget; 
    targetPositionElement.classList.remove('drag-over');
    const type = event.dataTransfer.getData('type'); 
    if (type === 'style') { 
        handleStyleDrop(event, targetPositionElement); 
    } else if (type === 'player') { 
        handlePlayerDrop(event, targetPositionElement); 
    } 
}
function handleStyleDrop(event, targetPositionElement) { 
    const styleId = event.dataTransfer.getData('styleId'); 
    const styleName = event.dataTransfer.getData('styleName'); 
    const targetPositionId = targetPositionElement.dataset.position; 
    const targetPlayerId = targetPositionElement.dataset.assignedPlayerId; 
    if (!targetPlayerId || targetPlayerId === 'null') { 
        alert("Só pode adicionar um estilo a um jogador que já esteja em campo."); 
        return; 
    } 
    const targetPlayer = userOwnedPlayers.find(p => p.id === targetPlayerId); 
    if (!targetPlayer) return; 
    const requiredPosition = styleToPositionMap[styleName]; 
    if (targetPlayer.posicao !== requiredPosition) { 
        alert(`O estilo "${styleName}" só pode ser aplicado a jogadores da posição "${requiredPosition}".`); 
        return; 
    } 
    if (Object.values(playerStyleAssignments).includes(styleId)) { 
        alert(`O estilo "${styleName}" já está a ser usado por outro jogador.`); 
        return; 
    } 
    if (playerStyleAssignments[targetPositionId]) { 
        const oldStyleIcon = targetPositionElement.querySelector('.player-style-icon'); 
        if (oldStyleIcon) oldStyleIcon.click(); 
    } 
    playerStyleAssignments[targetPositionId] = styleId; 
    const styleData = userOwnedPlayerStyles.find(s => s.id === styleId); 
    if (styleData) { 
        const styleIcon = document.createElement('img'); 
        styleIcon.src = styleData.imagem; 
        styleIcon.classList.add('player-style-icon'); 
        styleIcon.addEventListener('click', removePlayerStyle); 
        targetPositionElement.appendChild(styleIcon); 
    } 
    const styleCardInList = playerResultsContainer.querySelector(`.player-table-row[data-player-id="${styleId}"]`); 
    if (styleCardInList) styleCardInList.classList.add('style-in-use'); 
    hasUnsavedChanges = true; 
}
function handlePlayerDrop(event, targetPositionElement) { 
    const targetPositionId = targetPositionElement.dataset.position; 
    const targetPositionType = targetPositionElement.dataset.positionType; 
    const draggedPlayerId = event.dataTransfer.getData('playerId'); 
    const source = event.dataTransfer.getData('source'); 
    const originalPositionId = event.dataTransfer.getData('originalPositionId'); 
    const draggedPlayer = userOwnedPlayers.find(p => p.id === draggedPlayerId); 
    if (!draggedPlayer) { 
        const originalPosEl = pitchArea.querySelector(`.position[data-position="${originalPositionId}"] img:not(.player-style-icon)`); 
        if (originalPosEl) originalPosEl.style.visibility = 'visible'; 
        console.error("Drop Falhou: Jogador arrastado não encontrado."); 
        return; 
    } 
    if (source === 'list' && Object.values(assignedPlayers).includes(draggedPlayerId)) { 
        alert(`${draggedPlayer.nome} já está em campo!`); 
        return; 
    } 
    const originalPosImg = pitchArea.querySelector(`.position[data-position="${originalPositionId}"] img:not(.player-style-icon)`); 
    if (originalPosImg) originalPosImg.style.visibility = 'visible'; 
    if (posicaoMapping[draggedPlayer.posicao] !== targetPositionType) { 
        alert(`Este jogador é ${draggedPlayer.posicao} e não pode ser colocado nesta posição.`); 
        return; 
    } 
    const playerAlreadyInTargetId = targetPositionElement.dataset.assignedPlayerId; 
    if (originalPositionId === targetPositionId) return; 
    if (originalPositionId) { 
        removePlayerFromPosition(originalPositionId); 
    } 
    if (playerAlreadyInTargetId && playerAlreadyInTargetId !== 'null') { 
        removePlayerFromPosition(targetPositionId); 
    } 
    if (source === 'pitch' && originalPositionId && playerAlreadyInTargetId && playerAlreadyInTargetId !== 'null') { 
        const playerOriginallyInTarget = userOwnedPlayers.find(p => p.id === playerAlreadyInTargetId); 
        if (playerOriginallyInTarget) { 
            addPlayerToPosition(originalPositionId, playerOriginallyInTarget); 
        } 
    } 
    addPlayerToPosition(targetPositionId, draggedPlayer); 
    hasUnsavedChanges = true; 
}
function handlePositionDragEnd(event) { 
    const img = event.currentTarget.querySelector('img:not(.player-style-icon)'); 
    if (img) img.style.visibility = 'visible'; 
}
function handlePositionClick(event) { 
    const positionElement = event.currentTarget; 
    const assignedPlayerId = positionElement.dataset.assignedPlayerId; 
    if (assignedPlayerId && assignedPlayerId !== "null") { 
        // If it already has actions open, do nothing
        const existingActions = positionElement.querySelector('.position-actions');
        if (existingActions) {
            return;
        }
        
        // Remove other open menus on the pitch
        const otherActions = document.querySelector('.position-actions');
        if (otherActions) otherActions.remove();
        
        // Create actions menu
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'position-actions';
        actionsDiv.innerHTML = `
            <button class="action-btn info-btn" title="Ver Info"><i class="fas fa-info"></i></button>
            <button class="action-btn delete-btn" title="Remover"><i class="fas fa-trash"></i></button>
        `;
        
        // Add click events to buttons
        actionsDiv.querySelector('.info-btn').onclick = (e) => {
            e.stopPropagation();
            showPlayerCardPopup(assignedPlayerId, positionElement);
            actionsDiv.remove();
        };
        
        actionsDiv.querySelector('.delete-btn').onclick = (e) => {
            e.stopPropagation();
            removePlayerFromPosition(positionElement.dataset.position);
            actionsDiv.remove();
        };
        
        positionElement.appendChild(actionsDiv);
    } else { 
        showPlayerListModal(positionElement.dataset.positionType, positionElement); 
    } 
}

// --- Funções de Manipulação de Elementos e Modais ---
function addPlayerToPosition(positionId, player) { 
    const positionElement = pitchArea.querySelector(`.position[data-position="${positionId}"]`); 
    if (!positionElement || !player) return; 
    positionElement.innerHTML = ''; 
    const playerImg = document.createElement('img'); 
    playerImg.src = player.imagem || 'placeholder.png'; 
    playerImg.alt = player.nome; 
    positionElement.appendChild(playerImg); 
    positionElement.dataset.assignedPlayerId = player.id; 
    positionElement.draggable = true; 
    positionElement.addEventListener('dragstart', handlePositionDragStart); 
    positionElement.addEventListener('dragend', handlePositionDragEnd); 
    assignedPlayers[positionId] = player.id; 
    const playerCardInList = playerResultsContainer.querySelector(`.player-table-row[data-player-id="${player.id}"]`); 
    if (playerCardInList) { 
        playerCardInList.classList.add('player-in-use'); 
    } 
}
function removePlayerFromPosition(positionId) { 
    const positionElement = pitchArea.querySelector(`.position[data-position="${positionId}"]`); 
    if (!positionElement) return; 
    const removedPlayerId = assignedPlayers[positionId]; 
    if (playerStyleAssignments[positionId]) { 
        const styleIcon = positionElement.querySelector('.player-style-icon'); 
        if (styleIcon) styleIcon.click(); 
    } 
    positionElement.innerHTML = '+'; 
    positionElement.dataset.assignedPlayerId = null; 
    positionElement.draggable = false; 
    positionElement.removeEventListener('dragstart', handlePositionDragStart); 
    positionElement.removeEventListener('dragend', handlePositionDragEnd); 
    delete assignedPlayers[positionId]; 
    hasUnsavedChanges = true; 
    if (removedPlayerId) { 
        const playerCardInList = playerResultsContainer.querySelector(`.player-table-row[data-player-id="${removedPlayerId}"]`); 
        if (playerCardInList) { 
            playerCardInList.classList.remove('player-in-use'); 
        } 
    } 
}
function removePlayerStyle(event) { 
    event.stopPropagation(); 
    const styleIcon = event.currentTarget; 
    const positionElement = styleIcon.parentNode; 
    const positionId = positionElement.dataset.position; 
    if (positionId && playerStyleAssignments[positionId]) { 
        const styleId = playerStyleAssignments[positionId]; 
        delete playerStyleAssignments[positionId]; 
        const styleCardInList = playerResultsContainer.querySelector(`.player-table-row[data-player-id="${styleId}"]`); 
        if (styleCardInList) styleCardInList.classList.remove('style-in-use'); 
        styleIcon.remove(); 
        hasUnsavedChanges = true; 
    } 
}
function showPlayerListModal(positionType, positionElement) { 
    playerListModal.classList.add('active'); 
    playerCardListContainer.innerHTML = '<p>A carregar jogadores...</p>'; 
    populatePlayerCardList(positionType, positionElement); 
}
function populatePlayerCardList(positionType, positionElement) {
    const positionTypePortugues = Object.keys(posicaoMapping).find(key => posicaoMapping[key] === positionType);
    const filteredByPosition = userOwnedPlayers.filter(player => player.posicao === positionTypePortugues);
    const assignedIds = Object.values(assignedPlayers).filter(id => id !== null);
    const availablePlayers = filteredByPosition.filter(player => !assignedIds.includes(player.id));
    
    playerCardListContainer.innerHTML = '';
    if (availablePlayers.length === 0) {
        playerCardListContainer.innerHTML = '<p>Sem jogadores disponíveis para esta posição.</p>';
        return;
    }

    const gridContainer = document.createElement('div');
    gridContainer.classList.add('position-grid'); 

    availablePlayers.forEach(player => {
        const playerCard = createPlayerCardElement(player);
        const addButton = document.createElement('button');
        addButton.textContent = 'ADICIONAR';
        addButton.classList.add('btn-confirm', 'add-player-btn');
        addButton.style.marginTop = '5px';

        addButton.onclick = (event) => {
            event.stopPropagation();
            assignPlayerToPosition(player, positionElement);
            playerListModal.classList.remove('active');
        };

        playerCard.appendChild(addButton);
        gridContainer.appendChild(playerCard);
    });
    playerCardListContainer.appendChild(gridContainer);
}

function assignPlayerToPosition(player, positionElement) { 
    const positionId = positionElement.dataset.position; 
    if (Object.values(assignedPlayers).includes(player.id)) { 
        alert(`${player.nome} já está em campo!`); 
        return; 
    } 
    if (positionElement.dataset.assignedPlayerId && positionElement.dataset.assignedPlayerId !== 'null') { 
        alert("Esta posição já foi ocupada."); 
        return; 
    } 
    addPlayerToPosition(positionId, player); 
    hasUnsavedChanges = true; 
}
function showConfirmationModal(message, confirmCallback, cancelCallback) { 
    const existingModal = document.querySelector('.confirmation-modal-overlay'); 
    if (existingModal) document.body.removeChild(existingModal); 
    const modalOverlay = document.createElement('div'); 
    modalOverlay.className = 'modal-overlay confirmation-modal-overlay active'; 
    const modalContent = document.createElement('div'); 
    modalContent.className = 'modal-content'; 
    modalContent.innerHTML = `<p>${message}</p>`; 
    const buttonsContainer = document.createElement('div'); 
    buttonsContainer.className = 'modal-buttons'; 
    const confirmButton = document.createElement('button'); 
    confirmButton.className = 'btn-confirm'; 
    confirmButton.textContent = 'Sim'; 
    confirmButton.onclick = () => { 
        document.body.removeChild(modalOverlay); 
        if (confirmCallback) confirmCallback(); 
    }; 
    const cancelButton = document.createElement('button'); 
    cancelButton.className = 'btn-cancel'; 
    cancelButton.textContent = 'Não'; 
    cancelButton.onclick = () => { 
        document.body.removeChild(modalOverlay); 
        if (cancelCallback) cancelCallback(); 
    }; 
    buttonsContainer.appendChild(confirmButton); 
    buttonsContainer.appendChild(cancelButton); 
    modalContent.appendChild(buttonsContainer); 
    modalOverlay.appendChild(modalContent); 
    document.body.appendChild(modalOverlay); 
}

// --- Funções de Renderização e Criação de Elementos ---
function createPlayerTableRowElement(item) {
    const row = document.createElement('tr');
    row.classList.add('player-table-row');
    row.dataset.playerId = item.id;
    const isPlayer = item.tipo !== 'Estilo';
    
    if (isPlayer) {
        row.addEventListener('click', () => showPlayerCardPopup(item.id, row));
        row.draggable = true;
        row.addEventListener('dragstart', handlePlayerCardDragStart);
        enableTouchDrag(row, () => ({ type: 'player', playerId: item.id, source: 'list' }));
        
        if (item.casta) {
            const castaMap = { 'Jogador Ouro': 'golden', 'Jogador Prata': 'silver', 'Jogador Bronze': 'bronze', 'Jogador Platina': 'platina', 'Jogador Diamante': 'diamond' };
            const castaClass = castaMap[item.casta];
            if (castaClass) row.classList.add(castaClass);
        }
        
        const posTd = document.createElement('td');
        const posShort = posicaoMapping[item.posicao] || item.posicao;
        const posClass = posShort.toLowerCase();
        posTd.innerHTML = `<span class="pos-badge ${posClass}">${posShort}</span>`;
        row.appendChild(posTd);
        
        const nameTd = document.createElement('td');
        nameTd.classList.add('player-name-cell');
        
        const img = document.createElement('img');
        img.src = item.imagem || 'placeholder.png';
        img.alt = item.nome;
        img.classList.add('player-table-img');
        
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('player-name-text');
        nameSpan.textContent = item.nome;
        
        nameTd.appendChild(img);
        nameTd.appendChild(nameSpan);
        
        if (item.paisId && countries[item.paisId]) {
            const flagImg = document.createElement('img');
            flagImg.src = countries[item.paisId].imagem || 'placeholder.png';
            flagImg.classList.add('player-table-flag');
            nameTd.appendChild(flagImg);
        }
        row.appendChild(nameTd);
        
        const ovrTd = document.createElement('td');
        ovrTd.innerHTML = `<span class="ovr-badge">${item.overall || '--'}</span>`;
        row.appendChild(ovrTd);
        
        const assignedIds = Object.values(assignedPlayers).filter(id => id !== null);
        if (assignedIds.includes(item.id)) {
            row.classList.add('player-in-use');
        }
    } else {
        row.classList.add('style-item');
        row.draggable = true;
        row.addEventListener('dragstart', handleStyleCardDragStart);
        enableTouchDrag(row, () => ({ type: 'style', styleId: item.id, styleName: item.nome, source: 'list' }));
        
        if (Object.values(playerStyleAssignments).includes(item.id)) {
            row.classList.add('style-in-use');
        }
        
        const nameTd = document.createElement('td');
        nameTd.classList.add('player-name-cell');
        
        const img = document.createElement('img');
        img.src = item.imagem || 'placeholder.png';
        img.alt = item.nome;
        img.classList.add('player-table-img');
        
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('player-name-text');
        nameSpan.textContent = item.nome;
        
        nameTd.appendChild(img);
        nameTd.appendChild(nameSpan);
        row.appendChild(nameTd);
        
        const compatTd = document.createElement('td');
        const requiredPosition = styleToPositionMap[item.nome] || '';
        const requiredPosShort = posicaoMapping[requiredPosition] || requiredPosition;
        if (requiredPosShort) {
            const posClass = requiredPosShort.toLowerCase();
            compatTd.innerHTML = `<span class="pos-badge ${posClass}">${requiredPosShort}</span>`;
        } else {
            compatTd.textContent = 'Qualquer';
        }
        row.appendChild(compatTd);
        
        const emptyTd = document.createElement('td');
        row.appendChild(emptyTd);
    }
    return row;
}

function createPlayerCardElement(item) { 
    const card = document.createElement('div'); 
    card.classList.add('player-card'); 
    card.dataset.playerId = item.id; 
    const isPlayer = item.tipo !== 'Estilo'; 
    if (isPlayer) { 
        card.addEventListener('click', () => showPlayerCardPopup(item.id, card)); 
        card.draggable = true; 
        card.addEventListener('dragstart', handlePlayerCardDragStart); 
        enableTouchDrag(card, () => ({ type: 'player', playerId: item.id, source: 'list' }));
        if (item.casta) { 
            const castaMap = { 'Jogador Ouro': 'golden', 'Jogador Prata': 'silver', 'Jogador Bronze': 'bronze', 'Jogador Platina': 'platina', 'Jogador Diamante': 'diamond' }; 
            const castaClass = castaMap[item.casta]; 
            if (castaClass) card.classList.add(castaClass); 
        } 
        if (item.paisId && countries[item.paisId]) { 
            const flagImg = document.createElement('img'); 
            flagImg.src = countries[item.paisId].imagem || 'placeholder.png'; 
            flagImg.classList.add('country-flag'); 
            card.appendChild(flagImg); 
        } 
    } else { 
        card.classList.add('style-item'); 
        card.draggable = true; 
        card.addEventListener('dragstart', handleStyleCardDragStart); 
        enableTouchDrag(card, () => ({ type: 'style', styleId: item.id, styleName: item.nome, source: 'list' }));
        if (Object.values(playerStyleAssignments).includes(item.id)) { 
            card.classList.add('style-in-use'); 
        } 
    } 
    const img = document.createElement('img'); 
    img.src = item.imagem || 'placeholder.png'; 
    img.alt = item.nome; 
    card.appendChild(img); 
    const infoDiv = document.createElement('div'); 
    infoDiv.classList.add('player-info'); 
    const nameSpan = document.createElement('span'); 
    nameSpan.classList.add('player-name'); 
    nameSpan.textContent = item.nome; 
    infoDiv.appendChild(nameSpan); 
    if (isPlayer && item.posicao) { 
        const positionSpan = document.createElement('span'); 
        positionSpan.classList.add('player-position'); 
        positionSpan.textContent = item.posicao; 
        infoDiv.appendChild(positionSpan); 
    } 
    card.appendChild(infoDiv); 
    if (isPlayer && item.clube) { 
        fetchCompetitionLogo(item.clube).then(logoData => { 
            if (logoData) { 
                const competicaoLogo = document.createElement('img'); 
                competicaoLogo.src = logoData.imagem; 
                competicaoLogo.alt = logoData.nome; 
                competicaoLogo.classList.add('competition-logo'); 
                infoDiv.appendChild(competicaoLogo); 
            } 
        }); 
    } 
    return card; 
}
function renderPlayerResults() { 
    playerResultsContainer.innerHTML = ''; 
    
    const tableContainer = document.createElement('div');
    tableContainer.classList.add('player-results-table-container');
    
    const table = document.createElement('table');
    table.classList.add('player-table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Pos</th>
                <th>Nome</th>
                <th>OVR</th>
            </tr>
        </thead>
        <tbody id="player-table-body">
        </tbody>
    `;
    tableContainer.appendChild(table);
    playerResultsContainer.appendChild(tableContainer);
    
    const tbody = table.querySelector('#player-table-body');
    
    const positionOrder = ['Guarda-Redes', 'Defesa', 'Médio', 'Avançado']; 
    const groupedPlayers = userOwnedPlayers.reduce((acc, player) => { 
        (acc[player.posicao] = acc[player.posicao] || []).push(player); 
        return acc; 
    }, {}); 
    
    positionOrder.forEach(position => { 
        if (groupedPlayers[position]?.length > 0) { 
            groupedPlayers[position].sort((a, b) => a.nome.localeCompare(b.nome)).forEach(player => {
                tbody.appendChild(createPlayerTableRowElement(player));
            }); 
        } 
    }); 

    if (userOwnedPlayerStyles.length > 0) { 
        const styleTitle = document.createElement('h3'); 
        styleTitle.textContent = 'Estilos de Jogador'; 
        styleTitle.classList.add('position-group-title'); 
        playerResultsContainer.appendChild(styleTitle); 
        
        const styleTableContainer = document.createElement('div');
        styleTableContainer.classList.add('player-results-table-container');
        
        const styleTable = document.createElement('table');
        styleTable.classList.add('player-table');
        styleTable.innerHTML = `
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Compatibilidade</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="style-table-body">
            </tbody>
        `;
        styleTableContainer.appendChild(styleTable);
        playerResultsContainer.appendChild(styleTableContainer);
        
        const styleTbody = styleTable.querySelector('#style-table-body');
        userOwnedPlayerStyles.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(style => {
            styleTbody.appendChild(createPlayerTableRowElement(style));
        }); 
    } 
    
    filterPlayers(); 
}
function renderSellPlayers() {
    const sellPlayersList = document.getElementById('sell-players-list');
    if (!sellPlayersList) return;
    sellPlayersList.innerHTML = '';

    const positionOrder = ['Guarda-Redes', 'Defesa', 'Médio', 'Avançado'];
    const playersByPosition = {};
    positionOrder.forEach(pos => {
        playersByPosition[pos] = [];
    });

    userOwnedPlayers.forEach(player => {
        if (positionOrder.includes(player.posicao)) {
            playersByPosition[player.posicao].push(player);
        }
    });

    let hasPlayers = false;
    positionOrder.forEach(position => {
        if (playersByPosition[position].length > 0) {
            hasPlayers = true;
            const header = document.createElement('h3');
            header.textContent = position.toUpperCase();
            header.className = 'position-group-title';
            header.style.marginTop = '20px';
            header.style.marginBottom = '12px';
            sellPlayersList.appendChild(header);

            const listContainer = document.createElement('div');
            listContainer.className = 'players-list';

            playersByPosition[position].forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'player-list-item';

                let castaClassName = '';
                const castaValue = player.casta;
                if (castaValue === "Jogador Ouro") castaClassName = 'golden';
                else if (castaValue === "Jogador Prata") castaClassName = 'silver';
                else if (castaValue === "Jogador Bronze") castaClassName = 'bronze';
                else if (castaValue === "Jogador Platina") castaClassName = 'platina';
                else if (castaValue === "Jogador Diamante") castaClassName = 'diamond';
                
                if (castaClassName) playerItem.classList.add(castaClassName);

                const paisData = player.paisId && countries[player.paisId] ? countries[player.paisId] : null;

                playerItem.innerHTML = `
                    <div class="player-list-left">
                        <img src="${player.imagem || 'placeholder.png'}" alt="${player.nome}" class="player-image">
                        <div class="player-list-info">
                            <div class="player-name">${player.nome}</div>
                            <div class="player-position">${player.posicao}</div>
                        </div>
                        ${paisData ? `<img src="${paisData.imagem}" alt="${paisData.nome}" class="country-flag" title="${paisData.nome}">` : ''}
                    </div>
                    <div class="player-list-right">
                        <div class="player-price">
                            <i class="fas fa-coins"></i>
                            ${player.preco}
                        </div>
                        <button class="return-button" data-player-id="${player.id}" data-player-position="${player.posicao}">Vender</button>
                    </div>
                `;

                const returnButton = playerItem.querySelector('.return-button');
                returnButton.addEventListener('click', () => {
                    handleSellPlayer(player);
                });

                listContainer.appendChild(playerItem);
            });
            sellPlayersList.appendChild(listContainer);
        }
    });

    if (!hasPlayers) {
        const noPlayersMessage = document.createElement('p');
        noPlayersMessage.textContent = "Sem jogadores para vender.";
        noPlayersMessage.style.textAlign = 'center';
        noPlayersMessage.style.color = '#8892b0';
        noPlayersMessage.style.padding = '20px';
        sellPlayersList.appendChild(noPlayersMessage);
    }
}
async function handleSellPlayer(player) {
    const choicePopup = document.createElement('div');
    choicePopup.className = 'popup-overlay active';
    choicePopup.style.display = 'flex';
    choicePopup.innerHTML = `
        <div class="popup-content" style="max-width: 400px; padding: 25px; border-radius: 12px; background: #161b26; border: 1px solid rgba(255,255,255,0.1); color: white; box-shadow: 0 10px 30px rgba(0,0,0,0.5); position: relative;">
            <span class="close-btn" style="position: absolute; top: 12px; right: 18px; font-size: 24px; cursor: pointer; color: #8892b0; font-weight: bold; transition: color 0.2s;">&times;</span>
            <h2 style="font-size: 1.3rem; margin-bottom: 15px; color: #ffb703; text-align: center; font-family: 'Poppins', sans-serif;">Vender Jogador</h2>
            <p style="margin-bottom: 20px; font-size: 0.95rem; text-align: center; color: #8892b0; line-height: 1.5;">
                Escolha o destino da venda para <strong>${player.nome}</strong>:
            </p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <button class="popup-btn sell-banca" style="background-color: #17a2b8; color: white; padding: 12px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: background 0.2s; font-size: 15px;">Banca</button>
                <button class="popup-btn sell-gplayer" style="background-color: #2ecc71; color: #090c10; padding: 12px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: background 0.2s; font-size: 15px;">Outro gPlayer</button>
            </div>
        </div>
    `;
    document.body.appendChild(choicePopup);

    const sellBancaBtn = choicePopup.querySelector('.sell-banca');
    const sellGPlayerBtn = choicePopup.querySelector('.sell-gplayer');
    const closeBtn = choicePopup.querySelector('.close-btn');

    closeBtn.addEventListener('click', () => {
        choicePopup.remove();
    });

    sellGPlayerBtn.addEventListener('click', async () => {
        choicePopup.remove();
        await showGPlayersListPopup(player);
    });

    sellBancaBtn.addEventListener('click', async () => {
        choicePopup.remove();
        await handleSellToBanca(player);
    });
}

async function handleSellToBanca(player) {
    let configData = null;
    let currentBankMoney = 0;
    let discount = 0;
    let allowedAfterDateStr = '';

    try {
        const bancaRef = doc(db, "paineis", "Banca");
        const docSnap = await getDoc(bancaRef);
        if (docSnap.exists()) {
            configData = docSnap.data();
            currentBankMoney = configData.valor || 0;
            discount = configData.descontoBanca || 0;
            allowedAfterDateStr = configData.dataVendaBanca || '';
        }
    } catch (e) {
        console.error("Erro ao carregar dados da Banca:", e);
        alert("Erro ao conectar ao servidor. Tente novamente.");
        return;
    }

    if (allowedAfterDateStr) {
        const allowedDate = new Date(allowedAfterDateStr);
        const currentDate = new Date();
        if (currentDate < allowedDate) {
            const formattedDate = allowedDate.toLocaleString('pt-PT');
            alert(`A venda à banca está bloqueada! Só será permitida após: ${formattedDate}`);
            return;
        }
    }

    const finalPrice = Math.max(0, player.preco - discount);

    if (currentBankMoney < finalPrice) {
        alert(`A Banca não tem dinheiro suficiente para comprar este jogador. (Saldo da Banca: ${currentBankMoney} gCoins, Preço de Venda: ${finalPrice} gCoins)`);
        return;
    }

    const confirmPopup = document.createElement('div');
    confirmPopup.className = 'popup-overlay active';
    confirmPopup.style.display = 'flex';
    confirmPopup.innerHTML = `
        <div class="popup-content" style="max-width: 400px; padding: 25px; border-radius: 12px; background: #161b26; border: 1px solid rgba(255,255,255,0.1); color: white; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h2 style="font-size: 1.25rem; margin-bottom: 15px; color: #ffb703; font-family: 'Poppins', sans-serif;">Confirmar Venda à Banca</h2>
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p style="margin-bottom: 8px; font-size: 0.95rem; color: #8892b0;">Preço original: <strong style="color: white;">${player.preco} gCoins</strong></p>
                <p style="margin-bottom: 8px; font-size: 0.95rem; color: #8892b0;">Desconto aplicado: <strong style="color: #e74c3c;">-${discount} gCoins</strong></p>
                <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 10px 0;">
                <p style="margin-bottom: 0; font-size: 1.15rem; color: #2ecc71; font-weight: bold;">Valor a receber: ${finalPrice} gCoins</p>
            </div>
            <div style="display: flex; justify-content: center; gap: 12px;">
                <button class="popup-btn confirm-sell" style="background-color: #2ecc71; color: #090c10; padding: 10px 20px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: opacity 0.2s;">Confirmar</button>
                <button class="popup-btn cancel-sell" style="background-color: #e74c3c; color: white; padding: 10px 20px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: opacity 0.2s;">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(confirmPopup);

    const confirmBtn = confirmPopup.querySelector('.confirm-sell');
    const cancelBtn = confirmPopup.querySelector('.cancel-sell');

    cancelBtn.addEventListener('click', () => {
        confirmPopup.remove();
    });

    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        try {
            const latestSeason = await getLatestSeason(db);

            const batch = writeBatch(db);

            batch.update(doc(db, 'jogadores', player.id), {
                compradopor: null
            });

            batch.set(doc(collection(db, 'movimentos')), {
                de: currentUserUid,
                estado: 'Devolvido',
                jogadorId: player.id,
                mediapontos: null,
                movimentoData: serverTimestamp(),
                posicao: player.posicao,
                preco: finalPrice,
                valorreal: finalPrice,
                temporada: compactSeason(latestSeason),
                userId: currentUserUid,
                tipo: 'Mercado',
                descricao: `Vendido à Banca com desconto de ${discount} gCoins`
            });

            const newBankBal = currentBankMoney - finalPrice;
            batch.update(doc(db, "paineis", "Banca"), { valor: newBankBal });

            batch.set(doc(collection(db, 'movimentos')), {
                preco: -finalPrice,
                movimentoData: serverTimestamp(),
                tipo: "Banca",
                temporada: compactSeason(latestSeason),
                descricao: `Compra de jogador ${player.nome}`,
                para_userId: currentUserUid
            });

            const userRef = doc(db, 'users', currentUserUid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
            const seasonData = getSeasonData(userSnap.data(), latestSeason);
            const currentGCoins = seasonData.GCoins || 0;
            batch.update(userRef, {
                [latestSeason]: {
                    ...seasonData,
                    GCoins: currentGCoins + finalPrice
                }
            });
            }

            const positionAssigned = Object.keys(assignedPlayers).find(key => assignedPlayers[key] === player.id);
            if (positionAssigned) {
                removePlayerFromPosition(positionAssigned);
            }

            await batch.commit();

            const successMessage = document.createElement('div');
            successMessage.className = 'success-message';
            successMessage.textContent = `Jogador Vendido! +${finalPrice} gCoins`;
            successMessage.style.position = 'fixed';
            successMessage.style.top = '50%';
            successMessage.style.left = '50%';
            successMessage.style.transform = 'translate(-50%, -50%)';
            successMessage.style.padding = '20px';
            successMessage.style.backgroundColor = '#2ecc71';
            successMessage.style.color = '#090c10';
            successMessage.style.borderRadius = '5px';
            successMessage.style.zIndex = '4000';
            document.body.appendChild(successMessage);

            setTimeout(async () => {
                confirmPopup.remove();
                successMessage.remove();
                await fetchUserOwnedPlayers();
                renderPlayerResults();
                renderSellPlayers();
            }, 1500);

        } catch (error) {
            console.error('Error selling player to Banca:', error);
            alert('Erro ao vender jogador. Tente novamente.');
            confirmPopup.remove();
        }
    });
}

async function showGPlayersListPopup(player) {
    try {
        const userRef = doc(db, 'users', currentUserUid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (!userData.permissoes || userData.permissoes.vender !== 'yes') {
                alert("Não tem permissão para vender jogadores! Contacte o administrador.");
                return;
            }
        }
    } catch (e) {
        console.error(e);
        alert("Erro ao validar permissões de venda.");
        return;
    }

    let configData = null;
    let allowedAfterDateStr = '';
    try {
        const docSnap = await getDoc(doc(db, "paineis", "Banca"));
        if (docSnap.exists()) {
            configData = docSnap.data();
            allowedAfterDateStr = configData.dataVendaBanca || '';
        }
    } catch (e) {
        console.error(e);
    }
    if (allowedAfterDateStr) {
        const allowedDate = new Date(allowedAfterDateStr);
        const currentDate = new Date();
        if (currentDate < allowedDate) {
            const formattedDate = allowedDate.toLocaleString('pt-PT');
            alert(`A venda de jogadores está bloqueada! Só será permitida após: ${formattedDate}`);
            return;
        }
    }

    const listPopup = document.createElement('div');
    listPopup.className = 'popup-overlay active';
    listPopup.style.display = 'flex';
    listPopup.innerHTML = `
        <div class="popup-content" style="max-width: 400px; padding: 25px; border-radius: 12px; background: #161b26; border: 1px solid rgba(255,255,255,0.1); color: white; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 80vh; display: flex; flex-direction: column;">
            <h2 style="font-size: 1.3rem; margin-bottom: 15px; color: #ffb703; text-align: center; font-family: 'Poppins', sans-serif;">Selecionar gPlayer</h2>
            <p style="margin-bottom: 15px; font-size: 0.9rem; text-align: center; color: #8892b0;">
                Selecione o gPlayer para propor a venda de <strong>${player.nome}</strong> por <strong>${player.preco} gCoins</strong>:
            </p>
            <div class="gplayers-list-container" style="flex: 1; overflow-y: auto; margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px;">
                <p style="text-align: center; color: #8892b0;">A carregar gPlayers...</p>
            </div>
            <button class="popup-btn cancel-list" style="background-color: #e74c3c; color: white; padding: 12px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: background 0.2s; font-size: 15px; width: 100%;">Cancelar</button>
        </div>
    `;
    document.body.appendChild(listPopup);

    const cancelBtn = listPopup.querySelector('.cancel-list');
    cancelBtn.addEventListener('click', () => {
        listPopup.remove();
    });

    const listContainer = listPopup.querySelector('.gplayers-list-container');

    try {
        const usersRef = collection(db, 'users');
        const latestSeason = await getLatestSeason(db);
        const querySnapshot = await getDocs(usersRef);
        const users = [];
        querySnapshot.forEach((userDoc) => {
            const userData = mergeUserSeasonData(userDoc.data(), latestSeason);
            if (userData.natabela === "Yes" && userData.nometabela && userDoc.id !== currentUserUid) {
                users.push({ id: userDoc.id, displayNome: userData.nometabela });
            }
        });
        users.sort((a, b) => a.displayNome.localeCompare(b.displayNome));

        listContainer.innerHTML = '';
        if (users.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #8892b0;">Nenhum outro gPlayer encontrado.</p>';
            return;
        }

        users.forEach(u => {
            const btn = document.createElement('button');
            btn.className = 'gplayer-item-btn';
            btn.style.cssText = 'background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; text-align: left; cursor: pointer; font-weight: 600; transition: background 0.2s;';
            btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.15)');
            btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,0.05)');
            btn.textContent = u.displayNome;

            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                try {
                    await addDoc(collection(db, 'inbox'), {
                        de: currentUserUid,
                        para: u.id,
                        jogadorId: player.id,
                        preco: player.preco,
                        status: true,
                        tipo: 'Venda',
                        data: serverTimestamp()
                    });
                    
                    listPopup.remove();
                    alert(`Proposta de venda do jogador ${player.nome} enviada com sucesso para ${u.displayNome}.`);
                } catch (err) {
                    console.error("Erro ao enviar proposta:", err);
                    alert("Erro ao enviar a proposta. Tente novamente.");
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            });

            listContainer.appendChild(btn);
        });
    } catch (err) {
        console.error(err);
        listContainer.innerHTML = '<p style="text-align: center; color: red;">Erro ao carregar gPlayers.</p>';
    }
}

function renderFormation(formationName) { 
    assignedPlayers = {}; 
    playerStyleAssignments = {}; 
    pitchArea.innerHTML = '<div class="center-circle"></div>'; 
    if (!formationName || !formations[formationName]) return; 
    currentFormation = formationName; 
    formations[formationName].forEach(pos => { 
        const positionElement = document.createElement('div'); 
        positionElement.classList.add('position'); 
        positionElement.dataset.position = pos.position; 
        positionElement.style.top = pos.top; 
        positionElement.style.left = pos.left; 
        positionElement.dataset.positionType = pos.positionType; 
        positionElement.innerHTML = '+'; 
        positionElement.draggable = false; 
        positionElement.dataset.assignedPlayerId = null; 
        positionElement.addEventListener('dragover', handlePositionDragOver); 
        positionElement.addEventListener('dragleave', handlePositionDragLeave); 
        positionElement.addEventListener('drop', handlePositionDrop); 
        positionElement.addEventListener('click', handlePositionClick); 
        enableTouchDrag(positionElement, (el) => {
            const playerId = el.dataset.assignedPlayerId;
            if (!playerId || playerId === 'null') return null;
            return {
                type: 'player',
                playerId: playerId,
                originalPositionId: el.dataset.position,
                source: 'pitch'
            };
        });
        pitchArea.appendChild(positionElement); 
    }); 
}

// --- Funções de Dados (Firebase) ---
async function fetchUserOwnedPlayers() { 
    if (!currentUserUid) return; 
    const q = query(collection(db, 'jogadores'), where('compradopor', '==', currentUserUid)); 
    const snapshot = await getDocs(q); 
    const fetchedPlayers = []; 
    const uniqueClubs = new Set(); 
    const uniqueCountryIds = new Set(); 
    snapshot.forEach(doc => { 
        const data = doc.data(); 
        fetchedPlayers.push({ ...data, id: doc.id }); 
        if (data.clube) uniqueClubs.add(data.clube); 
        if (data.paisId) uniqueCountryIds.add(data.paisId); 
    }); 
    userOwnedPlayers = fetchedPlayers; 
    clubs = uniqueClubs; 
}
async function fetchPlayerStyles() { 
    if (!currentUserUid) return; 
    const q = query(collection(db, 'movimentos'), where('userId', '==', currentUserUid), where('managerTipo', '==', 'Estilos de Jogador')); 
    const snapshot = await getDocs(q); 
    userOwnedPlayerStyles = snapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().itemManager, imagem: doc.data().imagem, tipo: 'Estilo' })); 
}
async function fetchCountries() { 
    const snapshot = await getDocs(collection(db, 'paises')); 
    countries = {}; 
    snapshot.forEach(doc => { 
        countries[doc.id] = doc.data(); 
    }); 
}
async function fetchPaineisCoefficients() { 
    try { 
        const docRef = doc(db, 'paineis', 'paineis coeficiente'); 
        const docSnap = await getDoc(docRef); 
        if (docSnap.exists() && docSnap.data().paineis_coeficiente) { 
            paineisCoeficienteData = docSnap.data().paineis_coeficiente; 
        } else { 
            console.log("Documento 'paineis coeficiente' não encontrado."); 
        } 
    } catch (error) { 
        console.error("Erro ao buscar coeficientes:", error); 
    } 
}
async function fetchFormationsFromFirestore() { 
    if (!currentUserUid) return []; 
    try { 
        const docSnap = await getDoc(doc(db, 'users', currentUserUid)); 
        if (docSnap.exists()) { 
            const latestSeason = await getLatestSeason(db);
            const taticasArray = getSeasonData(docSnap.data(), latestSeason).tática;
            if (Array.isArray(taticasArray) && taticasArray.length > 0) { 
                return taticasArray.map(name => ({ value: name, label: name })); 
            } 
        } 
    } catch (error) { 
        console.error("Erro ao buscar formações:", error); 
    } 
    return []; 
}
async function fetchActiveFormationFromPlanteis() { 
    if (!currentUserUid) return null; 
    try { 
        const palpitesSnap = await getDocs(query(collection(db, 'palpites'), orderBy('temporada', 'desc'), limit(1))); 
        if (palpitesSnap.empty) return null; 
        const latestSeason = palpitesSnap.docs[0].data().temporada; 
        const q = query(collection(db, 'planteis'), where('userId', '==', currentUserUid), where('estado', '==', 'ativo'), where('temporada', '==', latestSeason), limit(1)); 
        const activePlanteisSnap = await getDocs(q); 
        return activePlanteisSnap.empty ? null : activePlanteisSnap.docs[0].data().formacao; 
    } catch (error) { 
        console.error("Erro ao buscar formação ativa:", error); 
    } 
    return null; 
}
async function fetchCompetitionLogo(clubName) { 
    try { 
        const clubSnap = await getDocs(query(collection(db, 'clubes'), where('nome', '==', clubName), limit(1))); 
        if (!clubSnap.empty) { 
            const { competicaoId, imagem } = clubSnap.docs[0].data(); 
            if (competicaoId) { 
                const competicaoDoc = await getDoc(doc(db, 'competicoes', competicaoId)); 
                if (competicaoDoc.exists()) return { ...competicaoDoc.data(), clubeImagem: imagem }; 
            } 
        } 
    } catch (error) { 
        console.error(`Erro logo ${clubName}:`, error); 
    } 
    return null; 
}
async function saveFormation() { 
    if (!currentUserUid || !currentFormation) { 
        alert("Por favor, selecione uma formação."); 
        return; 
    } 
    try { 
        const palpitesSnap = await getDocs(query(collection(db, 'palpites'), orderBy('temporada', 'desc'), limit(1))); 
        if (palpitesSnap.empty) throw new Error('Temporada não encontrada.'); 
        const latestSeason = palpitesSnap.docs[0].data().temporada; 
        const planteisRef = collection(db, 'planteis'); 
        const q = query(planteisRef, where('userId', '==', currentUserUid), where('formacao', '==', currentFormation), where('temporada', '==', latestSeason)); 
        const planteisSnap = await getDocs(q); 
        const plantelData = { userId: currentUserUid, formacao: currentFormation, temporada: latestSeason, estado: 'desativo', dataDeEdicao: serverTimestamp(), estilos: playerStyleAssignments }; 
        formations[currentFormation]?.forEach(p => { 
            plantelData[p.position] = assignedPlayers[p.position] || null; 
        }); 
        if (!planteisSnap.empty) { 
            const docRef = planteisSnap.docs[0].ref; 
            plantelData.estado = planteisSnap.docs[0].data().estado || 'desativo'; 
            await updateDoc(docRef, plantelData); 
        } else { 
            await addDoc(planteisRef, plantelData); 
        } 
        hasUnsavedChanges = false; 
        alert("Formação guardada com sucesso!"); 
    } catch (error) { 
        console.error("Erro ao guardar formação:", error); 
        alert("Erro ao guardar formação."); 
    } 
}
async function loadFormation() { 
    if (!currentUserUid || !currentFormation) { 
        renderFormation(null); 
        return; 
    } 
    playerResultsContainer.querySelectorAll('.player-table-row.player-in-use').forEach(card => { 
        card.classList.remove('player-in-use'); 
    }); 
    try { 
        const palpitesSnap = await getDocs(query(collection(db, 'palpites'), orderBy('temporada', 'desc'), limit(1))); 
        if (palpitesSnap.empty) throw new Error("Temporada não encontrada."); 
        const latestSeason = palpitesSnap.docs[0].data().temporada; 
        const q = query(collection(db, 'planteis'), where('userId', '==', currentUserUid), where('formacao', '==', currentFormation), where('temporada', '==', latestSeason), limit(1)); 
        const snapshot = await getDocs(q); 
        renderFormation(currentFormation); 
        if (!snapshot.empty) { 
            const plantelData = snapshot.docs[0].data(); 
            formations[currentFormation]?.forEach(posInfo => { 
                const playerId = plantelData[posInfo.position]; 
                if (playerId) { 
                    const player = userOwnedPlayers.find(p => p.id === playerId); 
                    if (player) addPlayerToPosition(posInfo.position, player); 
                } 
            }); 
            playerStyleAssignments = plantelData.estilos || {}; 
            Object.entries(playerStyleAssignments).forEach(([positionId, styleId]) => { 
                const positionElement = pitchArea.querySelector(`.position[data-position="${positionId}"]`); 
                const styleData = userOwnedPlayerStyles.find(s => s.id === styleId); 
                if (positionElement && styleData) { 
                    const styleIcon = document.createElement('img'); 
                    styleIcon.src = styleData.imagem; 
                    styleIcon.classList.add('player-style-icon'); 
                    styleIcon.addEventListener('click', removePlayerStyle); 
                    positionElement.appendChild(styleIcon); 
                    const styleCardInList = playerResultsContainer.querySelector(`.player-table-row[data-player-id="${styleId}"]`); 
                    if(styleCardInList) styleCardInList.classList.add('style-in-use'); 
                } 
            }); 
        } 
        hasUnsavedChanges = false; 
    } catch (error) { 
        console.error("Erro ao carregar formação:", error); 
    } 
}

// --- Lógica de UI e Filtros ---
function populateCountryFilter() { 
    countryFilterSelect.innerHTML = '<option value="">País (Todos)</option>'; 
    const ownedCountryIds = new Set(userOwnedPlayers.map(p => p.paisId).filter(Boolean));
    Object.entries(countries)
        .filter(([id]) => ownedCountryIds.has(id))
        .sort(([, a], [, b]) => a.nome.localeCompare(b.nome))
        .forEach(([id, data]) => { 
            const option = document.createElement('option'); 
            option.value = id; 
            option.textContent = data.nome; 
            countryFilterSelect.appendChild(option); 
        }); 
}
function populateClubFilter() { 
    clubFilterSelect.innerHTML = '<option value="">Clube (Todos)</option>'; 
    [...clubs].sort().forEach(clubName => { 
        const option = document.createElement('option'); 
        option.value = clubName; 
        option.textContent = clubName; 
        clubFilterSelect.appendChild(option); 
    }); 
}
function populatePositionFilter() {
    positionFilterSelect.innerHTML = '<option value="">Posição (Todas)</option>';
    const positions = ['Guarda-Redes', 'Defesa', 'Médio', 'Avançado'];
    positions.forEach(pos => {
        const option = document.createElement('option');
        option.value = pos;
        option.textContent = pos;
        positionFilterSelect.appendChild(option);
    });
}
async function populateFormationDropdownFromFirestore(formationsFromUser = null) { 
    const availableFormations = formationsFromUser || await fetchFormationsFromFirestore(); 
    formationSelect.innerHTML = '<option value="" disabled selected>Selecionar Formação</option>'; 
    availableFormations.forEach(f => { 
        const option = document.createElement('option'); 
        option.value = f.value; 
        option.textContent = f.label; 
        formationSelect.appendChild(option); 
    });
    return availableFormations;
}
function filterPlayers() { 
    const searchTerm = playerSearchInput.value.toLowerCase(); 
    const selectedCountryId = countryFilterSelect.value; 
    const selectedClub = clubFilterSelect.value; 
    const selectedPosition = positionFilterSelect.value; 
    playerResultsContainer.querySelectorAll('.player-table-row:not(.style-item)').forEach(row => { 
        const player = userOwnedPlayers.find(p => p.id === row.dataset.playerId); 
        if (!player) { 
            row.style.display = 'none'; 
            return; 
        } 
        const nameMatch = player.nome.toLowerCase().includes(searchTerm); 
        const countryMatch = !selectedCountryId || player.paisId === selectedCountryId; 
        const clubMatch = !selectedClub || player.clube === selectedClub; 
        const positionMatch = !selectedPosition || player.posicao === selectedPosition; 
        row.style.display = (nameMatch && countryMatch && clubMatch && positionMatch) ? '' : 'none'; 
    }); 
}
async function getUserStatus(userId) { 
    const userDoc = await getDoc(doc(db, 'users', userId)); 
    if (userDoc.exists() && userDoc.data().aceite === "Yes") { 
        return userDoc.data().estatuto; 
    } 
    return null; 
}

// --- Inicialização da Página ---
onAuthStateChanged(auth, async (user) => { 
    if (user) { 
        currentUserUid = user.uid; 
        currentUserStatus = await getUserStatus(user.uid); 
        if (!currentUserStatus) { 
            window.location.href = '404.html'; 
            return; 
        } 
        let hasContentAccess = true;
        try { 
            void updateDoc(doc(db, 'users', user.uid), { ultimoacesso: serverTimestamp() })
                .catch((error) => console.error('Erro ao actualizar o último acesso:', error)); 
            const paineisMenuDoc = await getDoc(doc(db, 'paineis', 'paineis menu')); 
            if (paineisMenuDoc.exists()) { 
                const menuData = paineisMenuDoc.data(); 
                if (menuData.team === "off" && currentUserStatus !== 'ruler') { 
                    window.location.href = '404.html'; 
                    return; 
                } 
                window.updateMenuVisibility(menuData); 
            } 
            hasContentAccess = await checkPageContentAccess('myteam', currentUserStatus, db);
            if (!hasContentAccess) {
                return;
            }
            await logUserAction(`Entrou em ${document.title}`);
            await Promise.all([ fetchCountries(), fetchUserOwnedPlayers(), fetchPlayerStyles(), fetchPaineisCoefficients() ]); 
            const [activeFormation, formationsFromUser] = await Promise.all([
                fetchActiveFormationFromPlanteis(),
                fetchFormationsFromFirestore()
            ]);
            await populateFormationDropdownFromFirestore(formationsFromUser);
            populateCountryFilter(); 
            populateClubFilter(); 
            populatePositionFilter();
            renderPlayerResults(); 
            let initialFormationToLoad = activeFormation || (formationsFromUser[0]?.value || null); 
            if (initialFormationToLoad) { 
                formationSelect.value = initialFormationToLoad; 
                currentFormation = initialFormationToLoad; 
                renderFormation(initialFormationToLoad);
            } else { 
                renderFormation(null); 
            } 
            loadingScreen.style.display = 'none';
            content.style.display = 'block';
            if (initialFormationToLoad) await loadFormation();
        } catch (error) { 
            console.error("Erro na inicialização:", error); 
        } finally { 
            loadingScreen.style.display = 'none'; 
            if (hasContentAccess) content.style.display = 'block';
        } 
    } else { 
        window.location.href = 'index.html'; 
    } 
});

// --- Adição de Event Listeners ---
const tabMyTeam = document.getElementById('tab-my-team');
const tabSellPlayers = document.getElementById('tab-sell-players');
const tabRivalSquads = document.getElementById('tab-rival-squads');
const teamSection = document.querySelector('.team-section');
const sellPlayersSection = document.getElementById('sell-players-section');
const rivalSquadsSection = document.getElementById('rival-squads-section');
const rivalSquadsRoot = document.getElementById('myteam-rivals-view');

function setActiveMyTeamTab(activeTab) {
    const isMyTeamTab = activeTab === 'my-team';
    const isSellPlayersTab = activeTab === 'sell-players';
    const isRivalSquadsTab = activeTab === 'rival-squads';

    tabMyTeam?.classList.toggle('active', isMyTeamTab);
    tabSellPlayers?.classList.toggle('active', isSellPlayersTab);
    tabRivalSquads?.classList.toggle('active', isRivalSquadsTab);

    if (teamSection) {
        teamSection.style.display = isMyTeamTab ? 'flex' : 'none';
    }
    if (sellPlayersSection) {
        sellPlayersSection.style.display = isSellPlayersTab ? 'block' : 'none';
    }
    if (rivalSquadsSection) {
        rivalSquadsSection.style.display = isRivalSquadsTab ? 'block' : 'none';
    }
}

async function ensureRivalSquadsViewReady() {
    if (rivalSquadsView || !rivalSquadsRoot) {
        return rivalSquadsView;
    }

    rivalSquadsView = await initRivalSquadsView({
        root: rivalSquadsRoot,
        logUserAction: logUserAction
    });

    return rivalSquadsView;
}

if (tabMyTeam && tabSellPlayers && tabRivalSquads && teamSection && sellPlayersSection && rivalSquadsSection) {
    tabMyTeam.addEventListener('click', () => {
        setActiveMyTeamTab('my-team');
    });

    tabSellPlayers.addEventListener('click', () => {
        setActiveMyTeamTab('sell-players');
        renderSellPlayers();
    });

    tabRivalSquads.addEventListener('click', async () => {
        setActiveMyTeamTab('rival-squads');
        await ensureRivalSquadsViewReady();
    });
}

playerSearchInput.addEventListener('input', filterPlayers);
countryFilterSelect.addEventListener('change', filterPlayers);
clubFilterSelect.addEventListener('change', filterPlayers);
positionFilterSelect.addEventListener('change', filterPlayers);
saveFormationButton.addEventListener('click', saveFormation);
closePlayerListModalBtn.addEventListener('click', () => playerListModal.classList.remove('active'));
playerStatCardOverlay.addEventListener('click', (e) => { if (e.target === playerStatCardOverlay) { playerStatCardOverlay.classList.remove('active'); } });
playerStatCard.querySelector('.card-close-btn').addEventListener('click', () => { playerStatCardOverlay.classList.remove('active'); });
chooseBtn.addEventListener('click', async () => { 
    if (!currentUserUid || !currentFormation) { 
        alert("Selecione uma formação."); 
        return; 
    } 
    if (hasUnsavedChanges) { 
        alert("Guarde as alterações antes de escolher."); 
        return; 
    } 
    try { 
        const palpitesSnap = await getDocs(query(collection(db, 'palpites'), orderBy('temporada', 'desc'), limit(1))); 
        if (palpitesSnap.empty) throw new Error('Temporada não encontrada.'); 
        const latestSeason = palpitesSnap.docs[0].data().temporada; 
        const planteisRef = collection(db, 'planteis'); 
        const q = query(planteisRef, where('userId', '==', currentUserUid), where('formacao', '==', currentFormation), where('temporada', '==', latestSeason), limit(1)); 
        const currentSnap = await getDocs(q); 
        if (currentSnap.empty) { 
            alert(`A formação ${currentFormation} não está guardada. Guarde-a primeiro.`); 
            return; 
        } 
        const batch = writeBatch(db); 
        const allPlanteisSnap = await getDocs(query(planteisRef, where('userId', '==', currentUserUid), where('temporada', '==', latestSeason))); 
        allPlanteisSnap.forEach(doc => batch.update(doc.ref, { estado: 'desativo' })); 
        batch.update(currentSnap.docs[0].ref, { estado: 'ativo' }); 
        await batch.commit(); 
        alert(`Formação ${currentFormation} definida como ativa!`); 
    } catch (error) { 
        console.error('Erro ao definir formação ativa:', error); 
        alert('Erro: ' + error.message); 
    } 
});

formationSelect.addEventListener('change', async (e) => {
    const newFormation = e.target.value;
    if (newFormation) { 
        logUserAction(`Selecionou a formação: ${newFormation}`);
    }
    if (!newFormation || newFormation === currentFormation) return;
    const switchFormation = async () => {
        hasUnsavedChanges = false;
        currentFormation = newFormation;
        await loadFormation();
    };
    if (hasUnsavedChanges) {
        showConfirmationModal(
            'Existem alterações não guardadas. Quer guardá-las antes de mudar?',
            async () => { 
                await saveFormation();
                await switchFormation();
            },
            async () => { 
                await switchFormation();
            }
        );
    } else {
        await switchFormation();
    }
});

document.querySelectorAll('.menu-item').forEach(item => { 
    item.addEventListener('click', (e) => { 
        const destination = item.href; 
        if (hasUnsavedChanges && destination && !destination.endsWith('#') && destination !== window.location.href) { 
            e.preventDefault(); 
            showConfirmationModal('Tem alterações não guardadas. Quer guardá-las antes de sair?', async () => { 
                await saveFormation(); 
                window.location.href = destination; 
            }, () => { 
                hasUnsavedChanges = false; 
                window.location.href = destination; 
            }); 
        } 
    }); 
});

document.addEventListener('click', async (event) => {
    const clickableElement = event.target.closest('button, a.menu-item, .player-card, .position');
    if (!clickableElement) return;
    let actionName = '';
    if (clickableElement.matches('.player-card') && !clickableElement.matches('.style-item') && !event.target.closest('.add-player-btn')) {
        const playerName = clickableElement.querySelector('.player-name')?.textContent.trim();
        actionName = `Abriu detalhes de ${playerName || 'jogador'}`;
    } else if (clickableElement.matches('#saveFormationBtn')) {
        actionName = 'Clicou em Guardar Formação';
    } else if (clickableElement.matches('#chooseBtn')) {
        actionName = 'Clicou em Escolher Formação Ativa';
    } else if (clickableElement.matches('.add-player-btn')) {
        actionName = 'Adicionou jogador à equipa a partir do modal';
    } else if (clickableElement.matches('.position')) {
        const positionId = clickableElement.dataset.position;
        const hasPlayer = clickableElement.dataset.assignedPlayerId && clickableElement.dataset.assignedPlayerId !== 'null';
        actionName = hasPlayer ? `Removeu jogador da posição ${positionId}` : `Abriu modal para a posição ${positionId}`;
    } else if (clickableElement.matches('.menu-item')) {
        actionName = `Navegou para: ${clickableElement.querySelector('.menu-text')?.textContent.trim() || 'Menu'}`;
    } else {
        const buttonText = clickableElement.textContent.trim();
        if (buttonText) {
            actionName = `Clicou em: ${buttonText}`;
        }
    }
    if (!actionName) return;
    const isNavLink = clickableElement.tagName === 'A' && clickableElement.href && clickableElement.target !== '_blank';
    if (isNavLink) {
        if (hasUnsavedChanges) {
            return; 
        }
        event.preventDefault();
        await logUserAction(actionName);
        window.location.href = clickableElement.href;
    } else {
        await logUserAction(actionName);
    }
});

// Close active position action buttons when clicking outside
document.addEventListener('click', (event) => {
    const activeActions = document.querySelector('.position-actions');
    if (activeActions) {
        const positionEl = activeActions.parentElement;
        if (!positionEl.contains(event.target)) {
            activeActions.remove();
        }
    }
});
