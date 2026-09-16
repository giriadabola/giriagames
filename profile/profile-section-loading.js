export function showProfileSectionLoading(container, message) {
    if (!container) {
        return;
    }

    const loadingState = document.createElement('div');
    loadingState.className = 'profile-section-loading';
    loadingState.setAttribute('role', 'status');
    loadingState.setAttribute('aria-live', 'polite');

    const spinner = document.createElement('span');
    spinner.className = 'profile-section-loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.textContent = message;

    loadingState.append(spinner, text);
    container.replaceChildren(loadingState);
}

export function setProfileSeasonSelectLoading(selectElement) {
    if (!selectElement) {
        return;
    }

    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'A carregar...';

    selectElement.replaceChildren(option);
    selectElement.disabled = true;
}
