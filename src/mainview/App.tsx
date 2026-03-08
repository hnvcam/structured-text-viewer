import { useState, useEffect, useCallback, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { Viewer } from './components/Viewer';
import { StatusBar } from './components/StatusBar';
import { Separator } from './components/ui/separator';
import { useTheme } from './hooks/useTheme';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { FileTreeItem } from './types';
import { rpc } from './rpcClient';

const DEFAULT_ZOOM = 16;
const MIN_ZOOM = 10;
const MAX_ZOOM = 32;
const DEFAULT_SIDEBAR_WIDTH = 280;

function App() {
  // Theme
  const { theme, toggleTheme } = useTheme();

  // App state
  const [currentDirectory, setCurrentDirectory] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'markdown' | 'mermaid' | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileStats, setFileStats] = useState<{ size: number; modified: string } | null>(null);
  const [treeItems, setTreeItems] = useState<FileTreeItem[]>([]);
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({});
  const prevExpandedStateRef = useRef<Record<string, boolean>>({});

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Load last directory on mount
  useEffect(() => {
    const loadLastDirectory = async () => {
      try {
        const lastDir = await rpc.request.getLastDirectory({});
        const expanded = await rpc.request.getExpandedState({});

        if (lastDir) {
          setCurrentDirectory(lastDir);
          const items = await rpc.request.scanDirectory({ dirPath: lastDir });
          setTreeItems(items);

          // Scan expanded folders
          if (expanded && Object.keys(expanded).length > 0) {
            const expandedDirs = Object.entries(expanded)
              .filter(([_, v]) => v)
              .map(([k]) => k);

            for (const dirPath of expandedDirs) {
              await scanDirPath(dirPath);
            }

            setExpandedState(expanded);
            prevExpandedStateRef.current = { ...expanded };
          }
        }
      } catch (error) {
        console.error('Failed to load last directory:', error);
      }
    };

    loadLastDirectory();
  }, []);

  // Handle directory browsing
  const handleBrowseDirectory = useCallback(async () => {
    try {
      const dirPath = await rpc.request.selectDirectory({});
      if (dirPath) {
        setCurrentDirectory(dirPath);
        setSelectedFile(null);
        setFileContent(null);
        setFileError(null);
        setFileStats(null);

        const items = await rpc.request.scanDirectory({ dirPath });
        setTreeItems(items);
      }
    } catch (error) {
      console.error('Failed to browse directory:', error);
    }
  }, []);

  // Handle file selection
  const handleSelectFile = useCallback(async (path: string, type: 'markdown' | 'mermaid') => {
    setSelectedFile(path);
    setFileType(type);
    setFileError(null);

    try {
      const result = await rpc.request.readFile({ filePath: path });
      if (result.error) {
        setFileError(result.error);
        setFileContent(null);
      } else {
        setFileContent(result.content);
      }

      const stats = await rpc.request.getFileStats({ filePath: path });
      if (!stats.error) {
        setFileStats({ size: stats.size, modified: stats.modified });
      }
    } catch (error) {
      setFileError(`Failed to read file: ${(error as Error).message}`);
      setFileContent(null);
    }
  }, []);

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev + 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_ZOOM, prev - 1));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

  const scanDirPath = useCallback(async (dirPath: string) => {
    try {
      const items = await rpc.request.scanDirectory({ dirPath });

      if (items.length > 0) {
        setTreeItems(prevItems => {
          const cloneTree = (items: FileTreeItem[]): FileTreeItem[] => {
            return items.map(item => ({
              ...item,
              children: item.children ? cloneTree(item.children) : [],
            }));
          };
          const newItems = cloneTree(prevItems);
          const normalizePath = (p: string) => p.replace(/\\/g, '/').toLowerCase();
          const normalizedTarget = normalizePath(dirPath);

          const addToTree = (tree: FileTreeItem[], targetPath: string, children: FileTreeItem[]): boolean => {
            for (const item of tree) {
              if (normalizePath(item.path) === targetPath) {
                item.children = children;
                return true;
              }
              if (item.children && item.children.length > 0) {
                if (addToTree(item.children, targetPath, children)) return true;
              }
            }
            return false;
          };

          addToTree(newItems, normalizedTarget, items);
          return newItems;
        });
      }
    } catch (error) {
      console.error('Failed to scan subdirectory:', error);
    }
  }, []);

  // Handle expanded state change
  const handleExpandStateChange = useCallback(async (state: Record<string, boolean>) => {
    const newlyExpanded = Object.entries(state).filter(
      ([id, expanded]) => expanded && !prevExpandedStateRef.current[id]
    );

    setExpandedState(state);
    prevExpandedStateRef.current = { ...state };
    await rpc.request.setExpandedState({ state });

    for (const [dirPath] of newlyExpanded) {
      await scanDirPath(dirPath);
    }
  }, [scanDirPath]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleSidebar: () => setSidebarOpen((prev) => !prev),
    onBrowseDirectory: handleBrowseDirectory,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onZoomReset: handleZoomReset,
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      <TitleBar
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onBrowseDirectory={handleBrowseDirectory}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <Separator />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          width={sidebarWidth}
          currentDirectory={currentDirectory}
          treeItems={treeItems}
          selectedFile={selectedFile}
          expandedState={expandedState}
          onBrowse={handleBrowseDirectory}
          onSelectFile={handleSelectFile}
          onResize={setSidebarWidth}
          onExpandStateChange={handleExpandStateChange}
        />
        <div className="flex-1 overflow-hidden">
          <Viewer
            filePath={selectedFile}
            fileType={fileType}
            content={fileContent}
            error={fileError}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        </div>
      </div>
      <StatusBar
        filePath={selectedFile}
        fileSize={fileStats?.size ?? null}
        fileModified={fileStats?.modified ?? null}
        fileType={fileType}
      />
    </div>
  );
}

export default App;
