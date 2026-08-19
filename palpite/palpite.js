// palpite/palpite.js
import { db, auth } from '../core/firebase.js';
import { doc, getDoc, addDoc, collection, serverTimestamp, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { checkPageContentAccess } from "../js/page-content-guard.js";

const loadingScreen = document.getElementById('loading-screen');
const content = document.querySelector('.content');
const predictionArea = document.getElementById('prediction-area'); 
let currentUserStatus = null;
let currentPredictions = [];
let currentGame = null;
let countdownInterval = null;

async function getUserStatus(userId) {
    const userDoc = doc(db, 'users', userId);
    const docSnap = await getDoc(userDoc);
    if (docSnap.exists() && docSnap.data().aceite === "Yes") {
        return docSnap.data().estatuto;
    } else {
        return null;
    }
}

async function getPaineisMenuSettings() {
    const paineisMenuDoc = await getDoc(doc(db, 'paineis', 'paineis menu'));
    if (paineisMenuDoc.exists()) {
        return paineisMenuDoc.data();
    } else {
        return {};
    }
}

function renderPredictionForm(numberOfPredictions) {
    let formHtml = `
        <div class="prediction-container">
            ${Array(numberOfPredictions || 0).fill(0).map((_, index) => `
                <div>
                    <label class="prediction-label" for="prediction${index + 1}">Palpite ${index + 1}</label>
                    <input type="text" id="prediction${index + 1}" class="prediction-input" placeholder="Digite seu palpite...">
                </div>
            `).join('')}
            <button class="submit-button" onclick="submitPredictions()">Enviar Palpites</button>
        </div>`;
    predictionArea.innerHTML = formHtml;
}

function renderPredictionCards(predictions) {
    let cardsHtml = `
        <div class="prediction-display-container">
            <h3>✅ Seus Palpites Registrados</h3>
    `;
    Object.keys(predictions).forEach(key => {
        if (key.startsWith('palpite')) {
            const predictionNumber = key.replace('palpite', '');
            cardsHtml += `
                <div class="prediction-card">
                    <p><strong>Palpite ${predictionNumber}:</strong> ${predictions[key]}</p>
                </div>
            `;
        }
    });
    cardsHtml += `</div>`;
    predictionArea.innerHTML = cardsHtml;
}

window.submitPredictions = async function() {
    try {
        if (!currentGame) throw new Error('Game data not loaded');
        
        const now = new Date();
        if (!currentGame.fimIntervalo) {
            showErrorPopup('Informação de data indisponível. Não é possível palpitar.');
            setTimeout(() => { window.location.href = '1x.html'; }, 5000);
            return;
        }
        const fimIntervalo = currentGame.fimIntervalo.toDate();
        if (now > fimIntervalo) {
            showErrorPopup('Tempo esgotado, impossivel palpitar');
            setTimeout(() => { window.location.href = '1x.html'; }, 5000);
            return;
        }

        currentPredictions = [];
        for (let i = 0; i < currentGame.numeroPalpites; i++) {
            const input = document.getElementById(`prediction${i + 1}`);
            if (!input || !input.value.trim()) {
                showErrorPopup('Ainda não fez todos os palpites possíveis do jogo');
                return;
            }
            currentPredictions.push(input.value.trim());
        }
        showConfirmPopup();
    } catch (error) {
        console.error('Error preparing predictions:', error);
        showErrorPopup(`Erro ao preparar palpites: ${error.message}`);
    }
};

window.confirmPredictions = async function() {
    try {
        if (!currentGame || !currentPredictions || currentPredictions.length === 0) {
            throw new Error('Dados do jogo ou palpites não disponíveis.');
        }

        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!userDoc.exists()) throw new Error('User data not found');
        const userData = userDoc.data();

        const palpiteData = {
            userId: auth.currentUser.uid,
            nomeDeUsuario: userData.nomeDeUsuario,
            jogoId: currentGame.id,
            nomeJogo: currentGame.nomeJogo,
            equipaCasaId: currentGame.equipaCasaId,
            equipaCasa: currentGame.equipaCasa,
            equipaForaId: currentGame.equipaForaId,
            equipaFora: currentGame.equipaFora,
            dataJogo: currentGame.dataJogo,
            competicaoId: currentGame.competicaoId,
            competicao: currentGame.competicao,
            ronda: currentGame.ronda,
            modId: currentGame.modId,
            temporada: currentGame.temporada,
            dataPalpite: serverTimestamp(),
            PontosPossiveis: 0,
            PontosGanhos: 0,
            GCoinsGanhos: 0.0,
            Analisado: "Não",
        };

        const localPredictionObject = {}; 
        currentPredictions.forEach((palpite, index) => {
            const predictionNumber = index + 1;
            palpiteData[`palpite${predictionNumber}`] = palpite;
            localPredictionObject[`palpite${predictionNumber}`] = palpite; 
            palpiteData[`Palpite${predictionNumber}PontosGanhos`] = 0;
            palpiteData[`Palpite${predictionNumber}PontosQuanto`] = 0;
        });

        await Promise.all([
            addDoc(collection(db, 'palpites'), palpiteData),
            addDoc(collection(doc(db, 'users', auth.currentUser.uid), 'palpites'), palpiteData)
        ]);

        closeConfirmPopup();
        renderPredictionCards(localPredictionObject);

    } catch (error) {
        console.error('Error submitting predictions:', error);
        showErrorPopup(`Erro ao enviar palpites: ${error.message}`);
    }
};

