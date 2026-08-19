import { db, auth } from '../core/firebase.js';
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
const content = document.querySelector('.content');
const modsContainer = document.getElementById('mods-container');
let currentUserStatus = null;

async function getUserStatus(userId) {
    const userDoc = doc(db, 'users', userId);
    const docSnap = await getDoc(userDoc);
    if (docSnap.exists() && docSnap.data().aceite === "Yes") {
        return docSnap.data().estatuto;
    } else {
        return null;
    }
}

async function loadMods() {
    try {
        const modsCollection = collection(db, 'mods');
        const modsQuery = query(modsCollection, where("ativo", "==", "yes"));
        const modsSnapshot = await getDocs(modsQuery);

        if (modsSnapshot.empty) {
            modsContainer.innerHTML = '<p class="no-mods">Não há mods disponíveis no momento.</p>';
            loadingScreen.style.display = 'none';
            content.style.display = 'block';
            return;
        }

        const modsArray = [];
        modsSnapshot.forEach(modDoc => {
            modsArray.push({
                id: modDoc.id,
                data: modDoc.data()
            });
        });

        modsArray.sort((a, b) => {
            const timestampA = a.data.timestampMod;
            const timestampB = b.data.timestampMod;
            
            if (!timestampA && !timestampB) return 0;
            if (!timestampA) return 1;
            if (!timestampB) return -1;
            
            const isATimestamp = timestampA && typeof timestampA.toDate === 'function';
            const isBTimestamp = timestampB && typeof timestampB.toDate === 'function';
            
            if (isATimestamp && isBTimestamp) {
                return timestampB.toMillis() - timestampA.toMillis();
            }
            
            if (isATimestamp) {
                const dateA = timestampA.toDate();
                const dateB = timestampB instanceof Date ? timestampB : new Date(timestampB);
                return dateB - dateA;
            }
            
            if (isBTimestamp) {
                const dateA = timestampA instanceof Date ? timestampA : new Date(timestampA);
                const dateB = timestampB.toDate();
                return dateB - dateA;
            }
            
            try {
                const dateA = timestampA instanceof Date ? timestampA : new Date(timestampA);
                const dateB = timestampB instanceof Date ? timestampB : new Date(timestampB);
                return dateB - dateA;
            } catch (error) {
                console.log('Error comparing dates:', error);
                return 0;
            }
        });

        modsContainer.innerHTML = '';
        modsArray.forEach(mod => {
            const modId = mod.id;
            const modData = mod.data;
            const modCard = document.createElement('div');
            modCard.className = 'mod-card';

            const castaMod = modData.castaMod;

            if (castaMod === 'Glory') {
                modCard.classList.add('mod-card-gold');
            } else if (castaMod === 'Calamity') {
                modCard.classList.add('mod-card-silver');
            } else if (castaMod === 'Risk') {
                modCard.classList.add('mod-card-red');
            } else if (castaMod === 'Donation') {
                modCard.classList.add('mod-card-blue');
            } else {
                modCard.classList.add('mod-card-blue');
            }

            let imageStyle = '';
            if (modData.imagePosition) {
                const pos = modData.imagePosition;
                imageStyle = `style="object-position: ${pos.x} ${pos.y}; transform: scale(${pos.zoom/100});"`;
            }

            modCard.innerHTML = `
                <div class="mod-image-container">
                    <img src="${modData.imagem || 'https://via.placeholder.com/300x200?text=Sem+Imagem'}"
                        alt="${modData.nomeMod || 'Mod sem nome'}"
                        class="mod-image" ${imageStyle}>
                    ${modData.icon ? `<div class="mod-icon"><img src="${modData.icon}" alt="Ícone"></div>` : ''}
                </div>
                <div class="mod-content">
                    <div class="mod-title">${modData.nomeMod || 'Mod sem nome'}</div>
                    <div class="mod-overall">
                        <span class="overall-label">Overall:</span>
                        <span class="overall-value">${modData.overall || 'N/A'}</span>
                    </div>
                    <div class="mod-points">
                        <span class="points-gain">${modData.possivelVitoria || '0'} pts</span>
                        <span class="points-loss">${modData.possivelDerrota || '0'} pts</span>
                    </div>
                </div>
            `;

            modCard.setAttribute('data-mod-id', modId);
            modsContainer.appendChild(modCard);
        });
    } catch (error) {
        console.error("Erro ao carregar mods:", error);
        modsContainer.innerHTML = '<p class="error">Erro ao carregar os mods. Por favor, tente novamente mais tarde.</p>';
    } finally {
        content.style.display = 'block';
    }
}

