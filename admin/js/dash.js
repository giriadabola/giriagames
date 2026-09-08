import { adminAuthReady, db } from './auth-guard.js';
import { getConfiguredSeasons } from '../../core/user-season.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const elements = {
    refresh: document.getElementById('refresh-dashboard'),
    status: document.getElementById('dashboard-status'),
    season: document.getElementById('dashboard-season'),
    gamesTotal: document.getElementById('games-total'),
    gamesWithPredictions: document.getElementById('games-with-predictions'),
    gamesWithoutPredictions: document.getElementById('games-without-predictions'),
    usersTotal: document.getElementById('users-total'),
    notificationsEnabled: document.getElementById('notifications-enabled'),
    notificationsDisabled: document.getElementById('notifications-disabled'),
    currentRoundNumber: document.getElementById('current-round-number'),
    currentRoundSummary: document.getElementById('current-round-summary'),
    currentRoundActivePlayers: document.getElementById('current-round-active-players'),
    currentRoundGames: document.getElementById('current-round-games'),
    participantsModal: document.getElementById('participants-modal'),
    participantsModalTitle: document.getElementById('participants-modal-title'),
    participantsModalMeta: document.getElementById('participants-modal-meta'),
    participantsModalSummary: document.getElementById('participants-modal-summary'),
    participantsModalBody: document.getElementById('participants-modal-body'),
    closeParticipantsModal: document.getElementById('close-participants-modal'),
    notificationsModal: document.getElementById('notifications-modal'),
    notificationsModalTitle: document.getElementById('notifications-modal-title'),
    notificationsModalSummary: document.getElementById('notifications-modal-summary'),
    notificationsModalBody: document.getElementById('notifications-modal-body'),
    closeNotificationsModal: document.getElementById('close-notifications-modal'),
    latestAccessBody: document.getElementById('latest-access-body')
};

const dashboardState = {
    activeUsers: []
};

function normalizeSeason(value) {
    return String(value || '').replaceAll('/', '').trim();
}

