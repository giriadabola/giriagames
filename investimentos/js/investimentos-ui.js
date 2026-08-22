import { 
    extractMatchesFromEmbedHtml, 
    renderFinancialWidgetForClub,
    parseMatchDateStringToTimestamp,
    getClubFootystatsId
} from './investimentos-charts.js';
import { 
    fetchFootyStatsHtmlWithCloudflareCheck, 
    syncMatchesToFirestoreInvestmentHistory
} from './investimentos-service.js';

export const PAGE_SIZE = 25;

export function renderCountryFilterPickcards(availableClubs, filterContainer, activePaisId, onSelectCountry) {
    if (!filterContainer) return;
    filterContainer.innerHTML = '';

    if (!availableClubs || availableClubs.length === 0) return;

    const countryCounts = {};
    const countryDetails = {};

    availableClubs.forEach(clube => {
        const key = clube.resolvedPaisId || 'outro';
        if (!countryCounts[key]) {
            countryCounts[key] = 0;
            countryDetails[key] = {
                id: key,
                nome: clube.resolvedPaisNome || 'Outro',
                imagem: clube.resolvedPaisImagem || ''
            };
        }
        countryCounts[key]++;
    });

    const uniqueCountries = Object.values(countryDetails).sort((a, b) => a.nome.localeCompare(b.nome));

    const isAllActive = activePaisId === 'all';
    const allBtn = document.createElement('div');
    allBtn.className = `country-pickcard ${isAllActive ? 'active' : ''}`;
    allBtn.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: ${isAllActive ? 'rgba(59, 130, 246, 0.25)' : 'rgba(30, 41, 59, 0.6)'}; border: 1px solid ${isAllActive ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 12px; cursor: pointer; white-space: nowrap; transition: all 0.2s; user-select: none;`;
    allBtn.innerHTML = `
        <i class="fas fa-globe" style="color: ${isAllActive ? '#38bdf8' : '#94a3b8'}; font-size: 13px;"></i>
        <span style="font-size: 13px; font-weight: ${isAllActive ? '700' : '600'}; color: ${isAllActive ? '#60a5fa' : '#e2e8f0'};">Todos <span style="font-size: 11px; opacity: 0.8;">(${availableClubs.length})</span></span>
    `;
    allBtn.addEventListener('click', () => onSelectCountry('all'));
    filterContainer.appendChild(allBtn);

    uniqueCountries.forEach(country => {
        const isSelected = activePaisId === country.id;
        const btn = document.createElement('div');
        btn.className = `country-pickcard ${isSelected ? 'active' : ''}`;
        btn.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: ${isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(30, 41, 59, 0.6)'}; border: 1px solid ${isSelected ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 12px; cursor: pointer; white-space: nowrap; transition: all 0.2s; user-select: none;`;

        const flagHtml = country.imagem
            ? `<img src="${country.imagem}" alt="${country.nome}" style="width: 20px; height: 14px; object-fit: cover; border-radius: 2px; border: 1px solid rgba(255, 255, 255, 0.15);">`
            : `<i class="fas fa-flag" style="color: #94a3b8; font-size: 12px;"></i>`;

        btn.innerHTML = `
            ${flagHtml}
            <span style="font-size: 13px; font-weight: ${isSelected ? '700' : '600'}; color: ${isSelected ? '#60a5fa' : '#e2e8f0'};">${country.nome} <span style="font-size: 11px; opacity: 0.8;">(${countryCounts[country.id]})</span></span>
        `;
        btn.addEventListener('click', () => onSelectCountry(country.id));
        filterContainer.appendChild(btn);
    });
}

