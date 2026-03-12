import { BrowserWindow, BrowserView, Utils, Updater } from "electrobun/bun";
import type { AppRPC, FileTreeItem } from "../shared/rpc";
import path from "path";
import fs from "fs";
import { dlopen, FFIType } from "bun:ffi";

// Call before any window is created.
// Try V2 (per-monitor, Windows 10 1703+) first, fall back to V1.
try {
  const { symbols: { SetProcessDpiAwarenessContext } } = dlopen("user32", {
    SetProcessDpiAwarenessContext: { args: [FFIType.i64], returns: FFIType.bool },
  });
  SetProcessDpiAwarenessContext(-4n); // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
} catch {
  try {
    const { symbols: { SetProcessDpiAwareness } } = dlopen("shcore", {
      SetProcessDpiAwareness: { args: [FFIType.i32], returns: FFIType.i32 },
    });
    SetProcessDpiAwareness(2); // PROCESS_PER_MONITOR_DPI_AWARE
  } catch { /* not Windows or already set */ }
}

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("Vite dev server not running. Run 'bun run dev:hmr' for HMR support.");
    }
  }
  return "views://mainview/index.html";
}

const CONFIG_DIR = path.join(Utils.paths.appData, "structured-text-viewer");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const RECENT_DIRS_KEY = "recentDirectories";
const LAST_DIR_KEY = "lastOpenedDirectory";
const EXPANDED_STATE_KEY = "expandedState";

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadStore(): Record<string, unknown> {
  try {
    ensureConfigDir();
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load store:", error);
  }
  return {};
}

function saveStore(data: Record<string, unknown>): void {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to save store:", error);
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
  if (recentDirs.length > 10) recentDirs = recentDirs.slice(0, 10);
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
    if (!fs.existsSync(dirPath)) return result;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const fullPath = path.join(dirPath, entry.name);
        result.push({ id: fullPath, name: entry.name, type: "folder", path: fullPath, children: [] });
      }
    }

    for (const entry of entries) {
      const fileName = entry.name;
      const lowerName = fileName.toLowerCase();
      const ext = path.extname(fileName).toLowerCase();
      if (entry.isFile() && (lowerName.endsWith(".md") || lowerName.endsWith(".mmd") || lowerName.endsWith(".svg") || lowerName.endsWith(".html") || lowerName.endsWith(".htm"))) {
        const fullPath = path.join(dirPath, fileName);
        try {
          fs.accessSync(fullPath, fs.constants.R_OK);
          result.push({
            id: fullPath,
            name: fileName,
            type: ext === ".md" ? "markdown" : ext === ".svg" ? "svg" : (ext === ".html" || ext === ".htm") ? "html" : "mermaid",
            path: fullPath,
          });
        } catch {
          // skip unreadable files
        }
      }
    }
  } catch (error) {
    console.error("Failed to scan directory:", error);
  }
  return result;
}

const rpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: 10000,
  handlers: {
    requests: {
      getRecentDirectories: () => getRecentDirectories(),
      getLastDirectory: () => getLastOpenedDirectory(),
      readFile: ({ filePath }) => {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          return { content };
        } catch (error) {
          return { content: "", error: `Failed to read file: ${(error as Error).message}` };
        }
      },
      getFileStats: ({ filePath }) => {
        try {
          const stats = fs.statSync(filePath);
          return { size: stats.size, modified: stats.mtime.toISOString() };
        } catch (error) {
          return { size: 0, modified: "", error: `Failed to get stats: ${(error as Error).message}` };
        }
      },
      scanDirectory: ({ dirPath }) => scanDirectory(dirPath),
      openExternal: ({ url }) => { Utils.openExternal(url); },
      getExpandedState: () => getExpandedState(),
      setExpandedState: ({ state }) => { setExpandedState(state); },
    },
    messages: {
      openDirectoryDialog: async () => {
        const paths = await Utils.openFileDialog({
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
          allowedFileTypes: "*",
        });
        const dirPath = paths && paths.length > 0 && paths[0] ? paths[0] : null;
        if (dirPath) {
          addRecentDirectory(dirPath);
          setLastOpenedDirectory(dirPath);
        }
        win.webview.rpc?.send.directorySelected({ dirPath });
      },
    },
  },
});

const url = await getMainViewUrl();

const win = new BrowserWindow({
  title: "Structured Text Viewer",
  frame: { x: 100, y: 100, width: 1400, height: 900 },
  url,
  rpc,
});
