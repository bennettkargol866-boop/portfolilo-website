const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');

const portfolioPath = () => path.join(app.getPath('userData'), 'portfolio.json');

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 650,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.cjs') }
  });
  window.loadFile('index 1.html');
}

app.whenReady().then(() => {
  ipcMain.handle('portfolio:load-current', async () => {
    try { return JSON.parse(await fs.readFile(portfolioPath(), 'utf8')); } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw new Error('The saved portfolio could not be read.');
    }
  });
  ipcMain.handle('portfolio:save-current', async (_, portfolio) => {
    const destination = portfolioPath();
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(`${destination}.tmp`, JSON.stringify(portfolio), 'utf8');
    await fs.rename(`${destination}.tmp`, destination);
  });
  ipcMain.handle('portfolio:clear-current', async () => {
    try { await fs.unlink(portfolioPath()); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  });
  ipcMain.handle('portfolio:export-archive', async (_, portfolio, suggestedName) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save compressed portfolio archive',
      defaultPath: `${suggestedName || 'ects-career-portfolio'}.ectsportfolio`,
      filters: [{ name: 'ECTS Portfolio Archive', extensions: ['ectsportfolio'] }]
    });
    if (canceled || !filePath) return false;
    await fs.writeFile(filePath, zlib.gzipSync(Buffer.from(JSON.stringify(portfolio))));
    return true;
  });
  ipcMain.handle('portfolio:import-archive', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open portfolio archive', properties: ['openFile'],
      filters: [{ name: 'Portfolio backups', extensions: ['ectsportfolio', 'json'] }]
    });
    if (canceled || !filePaths[0]) return null;
    const data = await fs.readFile(filePaths[0]);
    try { return JSON.parse(zlib.gunzipSync(data).toString('utf8')); }
    catch { return JSON.parse(data.toString('utf8')); }
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
