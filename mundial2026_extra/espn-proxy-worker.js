// Cloudflare Worker grátis para desbloquear CORS da ESPN.
// Usa este ficheiro apenas se o browser bloquear o endpoint ESPN direto.
// Depois de publicares o Worker, coloca o URL em script.js:
// const ESPN_PROXY_URL = 'https://o-teu-worker.workers.dev';

export default {
  async fetch(request) {
    const reqUrl = new URL(request.url);
    const target = reqUrl.searchParams.get('url');

    const espnUrl = target && target.startsWith('https://site.api.espn.com/')
      ? target
      : 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

    const response = await fetch(espnUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'no-store'
      }
    });
  }
};
