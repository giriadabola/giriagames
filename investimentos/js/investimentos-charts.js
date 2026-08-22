export function parseMatchDateStringToTimestamp(dateStr) {
    if (!dateStr) return Date.now();
    try {
        let clean = dateStr.replace(/^[A-Za-z]+,\s*/, '');
        clean = clean.replace(/(\d+)(st|nd|rd|th)/i, '$1');
        const parsedDate = new Date(clean);
        if (!isNaN(parsedDate.getTime())) {
            if (!/\d{4}/.test(clean)) {
                parsedDate.setFullYear(new Date().getFullYear());
            }
            return parsedDate.getTime();
        }
    } catch(e) {}
    return Date.now();
}

export function extractMatchesFromEmbedHtml(html) {
    const matches = [];
    if (!html) return matches;

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const liElements = doc.querySelectorAll('#matches ul.matches li, ul.matches li');

        for (let i = 0; i < liElements.length; i++) {
            const li = liElements[i];
            const linkEl = li.querySelector('a');
            const dateEl = li.querySelector('.date');
            const resultEl = li.querySelector('.result');
            if (!linkEl) continue;

            const matchText = linkEl.textContent.trim();
            const matchDate = dateEl ? dateEl.textContent.trim() : '';
            const resultBadge = resultEl ? resultEl.textContent.trim().toLowerCase() : 'd';
            
            let score = '';
            let opponent = matchText;

            const matchReg = matchText.match(/(\d+-\d+)\s+vs\s+(.+)/i);
            if (matchReg) {
                score = matchReg[1].trim();
                opponent = matchReg[2].trim();
            }

            matches.push({
                date: matchDate,
                score: score,
                opponent: opponent,
                resultBadge: resultBadge
            });
        }
    } catch(e) {
        console.error("Erro ao extrair jogos do HTML:", e);
    }
    return matches;
}

export function calculateTrend(clubeNome, jogos) {
    let score = 0;
    jogos.forEach(jogo => {
        const status = getResultStatus(clubeNome, jogo);
        if (status === 'V') score += 3;
        else if (status === 'E') score += 1;
    });
    
    return {
        points: score,
        isPositive: score >= 7
    };
}

export function getResultStatus(clubeNome, jogo) {
    if (jogo.statusBadge) {
        if (jogo.statusBadge === 'w') return 'V';
        if (jogo.statusBadge === 'd') return 'E';
        if (jogo.statusBadge === 'l') return 'D';
    }
    const parts = jogo.resultado ? jogo.resultado.split('-').map(Number) : [0, 0];
    const g1 = parts[0] || 0;
    const g2 = parts[1] || 0;
    const isHome = (jogo.equipa1 && String(jogo.equipa1).toLowerCase() === String(clubeNome).toLowerCase());
    
    if (g1 === g2) return 'E';
    if (isHome) {
        return g1 > g2 ? 'V' : 'D';
    } else {
        return g2 > g1 ? 'V' : 'D';
    }
}

export function renderFinancialWidgetForClub(matches, index, isAvailable = true) {
    const formContainer = document.getElementById(isAvailable ? `avail-form-${index}` : `my-form-${index}`);
    const chartContainer = document.getElementById(isAvailable ? `avail-chart-container-${index}` : `my-chart-container-${index}`);
    const trendValEl = document.getElementById(isAvailable ? `avail-trend-val-${index}` : `my-trend-val-${index}`);

    if (!matches || matches.length === 0) return;

    const recentMatches = matches.slice(0, 5);
    const chronoMatches = [...recentMatches].reverse();

    if (formContainer) {
        let formHtml = '';
        chronoMatches.forEach(m => {
            const char = (m.resultBadge || 'd').toUpperCase();
            let bg = 'rgba(245, 158, 11, 0.2)';
            let border = 'rgba(245, 158, 11, 0.4)';
            let color = '#f59e0b';

            if (char === 'W') {
                bg = 'rgba(16, 185, 129, 0.2)';
                border = 'rgba(16, 185, 129, 0.4)';
                color = '#10b981';
            } else if (char === 'L') {
                bg = 'rgba(239, 68, 68, 0.2)';
                border = 'rgba(239, 68, 68, 0.4)';
                color = '#ef4444';
            }

            formHtml += `<span style="width: 22px; height: 22px; border-radius: 4px; background: ${bg}; border: 1px solid ${border}; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800;">${char}</span>`;
        });
        formContainer.innerHTML = formHtml;
    }

    const weights = [1.0, 1.5, 2.0, 2.5, 3.5];
    let weightedScore = 0;
    const yPoints = [];
    let currentY = 22;

    chronoMatches.forEach((m, idx) => {
        const char = (m.resultBadge || 'd').toUpperCase();
        const w = weights[idx] || 1;

        if (char === 'W') {
            weightedScore += 3 * w;
            currentY -= 6;
        } else if (char === 'D') {
            weightedScore += 0.5 * w;
            currentY += 2;
        } else {
            weightedScore -= 2 * w;
            currentY += 6;
        }
        currentY = Math.max(6, Math.min(38, currentY));
        yPoints.push(currentY);
    });

    const percentVal = (weightedScore / 31.5 * 25).toFixed(1);
    const latestChar = (chronoMatches[chronoMatches.length - 1]?.resultBadge || 'd').toUpperCase();

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
    let statusBorder = 'rgba(245, 158, 11, 0.3)';

    if (statusState === 'green') {
        strokeColor = '#10b981';
        statusBg = 'rgba(16, 185, 129, 0.15)';
        statusBorder = 'rgba(16, 185, 129, 0.3)';
    } else if (statusState === 'red') {
        strokeColor = '#ef4444';
        statusBg = 'rgba(239, 68, 68, 0.15)';
        statusBorder = 'rgba(239, 68, 68, 0.3)';
    }

    if (trendValEl) {
        const sign = percentVal > 0 ? '+' : '';
        trendValEl.textContent = `${sign}${percentVal}%`;
        trendValEl.style.color = strokeColor;
        trendValEl.style.background = statusBg;
        trendValEl.style.borderColor = statusBorder;
    }

    if (chartContainer && yPoints.length > 0) {
        const gradId = `chartGrad-${isAvailable ? 'avail' : 'my'}-${index}`;
        
        const xStep = 200 / (yPoints.length - 1);
        let pathD = `M 0 ${yPoints[0]}`;
        for (let i = 1; i < yPoints.length; i++) {
            pathD += ` L ${Math.round(i * xStep)} ${yPoints[i]}`;
        }

        const areaD = `${pathD} L 200 45 L 0 45 Z`;
        const lastX = 200;
        const lastY = yPoints[yPoints.length - 1];

        chartContainer.innerHTML = `
            <svg viewBox="0 0 200 45" style="width: 100%; height: 42px; overflow: visible;">
                <defs>
                    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0"/>
                    </linearGradient>
                </defs>
                <path d="${areaD}" fill="url(#${gradId})"/>
                <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="${lastX}" cy="${lastY}" r="3.5" fill="${strokeColor}" stroke="#0f172a" stroke-width="2"/>
            </svg>
        `;
    }
}
