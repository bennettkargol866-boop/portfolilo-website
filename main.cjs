const { app, BrowserWindow, dialog, ipcMain, protocol } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');

protocol.registerSchemesAsPrivileged([{ scheme: 'ects', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } }]);

const dataDirectory = () => path.join(app.getPath('userData'), 'portfolio');
const portfolioPath = () => path.join(dataDirectory(), 'portfolio.json');
const uploadsPath = () => path.join(dataDirectory(), 'files');
const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const filename = Buffer.from(name.replace(/\\/g, '/'), 'utf8');
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const packed = zlib.deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30 + filename.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(filename.length, 26); filename.copy(local, 30);
    locals.push(local, packed);
    const header = Buffer.alloc(46 + filename.length);
    header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x800, 8); header.writeUInt16LE(8, 10); header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(packed.length, 20); header.writeUInt32LE(raw.length, 24);
    header.writeUInt16LE(filename.length, 28); header.writeUInt32LE(offset, 42); filename.copy(header, 46);
    central.push(header);
    offset += local.length + packed.length;
  }
  const centralData = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralData.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralData, end]);
}

function unzip(buffer) {
  if (buffer.length > MAX_ARCHIVE_BYTES) throw new Error('Archive is too large.');
  const entries = new Map();
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('This is not a valid portfolio ZIP archive.');
  const count = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('The portfolio archive is damaged.');
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) throw new Error('The archive contains an unsafe file path.');
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('The portfolio archive is damaged.');
    const localName = buffer.readUInt16LE(localOffset + 26);
    const localExtra = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localName + localExtra;
    const packed = buffer.subarray(start, start + compressedSize);
    const data = method === 8 ? zlib.inflateRawSync(packed) : method === 0 ? packed : null;
    if (!data) throw new Error('The archive uses an unsupported compression method.');
    if (data.length > MAX_ARCHIVE_BYTES) throw new Error('An archive file is too large.');
    entries.set(name, data);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function walkFileReferences(value, callback, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (typeof value.fileRef === 'string') callback(value);
  for (const child of Object.values(value)) walkFileReferences(child, callback, seen);
}

function safeFileId(value) {
  return typeof value === 'string' && /^[a-f0-9-]{20,80}$/i.test(value);
}

