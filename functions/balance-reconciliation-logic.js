const {movementCurrency} = require('./finance-logic');

function compactMovementSeason(value) {
    return String(value || "").replace(/\D/g, "");
}

function parseMovementValue(value) {
    if (value === null || value === undefined || (typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function calculateMovementBalance(movements, season) {
    const expectedSeason = compactMovementSeason(season);
    let balance = 0;
    let movementCount = 0;

    (movements || []).forEach((movement) => {
        if (compactMovementSeason(movement?.temporada) !== expectedSeason ||
            movementCurrency(movement) !== 'gcoins') {
            return;
        }

        const value = parseMovementValue(movement?.valorreal);
        if (value === null) {
            return;
        }

        balance += value;
        movementCount += 1;
    });

    return {
        balance,
        movementCount,
    };
}

module.exports = {
    calculateMovementBalance,
    compactMovementSeason,
    parseMovementValue,
};
