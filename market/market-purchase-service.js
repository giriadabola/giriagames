import { callFinance } from '../core/finance-client.js';

export async function purchaseMarketPlayer(playerId) {
    const normalizedPlayerId = String(playerId || '').trim();
    if (!normalizedPlayerId) {
        throw new Error('Não foi possível identificar o jogador.');
    }

    return callFinance('purchaseMarketPlayer', {
        playerId: normalizedPlayerId
    });
}

export function getMarketPurchaseErrorMessage(error) {
    const message = String(error?.message || '').replace(/^Firebase:\s*/i, '').trim();

    if (message && message !== 'internal') {
        return message;
    }

    return 'Não foi possível concluir a compra. Nenhuma alteração foi gravada.';
}
