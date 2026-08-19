export const CADERNETA_GIFT_OFFERS_COLLECTION = 'cadernetaPackOffers';
export const CADERNETA_FREE_PACK_ROUND_LIMIT = 5;
export const CADERNETA_FREE_PACK_TYPE = 'normal';
export const CADERNETA_GIFT_SOURCE_NAME = 'Sr Alfredo';
export const CADERNETA_GIFT_REDIRECT_PARAM = 'abrirOferta';

export function normalizeSeasonKey(value = '') {
    return String(value).replace(/\//g, '').trim();
}

export function isEligibleFreePackRound(round) {
    const roundNumber = Number(round);
    return Number.isInteger(roundNumber) && roundNumber >= 1 && roundNumber <= CADERNETA_FREE_PACK_ROUND_LIMIT;
}

export function buildCadernetaGiftOfferId({ seasonKey, round, userId }) {
    return `${normalizeSeasonKey(seasonKey)}_${Number(round)}_${userId}_alfredo`;
}

export function buildAlfredoGiftMessage(count) {
    if (count === 1) {
        return 'O Sr Alfredo ofereceu-te uma saqueta';
    }

    return `O Sr Alfredo ofereceu-te ${count} saquetas`;
}
