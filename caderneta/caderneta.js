// caderneta/caderneta.js
import { app, db, auth } from "../core/firebase.js";
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, where, updateDoc, addDoc, serverTimestamp, writeBatch, runTransaction } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { COUNTRY_NAME_TO_ISO, normalizeCountryName } from "./map-data.js";
import { CONTINENT_MAP_PRESETS } from "./continent-presets.js";
import { destroyVectorMap, renderContinentMap as mountContinentMap } from "./continent-map.js";
import { buildNormalizedCadernetaPackPricing, getCadernetaPackDefinitionByType, getMiniGameCurrencyLabel } from "../core/mini-games-config.js";
import { createStickerPayload, drawPackPlayers, VALID_CADERNETA_RARITIES } from "./pack-engine.js";
import { CADERNETA_FREE_PACK_TYPE, CADERNETA_GIFT_OFFERS_COLLECTION, CADERNETA_GIFT_REDIRECT_PARAM } from "./pack-offers.js";
import { fetchUniqueSeasons, getPlayerSeasonData, hasPlayerDataForSeason } from "../admin/js/player-season-helper.js";
import { compactSeason, getLatestSeason, getSeasonData, mergeUserSeasonData } from "../core/user-season.js";

// App state
let currentUser = null;
let currentSeason = "";
let currentSeasonLabel = "";
let currentGcoinsField = "";
let currentSeasonData = {};
let userGcoins = 0;
let userMiniGcoins = 0;
let currentUserStatus = "";
let userSeasonPredictedGames = 0;
const REQUIRED_PREDICTED_GAMES_FOR_SHOP = 30;
let cadernetaPackPricing = {};
let pendingGiftRevealQueue = [];
let isProcessingGiftQueue = false;

let eligiblePlayers = [];
let allPlayersCatalog = [];
let userStickers = [];
let marketTradeStickers = [];
let incomingTradeProposals = [];
let outgoingTradeProposals = [];
let countriesList = [];
let clubsList = [];
let activeShopTab = 'comprar';
let selectedTradeTargetStickerId = null;
let selectedTradeOfferStickerIds = new Set();

// Navigation state
let currentView = "world"; // world, countries, clubs, album-page
let selectedContinent = "";
let selectedCountry = null;
let selectedClub = null;
let inventoryContextFilterEnabled = false;
const continentKeyAliases = {
    europa: "stats-europa",
    america_sul: "stats-america-sul",
    america_norte: "stats-america-norte",
    africa: "stats-africa",
    asia: "stats-asia",
    oceania: "stats-oceania"
};

const continentFocusPaths = {
    europa: "M120 150 L198 96 L286 100 L366 76 L466 92 L524 138 L498 194 L434 204 L382 246 L278 238 L202 216 L146 190 Z",
    america_norte: "M62 142 L122 84 L212 74 L286 102 L344 80 L416 106 L452 158 L410 194 L420 246 L362 284 L292 268 L214 312 L168 268 L126 262 L82 214 Z",
    america_sul: "M244 58 L308 38 L364 66 L382 132 L352 198 L320 246 L302 324 L258 382 L226 338 L234 268 L202 204 L182 154 L198 98 Z",
    africa: "M242 72 L316 54 L388 70 L432 126 L418 218 L382 296 L322 364 L272 326 L248 248 L210 180 L208 118 Z",
    asia: "M72 148 L140 104 L226 108 L322 78 L426 104 L506 152 L530 214 L482 260 L410 260 L362 298 L292 292 L238 252 L170 248 L106 216 Z",
    oceania: "M254 176 L324 138 L406 154 L462 206 L434 272 L378 294 L308 286 L252 246 Z"
};

const continentLabels = {
    europa: "Europa",
    america_sul: "América do Sul",
    america_norte: "América do Norte",
    africa: "África",
    asia: "Ásia",
    oceania: "Oceania"
};

const continentStatsIds = {
    "Europa": "stats-europa",
    "América Sul": "stats-america-sul",
    "América Norte": "stats-america-norte",
    "África": "stats-africa",
    "Ásia": "stats-asia",
    "Oceania": "stats-oceania"
};

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const contentContainer = document.querySelector('.content');

if (contentContainer) {
    contentContainer.style.display = 'none';
}

// Breadcrumb
const breadcrumb = document.getElementById('album-breadcrumb');
const breadcrumbWorld = document.getElementById('breadcrumb-world');

// Views
const viewWorld = document.getElementById('view-world');
const viewCountries = document.getElementById('view-countries');
const viewClubs = document.getElementById('view-clubs');
const viewAlbumPage = document.getElementById('view-album-page');

// List Container
const countriesListContainer = document.getElementById('countries-list');
const clubsListContainer = document.getElementById('clubs-list');
const stickerSlotsGrid = document.getElementById('sticker-slots-grid');
const inventoryGrid = document.getElementById('inventory-grid');
const inventoryCountSpan = document.getElementById('inventory-count');
const inventoryContextToggle = document.getElementById('inventory-context-toggle');
const worldMapContainer = document.getElementById('world-map');
const continentMapContainer = document.getElementById('continent-map');
const continentFocusKicker = document.getElementById('continent-focus-kicker');
const continentFocusName = document.getElementById('continent-focus-name');
const continentFocusSummary = document.getElementById('continent-focus-summary');
const continentFlagsLegend = document.getElementById('continent-flags-legend');
let worldMapObject = null;
let continentMapObject = null;
const worldMapPins = {
    america_norte: { lat: 45, lng: -105, label: "America do Norte" },
    america_sul: { lat: -17, lng: -60, label: "America do Sul" },
    europa: { lat: 52, lng: 15, label: "Europa" },
    africa: { lat: 8, lng: 20, label: "Africa" },
    asia: { lat: 34, lng: 95, label: "Asia" },
    oceania: { lat: -24, lng: 134, label: "Oceania" }
};

// Shop & Reveal modals
const shopModal = document.getElementById('shop-modal');
const btnOpenShop = document.getElementById('btn-open-shop');
const btnCloseShop = document.getElementById('btn-close-shop');
const buyPackBtns = document.querySelectorAll('.buy-pack-btn');
const shopModalSubtitle = shopModal?.querySelector('.modal-subtitle');
const shopTabButtons = document.querySelectorAll('.shop-tab-btn');
const shopTabPanels = document.querySelectorAll('.shop-tab-panel');
const tradeUserStickersContainer = document.getElementById('trade-user-stickers');
const tradeMarketStickersContainer = document.getElementById('trade-market-stickers');
const tradeSelectionSummary = document.getElementById('trade-selection-summary');
const tradeTargetSummary = document.getElementById('trade-target-summary');
const btnSubmitTradeProposal = document.getElementById('btn-submit-trade-proposal');
const incomingTradeProposalsContainer = document.getElementById('incoming-trade-proposals');
const outgoingTradeProposalsContainer = document.getElementById('outgoing-trade-proposals');

const revealModal = document.getElementById('reveal-modal');
const revealCardsContainer = document.getElementById('reveal-cards-container');
const btnFinishReveal = document.getElementById('btn-finish-reveal');
const revealPackStage = document.getElementById('reveal-pack-stage');
const revealPackSparkles = document.getElementById('reveal-pack-sparkles');
const revealPackArt = document.getElementById('reveal-pack-art');
const revealKicker = document.getElementById('reveal-kicker');
const revealTitle = document.getElementById('reveal-title');
const revealSubtitle = document.getElementById('reveal-subtitle');

const REVEAL_PACK_THEME = {
    normal: {
        label: 'Saqueta Normal',
        asset: 'caderneta/assets/pack-normal.svg',
        glow: 'rgba(194, 202, 214, 0.56)',
        accent: 'rgba(255, 212, 132, 0.72)'
    },
    rara: {
        label: 'Saqueta Rara',
        asset: 'caderneta/assets/pack-rara.svg',
        glow: 'rgba(95, 176, 255, 0.62)',
        accent: 'rgba(195, 230, 255, 0.8)'
    },
    epica: {
        label: 'Saqueta Epica',
        asset: 'caderneta/assets/pack-epica.svg',
        glow: 'rgba(189, 114, 255, 0.66)',
        accent: 'rgba(240, 204, 255, 0.82)'
    },
    lendaria: {
        label: 'Saqueta Lendaria',
        asset: 'caderneta/assets/pack-lendaria.svg',
        glow: 'rgba(255, 157, 73, 0.72)',
        accent: 'rgba(255, 234, 166, 0.88)'
    }
};

function logUserAction(actionDescription) {
    if (!currentUser) return;
    try {
        const eyeCollection = collection(db, 'eye');
        void addDoc(eyeCollection, {
            dataacao: serverTimestamp(),
            acao: actionDescription,
            userId: currentUser.uid
        }).catch((error) => console.error("Erro ao registar a ação na coleção 'eye':", error));
    } catch (error) {
        console.error("Erro ao registar ação na coleção 'eye':", error);
    }
}

// Initialize App
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        try {
            showLoader();
            await loadSeasonAndUserGcoins();
            await loadCadernetaPackPricing();
            await loadUserSeasonPredictionCount();
            await loadDatabaseData();
            checkUrlParametersForDirectNavigation();
            setupEventListeners();
            updateShopAvailability();
            updateNavigation();
            hideLoader();
            await logUserAction(`Entrou em ${document.title}`);
            await maybeProcessGiftPackOffersFromRankings();
        } catch (error) {
            console.error("Erro durante a inicialização:", error);
            alert("Erro ao carregar a caderneta. Por favor, recarregue a página.");
        }
    } else {
        window.location.href = "index.html";
    }
});

// Load the current season and GCoins field
async function loadSeasonAndUserGcoins() {
    currentSeasonLabel = await getLatestSeason(db);
    currentSeason = compactSeason(currentSeasonLabel);
    
    currentGcoinsField = "GCoins";

    // Load user GCoins
    const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
    if (userSnap.exists()) {
        const rawUserData = userSnap.data();
        const userData = mergeUserSeasonData(rawUserData, currentSeasonLabel);
        currentSeasonData = getSeasonData(rawUserData, currentSeasonLabel);
        currentUserStatus = userData.estatuto || "";
        userGcoins = userData.GCoins || 0;
        userMiniGcoins = userData.whowinsgCoins || 0;
    }
}

async function loadCadernetaPackPricing() {
    const settingsSnap = await getDoc(doc(db, 'settings', 'mini-ggames'));
    const cadernetaSettings = settingsSnap.exists() ? settingsSnap.data()?.caderneta : null;
    cadernetaPackPricing = buildNormalizedCadernetaPackPricing(cadernetaSettings?.packPricing || {});
    applyPackPricingToShop();
}

function shouldOpenGiftPacksFromRankings() {
    const params = new URLSearchParams(window.location.search);
    return params.get(CADERNETA_GIFT_REDIRECT_PARAM) === '1';
}

function clearGiftPackRedirectFlag() {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete(CADERNETA_GIFT_REDIRECT_PARAM);
    window.history.replaceState({}, '', currentUrl.toString());
}

