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
  const playerSlug = window.location.pathname.match(/\/player\/([^/]+)/i)?.[1];
  if (playerSlug) return titleCasePlayerName(decodeURIComponent(playerSlug));

  const metaTitle = document.querySelector('meta[property="og:title"]')?.content || '';
  const cleanedMetaTitle = metaTitle.split(/\s+[–-]\s+/)[0].trim();
  if (cleanedMetaTitle && !/estatísticas|statistics|scores|golos|goals/i.test(cleanedMetaTitle)) return cleanedMetaTitle;

  const heading = [...document.querySelectorAll('h1')]
    .map(element => element.textContent.trim())
    .find(value => value && !/estatísticas|statistics|scores|golos|goals/i.test(value));
  return heading || document.title.split(/\s+[–-]\s+/)[0].trim();
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'EXTRACT_SOFASCORE_PLAYER') return;

  const name = getPlayerName();
  const bodyText = document.body?.innerText?.trim() || '';
  if (!name || bodyText.length < 20) {
    sendResponse({ ok: false, error: 'Não foi possível detectar a página de um jogador no Sofascore.' });
    return;
  }

  const statsText = extractStatsText(bodyText, name);

  sendResponse({ ok: true, name, text: `${name}\n${bodyText}`, statsText });
});