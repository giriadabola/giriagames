import { db } from './auth-guard.js';
import {
    collection,
    doc,
    getDocs,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const MONTHS = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
];

const MONTH_MAP = new Map(MONTHS.map((m, index) => [m, index + 1]));

let allCompetitions = [];
let countriesMap = new Map();
let displayLimit = 200;

let currentSortKey = 'nome-asc';

const elements = {
    tableBody: document.getElementById('competitions-table-body'),
    search: document.getElementById('tableSearch'),
    filterPais: document.getElementById('filter-pais'),
    filterEscalao: document.getElementById('filter-escalao'),
    filterOrdenacao: document.getElementById('filter-ordenacao'),
    loadMoreBtn: document.getElementById('btn-load-more'),
    status: document.getElementById('calendar-status')
};

const fallbackImg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%238892b0"><path d="M12 2L2 5v6c0 5.52 4.48 10 10 10s10-4.48 10-10V5l-10-3zm0 18c-4.41 0-8-3.59-8-8V6.3l8-2.4 8 2.4V12c0 4.41-3.59 8-8 8z"/></svg>`;

window.resolveCompetitionImage = function(img, code) {
    if (!img.dataset.tryIndex) {
        img.dataset.tryIndex = "0";
    }
    const extensions = ['webp', 'png', 'jpg', 'jpeg', 'svg'];
    const currentIndex = Number.parseInt(img.dataset.tryIndex, 10);

    if (currentIndex < extensions.length) {
        img.dataset.tryIndex = (currentIndex + 1).toString();
        img.src = `../assets/competition/comp_${code}.${extensions[currentIndex]}`;
    } else {
        img.onerror = null;
        img.src = fallbackImg;
    }
};

async function loadData() {
    elements.tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #8892b0; padding: 30px;">A carregar competições...</td></tr>`;

    try {
        const [countriesSnapshot, competitionsSnapshot] = await Promise.all([
            getDocs(collection(db, 'paises')),
            getDocs(collection(db, 'competicoes'))
        ]);

        countriesSnapshot.forEach((docSnap) => {
            countriesMap.set(docSnap.id, docSnap.data().nome || 'País Desconhecido');
        });

        allCompetitions = competitionsSnapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                nome: data.nome || 'Sem Nome',
                escalao: data.escalao || 'N/A',
                imagem: data.imagem || '',
                paisId: data.paisId || null,
                pais: countriesMap.get(data.paisId) || 'País Desconhecido',
                inicioComp: data.inicioComp || '',
                fimComp: data.fimComp || '',
                ativo: data.ativo !== false
            };
        });

        populateFilters();
        renderTable();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        elements.tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #fca5a5; padding: 30px;">Erro ao carregar os dados. Tente novamente.</td></tr>`;
    }
}

function populateFilters() {
    const paises = [...new Set(allCompetitions.map((c) => c.pais).filter((p) => p && p !== 'País Desconhecido'))].sort();
    const selectedPais = elements.filterPais.value;

    elements.filterPais.innerHTML = '<option value="">Todos os Países</option>';

    paises.forEach((pais) => {
        const opt = document.createElement('option');
        opt.value = pais;
        opt.textContent = pais;
        if (pais === selectedPais) opt.selected = true;
        elements.filterPais.appendChild(opt);
    });
}

function getMonthVal(monthStr, defaultVal = 99) {
    if (!monthStr) return defaultVal;
    return MONTH_MAP.get(monthStr) || defaultVal;
}

function sortCompetitions(list) {
    return list.sort((a, b) => {
        switch (currentSortKey) {
            case 'nome-asc':
                return a.nome.localeCompare(b.nome, 'pt-PT');
            case 'nome-desc':
                return b.nome.localeCompare(a.nome, 'pt-PT');
            case 'pais-asc':
                return a.pais.localeCompare(b.pais, 'pt-PT') || a.nome.localeCompare(b.nome, 'pt-PT');
            case 'pais-desc':
                return b.pais.localeCompare(a.pais, 'pt-PT') || a.nome.localeCompare(b.nome, 'pt-PT');
            case 'escalao-asc':
                return a.escalao.localeCompare(b.escalao, 'pt-PT') || a.nome.localeCompare(b.nome, 'pt-PT');
            case 'escalao-desc':
                return b.escalao.localeCompare(a.escalao, 'pt-PT') || a.nome.localeCompare(b.nome, 'pt-PT');
            case 'inicio-asc': {
                const valA = getMonthVal(a.inicioComp, 99);
                const valB = getMonthVal(b.inicioComp, 99);
                if (valA !== valB) return valA - valB;
                return a.nome.localeCompare(b.nome, 'pt-PT');
            }
            case 'inicio-desc': {
                const valA = getMonthVal(a.inicioComp, 0);
                const valB = getMonthVal(b.inicioComp, 0);
                if (valA !== valB) return valB - valA;
                return a.nome.localeCompare(b.nome, 'pt-PT');
            }
            case 'fim-asc': {
                const valA = getMonthVal(a.fimComp, 99);
                const valB = getMonthVal(b.fimComp, 99);
                if (valA !== valB) return valA - valB;
                return a.nome.localeCompare(b.nome, 'pt-PT');
            }
            case 'fim-desc': {
                const valA = getMonthVal(a.fimComp, 0);
                const valB = getMonthVal(b.fimComp, 0);
                if (valA !== valB) return valB - valA;
                return a.nome.localeCompare(b.nome, 'pt-PT');
            }
            default:
                return a.nome.localeCompare(b.nome, 'pt-PT');
        }
    });
}

