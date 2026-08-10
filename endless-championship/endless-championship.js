import { app, db, auth } from '../core/firebase.js';
import { getDoc, doc, collection, query, where, getDocs, setDoc, writeBatch, Timestamp, increment, updateDoc, onSnapshot, orderBy, limit, deleteField, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { checkPageContentAccess } from "../js/page-content-guard.js";

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

const functions = getFunctions(app);

const fictitiousTeamNames = ["Leões do Vale FC", "Northern Rovers FC", "Leones de Montaña", "Olympique de la Vallée", "Aquile della Notte", "Stahlwerk FC", "Al-Ittihad Al-Jabal", "Lokomotiv Taiga", "Shāndǐng Jùrén", "Dragões do Atlântico", "Avalon Athletic", "Atlético del Sol", "AS Étoiles d'Argent", "Unione Titani", "Adler von den Gipfelns", "Al-Nujum Al-Sharqiya", "Dynamo Sever", "Hóng Lóng FC", "Unidos da Serra", "Redwood Giants", "Unión Capital CF", "Lions de Fer", "Dinamo Ferroviario", "Einheit Hauptstadt", "Shabab Al-Sahra", "Zvezda Vostoka", "Běijí Xīng", "Imperial FC", "Harbor City United", "Gigantes del Sur", "Cité Royale FC", "Foresta Nera FC", "Dynamo Berg", "Al-Nasr Al-Thahabi", "Sokol Tundra", "Hēi Hǔ Dìguó", "Metropolitanos de Aço", "Starlight FC", "Estrella Roja FC"];

const loadingScreen = document.getElementById('loading-screen');
const createClubContainer = document.getElementById('create-club-container');
const dashboardContainer = document.getElementById('dashboard-container');
const shopIcon = document.getElementById('shop-icon-container');
const shopPopup = document.getElementById('shop-popup');

let currentUserClubData;
let leagueClubs = []; 
let liveLeagueClubs = []; 
let allowRealtimeLeagueRender = false; 
let leagueListener = null;

const fictitiousNames = [
    "Estádio da Colina", "Arena do Horizonte", "Parque dos Campeões", "Fortaleza do Dragão", 
    "Ninho da Águia", "Caldeirão do Leão", "Vale Dourado", "Centro Desportivo Metropolitano",
    "Estádio Vanguarda", "Arena Sideral", "Complexo Olímpico da Planície", "Estádio da Fronteira",
    "Cidadela Imperial", "Parque dos Pioneiros", "Arena da Costa Dourada", "Santuário do Gladiador",
    "Estádio do Monarca", "Coliseu do Trovão", "Arena da Maré Alta", "Recinto dos Titãs",
    "Estádio Aurora Boreal", "Parque Centenário", "Fortaleza do Norte", "Estádio do Penhasco",
    "Arena de Mármore", "Estádio da Capital", "O Ninho do Falcão", "Estádio Ciclone",
    "Arena dos Vulcões", "Parque Esmeralda",
    "Estádio do Sol Poente", "Arena das Lendas", "Parque da Vitória", "Catedral do Futebol",
    "Estádio Titânico", "Ninho dos Grifos", "Arena da Constelação", "Fortaleza Escarlate",
    "Estádio da Muralha", "Recinto dos Heróis", "Campo de Elísio", "Arena do Pinhal",
    "Estádio do Farol", "Parque dos Ventos", "Arena da Baía", "Estádio da Rocha",
    "O Colosso Verde", "Estádio da Coroa", "Arena do Deserto", "Vale dos Gigantes"
];

// --- Access and Menu settings ---
async function loadAccessSettings() {
    return getDoc(doc(db, 'paineis', 'paineis perfil')).then(d => d.exists() ? d.data() : {});
}

async function loadMenuSettings() {
    return getDoc(doc(db, 'paineis', 'paineis menu')).then(d => d.exists() ? d.data() : {});
}

function checkPageAccess(userStatus, accessSettings) {
    if (userStatus.estatuto === 'ruler') {
        return true;
    }
    const globalAccess = accessSettings['endless'] === 'on';
    const hasSpecificPermission = userStatus?.permissoes?.endless === 'yes';
    return globalAccess && hasSpecificPermission;
}

async function getUserStatus(userId) {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
        return null;
    }
    const userData = userDoc.data();
    if (userData.estatuto === 'ruler') {
        return userData;
    }
    if (userData.aceite === "Yes") {
        return userData;
    }
    return null;
}

async function adjustGamesForDeactivatedBot(botId, seasonIdentifier) {
    console.log(`A ajustar jogos para o bot desativado: ${botId}`);
    const gamesRef = collection(db, "endlessjogos");
    const batch = writeBatch(db);

    const homeGamesQuery = query(gamesRef, where("homeTeamId", "==", botId), where("seasonId", "==", seasonIdentifier));
    const awayGamesQuery = query(gamesRef, where("awayTeamId", "==", botId), where("seasonId", "==", seasonIdentifier));

    try {
        const [homeGamesSnapshot, awayGamesSnapshot] = await Promise.all([
            getDocs(homeGamesQuery),
            getDocs(awayGamesQuery)
        ]);

        const allGames = [...homeGamesSnapshot.docs, ...awayGamesSnapshot.docs];
        if (allGames.length === 0) {
            console.log("Nenhum jogo encontrado para ajustar.");
            return;
        }

        console.log(`Encontrados ${allGames.length} jogos para ajustar.`);

        for (const gameDoc of allGames) {
            const gameData = gameDoc.data();
            const opponentId = gameData.homeTeamId === botId ? gameData.awayTeamId : gameData.homeTeamId;
            const opponentRef = doc(db, 'endlessclubes', opponentId);
            
            const oldOpponentPoints = gameData.awayScore > gameData.homeScore ? 3 : (gameData.awayScore === gameData.homeScore ? 1 : 0);

            const newScore = gameData.homeTeamId === botId ? { home: 0, away: 3 } : { home: 3, away: 0 };
            
            const pointsDelta = 3 - oldOpponentPoints;
            const winsDelta = (oldOpponentPoints < 3) ? 1 : 0; 
            const lossesDelta = (oldOpponentPoints === 3) ? -1 : 0; 
            const drawsDelta = (oldOpponentPoints === 1) ? -1 : 0; 

            batch.update(gameDoc.ref, { homeScore: newScore.home, awayScore: newScore.away });
            
            batch.update(opponentRef, {
                pontos: increment(pointsDelta),
                vitorias: increment(winsDelta),
                derrotas: increment(lossesDelta),
                empates: increment(drawsDelta),
                golosMarcados: increment(newScore.away - gameData.awayScore),
                golosSofridos: increment(newScore.home - gameData.homeScore)
            });
        }
        
        await batch.commit();
        console.log("Jogos e estatísticas ajustados com sucesso.");

    } catch (error) {
        console.error("Erro ao ajustar os jogos do bot desativado:", error);
    }
}

async function generateRandomCoach() {
    try {
        const getRandomUsers = httpsCallable(functions, 'getRandomUsers');
        const result = await getRandomUsers({ count: 20 }); 
        
        const coach = result.data[0]; 
        const name = `${coach.name.first} ${coach.name.last}`;
        const countryCode = coach.nat;
        
        const BASIC_FORMATIONS = ["1-2-2-1", "1-3-1-1"];
        const shuffledBasics = BASIC_FORMATIONS.sort(() => 0.5 - Math.random());
        const availableFormations = shuffledBasics.slice(0, Math.floor(Math.random() * 2) + 1);

        return {
            name: name,
            countryCode: countryCode,
            overall: Math.floor(Math.random() * 49) + 2,
            quimica: Math.floor(Math.random() * 49) + 2,
            temporadas: 1,
            formacaoAtual: availableFormations[0],
            formacoesDisponiveis: availableFormations
        };
    } catch (error) {
        console.error("Erro ao gerar treinador aleatório via Cloud Function, usando fallback:", error);
        return {
            name: "Treinador Genérico", countryCode: "PT",
            overall: Math.floor(Math.random() * 49) + 2, quimica: Math.floor(Math.random() * 49) + 2,
            temporadas: 1, formacaoAtual: "1-2-2-1", formacoesDisponiveis: ["1-2-2-1"]
        };
    }
}

async function generateUniqueStadiumOptions(count = 3) {
    try {
        const clubsQuery = query(collection(db, 'endlessclubes'), where("estadio", "!=", null));
        const querySnapshot = await getDocs(clubsQuery);
        const existingStadiumNames = new Set();
        querySnapshot.forEach(doc => {
            if (doc.data().estadio && doc.data().estadio.name) {
                existingStadiumNames.add(doc.data().estadio.name);
            }
        });

        const availableNames = fictitiousNames.filter(name => !existingStadiumNames.has(name));

        if (availableNames.length < count) {
            console.warn(`Não há nomes de estádios únicos suficientes (${availableNames.length}/${count})! A gerar nomes de fallback.`);
            const fallbacks = [];
            for (let i = 0; i < count; i++) {
                fallbacks.push({ name: `Estádio Genérico ${Date.now() + i}`, ambiente: 0 });
            }
            return fallbacks;
        }

        const shuffled = availableNames.sort(() => 0.5 - Math.random());
        const selectedNames = shuffled.slice(0, count);

        return selectedNames.map(name => ({ name: name, ambiente: 0 }));

    } catch (error) {
        console.error("Erro ao gerar opções de estádio únicas:", error);
        const fallbacks = [];
        for (let i = 0; i < count; i++) {
            fallbacks.push({ name: `Estádio de Emergência ${Date.now() + i}`, ambiente: 0 });
        }
        return fallbacks;
    }
}

