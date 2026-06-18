/* Arranque da app: eventos, exportacao, init e refresh periodico. */
function showFirstMissing(info) {
  if (info.missingName) {
    $('#userName')?.focus();
    alert('Tens de preencher o nome antes de gravar.');
    return;
  }
  const first = info.missingMatches[0];
  if (!first) return;
  state.activeStage = first.stage;
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.stage === first.stage));
  renderMatches();
  requestAnimationFrame(() => {
    const card = document.querySelector(`.match-card[data-match-id="${first.id}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card?.classList.add('invalid');
  });
  alert(`Ainda falta preencher o Jogo ${first.id}.`);
}

async function saveToFirebase() {
  state.name = ($('#userName')?.value || '').trim();
  saveState();

  const info = completionInfo();
  if (!info.complete) {
    showFirstMissing(info);
    updateSaveButton();
    return;
  }
  if (!firestoreDb || !firebaseTools) {
    alert('A gravação ainda não está pronta. Confirma a internet e tenta novamente.');
    return;
  }
  refreshVotingDeadlineState();
  if (isVotingClosed()) {
    alert('As votações já estão encerradas. Agora só é possível ver os prognósticos dos outros jogadores.');
    applyVotingDeadlineUi();
    return;
  }

  const btn = $('#saveFirebaseBtn');
  const status = $('#firebaseStatus');
  const previousText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'A gravar...';
  status.textContent = 'A verificar se já existe um prognóstico com este nome ou deste dispositivo...';

  try {
    const participantKey = normalizeParticipantName(state.name);
    const visitorKey = await getVisitorKey();
    const existing = await findExistingSubmission(participantKey, visitorKey);
    if (existing?.reason === 'name') {
      status.textContent = 'Este nome já tem um prognóstico gravado.';
      alert('Esse nome já gravou um prognóstico. Usa outro nome ou pede ao administrador para remover o antigo.');
      return;
    }
    if (existing?.reason === 'visitor') {
      status.textContent = 'Este dispositivo/rede já gravou um prognóstico.';
      alert('Este dispositivo/rede já gravou um prognóstico. Só é permitido gravar uma vez.');
      return;
    }

    status.textContent = 'A gravar o teu prognóstico...';
    const payload = buildSubmissionPayload(participantKey, visitorKey);
    payload.pinHash = await hashPinForParticipant(participantKey, payload.pin);
    const docId = participantKey;
    const batch = firebaseTools.writeBatch(firestoreDb);
    const predictionRef = firebaseTools.doc(firestoreDb, FIREBASE_COLLECTION, docId);
    const visitorRef = firebaseTools.doc(firestoreDb, 'worldcupextraVisitors', visitorKey);
    batch.set(predictionRef, payload);
    batch.set(visitorRef, {
      participantKey,
      participantName: state.name,
      createdAt: firebaseTools.serverTimestamp(),
      clientTimestamp: new Date().toISOString()
    });
    await batch.commit();
    const createdPin = payload.pin || getOrCreateParticipantPin(participantKey);
    status.textContent = `Prognóstico gravado com sucesso. PIN: ${createdPin}`;
    alert(`Prognóstico gravado com sucesso. Guarda este PIN para poderes reformular nas eliminatórias: ${createdPin}`);
    state.lastSaved = new Date().toLocaleString('pt-PT');
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    localStorage.setItem('worldcup2026_submission_saved', docId);
    updateSummary();
  } catch (error) {
    console.error('Erro ao gravar:', error);
    status.textContent = 'Erro ao gravar. Tenta novamente mais tarde.';
    alert('Não foi possível gravar. Tenta novamente mais tarde.');
  } finally {
    btn.textContent = previousText;
    updateSaveButton();
  }
}

function bindEvents() {
  $('#saveNameBtn').addEventListener('click', () => {
    state.name = $('#userName').value.trim();
    $('#saveStatus').textContent = state.name ? 'Nome guardado.' : 'Nome apagado.';
    saveState();
  });

  $('#userName').addEventListener('input', () => {
    state.name = $('#userName').value.trim();
    updateSummary();
  });

  $('#userName').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') $('#saveNameBtn').click();
  });

  $('#saveFirebaseBtn').addEventListener('click', saveToFirebase);

  document.querySelector('.tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;
    state.activeStage = tab.dataset.stage;
    document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn === tab));
    renderMatches();
    saveState();
  });

  $('#matchesContainer').addEventListener('click', (event) => {
    const teamBtn = event.target.closest('.team-link');
    if (teamBtn) {
      event.stopPropagation();
      openTeamModal(teamBtn.dataset.team);
      return;
    }
    const interactive = event.target.closest('input, select, button');
    if (interactive) return;
    if (isVotingClosed()) return;
    const card = event.target.closest('.match-card');
    if (card) openMatchModal(card.dataset.matchId);
  });

  document.body.addEventListener('click', (event) => {
    const toggleGame = event.target.closest('[data-toggle-game-id]');
    if (toggleGame) {
      const head = event.target.closest('.viewer-game-head');
      if (head) {
        event.stopPropagation();
        const picks = toggleGame.querySelector('.viewer-picks');
        const icon = toggleGame.querySelector('.toggle-icon');
        if (picks) {
          const isHidden = picks.style.display === 'none';
          picks.style.display = isHidden ? 'block' : 'none';
          if (icon) {
            icon.style.transform = isHidden ? 'rotate(90deg)' : '';
          }
        }
        return;
      }
    }

    const togglePlayer = event.target.closest('[data-toggle-player-id]');
    if (togglePlayer) {
      const head = event.target.closest('.viewer-player-head');
      if (head) {
        event.stopPropagation();
        const details = togglePlayer.querySelector('.viewer-player-details');
        const icon = togglePlayer.querySelector('.toggle-icon-player');
        if (details) {
          const isHidden = details.style.display === 'none';
          details.style.display = isHidden ? 'block' : 'none';
          if (icon) {
            icon.style.transform = isHidden ? 'rotate(90deg)' : '';
          }
        }
        return;
      }
    }

    const ggamesInfo = event.target.closest('[data-ggames-info]');
    if (ggamesInfo) {
      event.stopPropagation();
      openGgamesRulesModal();
      return;
    }

    const ggamesSort = event.target.closest('[data-ggames-sort]');
    if (ggamesSort) {
      event.stopPropagation();
      const key = ggamesSort.dataset.ggamesSort;
      if (ggamesTableSort.key === key) {
        ggamesTableSort.direction = ggamesTableSort.direction === 'desc' ? 'asc' : 'desc';
      } else {
        ggamesTableSort = { key, direction: key === 'failedPredictions' || key === 'goalsMissed' ? 'asc' : 'desc' };
      }
      const viewerBody = $('#viewerBody');
      if (viewerBody && viewerBody.contains(ggamesSort)) {
        viewerBody.innerHTML = renderGgamesTable();
      } else {
        refreshLiveDashboardView();
      }
      return;
    }

    const viewerTab = event.target.closest('[data-view-tab]');
    if (viewerTab) {
      event.stopPropagation();
      const tab = viewerTab.dataset.viewTab;
      window.publicViewerActiveTab = tab;
      $('#viewerBody').innerHTML = tab === 'players' ? renderPublicPlayerList() : tab === 'games' ? renderPublicByGame(publicViewerStage, publicGameFilter) : renderGgamesTable();
      document.querySelectorAll('.viewer-tab').forEach(btn => btn.classList.toggle('active', btn === viewerTab));
      return;
    }

    const viewerPlayer = event.target.closest('[data-view-player]');
    if (viewerPlayer) {
      event.stopPropagation();
      const details = $('#viewerDetails');
      if (details) details.innerHTML = renderPublicPlayerDetails(viewerPlayer.dataset.viewPlayer);
      return;
    }

    const viewerStage = event.target.closest('[data-view-stage]');
    if (viewerStage) {
      event.stopPropagation();
      publicViewerStage = viewerStage.dataset.viewStage;
      $('#viewerBody').innerHTML = renderPublicByGame(publicViewerStage, publicGameFilter);
      return;
    }

    const gameFilter = event.target.closest('[data-game-filter]');
    if (gameFilter) {
      event.stopPropagation();
      publicGameFilter = gameFilter.dataset.gameFilter;
      $('#viewerBody').innerHTML = renderPublicByGame(publicViewerStage, publicGameFilter);
      return;
    }

    const livePredictionsFilter = event.target.closest('[data-live-predictions-filter]');
    if (livePredictionsFilter) {
      event.stopPropagation();
      const gameId = livePredictionsFilter.dataset.livePredictionsGame;
      const filterKey = livePredictionsFilter.dataset.livePredictionsFilter || 'all';
      livePredictionFilters[String(gameId)] = filterKey;
      refreshLiveDashboardView();
      return;
    }

    const liveLeft = event.target.closest('[data-live-left]');
    if (liveLeft) {
      event.stopPropagation();
      liveLeftTab = liveLeft.dataset.liveLeft;
      refreshLiveDashboardView();
      return;
    }

    const liveRight = event.target.closest('[data-live-right]');
    if (liveRight) {
      event.stopPropagation();
      liveRightTab = liveRight.dataset.liveRight;
      window.liveRightTabUserOverride = true;
      refreshLiveDashboardView();
      return;
    }

    const mobileNavBtn = event.target.closest('[data-mobile-section]');
    if (mobileNavBtn) {
      event.stopPropagation();
      const section = mobileNavBtn.dataset.mobileSection;
      if (section === 'prognostics') {
        openMobilePublicPredictionsPage('games');
      } else {
        setMobileAppSection(section);
      }
      return;
    }

    const liveMatchBtn = event.target.closest('[data-live-match]');
    if (liveMatchBtn) {
      event.stopPropagation();
      openLiveMatchModal(liveMatchBtn.dataset.liveMatch);
      return;
    }

    const livePlayerBtn = event.target.closest('[data-live-player]');
    if (livePlayerBtn) {
      event.stopPropagation();
      openGgamesPlayerHistory(livePlayerBtn.dataset.livePlayer);
      return;
    }

    const playerBtn = event.target.closest('[data-player-id]');
    if (playerBtn) {
      event.stopPropagation();
      openPlayerModal(playerBtn.dataset.team, playerBtn.dataset.playerId);
      return;
    }
    if (event.target.matches('.modal-close') || event.target.matches('.modal-backdrop')) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  $('#matchesContainer').addEventListener('input', (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    const card = event.target.closest('.match-card');
    const id = card.dataset.matchId;
    const pred = getPrediction(id);
    if (field === 'homeGoals' || field === 'awayGoals') {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 2);
    }
    pred[field] = event.target.value;
    state.predictions[String(id)] = pred;
    if (field === 'homeGoals' || field === 'awayGoals') autoWinner(id);
    saveState();
    renderMatchesPreservingPosition(event.target);
  });

  $('#matchesContainer').addEventListener('change', (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    const card = event.target.closest('.match-card');
    const id = card.dataset.matchId;
    const pred = getPrediction(id);
    if (field === 'homeGoals' || field === 'awayGoals') {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 2);
    }
    pred[field] = event.target.value;
    state.predictions[String(id)] = pred;
    saveState();
    renderMatchesPreservingPosition(event.target);
  });

  $('#clearBtn').addEventListener('click', () => {
    if (isVotingClosed()) return;
    const ok = confirm('Queres mesmo apagar todos os prognósticos guardados neste navegador?');
    if (!ok) return;
    state.predictions = {};
    saveState();
    renderMatches();
  });

  $('#viewOthersBtn').addEventListener('click', openPublicPredictionsEntry);
  $('#viewOthersBtnClosed')?.addEventListener('click', openPublicPredictionsEntry);

  $('#exportPdfBtn').addEventListener('click', exportPdf);
}

async function exportPdf() {
  saveState();
  const area = $('#pdfArea');
  const filename = `prognosticos-mundial-2026-${(state.name || 'participante').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.pdf`;

  if (!window.html2canvas || !window.jspdf) {
    window.print();
    return;
  }

  const activeStage = state.activeStage;
  const originalHtml = $('#matchesContainer').innerHTML;
  const tabs = document.querySelectorAll('.tab');

  $('#matchesContainer').innerHTML = Object.keys(STAGE_LABELS).map(stage =>
    `<section class="pdf-stage"><h2>${STAGE_LABELS[stage]}</h2>${renderStage(stage)}</section>`
  ).join('');

  const canvas = await html2canvas(area, { scale: 1.5, backgroundColor: '#07111f' });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = canvas.height * imgWidth / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  pdf.save(filename);

  state.activeStage = activeStage;
  $('#matchesContainer').innerHTML = originalHtml;
  tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.stage === activeStage));
  renderMatches();
}

async function init() {
  let secondsLeft = 3;
  let countdownInterval = null;
  const loadingSub = document.querySelector('#loadingScreen span');
  const updateCountdownMsg = (msg) => {
    if (loadingSub) {
      if (secondsLeft > 0) {
        loadingSub.textContent = `${msg} (Pronto em ~${secondsLeft}s)`;
      } else {
        loadingSub.textContent = `${msg} (A finalizar...)`;
      }
    }
  };

  try {
    let baseMsg = 'A carregar jogos, prognósticos e classificação...';
    updateCountdownMsg(baseMsg);
    
    countdownInterval = setInterval(() => {
      secondsLeft--;
      updateCountdownMsg(baseMsg);
    }, 1000);

    const [matchesResponse, squadsResponse] = await Promise.all([fetch('matches.json'), fetch('squads.json')]);
    data = await matchesResponse.json();
    squadsData = await squadsResponse.json();
    loadState();
    bindEvents();
    window.addEventListener('resize', updateMobileAppNav);
    updateMobileAppNav();
    updateSummary();
    renderMatches();
    await initFirebase();
    
    // Se a votação estiver fechada, atualiza a mensagem e ajusta o tempo estimado para a carga das APIs
    if (isVotingClosed()) {
      baseMsg = 'A obter resultados em tempo real e prognósticos...';
      secondsLeft = Math.max(secondsLeft, 3); // Dá mais 3 segundos estimados para o carregamento pesado
      updateCountdownMsg(baseMsg);
      
      await loadPublicPredictions();
      await loadApiWorldCupData({ sync: true });
      refreshLiveDashboardView();
    }
    
    if (countdownInterval) clearInterval(countdownInterval);
    hideLoadingScreen();
  } catch (error) {
    if (countdownInterval) clearInterval(countdownInterval);
    hideLoadingScreen();
    $('#matchesContainer').innerHTML = `<div class="empty-state">Erro ao carregar o calendário e as equipas. Abre o site através de um servidor local, por exemplo VS Code + Live Server.</div>`;
    console.error(error);
  }
}

init();

// Recarregar a página forçadamente a cada 5 minutos (300000ms)
setInterval(() => {
  console.log('Forçando refresh completo da página a cada 5 minutos...');
  location.reload(true);
}, 5 * 60 * 1000);



