import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, getDocs, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import { getLatestSeason, mergeUserSeasonData } from '../../core/user-season.js';
import { checkPageContentAccess } from '../../js/page-content-guard.js';

import { 
    logUserAction, 
    getClubArena, 
    getClubCountry, 
    addInvestment, 
    removeInvestment,
    isCloudflareDetected,
    isClubActive
} from './investimentos-service.js';
import { 
    renderMyClubsSection, 
    renderAvailableClubsSection, 
    renderCountryFilterPickcards 
} from './investimentos-ui.js';
import { renderMarketTicker } from './investimentos-ticker.js';
import { openTeamDetailModal } from './investimentos-modal.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

window.logDebug = function(msg) {
    console.log(msg);
};

let myInvestmentsPage = 1;
let availableTeamsPage = 1;
let selectedCountryFilter = 'all';
let currentSeasonLabel = '';

export function hideLoading(force = false) {
    const loading = document.getElementById('loading-screen');
    if (!loading) return;

    if (isCloudflareDetected() && !force) {
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981; margin-right: 6px;"></i> Verificação de segurança concluída! A carregar página...';
        }
        setTimeout(() => {
            loading.style.opacity = '0';
            setTimeout(() => { 
                loading.style.display = 'none';
            }, 500);
        }, 1200);
    } else {
        loading.style.opacity = '0';
        setTimeout(() => { 
            loading.style.display = 'none';
        }, 500);
    }
}