async function fetchPendingGiftPackOffers() {
    const offersQuery = query(
        collection(db, CADERNETA_GIFT_OFFERS_COLLECTION),
        where('userId', '==', currentUser.uid),
        where('status', '==', 'pending')
    );
    const offersSnapshot = await getDocs(offersQuery);

    return offersSnapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((left, right) => {
            const seasonComparison = String(left.temporadaKey || '').localeCompare(String(right.temporadaKey || ''));
            if (seasonComparison !== 0) {
                return seasonComparison;
            }

            return Number(left.ronda || 0) - Number(right.ronda || 0);
        });
}

async function claimGiftPackOffer(offer) {
    const drawnPlayers = drawPackPlayers(eligiblePlayers, offer.packType || CADERNETA_FREE_PACK_TYPE);

    await runTransaction(db, async (transaction) => {
        const offerRef = doc(db, CADERNETA_GIFT_OFFERS_COLLECTION, offer.id);
        const offerSnap = await transaction.get(offerRef);

        if (!offerSnap.exists()) {
            throw new Error('A oferta da saqueta ja nao existe.');
        }

        const offerData = offerSnap.data();
        if (offerData.userId !== currentUser.uid) {
            throw new Error('Esta oferta nao pertence ao utilizador atual.');
        }

        if (offerData.status !== 'pending') {
            throw new Error('Esta oferta ja foi resgatada.');
        }

        transaction.update(offerRef, {
            status: 'claimed',
            claimedAt: serverTimestamp(),
            claimedFrom: 'caderneta'
        });

        drawnPlayers.forEach((draw) => {
            const stickerRef = doc(collection(db, 'caderneta'));
            const seasonToSave = currentSeasonLabel || offerData.temporadaKey || currentSeason;
            transaction.set(stickerRef, createStickerPayload(draw, currentUser.uid, serverTimestamp(), seasonToSave));
        });

        const movimentoRef = doc(collection(db, 'movimentos'));
        transaction.set(movimentoRef, {
            descricao: 'Saqueta Oferecida',
            para: currentUser.uid,
            de: offerData.sourceName || null,
            estado: 'CadernetaOffer',
            movimentoData: serverTimestamp(),
            taxa: null,
            temporada: offerData.temporadaKey || currentSeason,
            userId: currentUser.uid,
            tipo: 'Caderneta',
            valorreal: 0
        });
    });

    return {
        ...offer,
        drawnPlayers
    };
}

async function maybeProcessGiftPackOffersFromRankings() {
    if (!shouldOpenGiftPacksFromRankings()) {
        return;
    }

    clearGiftPackRedirectFlag();

    if (isProcessingGiftQueue) {
        return;
    }

    const pendingOffers = await fetchPendingGiftPackOffers();

    if (pendingOffers.length === 0) {
        return;
    }

    isProcessingGiftQueue = true;
    showLoader();

    try {
        pendingGiftRevealQueue = [];

        for (const offer of pendingOffers) {
            const claimedOffer = await claimGiftPackOffer(offer);
            pendingGiftRevealQueue.push({
                packType: claimedOffer.packType || CADERNETA_FREE_PACK_TYPE,
                drawnPlayers: claimedOffer.drawnPlayers
            });
        }

        await loadDatabaseData();
        playNextGiftReveal();
    } catch (error) {
        console.error('Erro ao processar saquetas oferecidas:', error);
        alert('Nao foi possivel abrir as saquetas oferecidas. Tente novamente.');
        isProcessingGiftQueue = false;
        pendingGiftRevealQueue = [];
    } finally {
        hideLoader();
    }
}

function playNextGiftReveal() {
    const nextGiftReveal = pendingGiftRevealQueue.shift();

    if (!nextGiftReveal) {
        isProcessingGiftQueue = false;
        return;
    }

    setupRevealScreen(nextGiftReveal.packType, nextGiftReveal.drawnPlayers);
}

function getPackConfigForType(packType) {
    const definition = getCadernetaPackDefinitionByType(packType);
    return definition ? cadernetaPackPricing[definition.configKey] || null : null;
}

function applyPackPricingToShop() {
    document.querySelectorAll('.pack-buy-card').forEach((card) => {
        const packType = card.dataset.packType;
        const priceElement = card.querySelector('.pack-price');
        const buyButton = card.querySelector('.buy-pack-btn');
        const packConfig = getPackConfigForType(packType);
        const hasValidPricing = Number.isFinite(packConfig?.price) && packConfig.price > 0;

        if (priceElement) {
            priceElement.innerHTML = hasValidPricing
                ? `<i class="fas fa-coins"></i> ${packConfig.price} ${getMiniGameCurrencyLabel(packConfig.currency)}`
                : '<i class="fas fa-ban"></i> Preco por configurar';
        }

        if (buyButton) {
            buyButton.disabled = !hasValidPricing;
        }
    });
}

function normalizeSeasonValue(value = "") {
    return String(value).replace(/\//g, '').trim();
}

function isShopUnlocked() {
    if (currentUserStatus === 'ruler') {
        return true;
    }

    return userSeasonPredictedGames >= REQUIRED_PREDICTED_GAMES_FOR_SHOP;
}

function getRemainingGamesForShopUnlock() {
    return Math.max(REQUIRED_PREDICTED_GAMES_FOR_SHOP - userSeasonPredictedGames, 0);
}

async function loadUserSeasonPredictionCount() {
    const predictionsQuery = query(collection(db, 'palpites'), where('userId', '==', currentUser.uid));
    const predictionsSnap = await getDocs(predictionsQuery);

    userSeasonPredictedGames = predictionsSnap.docs.filter((docSnap) => {
        const seasonValue = docSnap.data()?.temporada || "";
        return normalizeSeasonValue(seasonValue) === currentSeason;
    }).length;
}

function updateShopAvailability() {
    const unlocked = isShopUnlocked();
    const remainingGames = getRemainingGamesForShopUnlock();

    if (btnOpenShop) {
        btnOpenShop.disabled = !unlocked;
        btnOpenShop.title = unlocked
            ? "Loja de Saquetas desbloqueada"
            : `Desbloqueia com ${REQUIRED_PREDICTED_GAMES_FOR_SHOP} jogos palpitados na temporada`;
    }

    if (shopModalSubtitle) {
        shopModalSubtitle.textContent = unlocked
            ? "Escolhe a saqueta ideal para reforcar o teu album. Cada saqueta contem 6 cromos!"
            : `Mercado bloqueado: precisas de ${REQUIRED_PREDICTED_GAMES_FOR_SHOP} jogos palpitados na temporada ${currentSeasonLabel || 'atual'}. Tens ${userSeasonPredictedGames} e faltam ${remainingGames}.`;
    }

    buyPackBtns.forEach((button) => {
        const card = button.closest('.pack-buy-card');
        const packConfig = card ? getPackConfigForType(card.dataset.packType) : null;
        const hasValidPricing = Number.isFinite(packConfig?.price) && packConfig.price > 0;
        button.disabled = !unlocked || !hasValidPricing;
        button.textContent = unlocked ? 'Comprar' : `Bloqueado (${userSeasonPredictedGames}/${REQUIRED_PREDICTED_GAMES_FOR_SHOP})`;
    });
}

function switchShopTab(tabId) {
    activeShopTab = tabId;

    shopTabButtons.forEach((button) => {
        const isActive = button.dataset.shopTab === tabId;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    shopTabPanels.forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.shopPanel === tabId);
    });
}

