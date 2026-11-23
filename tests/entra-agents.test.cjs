const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('app.js', 'utf8');
const start = source.indexOf('  function renderEntraAgents(){');
const end = source.indexOf('  const agentSignInFields=', start);
assert(start >= 0 && end > start);
const render = new Function('ui', 'db', 'normal', 'attr', 'esc', 'icon', 'actionBtn', 'listSearch', 'table', 'crumb', 'renderAgentSignins', source.slice(start, end) + '\nreturn renderEntraAgents();');
const agents = [
  {id:'1', name:'First', status:'Active', createdAt:'2026-01-01', cimdUrl:'https://z.example/metadata'},
  {id:'2', name:'Second', status:'Active', createdAt:'2026-01-01', cimdUrl:'https://a.example/metadata'},
  {id:'3', name:'Third', status:'Active', createdAt:'2026-01-01'}
];
const ui = {entraAgentView:'identities', entraAgentSort:{key:'Client ID Metadata Document URL', desc:false}};
const html = render(ui, {entraAgents:agents}, s=>String(s).toLowerCase(), String, String, ()=>'', label=>label, ()=>'', (headers, rows)=>rows.join(''), ()=>'', ()=>'');
assert(html.includes('Simulation locale'));
assert(html.includes('https://a.example/metadata'));
assert(html.indexOf('https://a.example/metadata') < html.indexOf('https://z.example/metadata'));
assert(html.includes('Third</td><td>1/1/2026</td>') || html.includes('Third</td><td>01/01/2026</td>'));
assert(html.includes('<td>—</td>'));
console.log('Entra Agents: CIMD display, sorting and simulation notice verified.');