async function generateUniquePlayers(excludeNamesSet = new Set()) {
    const positions = ['GR', 'DEF', 'DEF', 'MED', 'MED', 'AVA'];
    const neededPlayers = 6;
    let players = [];
    const sessionUsedNames = new Set();
    let attempts = 0;
    const maxAttempts = 5; 

    while (players.length < neededPlayers && attempts < maxAttempts) {
        attempts++;
        try {
            const fetchCount = (neededPlayers - players.length) * 2 + 5;
            const getRandomUsers = httpsCallable(functions, 'getRandomUsers');
            const result = await getRandomUsers({ count: fetchCount });
            const candidates = result.data;

            for (const candidate of candidates) {
                const name = `${candidate.name.first} ${candidate.name.last}`;
                const normalizedName = normalizePlayerName(name);

                const isDuplicateInDB = excludeNamesSet.has(normalizedName);
                const isDuplicateInSession = sessionUsedNames.has(normalizedName);

                if (!isDuplicateInDB && !isDuplicateInSession) {
                    sessionUsedNames.add(normalizedName);
                    players.push({
                        name: name,
                        countryCode: candidate.nat,
                        overall: Math.floor(Math.random() * 49) + 2
                    });
                    if (players.length === neededPlayers) break;
                }
            }
        } catch (error) {
            console.warn("Falha na Cloud Function durante a geração de jogadores. A tentar novamente...", error);
        }
    }
    
    while (players.length < neededPlayers) {
        players.push({ 
            name: `Jogador Genérico ${players.length + 1}`, 
            countryCode: 'PT', 
            overall: Math.floor(Math.random() * 49) + 2 
        });
    }

    return players.map((player, index) => ({ ...player, position: positions[index] }));
}

async function generateCoachPack(size = 3) {
    const coaches = [];
    for (let i = 0; i < size; i++) {
        coaches.push(await generateRandomCoach());
    }
    return coaches;
}

function generateStadiumPack(size = 3) {
    const stadiums = [];
    for (let i = 0; i < size; i++) {
        stadiums.push(generateRandomStadium());
    }
    return stadiums;
}

function generateRandomStadium() {
    const name = fictitiousStadiumNames[Math.floor(Math.random() * fictitiousStadiumNames.length)];
    return {
        name: name,
        ambiente: 0
    };
}

onAuthStateChanged(auth, async (user) => {
    console.log("[Endless Championship] onAuthStateChanged fired. User:", user ? user.uid : "None");
    if (user) {
        try {
            console.log("[Endless Championship] Fetching user status...");
            const userInfo = await getUserStatus(user.uid);
            console.log("[Endless Championship] User status fetched:", userInfo ? "Success" : "Not Found");
            if (!userInfo) {
                console.warn("[Endless Championship] No user info or access denied. Redirecting to index.html");
                window.location.href = 'index.html';
                return;
            }

            console.log("[Endless Championship] Loading access settings...");
            const accessSettings = await loadAccessSettings();
            console.log("[Endless Championship] Checking page access...");
            if (!checkPageAccess(userInfo, accessSettings)) {
                console.warn("[Endless Championship] Page access check failed. Redirecting to 404.html");
                window.location.href = '404.html';
                return;
            }

            const hasContentAccess = await checkPageContentAccess('endless-championship', userInfo.estatuto, db);
            if (!hasContentAccess) {
                const loadingScreen = document.getElementById('loading-screen');
                if (loadingScreen) loadingScreen.style.display = 'none';
                return;
            }

            console.log("[Endless Championship] Loading menu settings...");
            const menuSettings = await loadMenuSettings();
            if (typeof updateMenuVisibility === 'function') {
                updateMenuVisibility(menuSettings);
            }

            console.log("[Endless Championship] Checking user club...");
            await checkUserClub(user.uid);
            await logUserAction(`Entrou em ${document.title}`);

        } catch (error) {
            console.error("[Endless Championship] Ocorreu um erro crítico durante a inicialização:", error);
            window.location.href = 'index.html';
        }
    } else {
        console.warn("[Endless Championship] No authenticated user. Redirecting to index.html");
        window.location.href = 'index.html';
    }
});

async function checkUserClub(userId) {
    const clubDocRef = doc(db, 'endlessclubes', userId);
    const clubSnap = await getDoc(clubDocRef);
    if (clubSnap.exists() && clubSnap.data().ativo) {
        await showDashboard(userId, clubSnap.data());
    } else {
        showCreateClubScreen();
    }
}

function showCreateClubScreen() {
    loadingScreen.style.display = 'none';
    createClubContainer.style.display = 'block';
    document.getElementById('save-club-btn').addEventListener('click', handleCreateClub);
}

function normalizeClubName(name) {
    if (!name) return "";
    return name
        .toLowerCase()              
        .replace(/\s+/g, '')        
        .replace(/[^a-z]/g, '');    
}

function showNotification(title, message) {
    document.getElementById('notification-title').textContent = title;
    document.getElementById('notification-message').textContent = message;
    document.getElementById('notification-popup').style.display = 'flex';
}

const notificationPopup = document.getElementById('notification-popup');
if (notificationPopup) {
    document.getElementById('notification-close-btn').addEventListener('click', () => {
        notificationPopup.style.display = 'none';
    });
    notificationPopup.addEventListener('click', (e) => {
        if (e.target === notificationPopup) {
            notificationPopup.style.display = 'none';
        }
    });
}

