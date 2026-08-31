import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { completeAuthLoading, showAuthError, showAuthLoading } from './auth-loading-panel.js';

const firebaseConfig = {
    apiKey: "AIzaSyD8WcFD7jC55feYYqdY7aJSgxXyXkEjTX0",
    authDomain: "g-games-8a8fc.firebaseapp.com",
    projectId: "g-games-8a8fc",
    storageBucket: "g-games-8a8fc.appspot.com",
    messagingSenderId: "689897349449",
    appId: "1:689897349449:web:536599794579901beb7a98",
    measurementId: "G-GTTPJ6G5MD"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEFAULT_ALLOWED_ROLES = ['ruler', 'estafeta'];

function whenBodyExists() {
    if (document.body) return Promise.resolve();
    return new Promise((resolve) => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
}

function getAllowedRoles() {
    const configuredRoles = document.body?.dataset.adminRoles;
    if (!configuredRoles) return DEFAULT_ALLOWED_ROLES;

    return configuredRoles
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean);
}

function showRulerOnlyCards(role) {
    if (role !== 'ruler') return;

    ['eye-card', 'trofeus-card', 'investimentos-card', 'invitations-card'].forEach((cardId) => {
        const card = document.getElementById(cardId);
        if (card) card.style.display = 'flex';
    });
}

let resolveAdminAuth;
const adminAuthReady = new Promise((resolve) => {
    resolveAdminAuth = resolve;
});

onAuthStateChanged(auth, async (user) => {
    await whenBodyExists();

    if (!user) {
        showAuthLoading('Sessão não iniciada. A redirecionar para o login...');
        window.location.replace('/');
        return;
    }

    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            showAuthLoading('Perfil de utilizador não encontrado. Acesso negado...');
            window.location.replace('/acesso-negado.html');
            return;
        }

        const userData = userDoc.data();
        if (!getAllowedRoles().includes(userData.estatuto)) {
            showAuthLoading('A conta não tem permissão para aceder a esta página...');
            window.location.replace('/acesso-negado.html');
            return;
        }

        completeAuthLoading();
        showRulerOnlyCards(userData.estatuto);
        resolveAdminAuth({ user, userData });
        document.dispatchEvent(new CustomEvent('admin-auth-authorized', {
            detail: { user, userData }
        }));
    } catch (error) {
        console.error('Erro ao verificar as permissões administrativas:', error);
        showAuthError('Ocorreu um erro ao verificar a sessão. Atualiza a página e tenta novamente.');
    }
});

export { adminAuthReady, app, auth, db };
