/**
 * 22bet Table Copier & Odds Exporter
 * Content Script (Engine Multilíngua e Normalização Unicode para 4378922mp.pro)
 */

(function () {
  'use strict';

  // Normalização de texto: limpa caracteres unicode invisíveis (\u00A0), ícones de cadeado e botões da extensão
  function cleanText(str) {
    if (!str) return '';
    return str
      .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
      .replace(/[🔒🔓]/g, '')
      .replace(/📋\s*Copiar/gi, '')
      .replace(/📊\s*Excel/gi, '')
      .replace(/22Bet Copier/gi, '')
      .trim();
  }

  // Verificar se uma string é uma odd numérica válida (ex: 1.14, 7.7, 16.5, 1.001, 1.07, 5.27)
  function isOddNumber(str) {
    const s = cleanText(str);
    if (!/^\d{1,3}\.\d{1,4}$/.test(s)) return false;
    const val = parseFloat(s);
    return val >= 1.001 && val <= 1000;
  }

  // Desbloquear a seleção de texto manual por rato em TODA a página usando Style Tag Global
  function unlockSelection() {
    if (!document.getElementById('bet22-unlock-css')) {
      const style = document.createElement('style');
      style.id = 'bet22-unlock-css';
      style.innerHTML = `
        html, body, div, span, table, tbody, tr, td, th, label, p, header, section, article, a {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
          pointer-events: auto !important;
        }
        button, .btn-22bet-copy, #bet22-floating-toolbar {
          -webkit-user-select: none !important;
          user-select: none !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    if (document.body) {
      document.body.classList.add('bet22-allow-select');
    }

    const eventsToStop = ['contextmenu', 'selectstart', 'dragstart'];
    eventsToStop.forEach((eventType) => {
      document.addEventListener(eventType, (e) => e.stopPropagation(), true);
    });
  }

  // Exibir Toast de Notificação
  function showToast(message, isSuccess = true) {
    const existing = document.querySelector('.bet22-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'bet22-toast';
    toast.style.borderColor = isSuccess ? '#10b981' : '#ef4444';
    toast.style.background = isSuccess ? '#064e3b' : '#7f1d1d';
    toast.innerHTML = `
      <span>${isSuccess ? '✅' : '⚠️'}</span>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // Função para copiar texto para o Clipboard com triplo fallback
  async function copyToClipboard(text, successMsg = 'Tabela copiada com sucesso!') {
    let copied = false;

    // Método 1: Async Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (e) {
        console.warn('[22bet Copier] Clipboard API requer foco. A tentar fallback...', e);
      }
    }

    // Método 2: Elemento textarea temporário focado com execCommand
    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand('copy');
        textarea.remove();
      } catch (e) {
        console.warn('[22bet Copier] execCommand com textarea falhou:', e);
      }
    }

    // Método 3: Evento de cópia personalizado
    if (!copied) {
      try {
        const listener = (e) => {
          e.clipboardData.setData('text/plain', text);
          e.preventDefault();
        };
        document.addEventListener('copy', listener, { once: true });
        copied = document.execCommand('copy');
      } catch (e) {
        console.error('[22bet Copier] Fallback do evento de cópia falhou:', e);
      }
    }

    if (copied) {
      showToast(successMsg, true);
    } else {
      showToast('Erro ao copiar para a área de transferência', false);
    }
  }

  // Extrair o nome das equipas / cabeçalho do jogo em PT / EN
  function getMatchHeader() {
    let homeTeam = '';
    let awayTeam = '';

    const teamElems = document.querySelectorAll(
      '.c-events__team, .c-events-single__team, .team-name, .n-dash-match__team, .c-score-board__team-name, [class*="team-name"], [class*="team_name"], [class*="team"]'
    );

    const validTeams = Array.from(teamElems)
      .map((el) => cleanText(el.innerText))
      .filter((t) => t && t.length > 1 && t.length < 45 && !t.includes('\n') && !/^\d+$/.test(t) && !t.includes(':'));

    if (validTeams.length >= 2) {
      homeTeam = validTeams[0];
      awayTeam = validTeams[1];
    }

    if (!homeTeam) {
      const heading = document.querySelector('.c-events-single__header, .dashboard-game__header, h1, title');
      if (heading) {
        const txt = cleanText(heading.innerText);
        if (txt && !txt.toLowerCase().includes('22bet') && !txt.toLowerCase().includes('4378922')) {
          return txt.split('–')[0].split('-')[0].trim();
        }
      }
    }

    return homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : 'Urartu vs Syunik';
  }

  // PARSER UNIVERSAL DE INNERTEXT (Compatível com 4378922mp.pro e 22bet)
  function parsePageInnerText() {
    const canvas =
      document.querySelector('.markets-canvas') ||
      document.querySelector('.markets-event-groups') ||
      document.querySelector('.c-events_main_game') ||
      document.querySelector('[class*="markets-canvas"]') ||
      document.body;

    const rawText = canvas.innerText || canvas.textContent || '';
    const rawLines = rawText
      .split('\n')
      .map((s) => cleanText(s))
      .filter(Boolean);

    const matchHeader = getMatchHeader();
    const markets = [];
    let currentMarket = null;

    // Apenas frases de controle do site a ignorar (NÃO incluir ALL MARKETS, TOTAL ou HANDICAP aqui!)
    const ignorePhrases = [
      'PÁGINA PRINCIPAL', 'DESPORTOS', 'AO VIVO', 'JACKPOT', 'CASINO', 'BÓNUS', 'ESPORTS',
      'BOLETIM DE APOSTAS', 'ROLETA', 'BLACKJACK', 'SLOTS', 'EVENTOS PRINCIPAIS', 'FAZER LOGIN',
      'REGISTO', 'Classificação', 'Tempo regulamentar', 'Construtor', 'Alinhamentos',
      'JOGOS RECENTES', 'HORA DE INÍCIO', 'MATCHES', 'EVENT', 'STANDINGS', 'VISUAL STATS',
      'LINEUPS', 'TIMELINE', 'SEARCH BY MARKET',
      '1ST HALF', '2ND HALF', 'HALF-TIME', 'GOALS', 'CORNER', 'RED CARD', 'YELLOW CARD',
      'PENALTIES', 'SUBSTITUTIONS'
    ];

    for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i];

      // Parar se chegar à secção de Acumulador do Dia do rodapé
      if (line.toUpperCase().includes('ACUMULADOR DO DIA') || line.toUpperCase().includes('ACCUMULATOR OF THE DAY')) {
        break;
      }

      if (!line) continue;

      // Ignorar linhas de controle de menus conhecidos
      if (ignorePhrases.some((p) => line.toLowerCase() === p.toLowerCase())) {
        continue;
      }

      const isOdd = isOddNumber(line);
      const isSelectionToken = /^(Sim|Não|Empate|1X|12|2X|V1|V2|W1|W2|X|Yes|No)$/i.test(line);

      // Se a linha parecer um título de mercado (ex: "1X2", "Double Chance", "Both Teams To Score", "Total", "Handicap")
      if (!isOdd && !isSelectionToken && line.length < 70 && !line.includes('|')) {
        let hasOddsAhead = false;
        for (let j = i + 1; j < Math.min(i + 15, rawLines.length); j++) {
          if (isOddNumber(rawLines[j])) {
            hasOddsAhead = true;
            break;
          }
        }

        if (hasOddsAhead) {
          if (currentMarket && currentMarket.items.length > 0) {
            markets.push(currentMarket);
          }
          currentMarket = {
            marketName: line,
            items: []
          };
          continue;
        }
      }

      // Se a linha for um valor numérico de odd (ex: 1.14, 7.7, 16.5, 1.001, 1.07, 5.27)
      if (isOdd && i > 0 && currentMarket) {
        let prevLine = rawLines[i - 1];

        if (
          prevLine &&
          !isOddNumber(prevLine) &&
          prevLine !== currentMarket.marketName
        ) {
          if (!currentMarket.items.some((it) => it.selection === prevLine && it.odd === line)) {
            currentMarket.items.push({
              selection: prevLine,
              odd: line
            });
          }
        }
      }
    }

    if (currentMarket && currentMarket.items.length > 0) {
      markets.push(currentMarket);
    }

    return {
      match: matchHeader,
      markets: markets
    };
  }

  // Parse Geral
  function parseAllMarkets() {
    return parsePageInnerText();
  }

  // Obter lista de containers para injeção de botões visuais
  function findMarketContainers() {
    const canvas = document.querySelector('.markets-canvas, .markets-event-groups, [class*="markets-canvas"]');
    if (!canvas) return [];

    const candidateContainers = canvas.querySelectorAll(
      '.c-events-single__market, .c-bets-group, .bet-group, .bets-widget, .market-layout, .market-block, .sub-markets__item, [class*="bets-group"], [class*="market-layout"], [class*="min-bet-table"]'
    );

    return Array.from(candidateContainers);
  }

  // Formatadores de Saída
  function formatAsText(data) {
    if (!data.markets || data.markets.length === 0) {
      return `⚠️ Nenhum mercado de apostas detetado na área central do jogo.`;
    }

    let output = `====================================\n`;
    output += ` 🏆 ${data.match}\n`;
    output += `====================================\n\n`;

    data.markets.forEach((m) => {
      output += `📌 ${m.marketName}\n`;
      output += `------------------------------------\n`;
      m.items.forEach((item) => {
        const sel = item.selection.padEnd(38, ' ');
        output += `${sel} | ${item.odd}\n`;
      });
      output += `\n`;
    });

    return output.trim();
  }

  function formatAsTSV(data) {
    if (!data.markets || data.markets.length === 0) {
      return `Jogo\tMercado\tSeleção / Palpite\tOdd`;
    }

    let rows = [];
    rows.push(['Jogo', 'Mercado', 'Seleção / Palpite', 'Odd'].join('\t'));

    data.markets.forEach((m) => {
      m.items.forEach((item) => {
        rows.push([data.match, m.marketName, item.selection, item.odd].join('\t'));
      });
    });

    return rows.join('\n');
  }

  function formatAsJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  // Injetar Botões de Cópia em cada Bloco de Mercado Central
  function injectCopyButtons() {
    const containers = findMarketContainers();

    containers.forEach((block) => {
      if (block.querySelector('.btn-22bet-copy-wrapper')) return;

      const headerElem =
        block.querySelector(
          '.c-events-single__popup-title, .c-bets-group__title, .bet-group__title, .market-title, .min-bet-table__title, [class*="title"], [class*="header"]'
        ) || block.firstElementChild;

      if (!headerElem) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'btn-22bet-copy-wrapper';

      const btnText = document.createElement('button');
      btnText.className = 'btn-22bet-copy';
      btnText.innerHTML = '📋 Copiar';
      btnText.title = 'Copiar esta tabela em formato Texto';
      btnText.onclick = (e) => {
        e.stopPropagation();
        const data = {
          match: getMatchHeader(),
          markets: [parsePageInnerText()]
        };
        copyToClipboard(formatAsText(data), 'Mercado copiado (Texto)!');
      };

      const btnExcel = document.createElement('button');
      btnExcel.className = 'btn-22bet-copy excel';
      btnExcel.innerHTML = '📊 Excel';
      btnExcel.title = 'Copiar esta tabela para Excel/Sheets';
      btnExcel.onclick = (e) => {
        e.stopPropagation();
        const data = {
          match: getMatchHeader(),
          markets: [parsePageInnerText()]
        };
        copyToClipboard(formatAsTSV(data), 'Mercado copiado (Excel)!');
      };

      wrapper.appendChild(btnText);
      wrapper.appendChild(btnExcel);

      headerElem.style.display = 'flex';
      headerElem.style.alignItems = 'center';
      headerElem.style.justifyContent = 'space-between';
      headerElem.appendChild(wrapper);
    });
  }

  // Injetar Painel Flutuante na Página (apenas no frame principal)
  function injectFloatingToolbar() {
    if (window.top !== window.self) return;
    if (document.getElementById('bet22-floating-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'bet22-floating-toolbar';
    toolbar.innerHTML = `
      <span class="bet22-badge">22Bet Copier</span>
      <button class="btn-22bet-copy" id="bet22-btn-copy-all">📋 Copiar Tudo</button>
      <button class="btn-22bet-copy excel" id="bet22-btn-excel-all">📊 Excel</button>
    `;

    document.body.appendChild(toolbar);

    document.getElementById('bet22-btn-copy-all').onclick = () => {
      const data = parseAllMarkets();
      copyToClipboard(formatAsText(data), 'Todas as tabelas do jogo copiadas!');
    };

    document.getElementById('bet22-btn-excel-all').onclick = () => {
      const data = parseAllMarkets();
      copyToClipboard(formatAsTSV(data), 'Todas as tabelas enviadas para Excel!');
    };
  }

  // Escutar mensagens do Popup ou entre Frames
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'COPY_ALL_TEXT') {
      const data = parseAllMarkets();
      const text = formatAsText(data);
      copyToClipboard(text, 'Tabelas copiadas em Texto!');
      sendResponse({ success: true, count: data.markets.length, text });
    } else if (request.action === 'COPY_ALL_EXCEL') {
      const data = parseAllMarkets();
      const text = formatAsTSV(data);
      copyToClipboard(text, 'Tabelas copiadas para Excel!');
      sendResponse({ success: true, count: data.markets.length, text });
    } else if (request.action === 'COPY_ALL_JSON') {
      const data = parseAllMarkets();
      const text = formatAsJSON(data);
      copyToClipboard(text, 'Dados copiados em JSON!');
      sendResponse({ success: true, count: data.markets.length, text });
    }
    return true;
  });

  // Inicialização e Observador de Mutações
  function init() {
    unlockSelection();
    injectFloatingToolbar();
    injectCopyButtons();

    const observer = new MutationObserver(() => {
      injectCopyButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
