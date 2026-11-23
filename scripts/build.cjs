'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const files = [
  'index.html', 'styles.css', 'data.js', 'app.js',
  'contoso-sharepoint/index.html', 'contoso-sharepoint/style.css',
  'contoso-sharepoint/app.js', 'contoso-sharepoint/office-preview.js',
  'contoso-sharepoint/demo-documents.js', 'contoso-sharepoint/document-tree.js',
  'contoso-sharepoint/admin-settings.js', 'contoso-sharepoint/admin-collections.js',
  'contoso-sharepoint/admin-content.js', 'contoso-sharepoint/admin.js',
  'contoso-sharepoint/page-editor.js', 'contoso-sharepoint/site-lists.js',
  'contoso-sharepoint/source-spfx/Apercu-HTML/styles.css',

];
const directories = [
  'assets', 'contoso-sharepoint/assets', 'contoso-sharepoint/vendor'
];

function statLink(file) {
  try { return fs.lstatSync(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function ensureDirectory(directory) {
  const relative = path.relative(root, directory);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Destination hors du projet.');
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const info = statLink(current);
    if (info) {
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`Dossier de sortie invalide : ${current}`);
    } else fs.mkdirSync(current);
  }
}

function copy(relative) {
  const source = path.join(root, relative), destination = path.join(output, relative);
  const info = statLink(source);
  if (!info) throw new Error(`Ressource absente : ${relative}`);
  if (info.isSymbolicLink()) throw new Error(`Lien symbolique non pris en charge : ${relative}`);
  if (info.isDirectory()) {
    ensureDirectory(destination);
    for (const entry of fs.readdirSync(source)) copy(path.join(relative, entry));
  } else if (info.isFile()) {
    ensureDirectory(path.dirname(destination));
    const previous = statLink(destination);
    if (previous && (!previous.isFile() || previous.isSymbolicLink())) {
      throw new Error(`Fichier de sortie invalide : ${destination}`);
    }
    fs.copyFileSync(source, destination);
  } else throw new Error(`Ressource non prise en charge : ${relative}`);
}

function build() {
  for (const relative of [...files, ...directories]) copy(relative);
  return output;
}

if (require.main === module) {
  try { console.log(`Fichiers statiques préparés dans ${build()}`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { build, files, directories };
