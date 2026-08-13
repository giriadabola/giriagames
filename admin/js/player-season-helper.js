/**
 * player-season-helper.js
 * Módulo para gestão modular de temporadas de jogadores no GiriaGames.
 */

import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export const ATEMPORAL_FIELDS = [
    'nome',
    'codigoUrl',
    'dataNascimento',
    'imagem',
    'altura',
    'pais',
    'paisId',
    'ativo',
    'ultimaAtualizacao'
];

/**
 * Procura e devolve a lista de temporadas a partir da coleção settings/temporadas no Firestore.
 * Ordenadas da mais recente para a mais antiga (ex: ["2026/2027", "2025/2026"]).
 */
export async function fetchUniqueSeasons(db) {
    const seasonsSet = new Set();

    try {
        // 1. Obter a lista de temporadas diretamente de settings/temporadas
        const settingsDoc = await getDoc(doc(db, 'settings', 'temporadas'));
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            if (Array.isArray(data.temporadas)) {
                data.temporadas.forEach(s => {
                    if (s && typeof s === 'string' && s.trim() !== '') {
                        seasonsSet.add(s.trim());
                    }
                });
            }
        }

        // 2. Fallback: Se settings/temporadas não estiver definido, obtém de jogos
        if (seasonsSet.size === 0) {
            const gamesSnap = await getDocs(collection(db, 'jogos'));
            gamesSnap.forEach(docSnap => {
                const season = docSnap.data()?.temporada;
                if (season && typeof season === 'string' && season.trim() !== '') {
                    seasonsSet.add(season.trim());
                }
            });
        }
    } catch (err) {
        console.warn("Erro ao procurar temporadas na BD:", err);
    }

    // Se nenhuma temporada for encontrada, coloca valores por defeito
    if (seasonsSet.size === 0) {
        seasonsSet.add("2026/2027");
        seasonsSet.add("2025/2026");
    }

    // Ordenar de forma decrescente
    const sortedSeasons = Array.from(seasonsSet).sort().reverse();
    return sortedSeasons;
}

/**
 * Verifica se um documento de jogador já está no formato novo e correto
 * (com chaves de temporada E campos atemporais na raiz).
 */
export function isPlayerMigrated(playerDocData) {
    if (!playerDocData) return false;
    const seasonKeys = Object.keys(playerDocData).filter(key => /^\d{4}\/\d{4}$/.test(key));
    if (seasonKeys.length === 0) return false;

    // Garante que os campos atemporais essenciais (incluindo 'ativo' e 'nome') estão presentes na raiz
    const hasRootAtemporal = playerDocData.nome !== undefined && playerDocData.ativo !== undefined;
    if (!hasRootAtemporal) return false;

    // Garante que nenhuma época contém campos atemporais aninhados
    const hasNestedAtemporal = seasonKeys.some(sKey => {
        const sObj = playerDocData[sKey];
        if (sObj && typeof sObj === 'object') {
            return ATEMPORAL_FIELDS.some(field => sObj[field] !== undefined);
        }
        return false;
    });

    return !hasNestedAtemporal;
}

/**
 * Verifica se um documento de jogador tem dados registados para uma época específica.
 */
export function hasPlayerDataForSeason(playerDocData, targetSeason, defaultSeason = '2025/2026') {
    if (!playerDocData) return false;

    // Se tiver o objeto da temporada diretamente gravado no documento
    if (playerDocData[targetSeason] && typeof playerDocData[targetSeason] === 'object') {
        return true;
    }

    // Se for documento legado (não migrado), considera que pertence apenas à temporada por defeito
    if (!isPlayerMigrated(playerDocData)) {
        return targetSeason === defaultSeason;
    }

    return false;
}

/**
 * Extrai os dados do jogador para uma determinada temporada.
 * Retorna um objeto unificado com os campos atemporais da raiz + os campos sazonais da temporada escolhida.
 */
