import { db, auth } from '../core/firebase.js';
import { collection, getDocs, doc, getDoc, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// --- Elementos do DOM ---
const loadingScreen = document.getElementById('loading-screen');
const content = document.getElementById('main-content');
const pack = document.getElementById('pack');
const cardReveal = document.getElementById('cardReveal');
const flashOverlay = document.getElementById('flashOverlay');
const dynamicCard = document.getElementById('dynamicCard');
const cardBackgroundImage = document.getElementById('cardBackgroundImage');
const cardMainImage = document.getElementById('cardMainImage');
const cardLevel = document.getElementById('cardLevel');
const cardName = document.getElementById('cardName');
const cardDescription = document.getElementById('cardDescription');
const cardStats = document.getElementById('cardStats');

// --- Funções Auxiliares ---
function preloadImages(containerElement) {
     if (!containerElement) return Promise.resolve();
     const images = containerElement.querySelectorAll('img');
     const promises = [];
     let bgImageUrl = null;
     if (containerElement.style.backgroundImage && containerElement.style.backgroundImage !== 'none') {
         const urlMatch = containerElement.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
         if (urlMatch && urlMatch[1]) bgImageUrl = urlMatch[1];
     }

     if (bgImageUrl) {
          console.log(`[preloadImages] Encontrado background para pré-carregar: ${bgImageUrl}`);
         const bgPromise = new Promise((resolve) => {
             const img = new Image();
             img.onload = () => { console.log(` -> Background ${bgImageUrl} pré-carregado.`); resolve(); };
             img.onerror = () => { console.error(` -> Erro pré-carregar background: ${bgImageUrl}`); resolve(); };
             img.src = bgImageUrl;
         });
         promises.push(bgPromise);
     }

     if (images.length > 0) {
         images.forEach(img => {
             if (!img.src || img.src.includes('placeholder.png') || img.src.startsWith('data:')) return;
             const promise = new Promise((resolve) => {
                 if (img.complete) { resolve(); }
                 else {
                     img.onload = () => { resolve(); };
                     img.onerror = () => { console.error(` -> Erro carregar imagem: ${img.src}`); resolve(); };
                     img.src = img.src;
                 }
             });
             promises.push(promise);
         });
     }
     if (promises.length === 0) { return Promise.resolve(); }
     console.log(`[preloadImages] Tentando pré-carregar ${promises.length} recursos...`);
     return Promise.all(promises);
}

async function getUserData(userId) {
    if (!db || !userId) {
        console.error("DB ou User ID inválido para getUserData.");
        return null;
    }
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            return userDoc.data();
        } else {
            console.warn(`Nenhum documento encontrado para o utilizador: ${userId}`);
            return null;
        }
    } catch (error) {
        console.error('Erro ao buscar dados do utilizador:', error);
        return null;
    }
}

async function fetchActiveRules() {
    console.log("[fetchActiveRules] Iniciando busca por regras ativas...");
    if (!db) { console.error("[fetchActiveRules] Erro: Firestore DB não inicializado."); throw new Error("Firestore DB not initialized."); }
    const collectionName = 'mitosgameRegras'; const fieldName = 'ativo'; const targetValue = true;
    console.log(`[fetchActiveRules] Coleção: '${collectionName}', Campo: '${fieldName}', Valor: ${targetValue}`);
    const regrasRef = collection(db, collectionName); const q = query(regrasRef, where(fieldName, '==', targetValue));
    try {
        console.log("[fetchActiveRules] Executando a query...");
        const snapshot = await getDocs(q);
        console.log(`[fetchActiveRules] Query executada. Tamanho: ${snapshot.size}, Vazio: ${snapshot.empty}`);
        if (snapshot.empty) { console.warn("[fetchActiveRules] Nenhuma regra ativa encontrada."); return []; }
        const rules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[fetchActiveRules] Retornando regras ativas:", rules);
        return rules;
    } catch (error) { console.error("[fetchActiveRules] Erro:", error); throw error; }
}

