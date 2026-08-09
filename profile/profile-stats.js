function getPredictionStatuses(predictionDoc) {
    let total = 0;
    let hits = 0;
    let misses = 0;

    for (let index = 1; index <= 10; index += 1) {
        const value = predictionDoc[`palpite${index}`];
        if (!value) {
            continue;
        }

        total += 1;

        const status = predictionDoc[`palpite${index}Status`] || 'neutro';
        if (status === 'acerto') {
            hits += 1;
        } else if (status === 'falha') {
            misses += 1;
        }
    }

    return { total, hits, misses };
}

export function getLatestSeasonFromDocs(predictionDocs) {
    const seasons = predictionDocs
        .map((doc) => doc.temporada)
        .filter(Boolean)
        .sort((left, right) => right.localeCompare(left, 'pt'));

    return seasons[0] || null;
}

export function buildUserPredictionStats(predictionDocs, preferredSeason = null) {
    const currentSeason = preferredSeason || getLatestSeasonFromDocs(predictionDocs);
    const seasonDocs = currentSeason
        ? predictionDocs.filter((doc) => doc.temporada === currentSeason)
        : predictionDocs;

    let totalPredictions = 0;
    let totalHits = 0;
    let totalMisses = 0;

    seasonDocs.forEach((predictionDoc) => {
        const { total, hits, misses } = getPredictionStatuses(predictionDoc);
        totalPredictions += total;
        totalHits += hits;
        totalMisses += misses;
    });

    const totalGames = seasonDocs.length;
    const decidedPredictions = totalHits + totalMisses;
    const hitRate = decidedPredictions > 0
        ? Math.round((totalHits / decidedPredictions) * 100)
        : 0;

    return {
        currentSeason,
        totalGames,
        totalPredictions,
        totalHits,
        totalMisses,
        hitRate,
        totalSeasons: new Set(predictionDocs.map((doc) => doc.temporada).filter(Boolean)).size
    };
}

export function renderUserStats(container, stats) {
    if (!container) {
        return;
    }

    const seasonLabel = stats.currentSeason || 'Sem temporada';

    container.innerHTML = `
        <div class="profile-stat-card">
            <span class="profile-stat-label">Jogos na temporada</span>
            <strong class="profile-stat-value">${stats.totalGames}</strong>
            <span class="profile-stat-foot">${seasonLabel}</span>
        </div>
        <div class="profile-stat-card">
            <span class="profile-stat-label">Palpites registados</span>
            <strong class="profile-stat-value">${stats.totalPredictions}</strong>
            <span class="profile-stat-foot">Selecoes feitas</span>
        </div>
        <div class="profile-stat-card">
            <span class="profile-stat-label">Acertos</span>
            <strong class="profile-stat-value">${stats.totalHits}</strong>
            <span class="profile-stat-foot">Falhas: ${stats.totalMisses}</span>
        </div>
        <div class="profile-stat-card">
            <span class="profile-stat-label">Taxa de acerto</span>
            <strong class="profile-stat-value">${stats.hitRate}%</strong>
            <span class="profile-stat-foot">Temporadas: ${stats.totalSeasons}</span>
        </div>
    `;
}
