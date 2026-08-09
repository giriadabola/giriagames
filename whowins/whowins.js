import { db, auth } from "../core/firebase.js";
import { collection, getDocs, doc, getDoc, Timestamp, setDoc, query, where, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getLatestSeason, getSeasonData, mergeUserSeasonData } from '../core/user-season.js';
import { checkPageContentAccess } from '../js/page-content-guard.js';

let currentUserId = null;
let gamesDataMap = {};

let currentSlide = 1;
const totalSlides = 3;
window.nextSlide = () => {
    document.getElementById(`slide-${currentSlide}`).classList.remove('active');
    currentSlide++;
    document.getElementById(`slide-${currentSlide}`).classList.add('active');
    if (currentSlide === 3) loadArenaCards();
};
window.closeTutorial = async () => {
    document.getElementById('tutorial-popup').style.display = 'none';
    if (currentUserId) {
        const userDocRef = doc(db, 'users', currentUserId);
        try {
            const seasonLabel = await getLatestSeason(db);
            const userSnapshot = await getDoc(userDocRef);
            const seasonData = userSnapshot.exists() ? getSeasonData(userSnapshot.data(), seasonLabel) : {};
            await updateDoc(userDocRef, {
                [seasonLabel]: {
                    ...seasonData,
                    hasSeenWhoWinsTutorial: true
                }
            });
            console.log("Utilizador marcou o tutorial como visto.");
        } catch (error) {
            console.error("Erro ao atualizar o estado do tutorial do utilizador:", error);
        }
    }
};

async function loadArenaCards() {
    const arenaGrid = document.getElementById('arena-grid');
    const arenaDocRef = doc(db, 'paineis', 'paineis arena');
    const arenaDocSnap = await getDoc(arenaDocRef);
    let arenaHTML = '';
    if (arenaDocSnap.exists()) {
        const arenaData = arenaDocSnap.data();
        const orderedArenaKeys = ["Arena 1", "Arena 2", "Arena 3", "Arena 4", "Arena 5"];
        let index = 1;
        for (const arenaKey of orderedArenaKeys) {
            if (arenaData.hasOwnProperty(arenaKey)) {
                const arena = arenaData[arenaKey];
                arenaHTML += `<div class="arena-card glow-${index++}"><img src="${arena.image}" alt="${arenaKey}"><p>${arena.nota}</p></div>`;
            }
        }
    }
    arenaGrid.innerHTML = arenaHTML || '<p>Arenas não encontradas.</p>';
}

/* ---- FUNÇÃO DE LOG DE AÇÕES ---- */
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
const gameListContainer = document.querySelector('.game-list-container');
const arenaLoadingImage = document.getElementById('arena-loading-image');
const arenaLoadingVideo = document.getElementById('arena-loading-video');
const arenaWelcomeText = document.getElementById('arena-welcome-text');
const placeholderImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function loadAccessSettings() {
    return getDoc(doc(db, 'paineis', 'paineis perfil')).then(d => d.exists() ? d.data() : {});
}
async function loadMenuSettings() {
    return getDoc(doc(db, 'paineis', 'paineis menu')).then(d => d.exists() ? d.data() : {});
}
function checkPageAccess(userInfo, accessSettings) {
    // REGRA 1 (PRIORIDADE MÁXIMA): Acesso de Administrador ('ruler')
    // Se o estatuto do utilizador for 'ruler', o acesso é imediato.
    if (userInfo.estatuto === 'ruler') {
        return true;
    }

    // A partir daqui, as regras aplicam-se apenas a utilizadores que NÃO são 'ruler'.
    // Ambas as condições seguintes devem ser verdadeiras.

    // Condição A: O "interruptor" global no painel de controlo deve estar ligado.
    const globalAccessOn = accessSettings['quemganha'] === 'on';

    // Condição B (NOVA REGRA): O utilizador deve ter a permissão específica no seu perfil.
    const hasIndividualPermission = userInfo.permissoes.whowins === 'yes';

    // A função retorna 'true' apenas se a Condição A E a Condição B forem verdadeiras.
    return globalAccessOn && hasIndividualPermission;
}

