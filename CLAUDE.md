# CLAUDE.md — structured-text-viewer

> For all Electrobun API details, refer to `llms.txt` in the project root.

## Project
Desktop Markdown & Mermaid file explorer/viewer built with Electrobun (Windows, WebView2).

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
    components/         — TitleBar, Sidebar, TreeView, Viewer, MarkdownViewer, MermaidViewer, StatusBar
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
bun run typecheck    # tsc --noEmit
```

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
| `readFile` | `{ filePath }` | `{ content, error? }` |
| `getFileStats` | `{ filePath }` | `{ size, modified, error? }` |
| `scanDirectory` | `{ dirPath }` | `FileTreeItem[]` |
| `openExternal` | `{ url }` | `void` |
| `getExpandedState` | `{}` | `Record<string, boolean>` |
| `setExpandedState` | `{ state }` | `void` |

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
