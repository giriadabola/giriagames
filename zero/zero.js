// zero/zero.js
import { db, auth } from '../core/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, serverTimestamp, getDocs, query, where, orderBy, writeBatch, updateDoc, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const loadingScreen = document.getElementById('loading-screen');
const content = document.querySelector('.content');
let currentGame = null;
let selectedPredictions = [];
let maxPredictions = 0;
let countdownInterval = null;
let isSubmitting = false;

function renderPredictionCards(predictions) {
    document.getElementById('category-shortcuts-container').style.display = 'none';
    document.getElementById('odds-list-container').style.display = 'none';
    document.getElementById('submit-button-container').style.display = 'none';
    const displayArea = document.getElementById('prediction-display-area');
    let cardsHtml = `<div class="prediction-display-container"><h3>Os teus Palpites Registrados</h3>`;
    Object.keys(predictions).filter(key => key.startsWith('palpite') && !key.includes('Pontos') && !key.includes('Indice')).sort().forEach(key => {
        const predictionNumber = key.replace('palpite', '');
        const predictionValue = predictions[key];
        cardsHtml += `<div class="prediction-card"><p><strong>Palpite ${predictionNumber}:</strong> ${replaceTeamPlaceholders(predictionValue)}</p></div>`;
    });
    cardsHtml += `</div>`;
    displayArea.innerHTML = cardsHtml;
    displayArea.style.display = 'block';
}

async function showOddsSelector() {
    const displayArea = document.getElementById('prediction-display-area');
    displayArea.innerHTML = '';
    displayArea.style.display = 'none';
    document.getElementById('category-shortcuts-container').style.display = 'block';
    document.getElementById('odds-list-container').style.display = 'block';
    document.getElementById('submit-button-container').style.display = 'block';
    const hierarchy = await buildFullOddHierarchy();
    renderOddsList(hierarchy);
    document.getElementById('submit-button-container').innerHTML = `<button id="submit-button" class="submit-button" onclick="submitPredictions()" disabled>Enviar Palpites (0/${maxPredictions})</button>`;
}

window.confirmPredictions = async function(buttonElement) {
    if (isSubmitting) { return; }
    isSubmitting = true;
    buttonElement.disabled = true;
    buttonElement.textContent = 'A processar...';
    try {
        if (!currentGame || !auth.currentUser) throw new Error('Dados do jogo ou utilizador não disponíveis.');
        if (new Date() > currentGame.fimIntervalo.toDate()) { showErrorPopup('Tempo esgotado, impossível palpitar.'); closeConfirmationPopup(); return; }
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!userDoc.exists()) throw new Error('User data not found');
        const userData = userDoc.data();
        const palpiteData = {
            userId: auth.currentUser.uid, nomeDeUsuario: userData.nomeDeUsuario || 'Utilizador Anónimo', jogoId: currentGame.id, nomeJogo: currentGame.nomeJogo || 'Jogo Sem Nome', equipaCasaId: currentGame.equipaCasaId, equipaCasa: currentGame.equipaCasa, equipaForaId: currentGame.equipaForaId, equipaFora: currentGame.equipaFora, dataJogo: currentGame.dataJogo, competicaoId: currentGame.competicaoId || null, competicao: currentGame.competicao || 'Competição Desconhecida', ronda: currentGame.ronda || null, temporada: currentGame.temporada || null, dataPalpite: serverTimestamp(), Analisado: "Não", PontosGanhos: 0
        };
        selectedPredictions.forEach((pData, index) => {
            const predictionNumber = index + 1;
            palpiteData[`palpite${predictionNumber}`] = replaceTeamPlaceholders(pData.value);
            palpiteData[`Palpite${predictionNumber}PontosGanhos`] = 0;
            palpiteData[`Palpite${predictionNumber}IndiceIngles`] = { PalpiteCategoria: pData.catIndice, PalpiteSubCategoria: pData.subcatIndice, PalpiteCategoria3: pData.cat3Indice };
        });
        const batch = writeBatch(db);
        const globalPalpiteRef = doc(collection(db, 'palpites'));
        const userPalpiteRef = doc(collection(db, 'users', auth.currentUser.uid, 'palpites'));
        batch.set(globalPalpiteRef, palpiteData);
        batch.set(userPalpiteRef, palpiteData);
        await batch.commit();
        closeConfirmationPopup();
        renderPredictionCards(palpiteData);
    } catch (error) {
        console.error('Error submitting predictions:', error);
        showErrorPopup(`Erro ao enviar palpites: ${error.message}`);
        closeConfirmationPopup();
        buttonElement.disabled = false;
        buttonElement.textContent = 'Confirmar';
    } finally {
        isSubmitting = false;
    }
};

