// Static server for the game: serves game/ on http://localhost:8080
// and answers /healthz. Run with: node serve.ts [--host 0.0.0.0]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve, extname } from 'node:path';

const ROOT = resolve(import.meta.dirname || '.');
const PORT = Number(process.env.PORT || 8080);
const HOST = (() => {
  const i = process.argv.indexOf('--host');
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : '127.0.0.1';
})();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
};

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, game: 'Solmarina: Streets of Gold' }));
    return;
  }
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`Solmarina serving ${ROOT} on http://${HOST}:${PORT}`);
});
