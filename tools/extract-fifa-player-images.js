#!/usr/bin/env node
/**
 * Scraper local de apoio para tentar associar fotografias da página de plantel
 * da FIFA aos jogadores existentes no squads.json.
 *
 * Uso:
 *   node tools/extract-fifa-player-images.js mexico --show
 *   node tools/extract-fifa-player-images.js portugal --show
 *
 * Dica: usa --show, aceita cookies se aparecerem e deixa a página carregar.
 * O script guarda ficheiros de debug e atualiza o campo image no squads.json.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flags = new Set(args.filter(x => x.startsWith('--')));
const slugs = args.filter(x => !x.startsWith('--'));
const SHOW = flags.has('--show') || flags.has('--visible');
const DEBUG = flags.has('--debug') || SHOW;
const WAIT_MS = Number((args.find(x => x.startsWith('--wait=')) || '').split('=')[1] || (SHOW ? 30000 : 9000));

if (!slugs.length) {
  console.error('Indica pelo menos um slug. Ex.: node tools/extract-fifa-player-images.js mexico --show');
  process.exit(1);
}

const TEAM_ALIASES = {
  mexico: ['México', 'Mexico', 'MEX'], portugal: ['Portugal', 'POR'], argentina: ['Argentina', 'ARG'],
  brazil: ['Brasil', 'Brazil', 'BRA'], england: ['Inglaterra', 'England', 'ENG'], france: ['França', 'France', 'FRA'],
  spain: ['Espanha', 'Spain', 'ESP'], germany: ['Alemanha', 'Germany', 'GER'], italy: ['Itália', 'Italy', 'ITA'],
  netherlands: ['Países Baixos', 'Netherlands', 'NED'], belgium: ['Bélgica', 'Belgium', 'BEL'],
  croatia: ['Croácia', 'Croatia', 'CRO'], uruguay: ['Uruguai', 'Uruguay', 'URU'],
  usa: ['Estados Unidos', 'United States', 'USA'], 'united-states': ['Estados Unidos', 'United States', 'USA'],
  japan: ['Japão', 'Japan', 'JPN'], 'south-korea': ['Coreia do Sul', 'Korea Republic', 'South Korea'],
  morocco: ['Marrocos', 'Morocco'], senegal: ['Senegal'], ghana: ['Gana', 'Ghana'],
  'south-africa': ['África do Sul', 'South Africa'], tunisia: ['Tunísia', 'Tunisia'], egypt: ['Egito', 'Egypt'],
  algeria: ['Argélia', 'Algeria'], canada: ['Canadá', 'Canada']
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function splitNameParts(name) { return normalizeName(name).split(' ').filter(x => x.length >= 3); }
function cleanImageUrl(url) {
  if (!url) return '';
  let out = String(url).replace(/&amp;/g, '&').replace(/\\\//g, '/');
  if (out.startsWith('//')) out = 'https:' + out;
  try {
    const u = new URL(out);
    // Next/Image e similares costumam guardar a imagem real no parâmetro url.
    const nested = u.searchParams.get('url') || u.searchParams.get('src');
    if (nested && /\.(png|jpe?g|webp)(\?|$)/i.test(nested)) return cleanImageUrl(decodeURIComponent(nested));
  } catch {}
  return out;
}
function isLikelyPlayerImage(url) {
  const u = String(url || '');
  if (!/^https?:\/\//i.test(u)) return false;
  if (!/\.(png|jpe?g|webp)(\?|$)/i.test(u) && !/image|img|cloudinary|digitalhub|fifa|contentstack|media/i.test(u)) return false;
  if (/logo|flag|badge|sponsor|icon|sprite|avatar-default|placeholder|trophy|background/i.test(u)) return false;
  return true;
}
function bestKnownPlayer(context, knownPlayers) {
  const text = normalizeName(context);
  if (!text) return null;
  let best = null;
  for (const p of knownPlayers) {
    const names = [p.name, p.officialPlayerName, p.shirtName].filter(Boolean);
    for (const name of names) {
      const n = normalizeName(name);
      if (!n) continue;
      const parts = splitNameParts(name);
      const hits = parts.filter(part => text.includes(part)).length;
      const exact = text.includes(n);
      const goodEnough = exact || hits >= Math.min(2, Math.max(1, parts.length));
      if (goodEnough) {
        const score = (exact ? 10 : 0) + hits + n.length / 100;
        if (!best || score > best.score) best = { player: p, score, matchedName: name };
      }
    }
  }
  return best;
}
function loadSquads() {
  const squadsPath = path.resolve('squads.json');
  if (!fs.existsSync(squadsPath)) return null;
  return JSON.parse(fs.readFileSync(squadsPath, 'utf8'));
}
function findTeamForSlug(squads, slug) {
  const teams = squads?.teams || squads || {};
  const aliases = (TEAM_ALIASES[slug] || [slug]).map(normalizeName);
  return Object.values(teams).find(t => {
    const names = [t.name, t.officialName, t.code, t.fifaCode].filter(Boolean).map(normalizeName);
    return names.some(n => aliases.includes(n)) || aliases.some(a => names.includes(a));
  });
}
function knownPlayersForSlug(squads, slug) {
  const team = findTeamForSlug(squads, slug);
  return Array.isArray(team?.players) ? team.players : [];
}
async function acceptCookies(page) {
  const words = ['accept all', 'accept', 'agree', 'aceitar tudo', 'aceitar', 'allow all'];
  try {
    const buttons = await page.$$('button, [role="button"]');
    for (const btn of buttons) {
      const label = await page.evaluate(el => (el.innerText || el.textContent || '').trim().toLowerCase(), btn);
      if (label && words.some(w => label.includes(w))) { await btn.click().catch(() => {}); await sleep(1500); return; }
    }
  } catch {}
}
async function scrollDeep(page) {
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => window.scrollBy(0, Math.max(700, window.innerHeight * 0.85)));
    await sleep(900);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(900);
}
async function extractPageCandidates(page, knownPlayers) {
  const known = knownPlayers.map(p => ({
    id: p.id, name: p.name || '', shirtName: p.shirtName || '', officialPlayerName: p.officialPlayerName || ''
  }));
  return await page.evaluate((known) => {
    const abs = value => { try { return new URL(value, location.href).href; } catch { return value || ''; } };
    const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const nameParts = p => [p.name, p.shirtName, p.officialPlayerName].filter(Boolean).flatMap(n => norm(n).split(' ').filter(x => x.length >= 3));
    const containsKnown = text => {
      const t = norm(text);
      return known.find(p => {
        const names = [p.name, p.shirtName, p.officialPlayerName].filter(Boolean).map(norm);
        if (names.some(n => n && t.includes(n))) return true;
        const parts = nameParts(p);
        return parts.length && parts.filter(part => t.includes(part)).length >= Math.min(2, parts.length);
      });
    };
    const rows = [];
    const add = (src, context, method) => {
      if (!src) return;
      rows.push({ image: abs(src), context: String(context || '').slice(0, 1200), method });
    };
    const urlsFromSrcset = srcset => String(srcset || '').split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean);
    const imageUrlsFromEl = el => {
      const urls = [];
      if (el.tagName === 'IMG') {
        urls.push(el.currentSrc, el.src, el.getAttribute('src'), el.getAttribute('data-src'), el.getAttribute('data-lazy-src'));
        urlsFromSrcset(el.getAttribute('srcset')).forEach(u => urls.push(u));
      }
      if (el.tagName === 'SOURCE') urlsFromSrcset(el.getAttribute('srcset')).forEach(u => urls.push(u));
      const style = el.getAttribute?.('style') || '';
      [...style.matchAll(/url\(["']?([^"')]+)["']?\)/g)].forEach(m => urls.push(m[1]));
      try {
        const bg = getComputedStyle(el).backgroundImage || '';
        [...bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)].forEach(m => urls.push(m[1]));
      } catch {}
      return urls.filter(Boolean);
    };
    const contextFor = el => {
      let cur = el;
      let best = '';
      for (let i = 0; cur && i < 9; i++, cur = cur.parentElement) {
        const text = (cur.innerText || cur.textContent || '').trim();
        if (text && text.length > best.length) best = text;
        if (containsKnown(text)) return text;
      }
      return best || document.body.innerText.slice(0, 5000);
    };

    // 1) Elementos de imagem, source e elementos com background.
    for (const el of Array.from(document.querySelectorAll('img, source, [style]'))) {
      const ctx = contextFor(el);
      imageUrlsFromEl(el).forEach(u => add(u, ctx, 'element-or-bg'));
    }

    // 2) Para cada jogador conhecido, encontra texto na página e procura imagem no cartão/ancestral.
    const allElements = Array.from(document.querySelectorAll('a, article, li, section, div'));
    for (const p of known) {
      const parts = nameParts(p);
      const hit = allElements.find(el => {
        const t = norm(el.innerText || el.textContent || '');
        return parts.length && parts.filter(part => t.includes(part)).length >= Math.min(2, parts.length);
      });
      if (hit) {
        let cur = hit;
        for (let i = 0; cur && i < 6; i++, cur = cur.parentElement) {
          const imgs = Array.from(cur.querySelectorAll('img, source, [style]'));
          for (const img of imgs) imageUrlsFromEl(img).forEach(u => add(u, cur.innerText || hit.innerText || p.name, 'known-player-card'));
        }
      }
    }

    // 3) Regex no HTML para apanhar URLs escondidos no Next/data JSON.
    const html = document.documentElement.innerHTML;
    const rx = /https?:\\?\/\\?\/[^"'\\\s<>]+?(?:png|jpe?g|webp)(?:\?[^"'\\\s<>]*)?/gi;
    for (const m of html.matchAll(rx)) add(m[0].replace(/\\\//g, '/'), '', 'html-regex');

    return { title: document.title, url: location.href, bodyText: document.body.innerText.slice(0, 30000), rows };
  }, known);
}
async function main() {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch { console.error('Falta instalar puppeteer. Corre: npm i puppeteer'); process.exit(1); }
  const squads = loadSquads();
  if (!squads) { console.error('Não encontrei squads.json nesta pasta. Entra primeiro na pasta mundial2026_extra.'); process.exit(1); }
  const browser = await puppeteer.launch({
    headless: SHOW ? false : 'new', defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const associated = [];
  const allCandidates = [];
  for (const slug of slugs) {
    const knownPlayers = knownPlayersForSlug(squads, slug);
    if (!knownPlayers.length) console.log(`Aviso: não encontrei jogadores no squads.json para ${slug}.`);
    const url = `https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/teams/${slug}/squad`;
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9,pt-PT;q=0.8,pt;q=0.7' });
    await page.setViewport({ width: 1600, height: 1200 });

    console.log(`A abrir: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 }).catch(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    });
    await sleep(4000);
    await acceptCookies(page);
    if (SHOW) {
      console.log(`Modo visível: confirma que vês os cartões dos jogadores. Vou esperar ${Math.round(WAIT_MS/1000)}s...`);
      await sleep(WAIT_MS);
    }
    await scrollDeep(page);
    await page.waitForSelector('img, source, div, article', { timeout: 20000 }).catch(() => {});

    const data = await extractPageCandidates(page, knownPlayers);
    const debugBase = path.resolve(`fifa-debug-${slug}`);
    if (DEBUG) {
      fs.writeFileSync(`${debugBase}.html`, await page.content(), 'utf8');
      await page.screenshot({ path: `${debugBase}.png`, fullPage: true }).catch(() => {});
      console.log(`Debug guardado: ${debugBase}.html e ${debugBase}.png`);
    }

    let slugMatches = 0;
    for (const row of data.rows) {
      const image = cleanImageUrl(row.image);
      if (!isLikelyPlayerImage(image)) continue;
      const item = { teamSlug: slug, image, context: row.context || '', method: row.method };
      allCandidates.push(item);
      const match = bestKnownPlayer(`${row.context}\n${image}`, knownPlayers);
      if (match) {
        associated.push({
          teamSlug: slug,
          id: match.player.id,
          name: match.player.name,
          shirtName: match.player.shirtName,
          normalizedName: normalizeName(match.player.name),
          image,
          method: row.method,
          score: match.score,
          matchedName: match.matchedName
        });
        slugMatches++;
      }
    }
    console.log(`${slug}: ${allCandidates.filter(x => x.teamSlug === slug).length} candidatos, ${slugMatches} associações.`);
    await page.close();
  }
  await browser.close();

  const dedupe = (arr, keyFn) => {
    const seen = new Set(), out = [];
    for (const item of arr) { const key = keyFn(item); if (seen.has(key)) continue; seen.add(key); out.push(item); }
    return out;
  };
  const uniqueCandidates = dedupe(allCandidates, x => `${x.teamSlug}|${x.image}`);
  fs.writeFileSync(path.resolve('fifa-all-image-candidates.json'), JSON.stringify(uniqueCandidates, null, 2), 'utf8');

  // Se houver várias imagens para o mesmo jogador, fica a primeira encontrada por contexto do cartão.
  const uniqueAssociated = dedupe(associated, x => `${x.teamSlug}|${x.id || x.normalizedName}`);
  fs.writeFileSync(path.resolve('player-images-fifa.json'), JSON.stringify(uniqueAssociated, null, 2), 'utf8');

  let updated = 0;
  const teams = squads.teams || squads;
  for (const slug of slugs) {
    const team = findTeamForSlug(squads, slug);
    if (!team?.players) continue;
    for (const player of team.players) {
      const row = uniqueAssociated.find(x => x.teamSlug === slug && (x.id === player.id || normalizeName(x.name) === normalizeName(player.name)));
      if (row && row.image) {
        player.image = row.image;
        player.imageSource = 'FIFA';
        updated++;
      }
    }
  }
  fs.writeFileSync(path.resolve('squads.json'), JSON.stringify(squads, null, 2), 'utf8');
  console.log(`Criado: ${path.resolve('player-images-fifa.json')} (${uniqueAssociated.length} imagens associadas)`);
  console.log(`Candidatos totais: ${path.resolve('fifa-all-image-candidates.json')} (${uniqueCandidates.length})`);
  console.log(`squads.json atualizado com ${updated} imagens.`);
  if (!updated) {
    console.log('Se viste as imagens no browser mas deu 0, envia-me os ficheiros fifa-all-image-candidates.json e fifa-debug-<pais>.html para eu ajustar o seletor.');
  }
}
main().catch(err => { console.error(err); process.exit(1); });
