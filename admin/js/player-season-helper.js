// Compatibilidade com as páginas administrativas existentes.
// A implementação partilhada vive em core para servir toda a aplicação.
export {
    ATEMPORAL_FIELDS,
    buildPlayerSeasonUpdatePayload,
    fetchOwnedPlayersForSeason,
    fetchUniqueSeasons,
    getPlayerSeasonData,
    hasPlayerDataForSeason,
    isPlayerMigrated
} from '../../core/player-season.js';
