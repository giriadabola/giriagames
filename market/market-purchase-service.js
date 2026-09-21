import { app } from '../core/firebase.js';
import {
    getFunctions,
    httpsCallable
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';

const functions = getFunctions(app, 'us-central1');
const purchasePlayerCallable = httpsCallable(functions, 'purchaseMarketPlayer');

export async function purchaseMarketPlayer(playerId) {
    const normalizedPlayerId = String(playerId || '').trim();
    if (!normalizedPlayerId) {
        throw new Error('Não foi possível identificar o jogador.');
    }

    const response = await purchasePlayerCallable({
        playerId: normalizedPlayerId
    });

    return response.data;
}

export function getMarketPurchaseErrorMessage(error) {
    const message = String(error?.message || '').replace(/^Firebase:\s*/i, '').trim();

    if (message && message !== 'internal') {
        return message;
    }

    return 'Não foi possível concluir a compra. Nenhuma alteração foi gravada.';
}
