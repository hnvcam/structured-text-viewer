import { useState, useEffect, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { Viewer } from './components/Viewer';
import { StatusBar } from './components/StatusBar';
import { Separator } from './components/ui/separator';
import { useTheme } from './hooks/useTheme';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { FileTreeItem } from './types';
import './index.css';

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

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Load last directory on mount
  useEffect(() => {
    const loadLastDirectory = async () => {
      console.log('[APP] Loading last directory on mount');
      try {
        const lastDir = await window.electronAPI.getLastDirectory();
        console.log('[APP] Last directory from store:', lastDir);
        const expanded = await window.electronAPI.getExpandedState();
        console.log('[APP] Expanded state from store:', expanded);
        
        if (expanded) {
          setExpandedState(expanded);
        }

        if (lastDir) {
          console.log('[APP] Scanning last directory:', lastDir);
          setCurrentDirectory(lastDir);
          const items = await window.electronAPI.scanDirectory(lastDir);
          console.log('[APP] Initial scan returned', items.length, 'items:', items);
          setTreeItems(items);
        }
      } catch (error) {
        console.error('[APP] Failed to load last directory:', error);
      }
    };

    loadLastDirectory();
  }, []);

  // Handle directory browsing
  const handleBrowseDirectory = useCallback(async () => {
    console.log('[APP] Browse button clicked');
    try {
      console.log('[APP] Calling selectDirectory...');
      const dirPath = await window.electronAPI.selectDirectory();
      console.log('[APP] selectDirectory returned:', dirPath);
      if (dirPath) {
        console.log('[APP] Setting current directory to:', dirPath);
        setCurrentDirectory(dirPath);
        setSelectedFile(null);
        setFileContent(null);
        setFileError(null);
        setFileStats(null);

        console.log('[APP] Scanning directory:', dirPath);
        const items = await window.electronAPI.scanDirectory(dirPath);
        console.log('[APP] Scan returned', items.length, 'items:', items);
        setTreeItems(items);
      }
    } catch (error) {
      console.error('[APP] Failed to browse directory:', error);
    }
  }, []);

  // Handle file selection
  const handleSelectFile = useCallback(async (path: string, type: 'markdown' | 'mermaid') => {
    setSelectedFile(path);
    setFileType(type);
    setFileError(null);

    try {
      const result = await window.electronAPI.readFile(path);
      if (result.error) {
        setFileError(result.error);
        setFileContent(null);
      } else {
        setFileContent(result.content);
      }

      const stats = await window.electronAPI.getFileStats(path);
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

  // Handle expanded state change
  const handleExpandStateChange = useCallback(async (state: Record<string, boolean>) => {
    setExpandedState(state);
    await window.electronAPI.setExpandedState(state);
  }, []);

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