async function getUserStatus(userId) {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists() && userDoc.data().aceite === "Yes") {
        const seasonLabel = await getLatestSeason(db);
        return mergeUserSeasonData(userDoc.data(), seasonLabel);
    }
    return null;
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                ultimoacesso: serverTimestamp()
            });
        } catch (error) {
            console.error("Erro ao atualizar o campo ultimoacesso:", error);
        }
        const userInfo = await getUserStatus(user.uid);
        if (!userInfo) {
            window.location.href = 'index.html';
            return;
        }
        const accessSettings = await loadAccessSettings();
        if (!checkPageAccess(userInfo, accessSettings)) { 
            window.location.href = '404.html';
            return;
        }
        const menuSettings = await loadMenuSettings();
        if (typeof updateMenuVisibility === 'function' && menuSettings) {
            updateMenuVisibility(menuSettings);
        }
        const hasContentAccess = await checkPageContentAccess('whowins', userInfo.estatuto, db);
        if (!hasContentAccess) {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) loadingScreen.style.display = 'none';
            return;
        }
        await logUserAction(`Entrou em ${document.title}`);
        document.getElementById('user-name').textContent = userInfo.nomeDeUsuario || 'Jogador';
        const arenaDocRef = doc(db, 'paineis', 'paineis arena');
        const arenaDocSnap = await getDoc(arenaDocRef);
        let arenaNameToLoad = null;
        if (arenaDocSnap.exists()) {
            const arenaData = arenaDocSnap.data();
            const arenas = Object.keys(arenaData).map(key => ({
                name: key, fama: arenaData[key].fama, image: arenaData[key].image
            })).sort((a, b) => a.fama - b.fama);
            const userFame = userInfo.fame || 0;
            let currentUserArena = arenas[0];
            for (let i = arenas.length - 1; i >= 0; i--) {
                if (userFame >= arenas[i].fama) {
                    currentUserArena = arenas[i];
                    break;
                }
            }
            if (currentUserArena) {
                arenaNameToLoad = currentUserArena.name;
                arenaLoadingImage.src = currentUserArena.image;
                arenaLoadingImage.style.display = 'block';
                arenaWelcomeText.textContent = `Bem-Vindo à ${currentUserArena.name}`;
                arenaWelcomeText.style.display = 'block';
                document.getElementById('user-fame-display').textContent = userFame;
                document.getElementById('user-arena-image-display').src = currentUserArena.image;
                const arenaNumber = currentUserArena.name.match(/\d+/);
                if (arenaNumber) document.getElementById('user-arena-number-display').textContent = arenaNumber[0];
            }
        }
        arenaLoadingVideo.style.display = 'block';
        document.querySelector('.loading-spinner').classList.add('hidden');
        setTimeout(async () => {
            await loadGames(arenaNameToLoad);
            const hasSeenTutorial = userInfo.hasSeenWhoWinsTutorial || false;
            if (!hasSeenTutorial) {
                setTimeout(() => {
                    document.getElementById('tutorial-popup').style.display = 'flex';
                }, 500);
            }
        }, 2500);
    } else {
        currentUserId = null;
        window.location.href = 'index.html';
    }
});