async function loadTradeMarketData() {
    const tradeStickersQuery = query(
        collection(db, 'caderneta'),
        where('emTroca', '==', true),
        where('Nacaderneta', '==', false)
    );
    const tradeStickersSnapshot = await getDocs(tradeStickersQuery);
    marketTradeStickers = tradeStickersSnapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((sticker) => sticker.userId !== currentUser.uid);

    const [incomingSnap, outgoingSnap] = await Promise.all([
        getDocs(query(collection(db, 'cadernetaPropostas'), where('toUserId', '==', currentUser.uid))),
        getDocs(query(collection(db, 'cadernetaPropostas'), where('fromUserId', '==', currentUser.uid)))
    ]);

    incomingTradeProposals = incomingSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    outgoingTradeProposals = outgoingSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

function getStickerPlayer(sticker) {
    return allPlayersCatalog.find((entry) => entry.id === sticker.idplayer) || null;
}

function getTradableUserStickers() {
    return userStickers.filter((sticker) => sticker.Nacaderneta !== true);
}

function getStickerDisplayName(sticker) {
    const player = getStickerPlayer(sticker);
    return player?.nome || 'Cromo';
}

function createTradeStickerCard(sticker, options = {}) {
    const {
        canToggleListing = false,
        isListed = false,
        isSelected = false,
        isTargeted = false,
        primaryActionLabel = '',
        primaryActionData = '',
        secondaryActionLabel = '',
        secondaryActionData = '',
        showOwnedFlag = false
    } = options;

    const player = getStickerPlayer(sticker);
    if (!player) return '';

    return `
        <div class="trade-sticker-card ${isSelected ? 'is-selected' : ''} ${isTargeted ? 'is-targeted' : ''} ${isListed ? 'is-listed' : ''}" data-sticker-id="${sticker.id}">
            <div class="cromo-wrapper">
                ${createStickerHTML(player, sticker.casta)}
            </div>
            <div class="trade-sticker-actions">
                ${canToggleListing ? `<button class="trade-mini-btn ${isListed ? 'danger' : 'secondary'}" type="button" data-action="toggle-listing" data-sticker-id="${sticker.id}">${isListed ? 'Retirar da troca' : 'Colocar para troca'}</button>` : ''}
                ${primaryActionLabel ? `<button class="trade-mini-btn primary" type="button" data-action="${primaryActionData}" data-sticker-id="${sticker.id}">${primaryActionLabel}</button>` : ''}
                ${secondaryActionLabel ? `<button class="trade-mini-btn secondary" type="button" data-action="${secondaryActionData}" data-sticker-id="${sticker.id}">${secondaryActionLabel}</button>` : ''}
                ${showOwnedFlag ? `<span class="trade-owned-flag"><i class="fas fa-check-circle"></i> Ja tens este jogador</span>` : ''}
            </div>
        </div>
    `;
}

function updateTradeSelectionSummary() {
    const selectedStickers = getTradableUserStickers().filter((sticker) => selectedTradeOfferStickerIds.has(sticker.id));
    if (!tradeSelectionSummary) return;

    tradeSelectionSummary.textContent = selectedStickers.length > 0
        ? `Selecionaste ${selectedStickers.length} cromo(s): ${selectedStickers.map(getStickerDisplayName).join(', ')}`
        : 'Nenhum cromo selecionado para proposta.';
}

function updateTradeTargetSummary() {
    if (!tradeTargetSummary) return;

    const targetSticker = marketTradeStickers.find((sticker) => sticker.id === selectedTradeTargetStickerId);
    tradeTargetSummary.textContent = targetSticker
        ? `Queres receber: ${getStickerDisplayName(targetSticker)}`
        : 'Nenhum cromo de outro utilizador selecionado.';
}

function userAlreadyOwnsPlayerId(playerId) {
    return userStickers.some((sticker) => sticker.idplayer === playerId);
}

function renderTradeUserStickers() {
    if (!tradeUserStickersContainer) return;

    const tradableStickers = getTradableUserStickers();
    if (tradableStickers.length === 0) {
        tradeUserStickersContainer.innerHTML = '<div class="predictions-status-msg">Nao tens cromos disponiveis para troca.</div>';
        updateTradeSelectionSummary();
        return;
    }

    tradeUserStickersContainer.innerHTML = tradableStickers.map((sticker) => createTradeStickerCard(sticker, {
        canToggleListing: true,
        isListed: sticker.emTroca === true,
        isSelected: selectedTradeOfferStickerIds.has(sticker.id),
        primaryActionLabel: selectedTradeOfferStickerIds.has(sticker.id) ? 'Remover proposta' : 'Selecionar',
        primaryActionData: 'toggle-offer-selection'
    })).join('');

    updateTradeSelectionSummary();
}

function renderTradeMarketStickers() {
    if (!tradeMarketStickersContainer) return;

    if (marketTradeStickers.length === 0) {
        tradeMarketStickersContainer.innerHTML = '<div class="predictions-status-msg">Ainda nao existem cromos de outros utilizadores para troca.</div>';
        updateTradeTargetSummary();
        return;
    }

    tradeMarketStickersContainer.innerHTML = marketTradeStickers.map((sticker) => createTradeStickerCard(sticker, {
        isTargeted: selectedTradeTargetStickerId === sticker.id,
        primaryActionLabel: selectedTradeTargetStickerId === sticker.id ? 'Selecionado' : 'Quero este',
        primaryActionData: 'select-target-sticker',
        showOwnedFlag: userAlreadyOwnsPlayerId(sticker.idplayer)
    })).join('');

    updateTradeTargetSummary();
}

function createProposalStickerSide(stickerSnapshots = [], showOwnership = false) {
    return stickerSnapshots.map((sticker) => {
        const player = getStickerPlayer(sticker);
        if (!player) return '';

        return `
            <div class="trade-sticker-card">
                <div class="cromo-wrapper">
                    ${createStickerHTML(player, sticker.casta)}
                </div>
                ${showOwnership && userAlreadyOwnsPlayerId(sticker.idplayer) ? '<span class="trade-owned-flag"><i class="fas fa-check-circle"></i> Ja tens</span>' : ''}
            </div>
        `;
    }).join('');
}

function renderTradeProposals() {
    if (incomingTradeProposalsContainer) {
        if (incomingTradeProposals.length === 0) {
            incomingTradeProposalsContainer.innerHTML = '<div class="predictions-status-msg">Nao tens propostas recebidas.</div>';
        } else {
            incomingTradeProposalsContainer.innerHTML = incomingTradeProposals.map((proposal) => createTradeProposalCard(proposal, true)).join('');
        }
    }

    if (outgoingTradeProposalsContainer) {
        if (outgoingTradeProposals.length === 0) {
            outgoingTradeProposalsContainer.innerHTML = '<div class="predictions-status-msg">Nao tens propostas enviadas.</div>';
        } else {
            outgoingTradeProposalsContainer.innerHTML = outgoingTradeProposals.map((proposal) => createTradeProposalCard(proposal, false)).join('');
        }
    }
}

function getProposalStatusLabel(status = 'pending') {
    const labels = {
        pending: 'Pendente',
        accepted: 'Aceite',
        rejected: 'Rejeitada',
        cancelled: 'Cancelada'
    };
    return labels[status] || status;
}

function createTradeProposalCard(proposal, incoming = false) {
    const fromLabel = incoming ? 'Oferecem-te' : 'Ofereceste';
    const toLabel = incoming ? 'Recebes' : 'Pediste';
    const createdAt = proposal.createdAt?.toDate ? proposal.createdAt.toDate().toLocaleDateString('pt-PT') : 'Agora';

    return `
        <div class="trade-proposal-card" data-proposal-id="${proposal.id}">
            <div class="trade-proposal-meta">
                <div>
                    <strong>${fromLabel} ${proposal.offeredStickerIds?.length || 0} cromo(s)</strong>
                    <div class="trade-selection-summary">${createdAt}</div>
                </div>
                <span class="trade-proposal-status ${proposal.status || 'pending'}">${getProposalStatusLabel(proposal.status)}</span>
            </div>
            <div class="trade-proposal-stickers">
                <div>
                    <div class="trade-selection-summary">${fromLabel}</div>
                    <div class="trade-proposal-side">${createProposalStickerSide(proposal.offeredStickerSnapshots || [], incoming)}</div>
                </div>
                <div class="trade-proposal-arrow"><i class="fas fa-exchange-alt"></i></div>
                <div>
                    <div class="trade-selection-summary">${toLabel}</div>
                    <div class="trade-proposal-side">${createProposalStickerSide(proposal.requestedStickerSnapshots || [])}</div>
                </div>
            </div>
            ${incoming && proposal.status === 'pending' ? `
                <div class="trade-proposal-actions">
                    <button class="trade-mini-btn primary" type="button" data-action="accept-trade-proposal" data-proposal-id="${proposal.id}">Aceitar</button>
                    <button class="trade-mini-btn danger" type="button" data-action="reject-trade-proposal" data-proposal-id="${proposal.id}">Rejeitar</button>
                </div>
            ` : ''}
        </div>
    `;
}

// Load players, clubs, countries, and user stickers
async function loadDatabaseData() {
    // 1. Get seasons & players for the most recent season
    const seasonsList = await fetchUniqueSeasons(db);
    const mostRecentSeason = seasonsList[0] || '2025/2026';
    const defaultBaseSeason = seasonsList[seasonsList.length - 1] || '2025/2026';

    const playersSnap = await getDocs(collection(db, 'jogadores'));

    const seasonPlayersDocs = playersSnap.docs.filter(docSnap => 
        hasPlayerDataForSeason(docSnap.data(), mostRecentSeason, defaultBaseSeason)
    );

    allPlayersCatalog = seasonPlayersDocs.map(docSnap => {
        const sData = getPlayerSeasonData(docSnap.data(), mostRecentSeason);
        return {
            id: docSnap.id,
            ...sData
        };
    });

    // Only use explicit caderneta configuration for the most recent season.
    eligiblePlayers = allPlayersCatalog.filter((player) => {
        if (player.miniGames?.caderneta?.estado !== true) return false;
        const rarity = player.miniGames?.caderneta?.casta || 'comum';
        return VALID_CADERNETA_RARITIES.has(rarity);
    });

    // 2. Load countries
    const countriesSnap = await getDocs(collection(db, 'paises'));
    countriesList = countriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Load clubs
    const clubsSnap = await getDocs(collection(db, 'clubes'));
    clubsList = clubsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 4. Load user stickers from firebase
    const qStickers = query(collection(db, 'caderneta'), where('userId', '==', currentUser.uid));
    const stickersSnap = await getDocs(qStickers);
    userStickers = stickersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Render stats on continent cards
    renderContinentStats();
    if (currentView === 'world') {
        renderWorldMap();
    }
}

// Calculate and render progress stats per continent
function renderContinentStatsLegacy() {
    const conts = ["Europa", "América Sul", "América Norte", "África", "Ásia", "Oceania"];
    conts.forEach(continentName => {
        // Find country IDs belonging to this continent
        const countryIds = countriesList
            .filter(c => c.continente === continentName)
            .map(c => c.id);

        // Find club IDs in these countries
        const clubIds = clubsList
            .filter(club => countryIds.includes(club.paisId))
            .map(club => club.id);

        // Find total eligible players in these clubs
        const players = eligiblePlayers.filter(p => clubIds.includes(p.clubeId));
        
        // Count how many are pasted in the album (Nacaderneta === true)
        const pastedStickers = userStickers.filter(s => {
            const player = players.find(p => p.id === s.idplayer);
            return player && s.Nacaderneta === true;
        });

        // Update UI
        const statsEl = document.getElementById(continentStatsIds[continentName]);
        if (statsEl) {
            statsEl.textContent = `${pastedStickers.length}/${players.length} Cromos`;
        }
    });
}

// Event Listeners setup
function setupEventListeners() {
    // Continent card selection
    document.querySelectorAll('.continent-stat-card, .continent-map-pin, .continent-card').forEach(card => {
        const openContinent = () => {
            selectedContinent = card.dataset.continent;
            currentView = "countries";
            updateNavigation();
        };

        card.addEventListener('click', openContinent);
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openContinent();
            }
        });
    });

    // Breadcrumb clicks
    breadcrumbWorld.addEventListener('click', () => {
        currentView = "world";
        updateNavigation();
    });

    // Shop modal controls
    btnOpenShop.addEventListener('click', async () => {
        if (!isShopUnlocked()) {
            alert(`O mercado de saquetas desbloqueia apenas aos ${REQUIRED_PREDICTED_GAMES_FOR_SHOP} jogos palpitados na temporada. Tens ${userSeasonPredictedGames}/${REQUIRED_PREDICTED_GAMES_FOR_SHOP}.`);
            return;
        }
        switchShopTab('comprar');
        await refreshTradePanels();
        shopModal.classList.add('active');
    });
    btnCloseShop.addEventListener('click', () => {
        shopModal.classList.remove('active');
    });
    shopModal.addEventListener('click', (e) => {
        if (e.target === shopModal) shopModal.classList.remove('active');
    });

    shopTabButtons.forEach((button) => {
        button.addEventListener('click', async () => {
            switchShopTab(button.dataset.shopTab);
            if (button.dataset.shopTab !== 'comprar') {
                await refreshTradePanels();
            }
        });
    });

    tradeUserStickersContainer?.addEventListener('click', handleTradePanelClick);
    tradeMarketStickersContainer?.addEventListener('click', handleTradePanelClick);
    incomingTradeProposalsContainer?.addEventListener('click', handleTradePanelClick);
    outgoingTradeProposalsContainer?.addEventListener('click', handleTradePanelClick);
    btnSubmitTradeProposal?.addEventListener('click', submitTradeProposal);

    // Buy pack buttons
    buyPackBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const card = e.target.closest('.pack-buy-card');
            const packType = card.dataset.packType;
            await handlePackPurchase(packType);
        });
    });

    // Reveal finish button
    btnFinishReveal.addEventListener('click', async () => {
        revealModal.classList.remove('reveal-modal-opening', 'reveal-modal-burst', 'reveal-modal-ready');
        if (revealPackSparkles) revealPackSparkles.innerHTML = '';

        if (pendingGiftRevealQueue.length > 0) {
            playNextGiftReveal();
            return;
        }

        revealModal.classList.remove('active');
        await loadDatabaseData();
    });

    if (inventoryContextToggle) {
        inventoryContextToggle.addEventListener('click', () => {
            const context = getInventoryFilterContext();
            if (!context) return;

            inventoryContextFilterEnabled = !inventoryContextFilterEnabled;
            renderInventory();
        });
    }
}

