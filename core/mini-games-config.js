export const CADERNETA_PACK_DEFINITIONS = [
    {
        configKey: 'comum',
        packType: 'normal',
        adminLabel: 'Comum (Saqueta Normal)',
        shopLabel: 'Saqueta Normal'
    },
    {
        configKey: 'raro',
        packType: 'rara',
        adminLabel: 'Raro (Saqueta Rara)',
        shopLabel: 'Saqueta Rara'
    },
    {
        configKey: 'epico',
        packType: 'epica',
        adminLabel: 'Epico (Saqueta Epica)',
        shopLabel: 'Saqueta Epica'
    },
    {
        configKey: 'lendario',
        packType: 'lendaria',
        adminLabel: 'Lendario (Saqueta Lendaria)',
        shopLabel: 'Saqueta Lendaria'
    }
];

export const MINI_GAME_CURRENCY_OPTIONS = [
    { value: 'gcoins', label: 'GCoins' },
    { value: 'mini-gcoins', label: 'Mini-gcoins' }
];

export function normalizeMiniGameCurrency(value) {
    return value === 'mini-gcoins' ? 'mini-gcoins' : 'gcoins';
}

export function getMiniGameCurrencyLabel(value) {
    return normalizeMiniGameCurrency(value) === 'mini-gcoins' ? 'Mini-gcoins' : 'GCoins';
}

export function getCadernetaPackDefinitionByType(packType) {
    return CADERNETA_PACK_DEFINITIONS.find((definition) => definition.packType === packType) || null;
}

export function buildNormalizedCadernetaPackPricing(rawPricing = {}) {
    const normalizedPricing = {};

    CADERNETA_PACK_DEFINITIONS.forEach(({ configKey }) => {
        const source = rawPricing?.[configKey];
        const parsedPrice = Number(source?.price);

        normalizedPricing[configKey] = {
            price: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : null,
            currency: normalizeMiniGameCurrency(source?.currency)
        };
    });

    return normalizedPricing;
}
