const EMPTY_VALUE = 'Não disponível';

export function setPlayerPopupTab(tabName = 'overview') {
    const buttons = document.querySelectorAll('[data-popup-tab]');
    const panels = document.querySelectorAll('[data-popup-panel]');
    let focusTargetAssigned = false;

    buttons.forEach(button => {
        const isActive = button.dataset.popupTab === tabName;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', String(isActive));
        const isDefaultFocusTarget = tabName === 'overview' && !focusTargetAssigned && !button.disabled;
        button.tabIndex = isActive || isDefaultFocusTarget ? 0 : -1;
        if (isDefaultFocusTarget) focusTargetAssigned = true;
    });

    panels.forEach(panel => {
        const isActive = panel.dataset.popupPanel === tabName;
        panel.classList.toggle('active', isActive);
        panel.hidden = !isActive;
    });
}

export function lockPlayerPopupHeight() {
    const popupCard = document.querySelector('#playerPopup .player-popup-card');
    if (!popupCard) return;

    popupCard.style.height = 'auto';
    const naturalHeight = popupCard.scrollHeight;
    const viewportLimit = Math.floor(window.innerHeight * 0.88);
    const lockedHeight = Math.min(naturalHeight, viewportLimit);

    if (lockedHeight > 0) {
        popupCard.style.height = `${lockedHeight}px`;
    }
}

function setOptionalImage(image, fallback, source, altText) {
    if (!image || !fallback) return;

    const showFallback = () => {
        image.removeAttribute('src');
        image.style.display = 'none';
        fallback.style.display = 'grid';
    };

    if (!source) {
        showFallback();
        return;
    }

    image.style.display = 'none';
    fallback.style.display = 'grid';
    image.alt = altText || '';
    image.onload = () => {
        image.style.display = 'block';
        fallback.style.display = 'none';
    };
    image.onerror = showFallback;
    image.src = source;
}

function calculateAge(value) {
    if (!value) return EMPTY_VALUE;

    let birthDate;
    if (typeof value?.toDate === 'function') {
        birthDate = value.toDate();
    } else {
        const dateText = String(value).trim();
        const dateParts = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        birthDate = dateParts
            ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
            : new Date(value);
    }

    if (Number.isNaN(birthDate.getTime())) return EMPTY_VALUE;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const birthdayHasNotPassed = today.getMonth() < birthDate.getMonth()
        || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
    if (birthdayHasNotPassed) age -= 1;

    return age >= 0 ? `${age} anos` : EMPTY_VALUE;
}

function formatHeight(value) {
    if (value === null || value === undefined || value === '') return EMPTY_VALUE;
    const height = String(value).trim();
    if (/(?:cm|m)$/i.test(height)) return height;

    const numericHeight = Number(height.replace(',', '.'));
    if (Number.isFinite(numericHeight) && numericHeight <= 3) {
        return `${numericHeight.toFixed(2).replace('.', ',')} m`;
    }
    return `${height} cm`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderBiographyText(rawBio, { overall, club } = {}) {
    if (!rawBio || !String(rawBio).trim()) {
        return '<p>Biografia não disponível.</p>';
    }

    const resolvedBio = String(rawBio)
        .replace(/\{\{\s*overall_atual\s*\}\}/gi, () => String(overall ?? '—'))
        .replace(/\{\{\s*clube_atual\s*\}\}/gi, () => String(club ?? '—'));
    const safeBio = escapeHtml(resolvedBio);

    return safeBio
        .split(/\n\s*\n/)
        .map(paragraph => `<p>${paragraph.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>`)
        .join('');
}

export function renderPlayerAffiliation({
    clubName,
    clubLogo,
    countryName,
    countryFlag
}) {
    const clubNameElement = document.getElementById('popupPlayerClub');
    const clubLogoElement = document.getElementById('popupClubLogo');
    const clubFallback = document.getElementById('popupClubFallback');
    const countryNameElement = document.getElementById('popupCountryName');
    const countryFlagElement = document.getElementById('popupCountryFlag');
    const countryFallback = document.getElementById('popupCountryFallback');

    if (clubNameElement) clubNameElement.textContent = clubName || 'Equipa não disponível';
    if (countryNameElement) countryNameElement.textContent = countryName || 'País não disponível';

    setOptionalImage(clubLogoElement, clubFallback, clubLogo, clubName || 'Emblema da equipa');
    setOptionalImage(countryFlagElement, countryFallback, countryFlag, countryName || 'Bandeira do país');
}

export function configureBiography({
    position,
    club,
    country,
    birthDate,
    height,
    bio,
    overall
}) {
    const biographyButton = document.getElementById('popupBiographyButton');

    const fields = {
        biographyPlayerPosition: position || EMPTY_VALUE,
        biographyPlayerClub: club || EMPTY_VALUE,
        biographyPlayerCountry: country || EMPTY_VALUE,
        biographyPlayerAge: calculateAge(birthDate),
        biographyPlayerHeight: formatHeight(height)
    };

    Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });

    const biographyCopy = document.getElementById('biographyPlayerBio');
    if (biographyCopy) biographyCopy.innerHTML = renderBiographyText(bio, { overall, club });

    if (biographyButton) {
        biographyButton.onclick = () => setPlayerPopupTab('biography');
    }
}