async function refreshTradePanels() {
    selectedTradeTargetStickerId = null;
    selectedTradeOfferStickerIds = new Set();
    await loadTradeMarketData();
    renderTradeUserStickers();
    renderTradeMarketStickers();
    renderTradeProposals();
}

async function handleTradePanelClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    const stickerId = actionButton.dataset.stickerId;
    const proposalId = actionButton.dataset.proposalId;

    if (action === 'toggle-listing' && stickerId) {
        await toggleStickerTradeListing(stickerId);
        return;
    }

    if (action === 'toggle-offer-selection' && stickerId) {
        toggleTradeOfferSelection(stickerId);
        return;
    }

    if (action === 'select-target-sticker' && stickerId) {
        selectedTradeTargetStickerId = stickerId;
        renderTradeMarketStickers();
        updateTradeTargetSummary();
        return;
    }

    if (action === 'accept-trade-proposal' && proposalId) {
        await respondToTradeProposal(proposalId, 'accepted');
        return;
    }

    if (action === 'reject-trade-proposal' && proposalId) {
        await respondToTradeProposal(proposalId, 'rejected');
    }
}

function toggleTradeOfferSelection(stickerId) {
    if (selectedTradeOfferStickerIds.has(stickerId)) {
        selectedTradeOfferStickerIds.delete(stickerId);
    } else {
        selectedTradeOfferStickerIds.add(stickerId);
    }

    renderTradeUserStickers();
}

async function toggleStickerTradeListing(stickerId) {
    const sticker = userStickers.find((entry) => entry.id === stickerId);
    if (!sticker) return;

    try {
        await updateDoc(doc(db, 'caderneta', stickerId), {
            emTroca: sticker.emTroca === true ? false : true,
            tradeProposalId: null
        });

        sticker.emTroca = !(sticker.emTroca === true);
        sticker.tradeProposalId = null;
        await refreshTradePanels();
    } catch (error) {
        console.error('Erro ao atualizar estado de troca do cromo:', error);
        alert('Nao foi possivel atualizar o estado de troca do cromo.');
    }
}

