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
bun run build:win    # vite build + electrobun build --targets=win-x64
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
- Electrobun API reference → **read `llms.txt`**
- Updater: use `Updater.localInfo.channel()` (not `Updater.getLocalInfo()`)
- WebView import: `"electrobun/view"` (not `"electrobun/browser"`)
- `win.icon` path must exist or build fails silently
- `src/types/three.d.ts` stubs `declare module "three"` for electrobun's WebGPU code
