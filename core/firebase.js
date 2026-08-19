// core/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const config = window.firebaseConfig || (typeof firebaseConfig !== 'undefined' ? firebaseConfig : null);

if (!config) {
    console.error("Firebase config not found! Make sure config.js is loaded before importing firebase.js");
}

const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
