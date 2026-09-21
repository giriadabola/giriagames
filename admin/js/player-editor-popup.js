const BIOGRAPHY_TOKENS = {
    overall: '{{overall_atual}}',
    club: '{{clube_atual}}'
};

const EDITOR_TAB_NAMES = ['general', 'overall', 'gmanager'];
let gManagerCatalog = [];
let selectedGManagerItems = [];

function getTabElements(tabName) {
    return {
        tab: document.getElementById(`editor-tab-${tabName}`),
        panel: document.getElementById(`editor-panel-${tabName}`)
    };
}

export function setEditorTab(tabName) {
    EDITOR_TAB_NAMES.forEach((name) => {
        const { tab, panel } = getTabElements(name);
        const isActive = name === tabName;
        tab?.classList.toggle('active', isActive);
        tab?.setAttribute('aria-selected', String(isActive));
        tab?.setAttribute('tabindex', isActive ? '0' : '-1');
        panel?.classList.toggle('active', isActive);
        if (panel) panel.hidden = !isActive;
    });
}

export function setGManagerData(data = {}) {
    selectedGManagerItems = Array.isArray(data?.items)
        ? data.items.map(normaliseGManagerItem).filter(item => item.id || item.nome)
        : [];
    renderSelectedGManagerItems();
}

export function getGManagerData() {
    return { items: selectedGManagerItems.map(normaliseGManagerItem) };
}

function normaliseGManagerItem(item = {}) {
    return {
        id: item.id || '',
        nome: item.nome || '',
        tipo: item.tipo || '',
        imagem: item.imagem || '',
        valor: item.valor ?? null,
        nota: item.nota || '',
        nivel: item.nivel || ''
    };
}

function createGManagerItemElement(item, removable = false) {
    const row = document.createElement('div');
    row.className = 'gmanager-item-row';

    const icon = document.createElement('span');
    icon.className = 'gmanager-item-icon';
    icon.innerHTML = '<i class="fas fa-puzzle-piece" aria-hidden="true"></i>';

    const text = document.createElement('span');
    text.className = 'gmanager-item-text';
    const name = document.createElement('strong');
    name.textContent = item.nome || 'Item sem nome';
    const type = document.createElement('small');
    type.textContent = item.tipo || 'Item gManager';
    text.append(name, type);

    row.append(icon, text);
    if (removable) {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'btn secondary gmanager-remove-button';
        removeButton.setAttribute('aria-label', `Remover ${item.nome || 'item'}`);
        removeButton.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
        removeButton.addEventListener('click', () => {
            selectedGManagerItems = selectedGManagerItems.filter(selected => selected.id !== item.id);
            renderSelectedGManagerItems();
            renderGManagerSearchResults(document.getElementById('gManagerSearch')?.value || '');
        });
        row.appendChild(removeButton);
    }
    return row;
}

function renderSelectedGManagerItems() {
    const container = document.getElementById('gManagerSelectedItems');
    if (!container) return;
    container.innerHTML = '';
    if (!selectedGManagerItems.length) {
        const empty = document.createElement('p');
        empty.className = 'gmanager-picker-empty';
        empty.textContent = 'Ainda não existem itens anexados.';
        container.appendChild(empty);
        return;
    }
    selectedGManagerItems.forEach(item => container.appendChild(createGManagerItemElement(item, true)));
}

function renderGManagerSearchResults(searchText = '') {
    const container = document.getElementById('gManagerSearchResults');
    if (!container) return;
    const query = searchText.trim().toLocaleLowerCase('pt-PT');
    const selectedIds = new Set(selectedGManagerItems.map(item => item.id));
    const results = gManagerCatalog
        .filter(item => !item.id || !selectedIds.has(item.id))
        .filter(item => !query || `${item.nome} ${item.tipo}`.toLocaleLowerCase('pt-PT').includes(query))
        .slice(0, 30);
    container.innerHTML = '';
    if (!results.length) {
        const empty = document.createElement('p');
        empty.className = 'gmanager-picker-empty';
        empty.textContent = query ? 'Nenhum item encontrado.' : 'Escreva para pesquisar itens.';
        container.appendChild(empty);
        return;
    }
    results.forEach(item => {
        const button = createGManagerItemElement(item);
        button.classList.add('gmanager-search-result');
        button.setAttribute('role', 'button');
        button.tabIndex = 0;
        const addItem = () => {
            selectedGManagerItems = [...selectedGManagerItems, normaliseGManagerItem(item)];
            renderSelectedGManagerItems();
            renderGManagerSearchResults(document.getElementById('gManagerSearch')?.value || '');
        };
        button.addEventListener('click', addItem);
        button.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                addItem();
            }
        });
        container.appendChild(button);
    });
}

export function configureGManagerItemPicker(items = []) {
    gManagerCatalog = items.map(normaliseGManagerItem).filter(item => item.id || item.nome);
    const searchInput = document.getElementById('gManagerSearch');
    if (searchInput && searchInput.dataset.initialised !== 'true') {
        searchInput.addEventListener('input', event => renderGManagerSearchResults(event.target.value));
        searchInput.dataset.initialised = 'true';
    }
    renderSelectedGManagerItems();
    renderGManagerSearchResults(searchInput?.value || '');
}

function insertAtCursor(textarea, value) {
    if (!textarea) return;

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.value = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
    textarea.focus();
    const cursorPosition = start + value.length;
    textarea.setSelectionRange(cursorPosition, cursorPosition);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

export function initPlayerEditorPopupUi() {
    const bioTextarea = document.getElementById('playerBio');
    const tabs = [
        { name: 'general', element: document.getElementById('editor-tab-general') },
        { name: 'overall', element: document.getElementById('editor-tab-overall') },
        { name: 'gmanager', element: document.getElementById('editor-tab-gmanager') }
    ];

    tabs.forEach(({ name, element }, index) => {
        if (!element || element.dataset.initialised === 'true') return;

        element.addEventListener('click', () => setEditorTab(name));
        element.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const nextIndex = event.key === 'ArrowRight'
                ? (index + 1) % tabs.length
                : (index - 1 + tabs.length) % tabs.length;
            const nextTab = tabs[nextIndex].element;
            setEditorTab(tabs[nextIndex].name);
            nextTab?.focus();
        });
        element.dataset.initialised = 'true';
    });

    const overallButton = document.getElementById('insertBioOverall');
    const clubButton = document.getElementById('insertBioClub');
    overallButton?.addEventListener('click', () => insertAtCursor(bioTextarea, BIOGRAPHY_TOKENS.overall));
    clubButton?.addEventListener('click', () => insertAtCursor(bioTextarea, BIOGRAPHY_TOKENS.club));

    setEditorTab('general');
}

export { BIOGRAPHY_TOKENS };
