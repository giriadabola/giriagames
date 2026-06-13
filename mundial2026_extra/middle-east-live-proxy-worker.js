// Cloudflare Worker opcional para evitar CORS.
// Regra: devolve JSON/texto da fonte, mas NÃO calcula minutos.
// A app só aceita minuto se vier explicitamente na resposta original.

export default {
  async fetch(request) {
    const reqUrl = new URL(request.url);
    const target = reqUrl.searchParams.get('url');
    const source = reqUrl.searchParams.get('source') || 'middle-east-live';

    if (!target || !/^https:\/\/(www\.)?(yallakora\.com|365scores\.com)\//i.test(target)) {
      return new Response(JSON.stringify({ error: 'URL não permitida', source }), {
        status: 400,
        headers: corsHeaders('application/json')
      });
    }

    const upstream = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
        'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9,pt;q=0.8'
      }
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: corsHeaders(upstream.headers.get('content-type') || 'text/html; charset=utf-8')
    });
  }
};

function corsHeaders(contentType) {
  return {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Cache-Control': 'no-store'
  };
}