async function submitTradeProposal() {
    if (!selectedTradeTargetStickerId) {
        alert('Seleciona primeiro um cromo de outro utilizador.');
        return;
    }

    if (selectedTradeOfferStickerIds.size === 0) {
        alert('Seleciona pelo menos um dos teus cromos para oferecer.');
        return;
    }

    const targetSticker = marketTradeStickers.find((entry) => entry.id === selectedTradeTargetStickerId);
    const offeredStickers = getTradableUserStickers().filter((entry) => selectedTradeOfferStickerIds.has(entry.id));

    if (!targetSticker || offeredStickers.length === 0) {
        alert('A proposta deixou de ser valida. Atualiza a lista e tenta novamente.');
        await refreshTradePanels();
        return;
    }

    try {
        await addDoc(collection(db, 'cadernetaPropostas'), {
            fromUserId: currentUser.uid,
            toUserId: targetSticker.userId,
            offeredStickerIds: offeredStickers.map((sticker) => sticker.id),
            requestedStickerIds: [targetSticker.id],
            offeredStickerSnapshots: offeredStickers.map((sticker) => ({
                id: sticker.id,
                idplayer: sticker.idplayer,
                casta: sticker.casta,
                userId: sticker.userId
            })),
            requestedStickerSnapshots: [{
                id: targetSticker.id,
                idplayer: targetSticker.idplayer,
                casta: targetSticker.casta,
                userId: targetSticker.userId
            }],
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        alert('Proposta enviada com sucesso.');
        await refreshTradePanels();
        switchShopTab('propostas');
    } catch (error) {
        console.error('Erro ao enviar proposta:', error);
        alert('Nao foi possivel enviar a proposta.');
    }
}

async function respondToTradeProposal(proposalId, nextStatus) {
    const proposal = incomingTradeProposals.find((entry) => entry.id === proposalId);
    if (!proposal || proposal.status !== 'pending') {
        alert('Esta proposta ja nao esta disponivel.');
        await refreshTradePanels();
        return;
    }

    try {
        await updateDoc(doc(db, 'cadernetaPropostas', proposalId), {
            status: nextStatus,
            updatedAt: serverTimestamp()
        });

        if (nextStatus === 'accepted') {
            await transferAcceptedTradeProposal({ ...proposal, status: nextStatus });
            await loadDatabaseData();
            updateNavigation();
        }

        await refreshTradePanels();
    } catch (error) {
        console.error('Erro ao responder a proposta:', error);
        alert('Nao foi possivel responder a proposta.');
    }
}

async function transferAcceptedTradeProposal(proposal) {
    const batch = writeBatch(db);

    proposal.offeredStickerIds.forEach((stickerId) => {
        batch.update(doc(db, 'caderneta', stickerId), {
            userId: proposal.toUserId,
            Nacaderneta: false,
            emTroca: false,
            tradeProposalId: proposal.id
        });
    });

    proposal.requestedStickerIds.forEach((stickerId) => {
        batch.update(doc(db, 'caderneta', stickerId), {
            userId: proposal.fromUserId,
            Nacaderneta: false,
            emTroca: false,
            tradeProposalId: proposal.id
        });
    });

    await batch.commit();
}

// Update views & breadcrumbs
function updateNavigation() {
    // Hide all views
    viewWorld.classList.add('hidden');
    viewCountries.classList.add('hidden');
    viewClubs.classList.add('hidden');
    viewAlbumPage.classList.add('hidden');

    // Reset breadcrumbs
    const crumbs = [`<span class="breadcrumb-item" id="breadcrumb-world">Mundo</span>`];

    if (currentView === "world") {
        viewWorld.classList.remove('hidden');
        renderWorldMap();
    } else if (currentView === "countries") {
        viewCountries.classList.remove('hidden');
        crumbs.push(`<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>`);
        crumbs.push(`<span class="breadcrumb-item active">${selectedContinent}</span>`);
        renderCountries();
    } else if (currentView === "clubs") {
        if (!selectedCountry) {
            currentView = "countries";
            viewCountries.classList.remove('hidden');
            crumbs.push(`<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>`);
            crumbs.push(`<span class="breadcrumb-item active">${selectedContinent || 'Europa'}</span>`);
            renderCountries();
        } else {
            viewClubs.classList.remove('hidden');
            crumbs.push(`<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>`);
            crumbs.push(`<span class="breadcrumb-item" id="breadcrumb-continent">${selectedContinent}</span>`);
            crumbs.push(`<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>`);
            crumbs.push(`<span class="breadcrumb-item active">${selectedCountry.nome}</span>`);
            renderClubs();
        }
    } else if (currentView === "album-page") {
        viewAlbumPage.classList.remove('hidden');
        crumbs.push(`<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>`);
        crumbs.push(`<span class="breadcrumb-item" id="breadcrumb-continent">${selectedContinent}</span>`);
        crumbs.push(`<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>`);
        crumbs.push(`<span class="breadcrumb-item" id="breadcrumb-country">${selectedCountry.nome}</span>`);
        crumbs.push(`<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>`);
        crumbs.push(`<span class="breadcrumb-item active">${selectedClub.nome}</span>`);
        renderAlbumPage();
    }

    breadcrumb.innerHTML = crumbs.join('');

    // Attach breadcrumb listeners
    const bWorld = document.getElementById('breadcrumb-world');
    if (bWorld) bWorld.onclick = () => { currentView = "world"; updateNavigation(); };

    const bCont = document.getElementById('breadcrumb-continent');
    if (bCont) bCont.onclick = () => { currentView = "countries"; updateNavigation(); };

    const bCountry = document.getElementById('breadcrumb-country');
    if (bCountry) bCountry.onclick = () => { currentView = "clubs"; updateNavigation(); };

    // Update inventory drawer always
    renderInventory();
}

function getInventoryFilterContext() {
    if (currentView === "album-page" && selectedClub) {
        return {
            type: 'club',
            id: selectedClub.id,
            label: selectedClub.nome || 'clube atual'
        };
    }

    if (currentView === "clubs" && selectedCountry) {
        return {
            type: 'country',
            id: selectedCountry.id,
            label: selectedCountry.nome || 'pais atual'
        };
    }

    return null;
}

function stickerMatchesInventoryContext(player, context) {
    if (!context) return true;

    const club = getPlayerClub(player);
    if (!club) return false;

    if (context.type === 'club') {
        return club.id === context.id;
    }

    if (context.type === 'country') {
        const country = getClubCountry(club);
        return country?.id === context.id;
    }

    return true;
}

function updateInventoryToggle(context) {
    if (!inventoryContextToggle) return;

    if (!context) {
        inventoryContextFilterEnabled = false;
        inventoryContextToggle.disabled = true;
        inventoryContextToggle.setAttribute('aria-pressed', 'false');
        inventoryContextToggle.classList.remove('is-active');
        inventoryContextToggle.textContent = 'Filtro por pais/clube indisponivel';
        return;
    }

    inventoryContextToggle.disabled = false;
    inventoryContextToggle.setAttribute('aria-pressed', inventoryContextFilterEnabled ? 'true' : 'false');
    inventoryContextToggle.classList.toggle('is-active', inventoryContextFilterEnabled);
    inventoryContextToggle.textContent = inventoryContextFilterEnabled
        ? `A mostrar so de ${context.label}`
        : `Mostrar so de ${context.label}`;
}

// Render countries belonging to current continent
function renderCountriesLegacy() {
    countriesListContainer.innerHTML = '';
    document.getElementById('countries-title').innerHTML = `<i class="fas fa-map-marker-alt"></i> Países de ${selectedContinent}`;
    
    const countries = countriesList.filter(c => c.continente === selectedContinent);
    
    if (countries.length === 0) {
        countriesListContainer.innerHTML = `<p class="subtitle">Não existem países configurados para este continente.</p>`;
        return;
    }

    countries.forEach(country => {
        // Filter clubs of this country that have players
        const clubsInCountry = clubsList.filter(cl => cl.paisId === country.id);
        const clubsWithPlayers = clubsInCountry.filter(cl => eligiblePlayers.some(p => p.clubeId === cl.id));

        if (clubsWithPlayers.length > 0) {
            const card = document.createElement('div');
            card.className = 'country-btn-card';
            card.innerHTML = `
                <img src="${country.imagem}" alt="Bandeira">
                <span>${country.nome}</span>
            `;
            card.addEventListener('click', () => {
                selectedCountry = country;
                currentView = "clubs";
                updateNavigation();
            });
            countriesListContainer.appendChild(card);
        }
    });
}

function normalizeText(value = "") {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function getContinentKey(value = "") {
    const normalized = normalizeText(value);
    if (normalized.includes('america') && normalized.includes('sul')) return 'america_sul';
    if (normalized.includes('america') && normalized.includes('norte')) return 'america_norte';
    if (normalized.includes('africa')) return 'africa';
    if (normalized.includes('asia')) return 'asia';
    if (normalized.includes('oceania')) return 'oceania';
    return 'europa';
}

function continentMatches(countryContinent, targetContinent) {
    return getContinentKey(countryContinent) === getContinentKey(targetContinent);
}

function normalizeClubName(value = "") {
    return normalizeText(value);
}

function normalizeCompact(value = "") {
    return normalizeText(value).replace(/\s+/g, '');
}

function buildClubAcronym(value = "") {
    const parts = normalizeText(value).split(' ').filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return parts.map((part) => part[0]).join('');
}

function getClubLookupKeys(club) {
    const values = [
        club?.nome,
        club?.nome_en,
        club?.codigoUrl
    ].filter(Boolean);

    const keys = new Set();

    values.forEach((value) => {
        const normalized = normalizeClubName(value);
        const compact = normalizeCompact(value);
        const acronym = buildClubAcronym(value);

        if (normalized) keys.add(normalized);
        if (compact) keys.add(compact);
        if (acronym) keys.add(acronym);
    });

    return keys;
}

function getPlayerClub(player) {
    if (!player) return null;

    const clubById = clubsList.find((club) => club.id === player.clubeId);
    if (clubById) return clubById;

    const playerClubName = player.clube || "";
    const normalizedPlayerClub = normalizeClubName(playerClubName);
    const compactPlayerClub = normalizeCompact(playerClubName);
    const acronymPlayerClub = buildClubAcronym(playerClubName);

    if (!normalizedPlayerClub && !compactPlayerClub && !acronymPlayerClub) return null;

    return clubsList.find((club) => {
        const lookupKeys = getClubLookupKeys(club);
        return (
            lookupKeys.has(normalizedPlayerClub) ||
            lookupKeys.has(compactPlayerClub) ||
            lookupKeys.has(acronymPlayerClub)
        );
    }) || null;
}

function playerBelongsToClub(player, clubId) {
    const resolvedClub = getPlayerClub(player);
    return resolvedClub?.id === clubId;
}

function getClubCountry(club) {
    if (!club) return null;

    const countryById = countriesList.find((country) => country.id === club.paisId);
    if (countryById) return countryById;

    const normalizedClubCountry = normalizeText(club.pais || "");
    if (!normalizedClubCountry) return null;

    return countriesList.find((country) => normalizeText(country.nome || "") === normalizedClubCountry) || null;
}

function hasAvailableClubs(countryId) {
    const clubsInCountry = clubsList.filter((club) => getClubCountry(club)?.id === countryId);
    return clubsInCountry.some((club) => eligiblePlayers.some((player) => playerBelongsToClub(player, club.id)));
}

function renderContinentStats() {
    const conts = ["Europa", "América Sul", "América Norte", "África", "Ásia", "Oceania"];
    conts.forEach(continentName => {
        const countryIds = countriesList
            .filter(c => continentMatches(c.continente, continentName))
            .map(c => c.id);

        const clubIds = clubsList
            .filter((club) => {
                const country = getClubCountry(club);
                return country && countryIds.includes(country.id);
            })
            .map(club => club.id);

        const players = eligiblePlayers.filter((player) => {
            const resolvedClub = getPlayerClub(player);
            return resolvedClub && clubIds.includes(resolvedClub.id);
        });
        const pastedStickers = userStickers.filter(s => {
            const player = players.find(p => p.id === s.idplayer);
            return player && s.Nacaderneta === true;
        });

        const statsEl = document.getElementById(getContinentStatsId(continentName));
        if (statsEl) {
            statsEl.textContent = `${pastedStickers.length}/${players.length} Cromos`;
        }
    });
}

function buildContinentStatsSummary() {
    const summary = {};
    const conts = ["Europa", "América Sul", "América Norte", "África", "Ásia", "Oceania"];

    conts.forEach(continentName => {
        const countryIds = countriesList
            .filter(c => continentMatches(c.continente, continentName))
            .map(c => c.id);

        const clubIds = clubsList
            .filter((club) => {
                const country = getClubCountry(club);
                return country && countryIds.includes(country.id);
            })
            .map(club => club.id);

        const players = eligiblePlayers.filter((player) => {
            const resolvedClub = getPlayerClub(player);
            return resolvedClub && clubIds.includes(resolvedClub.id);
        });
        const collected = userStickers.filter(s => {
            const player = players.find(p => p.id === s.idplayer);
            return player && s.Nacaderneta === true;
        }).length;

        summary[getContinentKey(continentName)] = {
            total: players.length,
            collected
        };
    });

    return summary;
}

function renderCountries() {
    countriesListContainer.innerHTML = '';
    countriesListContainer.classList.remove('hidden');
    document.getElementById('countries-title').innerHTML = `<i class="fas fa-map-marker-alt"></i> Países de ${selectedContinent}`;

    const countries = countriesList.filter(c => continentMatches(c.continente, selectedContinent));

    const countriesWithPlayers = countries.filter(country => {
        const clubsInCountry = clubsList.filter(club => getClubCountry(club)?.id === country.id);
        return clubsInCountry.some(club => eligiblePlayers.some(player => playerBelongsToClub(player, club.id)));
    });

    if (countriesWithPlayers.length === 0) {
        countriesListContainer.innerHTML = `<p class="subtitle">Não existem países com equipas disponíveis neste continente.</p>`;
        return;
    }

    countriesWithPlayers.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' })).forEach(country => {
        const countryIso = resolveCountryIso(country);
        const flagImage = getFlagImageUrl(countryIso) || country.imagem || '';
        const card = document.createElement('div');
        card.className = 'country-btn-card';
        card.innerHTML = `
            <img src="${flagImage}" alt="Bandeira de ${country.nome}">
            <span>${country.nome}</span>
        `;
        card.addEventListener('click', () => {
            selectedCountry = country;
            currentView = "clubs";
            updateNavigation();
        });
        countriesListContainer.appendChild(card);
    });
}

function renderContinentFlags(countries) {
    if (!continentFlagsLegend) return;

    const sortedCountries = countries
        .filter((country) => hasAvailableClubs(country.id))
        .slice()
        .sort((left, right) => left.nome.localeCompare(right.nome, 'pt', { sensitivity: 'base' }));

    continentFlagsLegend.innerHTML = sortedCountries.map((country) => {
        const countryIso = resolveCountryIso(country);
        const classes = 'continent-flag-chip is-available';
        const flagImage = getFlagImageUrl(countryIso) || country.imagem || '';

        if (!flagImage) {
            return '';
        }

        return `
            <button class="continent-flag-button" data-country-id="${country.id}" title="${country.nome}">
                <span class="${classes}">
                    <img src="${flagImage}" alt="Bandeira de ${country.nome}" loading="lazy">
                </span>
            </button>
        `;
    }).join('');

    continentFlagsLegend.querySelectorAll('.continent-flag-button').forEach((button) => {
        const country = sortedCountries.find((entry) => entry.id === button.dataset.countryId);
        if (!country || button.disabled) return;

        button.addEventListener('mouseenter', () => {
            continentMapObject?.previewCountry?.(country);
        });

        button.addEventListener('mouseleave', () => {
            continentMapObject?.clearPreview?.();
        });

        button.addEventListener('click', () => {
            continentMapObject?.selectCountry?.(country);
            selectedCountry = country;
            currentView = "clubs";
            updateNavigation();
        });
    });
}

function getFlagImageUrl(isoCode) {
    if (!isoCode || isoCode.length !== 2) return '';

    return `https://flagcdn.com/w80/${isoCode.toLowerCase()}.png`;
}

function getContinentStatsId(continentName) {
    const statsIds = {
        europa: "stats-europa",
        america_sul: "stats-america-sul",
        america_norte: "stats-america-norte",
        africa: "stats-africa",
        asia: "stats-asia",
        oceania: "stats-oceania"
    };
    return statsIds[getContinentKey(continentName)];
}

function resolveCountryIso(country) {
    if (!country) return null;

    if (country.iso && typeof country.iso === 'string' && country.iso.length === 2) {
        return country.iso.toUpperCase();
    }
    if (country.codigoUrl && typeof country.codigoUrl === 'string' && country.codigoUrl.length === 2) {
        return country.codigoUrl.toUpperCase();
    }
    if (country.id && typeof country.id === 'string' && country.id.length === 2) {
        return country.id.toUpperCase();
    }

    const candidates = [country.nome_en, country.nome, country.pais, country.name];
    for (const candidate of candidates) {
        const normalized = normalizeCountryName(candidate || "");
        if (COUNTRY_NAME_TO_ISO[normalized]) {
            return COUNTRY_NAME_TO_ISO[normalized];
        }
    }
    return null;
}

function buildWorldRegionValues() {
    const values = {};
    const continentIndexes = {
        america_norte: 1,
        america_sul: 2,
        europa: 3,
        africa: 4,
        asia: 5,
        oceania: 6
    };

    countriesList.forEach((country) => {
        const iso = resolveCountryIso(country);
        if (!iso) return;

        const continentKey = getContinentKey(country.continente);
        const continentIndex = continentIndexes[continentKey];
        if (continentIndex) {
            values[iso] = continentIndex;
        }
    });

    return values;
}

function getCountryByIso(isoCode) {
    if (!isoCode) return null;
    const searchIso = isoCode.toUpperCase();

    // 1. Direct match with resolveCountryIso
    let found = countriesList.find((country) => resolveCountryIso(country) === searchIso);
    if (found) return found;

    // 2. Direct property match (id, iso, codigoUrl)
    found = countriesList.find((country) => {
        const cId = (country.id || '').toUpperCase();
        const cIso = (country.iso || '').toUpperCase();
        const cCode = (country.codigoUrl || '').toUpperCase();
        return cId === searchIso || cIso === searchIso || cCode === searchIso;
    });
    if (found) return found;

    // 3. Match normalized name or alias
    return countriesList.find((country) => {
        const normName = normalizeCountryName(country.nome || country.pais || country.name || '');
        const aliasIso = COUNTRY_NAME_TO_ISO[normName];
        return aliasIso && aliasIso.toUpperCase() === searchIso;
    }) || null;
}

function openContinentFromKey(continentKey) {
    const labels = {
        europa: "Europa",
        america_sul: "América Sul",
        america_norte: "América Norte",
        africa: "África",
        asia: "Ásia",
        oceania: "Oceania"
    };

    selectedContinent = labels[continentKey] || "Europa";
    currentView = "countries";
    updateNavigation();
}

async function renderWorldMap() {
    if (!worldMapContainer) return;

    if (!worldMapContainer.querySelector('.world-ultra-svg')) {
        try {
            const res = await fetch('assets/worldUltra.svg');
            if (res.ok) {
                const svgText = await res.text();
                worldMapContainer.innerHTML = svgText;
                const svg = worldMapContainer.querySelector('svg');
                if (svg) {
                    svg.removeAttribute('style');
                    svg.setAttribute('class', 'world-ultra-svg');
                }
            }
        } catch (err) {
            console.error("Erro ao carregar worldUltra.svg:", err);
        }
    }

    setupWorldUltraInteractivity();
}

function setupWorldUltraInteractivity() {
    const svg = worldMapContainer?.querySelector('svg');
    if (!svg) return;

    const isoToContinentMap = {
        PT: "Europa", ES: "Europa", FR: "Europa", DE: "Europa", IT: "Europa", GB: "Europa", IE: "Europa", NL: "Europa", BE: "Europa", LU: "Europa", CH: "Europa", AT: "Europa", DK: "Europa", NO: "Europa", SE: "Europa", FI: "Europa", IS: "Europa", PL: "Europa", CZ: "Europa", SK: "Europa", HU: "Europa", RO: "Europa", BG: "Europa", GR: "Europa", TR: "Europa", HR: "Europa", RS: "Europa", SI: "Europa", BA: "Europa", ME: "Europa", AL: "Europa", MK: "Europa", UA: "Europa", BY: "Europa", LT: "Europa", LV: "Europa", EE: "Europa", RU: "Europa", MD: "Europa", CY: "Europa", MT: "Europa",
        US: "América Norte", CA: "América Norte", MX: "América Norte", CR: "América Norte", PA: "América Norte", JM: "América Norte", HT: "América Norte", HN: "América Norte", SV: "América Norte", GT: "América Norte", NI: "América Norte", DO: "América Norte", CU: "América Norte", TT: "América Norte",
        BR: "América Sul", AR: "América Sul", UY: "América Sul", PY: "América Sul", CL: "América Sul", BO: "América Sul", PE: "América Sul", EC: "América Sul", CO: "América Sul", VE: "América Sul",
        MA: "África", DZ: "África", TN: "África", EG: "África", LY: "África", SD: "África", SN: "África", CI: "África", GH: "África", NG: "África", CM: "África", ML: "África", BF: "África", GN: "África", GA: "África", CD: "África", CG: "África", AO: "África", ZA: "África", MZ: "África", ZM: "África", KE: "África", ET: "África", UG: "África", TZ: "África", RW: "África", BI: "África", MG: "África",
        JP: "Ásia", KR: "Ásia", KP: "Ásia", CN: "Ásia", TW: "Ásia", HK: "Ásia", MN: "Ásia", VN: "Ásia", TH: "Ásia", MY: "Ásia", SG: "Ásia", ID: "Ásia", PH: "Ásia", IN: "Ásia", PK: "Ásia", BD: "Ásia", LK: "Ásia", NP: "Ásia", IR: "Ásia", IQ: "Ásia", SA: "Ásia", QA: "Ásia", AE: "Ásia", OM: "Ásia", JO: "Ásia", IL: "Ásia", LB: "Ásia", SY: "Ásia", KZ: "Ásia", UZ: "Ásia", TM: "Ásia", KG: "Ásia", TJ: "Ásia", KH: "Ásia", LA: "Ásia", MM: "Ásia",
        AU: "Oceania", NZ: "Oceania", FJ: "Oceania", PG: "Oceania", NC: "Oceania"
    };

    if (Array.isArray(countriesList)) {
        countriesList.forEach((country) => {
            const iso = resolveCountryIso(country);
            if (iso && country.continente) {
                isoToContinentMap[iso] = country.continente;
            }
        });
    }

    const activeIsoSet = new Set();
    if (Array.isArray(countriesList)) {
        countriesList.forEach((country) => {
            const iso = resolveCountryIso(country);
            if (!iso) return;
            const clubsInCountry = clubsList.filter((club) => getClubCountry(club)?.id === country.id);
            const clubsWithPlayers = clubsInCountry.filter((club) => eligiblePlayers.some((player) => playerBelongsToClub(player, club.id)));
            if (clubsWithPlayers.length > 0) {
                activeIsoSet.add(iso);
            }
        });
    }

    let tooltipEl = document.getElementById('world-ultra-tooltip');
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'world-ultra-tooltip';
        tooltipEl.className = 'jvm-tooltip';
        document.body.appendChild(tooltipEl);
    }

    svg.querySelectorAll('.land').forEach((path) => {
        const iso = (path.id || '').toUpperCase();
        const titleText = (path.getAttribute('title') || '').toLowerCase();

        if (iso === 'AQ' || titleText.includes('antarctica') || titleText.includes('antartida')) {
            path.style.pointerEvents = 'none';
            path.style.cursor = 'default';
            return;
        }

        const continent = isoToContinentMap[iso];
        const hasTeams = activeIsoSet.has(iso);

        if (hasTeams) {
            path.classList.add('has-teams');
        } else {
            path.classList.remove('has-teams');
        }

        path.addEventListener('mouseenter', (e) => {
            const country = getCountryByIso(iso);
            const countryName = country ? country.nome : (path.getAttribute('title') || iso);
            
            if (continent) {
                const clubsInCountry = country ? clubsList.filter((club) => getClubCountry(club)?.id === country.id) : [];
                const clubsWithPlayers = clubsInCountry.filter((club) => eligiblePlayers.some((player) => playerBelongsToClub(player, club.id)));
                if (clubsWithPlayers.length > 0) {
                    tooltipEl.textContent = `${countryName} (${continent}) - ${clubsWithPlayers.length} equipas. Clica para abrir!`;
                } else {
                    tooltipEl.textContent = `${countryName} (${continent}) - Clica para abrir`;
                }
            } else {
                tooltipEl.textContent = countryName;
            }
            tooltipEl.style.display = 'block';
        });

        path.addEventListener('mousemove', (e) => {
            tooltipEl.style.left = (e.pageX + 14) + 'px';
            tooltipEl.style.top = (e.pageY + 14) + 'px';
        });

        path.addEventListener('mouseleave', () => {
            tooltipEl.style.display = 'none';
        });

        path.addEventListener('click', () => {
            tooltipEl.style.display = 'none';
            const country = getCountryByIso(iso);
            const targetContinent = country?.continente || continent || isoToContinentMap[iso] || "Ásia";

            if (country) {
                selectedContinent = targetContinent;
                selectedCountry = country;
                currentView = "clubs";
                updateNavigation();
            } else if (targetContinent) {
                selectedCountry = null;
                selectedContinent = targetContinent;
                currentView = "countries";
                updateNavigation();
            }
        });
    });
}

