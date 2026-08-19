const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const facesDirectory = path.join(projectRoot, 'assets', 'faces');
const port = 8765;

function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  response.end(JSON.stringify(data));
}

function downloadFace(id) {
  return new Promise((resolve, reject) => {
    const imageUrl = `https://sortitoutsi.b-cdn.net/uploads/face/face_${id}.png`;
    https.get(imageUrl, remoteResponse => {
      if (remoteResponse.statusCode !== 200) {
        remoteResponse.resume();
        reject(new Error(`A imagem respondeu com HTTP ${remoteResponse.statusCode}.`));
        return;
      }

      fs.mkdirSync(facesDirectory, { recursive: true });
      const destination = path.join(facesDirectory, `face_${id}.png`);
      const file = fs.createWriteStream(destination);
      remoteResponse.pipe(file);
      file.on('finish', () => file.close(() => resolve(destination)));
      file.on('error', error => {
        file.destroy();
        reject(error);
      });
    }).on('error', reject);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    response.end();
    return;
  }

  if (request.method !== 'POST' || request.url !== '/download-face') {
    sendJson(response, 404, { ok: false, error: 'Rota não encontrada.' });
    return;
  }

  let body = '';
  request.on('data', chunk => { body += chunk; });
  request.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      const id = String(payload.id || '');
      if (!/^\d+$/.test(id)) throw new Error('ID de jogador inválido.');

      const destination = await downloadFace(id);
      sendJson(response, 200, { ok: true, id, file: destination });
      console.log(`Imagem guardada: ${destination}`);
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message });
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Servidor de imagens activo em http://127.0.0.1:${port}`);
  console.log(`Destino: ${facesDirectory}`);
});