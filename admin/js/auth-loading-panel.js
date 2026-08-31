const PANEL_ID = 'admin-auth-loading';
const PENDING_CLASS = 'admin-auth-pending';

document.documentElement.classList.add(PENDING_CLASS);

const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = new URL('../css/auth-guard.css', import.meta.url).href;
document.head.appendChild(stylesheet);

function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel || !document.body) return panel;

    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = `
        <div class="admin-auth-loading__panel">
            <div class="admin-auth-loading__spinner" aria-hidden="true"></div>
            <p class="admin-auth-loading__title">A validar o acesso</p>
            <p class="admin-auth-loading__message">A verificar a sessão e as permissões...</p>
        </div>
    `;
    document.body.appendChild(panel);
    return panel;
}

function runWhenBodyExists(callback) {
    if (document.body) {
        callback();
        return;
    }

    document.addEventListener('DOMContentLoaded', callback, { once: true });
}

function showAuthLoading(message = 'A verificar a sessão e as permissões...') {
    document.documentElement.classList.add(PENDING_CLASS);
    runWhenBodyExists(() => {
        const panel = ensurePanel();
        panel?.classList.remove('is-error');
        const messageElement = panel?.querySelector('.admin-auth-loading__message');
        if (messageElement) messageElement.textContent = message;
    });
}

function showAuthError(message) {
    runWhenBodyExists(() => {
        const panel = ensurePanel();
        panel?.classList.add('is-error');
        const titleElement = panel?.querySelector('.admin-auth-loading__title');
        const messageElement = panel?.querySelector('.admin-auth-loading__message');
        if (titleElement) titleElement.textContent = 'Não foi possível validar o acesso';
        if (messageElement) messageElement.textContent = message;
    });
}

function completeAuthLoading(displayMode) {
    runWhenBodyExists(() => {
        const targetDisplay = displayMode || document.body.dataset.adminDisplay || 'flex';
        document.getElementById(PANEL_ID)?.remove();
        document.documentElement.classList.remove(PENDING_CLASS);
        document.documentElement.classList.add('admin-auth-authorized');
        document.body.style.display = targetDisplay;
    });
}

showAuthLoading();

window.AdminAuthLoading = Object.freeze({
    complete: completeAuthLoading,
    show: showAuthLoading,
    showError: showAuthError
});
document.dispatchEvent(new CustomEvent('admin-auth-loading-ready'));

export { completeAuthLoading, showAuthError, showAuthLoading };