function showConfirmPopup() {
    const popup = document.getElementById('confirm-popup');
    const summaryDiv = document.getElementById('prediction-summary');
    if (!summaryDiv || !popup) return;
    summaryDiv.innerHTML = ''; 

    currentPredictions.forEach((prediction, index) => {
        summaryDiv.innerHTML += `<p><b>Palpite ${index + 1}:</b> ${prediction}</p>`;
    });

    popup.style.display = 'block';
}

window.closeConfirmPopup = function() {
    const popup = document.getElementById('confirm-popup');
    if (popup) popup.style.display = 'none';
};

async function checkExistingPredictions(gameId) {
    try {
        if (!auth.currentUser) return null;

        const userPalpitesRef = collection(doc(db, 'users', auth.currentUser.uid), 'palpites');
        const q = query(userPalpitesRef, where('jogoId', '==', gameId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const palpiteData = querySnapshot.docs[0].data();
            console.log('Found existing prediction:', palpiteData);
            return palpiteData;
        }
        console.log('No existing predictions found for game:', gameId);
        return null;
    } catch (error) {
        console.error('Error checking existing predictions:', error);
        return null;
    }
}

async function loadGameDetails() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('id');

        if (!gameId) {
            showErrorPopup('Nenhum jogo selecionado.');
            setTimeout(() => { window.location.href = '1x.html'; }, 3000);
            return;
        }

        const gameRef = doc(db, 'jogos', gameId);
        const gameDoc = await getDoc(gameRef);

        if (!gameDoc.exists()) throw new Error('Game not found');

        const game = gameDoc.data();
        game.id = gameId;
        currentGame = game;

        const [equipaCasaDoc, equipaForaDoc, competicaoDoc] = await Promise.all([
            getDoc(doc(db, 'clubes', game.equipaCasaId)),
            getDoc(doc(db, 'clubes', game.equipaForaId)),
            getDoc(doc(db, 'competicoes', game.competicaoId))
        ]);

        const equipaCasaData = equipaCasaDoc.data();
        const equipaForaData = equipaForaDoc.data();
        const competicaoData = competicaoDoc.data();

        const gameDate = game.dataJogo.toDate();
        const formattedDate = gameDate.toLocaleDateString('pt-PT');
        const formattedTime = gameDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

        const gameContainer = document.getElementById('game-container');
        gameContainer.innerHTML = `
            <div class="game-info">
                <div class="game-header" style="text-align: center; margin-bottom: 15px;">
                     <div class="competition-and-date" style="display: flex; align-items: center; justify-content: center; gap: 5px; color: #444; font-size: 1.1em; font-weight: bold;">
                        <div class="competition-image"><img src="${competicaoData?.imagem || ''}" alt="${game.competicao}" style="width: 20px; height: 20px; vertical-align: middle;"></div>
                        <span>${game.competicao}</span>
                        <span style="margin: 0 5px;">|</span>
                        <span>${formattedDate} - ${formattedTime}</span>
                    </div>
                </div>
                <div class="teams-container">
                    <div class="team"><div class="team-image"><img src="${equipaCasaData?.imagem || ''}" alt="${game.equipaCasa}"></div><div class="team-name">${game.equipaCasa}</div></div>
                    <div class="vs">VS</div>
                    <div class="team"><div class="team-image"><img src="${equipaForaData?.imagem || ''}" alt="${game.equipaFora}"></div><div class="team-name">${game.equipaFora}</div></div>
                </div>
                <div class="countdown-timer">
                    <span class="countdown-label">Tempo restante para palpitar:</span>
                    <span id="countdown" style="display: inline-block; font-weight: bold;"></span>
                </div>
            </div>`;

        const existingPredictions = await checkExistingPredictions(gameId);
        if (existingPredictions) {
            renderPredictionCards(existingPredictions);
        } else {
            renderPredictionForm(game.numeroPalpites);
        }

        function updateCountdown() {
            const now = new Date().getTime();

            if (!currentGame.fimIntervalo) {
                const countdownEl = document.getElementById('countdown');
                if (countdownEl) countdownEl.innerHTML = 'Informação de data indisponível';
                return;
            }

            const endTime = currentGame.fimIntervalo.toDate().getTime();
            const timeLeft = endTime - now;

            const countdownEl = document.getElementById('countdown');
            if (!countdownEl) return;

            if (timeLeft <= 0) {
                countdownEl.innerHTML = 'Tempo esgotado!';
                if (countdownInterval) clearInterval(countdownInterval);
                if (!existingPredictions) { predictionArea.innerHTML = ''; } 
                return;
            }

            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            countdownEl.innerHTML = `<span class="timer-unit">${days}d</span> <span class="timer-unit">${hours}h</span> <span class="timer-unit">${minutes}m</span> <span class="timer-unit">${seconds}s</span>`;
            
            countdownEl.style.display = 'none';
            countdownEl.offsetHeight;
            countdownEl.style.display = 'inline-block';
        }
        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);

    } catch (error) {
        console.error('Error loading game details:', error);
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) gameContainer.innerHTML = `<p style="color: red; text-align: center;">Erro ao carregar detalhes do jogo: ${error.message}</p>`;
    }
}