export function renderPaginationControls(containerEl, currentPage, totalPages, totalItems, onPageChange) {
    if (!containerEl) return;
    if (totalItems <= PAGE_SIZE) {
        containerEl.innerHTML = '';
        return;
    }

    containerEl.innerHTML = `
        <button class="btn-page-prev" ${currentPage <= 1 ? 'disabled' : ''} style="padding: 8px 16px; background: ${currentPage <= 1 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(59, 130, 246, 0.2)'}; border: 1px solid ${currentPage <= 1 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(59, 130, 246, 0.4)'}; color: ${currentPage <= 1 ? '#64748b' : '#60a5fa'}; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: ${currentPage <= 1 ? 'not-allowed' : 'pointer'}; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
            <i class="fas fa-chevron-left"></i> Anterior
        </button>
        <span style="font-size: 13px; color: #94a3b8; font-weight: 600;">
            Página <strong style="color: #ffffff;">${currentPage}</strong> de <strong style="color: #ffffff;">${totalPages}</strong> <span style="font-size: 11px; opacity: 0.8;">(${totalItems} equipas)</span>
        </span>
        <button class="btn-page-next" ${currentPage >= totalPages ? 'disabled' : ''} style="padding: 8px 16px; background: ${currentPage >= totalPages ? 'rgba(255, 255, 255, 0.03)' : 'rgba(59, 130, 246, 0.2)'}; border: 1px solid ${currentPage >= totalPages ? 'rgba(255, 255, 255, 0.05)' : 'rgba(59, 130, 246, 0.4)'}; color: ${currentPage >= totalPages ? '#64748b' : '#60a5fa'}; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: ${currentPage >= totalPages ? 'not-allowed' : 'pointer'}; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
            Seguinte <i class="fas fa-chevron-right"></i>
        </button>
    `;

    const prevBtn = containerEl.querySelector('.btn-page-prev');
    const nextBtn = containerEl.querySelector('.btn-page-next');

    if (prevBtn && currentPage > 1) {
        prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
    }
    if (nextBtn && currentPage < totalPages) {
        nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
    }
}

