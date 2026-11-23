'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { files, directories } = require('./build.cjs');

const root = path.resolve(__dirname, '..');
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2'
};

function createServer(base = root) {
  const realBase = fs.realpathSync(base);
  const inside = candidate => candidate === realBase || candidate.startsWith(realBase + path.sep);
  const allowed = candidate => {
    const relative = path.relative(realBase, candidate).split(path.sep).join('/');
    return files.includes(relative) || directories.some(dir => relative.startsWith(dir + '/'));
  };
  return http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400).end(); return; }
    if (pathname.includes('\0') || pathname.includes('\\')) { response.writeHead(400).end(); return; }
    const target = path.resolve(realBase, '.' + pathname, ...(pathname.endsWith('/') ? ['index.html'] : []));
    if (!inside(target)) { response.writeHead(403).end(); return; }
    if (!allowed(target)) {
      response.writeHead(404).end(); return;
    }
    fs.realpath(target, (error, realTarget) => {
      if (error) { response.writeHead(404).end(); return; }
      if (!inside(realTarget)) { response.writeHead(403).end(); return; }
      if (!allowed(realTarget)) { response.writeHead(403).end(); return; }
      fs.stat(realTarget, (statError, stat) => {
        if (statError || !stat.isFile()) { response.writeHead(404).end(); return; }
        response.writeHead(200, {
          'Content-Type': types[path.extname(realTarget).toLowerCase()] || 'application/octet-stream',
          'Content-Length': stat.size,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        if (request.method === 'HEAD') { response.end(); return; }
        fs.createReadStream(realTarget).on('error', () => response.destroy()).pipe(response);
      });
    });
  });
}

if (require.main === module) {
  const rawPort = process.env.PORT || '4173';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT doit être un entier compris entre 1 et 65535.');
    process.exitCode = 1;
  } else {
    const server = createServer();
    server.on('error', error => { console.error(`Démarrage impossible : ${error.message}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`Simulateur local : http://127.0.0.1:${port}/`));
  }
}

module.exports = { createServer };
