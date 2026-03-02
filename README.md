# Structured Text Viewer

A beautiful local Markdown & Mermaid file explorer and viewer built with Electron, Vite, React, and TypeScript.

![Structured Text Viewer](./screenshot.png)

## Features

- **File Explorer**: Browse and navigate directories containing Markdown (`.md`) and Mermaid (`.mmd`) files
- **Markdown Viewer**: Full GitHub Flavored Markdown support with tables, task lists, and syntax highlighting
- **Mermaid Diagrams**: Render Mermaid diagrams both inline in Markdown and as standalone `.mmd` files
- **Virtualized Tree View**: Efficient file tree navigation using react-arborist
- **Zoom Controls**: Adjustable font size for Markdown (10-32px) and zoom/pan for Mermaid diagrams
- **Dark/Light Theme**: Auto-detect system theme with manual toggle
- **Keyboard Shortcuts**: Quick access to all features
- **Persistent State**: Remembers last opened directory and expanded folder state

## Tech Stack

- **Electron** ^32.0.0 - Cross-platform desktop app framework
- **Vite** ^6.0.0 - Fast build tool and dev server
- **React 19** - UI library
- **TypeScript** - Type safety
- **TailwindCSS** - Utility-first CSS framework
- **shadcn/ui** - Beautiful UI components
- **react-arborist** - Virtualized tree view
- **react-markdown** - Markdown rendering
- **mermaid** - Diagram rendering
- **electron-builder** - Packaging and distribution

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/structured-text-viewer.git
cd structured-text-viewer

# Install dependencies
npm install
```

### Development

```bash
# Start the development server
npm run dev
```

This will launch the Electron app with hot module reloading.

### Building

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

Built distributables will be in the `release/` directory.

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
structured-text-viewer/
├── electron/
│   ├── main.ts          # Electron main process
│   └── preload.ts       # Preload script for IPC
├── src/
│   ├── renderer/
│   │   ├── index.html   # Entry HTML file
│   │   ├── components/
│   │   │   ├── ui/      # shadcn/ui components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TreeView.tsx
│   │   │   ├── Viewer.tsx
│   │   │   ├── MarkdownViewer.tsx
│   │   │   ├── MermaidViewer.tsx
│   │   │   ├── TitleBar.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── hooks/
│   │   │   ├── useTheme.ts
│   │   │   └── useKeyboardShortcuts.ts
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
├── build/               # Build assets (icons, etc.)
├── release/             # Built distributables
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── electron.vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## IPC Channels

The app uses the following IPC channels for communication between main and renderer processes:

| Channel | Direction | Description |
|---------|-----------|-------------|
| `app:select-directory` | Renderer → Main | Open directory picker dialog |
| `app:get-recent-directories` | Renderer → Main | Get list of recently opened directories |
| `app:get-last-directory` | Renderer → Main | Get the last opened directory |
| `file:read` | Renderer → Main | Read file contents |
| `file:get-stats` | Renderer → Main | Get file statistics (size, modified date) |
| `file:scan-directory` | Renderer → Main | Scan directory for .md and .mmd files |
| `shell:open-external` | Renderer → Main | Open URL in external browser |
| `store:get-expanded-state` | Renderer → Main | Get saved folder expansion state |
| `store:set-expanded-state` | Renderer → Main | Save folder expansion state |

## Configuration

### Electron Builder

The `package.json` contains electron-builder configuration for all platforms:

- **Windows**: NSIS installer (portable option available)
- **macOS**: DMG with universal binary (Intel + Apple Silicon)
- **Linux**: AppImage and .deb packages

### Theme

The app automatically detects system theme preference. You can toggle between light and dark modes using the sun/moon icon in the title bar.

## Supported File Types

- **`.md`** - Markdown files rendered with full GFM support
- **`.mmd`** - Mermaid diagram files rendered as interactive diagrams

## Mermaid Support

The app supports all Mermaid diagram types:

- Flowcharts
- Sequence diagrams
- Class diagrams
- State diagrams
- Entity relationship diagrams
- User journey diagrams
- Gantt charts
- Pie charts
- Quadrant charts
- Requirement diagrams
- Git graphs
- C4 diagrams
- Mindmaps
- Timeline diagrams
- ZenUML sequence diagrams
- Sankey diagrams
- XY charts
- Block diagrams

## Troubleshooting

### App doesn't start

Make sure all dependencies are installed:
```bash
npm install
```

### Build fails

Try cleaning the build cache:
```bash
rm -rf dist dist-electron release node_modules
npm install
npm run build
```

### Mermaid diagrams not rendering

Ensure the Mermaid syntax is valid. Invalid diagrams will show an error message.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