export function getPlayerSeasonData(playerDocData, targetSeason) {
    if (!playerDocData) return null;

    const seasonKeys = Object.keys(playerDocData).filter(k => /^\d{4}\/\d{4}$/.test(k));
    const isMigratedStructure = seasonKeys.length > 0;

    // Procura a época mais recente existente para usar como herança se a época alvo não existir
    const sortedSeasonKeys = [...seasonKeys].sort().reverse();
    const mostRecentSeasonKey = sortedSeasonKeys.length > 0 ? sortedSeasonKeys[0] : null;
    const fallbackSeasonObj = (mostRecentSeasonKey && playerDocData[mostRecentSeasonKey] && typeof playerDocData[mostRecentSeasonKey] === 'object')
        ? playerDocData[mostRecentSeasonKey]
        : {};

    // Objeto de amostra para campos atemporais (raiz -> época alvo -> época mais recente -> objeto vazio)
    const sampleSeasonObj = (playerDocData[targetSeason] && typeof playerDocData[targetSeason] === 'object')
        ? playerDocData[targetSeason]
        : fallbackSeasonObj;

    const rootAtemporal = {
        nome: playerDocData.nome ?? sampleSeasonObj.nome ?? '',
        codigoUrl: playerDocData.codigoUrl ?? sampleSeasonObj.codigoUrl ?? '',
        imagem: playerDocData.imagem ?? sampleSeasonObj.imagem ?? '',
        dataNascimento: playerDocData.dataNascimento ?? sampleSeasonObj.dataNascimento ?? '',
        altura: playerDocData.altura ?? sampleSeasonObj.altura ?? null,
        pais: playerDocData.pais ?? sampleSeasonObj.pais ?? '',
        paisId: playerDocData.paisId ?? sampleSeasonObj.paisId ?? '',
        ativo: playerDocData.ativo !== undefined ? Boolean(playerDocData.ativo) : (sampleSeasonObj.ativo !== undefined ? Boolean(sampleSeasonObj.ativo) : true),
        ultimaAtualizacao: playerDocData.ultimaAtualizacao ?? sampleSeasonObj.ultimaAtualizacao ?? ''
    };

    let seasonData = {};
    if (playerDocData[targetSeason] && typeof playerDocData[targetSeason] === 'object') {
        const rawTarget = { ...playerDocData[targetSeason] };
        ATEMPORAL_FIELDS.forEach(field => delete rawTarget[field]);
        seasonData = rawTarget;
    } else if (isMigratedStructure) {
        // Estrutura com épocas, mas ainda sem dados criados especificamente para esta época.
        // Usa os dados da época mais recente como fallback para evitar campos vazios ou N/A.
        const fallbackCopy = { ...fallbackSeasonObj };
        ATEMPORAL_FIELDS.forEach(field => delete fallbackCopy[field]);
        delete fallbackCopy.id;

        seasonData = {
            clube: '',
            clubeId: '',
            posicao: '',
            overall: 0,
            casta: 'Jogador Bronze',
            noMercado: false,
            ativo: true,
            preco: null,
            compradopor: '',
            estatisticas: '',
            miniGames: {},
            ...fallbackCopy
        };
    } else {
        // Formato Legado (plano)
        const legacyCopy = { ...playerDocData };
        ATEMPORAL_FIELDS.forEach(field => delete legacyCopy[field]);
        delete legacyCopy.id;
        seasonData = legacyCopy;
    }

    return {
        id: playerDocData.id,
        ...rootAtemporal,
        ...seasonData
    };
}

/**
 * Prepara o payload para atualizar ou criar os dados de um jogador.
 * Separa os campos atemporais na raiz e os campos sazonais sob a chave [season].
 */
export function buildPlayerSeasonUpdatePayload(season, playerData) {
    const { id, ...cleanData } = playerData;
    const now = new Date().toISOString();

    const rootPayload = {};
    const seasonPayload = {};

    Object.keys(cleanData).forEach(key => {
        if (ATEMPORAL_FIELDS.includes(key)) {
            rootPayload[key] = cleanData[key];
        } else {
            seasonPayload[key] = cleanData[key];
        }
    });

    rootPayload.ultimaAtualizacao = now;
    seasonPayload.ultimaAtualizacao = now;

    return {
        ...rootPayload,
        [season]: seasonPayload
    };
}