function renderMonthOptions(selectedValue) {
    return `<option value="">Selecione o mês</option>` +
        MONTHS.map((m) => `<option value="${m}" ${m === selectedValue ? 'selected' : ''}>${m}</option>`).join('');
}

function renderTable() {
    const queryText = elements.search.value.trim().toLocaleLowerCase('pt-PT');
    const filterPais = elements.filterPais.value;
    const filterEscalao = elements.filterEscalao.value;

    elements.tableBody.innerHTML = '';

    const filtered = allCompetitions.filter((c) => {
        const matchesSearch = !queryText ||
            c.nome.toLocaleLowerCase('pt-PT').includes(queryText) ||
            c.pais.toLocaleLowerCase('pt-PT').includes(queryText) ||
            c.escalao.toLocaleLowerCase('pt-PT').includes(queryText);
        const matchesPais = !filterPais || c.pais === filterPais;
        const matchesEscalao = !filterEscalao || c.escalao === filterEscalao;
        return matchesSearch && matchesPais && matchesEscalao;
    });

    elements.status.textContent = `${filtered.length} competição(ões) visível(is)`;

    if (filtered.length === 0) {
        elements.tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #8892b0; padding: 30px;">Nenhuma competição encontrada.</td></tr>`;
        elements.loadMoreBtn.style.display = 'none';
        return;
    }

    const sorted = sortCompetitions(filtered);
    const displayed = sorted.slice(0, displayLimit);

    displayed.forEach((comp) => {
        const tr = document.createElement('tr');
        tr.dataset.id = comp.id;

        const localImg = comp.imagem
            ? (comp.imagem.startsWith('http') || comp.imagem.startsWith('data:') ? comp.imagem : '../' + comp.imagem)
            : fallbackImg;
        const codeMatch = comp.imagem ? comp.imagem.match(/comp_(.+)\.(webp|png|jpe?g)/i) : null;
        const compCode = codeMatch ? codeMatch[1] : comp.id;

        tr.innerHTML = `
            <td>
                <img src="${localImg}" alt="${comp.nome}" class="comp-row-img" onerror="resolveCompetitionImage(this, '${compCode}')">
                <span class="comp-row-name">${comp.nome}</span>
            </td>
            <td>${comp.pais}</td>
            <td>${comp.escalao}</td>
            <td style="text-align: center;">
                <select class="month-select start-month-select" data-id="${comp.id}">
                    ${renderMonthOptions(comp.inicioComp)}
                </select>
            </td>
            <td style="text-align: center;">
                <select class="month-select end-month-select" data-id="${comp.id}">
                    ${renderMonthOptions(comp.fimComp)}
                </select>
            </td>
            <td style="text-align: center;">
                <span class="status-badge neutral status-indicator-${comp.id}"><i class="fas fa-minus"></i> Sem alterações</span>
            </td>
        `;

        elements.tableBody.appendChild(tr);
    });

    elements.tableBody.querySelectorAll('.month-select').forEach((select) => {
        select.addEventListener('change', handleMonthChange);
    });

    elements.loadMoreBtn.style.display = filtered.length > displayLimit ? 'inline-block' : 'none';
    updateHeaderSortIcons();
}

