import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { fetchFootyStatsHtmlWithCloudflareCheck } from './investimentos-service.js';
import { extractMatchesFromEmbedHtml } from './investimentos-charts.js';

export async function renderMarketTicker(db, allClubs, userArenaName, userArenaNum, userChosenIds, userId, limitPorPessoa, openModalCallback, onAddCallback) {
    const trackEl = document.getElementById('ticker-track');
    if (!trackEl) return;

    const userArenaIndex = typeof userArenaNum === 'number' && userArenaNum > 0 
        ? userArenaNum 
        : (parseInt(String(userArenaName || 'Arena 1').replace(/\D/g, '')) || 1);

    let startArenaNum = 1;
    try {
        const arenaDocSnap = await getDoc(doc(db, 'paineis', 'paineis arena'));
        if (arenaDocSnap.exists()) {
            const arenaData = arenaDocSnap.data();
            Object.keys(arenaData).forEach(key => {
                if (arenaData[key] && arenaData[key].start === true) {
                    const num = parseInt(String(key).replace(/\D/g, '')) || 1;
                    if (num > 0) startArenaNum = num;
                }
            });
        }
    } catch(e) {
        console.warn("Erro ao obter start arena em paineis arena:", e);
    }

    const activeClubs = allClubs.filter(clube => {
        const arenaStr = clube.resolvedArena || (clube.investimentos && clube.investimentos[0] && clube.investimentos[0].arena);
        if (arenaStr === null || arenaStr === undefined || String(arenaStr).trim() === '') return false;
        
        const clubArenaNum = parseInt(String(arenaStr).replace(/\D/g, '')) || 0;
        if (startArenaNum > 1 && clubArenaNum < startArenaNum) return false;

        return true;
    });

    if (activeClubs.length === 0) {
        trackEl.innerHTML = `<div style="color: #64748b; font-size: 11px; padding: 6px;">Sem cotações ativas disponíveis no mercado.</div>`;
        return;
    }

    const shuffled = [...activeClubs].sort(() => 0.5 - Math.random());
    const selectedClubs = shuffled.slice(0, 15);

    let cardsHtml = '';
    selectedClubs.forEach((clube, idx) => {
        const arena = clube.resolvedArena || (clube.investimentos && clube.investimentos[0] && clube.investimentos[0].arena) || 'Arena Geral';
        const clubArenaNum = arena !== 'Arena Geral' ? (parseInt(arena.replace(/\D/g, '')) || 1) : 1;
        const isSameOrLowerArena = arena === 'Arena Geral' || clubArenaNum <= userArenaIndex;
        const isChosen = userChosenIds.includes(clube.id);

        let addBtnHtml = '';
        if (isSameOrLowerArena && !isChosen && userId) {
            addBtnHtml = `
                <button class="ticker-add-btn btn-add-inv" data-clube-id="${clube.id}" title="Adicionar aos Meus Investimentos">
                    <i class="fas fa-plus"></i>
                </button>
            `;
        }

        cardsHtml += `
            <div class="ticker-card">
                ${addBtnHtml}
                <div class="ticker-card-header">
                    <img src="${clube.imagem || ''}" alt="${clube.nome || ''}" class="ticker-club-img">
                    <div class="ticker-club-info">
                        <span class="ticker-club-name">${clube.nome}</span>
                        <span class="ticker-club-arena"><i class="fas fa-chess-rook"></i> ${arena}</span>
                    </div>
                </div>
                <div class="ticker-card-stats">
                    <div id="ticker-chart-${idx}" style="flex: 1; height: 18px; margin-right: 6px;">
                        <svg viewBox="0 0 100 20" style="width: 100%; height: 18px; overflow: visible;">
                            <path d="M 0 15 L 25 12 L 50 14 L 75 8 L 100 5" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <span id="ticker-val-${idx}" style="font-size: 10px; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.15); padding: 1px 5px; border-radius: 4px;">+0.0%</span>
                </div>
            </div>
        `;
    });

    trackEl.innerHTML = cardsHtml + cardsHtml;

    trackEl.querySelectorAll('.ticker-card').forEach((tickerCard, idx) => {
        tickerCard.style.cursor = 'pointer';
        tickerCard.addEventListener('click', (e) => {
            if (e.target.closest('.btn-add-inv')) return;
            const selectedClub = selectedClubs[idx % selectedClubs.length];
            if (selectedClub) {
                openModalCallback(selectedClub);
            }
        });
    });

    trackEl.querySelectorAll('.btn-add-inv').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const clubeId = e.currentTarget.dataset.clubeId;
            if (clubeId && userId) {
                btn.disabled = true;
                await onAddCallback(clubeId);
            }
        });
    });

    const tickerPromises = selectedClubs.map(async (clube, idx) => {
        const rawEmbed = clube.investimentoembed;
        let footystatsId = '';
        if (rawEmbed) {
            const idMatch = String(rawEmbed).match(/id=(\d+)/i);
            if (idMatch && idMatch[1]) {
                footystatsId = idMatch[1];
            } else if (/^\d+$/.test(String(rawEmbed).trim())) {
                footystatsId = String(rawEmbed).trim();
            }
        }
        if (!footystatsId) return;

        let html = await fetchFootyStatsHtmlWithCloudflareCheck(footystatsId);

        if (html) {
            const matches = extractMatchesFromEmbedHtml(html);
            if (matches && matches.length > 0) {
                const chronoMatches = matches.slice(0, 5).reverse();
                const weights = [1.0, 1.5, 2.0, 2.5, 3.5];
                let weightedScore = 0;
                const yPoints = [];
                let currentY = 12;

                chronoMatches.forEach((m, idx) => {
                    const b = (m.resultBadge || 'd').toUpperCase();
                    const w = weights[idx] || 1;
                    if (b === 'W') {
                        weightedScore += 3 * w;
                        currentY -= 3;
                    } else if (b === 'D') {
                        weightedScore += 0.5 * w;
                        currentY += 1;
                    } else {
                        weightedScore -= 2 * w;
                        currentY += 3;
                    }
                    currentY = Math.max(2, Math.min(18, currentY));
                    yPoints.push(currentY);
                });

                const latestChar = (chronoMatches[chronoMatches.length - 1]?.resultBadge || 'd').toUpperCase();
                const percentVal = (weightedScore / 31.5 * 25).toFixed(1);

                let statusState = 'yellow';
                if (weightedScore >= 9.0 && (latestChar === 'W' || chronoMatches.filter(m => (m.resultBadge||'').toUpperCase() === 'W').length >= 3)) {
                    statusState = 'green';
                } else if (weightedScore <= -1.0 || (latestChar === 'L' && weightedScore < 6.0)) {
                    statusState = 'red';
                } else {
                    statusState = 'yellow';
                }

                let strokeColor = '#f59e0b';
                let statusBg = 'rgba(245, 158, 11, 0.15)';

                if (statusState === 'green') {
                    strokeColor = '#10b981';
                    statusBg = 'rgba(16, 185, 129, 0.15)';
                } else if (statusState === 'red') {
                    strokeColor = '#ef4444';
                    statusBg = 'rgba(239, 68, 68, 0.15)';
                }

                const sign = percentVal > 0 ? '+' : '';

                trackEl.querySelectorAll(`#ticker-val-${idx}`).forEach(valEl => {
                    valEl.textContent = `${sign}${percentVal}%`;
                    valEl.style.color = strokeColor;
                    valEl.style.background = statusBg;
                });

                const xStep = 100 / (yPoints.length - 1);
                let pathD = `M 0 ${yPoints[0]}`;
                for (let k = 1; k < yPoints.length; k++) {
                    pathD += ` L ${Math.round(k * xStep)} ${yPoints[k]}`;
                }

                trackEl.querySelectorAll(`#ticker-chart-${idx}`).forEach(chartEl => {
                    chartEl.innerHTML = `
                        <svg viewBox="0 0 100 20" style="width: 100%; height: 18px; overflow: visible;">
                            <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    `;
                });
            }
        }
    });
    await Promise.all(tickerPromises);
}
