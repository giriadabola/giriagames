function getSeasonDigits(season) {
    const digits = String(season || '').replace(/\D/g, '');
    return digits.length === 8 ? digits : '';
}

export function normalizeProfileSeason(season) {
    const value = String(season || '').trim();
    const digits = getSeasonDigits(value);

    if (!digits) {
        return value;
    }

    return `${digits.slice(0, 4)}/${digits.slice(4)}`;
}

export function isSameProfileSeason(left, right) {
    const leftValue = normalizeProfileSeason(left);
    const rightValue = normalizeProfileSeason(right);
    return Boolean(leftValue && rightValue && leftValue === rightValue);
}

export function getUniquePredictionSeasons(predictionDocs) {
    return [...new Set((predictionDocs || [])
        .map((prediction) => normalizeProfileSeason(prediction?.temporada))
        .filter(Boolean))]
        .sort((left, right) => right.localeCompare(left, 'pt'));
}

export function resolveInitialProfileSeason(seasons, configuredSeason) {
    const matchingSeason = (seasons || []).find((season) => (
        isSameProfileSeason(season, configuredSeason)
    ));

    return matchingSeason || seasons?.[0] || '';
}

export function populateProfileSeasonSelect(selectElement, seasons, selectedSeason) {
    if (!selectElement) {
        return;
    }

    selectElement.innerHTML = '';

    if (!seasons?.length) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Sem temporadas';
        selectElement.appendChild(emptyOption);
        selectElement.disabled = true;
        return;
    }

    seasons.forEach((season) => {
        const option = document.createElement('option');
        option.value = season;
        option.textContent = season;
        selectElement.appendChild(option);
    });

    selectElement.disabled = false;
    selectElement.value = resolveInitialProfileSeason(seasons, selectedSeason);
}