function updateHeaderSortIcons() {
    document.querySelectorAll('.excel-table th[data-sort]').forEach((th) => {
        const sortType = th.dataset.sort;
        const icon = th.querySelector('i');
        if (!icon) return;

        let isActive = false;
        let isAsc = true;

        if (sortType === 'nome' && (currentSortKey === 'nome-asc' || currentSortKey === 'nome-desc')) {
            isActive = true;
            isAsc = currentSortKey === 'nome-asc';
        } else if (sortType === 'pais' && (currentSortKey === 'pais-asc' || currentSortKey === 'pais-desc')) {
            isActive = true;
            isAsc = currentSortKey === 'pais-asc';
        } else if (sortType === 'escalao' && (currentSortKey === 'escalao-asc' || currentSortKey === 'escalao-desc')) {
            isActive = true;
            isAsc = currentSortKey === 'escalao-asc';
        } else if (sortType === 'inicioComp' && (currentSortKey === 'inicio-asc' || currentSortKey === 'inicio-desc')) {
            isActive = true;
            isAsc = currentSortKey === 'inicio-asc';
        } else if (sortType === 'fimComp' && (currentSortKey === 'fim-asc' || currentSortKey === 'fim-desc')) {
            isActive = true;
            isAsc = currentSortKey === 'fim-asc';
        }

        if (isActive) {
            icon.className = isAsc ? 'fas fa-sort-up' : 'fas fa-sort-down';
            icon.style.color = '#2176ff';
        } else {
            icon.className = 'fas fa-sort';
            icon.style.color = '';
        }
    });
}

async function handleMonthChange(event) {
    const select = event.currentTarget;
    const compId = select.dataset.id;
    const comp = allCompetitions.find((c) => c.id === compId);
    if (!comp) return;

    const row = select.closest('tr');
    const startSelect = row.querySelector('.start-month-select');
    const endSelect = row.querySelector('.end-month-select');
    const indicator = row.querySelector(`.status-indicator-${compId}`);

    const newInicio = startSelect.value;
    const newFim = endSelect.value;

    indicator.className = `status-badge saving status-indicator-${compId}`;
    indicator.innerHTML = `<i class="fas fa-spinner fa-spin"></i> A guardar...`;
    startSelect.disabled = true;
    endSelect.disabled = true;

    try {
        await updateDoc(doc(db, 'competicoes', compId), {
            inicioComp: newInicio,
            fimComp: newFim
        });

        comp.inicioComp = newInicio;
        comp.fimComp = newFim;

        indicator.className = `status-badge saved status-indicator-${compId}`;
        indicator.innerHTML = `<i class="fas fa-check"></i> Guardado`;

        setTimeout(() => {
            if (indicator && indicator.classList.contains('saved')) {
                indicator.className = `status-badge neutral status-indicator-${compId}`;
                indicator.innerHTML = `<i class="fas fa-check-double"></i> Atualizado`;
            }
        }, 2000);
    } catch (error) {
        console.error('Erro ao guardar calendário:', error);
        startSelect.value = comp.inicioComp;
        endSelect.value = comp.fimComp;
        indicator.className = `status-badge error status-indicator-${compId}`;
        indicator.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Erro`;
    } finally {
        startSelect.disabled = false;
        endSelect.disabled = false;
    }
}

// Event Listeners for Filters & Sorting
elements.search.addEventListener('input', () => {
    displayLimit = 200;
    renderTable();
});

elements.filterPais.addEventListener('change', () => {
    displayLimit = 200;
    renderTable();
});

elements.filterEscalao.addEventListener('change', () => {
    displayLimit = 200;
    renderTable();
});

elements.filterOrdenacao.addEventListener('change', (e) => {
    currentSortKey = e.target.value;
    displayLimit = 200;
    renderTable();
});

elements.loadMoreBtn.addEventListener('click', () => {
    displayLimit += 200;
    renderTable();
});

document.querySelectorAll('.excel-table th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
        const sortType = th.dataset.sort;
        if (sortType === 'inicioComp') {
            currentSortKey = currentSortKey === 'inicio-asc' ? 'inicio-desc' : 'inicio-asc';
        } else if (sortType === 'fimComp') {
            currentSortKey = currentSortKey === 'fim-asc' ? 'fim-desc' : 'fim-asc';
        } else if (sortType === 'nome') {
            currentSortKey = currentSortKey === 'nome-asc' ? 'nome-desc' : 'nome-asc';
        } else if (sortType === 'pais') {
            currentSortKey = currentSortKey === 'pais-asc' ? 'pais-desc' : 'pais-asc';
        } else if (sortType === 'escalao') {
            currentSortKey = currentSortKey === 'escalao-asc' ? 'escalao-desc' : 'escalao-asc';
        }
        elements.filterOrdenacao.value = currentSortKey;
        renderTable();
    });
});

loadData();