async function loadAndSyncInvestments(userArenaNameArg, userArenaNumArg, userIdArg) {
    let userArenaName = typeof userArenaNameArg === 'string' ? userArenaNameArg : 'Arena 1';
    let userArenaNum = 1;
    let userId = null;

    if (typeof userArenaNumArg === 'number') {
        userArenaNum = userArenaNumArg;
        userId = userIdArg;
    } else if (typeof userArenaNumArg === 'string') {
        if (userArenaNumArg.toLowerCase().includes('arena')) {
            userArenaNum = parseInt(userArenaNumArg.replace(/\D/g, '')) || 1;
            userId = userIdArg;
        } else {
            userId = userArenaNumArg;
            userArenaNum = parseInt(String(userArenaName).replace(/\D/g, '')) || 1;
        }
    } else if (userIdArg) {
        userId = userIdArg;
    }

    const grid = document.getElementById('investments-grid');
    const availableGrid = document.getElementById('available-teams-grid');
    const myPagination = document.getElementById('my-investments-pagination');
    const availablePagination = document.getElementById('available-teams-pagination');

    if (grid) grid.innerHTML = '';
    if (availableGrid) availableGrid.innerHTML = '';
    if (myPagination) myPagination.innerHTML = '';
    if (availablePagination) availablePagination.innerHTML = '';

    try {
        let limitPorPessoa = 5;
        try {
            const settingsSnap = await getDoc(doc(db, 'settings', 'investimentos'));
            if (settingsSnap.exists() && settingsSnap.data().porpessoa !== undefined) {
                limitPorPessoa = parseInt(settingsSnap.data().porpessoa) || 5;
            }
        } catch (se) {
            console.warn("Erro ao obter definições de investimentos:", se);
        }

        let userChosenIds = [];
        let userInvestmentMap = {};
        let userInvestmentDocIdMap = {};
        if (userId) {
            const userSnap = await getDoc(doc(db, 'users', userId));
            if (userSnap.exists() && Array.isArray(userSnap.data().investimentos)) {
                const rawList = userSnap.data().investimentos;
                rawList.forEach(item => {
                    if (typeof item === 'string') {
                        userChosenIds.push(item);
                        userInvestmentMap[item] = 0;
                        userInvestmentDocIdMap[item] = `${userId}_${item}`;
                    } else if (item && typeof item === 'object' && item.clubeId) {
                        userChosenIds.push(item.clubeId);
                        userInvestmentMap[item.clubeId] = item.timestamp || item.data || 0;
                        userInvestmentDocIdMap[item.clubeId] = item.investimentoDocId || `${userId}_${item.clubeId}`;
                    }
                });
            }
        }

        const limitDisplay = document.getElementById('limit-count-display');
        if (limitDisplay) limitDisplay.textContent = `Investimentos: ${userChosenIds.length}/${limitPorPessoa}`;
        const limitBadge = document.getElementById('user-limit-badge');
        if (limitBadge) limitBadge.style.display = 'inline-flex';

        const earningsBadge = document.getElementById('user-earnings-badge');
        if (earningsBadge && userId) {
            try {
                const userDocRef = doc(db, 'users', userId);
                const userDocSnap = await getDoc(userDocRef);
                let totalInvest = 0;
                if (userDocSnap.exists()) {
                    const uData = userDocSnap.data();
                    const sData = (typeof currentSeasonLabel === 'string' && currentSeasonLabel) ? (uData[currentSeasonLabel] || {}) : {};
                    totalInvest = sData.investimentosgCoins !== undefined ? sData.investimentosgCoins : (uData.investimentosgCoins || 0);
                }

                if (totalInvest > 0) {
                    earningsBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                    earningsBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                    earningsBadge.style.color = '#10b981';
                    earningsBadge.innerHTML = `<i class="fas fa-arrow-up"></i> <span>Rendimento: +${totalInvest} ɱ-₲₵</span>`;
                } else if (totalInvest < 0) {
                    earningsBadge.style.background = 'rgba(239, 68, 68, 0.15)';
                    earningsBadge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                    earningsBadge.style.color = '#ef4444';
                    earningsBadge.innerHTML = `<i class="fas fa-arrow-down"></i> <span>Rendimento: ${totalInvest} ɱ-₲₵</span>`;
                } else {
                    earningsBadge.style.background = 'rgba(148, 163, 184, 0.15)';
                    earningsBadge.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                    earningsBadge.style.color = '#94a3b8';
                    earningsBadge.innerHTML = `<i class="fas fa-minus"></i> <span>Rendimento: 0 ɱ-₲₵</span>`;
                }
                earningsBadge.style.display = 'inline-flex';
            } catch (ee) {
                console.warn("Erro ao atualizar badge de rendimento:", ee);
            }
        }

        const [clubsSnap, compSnap, paisesSnap] = await Promise.all([
            getDocs(collection(db, 'clubes')),
            getDocs(collection(db, 'competicoes')),
            getDocs(collection(db, 'paises'))
        ]);

        const compMapById = {};
        const compMapByName = {};
        const compMapByClubId = {};
        const compPaisMap = {};

        const paisesMap = {};
        const paisesByName = {};

        paisesSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            const pObj = {
                id: docSnap.id,
                nome: data.nome || '',
                imagem: data.imagem || ''
            };
            paisesMap[docSnap.id] = pObj;
            if (data.nome) {
                paisesByName[String(data.nome).trim().toLowerCase()] = pObj;
            }
        });

        compSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            const arenaVal = data.arena || null;
            const paisIdVal = data.paisId || null;

            if (paisIdVal) compPaisMap[docSnap.id] = paisIdVal;

            if (arenaVal && String(arenaVal).trim() !== '') {
                compMapById[docSnap.id] = arenaVal;
                if (data.nome) compMapByName[String(data.nome).trim().toLowerCase()] = arenaVal;
                if (Array.isArray(data.clubes)) {
                    data.clubes.forEach(cId => {
                        compMapByClubId[cId] = arenaVal;
                    });
                }
            }
        });

        const allClubs = clubsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(clube => isClubActive(clube));

        allClubs.forEach(clube => {
            const resolvedArena = getClubArena(clube, compMapById, compMapByName, compMapByClubId);
            clube.resolvedArena = resolvedArena;

            const paisObj = getClubCountry(clube, compPaisMap, paisesMap, paisesByName);
            clube.resolvedPaisId = paisObj.id || (clube.pais ? String(clube.pais).trim().toLowerCase() : 'outro');
            clube.resolvedPaisNome = paisObj.nome || clube.pais || 'Outro';
            clube.resolvedPaisImagem = paisObj.imagem || '';

            if (!clube.investimentos || !Array.isArray(clube.investimentos) || clube.investimentos.length === 0) {
                clube.investimentos = [{ arena: resolvedArena, status: true }];
            } else if (resolvedArena && (!clube.investimentos[0].arena || String(clube.investimentos[0].arena).trim() === '')) {
                clube.investimentos[0].arena = resolvedArena;
            }
        });

        const userArenaIndex = typeof userArenaNum === 'number' && userArenaNum > 0 
            ? userArenaNum 
            : (parseInt(String(userArenaName).replace(/\D/g, '')) || 1);

        const handleAddFromTicker = async (clubeId) => {
            const ok = await addInvestment(db, userId, clubeId, limitPorPessoa, userChosenIds);
            if (ok) {
                await loadAndSyncInvestments(userArenaName, userArenaNum, userId);
            }
        };

        const handleOpenModal = (clube) => {
            openTeamDetailModal(
                clube, 
                userArenaIndex, 
                userId, 
                limitPorPessoa, 
                userChosenIds, 
                userArenaName,
                async (cId) => {
                    const ok = await addInvestment(db, userId, cId, limitPorPessoa, userChosenIds);
                    if (ok) {
                        await loadAndSyncInvestments(userArenaName, userArenaNum, userId);
                    }
                }
            );
        };

        await renderMarketTicker(db, allClubs, userArenaName, userArenaIndex, userChosenIds, userId, limitPorPessoa, handleOpenModal, handleAddFromTicker);

        const myClubs = allClubs.filter(c => userChosenIds.includes(c.id));

        let startArenaNum = 1;
        try {
            const arenaDocSnap = await getDoc(doc(db, 'paineis', 'paineis arena'));
            if (arenaDocSnap.exists()) {
                const arenaData = arenaDocSnap.data();
                Object.keys(arenaData).forEach(key => {
                    if (arenaData[key] && arenaData[key].start === true) {
                        const num = parseInt(String(key).replace(/\D/g, '')) || 1;
                        if (num > 0) startArenaNum = num;
                    }
                });
            }
        } catch(e) {
            console.warn("Erro ao ler start arena em paineis arena:", e);
        }

        const availableClubs = allClubs.filter(clube => {
            if (userChosenIds.includes(clube.id)) return false;

            const clubArenaStr = clube.resolvedArena || (clube.investimentos && clube.investimentos[0] && clube.investimentos[0].arena);
            if (clubArenaStr === null || clubArenaStr === undefined || String(clubArenaStr).trim() === '') return false;

            const clubArenaNum = parseInt(String(clubArenaStr).replace(/\D/g, ''));
            if (isNaN(clubArenaNum) || clubArenaNum <= 0) return false;

            return clubArenaNum >= startArenaNum && clubArenaNum <= userArenaIndex;
        });

        await renderMyClubsSection(
            db, 
            myClubs, 
            grid, 
            myPagination, 
            userInvestmentMap, 
            userInvestmentDocIdMap, 
            userId, 
            limitPorPessoa, 
            myInvestmentsPage, 
            (newPage) => {
                myInvestmentsPage = newPage;
                loadAndSyncInvestments(userArenaName, userArenaNum, userId);
                if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            },
            handleOpenModal,
            async (clubeId) => {
                const ok = await removeInvestment(db, userId, clubeId, userInvestmentDocIdMap);
                if (ok) {
                    await loadAndSyncInvestments(userArenaName, userArenaNum, userId);
                }
            }
        );

        const countryFilterContainer = document.getElementById('country-filter-container');

        const updateFilteredAvailableClubs = async (selectedPaisId) => {
            selectedCountryFilter = selectedPaisId;
            availableTeamsPage = 1;

            const filteredClubs = selectedPaisId === 'all'
                ? availableClubs
                : availableClubs.filter(c => c.resolvedPaisId === selectedPaisId);

            renderCountryFilterPickcards(availableClubs, countryFilterContainer, selectedCountryFilter, (newPaisId) => {
                updateFilteredAvailableClubs(newPaisId);
            });

            await renderAvailableClubsSection(
                filteredClubs, 
                availableGrid, 
                availablePagination, 
                userArenaIndex, 
                userId, 
                limitPorPessoa, 
                userChosenIds, 
                userArenaName,
                availableTeamsPage,
                (newPage) => {
                    availableTeamsPage = newPage;
                    updateFilteredAvailableClubs(selectedCountryFilter);
                    if (availableGrid) availableGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
                },
                handleOpenModal,
                handleAddFromTicker
            );
        };

        await updateFilteredAvailableClubs('all');

    } catch (error) {
        console.error("Erro ao carregar dados de investimentos:", error);
        if (grid) {
            grid.innerHTML = `
                <div class="no-investments" style="border: 1px solid rgba(239, 68, 68, 0.2);">
                    <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
                    <p>Ocorreu um erro ao carregar os investimentos. Por favor, tenta novamente.</p>
                </div>
            `;
        }
    } finally {
        hideLoading();
    }
}

