// Content Script para o Sofascore (Extrai Equipa e Posição e envia para o Admin)
(async function extractSofaScoreData() {
  if (!/\/player\//i.test(window.location.pathname)) return;

  console.log('[Batch-Importador] A extrair dados do jogador no Sofascore...');

  function cleanTeamName(raw) {
    if (!raw) return '';
    let text = String(raw).trim();
    text = text.replace(/(?:Contrato|Contract|Emprestado|Loan|Até|Until).*/i, '').trim();
    text = text.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    text = text.replace(/(?:Contrato|Contract|Emprestado|Loan|Até|Until).*/i, '').trim();
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

  function isRetiredText(str) {
    if (!str) return false;
    const t = String(str).toLowerCase().trim();
    return t.includes('retirado') || t.includes('retired') || t.includes('fim de carreira') || t.includes('carreira terminada') || t.includes('aposentado') || t.includes('end of career');
  }

  function getPlayerTeam() {
    const pageText = document.body?.innerText || '';
    if (isRetiredText(pageText) && !document.querySelector('a[href*="/team/football/"]')) {
      return 'Retirado';
    }

    const teamLink = document.querySelector('a[href*="/team/football/"], a[href*="/team/"]');
    if (teamLink) {
      if (teamLink.children.length > 0) {
        const firstChildText = cleanTeamName(teamLink.children[0].textContent);
        if (isRetiredText(firstChildText)) return 'Retirado';
        if (firstChildText) return firstChildText;
      }
      const cleaned = cleanTeamName(teamLink.textContent);
      if (isRetiredText(cleaned)) return 'Retirado';
      if (cleaned) return cleaned;
    }

    const teamLogoImg = document.querySelector('img[src*="/team/"], img[alt*="logo"]');
    if (teamLogoImg) {
      const parentContainer = teamLogoImg.closest('div, a');
      if (parentContainer) {
        if (parentContainer.children.length > 0) {
          for (const child of parentContainer.children) {
            if (child.tagName !== 'IMG') {
              const txt = cleanTeamName(child.textContent);
              if (isRetiredText(txt)) return 'Retirado';
              if (txt) return txt;
            }
          }
        }
        const text = cleanTeamName(parentContainer.textContent);
        if (isRetiredText(text)) return 'Retirado';
        if (text) return text;
      }
    }

    const metaTitle = document.querySelector('meta[property="og:title"]')?.content || '';
    if (metaTitle.includes(' – ') || metaTitle.includes(' - ')) {
      const parts = metaTitle.split(/\s+[–-]\s+/);
      if (parts.length > 1) {
        const teamFromMeta = cleanTeamName(parts[1].replace(/estatísticas.*/i, ''));
        if (isRetiredText(teamFromMeta)) return 'Retirado';
        return teamFromMeta;
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

    console.log('[Batch-Importador] Extraído com sucesso:', { team, position, url });

    chrome.runtime.sendMessage({
      type: 'SOFASCORE_DATA_EXTRACTED',
      data: {
        equipa: team,
        posicao: position,
        url: url
      }
    });
  }

  setTimeout(doExtraction, 800);
})();
