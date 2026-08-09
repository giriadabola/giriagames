import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Campos que permanecem directamente no documento users/{uid}.
 * Todos os restantes campos de um utilizador pertencem à época activa.
 */
export const PERMANENT_USER_FIELDS = new Set([
    'aceite',
    'ativom',
    'email',
    'estatuto',
    'nomeDeUsuario',
    'nometabela',
    'ultimoacesso',
    'imagem',
    'mailing',
    'notificacoesMercado',
    'permissoes'
]);

export function seasonKey(season) {
    return String(season || '').trim();
}

export function compactSeason(season) {
    return seasonKey(season).replace(/\//g, '');
}

function seasonSortValue(season) {
    const match = seasonKey(season).match(/(\d{4})\s*\/\s*(\d{4})/);
    if (!match) return Number.NEGATIVE_INFINITY;
    return Number(`${match[2]}${match[1]}`);
}

export function sortSeasons(seasons) {
    return [...new Set((seasons || [])
        .filter((season) => typeof season === 'string')
        .map((season) => season.trim())
        .filter(Boolean))]
        .sort((a, b) => {
            const difference = seasonSortValue(b) - seasonSortValue(a);
            return difference || b.localeCompare(a);
        });
}

/**
 * A fonte oficial da época activa é settings/temporadas.temporadas.
 * O fallback existe apenas para não bloquear a aplicação antes da
 * configuração ser preenchida durante a migração.
 */
export async function getLatestSeason(db) {
    const configuredSeasons = await getConfiguredSeasons(db);
    const latestConfiguredSeason = configuredSeasons[0];
    if (latestConfiguredSeason) return latestConfiguredSeason;

    const configSnapshot = await getDoc(doc(db, 'paineis', 'configuracoes_gerais'));
    const configuredSeason = configSnapshot.exists()
        ? configSnapshot.data()?.temporadaAtual
        : '';
    if (configuredSeason) return seasonKey(configuredSeason);

    throw new Error('Não foi possível determinar a época mais recente.');
}

export async function getConfiguredSeasons(db) {
    const seasonsSnapshot = await getDoc(doc(db, 'settings', 'temporadas'));
    return sortSeasons(seasonsSnapshot.exists() ? seasonsSnapshot.data()?.temporadas : []);
}

export function getSeasonData(userData, season) {
    if (!userData) return {};
    const currentSeason = seasonKey(season);
    const nestedData = userData[currentSeason];
    return nestedData && typeof nestedData === 'object' && !Array.isArray(nestedData)
        ? nestedData
        : {};
}

/**
 * Devolve um objecto compatível com o código de apresentação: campos
 * permanentes no topo e campos da época activa misturados por cima.
 * O fallback legado permite que a aplicação continue a ler dados até a
 * página de migração ser executada.
 */
export function mergeUserSeasonData(userData, season) {
    if (!userData) return null;
    const currentSeason = seasonKey(season);
    const nestedData = getSeasonData(userData, currentSeason);
    const legacySeasonData = {};

    Object.entries(userData).forEach(([field, value]) => {
        if (!PERMANENT_USER_FIELDS.has(field)
            && !/^\d{8}(GCoins|Pontos|PontosPossiveis)$/.test(field)
            && !/^\d{4}\/\d{4}$/.test(field)
            && field !== currentSeason) {
            legacySeasonData[field] = value;
        }
    });

    const compactKey = compactSeason(currentSeason);
    if (compactKey) {
        if (userData[`${compactKey}GCoins`] !== undefined) legacySeasonData.GCoins = userData[`${compactKey}GCoins`];
        if (userData[`${compactKey}Pontos`] !== undefined) legacySeasonData.Pontos = userData[`${compactKey}Pontos`];
        if (userData[`${compactKey}PontosPossiveis`] !== undefined) legacySeasonData.PontosPossiveis = userData[`${compactKey}PontosPossiveis`];
    }

    return {
        ...userData,
        ...legacySeasonData,
        ...nestedData
    };
}

export function buildSeasonUpdate(season, fields) {
    const currentSeason = seasonKey(season);
    if (!currentSeason) throw new Error('É necessária uma época para gravar dados do utilizador.');
    return {
        [currentSeason]: {
            ...(fields || {})
        }
    };
}

export function buildMergedSeasonUpdate(userData, season, fields) {
    return buildSeasonUpdate(season, {
        ...getSeasonData(userData, season),
        ...(fields || {})
    });
}

export async function readUserWithSeason(db, userId, season) {
    const userSnapshot = await getDoc(doc(db, 'users', userId));
    return userSnapshot.exists()
        ? mergeUserSeasonData(userSnapshot.data(), season)
        : null;
}

export async function writeUserSeason(db, userId, season, fields, options = { merge: true }) {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, buildSeasonUpdate(season, fields), options);
}