let unsubscribeGameDoc = null;

async function renderGameDetailsFromDoc(gameSnap) {
    if (!gameSnap.exists()) {
        showErrorPopup('Jogo não encontrado ou foi removido.');
        return;
    }
    const gameData = gameSnap.data();
    currentGame = { ...gameData, id: gameSnap.id };
    currentGame.numeroPalpites = currentGame.numeroPalpites || 1;
    
    const [equipaCasaDoc, equipaForaDoc, competicaoDoc] = await Promise.all([
        getDoc(doc(db, 'clubes', currentGame.equipaCasaId || ' ')),
        getDoc(doc(db, 'clubes', currentGame.equipaForaId || ' ')),
        getDoc(doc(db, 'competicoes', currentGame.competicaoId || ' '))
    ]);

    currentGame.equipaCasa = equipaCasaDoc.exists() ? equipaCasaDoc.data().nome : 'Equipa A';
    currentGame.equipaFora = equipaForaDoc.exists() ? equipaForaDoc.data().nome : 'Equipa B';

    maxPredictions = currentGame.numeroPalpites || 1;
    if (competicaoDoc.exists() && competicaoDoc.data().imagemBackground) {
        document.body.style.background = `linear-gradient(rgba(9, 12, 16, 0.85), rgba(9, 12, 16, 0.95)), url('${competicaoDoc.data().imagemBackground}') no-repeat center center fixed`;
        document.body.style.backgroundSize = 'cover';
    }

    const competicaoImg = competicaoDoc.exists() ? competicaoDoc.data().imagem : '';
    const equipaCasaImg = equipaCasaDoc.exists() ? equipaCasaDoc.data().imagem : 'https://via.placeholder.com/80';
    const equipaForaImg = equipaForaDoc.exists() ? equipaForaDoc.data().imagem : 'https://via.placeholder.com/80';
    const gameDate = currentGame.dataJogo ? (typeof currentGame.dataJogo.toDate === 'function' ? currentGame.dataJogo.toDate() : new Date(currentGame.dataJogo)) : new Date();
    const formattedDate = gameDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = gameDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    document.getElementById('game-container').innerHTML = `
        <div class="game-info">
            <div class="game-header"><div class="competition-and-date"><div class="competition-image"><img src="${competicaoImg}" alt="${currentGame.competicao}"></div><span>${currentGame.competicao}</span><span class="separator">|</span><span>${formattedDate} - ${formattedTime}</span><span class="separator">|</span><strong style="color: #2176ff;">Palpites Possíveis: ${maxPredictions}</strong></div></div>
            <div id="timer-or-message-container"></div> 
            <div class="teams-container"><div class="team"><div class="team-image"><img src="${equipaCasaImg}" alt="${currentGame.equipaCasa}"></div><div class="team-name">${currentGame.equipaCasa}</div></div><div class="vs">VS</div><div class="team"><div class="team-image"><img src="${equipaForaImg}" alt="${currentGame.equipaFora}"></div><div class="team-name">${currentGame.equipaFora}</div></div></div>
        </div>`;

    const timerContainer = document.getElementById('timer-or-message-container');
    const existingPredictions = await checkExistingPredictions(currentGame.id);
    if (existingPredictions) {
        timerContainer.innerHTML = `<div class="existing-prediction-message"><strong>Já efetuou o seu palpite para este jogo.</strong></div>`;
        renderPredictionCards(existingPredictions);
    } else {
        const now = new Date();
        const inicio = currentGame.inicioIntervalo ? (typeof currentGame.inicioIntervalo.toDate === 'function' ? currentGame.inicioIntervalo.toDate() : new Date(currentGame.inicioIntervalo)) : null;
        const fim = currentGame.fimIntervalo ? (typeof currentGame.fimIntervalo.toDate === 'function' ? currentGame.fimIntervalo.toDate() : new Date(currentGame.fimIntervalo)) : null;
        if (inicio && now < inicio) {
            timerContainer.innerHTML = `<div class="existing-prediction-message" style="background-color: #fff3cd; border-color: #ffeeba; color: #856404;"><strong>O jogo ainda não está disponível para palpitar.</strong></div>`;
            document.getElementById('odds-list-container').innerHTML = '';
            document.getElementById('submit-button-container').innerHTML = '';
            document.getElementById('category-shortcuts-container').innerHTML = '';
        } else if (fim && now > fim) {
            timerContainer.innerHTML = `<div class="countdown-timer"><span id="countdown"><span style="color: red; font-weight: bold;">Tempo esgotado!</span></span></div>`;
            document.getElementById('odds-list-container').innerHTML = '<p style="text-align:center; padding: 20px;">O tempo para palpitar neste jogo esgotou.</p>';
            document.getElementById('submit-button-container').innerHTML = '';
            document.getElementById('category-shortcuts-container').innerHTML = '';
        } else {
            timerContainer.innerHTML = `<div class="countdown-timer"><div class="countdown-label">Tempo que resta para palpitar:</div><div id="countdown" style="margin-top: 8px;">Calculando...</div></div>`;
            await showOddsSelector();
            if (currentGame.fimIntervalo) {
                const countdownElement = document.getElementById('countdown');
                clearInterval(countdownInterval);
                const updateCountdown = () => {
                    const fimDate = typeof currentGame.fimIntervalo.toDate === 'function' ? currentGame.fimIntervalo.toDate() : new Date(currentGame.fimIntervalo);
                    const timeLeft = fimDate.getTime() - new Date().getTime();
                    if (timeLeft <= 0) {
                        countdownElement.innerHTML = '<span style="color: red; font-weight: bold;">Tempo esgotado!</span>';
                        clearInterval(countdownInterval);
                        document.getElementById('odds-list-container').innerHTML = '<p style="text-align:center; padding: 20px;">O tempo para palpitar neste jogo esgotou.</p>';
                        document.getElementById('submit-button-container').innerHTML = '';
                        document.getElementById('category-shortcuts-container').innerHTML = '';
                        return;
                    }
                    const d = Math.floor(timeLeft / 86400000), h = Math.floor(timeLeft % 86400000 / 3600000), m = Math.floor(timeLeft % 3600000 / 60000), s = Math.floor(timeLeft % 60000 / 1000);
                    countdownElement.innerHTML = `${d > 0 ? `<span class="timer-unit">${d}d</span>` : ''}<span class="timer-unit">${h}h</span><span class="timer-unit">${m}m</span><span class="timer-unit">${s}s</span>`;
                };
                updateCountdown();
                countdownInterval = setInterval(updateCountdown, 1000);
            }
        }
    }
}