function checkUrlParametersForDirectNavigation() {
    const params = new URLSearchParams(window.location.search);
    const countryParam = params.get('pais') || params.get('country') || params.get('paisId') || params.get('countryId');
    if (countryParam) {
        const normParam = normalizeText(countryParam);
        const matchedCountry = countriesList.find(c => 
            c.id === countryParam || 
            normalizeText(c.nome || '') === normParam || 
            normalizeText(c.nome_en || '') === normParam ||
            resolveCountryIso(c)?.toLowerCase() === normParam
        );
        if (matchedCountry) {
            selectedContinent = matchedCountry.continente || "Europa";
            selectedCountry = matchedCountry;
            currentView = "clubs";
        }
    }
}

function renderContinentMap(continentKey, countries) {
    // Mapa removido
}

// Render clubs belonging to current country
function renderClubs() {
    clubsListContainer.innerHTML = '';
    document.getElementById('clubs-title').innerHTML = `<i class="fas fa-users"></i> Equipas de ${selectedCountry.nome}`;

    const clubs = clubsList.filter((club) => getClubCountry(club)?.id === selectedCountry.id);
    const clubsWithPlayers = clubs.filter((club) => eligiblePlayers.some((player) => playerBelongsToClub(player, club.id)));

    if (clubsWithPlayers.length === 0) {
        clubsListContainer.innerHTML = `<p class="subtitle">Não existem equipas com jogadores aptos para colecionar neste país.</p>`;
        return;
    }

    clubsWithPlayers.forEach(club => {
        const card = document.createElement('div');
        card.className = 'club-btn-card';
        card.innerHTML = `
            <img src="${club.imagem}" alt="Logótipo">
            <span>${club.nome}</span>
        `;
        card.addEventListener('click', () => {
            selectedClub = club;
            currentView = "album-page";
            updateNavigation();
        });
        clubsListContainer.appendChild(card);
    });
}

// Render album slots for current club
function renderAlbumPage() {
    stickerSlotsGrid.innerHTML = '';
    document.getElementById('club-view-logo').src = selectedClub.imagem;
    document.getElementById('club-view-name').textContent = selectedClub.nome;

    // Filter players for this club, sort by position (Guarda-redes -> Defesa -> Médio -> Avançado), and limit to 10
    const rawClubPlayers = eligiblePlayers.filter((player) => playerBelongsToClub(player, selectedClub.id));
    const sortedClubPlayers = sortPlayersByPosition(rawClubPlayers);
    const clubPlayers = sortedClubPlayers.slice(0, 10);
    
    // Fill remaining to 10 with empty placeholders if club has fewer
    const slots = [...clubPlayers];
    while (slots.length < 10) {
        slots.push(null);
    }

    // Progress counting
    let pastedCount = 0;

    slots.forEach((player, index) => {
        const slotEl = document.createElement('div');
        slotEl.className = 'sticker-slot';
        slotEl.dataset.slotIndex = index;

        if (player) {
            slotEl.dataset.playerId = player.id;

            // Check if user has pasted this sticker
            const sticker = userStickers.find(s => s.idplayer === player.id && s.Nacaderneta === true);

            if (sticker) {
                pastedCount++;
                slotEl.innerHTML = createStickerHTML(player, sticker.casta, 'album');
            } else {
                // Not pasted yet
                slotEl.innerHTML = `
                    <div class="slot-silhouette"><i class="fas fa-user-ninja"></i></div>
                    <div class="slot-name">${player.nome}</div>
                `;

                // Drag & Drop event listeners
                slotEl.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    slotEl.classList.add('drag-over');
                });
                slotEl.addEventListener('dragleave', () => {
                    slotEl.classList.remove('drag-over');
                });
                slotEl.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    slotEl.classList.remove('drag-over');
                    const playerId = e.dataTransfer.getData('text/plain');
                    if (playerId === player.id) {
                        await pasteSticker(playerId, slotEl);
                    } else {
                        alert("Este cromo pertence a outro lugar!");
                    }
                });
            }
        } else {
            // Empty placeholder
            slotEl.innerHTML = `
                <div class="slot-silhouette" style="opacity: 0.1;"><i class="fas fa-lock"></i></div>
                <div class="slot-name" style="opacity: 0.15;">Vazio</div>
            `;
        }

        stickerSlotsGrid.appendChild(slotEl);
    });

    document.getElementById('club-view-stats').textContent = `${pastedCount} / ${clubPlayers.length} Cromos Colados`;
}

