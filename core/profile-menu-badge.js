import { auth, db } from './firebase.js';
import { collection, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

let inboxUnsubscribe = null;

function updateProfileMenuBadge(count) {
    const badge = document.querySelector('[data-menu-key="profile"] .menu-badge');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function isUnreadMessage(data) {
    return data.tipo === 'email' || !data.jogadorId;
}

onAuthStateChanged(auth, (user) => {
    if (inboxUnsubscribe) {
        inboxUnsubscribe();
        inboxUnsubscribe = null;
    }

    updateProfileMenuBadge(0);

    if (!user) return;

    const inboxQuery = query(
        collection(db, 'inbox'),
        where('para', '==', user.uid),
        where('status', '==', true)
    );

    inboxUnsubscribe = onSnapshot(inboxQuery, (snapshot) => {
        const unreadCount = snapshot.docs.reduce((count, inboxDoc) => {
            return count + (isUnreadMessage(inboxDoc.data()) ? 1 : 0);
        }, 0);

        updateProfileMenuBadge(unreadCount);
    }, (error) => {
        console.error('Erro ao actualizar o contador do menu de perfil:', error);
        updateProfileMenuBadge(0);
    });
});
