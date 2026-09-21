import {
    FieldPath,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export const ATEMPORAL_FIELDS = [
    'nome', 'codigoUrl', 'dataNascimento', 'imagem', 'altura', 'pais', 'paisId',
    'bio', 'ativo', 'retirado', 'ultimaAtualizacao'
];

export async function fetchUniqueSeasons(db) {
    const seasons = new Set();

    try {
        const settingsSnapshot = await getDoc(doc(db, 'settings', 'temporadas'));
        const configuredSeasons = settingsSnapshot.exists()
            ? settingsSnapshot.data()?.temporadas
            : [];

        if (Array.isArray(configuredSeasons)) {
            configuredSeasons.forEach((season) => {
                if (typeof season === 'string' && season.trim()) seasons.add(season.trim());
            });
        }

        if (seasons.size === 0) {
            const gamesSnapshot = await getDocs(collection(db, 'jogos'));
            gamesSnapshot.forEach((gameDocument) => {
                const season = gameDocument.data()?.temporada;
                if (typeof season === 'string' && season.trim()) seasons.add(season.trim());
            });
        }
    } catch (error) {
        console.warn('Erro ao procurar épocas na base de dados:', error);
    }

    if (seasons.size === 0) {
        seasons.add('2026/2027');
        seasons.add('2025/2026');
    }

    return Array.from(seasons).sort().reverse();
}

export function isPlayerMigrated(playerData) {
    if (!playerData) return false;

    const seasonKeys = Object.keys(playerData).filter((key) => /^\d{4}\/\d{4}$/.test(key));
    if (seasonKeys.length === 0) return false;

    const hasRootAtemporalFields = playerData.nome !== undefined && playerData.ativo !== undefined;
    if (!hasRootAtemporalFields) return false;

    const hasNestedAtemporalFields = seasonKeys.some((season) => {
        const seasonData = playerData[season];
        return seasonData && typeof seasonData === 'object' && ATEMPORAL_FIELDS.some(
            (field) => seasonData[field] !== undefined
        );
    });

    return !hasNestedAtemporalFields;
}

export function hasPlayerDataForSeason(playerData, targetSeason, defaultSeason = '2025/2026') {
    if (!playerData) return false;
    if (playerData[targetSeason] && typeof playerData[targetSeason] === 'object') return true;
    return !isPlayerMigrated(playerData) && targetSeason === defaultSeason;
}

export function getPlayerSeasonData(playerData, targetSeason) {
    if (!playerData) return null;

    const seasonKeys = Object.keys(playerData).filter((key) => /^\d{4}\/\d{4}$/.test(key));
    const rootData = Object.fromEntries(
        Object.entries(playerData).filter(([key]) => key !== 'id' && !/^\d{4}\/\d{4}$/.test(key))
    );
    const usesSeasonStructure = seasonKeys.length > 0;
    const mostRecentSeason = [...seasonKeys].sort().reverse()[0] || null;
    const fallbackSeasonData = mostRecentSeason && playerData[mostRecentSeason] && typeof playerData[mostRecentSeason] === 'object'
        ? playerData[mostRecentSeason]
        : {};
    const sampleSeasonData = playerData[targetSeason] && typeof playerData[targetSeason] === 'object'
        ? playerData[targetSeason]
        : fallbackSeasonData;

    const atemporalData = {
        nome: playerData.nome ?? sampleSeasonData.nome ?? '',
        codigoUrl: playerData.codigoUrl ?? sampleSeasonData.codigoUrl ?? '',
        imagem: playerData.imagem ?? sampleSeasonData.imagem ?? '',
        dataNascimento: playerData.dataNascimento ?? sampleSeasonData.dataNascimento ?? '',
        altura: playerData.altura ?? sampleSeasonData.altura ?? null,
        pais: playerData.pais ?? sampleSeasonData.pais ?? '',
        paisId: playerData.paisId ?? sampleSeasonData.paisId ?? '',
        bio: playerData.bio ?? sampleSeasonData.bio ?? '',
        ativo: playerData.ativo !== undefined
            ? Boolean(playerData.ativo)
            : (sampleSeasonData.ativo !== undefined ? Boolean(sampleSeasonData.ativo) : true),
        retirado: playerData.retirado !== undefined
            ? Boolean(playerData.retirado)
            : (sampleSeasonData.retirado !== undefined ? Boolean(sampleSeasonData.retirado) : false),
        ultimaAtualizacao: playerData.ultimaAtualizacao ?? sampleSeasonData.ultimaAtualizacao ?? ''
    };

    let seasonData = {};
    if (playerData[targetSeason] && typeof playerData[targetSeason] === 'object') {
        seasonData = { ...playerData[targetSeason] };
        ATEMPORAL_FIELDS.forEach((field) => delete seasonData[field]);
        if (seasonData.overall === undefined || seasonData.overall === null) seasonData.overall = 0;
        if (seasonData.noMercado === undefined) {
            seasonData.noMercado = playerData.noMercado !== undefined
                ? Boolean(playerData.noMercado)
                : false;
        }
    } else if (usesSeasonStructure) {
        const fallbackCopy = { ...fallbackSeasonData };
        ATEMPORAL_FIELDS.forEach((field) => delete fallbackCopy[field]);
        delete fallbackCopy.id;
        seasonData = {
            ...fallbackCopy,
            clube: '', clubeId: '', posicao: '', casta: 'Jogador Bronze',
            noMercado: false, ativo: true, preco: null, compradopor: '',
            estatisticas: '', miniGames: {}, overall: 0
        };
    } else {
        seasonData = { ...playerData };
        ATEMPORAL_FIELDS.forEach((field) => delete seasonData[field]);
        delete seasonData.id;
        if (targetSeason !== '2025/2026') seasonData.overall = 0;
    }

    const mergedPlayer = { ...rootData, ...atemporalData, ...seasonData };
    if (playerData.id) mergedPlayer.id = playerData.id;
    return mergedPlayer;
}

export async function fetchOwnedPlayersForSeason(db, userId, season) {
    if (!db || !userId || !season) return [];

    const players = collection(db, 'jogadores');
    const [seasonSnapshot, legacySnapshot] = await Promise.all([
        getDocs(query(players, where(new FieldPath(season, 'compradopor'), '==', userId))),
        getDocs(query(players, where('compradopor', '==', userId)))
    ]);
    const playerDocuments = new Map();

    [...seasonSnapshot.docs, ...legacySnapshot.docs].forEach((playerDocument) => {
        playerDocuments.set(playerDocument.id, playerDocument);
    });

    return Array.from(playerDocuments.values())
        .map((playerDocument) => getPlayerSeasonData({
            ...playerDocument.data(),
            id: playerDocument.id
        }, season))
        .filter((player) => player?.compradopor === userId);
}

export function buildPlayerSeasonUpdatePayload(season, playerData) {
    const playerName = (playerData.nome || '').trim();
    const normalizedName = playerName.toLowerCase();
    if (!playerName || ['sem nome', 'sem_nome', 'sem-nome'].includes(normalizedName)) {
        throw new Error('[BLOQUEIO DE SEGURANÇA] O campo "nome" não pode ficar vazio ou "Sem Nome". Gravação cancelada.');
    }

    const { id, ...cleanData } = playerData;
    const now = new Date().toISOString();
    const rootPayload = {};
    const seasonPayload = {};

    Object.keys(cleanData).forEach((key) => {
        if (ATEMPORAL_FIELDS.includes(key)) rootPayload[key] = cleanData[key];
        else seasonPayload[key] = cleanData[key];
    });

    rootPayload.ultimaAtualizacao = now;
    seasonPayload.ultimaAtualizacao = now;

    return { ...rootPayload, [season]: seasonPayload };
}