async function fetchCompetitionNames(competitionIds) {
    if (!db) throw new Error("Firestore DB not initialized.");
    const uniqueIds = [...new Set(competitionIds.filter(id => id))];
    if (uniqueIds.length === 0) { return new Map(); }
    console.log("[fetchCompetitionNames] Buscando nomes para IDs:", uniqueIds);
    const nameMap = new Map(); const promises = [];
    const competitionCollectionName = 'competicoes';
    uniqueIds.forEach(id => {
        const docRef = doc(db, competitionCollectionName, id);
        promises.push( getDoc(docRef).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data(); const name = data.nome;
                if (name) { nameMap.set(id, name); } else { console.warn(`[fetchCompNames] Comp ID ${id} sem campo 'nome'.`); }
            } else { console.warn(`[fetchCompNames] Comp ID ${id} não encontrado.`); }
        }).catch(error => { console.error(`[fetchCompNames] Erro buscar ID ${id}:`, error); }) );
    });
    await Promise.all(promises);
    console.log("[fetchCompetitionNames] Mapeamento ID->Nome:", nameMap);
    return nameMap;
}

async function fetchAndSelectItem(activeRules) {
    console.log("[fetchAndSelectItem] Iniciando...");
    if (!db) throw new Error("DB not initialized."); if (!activeRules || activeRules.length === 0) return null;
    const validPatamares = [...new Set(activeRules.map(rule => rule.patamar).filter(p => p))];
    const validCompeticaoNames = [...new Set(activeRules.map(rule => rule.competicao).filter(c => c))];
    console.log("[fetchAndSelectItem] Patamares Válidos:", validPatamares); console.log("[fetchAndSelectItem] Nomes Competição Válidos:", validCompeticaoNames);
    if (validPatamares.length === 0 || validCompeticaoNames.length === 0) { console.warn("[fetchAndSelectItem] Faltam patamares ou nomes de competições."); return null; }
    const itensRef = collection(db, 'mitosgameItens'); let q = query(itensRef, where('ativo', '==', true)); let filteringPatamarServerSide = false;
    if (validPatamares.length <= 30) { q = query(itensRef, where('ativo', '==', true), where('patamar', 'in', validPatamares)); filteringPatamarServerSide = true; console.log("[fetchAndSelectItem] Query: ativo E patamar IN", validPatamares); }
    else { console.log("[fetchAndSelectItem] Query: apenas ativo"); }
    try {
        const snapshot = await getDocs(q); console.log(`[fetchAndSelectItem] Snapshot Query Inicial: ${snapshot.size} itens`); if (snapshot.empty) return null;
        let potentialItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); console.log(`[fetchAndSelectItem] Itens após query: ${potentialItems.length}`);
        if (!filteringPatamarServerSide) { const c = potentialItems.length; potentialItems = potentialItems.filter(item => validPatamares.includes(item.patamar)); console.log(`[fetchAndSelectItem] Filtro Patamar (cliente): ${c} -> ${potentialItems.length}`); if (potentialItems.length === 0) return null; }
        const allItemCompIds = new Set(); potentialItems.forEach(item => { [item.competicao1Id, item.competicao2Id, item.competicao3Id, item.competicao4Id].filter(id => id).forEach(id => allItemCompIds.add(id)); });
        console.log(`[fetchAndSelectItem] Coletados ${allItemCompIds.size} CompIDs únicos.`);
        const competitionIdToNameMap = await fetchCompetitionNames(Array.from(allItemCompIds));
        const cBeforeCompFilter = potentialItems.length; console.log("[fetchAndSelectItem] Iniciando filtro competição por NOME...");
        const matchingItems = potentialItems.filter(item => {
            const itemCompIds = [item.competicao1Id, item.competicao2Id, item.competicao3Id, item.competicao4Id].filter(id => id);
            const itemCompNames = itemCompIds.map(id => competitionIdToNameMap.get(id)).filter(name => name);
            const match = itemCompNames.some(itemCompName => validCompeticaoNames.includes(itemCompName));
            console.log(` -> Filtro Nome Comp: Item ${item.id} (Pat: ${item.patamar}) IDs[${itemCompIds.join(',')}] -> Nomes[${itemCompNames.join(',')}] vs Regra[${validCompeticaoNames.join(',')}]. Match? ${match}`);
            return match;
        });
        console.log(`[fetchAndSelectItem] Filtro Comp Nome (cliente): ${cBeforeCompFilter} -> ${matchingItems.length}`);
        if (matchingItems.length === 0) { console.warn("[fetchAndSelectItem] Nenhum item sobreviveu filtro nome competição."); return null; }
        const randomIndex = Math.floor(Math.random() * matchingItems.length); const selectedItem = matchingItems[randomIndex];
        console.log(`[fetchAndSelectItem] Selecionado: ID ${selectedItem.id}, Nome: ${selectedItem.nome || '(sem nome)'}`);
        return selectedItem;
    } catch (error) { console.error("[fetchAndSelectItem] Erro:", error); throw error; }
}

