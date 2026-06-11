const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const squadsPath = path.join(root, 'squads.json');
const editorPath = path.join(root, 'editar-fotos-jogadores.html');
const port = Number(process.env.PORT || 8787);

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function safeRead(file) {
  return fs.readFileSync(file);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/editar-fotos-jogadores.html')) {
      return send(res, 200, safeRead(editorPath), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/api/squads') {
      return send(res, 200, safeRead(squadsPath), 'application/json; charset=utf-8');
    }
    if (req.method === 'POST' && url.pathname === '/api/squads') {
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 25 * 1024 * 1024) req.destroy(); });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (!parsed || typeof parsed !== 'object' || !parsed.teams) throw new Error('JSON inválido: falta teams');
          const backup = path.join(root, `squads.backup.${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
          if (fs.existsSync(squadsPath)) fs.copyFileSync(squadsPath, backup);
          fs.writeFileSync(squadsPath, JSON.stringify(parsed, null, 2), 'utf8');
          send(res, 200, JSON.stringify({ ok: true, backup: path.basename(backup) }), 'application/json; charset=utf-8');
        } catch (err) {
          send(res, 400, JSON.stringify({ ok: false, error: err.message }), 'application/json; charset=utf-8');
        }
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/squads.json') {
      return send(res, 200, safeRead(squadsPath), 'application/json; charset=utf-8');
    }
    send(res, 404, 'Não encontrado');
  } catch (err) {
    send(res, 500, err.stack || err.message);
  }
});

server.listen(port, () => {
  console.log('Editor aberto em:');
  console.log(`http://localhost:${port}/editar-fotos-jogadores.html`);
  console.log('Mantém este terminal aberto enquanto editas/gravas.');
});
