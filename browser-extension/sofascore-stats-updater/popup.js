const startBtn = document.getElementById('start-btn');
const logsBtn = document.getElementById('logs-btn');
const copyBtn = document.getElementById('copy-btn');
const statusDiv = document.getElementById('status');
const logOutput = document.getElementById('log-output');

let lastLogs = [];

async function refreshLogs() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_DEBUG_LOGS' });
  const logs = res?.logs || [];
  lastLogs = logs;
  if (logs.length > 0) {
    logOutput.textContent = logs.join('\n');
    logOutput.scrollTop = logOutput.scrollHeight;
  } else {
    logOutput.textContent = 'Sem logs registados.';
  }
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  statusDiv.className = '';
  statusDiv.textContent = 'A iniciar processo de pesquisa no Sofascore...';

  try {
    const res = await chrome.runtime.sendMessage({ type: 'START_STATS_UPDATE_PROCESS' });
    if (!res?.ok) throw new Error(res?.error || 'Erro ao iniciar o processo.');

    statusDiv.className = 'ok';
    statusDiv.textContent = `A pesquisar Sofascore para "${res.playerName}"...`;
  } catch (err) {
    statusDiv.className = 'error';
    statusDiv.textContent = err.message;
    startBtn.disabled = false;
  }
});

logsBtn.addEventListener('click', refreshLogs);

copyBtn.addEventListener('click', async () => {
  const textToCopy = lastLogs.length > 0 ? lastLogs.join('\n') : logOutput.textContent;
  try {
    await navigator.clipboard.writeText(textToCopy);
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✅ Copiado!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 1500);
  } catch (err) {
    console.error('Erro ao copiar logs:', err);
  }
});

// Auto-refresh dos logs a cada 1 segundo enquanto o popup estiver aberto
refreshLogs();
setInterval(refreshLogs, 1000);
