document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const panelEl = document.getElementById('editar-jogadores-panel');
  const runningPanelEl = document.getElementById('batch-running-panel');
  const seasonSelect = document.getElementById('season-select');
  const btnStart = document.getElementById('btn-start-batch');
  const btnStop = document.getElementById('btn-stop-batch');
  const progressText = document.getElementById('batch-progress-text');
  const playerText = document.getElementById('batch-player-text');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Verificar estado da tarefa ativa no background
  try {
    const resActive = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TASK' });
    const activeTask = resActive?.task;

    if (activeTask && activeTask.isBatch) {
      panelEl.style.display = 'none';
      runningPanelEl.style.display = 'block';
      progressText.textContent = `● A processar ${activeTask.currentIndex + 1} de ${activeTask.totalCount} (${activeTask.targetSeason})`;
      playerText.textContent = `Jogador: ${activeTask.currentPlayerName || ''}`;
      return;
    }
  } catch (e) {}

  if (tab && tab.url && tab.url.includes('editar-jogadores.html')) {
    panelEl.style.display = 'block';
    runningPanelEl.style.display = 'none';

    // Obter informação de temporadas e jogadores em falta
    chrome.tabs.sendMessage(tab.id, { type: 'GET_EDITAR_JOGADORES_INFO' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.seasons) {
        statusEl.textContent = '● Recarregue a página (F5)';
        return;
      }

      const { seasons, missingBySeason } = response;
      seasonSelect.innerHTML = '';
      seasons.forEach(s => {
        const missingCount = missingBySeason[s] || 0;
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = `${s} (${missingCount} jogadores em falta)`;
        seasonSelect.appendChild(opt);
      });
    });

    btnStart.addEventListener('click', () => {
      const selectedSeason = seasonSelect.value;
      if (!selectedSeason) return;

      chrome.tabs.sendMessage(tab.id, {
        type: 'START_BATCH_SEASON_IMPORT',
        targetSeason: selectedSeason
      }, () => {
        window.close();
      });
    });
  } else {
    statusEl.textContent = '● Aceda a admin/editar-jogadores.html';
  }

  btnStop?.addEventListener('click', () => {
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'STOP_BATCH_IMPORT' }, () => {
        window.close();
      });
    }
  });
});