async function openModPopup(modId) {
    try {
        const modDocRef = doc(db, 'mods', modId);
        const modDocSnap = await getDoc(modDocRef);

        if (!modDocSnap.exists()) {
            console.error('Mod não encontrado!');
            return;
        }

        const modData = modDocSnap.data();
        const popupOverlay = document.getElementById('mod-popup-overlay');
        const popupContent = popupOverlay.querySelector('.mod-popup-content');
        const castaMod = modData.castaMod;

        const popupImage = document.getElementById('popup-mod-image');
        popupImage.src = modData.imagem || 'https://via.placeholder.com/300x200?text=Sem+Imagem';
        popupImage.alt = modData.nomeMod || 'Mod sem nome';

        if (modData.imagePosition) {
            const pos = modData.imagePosition;
            popupImage.style.objectPosition = `${pos.x} ${pos.y}`;
            popupImage.style.transform = `scale(${pos.zoom/100})`;
        } else {
            popupImage.style.objectPosition = 'center';
            popupImage.style.transform = 'scale(1)';
        }
        document.getElementById('popup-mod-title').textContent = modData.nomeMod || 'Mod sem nome';
        document.getElementById('popup-mod-overall').textContent = modData.overall || 'N/A';
        document.getElementById('popup-mod-description').textContent = modData.descricao || 'Sem descrição disponível.';
        document.getElementById('popup-mod-points-gain').textContent = `${modData.possivelVitoria || '0'} pts`;
        document.getElementById('popup-mod-points-loss').textContent = `${modData.possivelDerrota || '0'} pts`;

        popupContent.className = 'mod-popup-content';
        if (castaMod === 'Glory') {
            popupContent.classList.add('mod-popup-gold');
        } else if (castaMod === 'Calamity') {
            popupContent.classList.add('mod-popup-silver');
        } else if (castaMod === 'Risk') {
            popupContent.classList.add('mod-popup-red');
        } else if (castaMod === 'Donation') {
            popupContent.classList.add('mod-popup-blue');
        } else {
            popupContent.classList.add('mod-popup-blue');
        }

        const popupIcon = document.getElementById('popup-mod-icon');
        const videoIcon = document.getElementById('popup-mod-video-icon');
        const videoSource = videoIcon.querySelector('source');

        videoSource.src = modData.emojiCastaMod || 'URL_TO_DEFAULT_MP4_VIDEO.mp4';
        videoIcon.load();

        popupIcon.setAttribute('data-casta', castaMod || 'Unknown');
        popupIcon.setAttribute('data-explanation', modData.castaExplicacaoMod || 'Sem explicação disponível.');

        popupOverlay.classList.add('active');

    } catch (error) {
        console.error('Erro ao abrir popup do mod:', error);
    }
}

