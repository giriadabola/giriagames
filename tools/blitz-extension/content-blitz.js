// content-blitz.js
(function() {
    // Adicionar um botão flutuante na página
    function createFloatingButton() {
        if (document.getElementById('giria-games-extractor-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'giria-games-extractor-btn';
        btn.innerHTML = `
            <span style="margin-right: 8px; font-size: 16px;">📋</span>
            <span>Copiar Bets</span>
        `;
        
        // Estilos premium
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '999999',
            backgroundColor: '#10b981', // Verde esmeralda moderno
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
        });

        // Efeitos de Hover
        btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = '#059669';
            btn.style.transform = 'translateY(-2px) scale(1.05)';
            btn.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = '#10b981';
            btn.style.transform = 'none';
            btn.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)';
        });

        btn.addEventListener('click', extractAndSaveBets);
        document.body.appendChild(btn);
    }

    // Função de extração
    function extractAndSaveBets() {
        const btn = document.getElementById('giria-games-extractor-btn');
        const originalContent = btn.innerHTML;

        // Tentar localizar a coluna central de apostas
        const selectors = [
            'div[class*="game-markets"]',
            'div[class*="market-list"]',
            'div[class*="markets-container"]',
            'div[class*="sport-event"]',
            'div[class*="event-markets"]',
            'div[class*="main-column"]',
            'div[class*="center-column"]',
            'div[class*="middle-column"]',
            'main',
            '#main-content'
        ];

        let targetElement = null;
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && (el.innerText.includes('Match Result') || el.innerText.includes('Double Chance'))) {
                targetElement = el;
                break;
            }
        }

        // Se não encontrar por seletores comuns, busca o ancestral comum das categorias
        if (!targetElement) {
            const headings = Array.from(document.querySelectorAll('*')).filter(el => {
                return el.children.length === 0 && (el.textContent.trim() === 'Match Result' || el.textContent.trim() === 'Double Chance');
            });
            if (headings.length > 0) {
                let current = headings[0];
                while (current && current !== document.body) {
                    if (current.innerText.includes('Double Chance') && current.innerText.includes('Match Result')) {
                        targetElement = current;
                        break;
                    }
                    current = current.parentElement;
                }
            }
        }

        // Fallback final: usa o body inteiro
        const textToCopy = targetElement ? targetElement.innerText : document.body.innerText;

        // Limpa e normaliza quebras de linha múltiplas para o formato esperado
        const cleanedText = textToCopy
            .split('\n')
            .map(line => line.trim())
            .filter((line, i, arr) => {
                // Remove linhas em branco repetidas consecutivas
                if (line === '' && i > 0 && arr[i - 1] === '') return false;
                return true;
            })
            .join('\n');

        // Guardar no chrome storage local para que a outra página possa ler diretamente
        chrome.storage.local.set({ 'copiedBets': cleanedText }, function() {
            // Copiar também para a área de transferência
            navigator.clipboard.writeText(cleanedText).then(() => {
                // Feedback visual de sucesso
                btn.style.backgroundColor = '#3b82f6'; // Azul de sucesso
                btn.innerHTML = `
                    <span style="margin-right: 8px; font-size: 16px;">✅</span>
                    <span>Bets Copiadas!</span>
                `;
                setTimeout(() => {
                    btn.style.backgroundColor = '#10b981';
                    btn.innerHTML = originalContent;
                }, 2000);
            }).catch(err => {
                console.error('Erro ao copiar para clipboard: ', err);
                // Mesmo se falhar o clipboard, guardou no storage!
                btn.style.backgroundColor = '#eab308'; // Amarelo
                btn.innerHTML = `
                    <span style="margin-right: 8px; font-size: 16px;">💾</span>
                    <span>Salvo na Extensão!</span>
                `;
                setTimeout(() => {
                    btn.style.backgroundColor = '#10b981';
                    btn.innerHTML = originalContent;
                }, 2000);
            });
        });
    }

    // Inicializar botão
    // Algumas páginas são single-page-applications, portanto tentamos reinicializar regularmente ou quando a página muda
    createFloatingButton();
    setInterval(createFloatingButton, 2000);
})();