async function loadGames(userArenaName) {
    const gamesListElement = document.getElementById('games-list');
    gamesListElement.innerHTML = '';
    if (!userArenaName) {
        gamesListElement.innerHTML = '<p class="no-games-message">Não foi possível determinar a tua arena.</p>';
        return;
    }
    const gamesCollection = collection(db, 'whowinsJogos');
    const clubesCollection = collection(db, 'clubes');
    const competicoesCollection = collection(db, 'competicoes');
    const paisesCollection = collection(db, 'paises');
    try {
        const now = new Date();
        const gamesQuery = query(gamesCollection,
            where("arena", "==", userArenaName),
            where("fimIntervalo", ">=", now)
        );
        const gamesSnapshot = await getDocs(gamesQuery);
        const games = gamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const gameIds = games.map(game => game.id);
        gamesDataMap = {};
        games.forEach(game => { gamesDataMap[game.id] = game; });
        const existingPredictions = new Map();
        if (gameIds.length > 0 && currentUserId) {
            const queryPromises = [];
            for (let i = 0; i < gameIds.length; i += 30) {
                const chunk = gameIds.slice(i, i + 30);
                const predictionsQuery = query(collection(db, 'palpiteswhowins'),
                    where("userId", "==", currentUserId),
                    where("nomeJogo", "in", chunk)
                );
                queryPromises.push(getDocs(predictionsQuery));
            }
            const snapshots = await Promise.all(queryPromises);
            snapshots.forEach(snapshot => {
                snapshot.forEach(doc => {
                    const pred = doc.data();
                    existingPredictions.set(pred.nomeJogo, pred.winsId);
                });
            });
        }
        const leaguesGames = {};
        for (const game of games) {
            const leagueName = game.competicao || 'Outra Liga';
            if (!leaguesGames[leagueName]) {
                leaguesGames[leagueName] = { games: [], competicaoId: game.competicaoId };
            }
            leaguesGames[leagueName].games.push(game);
        }
        let gamesHTML = '';
        for (const leagueName in leaguesGames) {
            const leagueData = leaguesGames[leagueName];
            let countryFlagImage = placeholderImage;
            if (leagueData.competicaoId) {
                const compDoc = await getDoc(doc(competicoesCollection, leagueData.competicaoId));
                if (compDoc.exists() && compDoc.data().paisId) {
                    const countryDoc = await getDoc(doc(paisesCollection, compDoc.data().paisId));
                    if (countryDoc.exists()) countryFlagImage = countryDoc.data().imagem || placeholderImage;
                }
            }
            leagueData.games.sort((a, b) => (a.dataJogo?.toDate() || 0) - (b.dataJogo?.toDate() || 0));
            gamesHTML += `<h2 class="game-league-title"><img src="${countryFlagImage}" alt="${leagueName} Flag"> ${leagueName}</h2>`;
            for (const game of leagueData.games) {
                const [homeTeamDoc, awayTeamDoc] = await Promise.all([
                    getDoc(doc(clubesCollection, game.equipaCasaId)),
                    getDoc(doc(clubesCollection, game.equipaForaId))
                ]);
                const homeTeamImage = homeTeamDoc.data()?.imagem || placeholderImage;
                const awayTeamImage = awayTeamDoc.data()?.imagem || placeholderImage;
                let formattedDateTime = 'N/A';
                if (game.dataJogo instanceof Timestamp) {
                    const d = game.dataJogo.toDate();
                    formattedDateTime = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`;
                }
                const homeSelected = existingPredictions.get(game.id) === game.equipaCasaId ? 'selected' : '';
                const drawSelected = existingPredictions.get(game.id) === 'draw' ? 'selected' : '';
                const awaySelected = existingPredictions.get(game.id) === game.equipaForaId ? 'selected' : '';
                gamesHTML += `
                    <li class="game-item" data-game-id="${game.id}">
                        <div class="teams-container">
                            <div class="team-info ${homeSelected}" data-wins-name="${game.equipaCasa}" data-wins-id="${game.equipaCasaId}">
                                <img src="${homeTeamImage}" alt="${game.equipaCasa}" class="team-logo">
                                <span class="team-name">${game.equipaCasa}</span>
                            </div>
                            <span class="versus ${drawSelected}" data-wins-name="Empate" data-wins-id="draw">
                                EMPATE
                                <div class="game-date-time">${formattedDateTime}</div>
                            </span>
                            <div class="team-info ${awaySelected}" data-wins-name="${game.equipaFora}" data-wins-id="${game.equipaForaId}">
                                <img src="${awayTeamImage}" alt="${game.equipaFora}" class="team-logo">
                                <span class="team-name">${game.equipaFora}</span>
                            </div>
                        </div>
                    </li>`;
            }
        }
        gamesListElement.innerHTML = gamesHTML;
        document.querySelectorAll('.game-item .team-info, .game-item .versus').forEach(el => {
            el.addEventListener('click', handlePredictionClick);
        });
    } catch (error) {
        console.error("Error fetching games:", error);
        gamesListElement.innerHTML = '<p class="no-games-message">Ocorreu um erro ao carregar os jogos.</p>';
    } finally {
         loadingScreen.style.display = 'none';
         gameListContainer.style.display = 'block';
         document.getElementById('user-stats-container').style.display = 'flex';
    }
}

async function handlePredictionClick(event) {
    const clickedElement = event.currentTarget;
    const gameItem = clickedElement.closest('.game-item');
    const gameId = gameItem.dataset.gameId;
    const winsName = clickedElement.dataset.winsName;
    const winsId = clickedElement.dataset.winsId;
    const gameData = gamesDataMap[gameId];
    if (!gameData || !currentUserId) return;
    const now = new Date();
    if (gameData.fimIntervalo.toDate() < now) {
        alert("O período para palpitar neste jogo já terminou!");
        return;
    }
    if (gameData.inicioIntervalo.toDate() > now) {
        alert("Ainda não é possível palpitar neste jogo.");
        return;
    }
    const predictionDocId = `${currentUserId}_${gameId}`;
    const predictionRef = doc(db, 'palpiteswhowins', predictionDocId);
    const predictionData = { ...gameData, userId: currentUserId, dataPalpite: Timestamp.now(), wins: winsName, winsId: winsId, nomeJogo: gameId };
    try {
        await setDoc(predictionRef, predictionData);
        gameItem.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        clickedElement.classList.add('selected');
        const scalar = 0.7, sword = confetti.shapeFromText({ text: '⚔️', scalar });
        const rect = clickedElement.getBoundingClientRect();
        const origin = { x: (rect.left + rect.right) / 2 / window.innerWidth, y: (rect.top + rect.bottom) / 2 / window.innerHeight };
        confetti({ spread: 90, ticks: 30, gravity: 0.5, decay: 0.9, startVelocity: 15, shapes: [sword], scalar, origin, particleCount: 50 });
    } catch (error) {
        console.error("Erro ao guardar o palpite: ", error);
    }
}

// Desativa o menu de contexto (botão direito) nos itens de jogo e no ecrã de loading
document.addEventListener('contextmenu', function(e) {
    if (e.target.closest('.game-item') || e.target.closest('#loading-screen')) {
        e.preventDefault();
    }
});

// Listener Global para Cliques
document.addEventListener('click', async (event) => {
    const clickableElement = event.target.closest('.tutorial-button, .team-info, .versus, a.menu-item');
    if (!clickableElement) return;

    let actionName = '';
    if (clickableElement.matches('.tutorial-button')) {
        const buttonText = clickableElement.textContent.trim();
        if (buttonText === 'Seguinte') {
            actionName = `Avançou no tutorial para o slide ${currentSlide}`;
        } else if (buttonText === 'Entra na Arena') {
            actionName = 'Completou o tutorial de WhoWins';
        }
    } 
    else if (clickableElement.matches('.team-info') || clickableElement.matches('.versus')) {
        const gameItem = clickableElement.closest('.game-item');
        const homeTeam = gameItem.querySelector('.team-info[data-wins-id]:not([data-wins-id="draw"]) .team-name')?.textContent.trim();
        const awayTeam = gameItem.querySelector('.team-info:last-child .team-name')?.textContent.trim();
        const prediction = clickableElement.dataset.winsName;
        actionName = `Palpitou em '${prediction}' no jogo ${homeTeam} vs ${awayTeam}`;
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