const GMANAGER_LABELS = {
    mentalidade: 'Mentalidade',
    estiloJogo: 'Estilo de jogo',
    funcao: 'Função principal',
    pePreferido: 'Pé preferido',
    pontosFortes: 'Pontos fortes',
    notas: 'Notas do manager'
};

function renderGManagerValue(value) {
    return escapeHtml(value).replace(/\n/g, '<br>');
}

function getSafeImageSource(value) {
    const source = String(value ?? '').trim();
    return /^(https?:\/\/|\/|assets\/)/i.test(source) ? source : '';
}

export function configureGManager({ data, loading = false } = {}) {
    const button = document.getElementById('popupGManagerButton');
    const content = document.getElementById('gManagerPlayerContent');
    if (!button || !content) return;

    let entries = [];
    const attachedItems = Array.isArray(data?.items) ? data.items : [];
    if (attachedItems.length) {
        entries = attachedItems
            .filter(item => item?.nome || item?.tipo)
            .map(item => ({
                label: item.tipo || 'Item gManager',
                value: item.nome || 'Item sem nome',
                image: getSafeImageSource(item.imagem),
                detail: [
                    item.anexadoLabel ? `Anexado: ${item.anexadoLabel}` : '',
                    item.nivel,
                    item.valor !== undefined && item.valor !== null && item.valor !== '' ? `Custo de Compra: ${item.valor} gCoins` : '',
                    item.nota,
                    ...(Array.isArray(item.sugestoes) ? item.sugestoes : [])
                ].filter(Boolean).join(' · ')
            }));
    } else {
        entries = Object.entries(GMANAGER_LABELS)
            .filter(([key]) => data?.[key] !== undefined && data?.[key] !== null && String(data[key]).trim() !== '')
            .map(([key, label]) => ({ label, value: data[key] }));
        const customItems = Array.isArray(data?.outros) ? data.outros : [];
        customItems.forEach(item => {
            if (item?.nome || item?.valor) entries.push({ label: item.nome || 'Outro item', value: item.valor || '—' });
        });
    }

    if (loading && !entries.length) {
        content.innerHTML = '<p class="gmanager-empty">A procurar sugestões gManager...</p>';
    } else if (!entries.length) {
        content.innerHTML = '<p class="gmanager-empty">Não existem sugestões gManager compatíveis com este jogador.</p>';
    } else {
        content.innerHTML = entries.map(({ label, value, image, detail }) => `
            <div class="gmanager-popup-item">
                <div class="gmanager-popup-media">
                    ${image
                        ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(value)}" loading="lazy" referrerpolicy="no-referrer">`
                        : '<span class="gmanager-popup-media-fallback" aria-hidden="true"><i class="fas fa-cube"></i></span>'}
                </div>
                <div class="gmanager-popup-copy">
                    <span class="gmanager-popup-label">${escapeHtml(label)}</span>
                    <span class="gmanager-popup-value">${renderGManagerValue(value)}</span>
                    ${detail ? `<small class="gmanager-popup-detail">${renderGManagerValue(detail)}</small>` : ''}
                </div>
            </div>
        `).join('');
    }

    button.onclick = () => setPlayerPopupTab('gmanager');
}

export function setHistoryAvailability(button, isAvailable) {
    if (!button) return;
    button.disabled = !isAvailable;
    button.title = isAvailable ? 'Ver histórico de movimentos' : 'Ainda não existem movimentos registados';
    if (!isAvailable) button.onclick = null;
}
