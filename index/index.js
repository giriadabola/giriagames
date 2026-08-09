// index/index.js
import { db, auth } from '../core/firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const authContainer = document.getElementById('auth-container');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const signupSuccessPopup = document.getElementById('signupSuccessPopup');
    const verificationPopup = document.getElementById('verificationPopup');
    
    let tempUser = null;

    document.getElementById('showSignup').addEventListener('click', (e) => { 
        e.preventDefault(); 
        loginForm.style.display = 'none'; 
        signupForm.style.display = 'block'; 
    });
    
    document.getElementById('showLogin').addEventListener('click', (e) => { 
        e.preventDefault(); 
        signupForm.style.display = 'none'; 
        loginForm.style.display = 'block'; 
    });

    function showError(message) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        try { 
            await signInWithEmailAndPassword(auth, email, password); 
        } catch (error) { 
            showError('Email ou senha incorretas.'); 
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        if (password !== confirmPassword) { showError('As senhas não coincidem'); return; }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            tempUser = userCredential.user;
            signupSuccessPopup.style.display = 'flex';
            signupForm.style.display = 'none';
        } catch (error) { 
            showError('Erro ao criar conta: ' + error.message); 
        }
    });

    document.getElementById('popupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const gplayerName = document.getElementById('gplayerName').value;
        if (!gplayerName) { showError('Por favor, preencha o campo Nome de Usuário.'); return; }
        try {
            await setDoc(doc(db, 'users', tempUser.uid), {
                nomeDeUsuario: gplayerName,
                email: tempUser.email,
                estatuto: "gplayer",
                gCoinsGanhos: 0,
                pontos: 0,
                tática: ["4-4-2"], 
                ativo: null,
                aceite: "no"
            });
            signupSuccessPopup.style.display = 'none';
            verificationPopup.style.display = 'flex';
        } catch (error) {
            console.error("Erro detalhado do Firestore:", error);
            showError('Erro ao salvar dados do usuário.');
        }
    });

    document.getElementById('closeVerificationPopup').addEventListener('click', () => {
        signOut(auth);
        verificationPopup.style.display = 'none';
        loginForm.style.display = 'block';
    });

    // ===== PONTO CENTRAL DE CONTROLO DE ESTADO (CORRIGIDO) =====
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                if (userData.aceite === 'Yes') {
                    window.location.href = '1x.html';
                } else {
                    loader.style.display = 'none';
                    authContainer.style.display = 'none';
                    verificationPopup.style.display = 'flex';
                }
            } else {
                // VERIFICA SE O POPUP DE REGISTRO ESTÁ ATIVO.
                const signupPopup = document.getElementById('signupSuccessPopup');
                if (signupPopup.style.display !== 'flex') {
                    // O popup NÃO está visível, então é um estado inválido. Deslogar.
                    signOut(auth);
                }
            }
        } else {
            loader.style.display = 'none';
            authContainer.style.display = 'block';
        }
    });
});