export function displayExtractedMatchesInCard(matches, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!matches || matches.length === 0) {
        container.innerHTML = `<div style="color: #64748b; font-size: 12px; text-align: center; padding: 10px; background: rgba(15, 23, 42, 0.4); border-radius: 8px;">Sem jogos disponíveis de momento.</div>`;
        return;
    }

    let html = '';
    matches.slice(0, 5).forEach(m => {
        const badgeChar = (m.resultBadge || 'd').toUpperCase();
        let badgeColor = '#f59e0b';
        let badgeBg = 'rgba(245, 158, 11, 0.15)';
        let badgeBorder = 'rgba(245, 158, 11, 0.3)';

        if (badgeChar === 'W') {
            badgeColor = '#10b981';
            badgeBg = 'rgba(16, 185, 129, 0.15)';
            badgeBorder = 'rgba(16, 185, 129, 0.3)';
        } else if (badgeChar === 'L') {
            badgeColor = '#ef4444';
            badgeBg = 'rgba(239, 68, 68, 0.15)';
            badgeBorder = 'rgba(239, 68, 68, 0.3)';
        }

        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(15, 23, 42, 0.5); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; flex: 1; margin-right: 8px;">
                    ${m.date ? `<span style="font-size: 10px; color: #94a3b8;"><i class="far fa-calendar-alt" style="color: #38bdf8; font-size: 10px; margin-right: 3px;"></i>${m.date}</span>` : ''}
                    <div style="display: flex; align-items: center; gap: 6px; color: #f1f5f9; font-weight: 600; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${m.score ? `<span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; font-weight: 700;">${m.score}</span>` : ''}
                        <span style="overflow: hidden; text-overflow: ellipsis;">${m.opponent}</span>
                    </div>
                </div>
                <div style="width: 28px; height: 28px; border-radius: 6px; background: ${badgeBg}; border: 1px solid ${badgeBorder}; color: ${badgeColor}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; font-family: sans-serif; flex-shrink: 0;">
                    ${badgeChar}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

export async function renderRecordedHistoryFromFirestore(db, docId, index) {
    const listEl = document.getElementById(`my-history-list-${index}`);
    const countEl = document.getElementById(`my-history-count-${index}`);
    if (!listEl || !docId) return;

    try {
        const invSnap = await getDoc(doc(db, 'investimentos', docId));
        if (invSnap.exists() && Array.isArray(invSnap.data().historico) && invSnap.data().historico.length > 0) {
            const historico = invSnap.data().historico;
            if (countEl) countEl.textContent = `${historico.length} jogo(s)`;

            let html = '';
            historico.forEach(item => {
                const badge = (item.resultadoBadge || 'D').toUpperCase();
                let bg = 'rgba(245, 158, 11, 0.2)';
                let color = '#f59e0b';
                if (badge === 'W') {
                    bg = 'rgba(16, 185, 129, 0.2)';
                    color = '#10b981';
                } else if (badge === 'L') {
                    bg = 'rgba(239, 68, 68, 0.2)';
                    color = '#ef4444';
                }

                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(15, 23, 42, 0.6); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.04); font-size: 11px;">
                        <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                            <span style="width: 20px; height: 20px; border-radius: 4px; background: ${bg}; color: ${color}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 10px; flex-shrink: 0;">${badge}</span>
                            <span style="color: #f8fafc; font-weight: 600; overflow: hidden; text-overflow: ellipsis;">vs ${item.rival || 'Desconhecido'}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            <span style="color: #38bdf8; font-weight: 700; background: rgba(56, 189, 248, 0.1); padding: 1px 6px; border-radius: 4px; font-size: 10px;">${item.resultado || '-'}</span>
                            <span style="color: #64748b; font-size: 10px;"><i class="far fa-calendar-alt"></i> ${item.data || ''}</span>
                        </div>
                    </div>
                `;
            });

            listEl.innerHTML = html;
        } else {
            if (countEl) countEl.textContent = '0 jogos';
            listEl.innerHTML = `
                <div style="color: #64748b; font-size: 11px; text-align: center; padding: 8px; background: rgba(15, 23, 42, 0.3); border-radius: 6px;">
                    Sem jogos registados desde o início do investimento.
                </div>
            `;
        }
    } catch(err) {
        console.error("Erro ao carregar lista de histórico do Firestore:", err);
    }
}

export async function renderMatchesTabEmbed(db, footystatsId, containerEl, cardMatchesListId, index, clubeId, userId, investmentTimestamp, invDocId) {
    const embedUrl = 'https://footystats.org/api/club?id=' + footystatsId;
    let html = await fetchFootyStatsHtmlWithCloudflareCheck(footystatsId);

    if (html) {
        const matches = extractMatchesFromEmbedHtml(html);
        displayExtractedMatchesInCard(matches, cardMatchesListId);
        if (index !== undefined) {
            renderFinancialWidgetForClub(matches, index, false);
        }
        if (userId && clubeId) {
            await syncMatchesToFirestoreInvestmentHistory(db, userId, clubeId, invDocId, matches, investmentTimestamp, parseMatchDateStringToTimestamp);
        }
    }

    if (index !== undefined && invDocId) {
        await renderRecordedHistoryFromFirestore(db, invDocId, index);
    }

    return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.height = "100%";
        iframe.width = "100%";
        iframe.style.cssText = "height:420px; width:100%; border:none; background:#ffffff;";
        iframe.setAttribute('frameborder', '0');

        let resolved = false;
        const finish = () => {
            if (!resolved) {
                resolved = true;
                resolve();
            }
        };

        iframe.onload = finish;
        setTimeout(finish, 3500);

        if (html) {
            const baseTag = '<base href="https://footystats.org/">';
            const customStyle = '<style>' +
                '#overall, #goals, #players { display: none !important; }' +
                '#matches { display: block !important; }' +
                'ul.menu li a.embed-toggle { color: #909FB4 !important; border-bottom: none !important; }' +
                'ul.menu li a.embed-toggle[data-pane="matches"] { color: #0066c0 !important; border-bottom: 2px solid #0066c0 !important; font-weight: bold !important; }' +
                '</style>';

            const customScript = '<script>' +
                'window.addEventListener("load", function() {' +
                '  var m = document.getElementById("matches");' +
                '  var o = document.getElementById("overall");' +
                '  if (m) m.style.setProperty("display", "block", "important");' +
                '  if (o) o.style.setProperty("display", "none", "important");' +
                '});' +
                '</s' + 'cript>';

            const tagHeadClose = '</h' + 'ead>';
            const tagBodyClose = '</b' + 'ody>';

            if (html.indexOf(tagHeadClose) !== -1) {
                html = html.replace(tagHeadClose, baseTag + customStyle + tagHeadClose);
            } else {
                html = baseTag + customStyle + html;
            }

            if (html.indexOf(tagBodyClose) !== -1) {
                html = html.replace(tagBodyClose, customScript + tagBodyClose);
            } else {
                html = html + customScript;
            }

            containerEl.innerHTML = '';
            iframe.srcdoc = html;
            containerEl.appendChild(iframe);
        } else {
            containerEl.innerHTML = '';
            iframe.setAttribute('src', embedUrl);
            containerEl.appendChild(iframe);
        }
    });
}

