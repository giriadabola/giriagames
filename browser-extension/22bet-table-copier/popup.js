document.addEventListener('DOMContentLoaded', () => {
  const statusText = document.getElementById('statusText');
  const btnCopyText = document.getElementById('btnCopyText');
  const btnCopyExcel = document.getElementById('btnCopyExcel');
  const btnCopyJSON = document.getElementById('btnCopyJSON');

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function sendAction(actionName) {
    statusText.innerText = 'A processar...';

    getActiveTab().then((tab) => {
      if (!tab || !tab.id) {
        statusText.innerText = 'Erro: Nenhuma aba ativa encontrada.';
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: actionName }, (response) => {
        if (chrome.runtime.lastError) {
          statusText.innerText = 'Por favor abra o site 22bet4me.com';
          return;
        }

        if (response && response.success) {
          statusText.innerText = `✅ ${response.count || 1} mercado(s) copiado(s)!`;
        } else {
          statusText.innerText = 'Concluído!';
        }
      });
    });
  }

  btnCopyText.addEventListener('click', () => sendAction('COPY_ALL_TEXT'));
  btnCopyExcel.addEventListener('click', () => sendAction('COPY_ALL_EXCEL'));
  btnCopyJSON.addEventListener('click', () => sendAction('COPY_ALL_JSON'));
});