async function handleCreateClub() {
    const clubNameInput = document.getElementById('club-name-input');
    const clubName = clubNameInput.value.trim();
    const saveBtn = this; 

    if (!clubName || clubName.length < 3) {
        showNotification("Nome Inválido", "O nome do clube deve ter pelo menos 3 caracteres.");
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = "A Verificar...";

    try {
        const normalizedNewName = normalizeClubName(clubName);

        const isFictitious = fictitiousTeamNames.some(name => normalizeClubName(name) === normalizedNewName);
        if (isFictitious) {
            showNotification("Nome Indisponível", "Este nome é muito semelhante a uma equipa já existente na liga. Por favor, escolha outro.");
            saveBtn.disabled = false;
            saveBtn.textContent = "Criar Clube";
            return;
        }

        const clubsRef = collection(db, 'endlessclubes');
        const q = query(clubsRef);
        const querySnapshot = await getDocs(q);
        let isDuplicate = false;
        querySnapshot.forEach((doc) => {
            const existingName = doc.data().nome;
            if (normalizeClubName(existingName) === normalizedNewName) { isDuplicate = true; }
        });

        if (isDuplicate) {
            showNotification("Nome Indisponível", "Este nome de clube já foi escolhido por outro jogador. Tente outro.");
            saveBtn.disabled = false;
            saveBtn.textContent = "Criar Clube";
            return;
        }

        createClubContainer.style.display = 'none';
        showInitialSquadSelection(auth.currentUser.uid, clubName); 

    } catch (error) {
        console.error("Erro ao validar nome do clube:", error);
        showNotification("Erro", "Ocorreu um erro ao verificar o nome. Tente novamente.");
        saveBtn.disabled = false;
        saveBtn.textContent = "Criar Clube";
    }
}

async function showDashboard(userId, clubData) {
    console.log("[Endless Championship] Starting showDashboard for club:", clubData.nome);
    currentUserClubData = clubData;

    if (clubData.renewalState === 'pendingChoice') {
        console.log("[Endless Championship] Renewal state is pendingChoice. Hiding loader and opening renewal shop.");
        loadingScreen.style.display = 'none'; 
        await openRenewalShop(); 
        return; 
    }
    
    document.getElementById('club-name-header').textContent = clubData.nome;
    shopIcon.style.display = 'flex';
    
    console.log("[Endless Championship] Rendering widgets...");
    renderSquadWidget(clubData.plantel);
    renderCoachWidget(clubData.treinador);
    renderStadiumWidget(clubData.estadio);
    
    console.log("[Endless Championship] Fetching general configurations...");
    const globalConfigSnap = await getDoc(doc(db, 'paineis', 'configuracoes_gerais'));
    const temporada = globalConfigSnap.exists() ? globalConfigSnap.data().temporadaAtual : 'default_season';
    
    const lastViewed = clubData?.lastWeekViewed;
    const dayOfMonth = new Date().getDate();
    const semanaAtual = Math.floor((dayOfMonth - 1) / 7) + 1;
    const userHasAlreadyViewed = lastViewed && lastViewed.season === temporada && lastViewed.week === semanaAtual;
    
    console.log("[Endless Championship] Setting up winnings system...");
    await setupWinningsSystem(userId, clubData, temporada);

    console.log("[Endless Championship] Assembling league...");
    await assembleLeague(userId, clubData, temporada, userHasAlreadyViewed); 
    
    console.log("[Endless Championship] Setting up Grande Jornada widget...");
    await setupGrandeJornadaWidget(temporada, semanaAtual, userId);

    console.log("[Endless Championship] Setting up interactivity...");
    setupInteractivity(userId, temporada);
    
    const now = new Date();
    const lastUpdate = clubData.plantelLastUpdated ? clubData.plantelLastUpdated.toDate() : new Date(0); 
    
    console.log("[Endless Championship] Checking if squad needs monthly renewal...");
    if (now.getMonth() > lastUpdate.getMonth() || now.getFullYear() > lastUpdate.getFullYear()) {
        console.log("[Endless Championship] Monthly renewal required. Hiding loader and opening monthly-renewal-popup.");
        loadingScreen.style.display = 'none'; // FIX: Hide the loading screen here!
        const renewalPopup = document.getElementById('monthly-renewal-popup');
        renewalPopup.style.display = 'flex';

        document.getElementById('keep-squad-btn').onclick = async () => {
            const btn = document.getElementById('keep-squad-btn');
            btn.disabled = true;
            btn.textContent = "A Evoluir Equipa...";

            try {
                let updatedSquad = JSON.parse(JSON.stringify(currentUserClubData.plantel));
                let updatedCoach = JSON.parse(JSON.stringify(currentUserClubData.treinador));
                
                const userRankIndex = leagueClubs.findIndex(club => club.id === userId);
                const userPosition = userRankIndex !== -1 ? userRankIndex + 1 : 20;
                const change = Math.floor(Math.random() * 3) + 2;
                let coachEvolutionMessage = "";

                if (userPosition <= 5) {
                    updatedCoach.quimica += change;
                    coachEvolutionMessage = `Parabéns pelo Top 5! A química do seu treinador aumentou em ${change} pontos!`;
                } else {
                    if (Math.random() < 0.5) {
                        updatedCoach.quimica += change;
                        coachEvolutionMessage = `Apesar de uma temporada difícil, o treinador conseguiu melhorar a sua química em ${change} pontos!`;
                    } else {
                        updatedCoach.quimica -= change;
                        updatedCoach.quimica = Math.max(10, updatedCoach.quimica); 
                        coachEvolutionMessage = `Devido aos resultados, a química do treinador diminuiu em ${change} pontos.`;
                    }
                }
                
                updatedSquad.sort(() => 0.5 - Math.random());
                updatedSquad.forEach((player, index) => {
                    const playerChange = Math.floor(Math.random() * 5) + 2;
                    if (index < 4) player.overall += playerChange;
                    else {
                        if (Math.random() < 0.5) player.overall = Math.max(10, player.overall - playerChange);
                        else player.overall += playerChange;
                    }
                });
                
                const novoPlantelOverall = updatedSquad.reduce((sum, p) => sum + p.overall, 0);
                const novoOverallTotal = novoPlantelOverall + updatedCoach.overall + currentUserClubData.formacaoatualpontos;
                const novaQuimicaTotal = updatedCoach.quimica + currentUserClubData.estadio.ambiente;
                const novaTemporadaReal = (currentUserClubData.numerorealtemporada || 1) + 1;

                const clubRef = doc(db, 'endlessclubes', userId);
                await setDoc(clubRef, {
                    plantel: updatedSquad, treinador: updatedCoach, plantelLastUpdated: Timestamp.now(),
                    overall: novoOverallTotal, quimica: novaQuimicaTotal, numerorealtemporada: novaTemporadaReal
                }, { merge: true });

                alert(coachEvolutionMessage);
                alert("Equipa evoluída com sucesso para a nova temporada!");
                location.reload();

            } catch (error) {
                console.error("Erro ao evoluir a equipa:", error);
                alert("Ocorreu um erro. Tente novamente.");
                btn.disabled = false;
                btn.textContent = "Manter e Evoluir";
            }
        };

        document.getElementById('change-squad-btn').onclick = async () => {
            const btn = document.getElementById('change-squad-btn');
            btn.disabled = true;
            btn.textContent = "A Preparar...";

            if (!confirm("Esta opção irá levá-lo à loja, onde terá de adquirir um novo pack (jogadores, treinador ou estádio) para continuar. Tem a certeza?")) {
                btn.disabled = false;
                btn.textContent = "Fazer Alterações";
                return;
            }

            try {
                const clubRef = doc(db, 'endlessclubes', userId);
                await updateDoc(clubRef, { renewalState: 'pendingChoice' });
                location.reload();

            } catch (error) {
                console.error("Erro ao definir o estado de renovação:", error);
                alert("Ocorreu um erro. Tente novamente.");
                btn.disabled = false;
                btn.textContent = "Fazer Alterações";
            }
        };
    } else {
        loadingScreen.style.display = 'none';
        dashboardContainer.style.display = 'block';
    }
}

async function openRenewalShop() {
    const shopPopup = document.getElementById('shop-popup');
    shopPopup.querySelector('.popup-close').style.display = 'none'; 
    shopPopup.onclick = null; 
    const title = shopPopup.querySelector('h2');
    title.textContent = "Faça uma Alteração Estrutural";
    title.insertAdjacentHTML('afterend', '<p style="text-align:center;">Para continuar na nova temporada, deve recrutar um novo pack de jogadores, um novo treinador ou um novo estádio.</p>');

    shopPopup.style.display = 'flex';

    shopPopup.querySelectorAll('.pack-option').forEach(pack => {
        pack.onclick = () => handleRenewalPurchase(pack.dataset.pack);
    });
}

async function handleRenewalPurchase(packType) {
    if (!confirm(`Tem a certeza que deseja substituir os seus ${packType} atuais? Esta ação aplicará as alterações e penalizações imediatamente.`)) {
        return;
    }

    const shopPopup = document.getElementById('shop-popup');
    shopPopup.innerHTML = `<div class="popup-content" style="text-align: center;"><div class="loading-spinner"></div><h3 style="margin-top:20px;">A aplicar alterações...</h3></div>`;

    try {
        const userId = auth.currentUser.uid;
        const clubRef = doc(db, 'endlessclubes', userId);
        const clubData = currentUserClubData; 
        let updates = {};
        let finalMessage = "";

        if (packType === 'players') {
            const newPlayers = await generateUniquePlayers();
            updates.plantel = newPlayers;
            
            const newPlantelOverall = newPlayers.reduce((sum, p) => sum + p.overall, 0);
            const coachOverall = clubData.treinador.overall || 0;
            const formationPoints = clubData.formacaoatualpontos || 0;
            updates.overall = newPlantelOverall + coachOverall + formationPoints - 6; 
            finalMessage = "Novo plantel recrutado! Foi aplicada uma penalização de -6 ao overall total da equipa devido à reestruturação.";
        } 
        else if (packType === 'coach') {
            const newCoach = await generateRandomCoach();
            updates.treinador = newCoach;

            const stadiumAmbience = clubData.estadio.ambiente || 0;
            updates.quimica = newCoach.quimica + stadiumAmbience - 5;
            finalMessage = "Novo treinador contratado! Foi aplicada uma penalização de -5 à química da equipa para refletir o período de adaptação.";
        } 
        else if (packType === 'stadium') {
            const newStadiums = await generateUniqueStadiumOptions(1);
            updates.estadio = { ...newStadiums[0], nivel: 1 }; 
            finalMessage = "Novo estádio selecionado! Bem-vindo à sua nova casa.";
        }

        updates.renewalState = deleteField();
        updates.plantelLastUpdated = Timestamp.now();

        await updateDoc(clubRef, updates);

        alert(finalMessage);
        location.reload();

    } catch (error) {
        console.error("Erro ao processar a compra de renovação:", error);
        alert("Ocorreu um erro crítico. A página será recarregada.");
        location.reload();
    }
}

async function setupWinningsSystem(userId, clubData, seasonId) {
    const rewardIcon = document.getElementById('points-reward-icon');
    const rewardValueEl = document.getElementById('points-reward-value');
    const claimPopup = document.getElementById('claim-reward-popup');
    const claimAmountEl = document.getElementById('claim-reward-amount');
    const claimBtn = document.getElementById('claim-reward-btn');

    if (!rewardIcon || !clubData) return;

    const dayOfMonth = new Date().getDate();
    const currentWeek = Math.floor((dayOfMonth - 1) / 7) + 1;

    const pontos = clubData.pontos || 0;
    const pontosGastos = clubData.pontosGastosNestaTemporada || 0; 
    const recompensaPotencialTotal = Math.floor(pontos / 2);
    const dinheiroDisponivel = recompensaPotencialTotal - pontosGastos; 

    rewardIcon.style.display = 'flex';
    rewardValueEl.textContent = dinheiroDisponivel;

    const lastViewed = clubData.lastWeekViewed;
    const hasSimulatedWeek4 = lastViewed && lastViewed.season === seasonId && lastViewed.week === 4;
    const alreadyClaimed = clubData.winningsClaimed === true;
    
    const isClaimable = (currentWeek === 4 && hasSimulatedWeek4 && !alreadyClaimed && dinheiroDisponivel > 0);

    if (isClaimable) {
        rewardIcon.classList.add('is-claimable');
        rewardIcon.onclick = () => {
            claimAmountEl.textContent = dinheiroDisponivel; 
            claimPopup.style.display = 'flex';
        };

        claimBtn.onclick = async () => {
            claimBtn.disabled = true;
            claimBtn.textContent = "A Processar...";

            try {
                const claimReward = httpsCallable(functions, 'claimEndlessSeasonWinnings');
                const result = await claimReward();
                
                alert(result.data.message);
                location.reload();

            } catch (error) {
                console.error("Erro ao resgatar prémio:", error);
                alert("Erro: " + error.message); 
                claimBtn.disabled = false;
                claimBtn.textContent = "Resgatar Recompensa";
            }
        };

    } else {
        rewardIcon.classList.remove('is-claimable');
        rewardIcon.onclick = null;
    }
    
    const closeBtn = claimPopup.querySelector('.popup-close');
    if(closeBtn) {
        closeBtn.onclick = () => claimPopup.style.display = 'none';
    }
    claimPopup.onclick = (e) => {
         if (e.target === claimPopup) claimPopup.style.display = 'none';
    };
}

async function showInitialSquadSelection(userId, clubName) {
    const popup = document.getElementById('initial-squad-popup');
    const title = popup.querySelector('h2');
    const packButtonsContainer = document.getElementById('pack-buttons-container');
    const optionsContainer = document.getElementById('squad-options-container');
    const statusText = document.getElementById('squad-selection-status');

    let generatedOptions = [];
    let chosenSquad = null;
    let chosenCoach = null;
    let chosenStadium = null;
    let preGeneratedStadiums = [];

    const allDbPlayerNames = await fetchAllPlayerNamesFromDB();
    const sessionGeneratedPlayerNames = new Set();

    const handlePackOpenClick = async (event) => {
        const button = event.target;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        let newOption;
        if (!chosenSquad) {
            const namesToExclude = new Set([...allDbPlayerNames, ...sessionGeneratedPlayerNames]);
            newOption = await generateUniquePlayers(namesToExclude);
            newOption.forEach(player => sessionGeneratedPlayerNames.add(normalizePlayerName(player.name)));
        } else if (!chosenCoach) {
            newOption = await generateRandomCoach();
        } else {
            if (preGeneratedStadiums.length > 0) {
                newOption = preGeneratedStadiums.shift();
            } else {
                newOption = { name: "Estádio de Fallback", ambiente: 0 };
            }
        }
        
        generatedOptions.push(newOption);
        renderOptions();
        statusText.textContent = 'Excelente! Reveja as suas opções abaixo e escolha uma para continuar.';
    };

    const setupPackButtons = () => {
        packButtonsContainer.innerHTML = '';
        for (let i = 1; i <= 3; i++) {
            const button = document.createElement('button');
            button.textContent = `Abrir Pack ${i}`;
            button.className = 'pack-opener-btn';
            button.onclick = handlePackOpenClick;
            packButtonsContainer.appendChild(button);
        }
    };
    
    const updateWizardUI = async () => {
        optionsContainer.innerHTML = '';
        packButtonsContainer.style.display = 'flex';
        generatedOptions = [];

        if (!chosenSquad) {
            title.textContent = 'Passo 1: Escolha o Seu Plantel Inicial';
            statusText.textContent = 'Abra os packs para revelar as suas opções de plantel. Depois, escolha uma.';
            setupPackButtons();
        } else if (!chosenCoach) {
            title.textContent = 'Passo 2: Escolha o Seu Treinador';
            statusText.textContent = 'Agora, revele e escolha um treinador para liderar a sua equipa.';
            setupPackButtons();
        } else if (!chosenStadium) {
            title.textContent = 'Passo 3: Escolha o Seu Estádio';
            statusText.textContent = 'Finalmente, descobra e escolha a sua casa.';
            preGeneratedStadiums = await generateUniqueStadiumOptions(3);
            setupPackButtons();
        } else {
            title.textContent = 'Confirme a Fundação do Clube';
            statusText.textContent = 'Excelente! Reveja as suas escolhas. Se estiver tudo correto, clique em "Fundar Clube".';
            packButtonsContainer.style.display = 'none';

            const avgOverall = (chosenSquad.reduce((sum, p) => sum + p.overall, 0) / chosenSquad.length).toFixed(1);
            optionsContainer.innerHTML = `
                <div class="squad-option-card">
                    <h3>Plantel Escolhido</h3>
                    <p>Média de Overall</p>
                    <p style="font-size: 1.4em; font-weight: bold; color: var(--gold-color);">${avgOverall}</p>
                </div>
                <div class="squad-option-card">
                    <h3>Treinador</h3>
                    <p>${chosenCoach.name}</p>
                    <p>Overall: ${chosenCoach.overall}</p>
                </div>
                <div class="squad-option-card">
                    <h3>Estádio</h3>
                    <p>${chosenStadium.name}</p>
                    <p>Nível: 1</p>
                </div>
            `;
            
            const finalBtn = document.createElement('button');
            finalBtn.textContent = 'Fundar Clube';
            finalBtn.className = 'btn-create';
            finalBtn.style.width = '100%';
            finalBtn.style.marginTop = '20px';
            optionsContainer.appendChild(finalBtn);

            finalBtn.onclick = async () => {
                finalBtn.disabled = true;
                const popupContent = popup.querySelector('.popup-content');
                const animationHtml = document.querySelector('[data-content="founding-animation"]').innerHTML;
                popupContent.style.textAlign = 'center';
                popupContent.innerHTML = animationHtml;
        
                try {
                    const batch = writeBatch(db);
                    const { currentGameSeason, seasonIdentifier } = await getGameSeasonInfo();
                    
                    const plantelOverall = chosenSquad.reduce((sum, p) => sum + p.overall, 0);
                    const totalOverall = plantelOverall + chosenCoach.overall + 5;
                    const totalQuimica = chosenCoach.quimica + 15;
                    const finalClubData = {
                        nome: clubName,
                        userId: userId,
                        dataDeCriacao: Timestamp.now(),
                        ativo: true,
                        plantel: chosenSquad,
                        treinador: { ...chosenCoach, formacaoAtual: "1-2-2-1" },
                        estadio: { ...chosenStadium, nivel: 1, ambiente: 15 },
                        overall: totalOverall, quimica: totalQuimica,
                        formacaoatualpontos: 5, numerorealtemporada: 1,
                        plantelLastUpdated: Timestamp.now(),
                        pontos: 0, vitorias: 0, empates: 0, derrotas: 0, jogosDisputados: 0,
                        golosMarcados: 0, golosSofridos: 0,
                        temporada: seasonIdentifier, seasonGame: currentGameSeason,
                        estado: "real"
                    };
                    const userClubRef = doc(db, 'endlessclubes', userId);
                    batch.set(userClubRef, finalClubData);
        
                    const LEAGUE_SIZE = 20;
                    const clubsRef = collection(db, 'endlessclubes');
                    const activeClubsQuery = query(clubsRef, where("ativo", "==", true));
                    const activeClubsSnapshot = await getDocs(activeClubsQuery);
                    const currentLeagueSize = activeClubsSnapshot.size;

                    if (currentLeagueSize >= LEAGUE_SIZE) {
                        console.log("A liga está cheia. A procurar um bot para substituir...");
                        const botQuery = query(clubsRef, 
                            where("estado", "==", "temporario"), 
                            where("ativo", "==", true), 
                            limit(1) 
                        );
                        const botSnapshot = await getDocs(botQuery);

                        if (!botSnapshot.empty) {
                            const botToRemoveDoc = botSnapshot.docs[0];
                            const botRef = doc(db, 'endlessclubes', botToRemoveDoc.id);
                            console.log(`Bot encontrado para substituição: ${botToRemoveDoc.id}. A desativá-lo...`);
                            
                            batch.update(botRef, { ativo: false });
                            await adjustGamesForDeactivatedBot(botToRemoveDoc.id, seasonIdentifier);

                        } else {
                            console.error("ERRO CRÍTICO: A liga está cheia e não foram encontrados bots para remover.");
                            popupContent.innerHTML = `<h3 style="color: #ff6b6b;">Liga Cheia!</h3><p>De momento, a liga está preenchida com 20 jogadores reais. Não é possível entrar. Por favor, tente mais tarde.</p>`;
                            return; 
                        }
                    } 
                    else {
                        const botsNeeded = LEAGUE_SIZE - (currentLeagueSize + 1); 
                        
                        if (botsNeeded > 0) {
                            console.log(`A gerar ${botsNeeded} bots para completar a liga...`);
                            const allDbPlayerNames = await fetchAllPlayerNamesFromDB();
                            const stadiumOptions = await generateUniqueStadiumOptions(botsNeeded);
                            const shuffledFictitiousNames = fictitiousTeamNames.sort(() => 0.5 - Math.random());

                            for (let i = 0; i < botsNeeded; i++) {
                                const botSquad = await generateUniquePlayers(allDbPlayerNames);
                                botSquad.forEach(player => allDbPlayerNames.add(normalizePlayerName(player.name)));
                                const botCoach = await generateRandomCoach();
                                const botStadium = stadiumOptions[i] || { name: `Estádio Bot ${Date.now() + i}`};
                                const botPlantelOverall = botSquad.reduce((sum, p) => sum + p.overall, 0);
                                const botTotalOverall = botPlantelOverall + botCoach.overall + 5;
                                const botTotalQuimica = botCoach.quimica + 15;
                                const botName = shuffledFictitiousNames[i % shuffledFictitiousNames.length] || `Bot Team ${i}`;

                                const newBotData = {
                                    nome: botName,
                                    userId: null, dataDeCriacao: Timestamp.now(), ativo: true, plantel: botSquad,
                                    treinador: { ...botCoach, formacaoAtual: "1-2-2-1" },
                                    estadio: { ...botStadium, nivel: 1, ambiente: 15 },
                                    overall: botTotalOverall, quimica: botTotalQuimica, formacaoatualpontos: 5,
                                    numerorealtemporada: 1, plantelLastUpdated: Timestamp.now(),
                                    pontos: 0, vitorias: 0, empates: 0, derrotas: 0, jogosDisputados: 0,
                                    golosMarcados: 0, golosSofridos: 0,
                                    temporada: seasonIdentifier, seasonGame: currentGameSeason, estado: "temporario"
                                };
                                const newBotRef = doc(collection(db, 'endlessclubes'));
                                batch.set(newBotRef, newBotData);
                            }
                        }
                    }
  
                    await batch.commit();
                    setTimeout(() => location.reload(), 2000);
                } catch (error) {
                    console.error("Erro ao fundar o clube e gerar a liga:", error);
                    popupContent.innerHTML = `<p style="color: #ff6b6b;">Ocorreu um erro crítico. Por favor, tente novamente.</p>`;
                }
            };
        }
    };

    const renderOptions = () => {
        optionsContainer.innerHTML = '';
        if (!chosenSquad) {
            generatedOptions.forEach((squad, index) => {
                let playersHtml = squad.map(p => `<div class="player-entry"><span>${p.position} - ${p.name.split(' ')[0]}</span><span class="overall">${p.overall}</span></div>`).join('');
                optionsContainer.innerHTML += `<div class="squad-option-card"><h3>Opção de Plantel</h3><div class="players-list">${playersHtml}</div><button class="btn-create choose-btn" data-index="${index}">Escolher Plantel</button></div>`;
            });
        } else if (!chosenCoach) {
                generatedOptions.forEach((coach, index) => {
                optionsContainer.innerHTML += `<div class="squad-option-card"><h3>Opção de Treinador</h3><p>${coach.name}</p><p>Overall: <span class="overall">${coach.overall}</span></p><button class="btn-create choose-btn" data-index="${index}">Escolher Treinador</button></div>`;
            });
        } else if (!chosenStadium) {
            generatedOptions.forEach((stadium, index) => {
                optionsContainer.innerHTML += `<div class="squad-option-card"><h3>Opção de Estádio</h3><p>${stadium.name}</p><p>Nível: <span class="overall">1</span></p><button class="btn-create choose-btn" data-index="${index}">Escolher Estádio</button></div>`;
            });
        }

        document.querySelectorAll('.choose-btn').forEach(button => {
            button.onclick = async (e) => {
                const chosenIndex = parseInt(e.target.dataset.index, 10);
                if (!chosenSquad) {
                    chosenSquad = generatedOptions[chosenIndex];
                } else if (!chosenCoach) {
                    chosenCoach = generatedOptions[chosenIndex];
                } else {
                    chosenStadium = generatedOptions[chosenIndex];
                }
                await updateWizardUI();
            };
        });
    };

    popup.style.display = 'flex';
    updateWizardUI();
}

function normalizePlayerName(name) {
    if (!name) return "";
    return name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, '');
}

