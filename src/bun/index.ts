import { BrowserWindow, BrowserView, Utils, Updater, ApplicationMenu } from "electrobun/bun";
import type { AppRPC, FileTreeItem } from "../shared/rpc";
import path from "path";
import fs from "fs";
import { dlopen, FFIType } from "bun:ffi";
import { BSON, EJSON, Long } from "bson";

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
const FONT_SIZE_KEY = "fontSize";
const OPEN_DIRS_KEY = "openDirectories";
const ACTIVE_DIR_KEY = "activeDirectory";

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

function isDirectory(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

// Folders open as tabs. Falls back to the single last-opened directory from
// before tabs existed; folders that no longer exist are dropped.
function getWorkspaces(): { directories: string[]; active: string | null } {
  const store = loadStore();
  const saved = store[OPEN_DIRS_KEY];
  let directories: string[];
  if (Array.isArray(saved)) {
    directories = saved.filter((d): d is string => typeof d === "string");
  } else {
    const last = store[LAST_DIR_KEY];
    directories = typeof last === "string" ? [last] : [];
  }
  directories = directories.filter(isDirectory);
  const active = store[ACTIVE_DIR_KEY];
  return {
    directories,
    active: typeof active === "string" && directories.includes(active) ? active : directories[0] ?? null,
  };
}

function setWorkspaces(directories: string[], active: string | null): void {
  const store = loadStore();
  store[OPEN_DIRS_KEY] = directories;
  store[ACTIVE_DIR_KEY] = active;
  if (active) store[LAST_DIR_KEY] = active;
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

function getFontSize(): number | null {
  const value = loadStore()[FONT_SIZE_KEY];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function setFontSize(size: number): void {
  if (!Number.isFinite(size)) return;
  const store = loadStore();
  store[FONT_SIZE_KEY] = size;
  saveStore(store);
}

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
  ".apng": "image/apng",
};

// Resolve an image referenced from a markdown file (relative or absolute path)
// and return it as a base64 data URL, since the webview runs from a views://
// origin and cannot load disk paths directly.
function resolveImage(markdownPath: string, src: string): { dataUrl?: string; error?: string } {
  try {
    let target = src;
    try {
      target = decodeURIComponent(src);
    } catch {
      // src was not percent-encoded — use it as-is
    }

    const resolved = path.isAbsolute(target)
      ? target
      : path.resolve(path.dirname(markdownPath), target);

    const ext = path.extname(resolved).toLowerCase();
    const mime = IMAGE_MIME[ext];
    if (!mime) {
      return { error: `Unsupported image type: ${ext || "unknown"}` };
    }

    const data = fs.readFileSync(resolved);
    return { dataUrl: `data:${mime};base64,${data.toString("base64")}` };
  } catch (error) {
    return { error: `Failed to load image: ${(error as Error).message}` };
  }
}

// Decode a .bson file to (relaxed) MongoDB Extended JSON text for the JSON
// viewer. A file may hold several concatenated documents (mongodump output),
// each prefixed by its int32 little-endian length; those become an array.
// Relaxed Extended JSON writes every int64 as a plain number, which silently
// rounds values beyond 2^53. Keep those exact as canonical {"$numberLong": "…"}.
function preserveUnsafeLongs(value: unknown): unknown {
  if (value instanceof Long) {
    const safe = value.lessThanOrEqual(Number.MAX_SAFE_INTEGER) && value.greaterThanOrEqual(Number.MIN_SAFE_INTEGER);
    return safe ? value : { $numberLong: value.toString() };
  }
  if (Array.isArray(value)) return value.map(preserveUnsafeLongs);
  // Recurse into plain documents only; other BSON types serialize themselves.
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = preserveUnsafeLongs(v);
    return out;
  }
  return value;
}

function bsonToJson(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  const docs: unknown[] = [];
  let offset = 0;
  while (offset < buf.length) {
    if (buf.length - offset < 5) throw new Error(`Truncated BSON document at byte ${offset}`);
    const size = buf.readInt32LE(offset);
    if (size < 5 || offset + size > buf.length) {
      throw new Error(`Invalid BSON document length ${size} at byte ${offset}`);
    }
    docs.push(preserveUnsafeLongs(BSON.deserialize(buf.subarray(offset, offset + size), { promoteLongs: false })));
    offset += size;
  }
  if (docs.length === 0) throw new Error("Empty BSON file");
  return EJSON.stringify(docs.length === 1 ? docs[0] : docs, undefined, 2, { relaxed: true });
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
      if (entry.isFile() && (lowerName.endsWith(".md") || lowerName.endsWith(".mmd") || lowerName.endsWith(".svg") || lowerName.endsWith(".html") || lowerName.endsWith(".htm") || lowerName.endsWith(".json") || lowerName.endsWith(".jsonp") || lowerName.endsWith(".bson"))) {
        const fullPath = path.join(dirPath, fileName);
        try {
          fs.accessSync(fullPath, fs.constants.R_OK);
          result.push({
            id: fullPath,
            name: fileName,
            type: ext === ".md" ? "markdown" : ext === ".svg" ? "svg" : (ext === ".html" || ext === ".htm") ? "html" : (ext === ".json" || ext === ".jsonp" || ext === ".bson") ? "json" : "mermaid",
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
      getWorkspaces: () => getWorkspaces(),
      setWorkspaces: ({ directories, active }) => { setWorkspaces(directories, active); },
      readFile: ({ filePath }) => {
        try {
          if (filePath.toLowerCase().endsWith(".bson")) {
            try {
              return { content: bsonToJson(filePath) };
            } catch (error) {
              return { content: "", error: `Failed to decode BSON: ${(error as Error).message}` };
            }
          }
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
      getFontSize: () => getFontSize(),
      setFontSize: ({ size }) => { setFontSize(size); },
      resolveImage: ({ markdownPath, src }) => resolveImage(markdownPath, src),
      copyToClipboard: ({ text }) => {
        try {
          Utils.clipboardWriteText(text);
          return true;
        } catch (error) {
          console.error("Failed to write clipboard:", error);
          return false;
        }
      },
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

// macOS routes Cmd+C/V/A/Z through the app's Edit menu; without one the
// native copy/paste shortcuts do nothing in the webview. (Not supported on
// Linux; on Windows it would add a menu bar, so the webview handles copy there.)
if (process.platform === "darwin") {
  ApplicationMenu.setApplicationMenu([
    {
      submenu: [
        { role: "hide" },
        { role: "hideOthers" },
        { role: "showAll" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { role: "close" },
      ],
    },
  ]);
}

const url = await getMainViewUrl();

const win = new BrowserWindow({
  title: "Structured Text Viewer",
  frame: { x: 100, y: 100, width: 1400, height: 900 },
  url,
  rpc,
});

// On Linux, register a desktop entry so the app appears in the application launcher menu.
// The Electrobun installer creates a shortcut on ~/Desktop/, but Linux DEs
// like GNOME require the .desktop file in ~/.local/share/applications/.
if (process.platform === "linux") {
  try {
    const appsDir = path.join(Utils.paths.home, ".local", "share", "applications");
    const desktopFilePath = path.join(appsDir, "com.structured-text-viewer.app.desktop");
    if (!fs.existsSync(desktopFilePath)) {
      fs.mkdirSync(appsDir, { recursive: true });
      const appBinDir = path.dirname(process.execPath);
      const launcherPath = path.join(appBinDir, "launcher");
      const desktopContent = [
        "[Desktop Entry]",
        "Type=Application",
        "Name=Structured Text Viewer",
        "Comment=A local Markdown & Mermaid file explorer and viewer",
        `Exec="${launcherPath}"`,
        "Terminal=false",
        "Categories=Office;Viewer;",
        "Keywords=markdown;mermaid;svg;viewer;",
        "StartupNotify=true",
        "",
      ].join("\n");
      fs.writeFileSync(desktopFilePath, desktopContent);
      fs.chmodSync(desktopFilePath, 0o755);
      console.log("Registered desktop entry at", desktopFilePath);
    }
  } catch (error) {
    console.error("Failed to register desktop entry:", error);
  }
}