async function fetchFamiliaData(familiaId) {
    console.log(`[fetchFamiliaData] Iniciando busca para familiaId: ${familiaId}`);
    if (!db) { console.error("[fetchFamiliaData] Erro: DB não inicializado."); throw new Error("Firestore DB not initialized."); }
    if (!familiaId) {
        console.warn("[fetchFamiliaData] ID da família não fornecido (null ou undefined).");
        return null;
    }

    const familiaCollectionName = 'mitosgameItens';
    const imagemFieldName = 'imagem';

    console.log(`[fetchFamiliaData] Procurando na coleção '${familiaCollectionName}' pelo documento com ID '${familiaId}'`);
    try {
        const familiaRef = doc(db, familiaCollectionName, familiaId);
        const docSnap = await getDoc(familiaRef);

        if (docSnap.exists()) {
            console.log(`[fetchFamiliaData] Documento (supostamente da família) ${familiaId} encontrado dentro de '${familiaCollectionName}'.`);
            const familiaData = docSnap.data();
            console.log("[fetchFamiliaData] Dados completos:", JSON.stringify(familiaData));
            const imageUrl = familiaData[imagemFieldName];
            console.log(`[fetchFamiliaData] Valor do campo '${imagemFieldName}':`, imageUrl);

            if (!imageUrl) {
                 console.warn(`[fetchFamiliaData] Campo '${imagemFieldName}' está vazio ou não existe no documento ${familiaId} em '${familiaCollectionName}'.`);
            }
            return { id: docSnap.id, ...familiaData };
        } else {
            console.warn(`[fetchFamiliaData] Documento com ID ${familiaId} NÃO encontrado na coleção '${familiaCollectionName}'.`);
            return null;
        }
    } catch (error) {
         console.error(`[fetchFamiliaData] Erro ao buscar ID ${familiaId} em '${familiaCollectionName}':`, error);
         return null;
    }
}