function getStickerMeta(player) {
    const club = getPlayerClub(player);
    const country = getClubCountry(club);
    const countryIso = country ? resolveCountryIso(country) : null;

    return {
        club,
        country,
        faceImage: player.imagem || 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhTl6Ljabwgx-VXdZz8FcAoygQprujSsCoXc32Y_iU0FjYVPu1B6MffWwp8gcCVuV8TWn39FRk9OIe1nc-esubVJYmdLsTptAoR9GyqNuw4R5MBaeaoWXTc3JaqH2YVNtEmfReQqohvQKvHiI0XwE5na2ty2B9Bt4oELxYv2BaZ7R3UmeylpiVEiIbiLnCB/s320/soccer-ball-png.webp',
        flagImage: getFlagImageUrl(countryIso) || country?.imagem || '',
        countryName: country?.nome || '',
        clubName: player.clube || club?.nome || '',
        clubImage: club?.imagem || '',
        position: player.posicao || 'Jogador',
        number: player.numero || player.numeroCamisola || player.camisola || ''
    };
}

function getPositionPriority(position = '') {
    const normalized = (position || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    if (
        normalized.includes('guarda') ||
        normalized.includes('goleiro') ||
        normalized.includes('redes') ||
        normalized === 'gk' ||
        normalized === 'gr'
    ) {
        return 1; // Guarda-redes
    }

    if (
        normalized.includes('defesa') ||
        normalized.includes('defender') ||
        normalized.includes('lateral') ||
        normalized.includes('zagueiro') ||
        normalized === 'df' ||
        normalized === 'cb' ||
        normalized === 'lb' ||
        normalized === 'rb' ||
        normalized === 'dc' ||
        normalized === 'de' ||
        normalized === 'dd'
    ) {
        return 2; // Defesa
    }

    if (
        normalized.includes('medio') ||
        normalized.includes('meio') ||
        normalized.includes('mid') ||
        normalized.includes('volante') ||
        normalized === 'mc' ||
        normalized === 'cm' ||
        normalized === 'cam' ||
        normalized === 'cdm' ||
        normalized === 'md' ||
        normalized === 'me'
    ) {
        return 3; // Médio
    }

    if (
        normalized.includes('avanc') ||
        normalized.includes('atac') ||
        normalized.includes('forward') ||
        normalized.includes('ponta') ||
        normalized.includes('extremo') ||
        normalized.includes('lanca') ||
        normalized.includes('striker') ||
        normalized === 'st' ||
        normalized === 'cf' ||
        normalized === 'lw' ||
        normalized === 'rw' ||
        normalized === 'pl'
    ) {
        return 4; // Avançado
    }

    return 5; // Outro / Desconhecido
}

function sortPlayersByPosition(players) {
    return [...players].sort((left, right) => {
        const priorityLeft = getPositionPriority(left.posicao || left.position || '');
        const priorityRight = getPositionPriority(right.posicao || right.position || '');

        if (priorityLeft !== priorityRight) {
            return priorityLeft - priorityRight;
        }

        const numLeft = parseInt(left.numero || left.numeroCamisola || left.camisola, 10);
        const numRight = parseInt(right.numero || right.numeroCamisola || right.camisola, 10);
        if (!isNaN(numLeft) && !isNaN(numRight) && numLeft !== numRight) {
            return numLeft - numRight;
        }

        return (left.nome || '').localeCompare(right.nome || '', 'pt', { sensitivity: 'base' });
    });
}

function getPositionClass(position = '') {
    const priority = getPositionPriority(position);
    switch (priority) {
        case 1: return 'pos-guarda-redes';
        case 2: return 'pos-defesa';
        case 3: return 'pos-medio';
        case 4: return 'pos-avancado';
        default: return 'pos-outro';
    }
}

function createStickerCardMarkup(player, casta, variant = 'inventory') {
    const cardClass = casta.toLowerCase();
    const meta = getStickerMeta(player);
    const variantClass = variant === 'reveal' ? 'cromo-card--inventory cromo-card--showcase' : (variant === 'album' ? 'cromo-card--album' : 'cromo-card--inventory');
    const rarityBadgeMarkup = variant === 'reveal'
        ? `<span class="cromo-rarity-badge ${cardClass}">${casta}</span>`
        : '';
    const playerNameParts = (player.nome || '').trim().split(/\s+/).filter(Boolean);
    const playerFirstName = playerNameParts.shift() || player.nome || '';
    const playerLastName = playerNameParts.join(' ') || playerFirstName;
    const positionIconClass = getPositionIconClass(meta.position);
    const positionClass = getPositionClass(meta.position);

    const detailsMarkup = (variant === 'inventory' || variant === 'reveal')
        ? `
            <div class="cromo-details cromo-details--icons-only">
                <div class="cromo-details-accent"></div>
                <div class="cromo-details-icons-row">
                    <span class="cromo-detail-icon ${positionClass}" title="${meta.position}"><i class="${positionIconClass}" aria-hidden="true"></i></span>
                    ${meta.clubImage ? `<img src="${meta.clubImage}" alt="${meta.clubName}" class="cromo-detail-badge" title="${meta.clubName}">` : ''}
                    ${meta.flagImage ? `<img src="${meta.flagImage}" alt="${meta.countryName}" class="cromo-detail-flag" title="${meta.countryName}">` : ''}
                </div>
            </div>
        `
        : `
            <div class="cromo-details">
                <div class="cromo-details-accent"></div>
                <div class="cromo-detail-row cromo-detail-row--position">
                    <span class="cromo-detail-icon ${positionClass}"><i class="${positionIconClass}" aria-hidden="true"></i></span>
                    <span class="cromo-detail-value">${meta.position}</span>
                </div>
                <div class="cromo-detail-row">
                    ${meta.clubImage ? `<img src="${meta.clubImage}" alt="" class="cromo-detail-badge" aria-hidden="true">` : ''}
                    <span class="cromo-detail-value">${meta.clubName}</span>
                </div>
                <div class="cromo-detail-row">
                    ${meta.flagImage ? `<img src="${meta.flagImage}" alt="" class="cromo-detail-flag" aria-hidden="true">` : ''}
                    <span class="cromo-detail-value">${meta.countryName || 'Pais'}</span>
                </div>
            </div>
        `;

    return `
        <div class="cromo-card ${cardClass} ${variantClass}">
            ${rarityBadgeMarkup}
            <div class="cromo-photo-stage">
                <img src="${meta.faceImage}" alt="${player.nome}" class="cromo-photo-image">
                <div class="cromo-photo-stripes"></div>
                <div class="cromo-photo-overlay"></div>
            </div>

            <div class="cromo-name-block">
                <div class="cromo-name-first">${playerFirstName}</div>
                <div class="cromo-name-last">${playerLastName}</div>
            </div>

            ${detailsMarkup}
        </div>
    `;
}

function getPositionIconClass(position = '') {
    const priority = getPositionPriority(position);
    switch (priority) {
        case 1: return 'fas fa-hand-paper';
        case 2: return 'fas fa-shield-alt';
        case 3: return 'fas fa-puzzle-piece';
        case 4: return 'fas fa-bullseye';
        default: return 'fas fa-futbol';
    }
}

// Generate HTML layout for a sticker card
function createStickerHTML(player, casta, variant = 'inventory') {
    return createStickerCardMarkup(player, casta, variant);
}

function createRevealStickerHTML(player, rarity) {
    return createStickerCardMarkup(player, rarity, 'reveal');
}

// Render user's inventory (Nacaderneta === false)
function renderInventory() {
    inventoryGrid.innerHTML = '';
    const context = getInventoryFilterContext();
    updateInventoryToggle(context);

    // Filter stickers that are NOT pasted in the album
    const availableStickers = userStickers
        .filter((sticker) => sticker.Nacaderneta !== true)
        .filter((sticker) => {
            if (!inventoryContextFilterEnabled || !context) return true;

            const player = allPlayersCatalog.find((entry) => entry.id === sticker.idplayer);
            if (!player) return false;

            return stickerMatchesInventoryContext(player, context);
        });

    // Sort available stickers by player position (Guarda-redes -> Defesa -> Médio -> Avançado)
    availableStickers.sort((leftSticker, rightSticker) => {
        const playerLeft = allPlayersCatalog.find((entry) => entry.id === leftSticker.idplayer);
        const playerRight = allPlayersCatalog.find((entry) => entry.id === rightSticker.idplayer);
        const prioLeft = playerLeft ? getPositionPriority(playerLeft.posicao) : 99;
        const prioRight = playerRight ? getPositionPriority(playerRight.posicao) : 99;
        if (prioLeft !== prioRight) return prioLeft - prioRight;
        const numLeft = parseInt(playerLeft?.numero || playerLeft?.numeroCamisola || playerLeft?.camisola, 10);
        const numRight = parseInt(playerRight?.numero || playerRight?.numeroCamisola || playerRight?.camisola, 10);
        if (!isNaN(numLeft) && !isNaN(numRight) && numLeft !== numRight) {
            return numLeft - numRight;
        }
        return (playerLeft?.nome || '').localeCompare(playerRight?.nome || '', 'pt', { sensitivity: 'base' });
    });

    inventoryCountSpan.textContent = availableStickers.length;

    if (availableStickers.length === 0) {
        inventoryGrid.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; width:100%; color:var(--text-secondary); font-size:13px;">
                ${inventoryContextFilterEnabled && context
                    ? `Nao tens cromos do ${context.type === 'club' ? 'clube' : 'pais'} selecionado no inventario.`
                    : 'Inventario vazio. Compra saquetas na loja para obteres cromos!'}
            </div>
        `;
        return;
    }

    availableStickers.forEach(sticker => {
        const player = allPlayersCatalog.find((entry) => entry.id === sticker.idplayer);
        if (player) {
            const wrapper = document.createElement('div');
            wrapper.className = 'cromo-wrapper';
            wrapper.draggable = true;
            wrapper.innerHTML = createStickerHTML(player, sticker.casta);

            // Drag Start
            wrapper.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', player.id);
                wrapper.querySelector('.cromo-card').classList.add('dragging');
            });

            // Drag End
            wrapper.addEventListener('dragend', () => {
                const draggingCard = wrapper.querySelector('.cromo-card');
                if (draggingCard) draggingCard.classList.remove('dragging');
            });

            inventoryGrid.appendChild(wrapper);
        }
    });
}

// Handle pasting a sticker to its designated slot
async function pasteSticker(playerId, slotEl) {
    showLoader();
    try {
        // Find the sticker document inside inventory (Nacaderneta !== true)
        const stickerDoc = userStickers.find(s => s.idplayer === playerId && s.Nacaderneta !== true);
        if (!stickerDoc) {
            alert("Não possuis este cromo no inventário!");
            hideLoader();
            return;
        }

        // Set Nacaderneta = true
        await updateDoc(doc(db, 'caderneta', stickerDoc.id), {
            Nacaderneta: true
        });

        // Local state update
        stickerDoc.Nacaderneta = true;
        logUserAction(`Colou cromo no álbum da Caderneta`);
        
        // Re-render
        renderAlbumPage();
        renderInventory();
        renderContinentStats();
        
        // Colagem effect
        const visualCard = slotEl.querySelector('.cromo-card');
        if (visualCard) {
            visualCard.style.transform = 'scale(0.5)';
            visualCard.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            setTimeout(() => {
                visualCard.style.transform = 'scale(1)';
            }, 50);
        }
    } catch (e) {
        console.error("Erro ao colar cromo:", e);
        alert("Erro ao colar cromo. Tente novamente.");
    }
    hideLoader();
}

// Purchase and roll a pack
async function handlePackPurchase(packType) {
    if (!isShopUnlocked()) {
        alert(`Ainda nao desbloqueaste o mercado de saquetas. Precisas de ${REQUIRED_PREDICTED_GAMES_FOR_SHOP} jogos palpitados na temporada e tens ${userSeasonPredictedGames}.`);
        return;
    }

    const packConfig = getPackConfigForType(packType);
    const price = packConfig?.price;
    const currency = packConfig?.currency || 'gcoins';

    if (!Number.isFinite(price) || price <= 0) {
        alert("Este pack ainda nao tem preco configurado no painel de administracao.");
        return;
    }

    if (eligiblePlayers.length === 0) {
        alert("Nao existem jogadores ativos na Caderneta. Configure primeiro os jogadores em /admin/gerenciar-caderneta-casta.html.");
        return;
    }

    if (currency === 'mini-gcoins' && userMiniGcoins < price) {
        alert("Mini-gcoins insuficientes para comprar esta saqueta!");
        return;
    }

    if (currency !== 'mini-gcoins' && userGcoins < price) {
        alert("GCoins insuficientes para comprar esta saqueta!");
        return;
    }

    showLoader();
    shopModal.classList.remove('active');

    try {
        const drawnPlayers = drawPackPlayers(eligiblePlayers, packType);

        // Fire Transaction
        const batch = writeBatch(db);

        // 1. Deduct the configured balance
        const userRef = doc(db, 'users', currentUser.uid);
        const isMiniGcoinsPurchase = currency === 'mini-gcoins';
        const newBalance = isMiniGcoinsPurchase ? userMiniGcoins - price : userGcoins - price;
        const updatedUserBalanceField = isMiniGcoinsPurchase ? 'whowinsgCoins' : currentGcoinsField;
        batch.update(userRef, {
            [currentSeasonLabel]: {
                ...currentSeasonData,
                [updatedUserBalanceField]: newBalance
            }
        });

        // 2. Create movimento
        const movimentoRef = doc(collection(db, 'movimentos'));
        const rightNow = new Date();
        batch.set(movimentoRef, {
            descricao: isMiniGcoinsPurchase ? "Comprou Saqueta com Mini-gcoins" : "Comprou Saqueta",
            para: currentUser.uid,
            de: null,
            estado: isMiniGcoinsPurchase ? "WhoWins Paid" : "CadernetaPaid",
            movimentoData: rightNow, // Firestore converts JavaScript Date automatically
            taxa: null,
            temporada: currentSeason,
            userId: currentUser.uid,
            tipo: "Caderneta",
            valorreal: -price
        });

        // 3. Create stickers
        drawnPlayers.forEach(draw => {
            const stickerRef = doc(collection(db, 'caderneta'));
            const seasonToSave = currentSeasonLabel || currentSeason;
            batch.set(stickerRef, createStickerPayload(draw, currentUser.uid, serverTimestamp(), seasonToSave));
        });

        // Execute Batch
        await batch.commit();
        logUserAction(`Comprou saqueta (${packType}) na Caderneta`);

        // Update local balance
        if (isMiniGcoinsPurchase) {
            userMiniGcoins = newBalance;
        } else {
            userGcoins = newBalance;
            const topGcoinsVal = document.getElementById('top-user-gcoins-value');
            if (topGcoinsVal) topGcoinsVal.textContent = userGcoins.toLocaleString('pt-PT');
        }

        // Reveal transition modal setup
        setupRevealScreen(packType, drawnPlayers);

    } catch (e) {
        console.error("Erro na compra da saqueta:", e);
        alert("Erro ao comprar a saqueta. Tente novamente.");
    }
    hideLoader();
}

// Reveal cards inside modal one by one
function setupRevealScreen(packType, draws) {
    revealCardsContainer.innerHTML = '';
    btnFinishReveal.classList.add('hidden');
    revealModal.classList.add('active');
    revealModal.classList.remove('reveal-modal-opening', 'reveal-modal-burst', 'reveal-modal-ready');
    if (revealPackSparkles) revealPackSparkles.innerHTML = '';

    const theme = REVEAL_PACK_THEME[packType] || REVEAL_PACK_THEME.normal;
    const bestRarity = getTopRarity(draws);
    const rarityCount = draws.filter((draw) => draw.rarity === bestRarity).length;

    if (revealPackArt) {
        revealPackArt.src = theme.asset;
        revealPackArt.alt = theme.label;
    }

    if (revealKicker) {
        revealKicker.textContent = theme.label;
    }

    if (revealTitle) {
        revealTitle.textContent = bestRarity === 'lendario'
            ? 'Explosao lendaria no pack!'
            : `A tua ${theme.label.toLowerCase()} chegou`;
    }

    if (revealSubtitle) {
        revealSubtitle.textContent = buildRevealSubtitle(bestRarity, rarityCount);
    }

    let revealedCount = 0;

    draws.forEach((draw, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = `reveal-card-wrapper rarity-${draw.rarity}`;
        wrapper.style.setProperty('--reveal-rarity-glow', getRarityGlow(draw.rarity));

        wrapper.innerHTML = `
            <div class="flip-card-inner">
                <div class="flip-card-front">
                    <i class="fas fa-futbol"></i>
                    <span class="reveal-card-front-label">Toque para revelar</span>
                </div>
                <div class="flip-card-back">
                    ${createRevealStickerHTML(draw.player, draw.rarity)}
                </div>
            </div>
        `;

        wrapper.addEventListener('click', () => {
            if (!revealModal.classList.contains('reveal-modal-ready')) return;
            if (!wrapper.classList.contains('revealed')) {
                wrapper.classList.add('revealed');
                triggerRevealCardEffect(wrapper, draw.rarity);
                revealedCount++;
                if (revealedCount === 6) {
                    btnFinishReveal.classList.remove('hidden');
                    if (revealSubtitle) {
                        revealSubtitle.textContent = 'Todos revelados. Guarda agora os cromos no teu inventario.';
                    }
                }
            }
        });

        revealCardsContainer.appendChild(wrapper);

        window.setTimeout(() => {
            wrapper.classList.add('is-visible');
        }, 1100 + (index * 90));
    });

    window.setTimeout(() => {
        revealModal.classList.add('reveal-modal-opening');
    }, 30);

    window.setTimeout(() => {
        revealModal.classList.add('reveal-modal-burst');
        spawnRevealParticles(bestRarity, bestRarity === 'lendario' ? 26 : 18);
    }, 520);

    window.setTimeout(() => {
        revealModal.classList.add('reveal-modal-ready');
    }, 980);

    window.setTimeout(() => {
        revealModal.classList.remove('reveal-modal-burst');
    }, 1700);
}

function getTopRarity(draws) {
    const rarityWeight = { comum: 1, raro: 2, epico: 3, lendario: 4 };

    return draws.reduce((best, draw) => {
        return rarityWeight[draw.rarity] > rarityWeight[best] ? draw.rarity : best;
    }, 'comum');
}

function buildRevealSubtitle(bestRarity, rarityCount) {
    if (bestRarity === 'lendario') {
        return rarityCount > 1
            ? `Sairam ${rarityCount} cromos lendarios. Clica em cada carta e aproveita o momento.`
            : 'Sentiu-se o brilho dourado. Clica em cada carta para revelar a tua abertura.';
    }

    if (bestRarity === 'epico') {
        return 'Ha energia epica neste pack. Clica em cada carta para descobrires os 6 cromos.';
    }

    if (bestRarity === 'raro') {
        return 'Boa abertura. Os cromos entraram com mais brilho desta vez.';
    }

    return 'Clica nos cromos para os revelar um a um.';
}

function getRarityGlow(rarity) {
    const glowByRarity = {
        comum: 'rgba(203, 213, 225, 0.28)',
        raro: 'rgba(110, 188, 255, 0.34)',
        epico: 'rgba(206, 123, 255, 0.4)',
        lendario: 'rgba(255, 196, 102, 0.48)'
    };

    return glowByRarity[rarity] || glowByRarity.comum;
}

function triggerRevealCardEffect(wrapper, rarity) {
    wrapper.classList.remove('fx-raro', 'fx-epico', 'fx-lendario');
    void wrapper.offsetWidth;

    if (rarity === 'raro') {
        wrapper.classList.add('fx-raro');
        spawnRevealParticles('raro', 10);
        return;
    }

    if (rarity === 'epico') {
        wrapper.classList.add('fx-epico');
        spawnRevealParticles('epico', 18);
        return;
    }

    if (rarity === 'lendario') {
        wrapper.classList.add('fx-lendario');
        spawnRevealParticles('lendario', 24);
    }
}

function spawnRevealParticles(rarity, amount = 18) {
    if (!revealPackSparkles) return;

    const palettes = {
        comum: ['rgba(255,255,255,0.92)', 'rgba(203,213,225,0.82)', 'rgba(164,176,190,0.72)'],
        raro: ['rgba(222,244,255,0.95)', 'rgba(110,188,255,0.88)', 'rgba(64,135,255,0.78)'],
        epico: ['rgba(248,225,255,0.96)', 'rgba(206,123,255,0.88)', 'rgba(138,58,221,0.76)'],
        lendario: ['rgba(255,246,214,0.98)', 'rgba(255,196,102,0.9)', 'rgba(255,132,41,0.78)']
    };

    const colors = palettes[rarity] || palettes.comum;

    for (let index = 0; index < amount; index++) {
        const particle = document.createElement('span');
        const angle = (360 / amount) * index + Math.random() * 16;
        const distance = -(90 + Math.random() * 78);
        const size = 5 + Math.random() * 7;
        const color = colors[index % colors.length];

        particle.className = 'reveal-particle';
        particle.style.setProperty('--particle-angle', `${angle}deg`);
        particle.style.setProperty('--particle-distance', `${distance}px`);
        particle.style.setProperty('--particle-color', color);
        particle.style.setProperty('--particle-glow', color);
        particle.style.width = `${size}px`;
        particle.style.height = `${14 + Math.random() * 14}px`;
        particle.style.animationDelay = `${Math.random() * 120}ms`;

        revealPackSparkles.appendChild(particle);
        window.setTimeout(() => particle.remove(), 1100);
    }
}

// Utility Loader Helpers
function showLoader() {
    if (contentContainer) {
        contentContainer.style.display = 'none';
    }
    loadingScreen.style.display = 'flex';
}

function hideLoader() {
    loadingScreen.style.display = 'none';
    if (contentContainer) {
        contentContainer.style.display = 'block';
    }
}
