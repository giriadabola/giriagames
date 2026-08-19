// content-arbitro.js
(function() {
    function injectPasteButton() {
        const targetContainer = document.querySelector('.popup-controls-container');
        const textarea = document.getElementById('inputTextArea');
        
        if (!targetContainer || !textarea || document.getElementById('ext-paste-bets-btn')) return;

        // Criar o botão de colar inteligente
        const pasteBtn = document.createElement('button');
        pasteBtn.id = 'ext-paste-bets-btn';
        pasteBtn.type = 'button';
        pasteBtn.innerHTML = '<i class="fas fa-clipboard-list" style="margin-right: 5px;"></i> Colar da Extensão';
        
        // Copiar estilos de botão padrão do painel ou aplicar estilos premium
        Object.assign(pasteBtn.style, {
            backgroundColor: '#3b82f6', // Azul moderno
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            marginRight: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            transition: 'all 0.2s ease'
        });

        // Hover effect
        pasteBtn.addEventListener('mouseenter', () => {
            pasteBtn.style.backgroundColor = '#2563eb';
            pasteBtn.style.transform = 'translateY(-1px)';
        });
        pasteBtn.addEventListener('mouseleave', () => {
            pasteBtn.style.backgroundColor = '#3b82f6';
            pasteBtn.style.transform = 'none';
        });

        // Evento de clique para colar e converter
        pasteBtn.addEventListener('click', () => {
            chrome.storage.local.get(['copiedBets'], (result) => {
                if (result.copiedBets) {
                    textarea.value = result.copiedBets;
                    
                    // Disparar eventos normais para simular digitação
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    textarea.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Feedback visual temporário na textarea
                    const originalBorder = textarea.style.borderColor;
                    textarea.style.borderColor = '#10b981';
                    textarea.style.boxShadow = '0 0 8px rgba(16, 185, 129, 0.5)';
                    
                    setTimeout(() => {
                        textarea.style.borderColor = originalBorder;
                        textarea.style.boxShadow = 'none';
                    }, 1000);

                    // Executar conversão automática após colar
                    const convertButton = document.getElementById('create-table-button');
                    if (convertButton) {
                        convertButton.click();
                    } else if (typeof window.convertToTable === 'function') {
                        window.convertToTable();
                    }
                } else {
                    alert('Nenhuma aposta encontrada na memória da extensão. Vá ao site da Blitz e clique em "Copiar Bets" primeiro.');
                }
            });
        });

        // Inserir antes do botão "Criar Tabela"
        const createTableBtn = document.getElementById('create-table-button');
        if (createTableBtn) {
            targetContainer.insertBefore(pasteBtn, createTableBtn);
        } else {
            targetContainer.appendChild(pasteBtn);
        }
    }

    // Tentar injetar e monitorar a existência do popup caso seja renderizado dinamicamente
    injectPasteButton();
    const injectorInterval = setInterval(injectPasteButton, 1000);
})();
