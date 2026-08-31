import {adminAuthReady, app} from "./auth-guard.js";
import {getFunctions, httpsCallable} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const form = document.getElementById("invite-form");
const generateButton = document.getElementById("generate-button");
const formMessage = document.getElementById("form-message");
const emptyResult = document.getElementById("empty-result");
const inviteResult = document.getElementById("invite-result");
const inviteLink = document.getElementById("invite-link");
const copyButton = document.getElementById("copy-button");
const expiryMessage = document.getElementById("expiry-message");

function showMessage(message, type) {
    formMessage.textContent = message;
    formMessage.className = `form-message is-${type}`;
}

function clearMessage() {
    formMessage.textContent = "";
    formMessage.className = "form-message";
}

function friendlyError(error) {
    if (error.code === "functions/already-exists") {
        return "Já existe uma conta completa com este e-mail.";
    }
    if (error.code === "functions/invalid-argument") {
        return error.message || "Revê os dados introduzidos.";
    }
    if (error.code === "functions/permission-denied") {
        return "A tua conta não tem permissão para criar convites.";
    }
    if (error.code === "functions/failed-precondition") {
        return error.message || "O domínio de ligação ainda não está configurado no Firebase.";
    }
    return "Não foi possível criar o convite. Tenta novamente.";
}

async function copyLink() {
    if (!inviteLink.value) return;

    try {
        await navigator.clipboard.writeText(inviteLink.value);
    } catch {
        inviteLink.focus();
        inviteLink.select();
        document.execCommand("copy");
    }

    copyButton.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Link copiado';
    window.setTimeout(() => {
        copyButton.innerHTML = '<i class="far fa-copy" aria-hidden="true"></i> Copiar link';
    }, 2200);
}

async function initialise() {
    await adminAuthReady;

    const functions = getFunctions(app, "us-central1");
    const createAccountInvite = httpsCallable(functions, "createAccountInvite");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage();
        generateButton.disabled = true;
        generateButton.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> A gerar…';

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        payload.expiresInDays = Number(payload.expiresInDays);

        try {
            const response = await createAccountInvite(payload);
            inviteLink.value = response.data.link;
            expiryMessage.textContent = `Válido até ${new Intl.DateTimeFormat("pt-PT", {
                dateStyle: "long",
                timeStyle: "short",
            }).format(new Date(response.data.expiresAt))}.`;
            emptyResult.hidden = true;
            inviteResult.hidden = false;
            showMessage("Convite criado. Já podes copiar e enviar o link.", "success");
        } catch (error) {
            console.error("Erro ao criar o convite:", error);
            showMessage(friendlyError(error), "error");
        } finally {
            generateButton.disabled = false;
            generateButton.innerHTML = '<i class="fas fa-link" aria-hidden="true"></i> Gerar link seguro';
        }
    });

    copyButton.addEventListener("click", copyLink);
}

initialise();