// Configurar escuta do estado de autenticação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDocSnap = await getDoc(doc(db, 'users', user.uid));
            if (!userDocSnap.exists()) {
                window.location.replace('index.html');
                return;
            }
            
            currentSeasonLabel = await getLatestSeason(db);
            const userData = mergeUserSeasonData(userDocSnap.data(), currentSeasonLabel);

            const hasContentAccess = await checkPageContentAccess('investimentos', userData.estatuto, db);
            if (!hasContentAccess) {
                const loadingScreen = document.getElementById('loading-screen');
                if (loadingScreen) loadingScreen.style.display = 'none';
                return;
            }
            
            await logUserAction(db, auth, `Entrou em ${document.title}`);
            
            const paineisMenuDoc = await getDoc(doc(db, 'paineis', 'paineis menu'));
            if (paineisMenuDoc.exists()) {
                const menuData = paineisMenuDoc.data();
                const applyMenu = () => {
                    if (typeof window.updateMenuVisibility === 'function') {
                        window.updateMenuVisibility(menuData);
                    } else {
                        setTimeout(applyMenu, 50);
                    }
                };
                applyMenu();
            }
            
            const userArenaField = userData.arena || '';
            let userArenaNum = parseInt(userArenaField.replace(/\D/g, '')) || 0;
            let userArenaName = userArenaField || '';
            let startArenaNum = 1;
            
            const arenaDocSnap = await getDoc(doc(db, 'paineis', 'paineis arena'));
            if (arenaDocSnap.exists()) {
                const arenaData = arenaDocSnap.data();

                Object.keys(arenaData).forEach(key => {
                    if (arenaData[key] && arenaData[key].start === true) {
                        const num = parseInt(String(key).replace(/\D/g, '')) || 1;
                        if (num > 0) startArenaNum = num;
                    }
                });

                const arenas = Object.keys(arenaData).map(key => ({
                    name: key, fama: arenaData[key].fama
                })).sort((a, b) => a.fama - b.fama);
                
                const userFame = userData.fame || 0;
                let currentUserArena = arenas[0];
                for (let i = arenas.length - 1; i >= 0; i--) {
                    if (userFame >= arenas[i].fama) {
                        currentUserArena = arenas[i];
                        break;
                    }
                }
                
                const calculatedArenaNum = parseInt(currentUserArena.name.replace(/\D/g, '')) || 1;
                if (calculatedArenaNum > userArenaNum) {
                    userArenaNum = calculatedArenaNum;
                    userArenaName = currentUserArena.name;
                }
            }

            if (!userArenaName) {
                userArenaName = `Arena ${userArenaNum || 1}`;
            }

            const isRuler = String(userData.estatuto || '').trim().toLowerCase() === 'ruler';
            if (userArenaNum < startArenaNum && !isRuler) {
                window.location.replace('404.html');
                return;
            }

            const arenaDisplay = document.getElementById('arena-name-display');
            if (arenaDisplay) arenaDisplay.textContent = userArenaName;
            const arenaBadge = document.getElementById('user-arena-badge');
            if (arenaBadge) arenaBadge.style.display = 'inline-flex';

            const loadingText = document.getElementById('loading-text');
            if (loadingText) loadingText.textContent = "A analisar a forma recente e estatísticas das equipas...";
            await loadAndSyncInvestments(userArenaName, userArenaNum, user.uid);

        } catch (err) {
            console.error("Erro ao validar acesso do utilizador:", err);
            const grid = document.getElementById('investments-grid');
            if (grid) {
                grid.innerHTML = `
                    <div class="no-investments" style="border: 1px solid rgba(239, 68, 68, 0.2);">
                        <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
                        <p>Erro ao carregar dados: ${err.message || 'Falha na autenticação'}</p>
                    </div>
                `;
            }
            hideLoading();
        }
    } else {
        window.location.replace('index.html');
    }
});

