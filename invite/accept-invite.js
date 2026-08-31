import {auth, app} from "../core/firebase.js";
import {
    isSignInWithEmailLink,
    onAuthStateChanged,
    signInWithEmailLink,
    updatePassword,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {getFunctions, httpsCallable} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const EMAIL_STORAGE_KEY = "gEmpireInviteEmail";
const loadingState = document.getElementById("loading-state");
const formState = document.getElementById("form-state");
const successState = document.getElementById("success-state");
const errorState = document.getElementById("error-state");
const errorDescription = document.getElementById("error-description");
const form = document.getElementById("accept-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirm-password");
const acceptButton = document.getElementById("accept-button");
const formMessage = document.getElementById("form-message");
const query = new URLSearchParams(window.location.search);
const invitationToken = query.get("convite") || "";

function showOnly(element) {
    [loadingState, formState, successState, errorState].forEach((state) => {
        state.hidden = state !== element;
    });
}

function showError(message) {
    errorDescription.textContent = message;
    showOnly(errorState);
}

function waitForInitialAuthState() {
    return new Promise((resolve) => {
        let unsubscribe = null;
        unsubscribe = onAuthStateChanged(auth, (user) => {
            if (unsubscribe) unsubscribe();
            resolve(user);
        });
    });
}

function friendlyError(error) {
    const code = error.code || "";
    if (code.includes("invalid-action-code") || code.includes("expired-action-code")) {
        return "Este link expirou ou já foi utilizado. Pede um novo convite.";
    }
    if (code.includes("invalid-email")) {
        return "O endereço de e-mail não é válido.";
    }
    if (code.includes("deadline-exceeded")) {
        return "Este convite expirou. Pede um novo ao administrador.";
    }
    if (code.includes("permission-denied")) {
        return "O e-mail indicado não corresponde ao e-mail deste convite.";
    }
    if (code.includes("already-exists")) {
        return "Este convite já foi utilizado ou a conta já está concluída.";
    }
    if (code.includes("not-found")) {
        return "Este convite não existe ou deixou de ser válido.";
    }
    if (code.includes("weak-password")) {
        return "Escolhe uma palavra-passe mais forte, com pelo menos 8 caracteres.";
    }
    return "Não foi possível concluir a conta. Confirma os dados e tenta novamente.";
}

async function acceptInvitation(user, password) {
    const functions = getFunctions(app, "us-central1");
    const acceptAccountInvite = httpsCallable(functions, "acceptAccountInvite");
    await updatePassword(user, password);
    await acceptAccountInvite({token: invitationToken});
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
    window.history.replaceState({}, document.title, "/aceitar-convite");
    showOnly(successState);
}

async function initialise() {
    if (!invitationToken) {
        showError("Este endereço não contém o código privado do convite.");
        return;
    }

    const currentUser = await waitForInitialAuthState();
    const isEmailLink = isSignInWithEmailLink(auth, window.location.href);

    if (!isEmailLink && !currentUser) {
        showError("Abre o endereço completo que recebeste. Este link está incompleto ou foi alterado.");
        return;
    }

    const rememberedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY);
    if (currentUser && !isEmailLink) {
        emailInput.value = currentUser.email || "";
        emailInput.readOnly = true;
    } else if (rememberedEmail) {
        emailInput.value = rememberedEmail;
    }

    showOnly(formState);
    emailInput.focus();
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formMessage.textContent = "";

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    if (password.length < 8) {
        formMessage.textContent = "A palavra-passe deve ter pelo menos 8 caracteres.";
        return;
    }
    if (password !== confirmPasswordInput.value) {
        formMessage.textContent = "As duas palavras-passe não são iguais.";
        return;
    }

    acceptButton.disabled = true;
    acceptButton.textContent = "A criar a conta…";

    try {
        let user = auth.currentUser;
        if (isSignInWithEmailLink(auth, window.location.href)) {
            window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
            const credential = await signInWithEmailLink(auth, email, window.location.href);
            user = credential.user;
        }

        if (!user) throw new Error("Sessão de confirmação não encontrada.");
        await acceptInvitation(user, password);
    } catch (error) {
        console.error("Erro ao aceitar o convite:", error);
        formMessage.textContent = friendlyError(error);
        acceptButton.disabled = false;
        acceptButton.textContent = "Confirmar e criar conta";
    }
});

initialise().catch((error) => {
    console.error("Erro ao preparar o convite:", error);
    showError("Não foi possível validar este convite. Atualiza a página e tenta novamente.");
});