async function fetchClubImagesFromCompetitions(itemData) {
    console.log("[fetchClubImagesFromCompetitions] Iniciando busca de imagens de clubes...");
    if (!db || !itemData) {
        console.error("[fetchClubImagesFromCompetitions] DB não inicializado ou itemData inválido.");
        return [];
    }
    
    const nivel = itemData.nivel || 'Nivel 1';
    console.log(`[fetchClubImagesFromCompetitions] Nível do mito: ${nivel}`);
    
    const placeholderImage = 'https://lh3.googleusercontent.com/pw/AP1GczPiqT86eHKMxOqxzkXTF1sOZkH3NuWtELu04zT0ANLpdA9MHuPdguJHyYoRgSKSbiM0el-8UZ8qZuEQbWT8heJR2GPglnZdJRfnVqjdFUItX2deOQVy9RPgqTa02vXF36nUz2iM3oDD7EjuI0HOwps1=w880-h880-s-no-gm?authuser=1';
    
    let competicao3Id = null;
    let competicao4Id = null;
    
    if (nivel === 'Nivel 2' || nivel === 'Nivel 3') {
        competicao3Id = itemData.competicao3Id;
    }
    
    if (nivel === 'Nivel 3') {
        competicao4Id = itemData.competicao4Id;
    }
    
    const competitionIds = [
        itemData.competicao1Id,
        itemData.competicao2Id,
        competicao3Id,
        competicao4Id
    ].filter(id => id);
    
    console.log(`[fetchClubImagesFromCompetitions] IDs de competições encontrados: ${competitionIds.join(', ')}`);
    
    if (competitionIds.length === 0) {
        console.warn("[fetchClubImagesFromCompetitions] Nenhum ID de competição encontrado no item.");
        return [];
    }
    
    const clubImages = [];
    const usedClubIds = new Set();
    
    async function checkClubInMarket(clubId) {
        try {
            console.log(`[checkClubInMarket] Verificando se clube ${clubId} está no mercado...`);
            const mercadoRef = collection(db, 'mitosgameMercado');
            const q1 = query(mercadoRef, where('competicao1Id', '==', clubId));
            const q2 = query(mercadoRef, where('competicao2Id', '==', clubId));
            const q3 = query(mercadoRef, where('competicao3Id', '==', clubId));
            const q4 = query(mercadoRef, where('competicao4Id', '==', clubId));
            
            const [snap1, snap2, snap3, snap4] = await Promise.all([
                getDocs(q1),
                getDocs(q2),
                getDocs(q3),
                getDocs(q4)
            ]);
            
            const isInMarket = !snap1.empty || !snap2.empty || !snap3.empty || !snap4.empty;
            console.log(`[checkClubInMarket] Clube ${clubId} ${isInMarket ? 'está' : 'não está'} no mercado.`);
            return isInMarket;
        } catch (error) {
            console.error(`[checkClubInMarket] Erro ao verificar clube ${clubId} no mercado:`, error);
            return false;
        }
    }
    
    for (const competitionId of competitionIds) {
        try {
            const competitionDoc = await getDoc(doc(db, 'competicoes', competitionId));
            
            if (!competitionDoc.exists()) {
                console.warn(`[fetchClubImagesFromCompetitions] Competição ${competitionId} não encontrada.`);
                continue;
            }
            
            const competitionData = competitionDoc.data();
            console.log(`[fetchClubImagesFromCompetitions] Competição ${competitionId} (${competitionData.nome}) encontrada.`);
            
            if (!competitionData.clubes || !Array.isArray(competitionData.clubes) || competitionData.clubes.length === 0) {
                console.warn(`[fetchClubImagesFromCompetitions] Competição ${competitionId} não tem clubes associados.`);
                continue;
            }
            
            const availableClubs = competitionData.clubes.filter(clubId => !usedClubIds.has(clubId));
            
            if (availableClubs.length === 0) {
                console.warn(`[fetchClubImagesFromCompetitions] Todos os clubes da competição ${competitionId} já foram usados.`);
                continue;
            }
            
            let selectedClubId = null;
            let clubData = null;
            
            const shuffledClubs = [...availableClubs].sort(() => Math.random() - 0.5);
            
            for (const clubId of shuffledClubs) {
                const isInMarket = await checkClubInMarket(clubId);
                
                if (isInMarket) {
                    console.log(`[fetchClubImagesFromCompetitions] Clube ${clubId} já está no mercado, tentando outro...`);
                    continue;
                }
                
                const clubDoc = await getDoc(doc(db, 'clubes', clubId));
                
                if (!clubDoc.exists()) {
                    console.warn(`[fetchClubImagesFromCompetitions] Clube ${clubId} não encontrado.`);
                    continue;
                }
                
                clubData = clubDoc.data();
                
                if (clubData.imagem) {
                    selectedClubId = clubId;
                    usedClubIds.add(selectedClubId);
                    break;
                } else {
                    console.warn(`[fetchClubImagesFromCompetitions] Clube ${clubId} (${clubData.nome}) não tem imagem.`);
                }
            }
            
            if (selectedClubId && clubData && clubData.imagem) {
                console.log(`[fetchClubImagesFromCompetitions] Imagem do clube ${selectedClubId} (${clubData.nome}): ${clubData.imagem}`);
                clubImages.push({
                    id: selectedClubId,
                    name: clubData.nome,
                    image: clubData.imagem,
                    competitionId: competitionId,
                    competitionName: competitionData.nome
                });
            } else {
                console.warn(`[fetchClubImagesFromCompetitions] Não foi possível encontrar um clube válido para a competição ${competitionId}.`);
            }
            
        } catch (error) {
            console.error(`[fetchClubImagesFromCompetitions] Erro ao buscar dados da competição ${competitionId}:`, error);
        }
    }
    
    console.log(`[fetchClubImagesFromCompetitions] Total de imagens de clubes encontradas: ${clubImages.length}`);
    return clubImages;
}

