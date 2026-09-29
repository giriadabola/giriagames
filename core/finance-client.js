import { app, auth } from './firebase.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';

const functions = getFunctions(app, 'us-central1');
const pending = new Map();

// Uma resposta perdida pode ser repetida sem voltar a cobrar a operação.
export async function callFinance(name, data = {}) {
    const key = `${auth.currentUser?.uid || ''}:${name}:${JSON.stringify(data)}`;
    let operationId = data.operationId || pending.get(key);
    if (!operationId) {
        const storageKey = `finance:${key}`;
        try { operationId = sessionStorage.getItem(storageKey); } catch {}
        operationId ||= crypto.randomUUID();
        pending.set(key, operationId);
        try { sessionStorage.setItem(storageKey, operationId); } catch {}
    }
    try {
        const response = await httpsCallable(functions, name)({...data, operationId});
        pending.delete(key);
        try { sessionStorage.removeItem(`finance:${key}`); } catch {}
        return response.data;
    } catch (error) {
        if (!['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal', 'functions/unknown'].includes(error.code)) {
            pending.delete(key);
            try { sessionStorage.removeItem(`finance:${key}`); } catch {}
        }
        throw error;
    }
}

export function readMiniBalance(user, season) {
    const data = user?.[season] || {};
    return data['mini-gcoins'] ?? ((data.whowinsgCoins ?? 0) + (data.investimentosgCoins ?? 0));
}
