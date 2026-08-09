import { db } from './auth-guard.js';
import {
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDocs,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const state = {
    competitions: [],
    odds: [],
    countries: new Map(),
    competitionSearch: '',
    oddSearch: ''
};

const elements = {
    matrix: document.getElementById('odds-matrix'),
    matrixFrozen: document.getElementById('odds-matrix-frozen'),
    matrixHeaderFrozen: document.getElementById('odds-matrix-header-frozen'),
    matrixHeaderCompetitions: document.getElementById('odds-matrix-header-competitions'),
    matrixHeaderScroll: document.getElementById('matrix-header-scroll'),
    status: document.getElementById('matrix-status'),
    message: document.getElementById('matrix-message'),
    competitionSearch: document.getElementById('competition-search'),
    oddSearch: document.getElementById('odd-search'),
    refresh: document.getElementById('refresh-matrix')
};

function getOrder(item) {
    const order = Number.parseInt(item.ordem, 10);
    return Number.isNaN(order) ? Number.POSITIVE_INFINITY : order;
}

function getOddName(odd) {
    if (odd.categoria_subcategoria_3cat === 'categoria') {
        return odd.nomecategoria || 'Categoria sem nome';
    }

    if (odd.categoria_subcategoria_3cat === 'subcategoria') {
        return odd.nomesubcategoria || 'Subcategoria sem nome';
    }

    return odd.nome3categoria || 'Odd sem nome';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getVisibleCompetitions() {
    const search = state.competitionSearch.trim().toLocaleLowerCase('pt-PT');
    if (!search) return state.competitions;

    return state.competitions.filter((competition) => {
        const searchable = `${competition.nome} ${competition.pais}`.toLocaleLowerCase('pt-PT');
        return searchable.includes(search);
    });
}

function getVisibleOdds() {
    const activeOdds = state.odds.filter((odd) => odd.ativado === true);
    const search = state.oddSearch.trim().toLocaleLowerCase('pt-PT');
    if (!search) return activeOdds;

    return activeOdds.filter((odd) => getOddName(odd).toLocaleLowerCase('pt-PT').includes(search));
}

function buildOddGroups() {
    const activeOdds = state.odds.filter((odd) => odd.ativado === true);
    const visibleOdds = getVisibleOdds();
    const visibleIds = new Set(visibleOdds.map((odd) => odd.id));
    const subcategories = activeOdds.filter((odd) => odd.categoria_subcategoria_3cat === 'subcategoria');
    const thirdCategories = activeOdds.filter((odd) => odd.categoria_subcategoria_3cat === '3cat');
    const categories = activeOdds
        .filter((odd) => odd.categoria_subcategoria_3cat === 'categoria')
        .filter((parent) => {
            const parentSubcategories = subcategories.filter((odd) => odd.categoriapai === parent.id);
            return visibleIds.has(parent.id)
                || parentSubcategories.some((subcategory) => visibleIds.has(subcategory.id)
                    || thirdCategories.some((thirdCategory) => thirdCategory.subcategoriapai === subcategory.id && visibleIds.has(thirdCategory.id)));
        })
        .sort((a, b) => getOrder(a) - getOrder(b) || getOddName(a).localeCompare(getOddName(b), 'pt-PT'));

    return categories.map((parent) => {
        const children = subcategories
            .filter((odd) => odd.categoriapai === parent.id)
            .filter((subcategory) => visibleIds.has(parent.id)
                || visibleIds.has(subcategory.id)
                || thirdCategories.some((thirdCategory) => thirdCategory.subcategoriapai === subcategory.id && visibleIds.has(thirdCategory.id)))
            .sort((a, b) => getOrder(a) - getOrder(b) || getOddName(a).localeCompare(getOddName(b), 'pt-PT'))
            .map((subcategory) => ({
                odd: subcategory,
                level: 'subcategory',
                children: thirdCategories
                    .filter((odd) => odd.subcategoriapai === subcategory.id && odd.categoriapai === parent.id)
                    .filter((odd) => visibleIds.has(parent.id) || visibleIds.has(subcategory.id) || visibleIds.has(odd.id))
                    .sort((a, b) => getOrder(a) - getOrder(b) || getOddName(a).localeCompare(getOddName(b), 'pt-PT'))
                    .map((odd) => ({ odd, level: 'third-category' }))
            }));

        return { parent, children };
    }).filter((group) => group.children.length > 0);
}

function renderCompetitionHeading(competition) {
    return `<div class="competition-heading" title="${escapeHtml(competition.nome)}">
        <span class="competition-name">${escapeHtml(competition.nome)}</span>
        <span class="competition-country">${escapeHtml(competition.pais)}</span>
    </div>`;
}

function renderSwitch(odd, competition) {
    const checked = Array.isArray(odd.competicoes) && odd.competicoes.includes(competition.nome);
    const label = `${checked ? 'Desativar' : 'Ativar'} ${getOddName(odd)} em ${competition.nome}`;

    return `<label class="matrix-switch" title="${escapeHtml(label)}">
        <input type="checkbox" class="association-toggle" data-odd-id="${escapeHtml(odd.id)}" data-competition-name="${escapeHtml(competition.nome)}" ${checked ? 'checked' : ''}>
        <span class="matrix-slider"></span>
    </label>`;
}

function renderOddLabel(odd, level, marker) {
    return `<span class="odd-name ${level}"><span class="tree-marker">${marker}</span>${escapeHtml(getOddName(odd))}</span>`;
}

function renderFrozenRows(groups) {
    return groups.map(({ parent, children }) => {
        const parentRow = `<tr class="odd-parent"><th class="odd-column">
            <i class="fas fa-layer-group parent-icon" aria-hidden="true"></i>${escapeHtml(getOddName(parent))}
        </th></tr>`;
        const childRows = children.map(({ odd, level, children: nested = [] }) => {
            const row = `<tr class="odd-row"><th scope="row" class="odd-column odd-name-cell">${renderOddLabel(odd, level, '↳')}</th></tr>`;
            const nestedRows = nested.map(({ odd: nestedOdd, level: nestedLevel }) => `<tr class="odd-row"><th scope="row" class="odd-column odd-name-cell">${renderOddLabel(nestedOdd, nestedLevel, '└')}</th></tr>`).join('');
            return row + nestedRows;
        }).join('');
        return parentRow + childRows;
    }).join('');
}

function renderCompetitionRows(groups, competitions) {
    return groups.map(({ children }) => {
        const parentRow = `<tr class="odd-parent"><td colspan="${competitions.length}" aria-hidden="true"></td></tr>`;
        const childRows = children.map(({ odd, children: nested = [] }) => {
            const row = `<tr class="odd-row">${competitions.map((competition) => `<td class="odd-cell">${renderSwitch(odd, competition)}</td>`).join('')}</tr>`;
            const nestedRows = nested.map(({ odd: nestedOdd }) => `<tr class="odd-row">${competitions.map((competition) => `<td class="odd-cell">${renderSwitch(nestedOdd, competition)}</td>`).join('')}</tr>`).join('');
            return row + nestedRows;
        }).join('');
        return parentRow + childRows;
    }).join('');
}

function renderMatrix() {
    const competitions = getVisibleCompetitions();
    const groups = buildOddGroups();

    if (competitions.length === 0 || groups.length === 0) {
        elements.matrix.style.display = 'none';
        elements.matrixFrozen.style.display = 'none';
        elements.matrixHeaderScroll.style.display = 'none';
        elements.message.className = 'empty-state';
        elements.message.textContent = competitions.length === 0
            ? 'Não existem competições ativas para apresentar.'
            : 'Não existem odds ativas com filhos para apresentar.';
        elements.message.style.display = 'block';
        updateStatus(competitions.length, 0);
        return;
    }

    elements.message.style.display = 'none';
    elements.matrix.style.display = 'table';
    elements.matrixFrozen.style.display = 'table';
    elements.matrixHeaderScroll.style.display = 'block';

    elements.matrixHeaderFrozen.innerHTML = `<thead><tr>
        <th class="odd-column">Odds ativas / Competições ativas</th>
    </tr></thead>`;
    elements.matrixHeaderCompetitions.innerHTML = `<colgroup>${competitions.map(() => '<col class="competition-column">').join('')}</colgroup><thead><tr>
        ${competitions.map((competition) => `<th>${renderCompetitionHeading(competition)}</th>`).join('')}
    </tr></thead>`;
    elements.matrixFrozen.innerHTML = `<tbody>${renderFrozenRows(groups)}</tbody>`;
    elements.matrix.innerHTML = `<colgroup>${competitions.map(() => '<col class="competition-column">').join('')}</colgroup><tbody>${renderCompetitionRows(groups, competitions)}</tbody>`;

    updateStatus(competitions.length, groups.reduce((total, group) => total + group.children.length + group.children.reduce((sum, child) => sum + child.children.length, 0), 0));
    elements.matrix.querySelectorAll('.association-toggle').forEach((toggle) => {
        toggle.addEventListener('change', handleAssociationChange);
    });
}

function updateStatus(competitionCount, oddCount) {
    elements.status.textContent = `${competitionCount} competição(ões) · ${oddCount} odd(s) visível(is)`;
}

async function handleAssociationChange(event) {
    const toggle = event.currentTarget;
    const oddId = toggle.dataset.oddId;
    const competitionName = toggle.dataset.competitionName;
    const shouldAssociate = toggle.checked;
    const odd = state.odds.find((item) => item.id === oddId);

    if (!odd || !competitionName) return;

    toggle.disabled = true;
    try {
        await updateDoc(doc(db, 'oddcategorias', oddId), {
            competicoes: shouldAssociate ? arrayUnion(competitionName) : arrayRemove(competitionName)
        });

        const currentCompetitions = Array.isArray(odd.competicoes) ? odd.competicoes : [];
        odd.competicoes = shouldAssociate
            ? [...new Set([...currentCompetitions, competitionName])]
            : currentCompetitions.filter((name) => name !== competitionName);
        toggle.parentElement.title = `${shouldAssociate ? 'Desativar' : 'Ativar'} ${getOddName(odd)} em ${competitionName}`;
    } catch (error) {
        console.error('Erro ao atualizar a associação da odd:', error);
        toggle.checked = !shouldAssociate;
        alert('Não foi possível atualizar esta associação. Tente novamente.');
    } finally {
        toggle.disabled = false;
    }
}

async function loadData() {
    elements.message.className = 'loading-state';
    elements.message.textContent = 'A carregar competições e odds...';
    elements.message.style.display = 'block';
    elements.matrix.style.display = 'none';
    elements.matrixFrozen.style.display = 'none';
    elements.matrixHeaderScroll.style.display = 'none';
    elements.refresh.disabled = true;

    try {
        const [countriesSnapshot, competitionsSnapshot, oddsSnapshot] = await Promise.all([
            getDocs(collection(db, 'paises')),
            getDocs(collection(db, 'competicoes')),
            getDocs(collection(db, 'oddcategorias'))
        ]);

        state.countries = new Map(countriesSnapshot.docs.map((country) => [country.id, country.data().nome || 'País desconhecido']));
        state.competitions = competitionsSnapshot.docs
            .map((competition) => ({ id: competition.id, ...competition.data() }))
            .filter((competition) => competition.ativo === true)
            .map((competition) => ({
                ...competition,
                nome: competition.nome || 'Competição sem nome',
                pais: state.countries.get(competition.paisId) || 'País desconhecido'
            }))
            .sort((a, b) => a.pais.localeCompare(b.pais, 'pt-PT') || a.nome.localeCompare(b.nome, 'pt-PT'));
        state.odds = oddsSnapshot.docs.map((odd) => ({ id: odd.id, ...odd.data() }));
        renderMatrix();
    } catch (error) {
        console.error('Erro ao carregar a gestão de odds:', error);
        elements.matrix.style.display = 'none';
        elements.matrixFrozen.style.display = 'none';
        elements.matrixHeaderScroll.style.display = 'none';
        elements.message.className = 'error-state';
        elements.message.textContent = 'Ocorreu um erro ao carregar os dados. Atualize a página e tente novamente.';
        elements.message.style.display = 'block';
        elements.status.textContent = '';
    } finally {
        elements.refresh.disabled = false;
    }
}

elements.competitionSearch.addEventListener('input', (event) => {
    state.competitionSearch = event.target.value;
    renderMatrix();
});

elements.oddSearch.addEventListener('input', (event) => {
    state.oddSearch = event.target.value;
    renderMatrix();
});

elements.refresh.addEventListener('click', loadData);
loadData();