async function fetchAllPlayerNamesFromDB() {
    const playerNames = new Set();
    const clubsQuery = query(collection(db, 'endlessclubes'));
    try {
        const querySnapshot = await getDocs(clubsQuery);
        querySnapshot.forEach(doc => {
            const clubData = doc.data();
            if (clubData.plantel && Array.isArray(clubData.plantel)) {
                clubData.plantel.forEach(player => {
                    if (player.name) {
                        playerNames.add(normalizePlayerName(player.name));
                    }
                });
            }
        });
        console.log(`Carregados ${playerNames.size} nomes de jogadores únicos da base de dados.`);
        return playerNames;
    } catch (error) {
        console.error("Erro ao carregar os nomes dos jogadores da base de dados:", error);
        return playerNames; 
    }
}

function render3DStadium(stadium, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !stadium) return;

    const nivel = stadium.nivel || 1;
    
    let stadiumHTML = `<div class="stadium-scene">
        <div class="stadium-pitch">
            <div class="stadium-goal goal-north"></div>
            <div class="stadium-goal goal-south"></div>
            <div class="player-marker team-a" style="top: 25%; left: 30%;"></div>
            <div class="player-marker team-a" style="top: 45%; left: 60%;"></div>
            <div class="player-marker team-b" style="top: 65%; left: 40%;"></div>
            <div class="player-marker team-a" style="top: 75%; left: 20%;"></div>
            <div class="player-marker team-b" style="top: 50%; left: 15%;"></div>
            <div class="animated-ball"></div>
        </div>`;

    if (nivel > 1) {
        let flashesHTML = '';
        const numberOfFlashes = 25;

        for (let i = 0; i < numberOfFlashes; i++) {
            const top = Math.random() * 100;
            const left = Math.random() * 100;
            const delay = Math.random() * 5;
            
            flashesHTML += `<div class="camera-flash" style="top: ${top}%; left: ${left}%; animation-delay: ${delay}s;"></div>`;
        }

        const flashContainer = `<div class="flash-container">${flashesHTML}</div>`;

        stadiumHTML += `
            <div class="stadium-stand stand-north level-${nivel}">${flashContainer}</div>
            <div class="stadium-stand stand-south level-${nivel}">${flashContainer}</div>
            <div class="stadium-stand stand-west level-${nivel}">${flashContainer}</div>
            <div class="stadium-stand stand-east level-${nivel}">${flashContainer}</div>
        `;
    }

    if (nivel === 4) {
        stadiumHTML += `
            <div class="stadium-floodlight-pylon pylon-nw"></div>
            <div class="stadium-floodlight-pylon pylon-ne"></div>
            <div class="stadium-floodlight-pylon pylon-sw"></div>
            <div class="stadium-floodlight-pylon pylon-se"></div>
        `;
    } else if (nivel >= 5) {
        stadiumHTML += `
            <div class="stadium-roof-structure roof level-${nivel}">
                <div class="roof-panel roof-panel-a"></div>
                <div class="roof-panel roof-panel-b"></div>
            </div>
        `;
    }

    stadiumHTML += `</div>`;
    container.innerHTML = stadiumHTML;
}

