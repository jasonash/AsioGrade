import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/handlers'
import { storageService } from './services/storage.service'
import { scantronLookupService } from './services/scantron-lookup.service'

let splashWindow: BrowserWindow | null = null
let splashShownAt: number = 0
const MINIMUM_SPLASH_TIME_MS = 2000

function createSplashWindow(): void {
  // Get the resources path - different in dev vs production
  // In production, extraResources puts files in resources/resources/
  const resourcesPath = is.dev
    ? join(__dirname, '../../resources')
    : join(process.resourcesPath, 'resources')

  splashWindow = new BrowserWindow({
    width: 400,
    height: 320,
    frame: false,
    transparent: false,
    resizable: false,
    center: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#0A0A0B',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  splashWindow.loadFile(join(resourcesPath, 'splash.html'))

  splashWindow.once('ready-to-show', () => {
    splashShownAt = Date.now()
    splashWindow?.show()
  })
}

function createWindow(): void {
  // Get saved window state
  const windowState = storageService.getWindowState()

  const mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0A0A0B',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Restore maximized state
  if (windowState.isMaximized) {
    mainWindow.maximize()
  }

  // Save window state on close
  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds()
    storageService.setWindowState({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: mainWindow.isMaximized()
    })
  })

  mainWindow.on('ready-to-show', () => {
    // Ensure splash screen shows for at least MINIMUM_SPLASH_TIME_MS
    const elapsed = Date.now() - splashShownAt
    const remainingTime = Math.max(0, MINIMUM_SPLASH_TIME_MS - elapsed)

    setTimeout(() => {
      // Close splash and show main window
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close()
      }
      splashWindow = null
      mainWindow.show()
    }, remainingTime)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Set app user model id for Windows
  electronApp.setAppUserModelId('com.asiograde.app')

  // Show splash screen first
  createSplashWindow()

  // Initialize scantron lookup database (v3 QR codes)
  scantronLookupService.initialize()

  // Register IPC handlers
  registerIpcHandlers()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Create main window (splash will close when it's ready)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up database connection on quit
app.on('quit', () => {
  scantronLookupService.close()
})
