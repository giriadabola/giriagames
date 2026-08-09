import { db } from './firebase.js';
import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getLatestSeason, mergeUserSeasonData } from './user-season.js';

const FORMATIONS = {
    '4-4-2': [
        { position: 'GK', top: '90%', left: '47%', positionType: 'GK' },
        { position: 'DL', top: '75%', left: '12%', positionType: 'DEF' },
        { position: 'DC1', top: '75%', left: '32%', positionType: 'DEF' },
        { position: 'DC2', top: '75%', left: '62%', positionType: 'DEF' },
        { position: 'DR', top: '75%', left: '82%', positionType: 'DEF' },
        { position: 'ML', top: '40%', left: '12%', positionType: 'MID' },
        { position: 'MC1', top: '40%', left: '32%', positionType: 'MID' },
        { position: 'MC2', top: '40%', left: '62%', positionType: 'MID' },
        { position: 'MR', top: '40%', left: '82%', positionType: 'MID' },
        { position: 'FW1', top: '10%', left: '32%', positionType: 'FWD' },
        { position: 'FW2', top: '10%', left: '62%', positionType: 'FWD' }
    ],
    '4-3-3': [
        { position: 'GK', top: '90%', left: '47%', positionType: 'GK' },
        { position: 'DL', top: '75%', left: '12%', positionType: 'DEF' },
        { position: 'DC1', top: '75%', left: '32%', positionType: 'DEF' },
        { position: 'DC2', top: '75%', left: '62%', positionType: 'DEF' },
        { position: 'DR', top: '75%', left: '82%', positionType: 'DEF' },
        { position: 'MC1', top: '40%', left: '32%', positionType: 'MID' },
        { position: 'MC2', top: '60%', left: '47%', positionType: 'MID' },
        { position: 'MC3', top: '40%', left: '62%', positionType: 'MID' },
        { position: 'AML', top: '10%', left: '25%', positionType: 'FWD' },
        { position: 'AMC', top: '10%', left: '50%', positionType: 'FWD' },
        { position: 'AMR', top: '10%', left: '75%', positionType: 'FWD' }
    ],
    '4-5-1': [
        { position: 'GK', top: '90%', left: '47%', positionType: 'GK' },
        { position: 'DL', top: '75%', left: '12%', positionType: 'DEF' },
        { position: 'DC1', top: '75%', left: '32%', positionType: 'DEF' },
        { position: 'DC2', top: '75%', left: '62%', positionType: 'DEF' },
        { position: 'DR', top: '75%', left: '82%', positionType: 'DEF' },
        { position: 'DML', top: '50%', left: '47%', positionType: 'MID' },
        { position: 'MC1', top: '40%', left: '10%', positionType: 'MID' },
        { position: 'AMC', top: '40%', left: '30%', positionType: 'MID' },
        { position: 'MC2', top: '40%', left: '64%', positionType: 'MID' },
        { position: 'DMR', top: '40%', left: '84%', positionType: 'MID' },
        { position: 'FW', top: '10%', left: '47%', positionType: 'FWD' }
    ],
    '3-4-3': [
        { position: 'GK', top: '90%', left: '47%', positionType: 'GK' },
        { position: 'DC1', top: '75%', left: '20%', positionType: 'DEF' },
        { position: 'DC2', top: '75%', left: '47%', positionType: 'DEF' },
        { position: 'DC3', top: '75%', left: '77%', positionType: 'DEF' },
        { position: 'ML', top: '40%', left: '12%', positionType: 'MID' },
        { position: 'MC1', top: '40%', left: '32%', positionType: 'MID' },
        { position: 'MC2', top: '40%', left: '62%', positionType: 'MID' },
        { position: 'MR', top: '40%', left: '82%', positionType: 'MID' },
        { position: 'AML', top: '10%', left: '25%', positionType: 'FWD' },
        { position: 'AMC', top: '10%', left: '50%', positionType: 'FWD' },
        { position: 'AMR', top: '10%', left: '75%', positionType: 'FWD' }
    ],
    '5-3-2': [
        { position: 'GK', top: '90%', left: '47%', positionType: 'GK' },
        { position: 'SW', top: '75%', left: '10%', positionType: 'DEF' },
        { position: 'WBL', top: '75%', left: '30%', positionType: 'DEF' },
        { position: 'DC1', top: '75%', left: '47%', positionType: 'DEF' },
        { position: 'DC2', top: '75%', left: '64%', positionType: 'DEF' },
        { position: 'WBR', top: '75%', left: '84%', positionType: 'DEF' },
        { position: 'MC1', top: '40%', left: '30%', positionType: 'MID' },
        { position: 'MC2', top: '55%', left: '47%', positionType: 'MID' },
        { position: 'MC3', top: '40%', left: '64%', positionType: 'MID' },
        { position: 'FW1', top: '10%', left: '30%', positionType: 'FWD' },
        { position: 'FW2', top: '10%', left: '64%', positionType: 'FWD' }
    ]
};

const POSITION_TO_CODE = {
    "Avançado": "FWD",
    "Atacante": "FWD",
    "Defesa": "DEF",
    "Médio": "MID",
    "Meio-campista": "MID",
    "Guarda-Redes": "GK",
    "Goleiro": "GK"
};