async function updateCardElements(itemData, familiaData) {
    console.log("[updateCardElements] Iniciando atualização dos elementos do card.");
    if (!dynamicCard || !cardMainImage || !cardBackgroundImage || !cardName || !cardDescription || !cardLevel || !cardStats) {
        console.error("[updateCardElements] Elementos essenciais do card não encontrados na DOM!");
        return;
    }

    console.log("[updateCardElements] Dados do Item recebidos:", JSON.stringify(itemData));
    console.log("[updateCardElements] Dados da Família recebidos:", JSON.stringify(familiaData));

    dynamicCard.className = 'clash-card'; cardBackgroundImage.className = 'clash-card__image'; cardStats.className = 'clash-card__unit-stats clearfix'; cardLevel.className = 'clash-card__level'; cardBackgroundImage.style.backgroundImage = 'none'; cardBackgroundImage.style.backgroundColor = 'transparent'; cardStats.style.background = '';

    cardMainImage.src = itemData?.imagem || 'placeholder.png'; cardMainImage.alt = itemData?.nome || 'Item Mítico';
    console.log(`[updateCardElements] Imagem principal definida para: ${cardMainImage.src}`);

    const imagemFieldName = 'imagem';
    const backgroundImageUrl = familiaData?.[imagemFieldName];
    console.log(`[updateCardElements] URL da imagem de fundo extraída de familiaData.${imagemFieldName}: ${backgroundImageUrl}`);

    if (backgroundImageUrl) {
        cardBackgroundImage.style.backgroundImage = `url('${backgroundImageUrl}')`;
        console.log(`[updateCardElements] Definindo background-image para: url('${backgroundImageUrl}')`);
    } else {
        cardBackgroundImage.style.backgroundColor = '#333';
        console.log("[updateCardElements] Nenhuma URL de imagem de fundo encontrada ou válida. Aplicando cor de fallback.");
    }

    cardName.textContent = itemData?.nome || 'Desconhecido'; cardDescription.textContent = itemData?.descricao || 'Sem detalhes.'; cardLevel.textContent = familiaData?.nome || itemData?.patamar || 'N/A';

    let lvlColor = '#CCCCCC'; let statsGrad = 'linear-gradient(to bottom, #555, #222)';
    const famCor = familiaData?.cor; const pat = itemData?.patamar?.toLowerCase();
    if (famCor) { lvlColor = famCor; statsGrad = `linear-gradient(to bottom, ${familiaData.corClara || famCor}, ${familiaData.corEscura || '#222'})`; }
    else if (pat) { switch (pat) {
         case 'lendário': lvlColor = '#FFD700'; statsGrad = 'linear-gradient(to bottom, #FFEC8B, #B8860B)'; break;
         case 'divino': lvlColor = '#ADD8E6'; statsGrad = 'linear-gradient(to bottom, #E0FFFF, #4682B4)'; break;
         case 'comum': lvlColor = '#A9A9A9'; statsGrad = 'linear-gradient(to bottom, #D3D3D3, #696969)'; break;
         case 'patamar 1': lvlColor = '#B8860B'; statsGrad = 'linear-gradient(to bottom, #FFD700, #A0522D)'; break;
    } }
    cardLevel.style.color = lvlColor; cardStats.style.background = statsGrad;
    
    try {
        const clubImages = await fetchClubImagesFromCompetitions(itemData);
        console.log("[updateCardElements] Imagens de clubes obtidas:", clubImages);
        
        const statIcons = cardStats.querySelectorAll('.one-quarter img');
        const placeholderImage = 'https://lh3.googleusercontent.com/pw/AP1GczPiqT86eHKMxOqxzkXTF1sOZkH3NuWtELu04zT0ANLpdA9MHuPdguJHyYoRgSKSbiM0el-8UZ8qZuEQbWT8heJR2GPglnZdJRfnVqjdFUItX2deOQVy9RPgqTa02vXF36nUz2iM3oDD7EjuI0HOwps1=w880-h880-s-no-gm?authuser=1';
        const nivel = itemData.nivel || 'Nivel 1';
        console.log(`[updateCardElements] Nível do mito para exibição de imagens: ${nivel}`);
        
        for (let i = 0; i < statIcons.length; i++) {
            if (i === 2) {
                if (nivel === 'Nivel 2' || nivel === 'Nivel 3') {
                    if (i < clubImages.length && clubImages[i] && clubImages[i].image) {
                        statIcons[i].src = clubImages[i].image;
                        statIcons[i].alt = clubImages[i].name;
                        console.log(`[updateCardElements] Ícone ${i+1} atualizado com imagem do clube ${clubImages[i].name}`);
                    }
                } else {
                    statIcons[i].src = placeholderImage;
                    statIcons[i].alt = 'Bloqueado';
                    console.log(`[updateCardElements] Ícone ${i+1} bloqueado (nível insuficiente)`);
                }
            } else if (i === 3) {
                if (nivel === 'Nivel 3') {
                    if (i < clubImages.length && clubImages[i] && clubImages[i].image) {
                        statIcons[i].src = clubImages[i].image;
                        statIcons[i].alt = clubImages[i].name;
                        console.log(`[updateCardElements] Ícone ${i+1} atualizado com imagem do clube ${clubImages[i].name}`);
                    }
                } else {
                    statIcons[i].src = placeholderImage;
                    statIcons[i].alt = 'Bloqueado';
                    console.log(`[updateCardElements] Ícone ${i+1} bloqueado (nível insuficiente)`);
                }
            } else {
                if (i < clubImages.length && clubImages[i] && clubImages[i].image) {
                    statIcons[i].src = clubImages[i].image;
                    statIcons[i].alt = clubImages[i].name;
                    console.log(`[updateCardElements] Ícone ${i+1} atualizado com imagem do clube ${clubImages[i].name}`);
                }
            }
        }
    } catch (error) {
        console.error("[updateCardElements] Erro ao buscar imagens de clubes:", error);
    }
    
    console.log("[updateCardElements] Elementos atualizados para:", itemData?.nome || 'Item Desconhecido');
}