function showErrorPopup(message) {
    const popup = document.getElementById('error-popup');
    if (!popup) return;
    const popupMessage = popup.querySelector('.popup-message');
    if (popupMessage) popupMessage.textContent = message;
    popup.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    const closeErrorBtn = document.querySelector('#error-popup .close-popup');
    if (closeErrorBtn) {
        closeErrorBtn.addEventListener('click', function() {
            const popup = document.getElementById('error-popup');
            if (popup) popup.style.display = 'none';
        });
    }
});

function logUserAction(actionDescription) {
    if (!auth.currentUser) return;
    try {
        const eyeCollection = collection(db, 'eye');
        void addDoc(eyeCollection, {
            dataacao: serverTimestamp(),
            acao: actionDescription,
            userId: auth.currentUser.uid
        }).catch((error) => console.error("Erro ao registar a ação na coleção 'eye':", error));
    } catch (error) {
        console.error("Erro ao registar ação na coleção 'eye':", error);
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserStatus = await getUserStatus(user.uid);
        const paineisMenuSettings = await getPaineisMenuSettings();
        if (paineisMenuSettings.palpite !== "on" && currentUserStatus !== 'ruler') {
            window.location.href = '404.html';
            return;
        }

        if (window.updateMenuVisibility && paineisMenuSettings) {
            window.updateMenuVisibility(paineisMenuSettings);
        }

        const hasContentAccess = await checkPageContentAccess('palpite', currentUserStatus, db);
        if (!hasContentAccess) {
            if (loadingScreen) loadingScreen.style.display = 'none';
            return;
        }

        console.log(`User is logged in on palpite.html with status: ${currentUserStatus}`);
        await loadGameDetails();
        await logUserAction(`Entrou em ${document.title}`);
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (content) content.style.display = 'block';
    } else {
        console.log('No user is logged in on palpite.html');
        if (loadingScreen) loadingScreen.style.display = 'none';
        window.location.href = 'index.html';
    }
});
