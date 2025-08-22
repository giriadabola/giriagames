import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Configuração do Firebase (pode ser partilhada por todas as páginas)
const firebaseConfig = {
    apiKey: "AIzaSyD8WcFD7jC55feYYqdY7aJSgxXyXkEjTX0",
    authDomain: "g-games-8a8fc.firebaseapp.com",
    projectId: "g-games-8a8fc",
    storageBucket: "g-games-8a8fc.appspot.com",
    messagingSenderId: "689897349449",
    appId: "1:689897349449:web:536599794579901beb7a98",
    measurementId: "G-GTTPJ6G5MD"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Define as permissões necessárias
const ROLES_PERMITIDAS = ["ruler", "estafeta"];

// O guardião que executa em todas as páginas
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuário logado, verifica o documento no Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && ROLES_PERMITIDAS.includes(userDoc.data().estatuto)) {
            // PERMISSÃO CONCEDIDA: Mostra o conteúdo da página
            document.body.style.display = 'block';
        } else {
            // PERMISSÃO NEGADA: Redireciona
            console.warn("Acesso negado: permissões insuficientes.");
            window.location.replace('/acesso-negado.html');
        }
    } else {
        // NÃO LOGADO: Redireciona
        console.log("Nenhum usuário logado.");
        window.location.replace('/login.html');
    }
});

// Exporta as constantes do Firebase para que as outras páginas possam usá-las se precisarem
export { auth, db };