let cachedSeason = null;

async function getCurrentSeason() {
    if (cachedSeason) {
        return cachedSeason;
    }

    cachedSeason = await getLatestSeason(db);
    return cachedSeason;
}

function noopAsync() {
    return Promise.resolve();
}

class RivalSquadsView {
    constructor(root, { logUserAction = noopAsync } = {}) {
        this.root = typeof root === 'string' ? document.querySelector(root) : root;
        if (!this.root) {
            throw new Error('RivalSquadsView root não encontrado.');
        }

        this.logUserAction = logUserAction;
        this.allPlayers = [];
        this.assignedPlayers = {};
        this.userPlayerStyles = [];
        this.initialized = false;

        this.userSelect = this.root.querySelector('[data-rival-user-select]');
        this.formationSelect = this.root.querySelector('[data-rival-formation-select]');
        this.pitchArea = this.root.querySelector('[data-rival-pitch-area]');
        this.spinner = this.root.querySelector('[data-rival-spinner]');
        this.startingElevenContainer = this.root.querySelector('[data-rival-starting-eleven]');
        this.substitutesContainer = this.root.querySelector('[data-rival-substitutes]');

        this.handleUserSelectionChange = this.handleUserSelectionChange.bind(this);
        this.handleFormationChange = this.handleFormationChange.bind(this);
    }

    async init() {
        if (this.initialized) {
            return this;
        }

        this.userSelect?.addEventListener('change', this.handleUserSelectionChange);
        this.formationSelect?.addEventListener('change', this.handleFormationChange);

        await this.loadUsers();
        this.renderFormation(this.formationSelect?.value || '4-4-2');
        this.initialized = true;

        return this;
    }

    async handleFormationChange(event) {
        const selectedFormation = event.target.value;
        await this.logUserAction(`Mudou a visualização rival da formação para: ${selectedFormation}`);
        this.renderFormation(selectedFormation);
        await this.loadUserTeam();
    }

    async handleUserSelectionChange(event) {
        if (this.spinner) {
            this.spinner.style.display = 'inline-block';
        }

        try {
            const selectedUserId = event.target.value;
            const selectedUserName = event.target.options[event.target.selectedIndex]?.textContent || '';

            if (selectedUserId) {
                await this.logUserAction(`Visualizou o plantel rival de: ${selectedUserName}`);
            }

            await this.loadUserTeam();
        } finally {
            if (this.spinner) {
                this.spinner.style.display = 'none';
            }
        }
    }

    renderFormation(formationName) {
        const resolvedFormation = FORMATIONS[formationName] ? formationName : '4-4-2';
        const currentFormationPositions = FORMATIONS[resolvedFormation];

        this.assignedPlayers = {};
        this.pitchArea.innerHTML = '';

        currentFormationPositions.forEach((positionConfig) => {
            const positionElement = document.createElement('div');
            positionElement.className = 'rival-position';
            positionElement.dataset.position = positionConfig.position;
            positionElement.dataset.positionType = positionConfig.positionType;
            positionElement.dataset.assignedPlayerId = '';
            positionElement.style.top = positionConfig.top;
            positionElement.style.left = positionConfig.left;
            positionElement.textContent = '+';
            this.pitchArea.appendChild(positionElement);
        });
    }

    createPlayerCard(player) {
        const card = document.createElement('div');
        card.className = 'rival-player-card';
        card.dataset.playerId = player.id;

        const image = document.createElement('img');
        image.src = player.imagem || 'placeholder_image_url.png';
        image.alt = player.nome;
        image.draggable = false;
        card.appendChild(image);

        const info = document.createElement('div');
        info.className = 'rival-player-info';

        const playerName = document.createElement('span');
        playerName.className = 'rival-player-name';
        playerName.textContent = player.nome;
        info.appendChild(playerName);

        if (player.nacionalidadebandeira) {
            const countryFlag = document.createElement('img');
            countryFlag.className = 'rival-country-flag';
            countryFlag.src = player.nacionalidadebandeira;
            countryFlag.alt = player.nacionalidade || '';
            countryFlag.draggable = false;
            playerName.appendChild(countryFlag);
        }

        const playerPosition = document.createElement('span');
        playerPosition.className = 'rival-player-position';
        playerPosition.textContent = player.posicao;
        info.appendChild(playerPosition);

        card.appendChild(info);
        return card;
    }

    placePlayerInPosition(positionElement, player, positionId) {
        positionElement.innerHTML = '';

        const playerImg = document.createElement('img');
        playerImg.src = player.imagem || 'placeholder_image_url.png';
        playerImg.alt = player.nome;
        playerImg.draggable = false;
        positionElement.appendChild(playerImg);

        positionElement.dataset.assignedPlayerId = player.id;
        this.assignedPlayers[positionId] = player.id;
    }

