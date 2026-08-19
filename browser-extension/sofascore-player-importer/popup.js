const button = document.getElementById('import');
const status = document.getElementById('status');

button.addEventListener('click', async () => {
  button.disabled = true;
  status.className = '';
  status.textContent = 'A recolher os dados do Sofascore...';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'IMPORT_CURRENT_PLAYER' });
    if (!response?.ok) throw new Error(response?.error || 'Não foi possível iniciar a importação.');
    status.className = 'ok';
    status.textContent = 'Dados enviados. A procurar o jogador no Sortitoutsi...';
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