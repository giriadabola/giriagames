function titleCasePlayerName(value) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(part => part ? part.charAt(0).toUpperCase() + part.slice(1) : '')
    .join(' ');
}

function getPlayerName() {
  // 1. Procurar nos cabeçalhos <h1> ou <h2> (tem sempre os acentos originais ex: "Gonçalo Inácio")
  const heading = [...document.querySelectorAll('h1, h2')]
    .map(element => element.textContent.trim())
    .find(value => value && value.length > 2 && !/estatísticas|statistics|scores|golos|goals|sofascore/i.test(value));

  if (heading) return heading;

  // 2. Procurar na meta tag og:title
  const metaTitle = document.querySelector('meta[property="og:title"]')?.content || '';
  if (metaTitle) {
    const cleanedMetaTitle = metaTitle.split(/\s+[–-]\s+/)[0].replace(/perfil do jogador|estatísticas|statistics|scores|golos|goals/gi, '').trim();
    if (cleanedMetaTitle && cleanedMetaTitle.length > 2 && !/sofascore/i.test(cleanedMetaTitle)) {
      return cleanedMetaTitle;
    }
  }

  // 3. Procurar no título da página (document.title)
  const docTitle = document.title.split(/\s+[–-]\s+/)[0].replace(/perfil do jogador|estatísticas|statistics|scores|golos|goals/gi, '').trim();
  if (docTitle && docTitle.length > 2 && !/sofascore/i.test(docTitle)) {
    return docTitle;
  }

  // 4. Último recurso: URL Slug
  const playerSlug = window.location.pathname.match(/\/player\/([^/]+)/i)?.[1];
  if (playerSlug) return titleCasePlayerName(decodeURIComponent(playerSlug));

  return '';
}

function extractStatsText(bodyText, playerName) {
  if (!bodyText) return '';
  const startRegex = /Média de [Pp]ontuações Sofascore/i;
  const matchStart = bodyText.match(startRegex);
  if (!matchStart) return '';

  const startIndex = matchStart.index;
  let statsSubstring = bodyText.slice(startIndex);

  if (playerName) {
    const escapedName = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Padrão 1: Nome repetido duas vezes (ex: "Bruno Fernandes\nBruno Fernandes")
    const doubleNameRegex = new RegExp(`(${escapedName}\\s*\\n\\s*${escapedName})`, 'i');
    const matchDouble = statsSubstring.match(doubleNameRegex);
    if (matchDouble) {
      statsSubstring = statsSubstring.slice(0, matchDouble.index).trim();
      return statsSubstring;
    }

    // Padrão 2: Nome seguido de biografia (ex: "Bruno Fernandes tem...", "Bruno Fernandes prefere...")
    const bioRegex = new RegExp(`${escapedName}(?:\\s+tem\\s+\\d+|\\s+prefere|\\s+realizará|\\s+for\\s+titular)`, 'i');
    const matchBio = statsSubstring.match(bioRegex);
    if (matchBio) {
      statsSubstring = statsSubstring.slice(0, matchBio.index).trim();
      statsSubstring = statsSubstring.replace(new RegExp(`\\n?\\s*${escapedName}\\s*$`, 'i'), '').trim();
      return statsSubstring;
    }
  }

  // Padrão 3: Rodapé genérico de texto Sofascore se o nome não bater exactamente
  const footerRegex = /\n.*?(?:Se .+? jogar, poderás também acompanhar|O perfil de .+? mostra todos|poderás também acompanhar a sua pontuação)/i;
  const matchFooter = statsSubstring.match(footerRegex);
  if (matchFooter) {
    statsSubstring = statsSubstring.slice(0, matchFooter.index).trim();
    if (playerName) {
      const escapedName = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      statsSubstring = statsSubstring.replace(new RegExp(`\\n?\\s*${escapedName}\\s*$`, 'i'), '').trim();
    }
  }

  return statsSubstring;
}

async function selectEpocaSeason2526() {
  try {
    // 1. Clicar no separador "Época"
    const tabs = [...document.querySelectorAll('button, a, div[role="tab"], span, li')];
    const epocaTab = tabs.find(el => {
      const txt = el.textContent.trim();
      return txt === 'Época' || txt === 'Season';
    });
    if (epocaTab) {
      epocaTab.click();
      await new Promise(r => setTimeout(r, 300));
    }

    // 2. Verificar se a época "25/26" já está selecionada ou se precisa de mudar
    const dropdownToggles = [...document.querySelectorAll('button, div[role="button"], div[class*="Dropdown"], div[class*="select"], div[class*="Select"]')];
    const seasonToggle = dropdownToggles.find(el => /\b\d{2}\/\d{2}\b/.test(el.textContent.trim()));

    if (seasonToggle && !seasonToggle.textContent.includes('25/26')) {
      seasonToggle.click();
      await new Promise(r => setTimeout(r, 250));

      // Procurar a opção "25/26" na lista suspensa que se abriu
      const options = [...document.querySelectorAll('li, div[role="option"], button, span, a, div')];
      const option2526 = options.find(el => el.textContent.trim() === '25/26');
      if (option2526) {
        option2526.click();
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch (err) {
    console.warn('[GiriaGames Importer] Não foi possível selecionar a época 25/26 automaticamente:', err);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'EXTRACT_SOFASCORE_PLAYER') return;

  (async () => {
    // Selecionar "Época" > "25/26" antes de ler os dados
    await selectEpocaSeason2526();

    const name = getPlayerName();
    const bodyText = document.body?.innerText?.trim() || '';
    if (!name || bodyText.length < 20) {
      sendResponse({ ok: false, error: 'Não foi possível detectar a página de um jogador no Sofascore.' });
      return;
    }

    const statsText = extractStatsText(bodyText, name);
    sendResponse({ ok: true, name, text: `${name}\n${bodyText}`, statsText });
  })().catch(err => {
    sendResponse({ ok: false, error: err.message });
  });

  return true;
});

function injectImportButton() {
  if (document.getElementById('giria-import-btn')) return;
  if (!window.location.pathname.includes('/player/')) return;

  const btn = document.createElement('button');
  btn.id = 'giria-import-btn';
  btn.innerHTML = '⚡ Importar para GiriaGames';
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #ffffff;
    font-weight: 700;
    font-size: 14px;
    font-family: system-ui, -apple-system, sans-serif;
    padding: 12px 20px;
    border: none;
    border-radius: 50px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.05)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
  });

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerHTML = '⏳ A selecionar Época 25/26...';
    btn.style.background = '#4b5563';

    await selectEpocaSeason2526();
    btn.innerHTML = '⏳ A importar jogador...';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'IMPORT_CURRENT_PLAYER' });
      if (response?.ok) {
        btn.innerHTML = '✅ Importação iniciada!';
        btn.style.background = '#059669';
      } else {
        btn.innerHTML = '❌ Erro: ' + (response?.error || 'Tente novamente');
        btn.style.background = '#dc2626';
      }
    } catch (err) {
      btn.innerHTML = '❌ Erro ao enviar comando';
      btn.style.background = '#dc2626';
    }

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '⚡ Importar para GiriaGames';
      btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    }, 4000);
  });

  document.body.appendChild(btn);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectImportButton);
} else {
  injectImportButton();
}

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(injectImportButton, 1000);
  }
}).observe(document, { subtree: true, childList: true });