const coinFormatter = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 });

function formatCoins(value) {
    return `${coinFormatter.format(Number(value) || 0)} ₲₵`;
}

function formatLoanDate(value) {
    if (!value) return 'Data indisponível';
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data indisponível';
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function createLoanCard(loan) {
    const isPaid = loan.estado === 'Pago';
    const principal = Number(loan.valorreal) || 0;
    const interest = Number(loan.valorJuros) || 0;
    const amountDue = Number(loan.valorTotalAPagar) || 0;
    const originalTotal = principal + interest || amountDue;
    const card = document.createElement('article');
    card.className = `debt-loan-card ${isPaid ? 'is-paid' : 'is-unpaid'}`;
    card.setAttribute('role', 'listitem');

    const heading = document.createElement('div');
    heading.className = 'debt-loan-heading';
    const title = document.createElement('strong');
    title.textContent = 'Empréstimo';
    const date = document.createElement('time');
    date.textContent = formatLoanDate(loan.movimentoData);
    heading.append(title, date);

    card.appendChild(heading);

    const details = document.createElement('dl');
    details.className = 'debt-loan-details';
    const rows = [
        { label: 'Valor concedido', value: formatCoins(principal) },
        { label: 'Juros', value: formatCoins(interest) },
        { label: isPaid ? 'Total saldado' : 'Por pagar', value: formatCoins(isPaid ? originalTotal : amountDue), className: 'debt-loan-total' },
        { label: 'Estado', value: isPaid ? 'Saldada' : 'Por pagar', className: 'debt-loan-status' }
    ];
    rows.forEach(({ label, value, className }) => {
        const row = document.createElement('div');
        if (className) row.classList.add(className);
        const term = document.createElement('dt');
        term.textContent = label;
        const amount = document.createElement('dd');
        amount.textContent = value;
        row.append(term, amount);
        details.appendChild(row);
    });
    card.appendChild(details);
    return card;
}

function renderLoanList(target, loans) {
    target.replaceChildren();
    if (!loans.length) {
        const empty = document.createElement('p');
        empty.className = 'debt-empty-state';
        empty.textContent = 'Ainda não há empréstimos nesta época.';
        target.appendChild(empty);
        return;
    }
    loans.forEach(loan => target.appendChild(createLoanCard(loan)));
}

export function renderDebtLoans(loans) {
    renderLoanList(document.getElementById('debtLoansList'), loans);
}