async function loadGameDetails() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('id');
        if (!gameId) {
            showErrorPopup('Nenhum jogo selecionado. A regressar à página principal...');
            setTimeout(() => { window.location.href = '1x.html'; }, 2000);
            return;
        }

        if (unsubscribeGameDoc) unsubscribeGameDoc();

        const gameDocRef = doc(db, 'jogos', gameId);
        unsubscribeGameDoc = onSnapshot(gameDocRef, async (gameSnap) => {
            await renderGameDetailsFromDoc(gameSnap);
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (content) content.style.display = 'block';
        }, (error) => {
            console.error('Error listening to game details:', error);
            showErrorPopup(`Erro ao atualizar detalhes do jogo: ${error.message}`);
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (content) content.style.display = 'block';
        });

    } catch (error) {
        console.error('Error in loadGameDetails:', error);
        showErrorPopup(`Erro fatal ao carregar detalhes do jogo: ${error.message}`);
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (content) content.style.display = 'block';
    }
}

async function getUserStatus(userId) {
    const docSnap = await getDoc(doc(db, 'users', userId));
    if (docSnap.exists()) {
        const data = docSnap.data();
        return data.aceite === "Yes" ? data.estatuto || null : null;
    }
    return null;
}

function showErrorPopup(message) { const popup = document.getElementById('error-popup'); if (popup) { popup.querySelector('.popup-message').textContent = message; popup.style.display = 'block'; } }
window.closeConfirmationPopup = function() { const popup = document.getElementById('confirmation-popup'); if (popup) popup.style.display = 'none'; }

document.addEventListener('DOMContentLoaded', () => {
    const closeErrorBtn = document.querySelector('#error-popup .close-popup');
    if (closeErrorBtn) closeErrorBtn.addEventListener('click', () => document.getElementById('error-popup').style.display = 'none');
    
    const closeConfirmBtn = document.querySelector('#confirmation-popup .close-popup');
    if (closeConfirmBtn) closeConfirmBtn.addEventListener('click', closeConfirmationPopup);
});

function replaceTeamPlaceholders(text) { if (!text || !currentGame) return text; return text.replace(/Equipa da Casa|Equipa A/gi, currentGame.equipaCasa).replace(/Equipa Visitante|Equipa de Fora|Equipa B/gi, currentGame.equipaFora); }
function isOddVisibleInPalpite(item) {
    return item?.ativado !== false;
}

