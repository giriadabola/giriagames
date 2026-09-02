export const VALID_CADERNETA_RARITIES = new Set(['comum', 'raro', 'epico', 'lendario']);

export const PACK_ODDS_BY_TYPE = {
    normal: { comum: 70, raro: 20, epico: 8, lendario: 2 },
    rara: { comum: 40, raro: 40, epico: 15, lendario: 5 },
    epica: { comum: 15, raro: 35, epico: 40, lendario: 10 },
    lendaria: { comum: 5, raro: 15, epico: 40, lendario: 40 }
};

export function buildPlayersByRarity(players) {
    return {
        comum: players.filter((player) => (player.miniGames?.caderneta?.casta || 'comum') === 'comum'),
        raro: players.filter((player) => player.miniGames?.caderneta?.casta === 'raro'),
        epico: players.filter((player) => player.miniGames?.caderneta?.casta === 'epico'),
        lendario: players.filter((player) => player.miniGames?.caderneta?.casta === 'lendario')
    };
}

export function pickWeightedAvailableRarity(odds, availableRarities) {
    const entries = availableRarities.map((rarity) => ({
        rarity,
        weight: odds[rarity] || 0
    })).filter((entry) => entry.weight > 0);

    if (entries.length === 0) {
        return availableRarities[0];
    }

    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) {
            return entry.rarity;
        }
    }

    return entries[entries.length - 1].rarity;
}

export function drawPackPlayers(eligiblePlayers, packType, cardsPerPack = 6) {
    const odds = PACK_ODDS_BY_TYPE[packType] || PACK_ODDS_BY_TYPE.normal;
    const playersByRarity = buildPlayersByRarity(eligiblePlayers);
    const availableRarities = Object.keys(playersByRarity).filter((rarity) => playersByRarity[rarity].length > 0);

    if (availableRarities.length === 0) {
        throw new Error('Nao existem jogadores validos configurados na Caderneta.');
    }

    const drawnPlayers = [];

    for (let i = 0; i < cardsPerPack; i++) {
        const chosenRarity = pickWeightedAvailableRarity(odds, availableRarities);
        const candidates = playersByRarity[chosenRarity];
        const luckyPlayer = candidates[Math.floor(Math.random() * candidates.length)];

        drawnPlayers.push({
            player: luckyPlayer,
            rarity: chosenRarity
        });
    }

    return drawnPlayers;
}

export function createStickerPayload(draw, userId, timestampValue, seasonValue = '') {
    return {
        userId,
        idplayer: draw.player.id,
        clube: draw.player.clube || '',
        casta: draw.rarity,
        estado: true,
        timestamp: timestampValue,
        historico: null,
        Nacaderneta: false,
        emTroca: false,
        tradeProposalId: null,
        temporada: seasonValue || ''
    };
}
