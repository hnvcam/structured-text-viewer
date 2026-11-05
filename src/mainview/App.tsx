import { useState, useEffect, useCallback, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { Viewer } from './components/Viewer';
import { StatusBar } from './components/StatusBar';
import { Separator } from './components/ui/separator';
import { useTheme } from './hooks/useTheme';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { FileTreeItem, ViewableFileType, Workspace } from './types';
import { rpc } from './rpcClient';
import { isWithin, pathKey, samePath } from './lib/paths';

const DEFAULT_ZOOM = 16;
const MIN_ZOOM = 10;
const MAX_ZOOM = 32;
const DEFAULT_SIDEBAR_WIDTH = 280;

function newWorkspace(dirPath: string, treeItems: FileTreeItem[]): Workspace {
  return { dirPath, treeItems, selectedFile: null, fileType: null, content: null, error: null, stats: null };
}

// Return `tree` with the folder at `folderPath` given `children`.
function withChildren(tree: FileTreeItem[], folderPath: string, children: FileTreeItem[]): FileTreeItem[] {
  const target = pathKey(folderPath);
  const visit = (items: FileTreeItem[]): FileTreeItem[] =>
    items.map((item) => {
      if (pathKey(item.path) === target) return { ...item, children };
      if (item.children && item.children.length > 0) return { ...item, children: visit(item.children) };
      return item;
    });
  return visit(tree);
}

// Scan a folder plus every expanded folder beneath it, so trees reopen with
// their expanded folders already populated. Parents are scanned before
// children (shorter paths first) so each one has somewhere to attach.
async function buildTree(dirPath: string, expanded: Record<string, boolean>): Promise<FileTreeItem[]> {
  let tree = await rpc.request.scanDirectory({ dirPath });
  const openDirs = Object.entries(expanded)
    .filter(([p, open]) => open && isWithin(p, dirPath) && !samePath(p, dirPath))
    .map(([p]) => p)
    .sort((a, b) => a.length - b.length);
  for (const sub of openDirs) {
    tree = withChildren(tree, sub, await rpc.request.scanDirectory({ dirPath: sub }));
  }
  return tree;
}

function App() {
  // Theme
  const { theme, toggleTheme } = useTheme();

  // Open folders (tabs), each with its own tree and open file
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeDir, setActiveDir] = useState<string | null>(null);
  // Folder expansion, keyed by absolute path — shared by every tab's tree.
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({});
  const prevExpandedStateRef = useRef<Record<string, boolean>>({});
  // Don't save the tab list until the saved one has been restored.
  const workspacesLoadedRef = useRef(false);

  // Latest values for callbacks that shouldn't re-subscribe on every change.
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;
  const activeDirRef = useRef(activeDir);
  activeDirRef.current = activeDir;

  const active = workspaces.find((w) => w.dirPath === activeDir) ?? null;

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tocOpen, setTocOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  // Don't write the font size back until the saved value has been loaded,
  // otherwise the default would overwrite the user's setting on startup.
  const zoomLoadedRef = useRef(false);

  // Restore the saved font size
  useEffect(() => {
    rpc.request.getFontSize({})
      .then((size) => {
        if (size != null) setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(size))));
      })
      .catch((error) => console.error('Failed to load font size:', error))
      .finally(() => { zoomLoadedRef.current = true; });
  }, []);

  // Persist font size changes (debounced — Ctrl+wheel fires many steps quickly)
  useEffect(() => {
    if (!zoomLoadedRef.current) return;
    const timer = setTimeout(() => {
      rpc.request.setFontSize({ size: zoom }).catch((error) =>
        console.error('Failed to save font size:', error)
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [zoom]);

  const updateWorkspace = useCallback((dirPath: string, patch: Partial<Workspace>) => {
    setWorkspaces((prev) => prev.map((w) => (w.dirPath === dirPath ? { ...w, ...patch } : w)));
  }, []);

  // Restore the folders that were open last time
  useEffect(() => {
    const restore = async () => {
      try {
        const [{ directories, active: savedActive }, expanded] = await Promise.all([
          rpc.request.getWorkspaces({}),
          rpc.request.getExpandedState({}),
        ]);
        const restored = await Promise.all(
          directories.map(async (dirPath) => newWorkspace(dirPath, await buildTree(dirPath, expanded)))
        );
        setExpandedState(expanded);
        prevExpandedStateRef.current = { ...expanded };
        // Keep any folder the user opened while this was loading.
        setWorkspaces((prev) => [
          ...restored,
          ...prev.filter((w) => !restored.some((r) => samePath(r.dirPath, w.dirPath))),
        ]);
        setActiveDir((prev) => prev ?? savedActive);
      } catch (error) {
        console.error('Failed to restore open folders:', error);
      } finally {
        workspacesLoadedRef.current = true;
      }
    };

    restore();
  }, []);

  // Save the open folders and the active one
  const directoriesKey = workspaces.map((w) => w.dirPath).join('\n');
  useEffect(() => {
    if (!workspacesLoadedRef.current) return;
    rpc.request
      .setWorkspaces({ directories: workspacesRef.current.map((w) => w.dirPath), active: activeDir })
      .catch((error) => console.error('Failed to save open folders:', error));
  }, [directoriesKey, activeDir]);

  // Handle directory browsing — fire-and-forget to avoid RPC drop during dialog
  const handleBrowseDirectory = useCallback(() => {
    rpc.send.openDirectoryDialog({});
  }, []);

  // Most recently requested file per tab, so a slow read for a file the user
  // has since navigated away from doesn't overwrite the current one.
  const latestFileRef = useRef(new Map<string, string>());

  // Read a file's content and stats into its tab. Existing content stays on
  // screen until the new read completes, so refreshes don't flash or lose scroll.
  const loadFile = useCallback(async (dirPath: string, path: string) => {
    latestFileRef.current.set(dirPath, path);
    const isCurrent = () => latestFileRef.current.get(dirPath) === path;
    try {
      const result = await rpc.request.readFile({ filePath: path });
      if (!isCurrent()) return;
      updateWorkspace(
        dirPath,
        result.error ? { error: result.error, content: null } : { error: null, content: result.content }
      );

      const stats = await rpc.request.getFileStats({ filePath: path });
      if (!isCurrent()) return;
      if (!stats.error) {
        updateWorkspace(dirPath, { stats: { size: stats.size, modified: stats.modified } });
      }
    } catch (error) {
      if (!isCurrent()) return;
      updateWorkspace(dirPath, { error: `Failed to read file: ${(error as Error).message}`, content: null });
    }
  }, [updateWorkspace]);

  // Open a folder in a new tab, or switch to it if it's already open.
  const openWorkspace = useCallback(async (dirPath: string) => {
    const existing = workspacesRef.current.find((w) => samePath(w.dirPath, dirPath));
    if (existing) {
      setActiveDir(existing.dirPath);
      return;
    }
    const tree = await buildTree(dirPath, prevExpandedStateRef.current);
    setWorkspaces((prev) =>
      prev.some((w) => samePath(w.dirPath, dirPath)) ? prev : [...prev, newWorkspace(dirPath, tree)]
    );
    setActiveDir(dirPath);
  }, []);

  // Handle directory selected (pushed from bun after dialog closes)
  useEffect(() => {
    const handler = (e: Event) => {
      const { dirPath } = (e as CustomEvent<{ dirPath: string | null }>).detail;
      if (dirPath) void openWorkspace(dirPath);
    };
    window.addEventListener("directorySelected", handler);
    return () => window.removeEventListener("directorySelected", handler);
  }, [openWorkspace]);

  // Switch tabs; re-read the tab's open file in case it changed on disk.
  const selectWorkspace = useCallback((dirPath: string) => {
    if (dirPath === activeDirRef.current) return;
    setActiveDir(dirPath);
    const ws = workspacesRef.current.find((w) => w.dirPath === dirPath);
    if (ws?.selectedFile) void loadFile(dirPath, ws.selectedFile);
  }, [loadFile]);

  const closeWorkspace = useCallback((dirPath: string) => {
    const list = workspacesRef.current;
    const index = list.findIndex((w) => w.dirPath === dirPath);
    if (index < 0) return;
    const remaining = list.filter((_, i) => i !== index);
    setWorkspaces(remaining);
    latestFileRef.current.delete(dirPath);
    if (activeDirRef.current === dirPath) {
      // Activate the tab that slides into this position, or the new last one.
      const next = remaining[Math.min(index, remaining.length - 1)];
      setActiveDir(next?.dirPath ?? null);
      if (next?.selectedFile) void loadFile(next.dirPath, next.selectedFile);
    }
  }, [loadFile]);

  const cycleWorkspace = useCallback((delta: 1 | -1) => {
    const list = workspacesRef.current;
    if (list.length < 2) return;
    const index = list.findIndex((w) => w.dirPath === activeDirRef.current);
    const next = list[(index + delta + list.length) % list.length];
    if (next) selectWorkspace(next.dirPath);
  }, [selectWorkspace]);

  const selectWorkspaceAt = useCallback((index: number) => {
    const list = workspacesRef.current;
    const ws = index < 0 ? list[list.length - 1] : list[index];
    if (ws) selectWorkspace(ws.dirPath);
  }, [selectWorkspace]);

  const closeActiveWorkspace = useCallback(() => {
    if (activeDirRef.current) closeWorkspace(activeDirRef.current);
  }, [closeWorkspace]);

  // Handle file selection
  const handleSelectFile = useCallback(async (dirPath: string, path: string, type: ViewableFileType) => {
    updateWorkspace(dirPath, { selectedFile: path, fileType: type, error: null });
    await loadFile(dirPath, path);
  }, [updateWorkspace, loadFile]);

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

  // Load a folder's contents (and its expanded descendants) into every tab
  // whose tree contains it.
  const scanDirPath = useCallback(async (dirPath: string, expanded: Record<string, boolean>) => {
    try {
      const children = await buildTree(dirPath, expanded);
      setWorkspaces((prev) =>
        prev.map((ws) =>
          isWithin(dirPath, ws.dirPath) && !samePath(dirPath, ws.dirPath)
            ? { ...ws, treeItems: withChildren(ws.treeItems, dirPath, children) }
            : ws
        )
      );
    } catch (error) {
      console.error('Failed to scan subdirectory:', error);
    }
  }, []);

  // Handle directory refresh — rescan the active folder and its expanded subdirs
  const handleRefreshDirectory = useCallback(async () => {
    const dirPath = activeDirRef.current;
    if (!dirPath) return;
    try {
      const tree = await buildTree(dirPath, prevExpandedStateRef.current);
      updateWorkspace(dirPath, { treeItems: tree });
    } catch (error) {
      console.error('Failed to refresh directory:', error);
    }
  }, [updateWorkspace]);

  // Viewer-toolbar refresh: re-read the open file from disk.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshFile = useCallback(async () => {
    if (!active?.selectedFile) return;
    setRefreshing(true);
    try {
      await loadFile(active.dirPath, active.selectedFile);
    } finally {
      setRefreshing(false);
    }
  }, [active?.dirPath, active?.selectedFile, loadFile]);

  // Handle expanded state change
  const handleExpandStateChange = useCallback(async (state: Record<string, boolean>) => {
    const newlyExpanded = Object.entries(state).filter(
      ([id, expanded]) => expanded && !prevExpandedStateRef.current[id]
    );

    setExpandedState(state);
    prevExpandedStateRef.current = { ...state };
    await rpc.request.setExpandedState({ state });

    for (const [dirPath] of newlyExpanded) {
      await scanDirPath(dirPath, state);
    }
  }, [scanDirPath]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleSidebar: () => setSidebarOpen((prev) => !prev),
    onToggleToc: () => setTocOpen((prev) => !prev),
    onBrowseDirectory: handleBrowseDirectory,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onZoomReset: handleZoomReset,
    onRefresh: handleRefreshFile,
    onCloseTab: closeActiveWorkspace,
    onCycleTab: cycleWorkspace,
    onSelectTab: selectWorkspaceAt,
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      <TitleBar
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onToggleToc={() => setTocOpen((prev) => !prev)}
        tocOpen={tocOpen}
        onBrowseDirectory={handleBrowseDirectory}
        onRefreshDirectory={handleRefreshDirectory}
        tabs={workspaces}
        activeDir={activeDir}
        onSelectWorkspace={selectWorkspace}
        onCloseWorkspace={closeWorkspace}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <Separator />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          width={sidebarWidth}
          workspaces={workspaces}
          activeDir={activeDir}
          expandedState={expandedState}
          onBrowse={handleBrowseDirectory}
          onRefresh={handleRefreshDirectory}
          onSelectFile={handleSelectFile}
          onResize={setSidebarWidth}
          onExpandStateChange={handleExpandStateChange}
        />
        <div className="flex-1 overflow-hidden">
          <Viewer
            filePath={active?.selectedFile ?? null}
            fileType={active?.fileType ?? null}
            content={active?.content ?? null}
            error={active?.error ?? null}
            zoom={zoom}
            onZoomChange={setZoom}
            tocOpen={tocOpen}
            onRefresh={handleRefreshFile}
            refreshing={refreshing}
          />
        </div>
      </div>
      <StatusBar
        filePath={active?.selectedFile ?? null}
        fileSize={active?.stats?.size ?? null}
        fileModified={active?.stats?.modified ?? null}
        fileType={active?.fileType ?? null}
      />
    </div>
  );
}

export default App;
