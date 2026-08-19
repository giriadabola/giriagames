// Content Script para o Sofascore (Extrai Equipa e Posição e envia para o Admin)
(async function extractSofaScoreData() {
  // Garantir que é uma página de jogador no Sofascore
  if (!/\/player\//i.test(window.location.pathname)) return;

  console.log('[Cromo-ggames] A extrair dados do jogador no Sofascore...');

  function cleanTeamName(raw) {
    if (!raw) return '';
    let text = String(raw).trim();
    // 1. Cortar frases relativas a contratos/empréstimos
    text = text.replace(/(?:Contrato|Contract|Emprestado|Loan|Até|Until).*/i, '').trim();
    // 2. Tratar concatenações em CamelCase ex: "LarnacaContrato" -> "Larnaca"
    text = text.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    text = text.replace(/(?:Contrato|Contract|Emprestado|Loan|Até|Until).*/i, '').trim();
    // 3. Manter apenas a primeira linha
    text = text.split(/[\r\n]/)[0].trim();
    return text;
  }

  function normalizePosition(text) {
    if (!text) return '';
    const t = text.toLowerCase();
    if (t.includes('defesa') || t.includes('defender')) return 'Defesa';
    if (t.includes('médio') || t.includes('medio') || t.includes('midfield')) return 'Médio';
    if (t.includes('avançado') || t.includes('avancado') || t.includes('forward') || t.includes('striker')) return 'Avançado';
    if (t.includes('guarda') || t.includes('gk') || t.includes('goalkeeper')) return 'Guarda-Redes';
    return text.trim();
  }

  function getPlayerTeam() {
    // 1. Procurar o link da equipa no Sofascore
    const teamLink = document.querySelector('a[href*="/team/football/"], a[href*="/team/"]');
    if (teamLink) {
      if (teamLink.children.length > 0) {
        const firstChildText = cleanTeamName(teamLink.children[0].textContent);
        if (firstChildText) return firstChildText;
      }
      const cleaned = cleanTeamName(teamLink.textContent);
      if (cleaned) return cleaned;
    }

    // 2. Procurar imagem de logotipo da equipa (escudo) e o texto correspondente
    const teamLogoImg = document.querySelector('img[src*="/team/"], img[alt*="logo"]');
    if (teamLogoImg) {
      const parentContainer = teamLogoImg.closest('div, a');
      if (parentContainer) {
        if (parentContainer.children.length > 0) {
          for (const child of parentContainer.children) {
            if (child.tagName !== 'IMG') {
              const txt = cleanTeamName(child.textContent);
              if (txt) return txt;
            }
          }
        }
        const text = cleanTeamName(parentContainer.textContent);
        if (text) return text;
      }
    }

    // 3. Meta title fallback
    const metaTitle = document.querySelector('meta[property="og:title"]')?.content || '';
    if (metaTitle.includes(' – ') || metaTitle.includes(' - ')) {
      const parts = metaTitle.split(/\s+[–-]\s+/);
      if (parts.length > 1) {
        return cleanTeamName(parts[1].replace(/estatísticas.*/i, ''));
      }
    }

    return '';
  }

  function getPlayerPosition() {
    const textBody = document.body.innerText || '';
    const posMatch = textBody.match(/(?:Posição|Position)[:\s]+(Guarda-Redes|Guarda-redes|Defesa|Médio|Medio|Avançado|Avancado|Goalkeeper|Defender|Midfielder|Forward)/i);
    if (posMatch) {
      return normalizePosition(posMatch[1]);
    }

    // Procura em spans/divs isolados com o nome da posição
    const elements = Array.from(document.querySelectorAll('span, div'));
    for (const el of elements) {
      const txt = el.textContent.trim();
      if (/^(Guarda-Redes|Defesa|Médio|Avançado)$/i.test(txt)) {
        return normalizePosition(txt);
      }
    }

    return '';
  }

  function doExtraction() {
    const team = getPlayerTeam();
    const position = getPlayerPosition();
    const url = window.location.href;

    console.log('[Cromo-ggames] Extraído com sucesso:', { team, position, url });

    chrome.runtime.sendMessage({
      type: 'SOFASCORE_DATA_EXTRACTED',
      data: {
        equipa: team,
        posicao: position,
        url: url
      }
    });
  }

  // Esperar brevemente para o React / Next.js renderizar os elementos da página no Sofascore
  setTimeout(doExtraction, 800);
})();
