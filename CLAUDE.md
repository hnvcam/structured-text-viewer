# CLAUDE.md — structured-text-viewer

> For all Electrobun API details, refer to `llms.txt` in the project root.

## Project
Desktop Markdown & Mermaid file explorer/viewer built with Electrobun (cross-platform: Windows, macOS, Linux).

**Stack**: Electrobun 1.15.1 · Bun · React 19 · TypeScript · TailwindCSS 3 · Vite · shadcn/ui

## Structure
```
src/
  bun/index.ts          — Main process: window, RPC handlers, fs ops, config store
  mainview/
    index.tsx           — Webview entry (React root, imports rpcClient + index.css)
    rpcClient.ts        — Electroview RPC singleton — import rpc from here
    App.tsx             — Root React component
    index.html          — HTML template (Vite entry: <script src="./index.tsx">)
    index.css           — Tailwind source (@tailwind directives, imported in index.tsx)
    components/         — TitleBar, Sidebar, TreeView, Viewer, MarkdownViewer, MermaidViewer, JsonViewer (.json/.jsonp; .bson decoded to Extended JSON in bun readFile), StatusBar
    hooks/              — useTheme, useKeyboardShortcuts
    lib/utils.ts        — cn() (clsx + tailwind-merge)
    types/index.ts      — FileTreeItem, FileStats, AppState
  shared/rpc.ts         — AppRPC type schema (shared bun ↔ webview)
  types/three.d.ts      — Stub to suppress missing @types/three in electrobun
vite.config.ts          — Vite config (root: src/mainview, outDir: dist/)
electrobun.config.ts    — Electrobun build config (copies dist/ → views/)
tailwind.config.js      — Tailwind (content: src/mainview/**)
tsconfig.json           — TS config (@/* → src/mainview/*)
```

## Build
```bash
bun run dev          # vite build + electrobun dev
bun run dev:hmr      # Vite HMR + electrobun dev concurrently
bun run build:win    # vite build + electrobun build --env=stable (produces installer)
bun run build:mac    # same, on macOS → build/stable-macos-arm64/*.app + artifacts/*.dmg (unsigned)
bun run typecheck    # tsc --noEmit
```

## After every change: rebuild AND install locally (required)
The user runs the installed app, not the dev build — a fix is not done until it's installed.
After any code change, always (without being asked):
1. `bun run typecheck`
2. Rebuild for the current platform (`bun run build:mac` on macOS, `bun run build:linux` on Linux; `bun run build:win` on Windows — no longer actively used)
3. Install it, replacing the old copy. On macOS:
```bash
osascript -e 'quit app "Structured Text Viewer"' 2>/dev/null; sleep 2
pkill -f "/Applications/Structured Text Viewer.app" 2>/dev/null
rm -rf "/Applications/Structured Text Viewer.app"
ditto "build/stable-macos-arm64/Structured Text Viewer.app" "/Applications/Structured Text Viewer.app"
xattr -dr com.apple.quarantine "/Applications/Structured Text Viewer.app" 2>/dev/null
open "/Applications/Structured Text Viewer.app"
```
   On Linux (not yet verified — confirm the bundle/launcher paths on the first install and update this block):
```bash
pkill -f "structured-text-viewer/bin/launcher" 2>/dev/null; sleep 1
BUNDLE=$(find build -maxdepth 2 -mindepth 2 -type d -path "build/stable-linux-*" | head -1)
rm -rf ~/.local/opt/structured-text-viewer && mkdir -p ~/.local/opt ~/.local/share/applications
cp -a "$BUNDLE" ~/.local/opt/structured-text-viewer
sed "s|__LAUNCHER__|$HOME/.local/opt/structured-text-viewer/bin/launcher|" src/StructuredTextViewer.desktop \
  > ~/.local/share/applications/StructuredTextViewer.desktop
update-desktop-database ~/.local/share/applications 2>/dev/null
nohup ~/.local/opt/structured-text-viewer/bin/launcher >/dev/null 2>&1 &
```
   On Windows (legacy), run the installer produced in `artifacts/`.
