import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';

// IPC Channels Documentation:
// - 'app:select-directory' -> Select a directory for scanning
// - 'app:get-recent-directories' -> Get list of recent directories
// - 'app:add-recent-directory' -> Add a directory to recent list
// - 'file:read' -> Read file content
// - 'file:get-stats' -> Get file statistics (size, modified date)
// - 'file:scan-directory' -> Scan directory for .md and .mmd files
// - 'shell:open-external' -> Open URL in external browser

let mainWindow: BrowserWindow | null = null;

const RECENT_DIRS_KEY = 'recentDirectories';
const LAST_DIR_KEY = 'lastOpenedDirectory';
const EXPANDED_STATE_KEY = 'expandedState';

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadStore(): Record<string, unknown> {
  try {
    const storePath = getStorePath();
    if (fs.existsSync(storePath)) {
      const data = fs.readFileSync(storePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load store:', error);
  }
  return {};
}

function saveStore(data: Record<string, unknown>): void {
  try {
    const storePath = getStorePath();
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save store:', error);
  }
}

function getRecentDirectories(): string[] {
  const store = loadStore();
  return (store[RECENT_DIRS_KEY] as string[]) || [];
}

function addRecentDirectory(dirPath: string): void {
  const store = loadStore();
  let recentDirs = (store[RECENT_DIRS_KEY] as string[]) || [];
  recentDirs = recentDirs.filter((d) => d !== dirPath);
  recentDirs.unshift(dirPath);
  if (recentDirs.length > 10) {
    recentDirs = recentDirs.slice(0, 10);
  }
  store[RECENT_DIRS_KEY] = recentDirs;
  saveStore(store);
}

function getLastOpenedDirectory(): string | null {
  const store = loadStore();
  return (store[LAST_DIR_KEY] as string) || null;
}

function setLastOpenedDirectory(dirPath: string): void {
  const store = loadStore();
  store[LAST_DIR_KEY] = dirPath;
  saveStore(store);
}

function getExpandedState(): Record<string, boolean> {
  const store = loadStore();
  return (store[EXPANDED_STATE_KEY] as Record<string, boolean>) || {};
}

function setExpandedState(state: Record<string, boolean>): void {
  const store = loadStore();
  store[EXPANDED_STATE_KEY] = state;
  saveStore(store);
}

function scanDirectory(dirPath: string): FileTreeItem[] {
  const result: FileTreeItem[] = [];

  try {
    if (!fs.existsSync(dirPath)) {
      console.error('[SCAN] Directory does not exist:', dirPath);
      return result;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    // First add directories
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const fullPath = path.join(dirPath, entry.name);
        result.push({
          id: fullPath,
          name: entry.name,
          type: 'folder',
          path: fullPath,
          children: [],
        });
      }
    }

    // Then add files (.md and .mmd only)
    for (const entry of entries) {
      const fileName = entry.name;
      const lowerName = fileName.toLowerCase();
      const ext = path.extname(fileName).toLowerCase();
      
      if (entry.isFile()) {
        if (lowerName.endsWith('.md') || lowerName.endsWith('.mmd')) {
          const fullPath = path.join(dirPath, fileName);
          
          try {
            fs.accessSync(fullPath, fs.constants.R_OK);
            result.push({
              id: fullPath,
              name: fileName,
              type: ext === '.md' ? 'markdown' : 'mermaid',
              path: fullPath,
            });
          } catch (accessError) {
            console.error('[SCAN] Cannot access file:', fullPath, accessError);
          }
        }
      }
    }
  } catch (error) {
    console.error('[SCAN] Failed to scan directory:', dirPath, error);
  }

  return result;
}

interface FileTreeItem {
  id: string;
  name: string;
  type: 'folder' | 'markdown' | 'mermaid';
  path: string;
  children?: FileTreeItem[];
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#18181b',
      symbolColor: '#ffffff',
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, '../../dist-electron/preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#18181b',
    show: false,
  });

  // Load the app
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// IPC Handlers
ipcMain.handle('app:select-directory', async () => {
  if (!mainWindow) {
    return null;
  }
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Directory to Scan',
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const dirPath = result.filePaths[0];
    addRecentDirectory(dirPath);
    setLastOpenedDirectory(dirPath);
    return dirPath;
  }
  return null;
});

ipcMain.handle('app:get-recent-directories', () => {
  return getRecentDirectories();
});

ipcMain.handle('app:get-last-directory', () => {
  return getLastOpenedDirectory();
});

ipcMain.handle('file:read', async (_, filePath: string): Promise<{ content: string; error?: string }> => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content };
  } catch (error) {
    return { content: '', error: `Failed to read file: ${(error as Error).message}` };
  }
});

ipcMain.handle('file:get-stats', async (_, filePath: string): Promise<{ size: number; modified: string; error?: string }> => {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      modified: stats.mtime.toISOString(),
    };
  } catch (error) {
    return { size: 0, modified: '', error: `Failed to get file stats: ${(error as Error).message}` };
  }
});

ipcMain.handle('file:scan-directory', async (_, dirPath: string): Promise<FileTreeItem[]> => {
  return scanDirectory(dirPath);
});

ipcMain.handle('file:scan-subdirectory', async (_, dirPath: string): Promise<FileTreeItem[]> => {
  return scanDirectory(dirPath);
});

ipcMain.handle('shell:open-external', async (_, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle('store:get-expanded-state', () => {
  return getExpandedState();
});

ipcMain.handle('store:set-expanded-state', (_, state: Record<string, boolean>) => {
  setExpandedState(state);
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent navigation
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event) => {
    event.preventDefault();
  });
});