export async function renderMyClubsSection(db, myClubs, grid, paginationContainer, userInvestmentMap, userInvestmentDocIdMap, userId, limitPorPessoa, myInvestmentsPage, onPageChange, openModalCallback, onRemoveCallback) {
    grid.innerHTML = '';
    if (myClubs.length === 0) {
        grid.innerHTML = `
            <div class="no-investments" style="grid-column: 1 / -1; text-align: center; padding: 30px; background: rgba(15, 23, 42, 0.6); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05);">
                <i class="fas fa-hand-pointer" style="font-size: 32px; color: #38bdf8; margin-bottom: 10px;"></i>
                <p style="color: #f8fafc; font-size: 15px; font-weight: 600; margin: 0;">Ainda não adicionaste nenhuma equipa aos teus investimentos.</p>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 4px;">Escolhe uma equipa da lista de disponíveis abaixo para adicionar (Limite máximo: ${limitPorPessoa}).</p>
            </div>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(myClubs.length / PAGE_SIZE) || 1;
    let page = myInvestmentsPage;
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;

    const clubReturnsMap = {};
    if (userId) {
        try {
            const movQuery = query(
                collection(db, 'movimentos'),
                where('userId', '==', userId),
                where('estado', '==', 'Investimentos Paid')
            );
            const movSnap = await getDocs(movQuery);
            movSnap.forEach(d => {
                const data = d.data();
                if (data.clubeId) {
                    clubReturnsMap[data.clubeId] = (clubReturnsMap[data.clubeId] || 0) + (data.valorreal || 0);
                }
            });
        } catch (e) {
            console.warn("Erro ao obter movimentos por clube:", e);
        }
    }

    const pagedClubs = myClubs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    for (let i = 0; i < pagedClubs.length; i++) {
        const clube = pagedClubs[i];
        const clubTotal = clubReturnsMap[clube.id] || 0;
        let badgeHtml = '';

        if (clubTotal > 0) {
            badgeHtml = `
                <div title="Total de ɱ-₲₵ gerados por esta equipa" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 12px; font-size: 12px; font-weight: 700; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: #10b981;">
                    <i class="fas fa-arrow-up" style="font-size: 11px;"></i> +${clubTotal} ɱ-₲₵
                </div>
            `;
        } else if (clubTotal < 0) {
            badgeHtml = `
                <div title="Total de ɱ-₲₵ gerados por esta equipa" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 12px; font-size: 12px; font-weight: 700; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); color: #ef4444;">
                    <i class="fas fa-arrow-down" style="font-size: 11px;"></i> ${clubTotal} ɱ-₲₵
                </div>
            `;
        } else {
            badgeHtml = `
                <div title="Total de ɱ-₲₵ gerados por esta equipa" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 12px; font-size: 12px; font-weight: 700; background: rgba(148, 163, 184, 0.15); border: 1px solid rgba(148, 163, 184, 0.3); color: #94a3b8;">
                    <i class="fas fa-minus" style="font-size: 10px;"></i> 0 ɱ-₲₵
                </div>
            `;
        }

        const footystatsId = getClubFootystatsId(clube);
        
        const card = document.createElement('div');
        const gradClass = `card-grad-${i % 6}`;
        card.className = `investment-card ${gradClass}`;

        const embedContainerId = `my-footystats-embed-${i}`;
        const cardMatchesListId = `my-card-matches-${i}`;
        const formId = `my-form-${i}`;
        const chartId = `my-chart-container-${i}`;
        const trendValId = `my-trend-val-${i}`;

        const clubArenaStr = clube.resolvedArena || (clube.investimentos && clube.investimentos[0] && clube.investimentos[0].arena) || null;

        card.innerHTML = `
            <div class="card-header">
                <img src="${clube.imagem || ''}" alt="${clube.nome || ''}" class="club-emblem">
                <div class="club-title-info">
                    <h2 class="club-name">${clube.nome || ''}</h2>
                    <div class="club-meta">
                        ${clube.pais ? `<span><i class="fas fa-globe"></i> ${clube.pais}</span>` : ''}
                        ${clube.genero ? `<span><i class="fas fa-venus-mars"></i> ${clube.genero}</span>` : ''}
                        ${clubArenaStr ? `<span><i class="fas fa-chess-rook" style="color: #38bdf8;"></i> ${clubArenaStr}</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- BADGE DE RENDIMENTO TOTAL DO CLUBE -->
            <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Lucro / Perda Época</span>
                ${badgeHtml}
            </div>

            <!-- ÚLTIMOS RESULTADOS (W, D, L) -->
            <div style="margin-top: 4px; padding: 10px 12px; background: rgba(15, 23, 42, 0.4); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Últimos Resultados</span>
                <div id="${formId}" style="display: flex; gap: 4px;">
                    <span style="color: #64748b; font-size: 11px;">${footystatsId ? 'A carregar...' : 'N/D'}</span>
                </div>
            </div>

            <!-- GRÁFICO FINANCEIRO DE RENDIMENTO -->
            <div style="margin-top: 12px; padding: 12px; background: rgba(15, 23, 42, 0.5); border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.06);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
                        <i class="fas fa-chart-line" style="color: #10b981;"></i> Rendimento Estimado
                    </span>
                    <span id="${trendValId}" style="font-size: 11px; font-weight: 700; color: #94a3b8; background: rgba(148, 163, 184, 0.15); padding: 2px 7px; border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.3);">
                        ${footystatsId ? '...' : 'N/D'}
                    </span>
                </div>
                <div id="${chartId}">
                    <div style="color: #64748b; font-size: 11px; text-align: center; padding: 10px 0;">${footystatsId ? 'A carregar cotação...' : 'Sem dados de cotação'}</div>
                </div>
            </div>

            <!-- NAVEGAÇÃO DE ABAS DO CARD DA EQUIPA -->
            <div style="display: flex; background: rgba(15, 23, 42, 0.6); border-radius: 10px; padding: 3px; margin-top: 14px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.05);">
                <button class="card-tab-btn active" data-tab-pane="matches-${i}" style="flex: 1; padding: 6px; font-size: 11px; font-weight: 700; border: none; border-radius: 8px; background: #2176ff; color: #ffffff; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <i class="fas fa-futbol" style="font-size: 10px;"></i> Jogos (Ativo)
                </button>
                <button class="card-tab-btn" data-tab-pane="history-${i}" style="flex: 1; padding: 6px; font-size: 11px; font-weight: 700; border: none; border-radius: 8px; background: transparent; color: #94a3b8; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <i class="fas fa-history" style="font-size: 10px;"></i> Histórico
                </button>
            </div>

            <!-- PAINEL 1: JOGOS (ATIVO) -->
            <div id="tab-pane-matches-${i}" class="card-pane" style="display: block;">
                <div id="${cardMatchesListId}" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
                    <div style="color: #64748b; font-size: 11px; text-align: center; padding: 10px; background: rgba(15, 23, 42, 0.3); border-radius: 6px;">
                        <i class="fas fa-spinner fa-spin" style="margin-right: 4px;"></i> A carregar jogos ativos...
                    </div>
                </div>
            </div>

            <!-- PAINEL 2: HISTÓRICO GRAVADO NO FIRESTORE -->
            <div id="tab-pane-history-${i}" class="card-pane" style="display: none;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Jogos Registados</span>
                    <span id="my-history-count-${i}" style="font-size: 10px; color: #38bdf8; font-weight: 700; background: rgba(56, 189, 248, 0.1); padding: 1px 6px; border-radius: 4px;">0 jogos</span>
                </div>
                <div id="my-history-list-${i}" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; max-height: 180px; overflow-y: auto; scrollbar-width: thin;">
                    <div style="color: #64748b; font-size: 11px; text-align: center; padding: 10px; background: rgba(15, 23, 42, 0.3); border-radius: 6px;">
                        A carregar histórico...
                    </div>
                </div>
            </div>

            <div id="${embedContainerId}" style="display: none;"></div>

            <!-- BOTÃO DE REMOVER INVESTIMENTO -->
            <button class="btn-remove-inv" data-clube-id="${clube.id}" style="width: 100%; margin-top: auto; padding: 10px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; color: #ef4444; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
                <i class="fas fa-trash-alt"></i> Remover dos Meus Investimentos
            </button>
        `;
        grid.appendChild(card);

        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-remove-inv') || e.target.closest('.card-tab-btn')) return;
            openModalCallback(clube);
        });

        const containerEl = document.getElementById(embedContainerId);
        if (containerEl && footystatsId) {
            const invTimestamp = userInvestmentMap[clube.id] || 0;
            const invDocId = userInvestmentDocIdMap[clube.id] || `${userId}_${clube.id}`;
            await renderMatchesTabEmbed(db, footystatsId, containerEl, cardMatchesListId, i, clube.id, userId, invTimestamp, invDocId);
        }
    }

    // Associar handlers de remoção nos cards gerados
    grid.querySelectorAll('.btn-remove-inv').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const clubeId = e.currentTarget.dataset.clubeId;
            if (clubeId) {
                btn.disabled = true;
                btn.textContent = "A remover...";
                await onRemoveCallback(clubeId);
            }
        });
    });

    // Associar handlers de abas internas nos cards gerados
    grid.querySelectorAll('.card-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetPaneId = e.currentTarget.dataset.tabPane;
            const cardEl = e.currentTarget.closest('.investment-card');
            if (!cardEl || !targetPaneId) return;

            cardEl.querySelectorAll('.card-tab-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = '#94a3b8';
            });

            e.currentTarget.classList.add('active');
            e.currentTarget.style.background = '#2176ff';
            e.currentTarget.style.color = '#ffffff';

            cardEl.querySelectorAll('.card-pane').forEach(pane => {
                pane.style.display = 'none';
            });

            const activePane = cardEl.querySelector('#tab-pane-' + targetPaneId);
            if (activePane) activePane.style.display = 'block';
        });
    });

    renderPaginationControls(paginationContainer, page, totalPages, myClubs.length, (newPage) => {
        onPageChange(newPage);
    });
}

