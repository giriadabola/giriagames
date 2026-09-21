import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let managerItemsPromise = null;
const competitionCache = new Map();

function normalise(value) {
    return String(value ?? '').trim().toLocaleLowerCase('pt-PT');
}

function valuesMatch(values, candidates) {
    const normalisedValues = (Array.isArray(values) ? values : [])
        .map(normalise)
        .filter(Boolean);
    const normalisedCandidates = candidates.map(normalise).filter(Boolean);
    return normalisedValues.some((value) => normalisedCandidates.includes(value));
}

function isAvailableInMarket(item) {
    return item?.noMercado === true || item?.noMercado === 'sim';
}

function isStadium(item) {
    return normalise(item?.tipo).replace('á', 'a') === 'estadio';
}

async function loadManagerItems(db) {
    if (!managerItemsPromise) {
            managerItemsPromise = getDocs(collection(db, 'managerItens'))
                .then((snapshot) => snapshot.docs
                    .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }))
                .filter((item) => item.nome))
            .catch((error) => {
                managerItemsPromise = null;
                console.warn('Não foi possível carregar os itens gManager:', error);
                return [];
            });
    }
    return managerItemsPromise;
}

async function loadCompetition(db, competitionId) {
    if (!competitionId) return null;
    if (competitionCache.has(competitionId)) return competitionCache.get(competitionId);

    const competitionPromise = getDoc(doc(db, 'competicoes', competitionId))
        .then((snapshot) => snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)
        .catch(() => null);
    competitionCache.set(competitionId, competitionPromise);
    return competitionPromise;
}

/**
 * Encontra os itens gManager compatíveis com a nacionalidade e a liga actual
 * do jogador, usando IDs e nomes para suportar dados antigos.
 */
export async function getManagerSuggestions(db, { playerData, countryName, clubData } = {}) {
    const competitionId = clubData?.competicaoId || playerData?.competicaoId || '';
    const [items, competition] = await Promise.all([
        loadManagerItems(db),
        loadCompetition(db, competitionId)
    ]);

    const countryCandidates = [playerData?.paisId, playerData?.pais, countryName];
    const leagueCandidates = [
        competitionId,
        clubData?.competicao,
        clubData?.liga,
        competition?.id,
        competition?.nome
    ];

    const itemsById = new Map(items.map((item) => [item.id, item]));

    return items
        .filter((item) => item.mecanismosGanho && isAvailableInMarket(item))
        .map((item) => {
            const mechanisms = item.mecanismosGanho || {};
            const countryMatch = valuesMatch(mechanisms.paises, countryCandidates);
            // A opção "encontrar um grande jogador" é uma mecânica futura e
            // não deve, por si só, criar uma sugestão no perfil do jogador.
            const leagueMatch = valuesMatch(mechanisms.ligas, leagueCandidates);

            if (!countryMatch && !leagueMatch) return null;

            const reasons = [];
            if (countryMatch && countryName) reasons.push(`País: ${countryName}`);
            if (leagueMatch && (competition?.nome || clubData?.competicao || clubData?.liga)) {
                reasons.push(`Liga: ${competition?.nome || clubData?.competicao || clubData?.liga}`);
            }

            const attachedItem = item.anexadoItemId ? itemsById.get(item.anexadoItemId) : null;
            const legacyAttachedValue = typeof item.anexadoItem === 'string' ? item.anexadoItem.trim() : '';
            const attachedLabel = attachedItem
                ? `${attachedItem.tipo || 'Item'}: ${attachedItem.nome}`
                : (legacyAttachedValue && !itemsById.has(legacyAttachedValue) ? legacyAttachedValue : '');

            return { ...item, anexadoLabel: attachedLabel, sugestoes: reasons };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (isStadium(a) !== isStadium(b)) return isStadium(a) ? -1 : 1;
            return `${a.tipo || ''} ${a.nome}`.localeCompare(`${b.tipo || ''} ${b.nome}`, 'pt-PT');
        });
}
