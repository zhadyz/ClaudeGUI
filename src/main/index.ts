import { app, BrowserWindow, ipcMain, shell, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ClaudeProcessManager } from './claude-process-manager';
import { setupIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;
let processManager: ClaudeProcessManager | null = null;

// Claude logo icon - creates a proper icon for Windows taskbar
const createClaudeIcon = () => {
  // Try to load PNG icon first (best for Windows)
  const pngPath = path.join(__dirname, '../../../assets/icons/claude-icon.png');
  const icoPath = path.join(__dirname, '../../../assets/icons/icon.ico');

  try {
    if (fs.existsSync(icoPath)) {
      return nativeImage.createFromPath(icoPath);
    }
    if (fs.existsSync(pngPath)) {
      return nativeImage.createFromPath(pngPath);
    }
  } catch (e) {
    // Icon file not found, will use generated icon
  }

  // Generate a simple Claude-colored icon programmatically
  // This creates a 256x256 icon with Claude's orange color
  const sizes = [16, 32, 48, 256];
  const images: Electron.NativeImage[] = [];

  for (const size of sizes) {
    const buffer = Buffer.alloc(size * size * 4);

    // Create a circular orange icon
    const center = size / 2;
    const radius = size / 2 - 1;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);

        if (dist <= radius) {
          // Claude's orange color (#d97757)
          buffer[idx] = 0xd9;     // R
          buffer[idx + 1] = 0x77; // G
          buffer[idx + 2] = 0x57; // B
          buffer[idx + 3] = 0xff; // A
        } else {
          // Transparent
          buffer[idx] = 0;
          buffer[idx + 1] = 0;
          buffer[idx + 2] = 0;
          buffer[idx + 3] = 0;
        }
      }
    }

    images.push(nativeImage.createFromBuffer(buffer, { width: size, height: size }));
  }

  // Return the largest size for the main icon
  return images[images.length - 1];
};

// Get the working directory from command line args (for context menu integration)
const getInitialCwd = (): string => {
  const args = process.argv.slice(2);
  const cwdIndex = args.findIndex(arg => arg === '--cwd');
  if (cwdIndex !== -1 && args[cwdIndex + 1]) {
    return args[cwdIndex + 1];
  }
  return process.cwd();
};

const createWindow = () => {
  const initialCwd = getInitialCwd();
  const appIcon = createClaudeIcon();

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1280,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Custom title bar
    backgroundColor: '#2b2a27',
    webPreferences: {
      preload: path.join(__dirname, '../preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: appIcon,
  });

  // Initialize Claude process manager (handles multiple sessions)
  processManager = new ClaudeProcessManager(mainWindow);

  // Setup IPC handlers
  setupIpcHandlers(mainWindow, processManager);

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    const devPort = process.env.VITE_DEV_PORT || '5173';
    mainWindow.loadURL(`http://localhost:${devPort}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  // Send initial CWD to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('claude:init', { cwd: initialCwd });
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    processManager?.stopAll();
  });
};

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Check for --cwd in the new instance
      const cwdIndex = commandLine.findIndex(arg => arg === '--cwd');
      if (cwdIndex !== -1 && commandLine[cwdIndex + 1]) {
        const newCwd = commandLine[cwdIndex + 1];
        mainWindow.webContents.send('claude:init', { cwd: newCwd });
      }
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  processManager?.stopAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle any uncaught exceptions gracefully
process.on('uncaughtException', (_error) => {
  // Silently handle to prevent crashes in production
});