async function writePortfolio(portfolio) {
  await fs.mkdir(uploadsPath(), { recursive: true });
  const temp = `${portfolioPath()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(portfolio), 'utf8');
  await fs.rename(temp, portfolioPath());
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 900, minHeight: 650,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.cjs') }
  });
  window.loadURL('ects://app/index%201.html');
}

app.whenReady().then(() => {
  protocol.handle('ects', async request => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'app') return new Response('Not found', { status: 404 });
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const target = path.resolve(__dirname, relative);
      if (target !== __dirname && !target.startsWith(__dirname + path.sep)) return new Response('Forbidden', { status: 403 });
      const data = await fs.readFile(target);
      const ext = path.extname(target).toLowerCase();
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.bcmap': 'application/octet-stream', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf' };
      return new Response(data, { headers: { 'Content-Type': types[ext] || 'application/octet-stream' } });
    } catch { return new Response('Not found', { status: 404 }); }
  });
  ipcMain.handle('portfolio:load-current', async () => {
    try { return JSON.parse(await fs.readFile(portfolioPath(), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw new Error('The saved portfolio could not be read.'); }
  });
  ipcMain.handle('portfolio:save-current', async (_, portfolio) => writePortfolio(portfolio));
  ipcMain.handle('portfolio:save-file', async (_, { fileName, fileType, bytes, previousRef }) => {
    const fileId = require('node:crypto').randomUUID();
    const ext = path.extname(String(fileName || '')).slice(0, 16).replace(/[^.a-z0-9]/gi, '');
    await fs.mkdir(uploadsPath(), { recursive: true });
    await fs.writeFile(path.join(uploadsPath(), `${fileId}${ext}`), Buffer.from(bytes));
    if (safeFileId(previousRef)) {
      for (const name of await fs.readdir(uploadsPath())) if (name.startsWith(previousRef + '.')) await fs.unlink(path.join(uploadsPath(), name));
    }
    return { fileRef: fileId, fileName: String(fileName || 'Uploaded file'), fileType: String(fileType || ''), uploadedAt: new Date().toISOString() };
  });
  ipcMain.handle('portfolio:read-file', async (_, fileRef) => {
    if (!safeFileId(fileRef)) throw new Error('This attachment reference is invalid.');
    const name = (await fs.readdir(uploadsPath())).find(candidate => candidate.startsWith(`${fileRef}.`));
    if (!name) throw new Error('This attachment is missing from the app data folder.');
    return { base64: (await fs.readFile(path.join(uploadsPath(), name))).toString('base64') };
  });
  ipcMain.handle('portfolio:remove-file', async (_, fileRef) => {
    if (!safeFileId(fileRef)) return;
    for (const name of await fs.readdir(uploadsPath()).catch(() => [])) if (name.startsWith(fileRef + '.')) await fs.unlink(path.join(uploadsPath(), name));
  });
  ipcMain.handle('portfolio:clear-current', async () => fs.rm(dataDirectory(), { recursive: true, force: true }));
  ipcMain.handle('portfolio:export-archive', async (_, portfolio, suggestedName) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save ECTS portfolio', defaultPath: `${suggestedName || 'ects-career-portfolio'}.ects-portfolio`,
      filters: [{ name: 'ECTS Portfolio', extensions: ['ects-portfolio'] }]
    });
    if (canceled || !filePath) return false;
    const payload = JSON.parse(JSON.stringify(portfolio));
    const relationships = [];
    walkFileReferences(payload, record => relationships.push({ fileRef: record.fileRef, fileName: record.fileName || '', fileType: record.fileType || '' }));
    const storedNames = await fs.readdir(uploadsPath()).catch(() => []);
    const files = [];
    for (const reference of new Set(relationships.map(item => item.fileRef))) {
      const name = storedNames.find(candidate => candidate.startsWith(`${reference}.`));
      if (!name) throw new Error(`The attachment “${reference}” is missing from this computer.`);
      files.push([`files/${name}`, await fs.readFile(path.join(uploadsPath(), name))]);
    }
    const manifest = { format: 'ects-portfolio', version: 1, portfolioFile: 'portfolio.json', files: files.map(([name]) => name), relationships };
    const archive = makeZip([['portfolio.json', Buffer.from(JSON.stringify(payload, null, 2))], ['manifest.json', Buffer.from(JSON.stringify(manifest, null, 2))], ...files]);
    await fs.writeFile(filePath, archive);
    return true;
  });
  ipcMain.handle('portfolio:import-archive', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open ECTS portfolio', properties: ['openFile'],
      filters: [{ name: 'ECTS Portfolio', extensions: ['ects-portfolio'] }]
    });
    if (canceled || !filePaths[0]) return null;
    const entries = unzip(await fs.readFile(filePaths[0]));
    const manifest = JSON.parse(entries.get('manifest.json')?.toString('utf8') || 'null');
    if (!manifest || manifest.format !== 'ects-portfolio' || manifest.portfolioFile !== 'portfolio.json') throw new Error('This file is not a supported ECTS portfolio.');
    const portfolio = JSON.parse(entries.get('portfolio.json')?.toString('utf8') || 'null');
    if (!portfolio || typeof portfolio !== 'object') throw new Error('The portfolio data is missing or invalid.');
    const tempDir = `${dataDirectory()}-import-${Date.now()}`;
    await fs.mkdir(path.join(tempDir, 'files'), { recursive: true });
    try {
      for (const name of manifest.files || []) {
        if (typeof name !== 'string' || !name.startsWith('files/') || name.includes('..') || name.includes('\\')) throw new Error('The archive contains an unsafe file path.');
        const id = path.basename(name).split('.')[0];
        if (!safeFileId(id)) throw new Error('The archive contains an invalid file reference.');
        const data = entries.get(name);
        if (!data) throw new Error('A portfolio attachment is missing.');
        await fs.writeFile(path.join(tempDir, 'files', path.basename(name)), data);
      }
      await fs.writeFile(path.join(tempDir, 'portfolio.json'), JSON.stringify(portfolio), 'utf8');
      await fs.rm(dataDirectory(), { recursive: true, force: true });
      await fs.rename(tempDir, dataDirectory());
    } catch (error) { await fs.rm(tempDir, { recursive: true, force: true }); throw error; }
    return portfolio;
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
