import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function asOptionalNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function createMultiChoice(select, choices, placeholder, searchPlaceholder) {
    if (!select) return null;
    const ChoicesConstructor = window.Choices;
    if (!ChoicesConstructor) throw new Error('Choices.js não está disponível.');

    return new ChoicesConstructor(select, {
        removeItemButton: true,
        placeholder: true,
        placeholderValue: placeholder,
        choices,
        searchPlaceholderValue: searchPlaceholder,
        itemSelectText: '',
        shouldSort: false,
        maxItemCount: -1,
        position: 'bottom'
    });
}

function normaliseGainData(value = {}) {
    return {
        pontosGlobaisPorJogadorPais: asOptionalNumber(value.pontosGlobaisPorJogadorPais),
        paises: asArray(value.paises),
        pontosGlobaisPorJogadorLiga: asOptionalNumber(value.pontosGlobaisPorJogadorLiga),
        ligas: asArray(value.ligas),
        ligasGrandeJogador: asArray(value.ligasGrandeJogador)
    };
}

/**
 * Carrega os países e ligas e expõe uma pequena API para o formulário.
 * Os IDs são guardados para que alterações ao nome não quebrem os itens.
 */
export async function initializeManagerGainFields(db) {
    const paisesSelect = document.getElementById('ganhoPaises');
    const ligasPlantelSelect = document.getElementById('ganhoLigasPlantel');
    const ligasGrandeJogadorSelect = document.getElementById('ganhoLigasGrandeJogador');

    if (!paisesSelect || !ligasPlantelSelect || !ligasGrandeJogadorSelect) {
        return {
            getValue: () => ({}),
            setValue: () => {},
            clear: () => {}
        };
    }

    const [paisesSnapshot, ligasSnapshot] = await Promise.all([
        getDocs(collection(db, 'paises')),
        getDocs(collection(db, 'competicoes'))
    ]);

    const paises = paisesSnapshot.docs
        .map((item) => ({ value: item.id, label: item.data()?.nome || '' }))
        .filter((item) => item.label)
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-PT'));
    const ligas = ligasSnapshot.docs
        .map((item) => ({ value: item.id, label: item.data()?.nome || '' }))
        .filter((item) => item.label)
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-PT'));

    const choices = {
        paises: createMultiChoice(paisesSelect, paises, 'Pesquisar países...', 'Pesquisar países...'),
        ligasPlantel: createMultiChoice(ligasPlantelSelect, ligas, 'Pesquisar ligas...', 'Pesquisar ligas...'),
        ligasGrandeJogador: createMultiChoice(ligasGrandeJogadorSelect, ligas, 'Pesquisar ligas...', 'Pesquisar ligas...')
    };
    const paisesPontosInput = document.getElementById('ganhoPontosPais');
    const ligasPontosInput = document.getElementById('ganhoPontosLiga');

    const clear = () => {
        paisesPontosInput.value = '';
        ligasPontosInput.value = '';
        choices.paises?.removeActiveItems();
        choices.ligasPlantel?.removeActiveItems();
        choices.ligasGrandeJogador?.removeActiveItems();
    };

    return {
        getValue() {
            const data = {
                pontosGlobaisPorJogadorPais: asOptionalNumber(paisesPontosInput.value),
                paises: asArray(choices.paises?.getValue(true)),
                pontosGlobaisPorJogadorLiga: asOptionalNumber(ligasPontosInput.value),
                ligas: asArray(choices.ligasPlantel?.getValue(true)),
                ligasGrandeJogador: asArray(choices.ligasGrandeJogador?.getValue(true))
            };

            const hasData = Object.values(data).some((value) => Array.isArray(value) ? value.length > 0 : value !== null);
            return hasData ? data : {};
        },
        setValue(value) {
            const data = normaliseGainData(value);
            paisesPontosInput.value = data.pontosGlobaisPorJogadorPais ?? '';
            ligasPontosInput.value = data.pontosGlobaisPorJogadorLiga ?? '';
            choices.paises?.removeActiveItems();
            choices.ligasPlantel?.removeActiveItems();
            choices.ligasGrandeJogador?.removeActiveItems();
            if (data.paises.length) choices.paises?.setChoiceByValue(data.paises);
            if (data.ligas.length) choices.ligasPlantel?.setChoiceByValue(data.ligas);
            if (data.ligasGrandeJogador.length) choices.ligasGrandeJogador?.setChoiceByValue(data.ligasGrandeJogador);
        },
        clear
    };
}
