const VALID_PREDICTION_STATUSES = new Set(['neutro', 'acerto', 'falha']);

function normalizeComparableValue(value) {
    return String(value || '')
        .normalize('NFC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('pt-PT');
}

function normalizeSeasonValue(season) {
    const value = String(season || '').trim();
    const digits = value.replace(/\D/g, '');
    return digits.length === 8 ? digits : value.toLocaleLowerCase('pt-PT');
}

function getPredictionIndex(statusKey) {
    const match = String(statusKey || '').match(/^palpite(10|[1-9])Status$/);
    return match ? Number(match[1]) : null;
}

function belongsToSameEvent(prediction, sourcePrediction) {
    return String(prediction?.jogoId || '') === String(sourcePrediction?.jogoId || '')
        && String(prediction?.ronda ?? '') === String(sourcePrediction?.ronda ?? '')
        && normalizeSeasonValue(prediction?.temporada) === normalizeSeasonValue(sourcePrediction?.temporada);
}

export function buildEquivalentPredictionStatusUpdates(
    predictions,
    sourcePredictionId,
    sourceStatusKey,
    newStatus
) {
    if (!VALID_PREDICTION_STATUSES.has(newStatus)) {
        return [];
    }

    const sourcePrediction = (predictions || []).find(
        (prediction) => prediction.id === sourcePredictionId
    );
    const sourceIndex = getPredictionIndex(sourceStatusKey);
    const sourceSelection = sourceIndex
        ? normalizeComparableValue(sourcePrediction?.[`palpite${sourceIndex}`])
        : '';

    if (!sourcePrediction
        || !sourceSelection
        || !sourcePrediction.jogoId
        || sourcePrediction.ronda === undefined
        || sourcePrediction.ronda === null
        || !normalizeSeasonValue(sourcePrediction.temporada)) {
        return [];
    }

    return predictions
        .filter((prediction) => belongsToSameEvent(prediction, sourcePrediction))
        .map((prediction) => {
            const fields = {};

            for (let index = 1; index <= 10; index += 1) {
                const predictionValue = normalizeComparableValue(prediction[`palpite${index}`]);
                if (predictionValue && predictionValue === sourceSelection) {
                    fields[`palpite${index}Status`] = newStatus;
                }
            }

            return {
                predictionId: prediction.id,
                fields
            };
        })
        .filter((update) => Object.keys(update.fields).length > 0);
}