4. Confirm the installed copy is the new one (e.g. grep a new symbol in `Contents/Resources/app/bun/index.js`) and that it launches.

## Build flow
1. Vite builds `src/mainview/` → `dist/` (hashed assets)
2. Electrobun bundles `src/bun/index.ts` and copies `dist/` → `views/mainview/`
3. App loads `views://mainview/index.html` (or Vite dev server if running)

## Key conventions
- `@/*` alias → `src/mainview/*`
- CSS: import in `index.tsx`, not via HTML `<link>`
- RPC: always `import { rpc } from "./rpcClient"` in webview code
- Config stored at `%LOCALAPPDATA%/structured-text-viewer/config.json`
- Theme stored in `localStorage`

## RPC methods (webview → bun)
| Method | Params | Response |
|---|---|---|
| `selectDirectory` | `{}` | `string \| null` |
| `getRecentDirectories` | `{}` | `string[]` |
| `getLastDirectory` | `{}` | `string \| null` |
| `getWorkspaces` | `{}` | `{ directories, active }` — folders open as tabs |
| `setWorkspaces` | `{ directories, active }` | `void` |
| `readFile` | `{ filePath }` | `{ content, error? }` |
| `getFileStats` | `{ filePath }` | `{ size, modified, error? }` |
| `scanDirectory` | `{ dirPath }` | `FileTreeItem[]` |
| `openExternal` | `{ url }` | `void` |
| `getExpandedState` | `{}` | `Record<string, boolean>` |
| `setExpandedState` | `{ state }` | `void` |
| `resolveImage` | `{ markdownPath, src }` | `{ dataUrl?, error? }` |
| `getFontSize` | `{}` | `number \| null` |
| `setFontSize` | `{ size }` | `void` |

## Gotchas

### Electrobun API
- Full API reference → **read `llms.txt`**
- Updater: use `Updater.localInfo.channel()` — `Updater.getLocalInfo()` does not exist
- WebView import: `"electrobun/view"` (not `"electrobun/browser"`)
- `win.icon` path must exist or build fails silently with "Bundle failed"
- `src/types/three.d.ts` stubs `declare module "three"` for electrobun's WebGPU code

### Build
- Use `electrobun build --env=stable` (or `--env=canary`) for production, NOT `--targets=win-x64`
  - `--targets=win-x64` is cross-compilation mode and silently skips the `copy` config
  - `--env=stable` builds for the current platform and correctly copies all assets
- Directory copy in `electrobun.config.ts` (`"dist/assets": "views/mainview/assets"`) only works with `--env=*`, not `--targets=*`

### Window / WebView
- `window.close()` in the webview does NOT close the native window — send an RPC message to the Bun side and call `win.close()` there instead
- `titleBarStyle: "hidden"` on Windows causes: blurry rendering, broken window resize, and missing maximize/minimize buttons. Use the default titlebar and put toolbar controls inside the app content instead.

### High DPI (Windows)
- Electrobun does not automatically call `SetProcessDpiAwareness` (tracked in issue #239)
- Fix: call via Bun FFI **before** creating any `BrowserWindow`:
```typescript
import { dlopen, FFIType } from "bun:ffi";
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
  } catch {}
}
```

### RPC — File Dialog Pattern
- `Utils.openFileDialog` is a blocking modal. While it's open, `NavigationCompleted` can fire, which reinitializes Electroview and **drops any pending RPC request responses**.
- **Never** use a request-response RPC call to open a file dialog. The `await rpc.request.selectDirectory()` pattern will silently fail.
- **Correct pattern**: fire-and-forget message → Bun opens dialog → Bun pushes result back as a webview message → webview handles it via a `CustomEvent`:
  1. Webview: `rpc.send.openDirectoryDialog({})` (no await)
  2. Bun handler: opens dialog, then calls `win.webview.rpc?.send.directorySelected({ dirPath })`
  3. Webview rpcClient: `directorySelected` handler dispatches `new CustomEvent("directorySelected", { detail: { dirPath } })`
  4. React: `window.addEventListener("directorySelected", handler)` in a `useEffect`
