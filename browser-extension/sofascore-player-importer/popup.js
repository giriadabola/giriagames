const button = document.getElementById('import');
const status = document.getElementById('status');
const serverBadge = document.getElementById('server-badge');
const serverText = document.getElementById('server-text');

let isServerOnline = false;

async function checkServerStatus() {
  serverBadge.className = 'server-status-box checking';
  serverText.textContent = 'A verificar servidor...';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_SERVER_STATUS' });
    if (response?.online) {
      isServerOnline = true;
      serverBadge.className = 'server-status-box online';
      serverText.textContent = 'Servidor de Imagens: Online';
    } else {
      isServerOnline = false;
      serverBadge.className = 'server-status-box offline';
      serverText.textContent = 'Servidor de Imagens: Offline';
    }
  } catch (error) {
    isServerOnline = false;
    serverBadge.className = 'server-status-box offline';
    serverText.textContent = 'Servidor de Imagens: Offline';
  }
}

checkServerStatus();

button.addEventListener('click', async () => {
  button.disabled = true;
  status.className = '';
  
  if (!isServerOnline) {
    status.className = 'warning';
    status.textContent = 'Aviso: Servidor offline! A imagem não será guardada.\nA recolher dados do Sofascore...';
  } else {
    status.textContent = 'A recolher os dados do Sofascore...';
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: 'IMPORT_CURRENT_PLAYER' });
    if (!response?.ok) throw new Error(response?.error || 'Não foi possível iniciar a importação.');
    status.className = isServerOnline ? 'ok' : 'warning';
    status.textContent = isServerOnline
      ? 'Dados enviados. A procurar o jogador no Sortitoutsi...'
      : 'Dados enviados (sem imagem). A procurar o jogador...';
  } catch (error) {
    status.className = 'error';
    status.textContent = error.message;
    button.disabled = false;
  }
});

document.getElementById('logs').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'GET_DEBUG_LOGS' });
  document.getElementById('log-output').textContent = response?.logs?.join('\n') || 'Sem logs.';
});