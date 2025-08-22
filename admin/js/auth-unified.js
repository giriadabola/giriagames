// Importa as funções de inicialização dos SDKs do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Sua configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD8WcFD7jC55feYYqdY7aJSgxXyXkEjTX0",
  authDomain: "g-games-8a8fc.firebaseapp.com",
  projectId: "g-games-8a8fc",
  storageBucket: "g-games-8a8fc.appspot.com",
  messagingSenderId: "689897349449",
  appId: "1:689897349449:web:536599794579901beb7a98",
  measurementId: "G-GTTPJ6G5MD"
};

// Inicializa o aplicativo Firebase
const app = initializeApp(firebaseConfig);

// Inicializa os serviços do Firebase e os armazena em constantes
const auth = getAuth(app);      // Serviço de Autenticação
const db = getFirestore(app);   // Serviço do Firestore (Banco de Dados)


// ===================================================================
// PARTE 2: LÓGICA DO GUARDIÃO (antes estava em auth-guard.js)
// ===================================================================

// Lista de estatutos/funções permitidas para acessar a área de admin
const ROLES_PERMITIDAS = ["ruler", "estafeta"];

/**
 * Função principal que é executada assim que a página carrega.
 * Ela observa o estado de autenticação do usuário.
 */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userRole = userDoc.data().estatuto;

        if (ROLES_PERMITIDAS.includes(userRole)) {
          console.log(`Acesso autorizado para o usuário ${user.email} com estatuto "${userRole}".`);
          document.body.style.display = 'block';
        } else {
          console.warn(`Acesso negado. O usuário ${user.email} tem o estatuto "${userRole}", que não é permitido.`);
          redirectToAccessDenied();
        }
      } else {
        console.error(`Acesso negado. Usuário ${user.email} não possui um documento correspondente.`);
        redirectToAccessDenied();
      }
    } catch (error) {
      console.error("Erro ao verificar as permissões:", error);
      window.location.href = '/erro.html';
    }
  } else {
    console.log("Nenhum usuário logado. Redirecionando para a página de login.");
    window.location.href = '/login.html';
  }
});

/**
 * Função auxiliar para redirecionar o usuário em caso de acesso negado.
 */
function redirectToAccessDenied() {
  window.location.href = '/acesso-negado.html';
}