async function prepareDynamicCard() {
    console.log("[prepareDynamicCard] Iniciando...");
    if (!cardReveal) { console.error("[prepareDynamicCard] Erro: #cardReveal não encontrado."); return false; }
    if (cardMainImage) cardMainImage.src = ''; if (cardBackgroundImage) cardBackgroundImage.style.backgroundImage = 'none'; if (cardName) cardName.textContent = 'A Abrir...'; if(cardDescription) cardDescription.textContent = ''; if(cardLevel) cardLevel.textContent = '';
    try {
        console.log("[prepareDynamicCard] Passo 1: Buscando Regras...");
        const activeRules = await fetchActiveRules();
        console.log(`[prepareDynamicCard] Regras encontradas: ${activeRules ? activeRules.length : 'null'}`);
        if (!activeRules || activeRules.length === 0) { console.error("[prepareDynamicCard] Falha: Nenhuma regra ativa."); return false; }

        console.log("[prepareDynamicCard] Passo 2: Selecionando Item...");
        const selectedItem = await fetchAndSelectItem(activeRules);
        console.log(`[prepareDynamicCard] Item selecionado retornado: ${selectedItem ? selectedItem.id : 'null'}`);
        if (!selectedItem) { console.error("[prepareDynamicCard] Falha: Nenhum item selecionado."); return false; }

        const familiaIdParaBuscar = selectedItem.familiaId;
        console.log(`[prepareDynamicCard] Passo 3: Buscando Família com ID: ${familiaIdParaBuscar}...`);
        const familiaData = await fetchFamiliaData(familiaIdParaBuscar);
        console.log(`[prepareDynamicCard] Resultado da busca da Família (fetchFamiliaData retornou):`, familiaData ? `ID ${familiaData.id}`: 'null');

        console.log("[prepareDynamicCard] Passo 4: Atualizando Elementos...");
        await updateCardElements(selectedItem, familiaData);

        console.log("[prepareDynamicCard] Passo 5: Pré-carregando Imagens...");
        await preloadImages(cardBackgroundImage);
        await preloadImages(cardReveal);
        console.log("[prepareDynamicCard] Preparação concluída com sucesso.");
        return true;
    } catch (error) { console.error("[prepareDynamicCard] Erro GERAL:", error); return false; }
}