function isSameSeason(firstSeason, secondSeason) {
    return normalizeSeason(firstSeason) === normalizeSeason(secondSeason);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function formatDate(value, fallback = 'Sem data') {
    const date = toDate(value);
    if (!date) return fallback;
    return new Intl.DateTimeFormat('pt-PT', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(date);
}

function getUserName(user) {
    return user.nometabela || user.nomeDeUsuario || user.email || 'Utilizador sem nome';
}

function isYes(value) {
    return String(value || '').trim().toLowerCase() === 'yes';
}

function isNo(value) {
    return String(value || '').trim().toLowerCase() === 'no';
}

function isActivePlayer(user) {
    const role = String(user.estatuto || '').trim().toLowerCase();
    return isYes(user.aceite) && isNo(user.out) && role !== 'ruler';
}

function getNotificationSettings(user) {
    const settings = user.notificacoesMercado || {};
    const subscriptions = Array.isArray(settings.pushSubscriptions) ? settings.pushSubscriptions : [];
    return {
        enabled: settings.pushEnabled === true && subscriptions.length > 0,
        deviceCount: subscriptions.length
    };
}

function renderEmptyRow(colspan, message) {
    return `<tr><td class="empty-row" colspan="${colspan}">${escapeHtml(message)}</td></tr>`;
}

function renderLatestAccessRows(users) {
    const usersWithAccess = users
        .map((user) => ({ user, date: toDate(user.ultimoacesso) }))
        .filter(({ date }) => date)
        .sort((a, b) => b.date - a.date)
        .slice(0, 20);

    if (usersWithAccess.length === 0) return renderEmptyRow(2, 'Ainda não existem acessos registados.');

    return usersWithAccess.map(({ user, date }) => `<tr>
        <td>${escapeHtml(getUserName(user))}</td>
        <td>${escapeHtml(formatDate(date))}</td>
    </tr>`).join('');
}

function getCurrentRound(games) {
    const now = new Date();
    const gamesInDispute = games.filter((game) => {
        const start = toDate(game.inicioIntervalo);
        const end = toDate(game.fimIntervalo);
        return start && end && now >= start && now <= end;
    });

    if (gamesInDispute.length === 0) return { round: null, games: [] };

    const roundValues = [...new Set(gamesInDispute.map((game) => Number(game.ronda)).filter(Number.isFinite))]
        .sort((first, second) => first - second);
    const currentRound = roundValues[0];
    const currentRoundGames = gamesInDispute
        .filter((game) => Number(game.ronda) === currentRound)
        .sort((first, second) => (toDate(first.dataJogo)?.getTime() || Number.POSITIVE_INFINITY) - (toDate(second.dataJogo)?.getTime() || Number.POSITIVE_INFINITY));

    return { round: currentRound, games: currentRoundGames };
}

function getGameParticipants(game, predictions, activeUsers) {
    const predictedUserIds = new Set(predictions
        .filter((prediction) => prediction.jogoId === game.id && prediction.userId)
        .map((prediction) => prediction.userId));

    return activeUsers
        .map((user) => ({ user, hasVoted: predictedUserIds.has(user.id) }))
        .sort((first, second) => getUserName(first.user).localeCompare(getUserName(second.user), 'pt-PT'));
}

function closeParticipantsModal() {
    elements.participantsModal.hidden = true;
    document.body.classList.remove('modal-open');
}

function closeNotificationsModal() {
    elements.notificationsModal.hidden = true;
    document.body.classList.remove('modal-open');
}

function openNotificationsModal(filter) {
    const isEnabled = filter === 'enabled';
    const label = isEnabled ? 'ligadas' : 'desligadas';
    const users = dashboardState.activeUsers
        .filter((user) => getNotificationSettings(user).enabled === isEnabled)
        .sort((first, second) => getUserName(first).localeCompare(getUserName(second), 'pt-PT'));

    elements.notificationsModalTitle.textContent = `Notificações ${label}`;
    elements.notificationsModalSummary.textContent = `${users.length} jogador(es) activo(s) com notificações ${label}.`;
    elements.notificationsModalBody.innerHTML = users.length === 0
        ? renderEmptyRow(4, `Não existem jogadores activos com notificações ${label}.`)
        : users.map((user) => {
            const settings = getNotificationSettings(user);
            return `<tr>
                <td><span class="game-name">${escapeHtml(getUserName(user))}</span></td>
                <td class="muted">${escapeHtml(user.email || 'Sem email')}</td>
                <td><span class="notification-badge ${settings.enabled ? 'is-on' : 'is-off'}">${settings.enabled ? 'Ligadas' : 'Desligadas'}</span></td>
                <td>${settings.deviceCount}</td>
            </tr>`;
        }).join('');

    elements.notificationsModal.hidden = false;
    document.body.classList.add('modal-open');
    elements.closeNotificationsModal.focus();
}

function openParticipantsModal(game, predictions, activeUsers) {
    const gameName = game.nomeJogo || `${game.equipaCasa || 'Equipa A'} vs ${game.equipaFora || 'Equipa B'}`;
    const participants = getGameParticipants(game, predictions, activeUsers);
    const votedCount = participants.filter(({ hasVoted }) => hasVoted).length;

    elements.participantsModalTitle.textContent = gameName;
    elements.participantsModalMeta.textContent = `${game.competicao || 'Competição desconhecida'} · ${formatDate(game.dataJogo)} · Ronda ${game.ronda ?? '—'}`;
    elements.participantsModalSummary.textContent = `${votedCount} de ${participants.length} jogador(es) activo(s) já palpitaram neste jogo.`;
    elements.participantsModalBody.innerHTML = participants.length === 0
        ? renderEmptyRow(3, 'Não existem participantes activos nesta temporada.')
        : participants.map(({ user, hasVoted }) => `<tr>
            <td><span class="game-name">${escapeHtml(getUserName(user))}</span></td>
            <td class="muted">${escapeHtml(user.email || 'Sem email')}</td>
            <td><span class="participant-status ${hasVoted ? 'is-voted' : 'is-pending'}">${hasVoted ? 'Já palpitou' : 'Ainda não palpitou'}</span></td>
        </tr>`).join('');

    elements.participantsModal.hidden = false;
    document.body.classList.add('modal-open');
    elements.closeParticipantsModal.focus();
}

function bindCurrentRoundCards(currentRoundGames, predictions, activeUsers) {
    currentRoundGames.forEach((game) => {
        const card = [...elements.currentRoundGames.querySelectorAll('[data-game-id]')]
            .find((candidate) => candidate.dataset.gameId === game.id);
        if (!card) return;

        const showParticipants = () => openParticipantsModal(game, predictions, activeUsers);
        card.addEventListener('click', showParticipants);
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                showParticipants();
            }
        });
    });
}