// Configurar Event Listeners globais das Abas Principais
document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.target;
        if (!targetId) return;

        document.querySelectorAll('.main-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'rgba(30, 41, 59, 0.6)';
            b.style.borderColor = 'rgba(255, 255, 255, 0.06)';
            b.style.color = '#94a3b8';
            b.style.fontWeight = '600';
        });

        e.currentTarget.classList.add('active');
        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
        e.currentTarget.style.color = '#60a5fa';
        e.currentTarget.style.fontWeight = '700';

        document.querySelectorAll('.main-tab-content').forEach(content => {
            content.style.display = 'none';
        });

        const activeContent = document.getElementById(targetId);
        if (activeContent) activeContent.style.display = 'block';
    });
});

// Listener para botão de limpar a cache de jogos no Firestore
document.getElementById('btn-clear-cache')?.addEventListener('click', async () => {
    if (confirm("Tens a certeza que queres limpar a cache de jogos no Firestore? Isto irá apagar os jogos locais guardados no Firebase e forçar o novo scraper corrigido a rodar de imediato.")) {
        window.logDebug("A iniciar limpeza de cache de jogos no Firestore...");
        try {
            const querySnapshot = await getDocs(collection(db, 'clubes'));
            let count = 0;
            for (const clubDoc of querySnapshot.docs) {
                const jogosSnapshot = await getDocs(collection(db, 'clubes', clubDoc.id, 'Jogos'));
                for (const jogoDoc of jogosSnapshot.docs) {
                    await deleteDoc(doc(db, 'clubes', clubDoc.id, 'Jogos', jogoDoc.id));
                    count++;
                }
            }
            window.logDebug(`Limpeza concluída! ${count} jogos eliminados. A recarregar página para re-scraping...`);
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            window.logDebug("Erro ao limpar cache: " + e.message);
        }
    }
});