function buildOddsIndex(allOddsData) {
    return new Map(allOddsData.map(item => [item.id, item]));
}

function isCategoryBranchVisible(item, oddsIndex) {
    if (!item || !isOddVisibleInPalpite(item)) {
        return false;
    }

    if (item.categoria_subcategoria_3cat === 'categoria') {
        return true;
    }

    if (item.categoria_subcategoria_3cat === 'subcategoria') {
        const parentCategory = oddsIndex.get(item.categoriapai);
        return isOddVisibleInPalpite(parentCategory);
    }

    if (item.categoria_subcategoria_3cat === '3cat') {
        const parentSubcategory = oddsIndex.get(item.subcategoriapai);
        const parentCategory = oddsIndex.get(item.categoriapai);
        return isOddVisibleInPalpite(parentSubcategory) && isOddVisibleInPalpite(parentCategory);
    }

    return false;
}

async function buildFullOddHierarchy() {
    const allOddsData = [];
    const q = query(collection(db, 'oddcategorias'), orderBy('ordem'));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach(docSnapshot => {
        allOddsData.push({ id: docSnapshot.id, ...docSnapshot.data() });
    });

    const oddsIndex = buildOddsIndex(allOddsData);
    const categories = new Map();
    const subcategories = new Map();
    const thirdLevelItems = [];

    allOddsData.forEach(item => {
        if (!isCategoryBranchVisible(item, oddsIndex)) {
            return;
        }

        if (item.categoria_subcategoria_3cat === 'categoria') {
            categories.set(item.id, { ...item, children: [] });
        } else if (item.categoria_subcategoria_3cat === 'subcategoria') {
            subcategories.set(item.id, { ...item, children: [] });
        } else if (item.categoria_subcategoria_3cat === '3cat') {
            thirdLevelItems.push(item);
        }
    });

    thirdLevelItems.forEach(item => {
        if (item.subcategoriapai && subcategories.has(item.subcategoriapai)) {
            subcategories.get(item.subcategoriapai).children.push(item);
        }
    });

    for (const [, subcategory] of subcategories) {
        if (subcategory.categoriapai && categories.has(subcategory.categoriapai)) {
            categories.get(subcategory.categoriapai).children.push(subcategory);
        }
    }

    return Array.from(categories.values());
}

