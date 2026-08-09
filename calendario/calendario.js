import { db, auth } from '../core/firebase.js';
import { collection, getDocs, doc, getDoc, query, orderBy, addDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { checkPageContentAccess } from "../js/page-content-guard.js";

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

const loadingScreen = document.getElementById('loading-screen');
const mainContentWrapper = document.getElementById('main-content-wrapper');

async function getUserStatus(userId) { return getDoc(doc(db, 'users', userId)).then(d => d.exists() ? { estatuto: d.data().estatuto, aceite: d.data().aceite } : null); }
async function loadMenuSettings() { return getDoc(doc(db, 'paineis', 'paineis menu')).then(d => d.exists() ? d.data() : {}); }
function checkPageAccess(userStatus, menuSettings) { return (menuSettings['calendario'] === 'on' || userStatus === 'ruler'); }

async function loadCalendar() {
    const container = document.getElementById('calendar-container');
    container.innerHTML = '';
    const now = new Date();
    const dataCache = new Map();

    try {
        const gamesQuery = query(collection(db, 'jogos'), orderBy("dataJogo", "asc"));
        const querySnapshot = await getDocs(gamesQuery);
        const allGames = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (allGames.length === 0) {
            container.innerHTML = '<p class="no-games">Nenhum jogo encontrado no calendário.</p>';
            return;
        }

        let currentRoundNumber = null;
        let nextRoundNumber = null;

        let potentialCurrentRounds = [];
        allGames.forEach(game => {
            if (game.inicioIntervalo && game.fimIntervalo) {
                const inicio = game.inicioIntervalo.toDate();
                const fim = game.fimIntervalo.toDate();
                if (now >= inicio && now <= fim) {
                    potentialCurrentRounds.push(game.ronda);
                }
            }
        });
        if (potentialCurrentRounds.length > 0) {
            currentRoundNumber = Math.min(...potentialCurrentRounds);
        }

        if (currentRoundNumber === null) {
            let lastActiveRoundNumber = null;
            let latestEndTime = new Date(0);

            allGames.forEach(game => {
                if (game.fimIntervalo) {
                    const endTime = game.fimIntervalo.toDate();
                    if (endTime < now && endTime > latestEndTime) {
                        latestEndTime = endTime;
                        lastActiveRoundNumber = game.ronda;
                    }
                }
            });

            for (const game of allGames) {
                if (game.dataJogo.toDate() > now && game.ronda !== lastActiveRoundNumber) {
                    nextRoundNumber = game.ronda;
                    break;
                }
            }
        }

        const groupedData = {};
        for (const game of allGames) {
            if (!game.ronda || !game.competicaoId) continue;
            if (!groupedData[game.ronda]) groupedData[game.ronda] = {};
            if (!groupedData[game.ronda][game.competicaoId]) {
                groupedData[game.ronda][game.competicaoId] = { name: game.competicao, image: '', games: [] };
            }
            groupedData[game.ronda][game.competicaoId].games.push(game);
        }

        const sortedRounds = Object.keys(groupedData).sort((a, b) => Number(a) - Number(b));
        for (const roundNumber of sortedRounds) {
            const isCurrent = (Number(roundNumber) === currentRoundNumber);
            const isNext = (Number(roundNumber) === nextRoundNumber);

            const roundContainer = document.createElement('div');
            let roundClasses = 'round-container';
            if (isCurrent) roundClasses += ' current-round';
            else if (isNext) roundClasses += ' next-round';

            if (!isCurrent && !isNext) {
                roundClasses += ' collapsed';
            }
            roundContainer.className = roundClasses;
            
            const roundHeader = document.createElement('div');
            roundHeader.className = 'round-header';
            
            let headerHTML = '';
            if (isCurrent) {
                headerHTML = `<h2><i class="fas fa-play-circle"></i> Now: Ronda ${roundNumber}</h2>`;
            } else if (isNext) {
                headerHTML = `<h2><i class="fas fa-forward"></i> Next: Ronda ${roundNumber}</h2>`;
            } else {
                headerHTML = `<h2>Ronda ${roundNumber}</h2>`;
            }
            roundHeader.innerHTML = `${headerHTML} <i class="fas fa-chevron-down toggle-icon"></i>`;
            roundContainer.appendChild(roundHeader);

            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'round-content-wrapper';

            const competitionsInRound = groupedData[roundNumber];
            for (const compId in competitionsInRound) {
                const competition = competitionsInRound[compId];
                
                if (!dataCache.has(compId)) {
                    const compDoc = await getDoc(doc(db, 'competicoes', compId));
                    dataCache.set(compId, compDoc.exists() ? compDoc.data() : { imagem: '' });
                }
                competition.image = dataCache.get(compId).imagem;

                const competitionList = document.createElement('div');
                competitionList.className = 'competition-list';
                competitionList.innerHTML = `<div class="competition-header"><img src="${competition.image}" alt="${competition.name}"><h3>${competition.name}</h3></div>`;

                for (const game of competition.games) {
                    const gameDate = game.dataJogo.toDate();
                    const formattedDate = gameDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
                    const formattedTime = gameDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                    const gameElement = document.createElement('div');
                    gameElement.className = 'game-list-item';
                    gameElement.innerHTML = `<div class="game-teams"><div class="team-row"><span class="team-name">${game.equipaCasa}</span> <span class="vs">vs</span></div><div class="team-row"><span class="team-name">${game.equipaFora}</span></div></div><div class="game-datetime">${formattedDate} - ${formattedTime}</div>`;
                    competitionList.appendChild(gameElement);
                }
                contentWrapper.appendChild(competitionList);
            }
            roundContainer.appendChild(contentWrapper);
            container.appendChild(roundContainer);
        }

        document.querySelectorAll('.round-header').forEach(header => {
            header.addEventListener('click', () => {
                header.closest('.round-container').classList.toggle('collapsed');
            });
        });

        const highlightedRound = document.querySelector('.current-round, .next-round');
        if (highlightedRound) {
            highlightedRound.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

    } catch (error) {
        console.error("Erro ao carregar o calendário: ", error);
        container.innerHTML = '<p class="error">Não foi possível carregar o calendário. Tente novamente mais tarde.</p>';
    } finally {
        loadingScreen.style.display = 'none';
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                ultimoacesso: serverTimestamp()
            });
        } catch (error) {
            console.error("Erro ao atualizar o campo ultimoacesso: ", error);
        }

        const userInfo = await getUserStatus(user.uid);
        if (userInfo && userInfo.aceite === "Yes") {
            const menuSettings = await loadMenuSettings();
            if (checkPageAccess(userInfo.estatuto, menuSettings)) {
                const hasContentAccess = await checkPageContentAccess('calendario', userInfo.estatuto, db);
                if (!hasContentAccess) {
                    loadingScreen.style.display = 'none';
                    return;
                }
                await logUserAction(`Entrou em ${document.title}`);
                mainContentWrapper.style.display = 'block';
                window.updateMenuVisibility(menuSettings);
                await loadCalendar();
            } else {
                window.location.href = '404.html';
            }
        } else {
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'index.html';
    }
});

document.addEventListener('click', async (event) => {
    const clickableElement = event.target.closest('.round-header, a.menu-item');

    if (!clickableElement) return;

    let actionName = '';

    if (clickableElement.matches('.round-header')) {
        const roundTitle = clickableElement.querySelector('h2')?.textContent.trim();
        actionName = `Interagiu com: ${roundTitle || 'uma ronda'}`;
    } else if (clickableElement.matches('a.menu-item')) {
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
