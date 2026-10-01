const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, dialog } = require('electron');

app.setName('Kestral Budget');
app.setAppUserModelId('com.kestralbudget.desktop');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow;
  let localServer;
  let isClosing = false;

  async function openWindow() {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      return;
    }

    mainWindow = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 900,
      minHeight: 650,
      show: false,
      ...(process.platform === 'win32' ? { icon: path.join(app.getAppPath(), 'assets', 'kestral-budget.ico') } : {}),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin !== localServer.origin) event.preventDefault();
    });
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => { mainWindow = undefined; });
    await mainWindow.loadURL(localServer.origin);
  }

  app.whenReady().then(async () => {
    const appPath = app.getAppPath();
    const serverPath = path.join(appPath, 'server.mjs');
    const { startServer } = await import(pathToFileURL(serverPath).href);
    localServer = await startServer({
      host: '127.0.0.1',
      port: 0,
      databasePath: path.join(app.getPath('userData'), 'kestralbudget.sqlite'),
      staticDirectory: path.join(appPath, 'dist'),
      storage: 'wasm',
    });
    await openWindow();
  }).catch((error) => {
    dialog.showErrorBox('Kestral Budget could not start', error.stack || error.message);
    app.quit();
  });

  app.on('second-instance', () => { void openWindow(); });
  app.on('activate', () => { void openWindow(); });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', (event) => {
    if (!localServer || isClosing) return;
    event.preventDefault();
    isClosing = true;
    localServer.close().catch(console.error).finally(() => {
      localServer = undefined;
      app.quit();
    });
  });
}