/**
 * player-season-helper.js
 * Módulo para gestão modular de temporadas de jogadores no GiriaGames.
 */

import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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
 * Verifica se um documento de jogador já está no formato novo (com chaves de temporada).
 */
export function isPlayerMigrated(playerDocData) {
    if (!playerDocData) return false;
    // Se existir pelo menos uma chave no formato "YYYY/YYYY" no topo do objeto
    return Object.keys(playerDocData).some(key => /^\d{4}\/\d{4}$/.test(key));
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
 * Caso o documento ainda esteja no formato legado (plano), devolve o próprio objeto legado se for a temporada por defeito.
 */
export function getPlayerSeasonData(playerDocData, targetSeason) {
    if (!playerDocData) return null;

    // Se já estiver migrado e tiver a temporada pretendida
    if (playerDocData[targetSeason] && typeof playerDocData[targetSeason] === 'object') {
        return {
            ...playerDocData[targetSeason],
            id: playerDocData.id
        };
    }

    // Se já estiver migrado mas NÃO tiver a temporada pretendida
    if (isPlayerMigrated(playerDocData)) {
        // Tenta buscar o nome/codigoUrl base se existirem em alguma outra temporada para pré-preenchimento
        const otherSeasonKey = Object.keys(playerDocData).find(k => /^\d{4}\/\d{4}$/.test(k));
        const sampleData = otherSeasonKey ? playerDocData[otherSeasonKey] : {};
        return {
            nome: sampleData.nome || 'Sem Nome',
            codigoUrl: sampleData.codigoUrl || '',
            imagem: sampleData.imagem || '',
            pais: sampleData.pais || '',
            paisId: sampleData.paisId || '',
            clube: sampleData.clube || '',
            clubeId: sampleData.clubeId || '',
            posicao: sampleData.posicao || '',
            dataNascimento: sampleData.dataNascimento || '',
            altura: sampleData.altura || null,
            overall: 0,
            casta: 'Jogador Bronze',
            noMercado: false,
            ativo: true,
            preco: null,
            compradopor: '',
            estatisticas: '',
            miniGames: {}
        };
    }

    // Formato Legado (não migrado)
    return {
        ...playerDocData
    };
}

/**
 * Prepara o payload para atualizar ou criar os dados de uma temporada num jogador.
 */
export function buildPlayerSeasonUpdatePayload(season, playerData) {
    // Remove o ID se tiver sido injetado no objeto local
    const { id, ...cleanData } = playerData;
    return {
        [season]: {
            ...cleanData,
            ultimaAtualizacao: new Date().toISOString()
        }
    };
}
