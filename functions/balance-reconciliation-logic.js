function compactMovementSeason(value) {
    return String(value || "").replace(/\D/g, "");
}

function parseMovementValue(value) {
    const parsed = typeof value === "number" ? value : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function calculateMovementBalance(movements, season) {
    const expectedSeason = compactMovementSeason(season);
    let balance = 0;
    let movementCount = 0;

    (movements || []).forEach((movement) => {
        if (compactMovementSeason(movement?.temporada) !== expectedSeason ||
            movement?.estado === "WhoWins Paid") {
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
