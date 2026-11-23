'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Writable } = require('node:stream');
const { build, files } = require('../scripts/build.cjs');
const { createServer } = require('../scripts/dev-server.cjs');

async function main() {
  const output = build();
  assert.equal(build(), output);
  for (const file of files) assert.ok(fs.statSync(path.join(output, file)).isFile(), file);
  for (const entry of ['index.html', 'contoso-sharepoint/index.html']) {
    const html = fs.readFileSync(path.join(output, entry), 'utf8');
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const value = match[1];
      if (/^(?:https?:|#|data:)/i.test(value)) continue;
      assert.ok(fs.existsSync(path.resolve(output, path.dirname(entry), value)), `${entry}: ${value}`);
    }
  }
  const server = createServer(output);
  const request = (target, method = 'GET') => new Promise((resolve, reject) => {
    const chunks = [], response = new Writable({
      write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); }
    });
    response.writeHead = (status, headers = {}) => {
      response.status = status;
      response.headers = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
      return response;
    };
    response.on('error', reject);
    response.on('finish', () => resolve({ status: response.status, headers: response.headers, body: Buffer.concat(chunks) }));
    server.emit('request', { url: target, method }, response);
  });
  const home = await request('/');
  assert.equal(home.status, 200);
  assert.match(home.headers['content-type'], /text\/html/);
  assert.match(home.body.toString('utf8'), /<html/i);
  const sharepoint = await request('/contoso-sharepoint/index.html?admin');
  assert.equal(sharepoint.status, 200);
  assert.match(sharepoint.body.toString('utf8'), /SharePoint demonstration/);
  const script = await request('/contoso-sharepoint/app.js', 'HEAD');
  assert.equal(script.status, 200);
  assert.match(script.headers['content-type'], /javascript/);
  assert.equal(script.body.length, 0);
  assert.equal((await request('/README.md')).status, 404);
  assert.equal((await request('/%2e%2e%2fREADME.md')).status, 403);
  assert.equal((await request('/', 'POST')).status, 405);
  console.log('Static delivery checks passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
