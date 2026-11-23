'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer } = require('../scripts/dev-server.cjs');

async function main() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const get = target => new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port: server.address().port, path: target }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('error', reject);
  });
  try {
    const home = await get('/');
    assert.equal(home.status, 200);
    assert.match(home.body, /<html/i);
    const sharepoint = await get('/contoso-sharepoint/index.html?admin');
    assert.equal(sharepoint.status, 200);
    assert.match(sharepoint.body, /SharePoint demonstration/);
    const script = await get('/contoso-sharepoint/app.js');
    assert.equal(script.status, 200);
    assert.match(script.body, /function renderNormalSite/);
    assert.equal((await get('/README.md')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('Local HTTP checks passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
