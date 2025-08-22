// Ficheiro: js/auth-guard.js (VERSÃO CORRIGIDA)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyD8WcFD7jC55feYYqdY7aJSgxXyXkEjTX0",
    authDomain: "g-games-8a8fc.firebaseapp.com",
    projectId: "g-games-8a8fc",
    storageBucket: "g-games-8a8fc.appspot.com",
    messagingSenderId: "689897349449",
    appId: "1:689897349449:web:536599794579901beb7a98",
    measurementId: "G-GTTPJ6G5MD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ROLES_PERMITIDAS = ["ruler", "estafeta"];

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && ROLES_PERMITIDAS.includes(userDoc.data().estatuto)) {
            // CORREÇÃO APLICADA AQUI:
            // Restaura o display para 'flex' para manter o layout original.
            document.body.style.display = 'flex';
        } else {
            window.location.replace('/acesso-negado.html');
        }
    } else {
        window.location.replace('/login.html');
    }
});

export { auth, db };