function renderSquadWidget(squad) {
    const container = document.getElementById('squad-summary-container');
    const countEl = document.getElementById('squad-player-count');
    if (!squad || squad.length === 0) {
        container.innerHTML = '<p>Sem jogadores.</p>';
        countEl.textContent = '0/6 Jogadores';
        return;
    }
    let squadHtml = '';
    let totalOverall = 0;
    squad.forEach(player => {
        totalOverall += player.overall;
        const positionColor = {'GR': '#e67e22', 'DEF': '#3498db', 'MED': '#2ecc71', 'AVA': '#e74c3c'};
        const initials = player.name.split(' ').map(n => n[0]).join('');
        squadHtml += `<div title="${player.name} (${player.position}) - Overall: ${player.overall}" style="width: 50px; height: 50px; border-radius: 50%; background-color: ${positionColor[player.position] || '#7f8c8d'}; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid var(--accent-color);">${initials}</div>`;
    });
    container.innerHTML = squadHtml;
    const avgOverall = (totalOverall / squad.length).toFixed(1);
    countEl.innerHTML = `${squad.length}/6 Jogadores <br> (Overall Médio: ${avgOverall})`;
}

function renderCoachWidget(coach) {
    const coachWidgetContent = document.querySelector('.widget-card[data-widget="coach"] .widget-content');
    if (coachWidgetContent && coach) {
        const mainText = coachWidgetContent.querySelector('.card-main-text');
        const subText = coachWidgetContent.querySelector('.card-sub-text');
        mainText.textContent = coach.name;
        subText.innerHTML = `Overall: <b style="color: var(--gold-color);">${coach.overall}</b> | Química: <b style="color: var(--gold-color);">${coach.quimica}</b>`;
    }
}

function renderStadiumWidget(stadium) {
    const stadiumWidgetContent = document.querySelector('.widget-card[data-widget="stadium"] .widget-content');
    if (stadiumWidgetContent && stadium) {
        const mainText = stadiumWidgetContent.querySelector('.card-main-text');
        const subText = stadiumWidgetContent.querySelector('.card-sub-text');
        const nivel = stadium.nivel || 1; 
        
        mainText.textContent = stadium.name;
        subText.innerHTML = `Nível do Estádio: <b style="color: var(--gold-color);">${nivel}</b>`;
        
        render3DStadium(stadium, 'stadium-widget-render-area');
    }
}

async function assembleLeague(userId, userClubData, temporada, userHasAlreadyViewed) {
    allowRealtimeLeagueRender = userHasAlreadyViewed;
    const q = query(collection(db, 'endlessclubes'), where("temporada", "==", temporada), where("ativo", "==", true));

    if (leagueListener) leagueListener(); 

    try {
        if (userHasAlreadyViewed) {
            console.log("Modo Classificação: Ao Vivo");
            const initialSnapshot = await getDocs(q);
            leagueClubs = initialSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderLeagueTable(leagueClubs, userId);
        } else {
            console.log("Modo Classificação: Congelado (Reconstruído)");
            const frozenClubs = await getFrozenLeagueTable(temporada);
            leagueClubs = frozenClubs;
            renderLeagueTable(leagueClubs, userId);
        }

        leagueListener = onSnapshot(q, (querySnapshot) => {
            liveLeagueClubs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (allowRealtimeLeagueRender) {
                leagueClubs = [...liveLeagueClubs];
                renderLeagueTable(leagueClubs, userId);
            }
        }, (error) => {
            console.error("Erro no listener da liga:", error);
        });

    } catch (error) {
        console.error("Erro ao montar a liga:", error);
    }
}

