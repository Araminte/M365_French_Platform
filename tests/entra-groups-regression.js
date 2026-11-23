'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
let stored = null;
function launch(route) {
  const elements = {app: {innerHTML: ''}, 'overlay-root': {innerHTML: ''}, 'toast-root': {appendChild() {}}, 'form-error': {textContent: ''}};
  const events = {}, windowEvents = {}, opened = [], downloads = [], timers = []; let blob;
  const context = {
    window: {addEventListener(type,fn) { windowEvents[type]=fn; }, open(...args) { opened.push(args); return {}; }}, location: {hash: '#' + route, href:'file:///lab/index.html#'+route},
    localStorage: {getItem() { return stored; }, setItem(_, value) { stored = value; }},
    Blob: class { constructor(parts,options){this.parts=parts;this.type=options.type;} }, URL:class extends URL { static createObjectURL(value){blob=value;return 'blob:test';} static revokeObjectURL(){} }, document: {body:{appendChild(){}},querySelector(selector) { return selector === '#app' ? elements.app : selector === '#form-error' ? elements['form-error'] : ['#form-overview-suggestion-filter','#form-overview-suggestion-resource'].includes(selector) && elements.app.innerHTML.includes('id="'+selector.slice(1)+'"') ? {parentElement:{contains(target){return !!target.closest('.suggestion-filter-anchor');}},remove(){}} : null; }, getElementById(id) { return elements[id]; }, addEventListener(type, fn) { events[type] = fn; }, querySelectorAll() { return []; }, createElement() { return {click(){downloads.push({filename:this.download,blob});},remove() {}}; }},
    FormData: class { constructor(form) { this.values = form.values; } get(key) { return this.values[key] || null; } getAll(key) { const value = this.values[key]; return Array.isArray(value) ? value : value ? [value] : []; } has(key) { return Object.hasOwn(this.values, key); } },
    FileReader: class { readAsDataURL(file) { this.result=file.data; if (this.onload) this.onload(); } },
    navigator: {}, setTimeout(fn,delay) { const timer={fn,delay,cancelled:false}; timers.push(timer); return timer; }, clearTimeout(timer) { timer.cancelled=true; }, console, confirm() { return true; }
  };
  vm.createContext(context);
  for (const file of ['data.js', 'icons.js', 'app.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  return {elements, events, windowEvents, opened, downloads, timers, document: context.document, navigator: context.navigator, location: context.location, setConfirm(fn) { context.confirm = fn; }};
}
function click(app, action, arg = '') { app.events.click({preventDefault() {}, target: {closest(selector) { return selector === '[data-action]' ? {dataset: {action, arg}} : selector === '.m365-view-anchor' && ['m365-view-menu','m365-standard-list','m365-view-select'].includes(action) ? {} : selector === '.m365-contacts-more-anchor' && ['m365-contacts-more','m365-contacts-view-toggle','m365-contacts-view','m365-contacts-refresh'].includes(action) ? {} : selector === '.m365-filter' && ['m365-filter-open','m365-filter-clear'].includes(action) ? {} : selector === '.enterprise-policy-filter-anchor' && action === 'enterprise-policy-filter-toggle' ? {} : selector === '.launcher-info-anchor' && action === 'app-launcher-info' ? {} : selector === '.entra-home-add-wrap' && action === 'entra-home-add' ? {} : selector === '.suggestion-filter-anchor' && ['suggestion-filter-toggle','suggestion-filter-edit','suggestion-filter-close','suggestion-resource-toggle','suggestion-resource-close'].includes(action) ? {} : selector === '.restricted-filter-anchor' && ['restricted-panel','restricted-panel-close'].includes(action) ? {} : selector === '.restricted-download-anchor' && ['restricted-signin-download-toggle','restricted-signin-download'].includes(action) ? {} : selector === '.restricted-view-anchor' && ['restricted-signin-view-toggle','restricted-signin-columns','restricted-signin-copy'].includes(action) ? {} : selector === '.recommendation-resource-menu-anchor' && ['recommendation-resource-menu','recommendation-resource-set-status'].includes(action) ? {} : selector === '.recommendation-date-anchor' && ['recommendation-resource-date','recommendation-resource-date-apply','recommendation-resource-date-cancel'].includes(action) ? {} : null; }}}); }
function submit(app, id, values) { app.events.submit({preventDefault() {}, target: {id, values, matches() { return true; }}}); }

const seed={window:{}}; vm.createContext(seed); vm.runInContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),seed);
const data=JSON.parse(JSON.stringify(seed.window.LAB_DATA.initial));
data.groups=[
  {id:'cloud',name:'Nuage fictif',type:'Security',membership:'Assigned',source:'Cloud',onPremisesSyncEnabled:true,members:[],owners:[]},
  {id:'local',name:'Local fictif',type:'Security',membership:'Assigned',source:'Windows Server AD',members:[],owners:[]}
];
data.deletedGroups=[
  {id:'unknown',name:'Inconnu fictif',type:'Security',members:[],owners:[]},
  {id:'device',name:'Appareil fictif',type:'Security',membership:'Dynamic Device',members:[],owners:[]}
];
stored=JSON.stringify(data);
let app=launch('entra/groups-overview');
click(app,'entra-groups-overview-filter','cloud');
assert.match(app.elements.app.innerHTML,/Nuage fictif/);
assert.doesNotMatch(app.elements.app.innerHTML,/Local fictif/);
app=launch('entra/groups-overview');
click(app,'entra-groups-overview-filter','local');
assert.match(app.elements.app.innerHTML,/Local fictif/);
assert.doesNotMatch(app.elements.app.innerHTML,/Nuage fictif/);
app=launch('entra/groups-deleted');
assert.match(app.elements.app.innerHTML,/Inconnu fictif<\/td><td>—<\/td>/);
assert.match(app.elements.app.innerHTML,/Appareil fictif<\/td><td>Appareil dynamique<\/td>/);
console.log('OK : sources et types d’appartenance des groupes fictifs');

