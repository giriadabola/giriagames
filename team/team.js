import { db, auth } from '../core/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initRivalSquadsView } from '../core/rival-squads-view.js';

const loadingScreen = document.getElementById('loading-screen');
const content = document.querySelector('.content');
const rivalViewRoot = document.getElementById('team-rivals-view');
let rivalSquadsView = null;

async function logUserAction(actionDescription) {
    if (!auth.currentUser) {
        return;
    }

    try {
        await addDoc(collection(db, 'eye'), {
            dataacao: serverTimestamp(),
            acao: actionDescription,
            userId: auth.currentUser.uid
        });
    } catch (error) {
        console.error("Erro ao registar a ação na coleção 'eye':", error);
    }
}

async function getUserData(userId) {
    const userDocRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
        return { exists: false };
    }

    const data = docSnap.data();
    return {
        aceite: data.aceite,
        estatuto: data.estatuto,
        exists: true
    };
}

async function getPanelMenuSettings() {
    const panelMenuDocRef = doc(db, 'paineis', 'paineis menu');
    const docSnap = await getDoc(panelMenuDocRef);
    return docSnap.exists() ? docSnap.data() : {};
}

function registerMenuClickLogging() {
    document.addEventListener('click', async (event) => {
        const menuItem = event.target.closest('a.menu-item');
        if (!menuItem || !menuItem.href) {
            return;
        }

        event.preventDefault();
        await logUserAction(`Navegou para: ${menuItem.getAttribute('aria-label') || 'Menu'}`);
        window.location.href = menuItem.href;
    });
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    try {
        await updateDoc(doc(db, 'users', user.uid), {
            ultimoacesso: serverTimestamp()
        });

        const [userData, panelSettings] = await Promise.all([
            getUserData(user.uid),
            getPanelMenuSettings()
        ]);

        if (!userData.exists) {
            window.location.href = '404.html';
            return;
        }

        const isUserAccepted = userData.aceite === "Yes";
        const teamPanelSetting = panelSettings?.team;
        const canAccessTeamPage = teamPanelSetting === 'on' || (teamPanelSetting === 'off' && userData.estatuto === 'ruler');

        if (typeof window.updateMenuVisibility === 'function') {
            window.updateMenuVisibility(panelSettings || {});
        }

        if (!isUserAccepted || !canAccessTeamPage) {
            window.location.href = '404.html';
            return;
        }

        await logUserAction(`Entrou em ${document.title}`);
        rivalSquadsView = await initRivalSquadsView({
            root: rivalViewRoot,
            logUserAction
        });

        registerMenuClickLogging();
    } catch (error) {
        console.error('Erro ao inicializar o Relvado:', error);
    } finally {
        loadingScreen.style.display = 'none';
        content.style.display = 'block';
    }
});