function openFullscreenImage(imageUrl) {
    const fullscreenOverlay = document.getElementById('fullscreen-image-overlay');
    const fullscreenImage = document.getElementById('fullscreen-image');

    fullscreenImage.src = imageUrl;
    fullscreenImage.alt = 'Imagem em tamanho completo';
    fullscreenOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeFullscreenImage() {
    const fullscreenOverlay = document.getElementById('fullscreen-image-overlay');
    fullscreenOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

document.addEventListener('click', async function(event) {
    const clickableElement = event.target.closest('.mod-card, .mod-popup-animated-icon, .video-overlay, #popup-mod-image, .fullscreen-close, .mod-popup-close, a.menu-item');

    if (!clickableElement) return;

    let actionName = '';

    if (clickableElement.matches('.mod-card')) {
        const modTitle = clickableElement.querySelector('.mod-title')?.textContent.trim();
        actionName = `Abriu detalhes do Mod: ${modTitle}`;
    }
    else if (clickableElement.matches('.mod-popup-animated-icon') || clickableElement.matches('.video-overlay')) {
        const modTitle = document.getElementById('popup-mod-title')?.textContent.trim();
        actionName = `Interagiu com o ícone de casta do Mod: ${modTitle}`;
    }
    else if (clickableElement.matches('#popup-mod-image')) {
        const modTitle = document.getElementById('popup-mod-title')?.textContent.trim();
        actionName = `Visualizou a imagem em tela cheia do Mod: ${modTitle}`;
    }
    else if (clickableElement.matches('.fullscreen-close') || clickableElement.matches('.mod-popup-close')) {
        const modTitle = document.getElementById('popup-mod-title')?.textContent.trim();
        actionName = `Fechou o popup do Mod: ${modTitle}`;
    }
    else if (clickableElement.matches('a.menu-item')) {
        actionName = `Navegou para: ${clickableElement.querySelector('.menu-text')?.textContent.trim() || 'Menu'}`;
    }

    if (actionName) {
        const isNavLink = clickableElement.tagName === 'A' && clickableElement.href && clickableElement.target !== '_blank';
        if (isNavLink) {
            event.preventDefault();
            await logUserAction(actionName);
            window.location.href = clickableElement.href;
        } else {
            await logUserAction(actionName);
        }
    }
    
    const modCard = event.target.closest('.mod-card');
    if (modCard) {
        const modId = modCard.getAttribute('data-mod-id');
        modCard.classList.add('opening');
        setTimeout(() => {
            modCard.classList.remove('opening');
            openModPopup(modId);
        }, 400);
    }

    const popupIcon = event.target.closest('.mod-popup-animated-icon');
    const videoOverlay = event.target.closest('.video-overlay');
    if (popupIcon || videoOverlay) {
        const explanationPopup = document.getElementById('casta-explanation-popup');
        const explanationContent = document.getElementById('casta-explanation-content');
        const parentIcon = videoOverlay ? videoOverlay.closest('.mod-popup-animated-icon') : popupIcon;
        const explanationText = parentIcon.getAttribute('data-explanation');
        explanationContent.textContent = explanationText;
        explanationPopup.classList.toggle('active');
        event.stopPropagation();
    }

    if (event.target.id === 'popup-mod-image') {
        const imageUrl = event.target.src;
        openFullscreenImage(imageUrl);
        event.stopPropagation();
    }

    if (event.target.classList.contains('fullscreen-close') || event.target.closest('.fullscreen-close')) {
        closeFullscreenImage();
        event.stopPropagation();
    }

    if (event.target.classList.contains('mod-popup-close') || event.target.closest('.mod-popup-close')) {
        document.getElementById('mod-popup-overlay').classList.remove('active');
        document.getElementById('casta-explanation-popup').classList.remove('active');
    }
});

function checkAndOpenModFromStorage() {
    const openModId = localStorage.getItem('openModId');
    if (openModId) {
        localStorage.removeItem('openModId');
        setTimeout(() => {
            openModPopup(openModId);
        }, 500);
    }
}

function waitForImagesToLoad() {
    return new Promise((resolve) => {
        const images = modsContainer.querySelectorAll('img');
        if (images.length === 0) {
            resolve();
            return;
        }
        
        let loadedImagesCount = 0;
        const totalImages = images.length;
        
        const imageLoaded = () => {
            loadedImagesCount++;
            if (loadedImagesCount === totalImages) {
                resolve();
            }
        };
        
        images.forEach(img => {
            if (img.complete) {
                imageLoaded();
            } else {
                img.addEventListener('load', imageLoaded);
                img.addEventListener('error', imageLoaded);
            }
        });
    });
}

onAuthStateChanged(auth, async (user) => {
    loadingScreen.style.display = 'flex';
    if (user) {
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                ultimoacesso: serverTimestamp()
            });
        } catch (error) {
            console.error("Erro ao atualizar o campo ultimoacesso: ", error);
        }

        currentUserStatus = await getUserStatus(user.uid);
        const paineisMenuDocRef = doc(db, 'paineis', 'paineis menu');
        const paineisMenuSnap = await getDoc(paineisMenuDocRef);
        let paineisMenuData = null;
        if (paineisMenuSnap.exists()) {
            paineisMenuData = paineisMenuSnap.data();
        } else {
            console.log("paineis menu document does not exist");
            loadingScreen.style.display = 'none';
            window.location.href = '404.html';
            return;
        }

        const modsPageEnabled = paineisMenuData && paineisMenuData.mods === "on";
        const isRuler = currentUserStatus === 'ruler';

        if (!modsPageEnabled && !isRuler) {
            loadingScreen.style.display = 'none';
            window.location.href = '404.html';
            return;
        }

        if (currentUserStatus !== null) {
            const hasContentAccess = await checkPageContentAccess('mods', currentUserStatus, db);
            if (!hasContentAccess) {
                loadingScreen.style.display = 'none';
                return;
            }
            await logUserAction(`Entrou em ${document.title}`);
            window.updateMenuVisibility(paineisMenuData);

            content.style.display = 'block';
            await loadMods();
            await waitForImagesToLoad();
            loadingScreen.style.display = 'none';
            checkAndOpenModFromStorage();
        } else {
            loadingScreen.style.display = 'none';
            window.location.href = '404.html';
        }
    } else {
        loadingScreen.style.display = 'none';
        window.location.href = 'index.html';
    }
});
