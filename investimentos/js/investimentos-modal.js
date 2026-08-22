import { 
    canUserAddTeam, 
    fetchFootyStatsHtmlWithCloudflareCheck 
} from './investimentos-service.js';
import { 
    extractMatchesFromEmbedHtml,
    getClubFootystatsId
} from './investimentos-charts.js';
import { 
    displayExtractedMatchesInCard 
} from './investimentos-ui.js';

export async function openTeamDetailModal(clube, userArenaNum, userId, limitPorPessoa, userChosenIds, userArenaName, onAddInvestmentSuccess) {
    const modal = document.getElementById('team-detail-modal');
    const imgEl = document.getElementById('modal-club-img');
    const nameEl = document.getElementById('modal-club-name');
    const metaEl = document.getElementById('modal-club-meta');
    const matchesListEl = document.getElementById('modal-matches-list');
    const actionContainer = document.getElementById('modal-action-container');

    if (!modal) return;

    if (clube.imagem) {
        imgEl.src = clube.imagem;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }
    nameEl.textContent = clube.nome || '';

    let metaHtml = '';
    if (clube.pais) metaHtml += `<span><i class="fas fa-globe"></i> ${clube.pais}</span>`;
    if (clube.genero) metaHtml += `<span><i class="fas fa-venus-mars"></i> ${clube.genero}</span>`;
    const clubArenaStr = (clube.investimentos && clube.investimentos[0] && clube.investimentos[0].arena) || null;
    if (clubArenaStr) metaHtml += `<span><i class="fas fa-chess-rook"></i> ${clubArenaStr}</span>`;
    metaEl.innerHTML = metaHtml;

    matchesListEl.innerHTML = `
        <div style="color: #64748b; font-size: 12px; text-align: center; padding: 16px; background: rgba(15, 23, 42, 0.4); border-radius: 8px;">
            <i class="fas fa-spinner fa-spin" style="margin-right: 6px; color: #38bdf8;"></i> A carregar últimos 5 jogos (Ativo)...
        </div>
    `;

    modal.style.display = 'flex';

    const canAdd = canUserAddTeam(clube, userArenaNum);
    const isAlreadyChosen = userChosenIds.includes(clube.id);

    if (canAdd && !isAlreadyChosen) {
        actionContainer.innerHTML = `
            <button id="modal-add-btn" class="btn-add-inv" data-clube-id="${clube.id}" style="width: 100%; padding: 12px; background: #2176ff; border: none; border-radius: 12px; color: white; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(33, 118, 255, 0.4); transition: transform 0.2s;">
                <i class="fas fa-plus"></i> Adicionar aos Meus Investimentos
            </button>
        `;
        const modalAddBtn = actionContainer.querySelector('#modal-add-btn');
        if (modalAddBtn) {
            modalAddBtn.addEventListener('click', async () => {
                if (userChosenIds.length >= limitPorPessoa) {
                    alert(`Atingiste o limite máximo de ${limitPorPessoa} investimentos por pessoa!`);
                    return;
                }
                modalAddBtn.disabled = true;
                modalAddBtn.textContent = "A adicionar...";
                modal.style.display = 'none';
                await onAddInvestmentSuccess(clube.id);
            });
        }
    } else if (isAlreadyChosen) {
        actionContainer.innerHTML = `
            <div style="text-align: center; color: #10b981; font-size: 12px; font-weight: 700; padding: 10px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px;">
                <i class="fas fa-check-circle" style="margin-right: 6px;"></i> Já tens esta equipa nos teus investimentos ativos.
            </div>
        `;
    } else {
        actionContainer.innerHTML = `
            <div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 10px; background: rgba(255, 255, 255, 0.03); border-radius: 8px;">
                <i class="fas fa-lock" style="color: #f59e0b; margin-right: 6px;"></i> Equipa não disponível para a tua arena atual.
            </div>
        `;
    }

    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
    modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };

    const footystatsId = getClubFootystatsId(clube);

    if (footystatsId) {
        const html = await fetchFootyStatsHtmlWithCloudflareCheck(footystatsId);
        if (html) {
            const matches = extractMatchesFromEmbedHtml(html);
            displayExtractedMatchesInCard(matches, 'modal-matches-list');
        } else {
            matchesListEl.innerHTML = `<div style="color: #64748b; font-size: 12px; text-align: center; padding: 12px; background: rgba(15, 23, 42, 0.4); border-radius: 8px;">Sem jogos disponíveis no momento.</div>`;
        }
    } else {
        matchesListEl.innerHTML = `<div style="color: #64748b; font-size: 12px; text-align: center; padding: 12px; background: rgba(15, 23, 42, 0.4); border-radius: 8px;">Sem embed de jogos configurado.</div>`;
    }
}