export async function renderAvailableClubsSection(availableClubs, availableGrid, availablePagination, userArenaIndex, userId, limitPorPessoa, userChosenIds, userArenaName, availableTeamsPage, onPageChange, openModalCallback, onAddCallback) {
    availableGrid.innerHTML = '';
    if (availableClubs.length === 0) {
        availableGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 24px; background: rgba(15, 23, 42, 0.4); border-radius: 12px; color: #94a3b8; font-size: 13px;">
                Não existem outras equipas disponíveis para adicionar nesta arena de momento.
            </div>
        `;
        if (availablePagination) availablePagination.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(availableClubs.length / PAGE_SIZE) || 1;
    let page = availableTeamsPage;
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;

    const pagedClubs = availableClubs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const availablePromises = [];
    for (let i = 0; i < pagedClubs.length; i++) {
        const clube = pagedClubs[i];
        const footystatsId = getClubFootystatsId(clube);

        const card = document.createElement('div');
        card.className = `investment-card card-grad-${(i + 2) % 6}`;
        card.style.position = 'relative';

        const availEmbedContainerId = `avail-footystats-embed-${i}`;
        const availFormId = `avail-form-${i}`;
        const availChartId = `avail-chart-container-${i}`;
        const availTrendValId = `avail-trend-val-${i}`;

        const clubArenaStr = clube.resolvedArena || (clube.investimentos && clube.investimentos[0] && clube.investimentos[0].arena) || null;

        card.innerHTML = `
            <div class="card-header">
                <img src="${clube.imagem || ''}" alt="${clube.nome || ''}" class="club-emblem">
                <div class="club-title-info">
                    <h2 class="club-name">${clube.nome || ''}</h2>
                    <div class="club-meta">
                        ${clube.pais ? `<span><i class="fas fa-globe"></i> ${clube.pais}</span>` : ''}
                        ${clube.genero ? `<span><i class="fas fa-venus-mars"></i> ${clube.genero}</span>` : ''}
                        ${clubArenaStr ? `<span><i class="fas fa-chess-rook" style="color: #38bdf8;"></i> ${clubArenaStr}</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- ÚLTIMOS RESULTADOS (W, D, L) -->
            <div style="margin-top: 12px; padding: 10px 12px; background: rgba(15, 23, 42, 0.4); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Últimos Resultados</span>
                <div id="${availFormId}" style="display: flex; gap: 4px;">
                    <span style="color: #64748b; font-size: 11px;">${footystatsId ? 'A carregar...' : 'N/D'}</span>
                </div>
            </div>

            <!-- GRÁFICO FINANCEIRO DE RENDIMENTO -->
            <div style="margin-top: 12px; padding: 12px; background: rgba(15, 23, 42, 0.5); border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.06);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
                        <i class="fas fa-chart-line" style="color: #10b981;"></i> Rendimento Estimado
                    </span>
                    <span id="${availTrendValId}" style="font-size: 11px; font-weight: 700; color: #94a3b8; background: rgba(148, 163, 184, 0.15); padding: 2px 7px; border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.3);">
                        ${footystatsId ? '...' : 'N/D'}
                    </span>
                </div>
                <div id="${availChartId}">
                    <div style="color: #64748b; font-size: 11px; text-align: center; padding: 10px 0;">${footystatsId ? 'A carregar cotação...' : 'Sem dados de cotação'}</div>
                </div>
            </div>

            <div id="${availEmbedContainerId}" style="display: none;"></div>
        `;
        availableGrid.appendChild(card);

        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-add-inv')) return;
            openModalCallback(clube);
        });

        if (footystatsId) {
            availablePromises.push(
                fetchFootyStatsHtmlWithCloudflareCheck(footystatsId).then(html => {
                    const matches = html ? extractMatchesFromEmbedHtml(html) : [];
                    renderFinancialWidgetForClub(matches, i, true);
                })
            );
        } else {
            renderFinancialWidgetForClub([], i, true);
        }
    }
    await Promise.all(availablePromises);

    renderPaginationControls(availablePagination, page, totalPages, availableClubs.length, (newPage) => {
        onPageChange(newPage);
    });
}