function getCategoryIcon(categoryName, databaseIcon) {
    if (!databaseIcon) return '<i class="fa-solid fa-star"></i>';
    
    const iconStr = String(databaseIcon).trim();
    
    // Match by FontAwesome icon classes, SVG, or Emojis to guarantee official 9 colors:
    if (iconStr.includes('fa-list-ol') || iconStr.includes('🔢')) {
        return '<i class="fa-solid fa-list-ol" style="color: #ff4757;"></i>'; // 1: Vermelho
    }
    if (iconStr.includes('fa-scissors') || iconStr.includes('✂')) {
        return '<i class="fa-solid fa-scissors" style="color: #ff7f50;"></i>'; // 2: Laranja
    }
    if (iconStr.includes('fa-futbol') || iconStr.includes('⚽')) {
        return '<i class="fa-solid fa-futbol" style="color: #2ed573;"></i>'; // 3: Verde
    }
    if (iconStr.includes('fa-flag') || iconStr.includes('🚩')) {
        return '<i class="fa-solid fa-flag" style="color: #00d2d3;"></i>'; // 4: Ciano
    }
    if (iconStr.includes('svg') || iconStr.includes('🥅')) {
        return `<svg viewBox="0 0 24 24" width="26" height="26" style="display: inline-block; vertical-align: middle; fill: none; stroke: #1e90ff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-top: -2px;">
            <path d="M3,18V7h18v11" />
            <path d="M3,7l3-3h12l3,3" />
            <path d="M6,4v14" style="stroke-dasharray: 0; stroke-width: 1.2; opacity: 0.7;" />
            <path d="M18,4v14" style="stroke-dasharray: 0; stroke-width: 1.2; opacity: 0.7;" />
            <path d="M6,18h12" />
            <path d="M3,11h18 M3,15h18" style="stroke-width: 0.8; opacity: 0.4;" />
            <path d="M9,7v11 M15,7v11" style="stroke-width: 0.8; opacity: 0.4;" />
        </svg>`; // 5: Azul Real
    }
    if (iconStr.includes('fa-square') || iconStr.includes('🟨')) {
        return '<i class="fa-solid fa-square" style="color: #fed330; font-size: 0.9em; transform: rotate(10deg); display: inline-block;"></i>'; // 6: Amarelo (Cartão)
    }
    if (iconStr.includes('fa-clover') || iconStr.includes('♣')) {
        return '<i class="fa-solid fa-clover" style="color: #9c88ff;"></i>'; // 7: Roxo
    }
    if (iconStr.includes('fa-puzzle-piece') || iconStr.includes('🧩')) {
        return '<i class="fa-solid fa-puzzle-piece" style="color: #ff6b81;"></i>'; // 8: Rosa / Magenta
    }
    if (iconStr.includes('fa-shield-halved') || iconStr.includes('🛡')) {
        return '<i class="fa-solid fa-shield-halved" style="color: #dcdde1;"></i>'; // 9: Prata / Branco
    }

    // Fallback mapping based on category name
    const name = categoryName.toLowerCase();
    if (name.includes('golo')) return '<i class="fa-solid fa-futbol" style="color: #2ed573;"></i>';
    if (name.includes('canto')) return '<i class="fa-solid fa-flag" style="color: #00d2d3;"></i>';
    if (name.includes('remate')) return '<i class="fa-solid fa-bullseye" style="color: #dcdde1;"></i>';
    if (name.includes('cart')) return '<i class="fa-solid fa-square" style="color: #fed330; font-size: 0.9em; transform: rotate(10deg); display: inline-block;"></i>';
    if (name.includes('resultado') || name.includes('vencedor')) return '<i class="fa-solid fa-trophy" style="color: #ffda79;"></i>';
    if (name.includes('parte')) return '<i class="fa-solid fa-stopwatch" style="color: #00d2d3;"></i>';
    if (name.includes('combinado')) return '<i class="fa-solid fa-shuffle" style="color: #ff6b81;"></i>';
    if (name.includes('especial')) return '<i class="fa-solid fa-wand-magic-sparkles" style="color: #9c88ff;"></i>';
    if (name.includes('equipa')) return '<i class="fa-solid fa-shield-halved" style="color: #dcdde1;"></i>';

    return databaseIcon || '<i class="fa-solid fa-star"></i>';
}

