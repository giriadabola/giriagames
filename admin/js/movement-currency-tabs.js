const MINI_COIN_STATES = new Set(['WhoWins Paid', 'Investimentos Paid', 'Endless Paid']);

function currencyOf(movement) {
    if (movement.currency === 'mini-gcoins') return 'mini-gcoins';
    if (movement.currency === 'gcoins') return 'gcoins';
    return MINI_COIN_STATES.has(movement.estado) ? 'mini-gcoins' : 'gcoins';
}

function timestampValue(value) {
    if (value && typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    return 0;
}

function movementDate(value) {
    if (!value || typeof value.toDate !== 'function') return 'N/A';
    const date = value.toDate();
    return `${date.getDate()} ${date.toLocaleString('pt-PT', {month: 'long'})} ${date.getFullYear()}`;
}

export function createMovementCurrencyTabs() {
    const table = document.getElementById('movements-detail-table');
    const tableBody = document.getElementById('movements-table-body');
    const panel = document.getElementById('movements-panel');
    const recalculateButton = document.getElementById('recalculate-button');
    const tabs = [...document.querySelectorAll('.movement-tab-btn')];
    let entries = [];
    let activeCurrency = 'gcoins';

    function renderEntries() {
        const filteredEntries = entries.filter(({data}) => currencyOf(data) === activeCurrency);
        table.querySelector('tfoot')?.remove();
        tableBody.replaceChildren();

        if (filteredEntries.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 8;
            cell.className = 'movement-empty-state';
            cell.textContent = activeCurrency === 'mini-gcoins'
                ? 'Nenhuma movimentação de Mini-Coins nesta temporada.'
                : 'Nenhuma movimentação de gCoins nesta temporada.';
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }

        let totalPrice = 0;
        let totalValue = 0;
        let totalDue = 0;
        filteredEntries.forEach(({data}) => {
            const currency = currencyOf(data);
            const row = document.createElement('tr');
            [movementDate(data.movimentoData), data.estado || 'N/A', data.tipo || 'N/A'].forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = String(value);
                row.appendChild(cell);
            });

            const currencyCell = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = `movement-currency-badge ${currency}`;
            badge.textContent = currency === 'mini-gcoins' ? 'Mini-Coins' : 'gCoins';
            currencyCell.appendChild(badge);
            row.appendChild(currencyCell);

            const price = Number(data.preco) || 0;
            const value = Number(data.valorreal) || 0;
            const due = Number(data.valorTotalAPagar) || 0;
            [price, value, data.descricao || '', due].forEach(item => {
                const cell = document.createElement('td');
                cell.textContent = String(item);
                row.appendChild(cell);
            });
            tableBody.appendChild(row);
            totalPrice += price;
            totalValue += value;
            totalDue += due;
        });

        const footer = document.createElement('tfoot');
        footer.innerHTML = '<tr class="movement-totals-row"><td colspan="4">TOTAIS:</td><td></td><td></td><td></td><td></td></tr>';
        const totals = footer.querySelectorAll('td');
        totals[1].textContent = totalPrice.toFixed(2);
        totals[2].textContent = totalValue.toFixed(2);
        totals[4].textContent = totalDue.toFixed(2);
        table.appendChild(footer);
    }

    function setCurrency(currency) {
        activeCurrency = currency === 'mini-gcoins' ? 'mini-gcoins' : 'gcoins';
        const activeTabId = activeCurrency === 'mini-gcoins' ? 'movement-tab-mini-coins' : 'movement-tab-gcoins';
        tabs.forEach(tab => {
            const isActive = tab.dataset.movementCurrency === activeCurrency;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
        });
        panel.setAttribute('aria-labelledby', activeTabId);
        recalculateButton.hidden = activeCurrency !== 'gcoins';
        renderEntries();
    }

    function updateCounts() {
        const miniCount = entries.filter(({data}) => currencyOf(data) === 'mini-gcoins').length;
        document.getElementById('mini-coins-movement-count').textContent = String(miniCount);
        document.getElementById('gcoins-movement-count').textContent = String(entries.length - miniCount);
    }

    tabs.forEach(tab => tab.addEventListener('click', () => setCurrency(tab.dataset.movementCurrency)));

    return {
        reset() {
            entries = [];
            updateCounts();
            setCurrency('gcoins');
        },
        setLoading() {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">A carregar...</td></tr>';
        },
        setError() {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #ff6b6b;">Erro ao carregar movimentações.</td></tr>';
        },
        setEntries(movements) {
            entries = [...movements].sort((first, second) =>
                timestampValue(second.data.movimentoData) - timestampValue(first.data.movimentoData)
            );
            updateCounts();
            renderEntries();
        }
    };
}
