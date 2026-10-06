(() => {
  const DB_NAME = 'ects-career-portfolio';
  const DB_VERSION = 1;
  const safeId = value => typeof value === 'string' && /^[a-f0-9-]{20,80}$/i.test(value);
  const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('portfolio')) db.createObjectStore('portfolio');
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Browser storage could not be opened.'));
  });
  const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Browser storage operation failed.'));
  });
  const transact = async (store, operation) => {
    const db = await openDb();
    try {
      const transaction = db.transaction(store, operation.mode || 'readonly');
      const result = await operation.run(transaction.objectStore(store));
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Browser storage operation failed.'));
        transaction.onabort = () => reject(transaction.error || new Error('Browser storage operation was cancelled.'));
      });
      return result;
    } finally { db.close(); }
  };

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  const encoder = new TextEncoder();
  function createZip(entries) {
    const localParts = [], centralParts = [];
    let offset = 0;
    for (const [name, data] of entries) {
      const filename = encoder.encode(name.replace(/\\/g, '/'));
      const raw = data instanceof Uint8Array ? data : new Uint8Array(data);
      const checksum = crc32(raw);
      const local = new Uint8Array(30 + filename.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x800, true);
      lv.setUint16(8, 0, true); lv.setUint32(14, checksum, true); lv.setUint32(18, raw.length, true);
      lv.setUint32(22, raw.length, true); lv.setUint16(26, filename.length, true); local.set(filename, 30);
      localParts.push(local, raw);
      const central = new Uint8Array(46 + filename.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x800, true); cv.setUint16(10, 0, true); cv.setUint32(16, checksum, true);
      cv.setUint32(20, raw.length, true); cv.setUint32(24, raw.length, true);
      cv.setUint16(28, filename.length, true); cv.setUint32(42, offset, true); central.set(filename, 46);
      centralParts.push(central);
      offset += local.length + raw.length;
    }
    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
    return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
  }
  async function readZip(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer), entries = new Map();
    let end = -1;
    for (let cursor = bytes.length - 22; cursor >= Math.max(0, bytes.length - 65557); cursor--) {
      if (view.getUint32(cursor, true) === 0x06054b50) { end = cursor; break; }
    }
    if (end < 0) throw new Error('That file is not a valid ECTS portfolio ZIP.');
    const count = view.getUint16(end + 10, true);
    let cursor = view.getUint32(end + 16, true);
    for (let index = 0; index < count; index++) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('The portfolio file is damaged.');
      const method = view.getUint16(cursor + 10, true);
      const compressedSize = view.getUint32(cursor + 20, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
      if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) throw new Error('The archive contains an unsafe path.');
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('The portfolio file is damaged.');
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const packed = bytes.slice(dataStart, dataStart + compressedSize);
      let data;
      if (method === 0) data = packed;
      else if (method === 8 && 'DecompressionStream' in window) {
        const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        data = new Uint8Array(await new Response(stream).arrayBuffer());
      } else throw new Error('This browser cannot open the archive compression format. Try a current version of Chrome or Edge.');
      entries.set(name, data);
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }
  function collectReferences(portfolio) {
    const refs = [];
    const seenObjects = new Set(), seenRefs = new Set();
    const visit = value => {
      if (!value || typeof value !== 'object' || seenObjects.has(value)) return;
      seenObjects.add(value);
      if (safeId(value.fileRef) && !seenRefs.has(value.fileRef)) {
        seenRefs.add(value.fileRef);
        refs.push({ fileRef: value.fileRef, fileName: value.fileName || '', fileType: value.fileType || '' });
      }
      Object.values(value).forEach(visit);
    };
    visit(portfolio);
    return refs;
  }

  window.portfolioBrowser = {
    loadCurrent: () => transact('portfolio', { run: store => requestValue(store.get('current')) }),
    saveCurrent: portfolio => transact('portfolio', { mode: 'readwrite', run: store => requestValue(store.put(JSON.parse(JSON.stringify(portfolio)), 'current')) }),
    saveFile: async ({ fileName, fileType, bytes, previousRef }) => {
      const fileRef = crypto.randomUUID();
      await transact('files', { mode: 'readwrite', run: store => requestValue(store.put({ blob: new Blob([bytes], { type: fileType }), fileName, fileType }, fileRef)) });
      if (safeId(previousRef)) await window.portfolioBrowser.removeFile(previousRef);
      return { fileRef, fileName, fileType, uploadedAt: new Date().toISOString() };
    },
    readFile: async fileRef => {
      if (!safeId(fileRef)) throw new Error('This attachment reference is invalid.');
      const item = await transact('files', { run: store => requestValue(store.get(fileRef)) });
      if (!item) throw new Error('This attachment is missing from browser storage.');
      const bytes = new Uint8Array(await item.blob.arrayBuffer());
      let binary = '';
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      return { base64: btoa(binary) };
    },
    removeFile: fileRef => safeId(fileRef) ? transact('files', { mode: 'readwrite', run: store => requestValue(store.delete(fileRef)) }) : Promise.resolve(),
    clearCurrent: async () => {
      await transact('portfolio', { mode: 'readwrite', run: store => requestValue(store.delete('current')) });
      await transact('files', { mode: 'readwrite', run: store => requestValue(store.clear()) });
    },
    exportArchive: async (portfolio, suggestedName) => {
      const relationships = collectReferences(portfolio), entries = [];
      const fileNames = [];
      for (const relation of relationships) {
        const item = await transact('files', { run: store => requestValue(store.get(relation.fileRef)) });
        if (!item) throw new Error(`The attachment “${relation.fileName}” is missing from this browser.`);
        const ext = (relation.fileName.match(/\.[a-z0-9]{1,12}$/i) || [''])[0];
        const name = `files/${relation.fileRef}${ext}`;
        entries.push([name, new Uint8Array(await item.blob.arrayBuffer())]);
        fileNames.push(name);
      }
      const manifest = { format: 'ects-portfolio', version: 1, portfolioFile: 'portfolio.json', files: fileNames, relationships };
      entries.unshift(['manifest.json', encoder.encode(JSON.stringify(manifest, null, 2))]);
      entries.unshift(['portfolio.json', encoder.encode(JSON.stringify(portfolio, null, 2))]);
      const url = URL.createObjectURL(createZip(entries));
      const link = document.createElement('a');
      link.href = url; link.download = `${suggestedName || 'ects-career-portfolio'}.ects-portfolio`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      return true;
    },
    importArchive: async () => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.ects-portfolio,application/zip';
      const selected = new Promise((resolve, reject) => {
        input.onchange = () => input.files?.[0] ? resolve(input.files[0]) : resolve(null);
        input.onerror = () => reject(new Error('The portfolio file could not be opened.'));
      });
      input.click();
      const file = await selected;
      if (!file) return null;
      const entries = await readZip(await file.arrayBuffer());
      const manifestBytes = entries.get('manifest.json');
      const portfolioBytes = entries.get('portfolio.json');
      if (!manifestBytes || !portfolioBytes) throw new Error('This file is missing its portfolio data or attachment manifest.');
      const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
      const portfolio = JSON.parse(new TextDecoder().decode(portfolioBytes));
      if (manifest.format !== 'ects-portfolio' || manifest.portfolioFile !== 'portfolio.json' || !portfolio || typeof portfolio !== 'object') throw new Error('This is not a supported ECTS portfolio file.');
      const stagedFiles = [];
      for (const name of manifest.files || []) {
        if (typeof name !== 'string' || !name.startsWith('files/') || name.includes('..') || name.includes('\\')) throw new Error('The archive contains an unsafe file path.');
        const fileRef = name.slice('files/'.length).split('.')[0];
        if (!safeId(fileRef)) throw new Error('The archive contains an invalid attachment reference.');
        const bytes = entries.get(name);
        if (!bytes) throw new Error('An attachment is missing from the portfolio file.');
        const relation = (manifest.relationships || []).find(item => item.fileRef === fileRef) || {};
        stagedFiles.push([fileRef, { blob: new Blob([bytes], { type: relation.fileType || '' }), fileName: relation.fileName || name.split('/').pop(), fileType: relation.fileType || '' }]);
      }
      const needed = collectReferences(portfolio);
      if (needed.some(item => !stagedFiles.some(([fileRef]) => fileRef === item.fileRef))) throw new Error('A portfolio attachment is missing from the archive.');
      await transact('files', { mode: 'readwrite', run: store => Promise.all(stagedFiles.map(([fileRef, item]) => requestValue(store.put(item, fileRef)))) });
      await window.portfolioBrowser.saveCurrent(portfolio);
      return portfolio;
    }
  };
})();