async function animatePackReveal() {
    if (!pack || !cardReveal || !flashOverlay) { return; } if (pack.classList.contains('animating')) return; pack.classList.add('animating'); pack.style.pointerEvents = 'none';
    cardReveal.classList.remove('visible'); cardReveal.style.opacity = '0'; cardReveal.style.display = 'none'; flashOverlay.classList.remove('active'); void flashOverlay.offsetWidth; pack.classList.remove('separar', 'sumir-pack'); pack.style.opacity = '1'; const packTop = pack.querySelector('.pack-top'); const packBottom = pack.querySelector('.pack-bottom'); if(packTop) packTop.style.display = 'flex'; if(packBottom) packBottom.style.display = 'flex';
    console.log("[animatePackReveal] Iniciando preparação do card...");
    const cardPrepared = await prepareDynamicCard();
    if (!cardPrepared) { console.error("[animatePackReveal] Preparação falhou. Abortando animação."); pack.classList.remove('animating'); pack.style.pointerEvents = 'auto'; if(cardName) cardName.textContent = "Erro ao Abrir"; return; }
    console.log("[animatePackReveal] Preparação concluída. Iniciando animação do pack...");
    pack.classList.add('separar'); flashOverlay.classList.add('active');
    setTimeout(() => {
        console.log("[animatePackReveal] Animação do pack concluída (timeout). Escondendo pack e revelando card...");
        pack.classList.add('sumir-pack'); cardReveal.style.display = 'block'; cardReveal.style.opacity = '0';
        requestAnimationFrame(() => { cardReveal.style.opacity = ''; cardReveal.classList.add('visible'); });
        setTimeout(() => { pack.classList.remove('animating'); pack.style.pointerEvents = 'auto'; console.log("[animatePackReveal] Animação de revelação concluída (timeout final). Pack reativado.");}, 1500);
    }, 600);
}

function initializeAppLogic() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Utilizador autenticado:", user.uid);
            const userData = await getUserData(user.uid);

            if (!userData) {
                console.log("Acesso negado. Dados do utilizador não encontrados no Firestore.");
                window.location.href = '404.html';
                return;
            }

            const isRuler = userData.estatuto === 'ruler';
            const hasPermission = userData.permissoes?.myths === 'yes';

            if (isRuler || hasPermission) {
                console.log(`Acesso concedido. Motivo: ${isRuler ? 'É um ruler' : 'Possui a permissão myths'}.`);
                
                const paineisMenuRef = doc(db, 'paineis', 'paineis menu');
                const paineisMenuDoc = await getDoc(paineisMenuRef);
                if (paineisMenuDoc.exists()) {
                    window.updateMenuVisibility(paineisMenuDoc.data());
                }

                if (loadingScreen) loadingScreen.classList.add('hidden');
                if (content) content.classList.add('visible');

            } else {
                console.log("Acesso negado. Permissões insuficientes.");
                window.location.href = '404.html';
                return;
            }

        } else {
            console.log("Utilizador deslogado. Redirecionando...");
            if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
                window.location.href = 'index.html';
            } else {
                if (loadingScreen) loadingScreen.classList.add('hidden');
            }
        }
    });

    if (pack) {
        pack.addEventListener('click', animatePackReveal);
    } else {
        console.warn("Elemento #pack não encontrado.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeAppLogic();
});