function renderOddsList(hierarchy) { 
    const container = document.getElementById('odds-list-container'); 
    container.innerHTML = ''; 
    const shortcutsContainer = document.getElementById('category-shortcuts-container'); 
    let shortcutsHtml = ''; 
    hierarchy.forEach(category => { 
        if (category.children.length === 0) return; 
        const iconHtml = getCategoryIcon(category.nomecategoria, category.icon);
        shortcutsHtml += `<div class="category-shortcut" onclick="scrollToCategory('${category.id}')" title="${replaceTeamPlaceholders(category.nomecategoria)}"><span class="shortcut-icon">${iconHtml}</span></div>`; 
        const categoryElement = document.createElement('div'); 
        categoryElement.className = 'odds-category'; 
        categoryElement.id = category.id; 
        let filterBarHtml = ''; 
        if (category.nomecategoria === 'Por Parte') filterBarHtml = `<div class="subcategory-filter-container"><strong>Filtro:</strong><button class="filter-btn active" onclick="applyFilter(this, '${category.id}', 'all')">Todas</button><button class="filter-btn" onclick="applyFilter(this, '${category.id}', '1st Half')">Primeira Parte</button><button class="filter-btn" onclick="applyFilter(this, '${category.id}', '2nd Half')">Segunda Parte</button></div>`; 
        else if (category.nomecategoria === 'Mercados Combinados') filterBarHtml = `<div class="subcategory-filter-container"><strong>Filtro:</strong><button class="filter-btn active" onclick="applyFilter(this, '${category.id}', 'all')">Todos</button><button class="filter-btn" onclick="applyFilter(this, '${category.id}', 'home')">${currentGame.equipaCasa}</button><button class="filter-btn" onclick="applyFilter(this, '${category.id}', 'away')">${currentGame.equipaFora}</button><button class="filter-btn" onclick="applyFilter(this, '${category.id}', 'both')">Ambas</button><button class="filter-btn" onclick="applyFilter(this, '${category.id}', 'others')">Outras Odds</button></div>`; 
        else if (category.nomecategoria === 'Mercados Especiais') filterBarHtml = `<div class="subcategory-filter-container"><strong>Filtro:</strong><button class="filter-btn active" onclick="applyFilter(this, '${category.id}', 'all')">Todos</button><button class="filter-btn" onclick="applyFilter(this, '${category.id}', 'home_special')">${currentGame.equipaCasa}</button><button class="filter-btn" onclick="applyFilter(this, '${category.id}', 'away_special')">${currentGame.equipaFora}</button><button class="filter-btn" onclick="applyFilter(this, '${category.id}', 'others_special')">Outras Odds</button></div>`; 
        else if (category.nomecategoria === 'Específicos por Equipa') filterBarHtml = `<div class="subcategory-filter-container"><strong>Filtro:</strong><button class="filter-btn active" onclick="applyFilter(this, '${category.id}', 'all')">Todos</button><button class="filter-btn" onclick="applyFilter(this, '${category.id}', 'home_team_specific')">${currentGame.equipaCasa}</button><button class="filter-btn" onclick="applyFilter(this, '${category.id}', 'away_team_specific')">${currentGame.equipaFora}</button><button class="filter-btn" onclick="applyFilter(this, '${category.id}', 'others_team_specific')">Outras Odds</button></div>`; 
        let subcategoriesHTML = ''; 
        category.children.forEach(subcategory => { 
            if (subcategory.children.length === 0) return; 
            let itemsHTML = ''; 
            subcategory.children.forEach(item => { 
                const predictionData = { value: `${category.nomecategoria} - ${subcategory.nomesubcategoria} - ${item.nome3categoria}`, catIndice: category.indiceIngles || null, subcatIndice: subcategory.indiceIngles || null, cat3Indice: item.indiceIngles || null }; 
                let infoIconHTML = item.breveDescricao && item.breveDescricao.trim() !== '' ? `<div class="info-container"><i class="fas fa-info-circle info-icon"></i><div class="info-tooltip">${replaceTeamPlaceholders(item.breveDescricao)}</div></div>` : ''; 
                itemsHTML += `<li class="odds-item" data-prediction='${JSON.stringify(predictionData)}'>${infoIconHTML}<span class="odds-item-text">${replaceTeamPlaceholders(item.nome3categoria)}</span></li>`; 
            }); 
            const subcatIndiceIngles = subcategory.indiceIngles || ''; 
            subcategoriesHTML += `<li class="filterable-subcategory" data-indice-ingles="${subcatIndiceIngles}"><div class="subcategory-header"><span>${replaceTeamPlaceholders(subcategory.nomesubcategoria)}</span><i class="fas fa-chevron-down toggle-icon"></i></div><ul class="nested-list"><ul class="odds-items-grid">${itemsHTML}</ul></ul></li>`; 
        }); 
        if (subcategoriesHTML === '') return; 
        categoryElement.innerHTML = `<div class="category-header"><span class="category-header-title"><span>${iconHtml}</span><span>${replaceTeamPlaceholders(category.nomecategoria)}</span></span><i class="fas fa-chevron-down toggle-icon"></i></div><ul class="nested-list">${filterBarHtml}${subcategoriesHTML}</ul>`; 
        container.appendChild(categoryElement); 
    }); 
    if (shortcutsHtml && shortcutsContainer) shortcutsContainer.innerHTML = `<div class="shortcuts-wrapper">${shortcutsHtml}</div>`; 
    addEventListenersToList(); 
}
window.scrollToCategory = function(targetId) { const targetElement = document.getElementById(targetId); if (!targetElement) return; targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); const header = targetElement.querySelector('.category-header'); if (header && !header.classList.contains('active')) setTimeout(() => header.click(), 300); };
window.applyFilter = function(clickedButton, categoryId, filterKeyword) { clickedButton.parentElement.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active')); clickedButton.classList.add('active'); const subcategories = clickedButton.closest('.odds-category').querySelectorAll('.filterable-subcategory'); subcategories.forEach(subcatLi => { const indiceIngles = (subcatLi.dataset.indiceIngles || '').toLowerCase(); let show = false; if (filterKeyword === 'all') show = true; else { let keywords = [], exclusionKeywords = []; switch(filterKeyword) { case '1st Half': keywords = ['1st half']; break; case '2nd Half': keywords = ['2nd half']; break; case 'home': keywords = ['h1', 'team 1', 'win1', 'win 1']; break; case 'away': keywords = ['h2', 'team 2', 'win2', 'win 2']; break; case 'both': keywords = ['both teams']; break; case 'home_special': keywords = ['h1', 'team 1', 'win1', 'win 1', '2:0']; break; case 'away_special': keywords = ['h2', 'team 2', 'win2', 'win 2', '0:2']; break; case 'home_team_specific': keywords = ['h1', 'team 1', 'win1', 'win 1']; break; case 'away_team_specific': keywords = ['h2', 'team 2', 'win2', 'win 2']; break; case 'others': exclusionKeywords = ['h1', 'team 1', 'win1', 'win 1', 'h2', 'team 2', 'win2', 'win 2', 'both teams']; break; case 'others_special': exclusionKeywords = ['h1', 'team 1', 'win1', 'win 1', '2:0', 'h2', 'team 2', 'win2', 'win 2', '0:2']; break; case 'others_team_specific': exclusionKeywords = ['h1', 'team 1', 'win1', 'win 1', 'h2', 'team 2', 'win2', 'win 2']; break; } if (keywords.length > 0 && keywords.some(k => indiceIngles.includes(k))) show = true; if (exclusionKeywords.length > 0 && !exclusionKeywords.some(k => indiceIngles.includes(k))) show = true; } subcatLi.style.display = show ? 'block' : 'none'; }); }
function addEventListenersToList() { document.querySelectorAll('.category-header, .subcategory-header').forEach(header => header.addEventListener('click', e => { if (!e.target.closest('.subcategory-filter-container')) e.currentTarget.classList.toggle('active'); })); document.querySelectorAll('.odds-item').forEach(item => item.addEventListener('click', () => handlePredictionClick(item))); document.querySelectorAll('.info-container').forEach(container => container.addEventListener('click', e => { e.stopPropagation(); const tooltip = container.querySelector('.info-tooltip'); const isAlreadyActive = tooltip.classList.contains('active'); document.querySelectorAll('.info-tooltip.active').forEach(t => t.classList.remove('active')); if (!isAlreadyActive) { tooltip.classList.add('active'); tooltip.classList.remove('tooltip-adjust-left', 'tooltip-adjust-right'); const tooltipRect = tooltip.getBoundingClientRect(); if (tooltipRect.right > window.innerWidth) tooltip.classList.add('tooltip-adjust-left'); if (tooltipRect.left < 0) tooltip.classList.add('tooltip-adjust-right'); } })); }
function handlePredictionClick(itemElement) { const predictionDataStr = itemElement.dataset.prediction; const isSelected = itemElement.classList.contains('selected'); if (isSelected) { itemElement.classList.remove('selected'); selectedPredictions = selectedPredictions.filter(p => p.value !== JSON.parse(predictionDataStr).value); } else { if (selectedPredictions.length >= maxPredictions) { showErrorPopup(`Número máximo de palpites (${maxPredictions}) já foi atingido.`); return; } itemElement.classList.add('selected'); selectedPredictions.push(JSON.parse(predictionDataStr)); } updateUI(); }
function updateUI() { const submitButton = document.getElementById('submit-button'); if (submitButton) { submitButton.textContent = `Enviar Palpites (${selectedPredictions.length}/${maxPredictions})`; submitButton.disabled = selectedPredictions.length === 0; } const isMaxReached = selectedPredictions.length >= maxPredictions; document.querySelectorAll('.odds-item').forEach(item => { if (!item.classList.contains('selected')) item.classList.toggle('disabled', isMaxReached); }); }
window.submitPredictions = function() { if (selectedPredictions.length !== maxPredictions) { showErrorPopup(`Deve selecionar exatamente ${maxPredictions} palpites. Atualmente tem ${selectedPredictions.length}.`); return; } const confirmationPopup = document.getElementById('confirmation-popup'); let predictionsHtml = '<ul class="confirmation-list">'; selectedPredictions.forEach((p, i) => predictionsHtml += `<li class="confirmation-list-item"><span><strong>${replaceTeamPlaceholders(p.value)}</strong></span><button class="remove-prediction-btn" onclick="removePredictionFromPopup(${i})" title="Remover este palpite">×</button></li>`); predictionsHtml += '</ul>'; document.getElementById('confirmation-predictions').innerHTML = predictionsHtml; if (confirmationPopup) confirmationPopup.style.display = 'block'; }
window.removePredictionFromPopup = function(indexToRemove) { const predictionValue = selectedPredictions[indexToRemove].value; selectedPredictions.splice(indexToRemove, 1); for (const item of document.querySelectorAll('.odds-item')) { if (JSON.parse(item.dataset.prediction).value === predictionValue) { item.classList.remove('selected'); break; } } updateUI(); closeConfirmationPopup(); };
async function loadGameData(gameId) { const gameDoc = await getDoc(doc(db, 'jogos', gameId)); if (!gameDoc.exists()) throw new Error('Jogo não encontrado'); const game = { ...gameDoc.data(), id: gameDoc.id }; game.numeroPalpites = game.numeroPalpites || 1; const equipaCasaDoc = await getDoc(doc(db, 'clubes', game.equipaCasaId || ' ')); game.equipaCasa = equipaCasaDoc.exists() ? equipaCasaDoc.data().nome : 'Equipa A'; const equipaForaDoc = await getDoc(doc(db, 'clubes', game.equipaForaId || ' ')); game.equipaFora = equipaForaDoc.exists() ? equipaForaDoc.data().nome : 'Equipa B'; return game; }
async function checkExistingPredictions(gameId) { if (!auth.currentUser) return null; const q = query(collection(db, 'users', auth.currentUser.uid, 'palpites'), where('jogoId', '==', gameId)); const querySnapshot = await getDocs(q); return querySnapshot.empty ? null : querySnapshot.docs[0].data(); }
async function loadMenuSettings() { try { const docSnap = await getDoc(doc(db, 'paineis', 'paineis menu')); return docSnap.exists() ? docSnap.data() : null; } catch (error) { return null; } }
function checkPageAccess(userStatus, menuSettings) { return !menuSettings ? userStatus === 'ruler' : menuSettings['1x'] === 'on' || userStatus === 'ruler'; }

onAuthStateChanged(auth, async (user) => {
    try {
        if (user) {
            const currentUserStatus = await getUserStatus(user.uid);
            if (currentUserStatus === null) {
                window.location.href = '404.html';
                return;
            }
            try {
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, { ultimoacesso: serverTimestamp() });
            } catch (error) { console.error("Erro ao atualizar o campo ultimoacesso: ", error); }
            
            const menuSettings = await loadMenuSettings();
            if (checkPageAccess(currentUserStatus, menuSettings)) {
                await logUserAction(`Entrou em ${document.title}`);
                if (window.updateMenuVisibility) {
                    window.updateMenuVisibility(menuSettings);
                }
                await loadGameDetails();
            } else {
                window.location.href = '404.html';
            }
        } else {
            if (loadingScreen) loadingScreen.style.display = 'none';
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error("Erro fatal durante a inicialização:", error);
        showErrorPopup("Ocorreu um erro crítico ao carregar a página. Por favor, tente novamente.");
        if (loadingScreen) loadingScreen.style.display = 'none';
    }
});

window.addEventListener('beforeunload', () => {
    if (countdownInterval) clearInterval(countdownInterval);
    if (unsubscribeGameDoc) unsubscribeGameDoc();
});

document.addEventListener('click', async (event) => {
    const clickableElement = event.target.closest('.odds-item, .submit-button, button[onclick^="confirmPredictions"], .remove-prediction-btn, .category-header, .category-shortcut, a.menu-item');
    if (!clickableElement) return;
    let actionName = '';
    if (clickableElement.matches('.odds-item')) {
        const predictionText = clickableElement.querySelector('.odds-item-text')?.textContent.trim();
        actionName = `Selecionou palpite: ${predictionText || 'desconhecido'}`;
    } else if (clickableElement.matches('.submit-button')) {
        actionName = 'Clicou em Enviar Palpites (abriu confirmação)';
    } else if (clickableElement.matches('button[onclick^="confirmPredictions"]')) {
        actionName = 'Confirmou o envio final dos palpites';
    } else if (clickableElement.matches('.remove-prediction-btn')) {
        actionName = 'Removeu um palpite da lista de confirmação';
    } else if (clickableElement.matches('.category-header')) {
        const categoryTitle = clickableElement.querySelector('.category-header-title span:last-child')?.textContent.trim();
        actionName = `Interagiu com a categoria: ${categoryTitle}`;
    } else if (clickableElement.matches('.category-shortcut')) {
        actionName = `Usou atalho para categoria: ${clickableElement.title}`;
    } else if (clickableElement.matches('a.menu-item')) {
        actionName = `Navegou para: ${clickableElement.querySelector('.menu-text')?.textContent.trim() || 'Menu'}`;
    } else {
        const buttonText = clickableElement.textContent.trim();
        if (buttonText) { actionName = `Clicou em: ${buttonText}`; }
    }
    if (!actionName) return;
    const isNavLink = clickableElement.tagName === 'A' && clickableElement.href && clickableElement.target !== '_blank';
    if (isNavLink) {
        event.preventDefault();
        await logUserAction(actionName);
        window.location.href = clickableElement.href;
    } else {
        logUserAction(actionName).catch(console.error);
    }
});
