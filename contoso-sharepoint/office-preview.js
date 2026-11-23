'use strict';

// Text-only extraction runs in the browser and never uploads a document.
const OfficePreview = (() => {
  const MAX_ARCHIVE = 3 * 1024 * 1024;
  const MAX_XML = 1024 * 1024;
  const MAX_ENTRIES = 1500;
  const MAX_CHARS = 40000;

  function decodeArchive(dataUrl) {
    const match = /^data:[^,]*;base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(String(dataUrl || ''));
    if (!match || match[1].length > Math.ceil(MAX_ARCHIVE * 4 / 3) + 8) throw new Error('Document trop volumineux ou illisible.');
    const binary = atob(match[1]);
    if (binary.length > MAX_ARCHIVE || binary.length < 22) throw new Error('Archive Office invalide.');
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
    }
    if (end < 0 || view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0 ||
        view.getUint16(end + 8, true) !== view.getUint16(end + 10, true) || view.getUint16(end + 10, true) > MAX_ENTRIES ||
        view.getUint32(end + 12, true) === 0xffffffff || view.getUint32(end + 16, true) === 0xffffffff ||
        view.getUint32(end + 16, true) + view.getUint32(end + 12, true) > end) throw new Error('Archive Office non prise en charge.');
    return bytes;
  }

  async function readXml(zip, path, optional = false) {
    const file = zip.file(path);
    if (!file) { if (optional) return null; throw new Error('Document Office incomplet.'); }
    const bytes = await new Promise((resolve, reject) => {
      const chunks = []; let size = 0, stopped = false;
      const stream = file.internalStream('uint8array');
      stream.on('data', chunk => {
        if (stopped) return;
        size += chunk.length;
        if (size > MAX_XML) { stopped = true; stream.pause(); reject(new Error('Contenu trop volumineux pour l’aperçu.')); return; }
        chunks.push(chunk);
      }).on('error', error => { if (!stopped) reject(error); }).on('end', () => {
        if (stopped) return;
        const result = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
        resolve(result);
      }).resume();
    });
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text)) throw new Error('Format XML non pris en charge.');
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) throw new Error('Document Office illisible.');
    return xml;
  }

  function elements(root, name) { return Array.from(root.getElementsByTagNameNS('*', name)); }
  function textNodes(root) { return elements(root, 't').map(node => node.textContent || '').join(''); }
  function lines(root) { return elements(root, 'p').map(textNodes).filter(Boolean); }
  function limited(parts) { return parts.join('\n').slice(0, MAX_CHARS); }

  async function word(zip) {
    const xml = await readXml(zip, 'word/document.xml');
    return limited(lines(xml).slice(0, 200));
  }

  async function orderedParts(zip, documentPath, relationsPath, elementName, partPrefix) {
    const document = await readXml(zip, documentPath);
    const relations = await readXml(zip, relationsPath);
    const lookup = new Map(elements(relations, 'Relationship').filter(rel => rel.getAttribute('TargetMode') !== 'External')
      .map(rel => [rel.getAttribute('Id'), rel.getAttribute('Target')]));
    const relationNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    return elements(document, elementName).map(node => {
      const target = lookup.get(node.getAttributeNS(relationNs, 'id') || node.getAttribute('r:id')) || '';
      const clean = target.replace(/^\/?(?:xl|ppt)\//, '');
      return { name: node.getAttribute('name') || '', path: new RegExp('^' + partPrefix + '\\/\\w+\\d+\\.xml$').test(clean) ? documentPath.split('/')[0] + '/' + clean : '' };
    }).filter(part => part.path);
  }

  function excelValue(raw, type, formatId, date1904) {
    if (type === 'b') return raw === '1' ? 'VRAI' : raw === '0' ? 'FAUX' : raw;
    if ((type && type !== 'n') || raw === '') return raw;
    const dateOnly = (formatId >= 14 && formatId <= 17) || (formatId >= 27 && formatId <= 36) || (formatId >= 50 && formatId <= 58);
    const timeOnly = (formatId >= 18 && formatId <= 21) || (formatId >= 45 && formatId <= 47);
    if (!dateOnly && !timeOnly && formatId !== 22) return raw;
    const serial = Number(raw);
    if (!Number.isFinite(serial) || serial < 0 || serial > 2958465) return raw;
    let days = Math.floor(serial), seconds = Math.round((serial - days) * 86400);
    if (seconds === 86400) { days++; seconds = 0; }
    const pad = value => String(value).padStart(2, '0');
    const hours = formatId === 46 ? days * 24 + Math.floor(seconds / 3600) : Math.floor(seconds / 3600);
    const time = `${pad(hours)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
    if (timeOnly) return time;
    let day;
    if (!date1904 && days === 0) day = '0 (date Excel)';
    else if (!date1904 && days === 60) day = '1900-02-29 (Excel)';
    else {
      const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
      const adjusted = date1904 ? days : days - (days > 60 ? 1 : 0);
      const value = new Date(base + adjusted * 86400000);
      if (value.getUTCFullYear() > 9999) return raw;
      day = value.toISOString().slice(0, 10);
    }
    return formatId === 22 ? `${day} ${time}` : day;
  }

  async function excel(zip) {
    const sheets = await orderedParts(zip, 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'sheet', 'worksheets');
    if (!sheets.length) throw new Error('Feuille Excel introuvable.');
    const workbook = await readXml(zip, 'xl/workbook.xml');
    const workbookProperties = elements(workbook, 'workbookPr')[0];
    const date1904 = /^(?:1|true)$/i.test(workbookProperties?.getAttribute('date1904') || '');
    let styleXml = null;
    try { styleXml = await readXml(zip, 'xl/styles.xml', true); } catch { /* Keep raw values if styles cannot be read. */ }
    const cellXfs = styleXml && elements(styleXml, 'cellXfs')[0];
    const formats = cellXfs ? Array.from(cellXfs.childNodes).filter(node => node.nodeType === 1 && node.localName === 'xf').map(node => Number(node.getAttribute('numFmtId') || 0)) : [];
    const sharedXml = await readXml(zip, 'xl/sharedStrings.xml', true);
    const shared = sharedXml ? elements(sharedXml, 'si') : [];
    const output = ['Les formats Excel personnalisés peuvent apparaître en valeurs brutes.', ''];
    for (const sheet of sheets.slice(0, 4)) {
      const xml = await readXml(zip, sheet.path); output.push('Feuille : ' + (sheet.name || 'Sans nom'));
      for (const row of elements(xml, 'row').slice(0, 40)) {
        const values = [];
        for (const cell of elements(row, 'c').slice(0, 12)) {
          const ref = cell.getAttribute('r') || '', letters = /^([A-Z]+)/i.exec(ref);
          let column = letters ? Array.from(letters[1].toUpperCase()).reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : values.length;
          if (column < 0 || column >= 12) continue;
          const type = cell.getAttribute('t'), valueNode = elements(cell, 'v')[0];
          const raw = valueNode ? valueNode.textContent || '' : '';
          const sharedNode = type === 's' && /^\d+$/.test(raw) ? shared[Number(raw)] : null;
          values[column] = type === 's' ? (sharedNode ? textNodes(sharedNode) : '[Chaîne indisponible]') :
            type === 'inlineStr' ? textNodes(cell) : excelValue(raw, type, formats[Number(cell.getAttribute('s') || 0)] || 0, date1904);
        }
        if (values.some(Boolean)) output.push(Array.from({ length: values.length }, (_, i) => values[i] || '').join('  |  '));
      }
      output.push('');
    }
    return limited(output);
  }

  async function powerpoint(zip) {
    const slides = await orderedParts(zip, 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels', 'sldId', 'slides');
    if (!slides.length) throw new Error('Diapositive introuvable.');
    const output = [];
    for (let i = 0; i < Math.min(slides.length, 8); i++) {
      const xml = await readXml(zip, slides[i].path); output.push('Diapositive ' + (i + 1), ...lines(xml).slice(0, 100), '');
    }
    return limited(output);
  }

  async function extract(dataUrl, extension) {
    if (typeof JSZip === 'undefined' || typeof DOMParser === 'undefined') throw new Error('Aperçu indisponible.');
    const bytes = decodeArchive(dataUrl), zip = await JSZip.loadAsync(bytes);
    if (Object.keys(zip.files).length > MAX_ENTRIES) throw new Error('Archive Office trop complexe.');
    const ext = String(extension || '').toLowerCase();
    if (ext === 'docx') return word(zip);
    if (ext === 'xlsx') return excel(zip);
    if (ext === 'pptx') return powerpoint(zip);
    throw new Error('Format non pris en charge.');
  }
  return { extract };
})();

if (typeof module !== 'undefined') module.exports = OfficePreview;
