# Structured Text Viewer

A local Markdown, Mermaid, and SVG file explorer and viewer built with Electrobun, React, and TypeScript.

## Features

- **File Explorer**: Browse and navigate directories containing `.md`, `.mmd`, and `.svg` files
- **Markdown Viewer**: Full GitHub Flavored Markdown support with tables, task lists, and syntax highlighting
- **Mermaid Diagrams**: Render Mermaid diagrams both inline in Markdown and as standalone `.mmd` files
- **SVG Viewer**: Render SVG files inline with zoom and pan support
- **Zoom Controls**: Adjustable font size for Markdown and zoom/pan for Mermaid and SVG
- **Dark/Light Theme**: Auto-detect system theme with manual toggle
- **Keyboard Shortcuts**: Quick access to all features
- **Persistent State**: Remembers last opened directory and expanded folder state

## Tech Stack

- **Electrobun** 1.15.1 - Cross-platform desktop app framework (Bun + System WebView)
- **Bun** - Runtime and package manager
- **Vite** - Frontend build tool
- **React 19** - UI library
- **TypeScript** - Type safety
- **TailwindCSS 3** - Utility-first CSS framework
- **shadcn/ui** - UI components

## Prerequisites

- [Bun](https://bun.sh) 1.x
- **Windows**: WebView2 (ships with Windows 10/11)
- **Linux**: WebKitGTK 3 or CEF (Electrobun bundles CEF for production builds)

## Getting Started

```bash
# Install dependencies
bun install

# Development (build frontend + launch app)
bun run dev

# Development with HMR
bun run dev:hmr
```

## Building

```bash
# Build for the current platform
bun run build

# Build for Linux specifically
bun run build:linux

# Build for Windows specifically
bun run build:win
```

### Linux System Dependencies

If using the native WebKitGTK renderer (development), install:

```bash
# Debian/Ubuntu/Pop!_OS
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev
```

For production builds, Electrobun bundles Chromium Embedded Framework (CEF), which requires:

```bash
# Debian/Ubuntu/Pop!_OS
sudo apt install libgtk-3-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0
libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1
libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2
libasound2 libexpat1
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+O` | Browse directory |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom |

## Project Structure

```
src/
  bun/index.ts          — Main process: window, RPC handlers, fs ops, config store
  mainview/
    index.tsx           — Webview entry (React root)
    rpcClient.ts        — RPC singleton
    App.tsx             — Root React component
    index.html          — HTML template
    index.css           — Tailwind source
    components/         — TitleBar, Sidebar, TreeView, Viewer, MarkdownViewer, MermaidViewer, SvgViewer, StatusBar
    hooks/              — useTheme, useKeyboardShortcuts
    lib/utils.ts        — cn() utility
    types/index.ts      — Shared types
  shared/rpc.ts         — AppRPC type schema (shared bun ↔ webview)
vite.config.ts
electrobun.config.ts
tailwind.config.js
```

## Supported File Types

- **`.md`** — Markdown files rendered with full GFM support
- **`.mmd`** — Mermaid diagram files rendered as interactive diagrams
- **`.svg`** — SVG files rendered inline with zoom and pan

## Configuration

App config is stored in a platform-appropriate location:
- **Windows**: `%LOCALAPPDATA%/structured-text-viewer/config.json`
- **Linux**: `~/.local/share/structured-text-viewer/config.json`

Theme preference is stored in `localStorage`.

## License

MIT
