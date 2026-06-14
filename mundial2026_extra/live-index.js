(() => {
  const HOST_CLASS = 'match-live-inline-host';
  const CARD_CLASS = 'match-live-inline';
  const CONTAINER_SELECTOR = '#matchesContainer';
  let observer = null;
  let refreshQueued = false;
  let syncStarted = false;

  function safeHtml(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function hasScore(source) {
    return !!source && source.homeGoals != null && source.awayGoals != null;
  }

  function scorerText(value) {
    if (!value) return '';
    if (Array.isArray(value)) {
      return value
        .map(item => typeof item === 'string' ? item : (item?.name || item?.player || item?.scorer || ''))
        .filter(Boolean)
        .join(', ');
    }
    return typeof value === 'string' ? value : '';
  }

  function getMatchById(matchId) {
    return data?.matches?.find(match => String(match.id) === String(matchId)) || null;
  }

  function getOfficialState(matchId) {
    return officialResults?.[String(matchId)] || null;
  }

  function getApiState(match) {
    if (!match) return null;
    if (typeof apiMatchForLocal === 'function') return apiMatchForLocal(match);
    return (worldCupApi?.games || []).find(game => String(game.id) === String(match.id)) || null;
  }

  function sourceLabel(source) {
    const label = String(source || '').trim();
    if (!label || label === 'api-live') return 'API live';
    return label;
  }

  function pickState(match) {
    const official = getOfficialState(match.id);
    const api = getApiState(match);
    const options = [official, api].filter(Boolean);
    if (!options.length) return null;

    const best = options.sort((a, b) => {
      const aLive = a.live || a._live ? 1 : 0;
      const bLive = b.live || b._live ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;

      const aFinished = a.finished || a._finished ? 1 : 0;
      const bFinished = b.finished || b._finished ? 1 : 0;
      if (aFinished !== bFinished) return bFinished - aFinished;

      const aScore = hasScore(a) ? 1 : 0;
      const bScore = hasScore(b) ? 1 : 0;
      if (aScore !== bScore) return bScore - aScore;

      return String(b.timeElapsed || '').length - String(a.timeElapsed || '').length;
    })[0];

    const live = typeof isOfficialResultLive === 'function'
      ? isOfficialResultLive(official || best)
      : !!(best.live || best._live);
    const finished = typeof isOfficialResultFinished === 'function'
      ? isOfficialResultFinished(official || best)
      : !!(best.finished || best._finished);

    if (!live && !finished && !hasScore(best)) return null;

    return {
      best,
      live,
      finished,
      statusLabel: live
        ? (typeof liveStatusLabel === 'function' ? liveStatusLabel(best.timeElapsed || '') : (best.timeElapsed || 'Ao vivo'))
        : (finished ? 'Terminado' : 'Atualizado'),
      sourceLabel: sourceLabel(best.source || official?.source || api?.source || 'Firebase'),
      homeScorers: scorerText(best.homeScorers || best.home_scorers),
      awayScorers: scorerText(best.awayScorers || best.away_scorers)
    };
  }

  function renderSummary(match) {
    const state = pickState(match);
    if (!state) return '';

    const best = state.best || {};
    const badge = state.live ? 'DIRETO' : 'OFICIAL';
    const scoreHtml = hasScore(best)
      ? `<div class="${CARD_CLASS}__score"><strong>${safeHtml(best.homeTeam || match.home)}</strong><span>${safeHtml(best.homeGoals)} - ${safeHtml(best.awayGoals)}</span><strong>${safeHtml(best.awayTeam || match.away)}</strong></div>`
      : `<div class="${CARD_CLASS}__score is-loading"><strong>${safeHtml(match.home)}</strong><span>A atualizar...</span><strong>${safeHtml(match.away)}</strong></div>`;

    const scorers = [
      state.homeScorers ? `${safeHtml(best.homeTeam || match.home)}: ${safeHtml(state.homeScorers)}` : '',
      state.awayScorers ? `${safeHtml(best.awayTeam || match.away)}: ${safeHtml(state.awayScorers)}` : ''
    ].filter(Boolean).join(' - ');

    return `
      <section class="${CARD_CLASS} ${state.live ? 'is-live' : 'is-finished'}" aria-live="polite">
        <div class="${CARD_CLASS}__meta">
          <span class="${CARD_CLASS}__badge">${badge}</span>
          <strong>${safeHtml(state.statusLabel)}</strong>
          <span>${safeHtml(state.sourceLabel)}</span>
        </div>
        ${scoreHtml}
        ${scorers ? `<div class="${CARD_CLASS}__scorers">${scorers}</div>` : ''}
      </section>
    `;
  }

  function applyLiveCards() {
    if (typeof isVotingClosed === 'function' && isVotingClosed()) return;

    document.querySelectorAll('.match-card[data-match-id]').forEach(card => {
      const matchId = card.getAttribute('data-match-id');
      const match = getMatchById(matchId);
      const teams = card.querySelector('.teams');
      if (!match || !teams) return;

      const html = renderSummary(match);
      let host = teams.querySelector(`.${HOST_CLASS}`);

      if (!html) {
        if (host) host.remove();
        return;
      }

      if (!host) {
        host = document.createElement('div');
        host.className = HOST_CLASS;
        const hint = teams.querySelector('.hint-line');
        if (hint) hint.insertAdjacentElement('beforebegin', host);
        else teams.appendChild(host);
      }

      if (host.innerHTML !== html) host.innerHTML = html;
    });
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      applyLiveCards();
    });
  }

  async function waitForAppReady(timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (document.querySelector(CONTAINER_SELECTOR) && data?.matches?.length) return true;
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    return false;
  }

  function ensureObserver() {
    if (observer) return;
    const container = document.querySelector(CONTAINER_SELECTOR);
    if (!container) return;
    observer = new MutationObserver(() => queueRefresh());
    observer.observe(container, { childList: true, subtree: true });
  }

  async function startOpenLiveSync() {
    if (syncStarted) return;
    if (typeof isVotingClosed === 'function' && isVotingClosed()) return;
    syncStarted = true;

    const ready = await waitForAppReady();
    if (!ready) return;

    ensureObserver();
    queueRefresh();

    try {
      await loadApiWorldCupData({ sync: true });
    } catch (error) {
      console.warn('Nao foi possivel iniciar o live do index.', error);
    }

    queueRefresh();
    if (typeof startLiveApiSync === 'function') startLiveApiSync();
  }

  document.addEventListener('DOMContentLoaded', () => {
    startOpenLiveSync();
    window.addEventListener('ggames-live-updated', queueRefresh);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) queueRefresh();
    });
  });
})();
