You are an expert full-stack Electron developer. Generate a COMPLETE, ready-to-run Electron + Vite + React + TypeScript project with the following exact specifications:

Project name: structured-text-viewer
Description: A beautiful local Markdown & Mermaid file explorer and viewer.

Tech stack (must use):
- Electron ^32.0.0 (latest stable 2026)
- Vite + React 19 + TypeScript (strict mode)
- TailwindCSS + shadcn/ui components (for modern UI)
- electron-vite structure (main, preload, renderer separate)
- electron-builder for packaging

Core features:

1. Sidebar (left, 280px, resizable, toggleable with Ctrl+B or hamburger icon in title bar)
   - Top bar inside sidebar:
     - Current directory path (truncated with tooltip)
     - Button "Browse..." → select folder for scanning.
   - Below: Virtualized Tree View (use react-arborist) showing ONLY folders + files with extension .md or .mmd
     - Recursive scan selected folder for subfolders and .md, .mmd files.
     - Folders are expandable/collapsible, clickable to expand
     - Files are clickable → load content in main viewer
     - Show file icons (Markdown icon for .md, Mermaid icon for .mmd)
     - Remember expanded state & last opened directory

2. Main viewer area (right side, takes remaining space)
   - Always scrollable
   - If file ends with .md:
     - Render with react-markdown + remark-gfm + rehype-raw
     - Full GitHub Flavored Markdown support (tables, task lists, strikethrough, etc.)
     - Automatically initialize Mermaid diagrams inside ```mermaid blocks
     - Text always wraps (word-break: break-word)
     - Zoom controls: + / - / Reset buttons + mouse wheel (Ctrl+Wheel) → changes font-size (default 16px, range 10-32px)
   - If file ends with .mmd:
     - Treat as pure Mermaid code
     - Render with mermaid js (latest version)
     - Support full pan (drag) + zoom (wheel + buttons)
     - Controls: Zoom in/out/reset + fit to screen

3. Additional nice-to-have (must implement):
   - Dark/light theme (auto follow system + manual toggle)
   - Status bar at bottom showing file path, size, last modified
   - Keyboard shortcuts: Ctrl+O (browse dir), Ctrl+B (toggle sidebar), Ctrl++ / Ctrl+- (zoom)
   - Error handling: graceful fallback if file cannot be read
   - On app start: open last used directory (or ~/Documents if none)

4. Build & packaging:
   - Use electron-builder
   - package.json scripts:
     "dev": "electron-vite dev",
     "build": "electron-vite build && electron-builder",
     "build:win": "electron-vite build && electron-builder --win",
     "build:mac": "electron-vite build && electron-builder --mac",
     "build:linux": "electron-vite build && electron-builder --linux"
   - electron-builder config in package.json supporting:
     - Windows: NSIS portable + .exe installer
     - macOS: .dmg + universal binary
     - Linux: .AppImage + .deb
   - App should run as single executable/binary on all 3 OS without extra dependencies

Generate the FULL project structure with ALL files and exact content:
- package.json (with all dependencies and electron-builder config)
- vite.config.ts
- tsconfig.json
- electron/main.ts, electron/preload.ts
- src/ (React components): App.tsx, Sidebar.tsx, TreeView.tsx, Viewer.tsx, MarkdownViewer.tsx, MermaidViewer.tsx, etc.
- All necessary IPC channels clearly documented
- Tailwindcss + shadcn setup
- README.md with build instructions

Make sure the project runs perfectly after:
npm install
npm run dev

And produces clean distributables with npm run build.