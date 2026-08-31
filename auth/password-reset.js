import {auth} from "../core/firebase.js";
import {sendPasswordResetEmail} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const form = document.getElementById("password-reset-form");
const emailInput = document.getElementById("email");
const sendButton = document.getElementById("send-button");
const formMessage = document.getElementById("form-message");
const formState = document.getElementById("reset-form-state");
const successState = document.getElementById("success-state");

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formMessage.textContent = "";

    const email = emailInput.value.trim().toLowerCase();
    if (!email) return;

    sendButton.disabled = true;
    sendButton.textContent = "A enviar…";

    try {
        auth.languageCode = "pt-PT";
        await sendPasswordResetEmail(auth, email, {
            url: "https://giriagames.win/",
            handleCodeInApp: false,
        });
    } catch (error) {
        // A mensagem final é intencionalmente genérica para não revelar
        // se um endereço está ou não registado no Firebase Authentication.
        console.warn("Pedido de recuperação de palavra-passe:", error.code);
    }

    formState.hidden = true;
    successState.hidden = false;
});