function renderLeagueTable(clubs, userId) {
    const tableBody = document.getElementById('league-table-body');
    const tableBodyPopup = document.getElementById('league-table-body-popup');
    const leagueWidgetCard = document.querySelector('.widget-card[data-widget="league"]');
    const leagueWidgetContent = leagueWidgetCard ? leagueWidgetCard.querySelector('.widget-content') : null;
    let tableHTML = '';

    clubs.sort((a, b) => {
        const pointsDiff = (b.pontos || 0) - (a.pontos || 0);
        if (pointsDiff !== 0) return pointsDiff;
        const goalDiffA = (a.golosMarcados || 0) - (a.golosSofridos || 0);
        const goalDiffB = (b.golosMarcados || 0) - (b.golosSofridos || 0);
        const goalDiff = goalDiffB - goalDiffA;
        if (goalDiff !== 0) return goalDiff;
        return (b.golosMarcados || 0) - (a.golosMarcados || 0);
    });
    clubs.forEach((club, index) => {
        const isUser = club.id === userId;
        tableHTML += `<tr ${isUser ? 'class="user-team-row"' : ''}><td>${index + 1}</td><td>${club.nome}</td><td><b>${club.pontos || 0}</b></td><td>${club.jogosDisputados || 0}</td><td>${club.vitorias || 0}</td><td>${club.empates || 0}</td><td>${club.derrotas || 0}</td><td>${club.golosMarcados || 0}</td><td>${club.golosSofridos || 0}</td></tr>`;
    });
    
    tableBody.innerHTML = tableHTML;
    tableBodyPopup.innerHTML = tableHTML;

    setTimeout(() => {
        if (!leagueWidgetCard || !leagueWidgetContent) {
            return;
        }

        const userRow = tableBody.querySelector('.user-team-row');
        const contentClientHeight = leagueWidgetContent.clientHeight;
        const contentScrollHeight = leagueWidgetContent.scrollHeight;

        if (contentScrollHeight > contentClientHeight) {
            if (userRow) {
                userRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, 300);
}

async function getFrozenLeagueTable(seasonId) {
    try {
        const clubsQuery = query(collection(db, 'endlessclubes'), where("temporada", "==", seasonId), where("ativo", "==", true));
        const clubsSnapshot = await getDocs(clubsQuery);
        
        const clubsMap = new Map();
        clubsSnapshot.forEach(doc => {
            clubsMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        const dayOfMonth = new Date().getDate();
        const semanaAtual = Math.floor((dayOfMonth - 1) / 7) + 1;
        const startJornada = (semanaAtual - 1) * 7 + 1;
        const endJornada = startJornada + 6;

        const weekGamesQuery = query(collection(db, "endlessjogos"),
            where("seasonId", "==", seasonId),
            where("jornada", ">=", startJornada),
            where("jornada", "<=", endJornada));
        const weekGamesSnapshot = await getDocs(weekGamesQuery);

        weekGamesSnapshot.forEach(gameDoc => {
            const gameData = gameDoc.data();
            const homeTeam = clubsMap.get(gameData.homeTeamId);
            const awayTeam = clubsMap.get(gameData.awayTeamId);

            if (homeTeam && awayTeam) {
                homeTeam.jogosDisputados -= 1;
                awayTeam.jogosDisputados -= 1;
                homeTeam.golosMarcados -= gameData.homeScore;
                homeTeam.golosSofridos -= gameData.awayScore;
                awayTeam.golosMarcados -= gameData.awayScore;
                awayTeam.golosSofridos -= gameData.homeScore;

                if (gameData.homeScore > gameData.awayScore) { 
                    homeTeam.pontos -= 3;
                    homeTeam.vitorias -= 1;
                    awayTeam.derrotas -= 1;
                } else if (gameData.awayScore > gameData.homeScore) { 
                    awayTeam.pontos -= 3;
                    awayTeam.vitorias -= 1;
                    homeTeam.derrotas -= 1;
                } else { 
                    homeTeam.pontos -= 1;
                    homeTeam.empates -= 1;
                    awayTeam.pontos -= 1;
                    awayTeam.empates -= 1;
                }
            }
        });

        return Array.from(clubsMap.values());

    } catch (error) {
        console.error("Erro ao reconstruir a tabela de classificação congelada:", error);
        return []; 
    }
}

async function renderMatchResults(containerElement, userId, seasonId) {
    if (!containerElement) return;
    
    containerElement.innerHTML = '<div class="loading-spinner" style="width:40px; height:40px; border-width: 6px; margin-top: 20px;"></div>';

    try {
        const dayOfMonth = new Date().getDate();
        const semanaAtual = Math.floor((dayOfMonth - 1) / 7) + 1;
        const startJornada = (semanaAtual - 1) * 7 + 1;
        const endJornada = startJornada + 6;

        const weekGamesQuery = query(collection(db, "endlessjogos"),
            where("seasonId", "==", seasonId),
            where("jornada", ">=", startJornada),
            where("jornada", "<=", endJornada));
        
        const weekGamesSnapshot = await getDocs(weekGamesQuery);

        const promises = weekGamesSnapshot.docs.map(async (gameDoc) => {
            const gameData = gameDoc.data();
            const homeDocRef = doc(db, 'endlessclubes', gameData.homeTeamId);
            const awayDocRef = doc(db, 'endlessclubes', gameData.awayTeamId);
            const [homeDoc, awayDoc] = await Promise.all([getDoc(homeDocRef), getDoc(awayDocRef)]);
            const homeName = homeDoc.exists() ? homeDoc.data().nome : "Clube Desconhecido";
            const awayName = awayDoc.exists() ? awayDoc.data().nome : "Clube Desconhecido";
            return { ...gameData, homeTeam: homeName, awayTeam: awayName };
        });

        const gamesWithNames = await Promise.all(promises);
        let resultsHTML = '';
        if (gamesWithNames.length === 0) {
            resultsHTML = '<p style="text-align:center; padding: 20px;">Ainda não há jogos simulados para esta semana.</p>';
        } else {
            const gamesByJornada = {};
            gamesWithNames.forEach(game => {
                if (!gamesByJornada[game.jornada]) gamesByJornada[game.jornada] = [];
                gamesByJornada[game.jornada].push(game);
            });

            Object.keys(gamesByJornada).sort((a, b) => a - b).forEach(jornada => {
                resultsHTML += `<h5 style="text-align:center; margin:10px 0; color:var(--accent-color);">Jornada ${jornada}</h5>`;
                gamesByJornada[jornada].forEach(game => {
                    const isUserMatch = (game.homeTeamId === userId || game.awayTeamId === userId);
                    const matchClass = isUserMatch ? 'match-result user-match' : 'match-result';
                    resultsHTML += `<div class="${matchClass}"><span class="team-home">${game.homeTeam}</span><b>${game.homeScore} - ${game.awayScore}</b><span class="team-away">${game.awayTeam}</span></div>`;
                });
            });
        }
        containerElement.innerHTML = resultsHTML;

    } catch (error) {
        console.error("[ERRO EM renderMatchResults] A consulta falhou.", error);
        containerElement.innerHTML = `<p style="color: #ff6b6b; padding: 10px;">Ocorreu um erro ao carregar os resultados.</p>`;
    }
}

async function setupGrandeJornadaWidget(seasonId, week, userId) {
    const preSimContent = document.getElementById('pre-simulation-content');
    const resultsContainerWidget = document.getElementById('grande-jornada-results');
    const simulateBtnWidget = document.getElementById('simulate-week-btn-widget');
    const weekTitle = document.getElementById('grande-jornada-week');

    const dayOfMonth = new Date().getDate();
    const semanaAtual = Math.floor((dayOfMonth - 1) / 7) + 1;
    weekTitle.textContent = `Semana ${semanaAtual} de 4`;

    const lastViewed = currentUserClubData?.lastWeekViewed;
    const userHasAlreadyViewed = lastViewed && lastViewed.season === seasonId && lastViewed.week === semanaAtual;
    
    if (userHasAlreadyViewed) {
        preSimContent.style.display = 'none';
        resultsContainerWidget.style.display = 'block';
        renderMatchResults(resultsContainerWidget, userId, seasonId);
    } else {
        preSimContent.style.display = 'flex';
        resultsContainerWidget.style.display = 'none';
        
        const endlessConfigSnap = await getDoc(doc(db, 'paineis', 'endless_configuracoes'));
        const ultimaSemanaSimulada = endlessConfigSnap.exists() ? endlessConfigSnap.data().ultimaSemanaSimulada || 0 : 0;

        if (ultimaSemanaSimulada >= semanaAtual) {
            simulateBtnWidget.disabled = false;
            simulateBtnWidget.innerHTML = '<i class="fas fa-play-circle"></i> Ver/Simular Semana';
        } else {
            simulateBtnWidget.disabled = true;
            simulateBtnWidget.innerHTML = '<i class="fas fa-clock"></i> Aguardando Simulação';
        }
    }
}

function setupInteractivity(userId, seasonId) {
    document.getElementById('simulate-week-btn-widget')?.addEventListener('click', (event) => handleSimulationClick(event));

    const widgetPopup = document.getElementById('widget-popup');

    document.querySelectorAll('.expand-icon').forEach(icon => {
        icon.addEventListener('click', async (e) => {
            const widgetCard = e.target.closest('.widget-card');
            const widget = widgetCard.dataset.widget;
            const popupBody = document.getElementById('popup-body');
            const popupContent = widgetPopup.querySelector('.popup-content');

            popupBody.innerHTML = ''; 

            if (widget === 'squad') {
                const content = document.querySelector('#widget-details [data-content="squad"]');
                if (content && currentUserClubData && currentUserClubData.plantel) {
                    popupBody.innerHTML = content.innerHTML;
                    const formationString = currentUserClubData.treinador.formacaoAtual || "1-2-2-1";
                    document.getElementById('popup-title').textContent = `O Meu Plantel (Tática: ${formationString})`;

                    const pitchAreas = {
                        goalkeeper: popupBody.querySelector('.goalkeeper-area'),
                        defense: popupBody.querySelector('.defense-area'),
                        midfield: popupBody.querySelector('.midfield-area'),
                        attack: popupBody.querySelector('.attack-area')
                    };
                    
                    Object.values(pitchAreas).forEach(area => { if(area) area.innerHTML = '' });

                    const formationParts = formationString.split('-').slice(1).map(num => parseInt(num, 10));
                    const [defNeeded = 0, medNeeded = 0, avaNeeded = 0] = formationParts;

                    const players = currentUserClubData.plantel;
                    const goalkeepers = players.filter(p => p.position === 'GR');
                    const defenders = players.filter(p => p.position === 'DEF');
                    const midfielders = players.filter(p => p.position === 'MED');
                    const attackers = players.filter(p => p.position === 'AVA');
                    
                    let fieldPlayersPool = [...defenders, ...midfielders, ...attackers];

                    const formationDefenders = fieldPlayersPool.slice(0, defNeeded);
                    const formationMidfielders = fieldPlayersPool.slice(defNeeded, defNeeded + medNeeded);
                    const formationAttackers = fieldPlayersPool.slice(defNeeded + medNeeded, defNeeded + medNeeded + avaNeeded);
                    
                    const distributePlayers = (area, playerList) => {
                        if (!area) return;
                        playerList.forEach(player => {
                            const playerDot = document.createElement('div');
                            playerDot.className = 'player-dot';
                            playerDot.dataset.position = player.position; 
                            playerDot.textContent = player.overall;
                            
                            const tooltip = document.createElement('span');
                            tooltip.className = 'player-name-tooltip';
                            tooltip.textContent = `${player.name} (${player.position})`;
                            
                            playerDot.appendChild(tooltip);
                            area.appendChild(playerDot);
                        });
                    };

                    distributePlayers(pitchAreas.goalkeeper, goalkeepers);
                    distributePlayers(pitchAreas.defense, formationDefenders);
                    distributePlayers(pitchAreas.midfield, formationMidfielders);
                    distributePlayers(pitchAreas.attack, formationAttackers);
                }
            }
            
            else if (widget === 'stadium') { await openStadiumPopup(popupBody); } 
            else if (widget === 'coach') { await openCoachPopup(popupBody); } 
            
            else if (widget === 'match') {
                const lastViewed = currentUserClubData?.lastWeekViewed;
                const dayOfMonth = new Date().getDate();
                const semanaAtual = Math.floor((dayOfMonth - 1) / 7) + 1;
                const userHasAlreadyViewed = lastViewed && lastViewed.season === seasonId && lastViewed.week === semanaAtual;

                if (userHasAlreadyViewed) {
                    popupBody.innerHTML = '<div id="popup-match-results" class="match-results-container"></div>';
                    const popupResultsContainer = popupBody.querySelector('#popup-match-results');
                    renderMatchResults(popupResultsContainer, userId, seasonId);
                } else {
                    popupBody.innerHTML = `
                        <div style="text-align:center; padding: 40px 20px;">
                            <i class="fas fa-eye-slash card-big-icon"></i>
                            <p class="card-main-text" style="margin-top: 15px;">
                                Clique primeiro no botão "Ver/Simular Semana" no widget principal para revelar os resultados.
                            </p>
                        </div>
                    `;
                }
            }

            else if (widget === 'league') {
                document.getElementById('popup-title').textContent = "Classificação Computada";
                const content = document.querySelector('#widget-details [data-content="league"]');
                if (content) {
                    popupBody.innerHTML = content.innerHTML;
                    const popupTableBody = popupBody.querySelector('#league-table-body-popup');
                    if(popupTableBody) {
                        popupTableBody.innerHTML = document.getElementById('league-table-body').innerHTML;
                        popupTableBody.addEventListener('click', handleTeamRowClick);
                    }
                }
            }
            
            widgetPopup.style.display = 'flex';
            if (popupContent) popupContent.scrollTop = 0;
        });
    });

    const closePopup = (p) => () => p.style.display = 'none';
    const closeOnClickOutside = (p) => (e) => { if (e.target === p) p.style.display = 'none'; };

    [widgetPopup, shopPopup, document.getElementById('pack-opening-popup'), document.getElementById('initial-squad-popup')].forEach(p => {
        if(p) {
            p.querySelector('.popup-close')?.addEventListener('click', closePopup(p));
            p.addEventListener('click', closeOnClickOutside(p));
        }
    });

    shopIcon.addEventListener('click', () => {
        showNotification("Mercado Fechado", "O mercado de alterações estruturais só abre no final da temporada, quando a opção 'Fazer Alterações' estiver disponível.");
    });

    document.getElementById('league-table-body').addEventListener('click', handleTeamRowClick);
}

async function openStadiumPopup(popupBody) {
    const content = document.querySelector('#widget-details [data-content="stadium"]');
    if (content) popupBody.innerHTML = content.innerHTML;
    
    render3DStadium(currentUserClubData.estadio, 'stadium-3d-container');
    document.getElementById('popup-title').textContent = `Estádio (Nível ${currentUserClubData.estadio.nivel})`;

    const stadiumInfoRef = doc(db, 'paineis', 'infoestadios');
    const stadiumInfoSnap = await getDoc(stadiumInfoRef);
    const niveisEstadio = stadiumInfoSnap.data().niveis;

    const upgradeBtn = document.getElementById('upgrade-stadium-btn');
    const statusText = upgradeBtn.nextElementSibling;

    const pontosGastos = currentUserClubData.pontosGastosNestaTemporada || 0;
    const dinheiroDisponivel = Math.floor((currentUserClubData.pontos || 0) / 2) - pontosGastos;
    const custoBase = Math.floor(dinheiroDisponivel * (2/3));
    const custoFinal = Math.max(45, custoBase);
    
    statusText.innerHTML = `<b>Dinheiro de Performance Disponível: ${dinheiroDisponivel}</b><br><br>Aqui poderá ver o seu estádio...`;

    const currentLevel = currentUserClubData.estadio.nivel;
    const currentSeason = currentUserClubData.numerorealtemporada;
    const nextLevel = currentLevel + 1;

    if (niveisEstadio[nextLevel]) {
        const requiredSeason = niveisEstadio[nextLevel].temporadaReq;
        if (currentSeason >= requiredSeason) {
            if (dinheiroDisponivel >= custoFinal) {
                upgradeBtn.disabled = false;
                upgradeBtn.textContent = `Melhorar para Nível ${nextLevel} (Custo: ${custoFinal})`;
            } else {
                upgradeBtn.disabled = true;
                upgradeBtn.textContent = `Fundos Insuficientes (Precisa de ${custoFinal})`;
            }
        } else {
            upgradeBtn.disabled = true;
            upgradeBtn.textContent = `Desbloqueia na Temporada ${requiredSeason}`;
        }
    } else {
        upgradeBtn.disabled = true;
        upgradeBtn.textContent = 'Nível Máximo Atingido';
    }

    upgradeBtn.onclick = async () => {
        upgradeBtn.disabled = true;
        upgradeBtn.textContent = 'A Processar Compra...';

        try {
            const purchase = httpsCallable(functions, 'purchaseUpgrade');
            const result = await purchase({ upgradeType: 'stadium' });
            alert(result.data.message);
            location.reload(); 
        } catch (error) {
            console.error("Erro ao comprar melhoria de estádio:", error);
            alert("Erro: " + error.message);
            await openStadiumPopup(popupBody);
        }
    };
}

async function openCoachPopup(popupBody) {
    const coach = currentUserClubData.treinador;
    const contentTemplate = document.querySelector('#widget-details [data-content="coach"]');
    popupBody.innerHTML = contentTemplate ? contentTemplate.innerHTML : '<p>Detalhes do treinador.</p>';
    document.getElementById('popup-title').textContent = "Treinador e Táticas";

    const formationsInfoRef = doc(db, 'paineis', 'infoformacoes');
    const formationsInfoSnap = await getDoc(formationsInfoRef);
    if (!formationsInfoSnap.exists()) {
        popupBody.innerHTML = '<p>Erro: Não foi possível carregar as informações das táticas.</p>';
        return;
    }
    const formacoes = formationsInfoSnap.data().formacoes;

    const currentSeason = currentUserClubData.numerorealtemporada;
    const activeFormation = coach.formacaoAtual;
    
    const pontosGastos = currentUserClubData.pontosGastosNestaTemporada || 0;
    const dinheiroDisponivel = Math.floor((currentUserClubData.pontos || 0) / 2) - pontosGastos;
    const custoBase = Math.floor(dinheiroDisponivel * (2/3));
    const custoFinal = Math.max(45, custoBase); 

    let tacticsHtml = `<div class="tactic-selection-container">
        <h4>Táticas Disponíveis (Dinheiro de Performance: ${dinheiroDisponivel})</h4>`;
    
    const formacoesPossuidas = coach.formacoesDisponiveis || [];

    Object.entries(formacoes).forEach(([formation, data]) => {
        const isUnlockedBySeason = currentSeason >= data.temporadaReq;
        const isOwned = formacoesPossuidas.includes(formation);

        if (isOwned) {
            const isActive = formation === activeFormation;
            tacticsHtml += `<button class="tactic-btn ${isActive ? 'active-tactic' : ''}" 
                                    data-formation="${formation}" 
                                    ${isActive ? 'disabled' : ''}>${formation}</button>`;
        } else if (isUnlockedBySeason) {
            if (dinheiroDisponivel >= custoFinal) {
                tacticsHtml += `<button class="tactic-btn buy-tactic-btn" data-formation="${formation}">Comprar ${formation} (Custo: ${custoFinal})</button>`;
            } else {
                tacticsHtml += `<button class="tactic-btn" disabled 
                                        title="Fundos Insuficientes. Precisa de ${custoFinal}.">Comprar ${formation}</button>`;
            }
        } else {
            tacticsHtml += `<button class="tactic-btn" disabled 
                                    title="Desbloqueia na temporada ${data.temporadaReq}">${formation} <i class="fas fa-lock"></i></button>`;
        }
    });
    tacticsHtml += '</div><p id="tactic-status" style="text-align:center; margin-top:10px;"></p>';
    popupBody.innerHTML += tacticsHtml;

    popupBody.querySelectorAll('.tactic-btn:not(.buy-tactic-btn):not([disabled])').forEach(button => {
        button.addEventListener('click', async (e) => {
            const selectedFormation = e.target.dataset.formation;
            const statusEl = document.getElementById('tactic-status');
            
            popupBody.querySelectorAll('.tactic-btn').forEach(btn => btn.disabled = true);
            statusEl.textContent = 'A atualizar tática...';

            try {
                const oldFormationPoints = currentUserClubData.formacaoatualpontos;
                const newFormationPoints = formacoes[selectedFormation].pontos;
                const newTotalOverall = (currentUserClubData.overall - oldFormationPoints) + newFormationPoints;

                const clubRef = doc(db, 'endlessclubes', auth.currentUser.uid);
                await updateDoc(clubRef, {
                    'treinador.formacaoAtual': selectedFormation,
                    'formacaoatualpontos': newFormationPoints,
                    'overall': newTotalOverall
                });

                currentUserClubData.treinador.formacaoAtual = selectedFormation;
                currentUserClubData.formacaoatualpontos = newFormationPoints;
                currentUserClubData.overall = newTotalOverall;

                statusEl.textContent = `Tática alterada para ${selectedFormation}!`;
                setTimeout(() => openCoachPopup(popupBody), 1500); 
            } catch (error) {
                console.error("Erro ao atualizar tática:", error);
                statusEl.textContent = "Erro ao guardar. Tente novamente.";
                popupBody.querySelectorAll('.tactic-btn').forEach(btn => btn.disabled = false);
            }
        });
    });

    popupBody.querySelectorAll('.buy-tactic-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const formationToBuy = e.target.dataset.formation;
            const btn = e.target;
            btn.disabled = true;
            btn.textContent = 'A Processar Compra...';

            try {
                const purchase = httpsCallable(functions, 'purchaseUpgrade');
                const result = await purchase({ upgradeType: 'tactic', itemId: formationToBuy });
                
                alert(result.data.message);
                location.reload(); 
            } catch (error) {
                console.error("Erro ao comprar tática:", error);
                alert("Erro: " + error.message);
                await openCoachPopup(popupBody); 
            }
        });
    });
}

async function getGameSeasonInfo() {
    const globalConfigSnap = await getDoc(doc(db, 'paineis', 'configuracoes_gerais'));
    const endlessConfigSnap = await getDoc(doc(db, 'paineis', 'endless_configuracoes'));

    const seasonIdentifier = globalConfigSnap.exists() ? globalConfigSnap.data().temporadaAtual : 'default_season';
    const JORNADAS_PER_SEASON = endlessConfigSnap.exists() ? endlessConfigSnap.data().jornadasPorTemporada : 28;
    
    const TEAMS_IN_LEAGUE = 20;
    const GAMES_PER_JORNADA = TEAMS_IN_LEAGUE / 2;

    const gamesQuery = query(collection(db, "endlessjogos"), where("seasonId", "==", seasonIdentifier));
    const gamesSnapshot = await getDocs(gamesQuery);
    const totalGamesSimulated = gamesSnapshot.size;

    const totalJornadasSimulated = Math.floor(totalGamesSimulated / GAMES_PER_JORNADA);
    
    const currentGameSeason = Math.floor(totalJornadasSimulated / JORNADAS_PER_SEASON) + 1;
    const currentJornadaInSeason = totalJornadasSimulated % JORNADAS_PER_SEASON;

    return {
        currentGameSeason,
        currentJornadaInSeason,
        seasonIdentifier,
        JORNADAS_PER_SEASON
    };
}

async function handleSimulationClick(event) {
    const clickedButton = event.currentTarget;
    if (!clickedButton) return;

    const btnWidget = document.getElementById('simulate-week-btn-widget');
    const btnPopup = document.getElementById('simulate-week-btn');
    if (btnWidget) btnWidget.disabled = true;
    if (btnPopup) btnPopup.disabled = true;

    clickedButton.classList.add('simulating');
    clickedButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> A Simular...`;

    const buttonRect = clickedButton.getBoundingClientRect();
    const confettiCount = 30;
    const confettiColors = ['var(--gold-color)', 'var(--accent-color)', '#ffffff', '#ff6b6b'];
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti-piece');
        confetti.style.left = `${buttonRect.left + buttonRect.width / 2}px`;
        confetti.style.top = `${buttonRect.top + buttonRect.height / 2}px`;
        const xEnd = (Math.random() - 0.5) * 350;
        const yEnd = (Math.random() - 0.7) * 400;
        const rotateEnd = Math.random() * 540;
        confetti.style.setProperty('--x-end', `${xEnd}px`);
        confetti.style.setProperty('--y-end', `${yEnd}px`);
        confetti.style.setProperty('--rotate-end', `${rotateEnd}deg`);
        confetti.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
        document.body.appendChild(confetti);
        setTimeout(() => { confetti.remove(); }, 1000);
    }
    
    try {
        const globalConfigSnap = await getDoc(doc(db, 'paineis', 'configuracoes_gerais'));
        const seasonIdentifier = globalConfigSnap.exists() ? globalConfigSnap.data().temporadaAtual : 'default_season';
        
        if (!seasonIdentifier || seasonIdentifier === 'default_season') {
             throw new Error("Identificador de temporada inválido.");
        }

        const dayOfMonth = new Date().getDate();
        const semanaAtual = Math.floor((dayOfMonth - 1) / 7) + 1;

        const lastWeekViewedData = {
            season: seasonIdentifier,
            week: semanaAtual
        };
        
        const clubRef = doc(db, 'endlessclubes', auth.currentUser.uid);
        await updateDoc(clubRef, {
            lastWeekViewed: lastWeekViewedData
        });

        if(currentUserClubData) {
            currentUserClubData.lastWeekViewed = lastWeekViewedData;
        }

    } catch (error) {
        console.error("Erro ao guardar a última semana vista:", error);
        if (btnWidget) btnWidget.disabled = false;
        if (btnPopup) btnPopup.disabled = false;
        clickedButton.classList.remove('simulating');
        clickedButton.innerHTML = `<i class="fas fa-play-circle"></i> Simular Semana`;
        alert("Ocorreu um erro ao guardar a sua ação. Por favor, tente novamente.");
        return; 
    }
    
    setTimeout(() => {
        location.reload();
    }, 1500);
}

let ownerToastTimer;

function showOwnerToast(clubName, ownerName) {
    const toastElement = document.getElementById('owner-toast');
    const toastContent = document.getElementById('owner-toast-content');

    clearTimeout(ownerToastTimer);

    toastContent.innerHTML = `
        <h3 style="color: var(--accent-color);">${clubName}</h3>
        <p>Treinador-Chefe:</p>
        <h4>${ownerName}</h4>
    `;

    toastElement.classList.add('show');

    ownerToastTimer = setTimeout(() => {
        toastElement.classList.remove('show');
    }, 4000);
}

async function handleTeamRowClick(event) {
    const row = event.target.closest('tr');
    if (!row || !row.cells[1]) return;

    const teamName = row.cells[1].textContent;
    const club = leagueClubs.find(c => c.nome === teamName);
    if (!club) return;

    const spinner = '<div class="loading-spinner" style="width:25px; height:25px; border-width: 4px;"></div>';
    showOwnerToast(teamName, spinner);

    if (!club.userId) {
        showOwnerToast(teamName, "Boot");
    } else {
        try {
            const userDocRef = doc(db, 'users', club.userId);
            const userSnap = await getDoc(userDocRef);
            const ownerName = userSnap.exists() ? userSnap.data().nometabela : "Utilizador Desconhecido";
            showOwnerToast(teamName, ownerName);
        } catch (error) {
            console.error("Erro ao procurar o dono do clube:", error);
            showOwnerToast(teamName, "Erro ao carregar");
        }
    }
}

async function openPlayerPack() {
    const packPopup = document.getElementById('pack-opening-popup');
    const cardsContainer = document.getElementById('player-cards-container');
    cardsContainer.innerHTML = '<div class="loading-spinner" style="width:60px; height:60px; border-width: 8px;"></div>';
    packPopup.style.display = 'flex';
    try {
        const players = await generateUniquePlayers();
        renderPlayerCards(players, cardsContainer);
    } catch (error) {
        console.error("Erro ao gerar jogadores:", error);
        cardsContainer.innerHTML = '<p style="color: #ff6b6b;">Ocorreu um erro ao abrir o pack.</p>';
    }
}

function renderPlayerCards(players, container) {
    let html = '';
    players.forEach(player => {
        const flagUrl = `https://flagcdn.com/w40/${player.countryCode.toLowerCase()}.png`;
        html += `<div class="player-card"><div class="position">${player.position}</div><div class="name">${player.name}</div><div class="nationality"><img src="${flagUrl}" alt="Bandeira"><span>${player.countryCode}</span></div><p style="margin-top: 15px; font-size: 1.3em; color: var(--gold-color); font-weight: bold;">${player.overall}</p></div>`;
    });
    container.innerHTML = html;
}