function renderCurrentRound(games, predictions, activeUsers) {
    const { round, games: currentRoundGames } = getCurrentRound(games);
    const activeUserIds = new Set(activeUsers.map((user) => user.id));

    elements.currentRoundNumber.textContent = round ?? '—';
    elements.currentRoundActivePlayers.textContent = `Total de jogadores activos: ${activeUsers.length}`;

    if (round === null) {
        elements.currentRoundSummary.textContent = 'Nenhuma ronda em disputa neste momento';
        elements.currentRoundGames.innerHTML = '<div class="round-empty">Não existem jogos dentro do intervalo de palpites neste momento.</div>';
        return;
    }

    elements.currentRoundSummary.textContent = `${currentRoundGames.length} jogo(s) em disputa`;
    elements.currentRoundGames.innerHTML = currentRoundGames.map((game) => {
        const predictedUserIds = new Set(predictions
            .filter((prediction) => prediction.jogoId === game.id && activeUserIds.has(prediction.userId))
            .map((prediction) => prediction.userId));
        const predictedCount = predictedUserIds.size;
        const percentage = activeUsers.length > 0
            ? Math.min(100, Math.round((predictedCount / activeUsers.length) * 100))
            : 0;
        const missingCount = Math.max(0, activeUsers.length - predictedCount);
        const gameName = game.nomeJogo || `${game.equipaCasa || 'Equipa A'} vs ${game.equipaFora || 'Equipa B'}`;
        const meta = `${escapeHtml(game.competicao || 'Competição desconhecida')} · ${escapeHtml(formatDate(game.dataJogo))}`;
        const status = missingCount === 0 && activeUsers.length > 0
            ? '<span class="round-game-status is-complete">Todos os jogadores activos já palpitaram.</span>'
            : `<span class="round-game-status">Ainda faltam ${missingCount} jogador(es) activo(s).</span>`;

        return `<article class="current-round-game-card" data-game-id="${escapeHtml(game.id)}" role="button" tabindex="0" aria-label="Ver participantes de ${escapeHtml(gameName)}">
            <div class="current-round-game-header">
                <div><div class="round-game-name">${escapeHtml(gameName)}</div><span class="round-game-meta">${meta}</span></div>
                <span class="round-game-round">Ronda ${escapeHtml(game.ronda ?? round)}</span>
            </div>
            <div class="round-game-progress" aria-label="${predictedCount} de ${activeUsers.length} jogadores activos já palpitaram">
                <div class="progress-track"><div class="progress-fill" style="width: ${percentage}%"></div></div>
                <span class="progress-value">${predictedCount}/${activeUsers.length}</span>
            </div>
            ${status}
        </article>`;
    }).join('');
    bindCurrentRoundCards(currentRoundGames, predictions, activeUsers);
}

