import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import { adminAuthReady, app } from './auth-guard.js';

const functions = getFunctions(app, 'us-central1');
const reconcileUserBalances = httpsCallable(functions, 'reconcileUserBalances', {
    timeout: 300000
});

const previewButton = document.getElementById('preview-balances-button');
const toolbarStatus = document.getElementById('balance-reconciliation-toolbar-status');
const popup = document.getElementById('balance-reconciliation-popup');
const closeButton = popup?.querySelector('.close-button');
const cancelButton = document.getElementById('cancel-balance-reconciliation');
const applyButton = document.getElementById('apply-balances-button');
const feedback = document.getElementById('balance-reconciliation-feedback');
const seasonValue = document.getElementById('balance-season-value');
const checkedValue = document.getElementById('balance-checked-value');
const changedValue = document.getElementById('balance-changed-value');
const tableBody = document.getElementById('balance-reconciliation-body');

let previewSeason = '';
let changedUsers = 0;

function formatNumber(value) {
    return new Intl.NumberFormat('pt-PT', {
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}

function formatDifference(value) {
    const number = Number(value) || 0;
    return `${number > 0 ? '+' : ''}${formatNumber(number)}`;
}

function getErrorMessage(error) {
    const rawMessage = error?.message || '';
    const cleanedMessage = rawMessage.replace(/^Firebase:\s*/i, '').replace(/\s*\([^)]*\)\.?$/, '');
    return cleanedMessage || 'Não foi possível reconciliar os saldos.';
}

function setFeedback(message, type = '') {
    feedback.textContent = message;
    feedback.className = `balance-reconciliation-feedback${type ? ` is-${type}` : ''}`;
}

function setBusy(isBusy, label = '') {
    previewButton.disabled = isBusy;
    applyButton.disabled = isBusy || changedUsers === 0;
    previewButton.innerHTML = isBusy
        ? '<i class="fas fa-spinner fa-spin"></i> A calcular...'
        : '<i class="fas fa-scale-balanced"></i> Reconciliar saldos';
    if (label) setFeedback(label);
}

function openPopup() {
    popup.style.display = 'flex';
}

function closePopup() {
    popup.style.display = 'none';
}

function appendCell(row, value, className = '') {
    const cell = document.createElement('td');
    cell.textContent = value;
    if (className) cell.className = className;
    row.appendChild(cell);
}

function renderRows(rows) {
    tableBody.replaceChildren();

    if (!rows.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.className = 'balance-reconciliation-empty';
        cell.textContent = 'Todos os saldos já correspondem aos movimentos da época.';
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    rows.forEach((item) => {
        const row = document.createElement('tr');
        const difference = Number(item.difference) || 0;
        appendCell(row, item.name || item.userId);
        appendCell(row, `${formatNumber(item.currentBalance)} gCoins`);
        appendCell(row, `${formatNumber(item.calculatedBalance)} gCoins`);
        appendCell(
            row,
            `${formatDifference(difference)} gCoins`,
            difference > 0 ? 'difference-positive' : 'difference-negative'
        );
        appendCell(row, formatNumber(item.movementCount));
        tableBody.appendChild(row);
    });
}

function renderPreview(data) {
    previewSeason = data.season || '';
    changedUsers = Number(data.changedUsers) || 0;
    seasonValue.textContent = previewSeason || '—';
    checkedValue.textContent = formatNumber(data.totalUsers);
    changedValue.textContent = formatNumber(changedUsers);
    renderRows(Array.isArray(data.rows) ? data.rows : []);
    applyButton.disabled = changedUsers === 0;
    toolbarStatus.textContent = changedUsers === 0
        ? 'Todos os saldos estão corretos.'
        : `${changedUsers} saldo${changedUsers === 1 ? '' : 's'} com diferenças.`;
    setFeedback(
        changedUsers === 0
            ? 'Não existem alterações para aplicar.'
            : 'Confirma os valores calculados antes de aplicar a correção.',
        changedUsers === 0 ? 'success' : ''
    );
}

async function loadPreview() {
    openPopup();
    changedUsers = 0;
    setBusy(true, 'A analisar todos os movimentos da época...');

    try {
        const result = await reconcileUserBalances({ mode: 'preview' });
        renderPreview(result.data);
    } catch (error) {
        console.error('Erro ao pré-visualizar a reconciliação:', error);
        toolbarStatus.textContent = 'Não foi possível calcular os saldos.';
        setFeedback(getErrorMessage(error), 'error');
    } finally {
        setBusy(false);
    }
}

async function applyReconciliation() {
    if (!previewSeason || changedUsers === 0) return;

    const confirmed = window.confirm(
        `Aplicar os saldos calculados aos ${changedUsers} utilizadores da época ${previewSeason}?`
    );
    if (!confirmed) return;

    setBusy(true, 'A atualizar os saldos no Firebase...');
    try {
        const result = await reconcileUserBalances({
            mode: 'apply',
            confirmation: previewSeason
        });
        const updatedUsers = Number(result.data?.changedUsers) || 0;
        toolbarStatus.textContent = `${updatedUsers} saldo${updatedUsers === 1 ? '' : 's'} corrigido${updatedUsers === 1 ? '' : 's'}.`;
        setFeedback('Reconciliação concluída. Os ganhos foram preservados e as despesas descontadas.', 'success');
        changedUsers = 0;
        applyButton.disabled = true;
        changedValue.textContent = '0';
        renderRows([]);
    } catch (error) {
        console.error('Erro ao aplicar a reconciliação:', error);
        setFeedback(getErrorMessage(error), 'error');
    } finally {
        setBusy(false);
    }
}

if (previewButton && popup && applyButton) {
    previewButton.disabled = true;
    adminAuthReady.then(() => {
        previewButton.disabled = false;
        toolbarStatus.textContent = 'Calcula os saldos a partir do extrato da época.';
    });

    previewButton.addEventListener('click', loadPreview);
    applyButton.addEventListener('click', applyReconciliation);
    closeButton?.addEventListener('click', closePopup);
    cancelButton?.addEventListener('click', closePopup);
    popup.addEventListener('click', (event) => {
        if (event.target === popup) closePopup();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && popup.style.display === 'flex') closePopup();
    });
}