    addStyleIcon(positionElement, styleId) {
        const styleData = this.userPlayerStyles.find((style) => style.id === styleId);
        if (!styleData) {
            return;
        }

        const styleIcon = document.createElement('img');
        styleIcon.src = styleData.imagem;
        styleIcon.className = 'rival-player-style-icon';
        styleIcon.alt = styleData.nome;
        styleIcon.draggable = false;
        positionElement.appendChild(styleIcon);
    }

    updateStartingElevenList() {
        this.startingElevenContainer.innerHTML = '';
        const assignedPlayerIds = Object.values(this.assignedPlayers).filter(Boolean);

        assignedPlayerIds.forEach((playerId) => {
            const player = this.allPlayers.find((candidate) => candidate.id === playerId);
            if (player) {
                this.startingElevenContainer.appendChild(this.createPlayerCard(player));
            }
        });
    }

    updateSubstitutesList() {
        this.substitutesContainer.innerHTML = '';
        const assignedPlayerIds = new Set(Object.values(this.assignedPlayers).filter(Boolean));
        const substitutePlayers = this.allPlayers.filter((player) => !assignedPlayerIds.has(player.id));

        substitutePlayers.forEach((player) => {
            this.substitutesContainer.appendChild(this.createPlayerCard(player));
        });
    }

    async fetchPlanteisData(userId, formation, season) {
        const planteisQuery = query(
            collection(db, 'planteis'),
            where('userId', '==', userId),
            where('formacao', '==', formation),
            where('temporada', '==', season)
        );

        const planteisSnapshot = await getDocs(planteisQuery);
        return planteisSnapshot.empty ? null : planteisSnapshot.docs[0].data();
    }

    async fetchAllUserPlayers(selectedUserId) {
        if (!selectedUserId) {
            this.allPlayers = [];
            return;
        }

        const playersQuery = query(collection(db, 'jogadores'), where('compradopor', '==', selectedUserId));
        const playersSnapshot = await getDocs(playersQuery);
        this.allPlayers = playersSnapshot.docs.map((playerDoc) => ({ ...playerDoc.data(), id: playerDoc.id }));
    }

    async fetchPlayerStyles(selectedUserId) {
        if (!selectedUserId) {
            this.userPlayerStyles = [];
            return;
        }

        const stylesQuery = query(
            collection(db, 'movimentos'),
            where('userId', '==', selectedUserId),
            where('managerTipo', '==', 'Estilos de Jogador')
        );

        const stylesSnapshot = await getDocs(stylesQuery);
        this.userPlayerStyles = stylesSnapshot.docs.map((styleDoc) => ({
            id: styleDoc.id,
            nome: styleDoc.data().itemManager,
            imagem: styleDoc.data().imagem
        }));
    }

    async loadUserTeam() {
        const selectedUserId = this.userSelect?.value;
        const selectedFormation = this.formationSelect?.value || '4-4-2';

        this.renderFormation(selectedFormation);
        this.startingElevenContainer.innerHTML = '';
        this.substitutesContainer.innerHTML = '';

        if (!selectedUserId) {
            this.allPlayers = [];
            return;
        }

        await Promise.all([
            this.fetchAllUserPlayers(selectedUserId),
            this.fetchPlayerStyles(selectedUserId)
        ]);

        const latestSeason = await getCurrentSeason();
        if (!latestSeason) {
            this.updateStartingElevenList();
            this.updateSubstitutesList();
            return;
        }

        const plantelData = await this.fetchPlanteisData(selectedUserId, selectedFormation, latestSeason);
        if (plantelData) {
            this.pitchArea.querySelectorAll('.rival-position').forEach((positionElement) => {
                const positionId = positionElement.dataset.position;
                const playerId = plantelData[positionId];
                if (!playerId) {
                    return;
                }

                const player = this.allPlayers.find((candidate) => candidate.id === playerId);
                if (!player) {
                    return;
                }

                const expectedCode = positionElement.dataset.positionType;
                const playerCode = POSITION_TO_CODE[player.posicao];
                if (playerCode !== expectedCode) {
                    return;
                }

                this.placePlayerInPosition(positionElement, player, positionId);
            });

            Object.entries(plantelData.estilos || {}).forEach(([positionId, styleId]) => {
                const positionElement = this.pitchArea.querySelector(`.rival-position[data-position="${positionId}"]`);
                if (positionElement) {
                    this.addStyleIcon(positionElement, styleId);
                }
            });
        }

        this.updateStartingElevenList();
        this.updateSubstitutesList();
    }

    async loadUsers() {
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        const users = [];

        querySnapshot.forEach((userDoc) => {
            const userData = mergeUserSeasonData(userDoc.data(), await getCurrentSeason());
            if (userData.natabela === "Yes" && userData.nometabela) {
                users.push({ id: userDoc.id, displayNome: userData.nometabela });
            }
        });

        users.sort((a, b) => a.displayNome.localeCompare(b.displayNome));

        while (this.userSelect.options.length > 1) {
            this.userSelect.remove(1);
        }

        users.forEach((user) => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.displayNome;
            this.userSelect.appendChild(option);
        });
    }
}

export async function initRivalSquadsView({ root, logUserAction } = {}) {
    const view = new RivalSquadsView(root, { logUserAction });
    await view.init();
    return view;
}
