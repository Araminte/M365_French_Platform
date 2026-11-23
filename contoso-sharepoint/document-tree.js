'use strict';

// All operations return a new array so an invalid destination leaves the data untouched.
const DocumentTree = (() => {
  function descendants(items, id) {
    const result = [];
    const visited = new Set([id]);
    const queue = [id];
    while (queue.length) {
      const parent = queue.shift();
      for (const child of items.filter(item => item.parent === parent)) {
        if (visited.has(child.id)) throw new Error('Invalid folder hierarchy.');
        visited.add(child.id);
        result.push(child);
        queue.push(child.id);
      }
    }
    return result;
  }
  function roots(items, ids) {
    const chosen = new Set(ids);
    const selected = items.filter(item => chosen.has(item.id) && !item.deleted);
    if (!selected.length || selected.length !== chosen.size) throw new Error('Select available items.');
    return selected.filter(item => !selected.some(other => other.id !== item.id && descendants(items, other.id).some(x => x.id === item.id)));
  }
  function destination(items, lib, parent) {
    if (!Number.isInteger(lib) || lib < 0 || lib > 4) throw new Error('Choose a library.');
    if (parent !== null && !items.some(item => item.id === parent && item.kind === 'folder' && item.lib === lib && !item.deleted)) throw new Error('The destination folder is unavailable.');
  }
  function transfer(items, ids, lib, parent, copy, makeId) {
    destination(items, lib, parent);
    const list = roots(items, ids);
    for (const root of list) {
      if (root.id === parent || descendants(items, root.id).some(item => item.id === parent)) throw new Error('A folder cannot be placed inside itself.');
    }
    const next = structuredClone(items);
    for (const root of list) {
      const subtree = [root, ...descendants(items, root.id).filter(item => !copy || !item.deleted)];
      if (copy) {
        const idsByOld = new Map(subtree.map(item => [item.id, makeId()]));
        const existingNames = new Set(next.filter(item => !item.deleted && item.lib === lib && item.parent === parent).map(item => item.name.toLowerCase()));
        let name = root.name;
        if (existingNames.has(name.toLowerCase())) {
          let n = 1;
          do { name = `Copy${n > 1 ? ' ' + n : ''} of ${root.name}`; n++; } while (existingNames.has(name.toLowerCase()));
        }
        for (const original of subtree) {
          const item = structuredClone(original);
          item.id = idsByOld.get(original.id);
          item.lib = lib;
          item.parent = original.id === root.id ? parent : idsByOld.get(original.parent);
          // A copied item starts a separate history and does not inherit the
          // source's local share links, direct shares, or checkout state.
          delete item.versions;
          delete item.shares;
          delete item.linkSettings;
          delete item.normalLinks;
          delete item.normalLinkSettings;
          delete item.checkout;
          delete item.pinned;
          delete item.pinOrder;
          if (original.id === root.id) item.name = name;
          next.push(item);
        }
      } else {
        if (next.some(item => !item.deleted && item.lib === lib && item.parent === parent && item.id !== root.id && item.name.toLowerCase() === root.name.toLowerCase())) throw new Error('An item with this name already exists at the destination.');
        const idsInTree = new Set(subtree.map(item => item.id));
        for (const item of next) if (idsInTree.has(item.id)) { if (item.id === root.id) { if (item.lib !== lib || item.parent !== parent) { delete item.pinned; delete item.pinOrder; } item.parent = parent; } item.lib = lib; }
      }
    }
    return next;
  }
  function recycle(items, ids, makeId) {
    const list = roots(items, ids);
    const next = structuredClone(items);
    for (const root of list) {
      const group = makeId();
      const idsInTree = new Set([root, ...descendants(items, root.id)].filter(x => !x.deleted).map(x => x.id));
      for (const item of next) if (idsInTree.has(item.id)) { item.deleted = true; item.deletedGroup = group; item.deletedRoot = item.id === root.id; if(item.id===root.id){delete item.pinned;delete item.pinOrder} }
    }
    return next;
  }
  function restore(items, ids) {
    const next = structuredClone(items);
    const depth = id => {
      let item = next.find(x => x.id === id), level = 0;
      const seen = new Set();
      while (item && item.parent) {
        if (seen.has(item.id)) throw new Error('Invalid folder hierarchy.');
        seen.add(item.id);
        item = next.find(x => x.id === item.parent);
        level++;
      }
      return level;
    };
    for (const id of [...ids].sort((a, b) => depth(a) - depth(b))) {
      const item = next.find(x => x.id === id && x.deleted);
      if (!item) throw new Error('The deleted item is unavailable.');
      const parent = item.parent && next.find(x => x.id === item.parent && x.kind === 'folder' && x.lib === item.lib);
      if (item.parent && (!parent || (parent.deleted && parent.deletedGroup !== item.deletedGroup))) throw new Error('Restore the parent folder first.');
      if (next.some(x => !x.deleted && x.lib === item.lib && x.parent === item.parent && x.name.toLowerCase() === item.name.toLowerCase())) throw new Error('An item with this name already exists at the original location.');
      const group = item.deletedGroup;
      for (const entry of next) if (group ? entry.deletedGroup === group : entry.id === id) { delete entry.deleted; delete entry.deletedGroup; delete entry.deletedRoot; if(entry.id===id){delete entry.pinned;delete entry.pinOrder} }
    }
    return next;
  }
  function purge(items, ids) {
    const chosen = new Set(ids);
    if (!chosen.size || chosen.size !== ids.length) throw new Error('Select deleted items.');
    const selected = items.filter(item => chosen.has(item.id) && item.deleted);
    if (selected.length !== chosen.size || selected.some(item => item.deletedGroup && !item.deletedRoot)) throw new Error('Select deleted root items.');
    const groups = new Set(selected.filter(item => item.deletedGroup).map(item => item.deletedGroup));
    return items.filter(item => !(item.deleted && (chosen.has(item.id) || (item.deletedGroup && groups.has(item.deletedGroup)))));
  }
  return { descendants, transfer, recycle, restore, purge };
})();

if (typeof module !== 'undefined') module.exports = DocumentTree;