async function loadDashboard() {
    elements.refresh.disabled = true;
    elements.status.className = 'dashboard-status';
    elements.status.textContent = 'A carregar dados...';

    try {
        const configuredSeasons = await getConfiguredSeasons(db);
        const latestSeason = configuredSeasons[0] || '';
        if (!latestSeason) {
            throw new Error('A temporada mais recente não está configurada em settings/temporadas.');
        }

        const [gamesSnapshot, predictionsSnapshot, usersSnapshot] = await Promise.all([
            getDocs(collection(db, 'jogos')),
            getDocs(collection(db, 'palpites')),
            getDocs(collection(db, 'users'))
        ]);

        const games = gamesSnapshot.docs
            .map((gameDoc) => ({ id: gameDoc.id, ...gameDoc.data() }))
            .filter((game) => isSameSeason(game.temporada, latestSeason));
        const predictions = predictionsSnapshot.docs
            .map((predictionDoc) => predictionDoc.data())
            .filter((prediction) => isSameSeason(prediction.temporada, latestSeason));
        const users = usersSnapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }));
        const activeUsers = users.filter(isActivePlayer);
        dashboardState.activeUsers = activeUsers;

        const predictionCounts = predictions.reduce((counts, prediction) => {
            if (prediction.jogoId) {
                counts.set(prediction.jogoId, (counts.get(prediction.jogoId) || 0) + 1);
            }
            return counts;
        }, new Map());

        const notificationSummary = activeUsers.reduce((summary, user) => {
            if (getNotificationSettings(user).enabled) summary.enabled += 1;
            else summary.disabled += 1;
            return summary;
        }, { enabled: 0, disabled: 0 });

        elements.gamesTotal.textContent = games.length;
        elements.gamesWithPredictions.textContent = games.filter((game) => predictionCounts.has(game.id)).length;
        elements.gamesWithoutPredictions.textContent = games.filter((game) => !predictionCounts.has(game.id)).length;
        elements.usersTotal.textContent = activeUsers.length;
        elements.notificationsEnabled.textContent = notificationSummary.enabled;
        elements.notificationsDisabled.textContent = notificationSummary.disabled;
        elements.season.textContent = `Temporada ativa: ${latestSeason}`;
        renderCurrentRound(games, predictions, activeUsers);
        elements.latestAccessBody.innerHTML = renderLatestAccessRows(users);

        elements.status.className = 'dashboard-status is-ok';
        elements.status.textContent = `Atualizado em ${formatDate(new Date())}.`;
    } catch (error) {
        console.error('Erro ao carregar o dashboard:', error);
        elements.status.className = 'dashboard-status is-error';
        elements.season.textContent = 'Temporada: indisponível';
        elements.status.textContent = error.message || 'Não foi possível carregar os dados. Atualize a página e tente novamente.';
        elements.currentRoundNumber.textContent = '—';
        elements.currentRoundSummary.textContent = 'Não foi possível verificar a ronda';
        elements.currentRoundActivePlayers.textContent = 'Não foi possível calcular os jogadores activos.';
        elements.currentRoundGames.innerHTML = '<div class="round-empty">Erro ao carregar os jogos da ronda.</div>';
        elements.latestAccessBody.innerHTML = renderEmptyRow(2, 'Erro ao carregar os acessos.');
    } finally {
        elements.refresh.disabled = false;
    }
}

elements.refresh.addEventListener('click', loadDashboard);
elements.closeParticipantsModal.addEventListener('click', closeParticipantsModal);
elements.closeNotificationsModal.addEventListener('click', closeNotificationsModal);
elements.participantsModal.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-participants-modal]')) closeParticipantsModal();
});
elements.notificationsModal.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-notifications-modal]')) closeNotificationsModal();
});
document.addEventListener('click', (event) => {
    const card = event.target.closest('[data-notification-filter]');
    if (card) openNotificationsModal(card.dataset.notificationFilter);
});
document.addEventListener('keydown', (event) => {
    const card = event.target.closest?.('[data-notification-filter]');
    if (card && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        openNotificationsModal(card.dataset.notificationFilter);
        return;
    }
    if (event.key === 'Escape') {
        if (!elements.participantsModal.hidden) closeParticipantsModal();
        if (!elements.notificationsModal.hidden) closeNotificationsModal();
    }
});
adminAuthReady.then(loadDashboard).catch((error) => {
    console.error('Erro ao confirmar o acesso ao dashboard:', error);
});
