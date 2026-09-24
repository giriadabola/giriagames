const DERIVED_PERCENTAGE_SOURCES = {
    'percentagem de defesas': ['defesas por jogo']
};

function normalizeLabel(value) {
    return String(value || '')
        .toLocaleLowerCase('pt-PT')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function parseNumber(value) {
    if (value === undefined || value === null) return null;

    const match = String(value).match(/[-+]?\d+(?:[.,]\d+)?/);
    if (!match) return null;

    const parsed = Number.parseFloat(match[0].replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
}

function formatPercentage(fraction) {
    const percentage = Number((fraction * 100).toFixed(2));
    return `${percentage}%`;
}

function getStatLines(statsText) {
    return String(statsText || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
}

function findLineIndex(lines, label) {
    const normalizedTarget = normalizeLabel(label);
    return lines.findIndex(line => normalizeLabel(line).startsWith(normalizedTarget));
}

function readValueFromLine(lines, lineIndex, line) {
    const valueOnSameLine = parseNumber(String(line).slice(String(line).search(/[-+]?\d/)));
    if (valueOnSameLine !== null) return valueOnSameLine;

    return parseNumber(lines[lineIndex + 1]);
}

function readExplicitStatistic(lines, statisticName) {
    const normalizedTarget = normalizeLabel(statisticName);
    const lineIndex = lines.findIndex(line => normalizeLabel(line).startsWith(normalizedTarget));
    if (lineIndex === -1) return null;

    const line = lines[lineIndex];
    const value = readValueFromLine(lines, lineIndex, line);
    if (value === null) return null;

    const isPercentage = normalizedTarget.startsWith('percentagem') || normalizedTarget.startsWith('%');
    const normalizedValue = isPercentage && value > 1 ? value / 100 : value;

    return {
        value: normalizedValue,
        display: isPercentage ? formatPercentage(normalizedValue) : String(value),
        found: true
    };
}

function readDerivedPercentage(lines, statisticName) {
    const normalizedTarget = normalizeLabel(statisticName);
    const sourceLabels = DERIVED_PERCENTAGE_SOURCES[normalizedTarget];
    if (!sourceLabels) return null;

    for (const sourceLabel of sourceLabels) {
        const sourceIndex = findLineIndex(lines, sourceLabel);
        if (sourceIndex === -1) continue;

        const sourceText = `${lines[sourceIndex]} ${lines[sourceIndex + 1] || ''}`;
        const percentageMatch = sourceText.match(/\(\s*([-+]?\d+(?:[.,]\d+)?)\s*%\s*\)/);
        if (!percentageMatch) continue;

        const percentage = parseNumber(percentageMatch[1]);
        if (percentage === null) continue;

        return {
            value: percentage / 100,
            display: `${percentage}%`,
            found: true,
            source: sourceLabel
        };
    }

    return null;
}

/**
 * Reads one player statistic from the SofaScore text format.
 *
 * Example:
 *   Defesas por jogo 2.1 (66%)
 *
 * Asking for "Percentagem de defesas" returns 0.66, while asking for
 * "Defesas por jogo" returns 2.1.
 */
export function readPlayerStatistic(statsText, statisticName) {
    const lines = getStatLines(statsText);
    if (!lines.length || !statisticName) {
        return { value: 0, display: '-', found: false };
    }

    const explicitValue = readExplicitStatistic(lines, statisticName);
    if (explicitValue) return explicitValue;

    return readDerivedPercentage(lines, statisticName) || {
        value: 0,
        display: '-',
        found: false
    };
}
