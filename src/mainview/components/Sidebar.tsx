import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TreeView } from './TreeView';
import { FolderOpen, HardDrive, RefreshCw } from 'lucide-react';
import { ViewableFileType, Workspace } from '@/types';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  width: number;
  workspaces: Workspace[];
  activeDir: string | null;
  expandedState: Record<string, boolean>;
  onBrowse: () => void;
  onRefresh: () => void;
  onSelectFile: (dirPath: string, path: string, type: ViewableFileType) => void;
  onResize: (width: number) => void;
  onExpandStateChange: (state: Record<string, boolean>) => void;
}

export function Sidebar({
  isOpen,
  width,
  workspaces,
  activeDir,
  expandedState,
  onBrowse,
  onRefresh,
  onSelectFile,
  onResize,
  onExpandStateChange,
}: SidebarProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(500, startWidth + moveEvent.clientX - startX));
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isOpen) {
    return null;
  }

  const currentDirectory = activeDir;

  return (
    <div
      className="relative flex h-full flex-col border-r bg-card"
      style={{ width: `${width}px`, minWidth: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent"
        onMouseDown={handleMouseDown}
      />

      {/* Sidebar header */}
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b px-3">
        <div
          className="flex-1 truncate text-xs text-muted-foreground"
          title={currentDirectory || undefined}
        >
          {currentDirectory || 'No directory selected'}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          title="Refresh Directory"
          disabled={!currentDirectory}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onBrowse();
          }}
          title="Open Folder in New Tab (Ctrl+O)"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>

      {/* Tree view */}
      <div className="flex-1 overflow-hidden flex flex-row">
        <ScrollArea className="flex-1 min-h-0 flex flex-row">
          {/* Every tab's tree stays mounted (inactive ones hidden) so expansion
              and scroll position survive switching tabs. */}
          {workspaces.map((ws) => (
            <div key={ws.dirPath} className={cn(ws.dirPath === activeDir ? 'contents' : 'hidden')}>
              {ws.treeItems.length > 0 ? (
                <TreeView
                  items={ws.treeItems}
                  selectedFile={ws.selectedFile}
                  onSelectFile={(path, type) => onSelectFile(ws.dirPath, path, type)}
                  expandedState={expandedState}
                  onExpandStateChange={onExpandStateChange}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
                  <HardDrive className="h-8 w-8 opacity-50" />
                  <p className="text-sm">No supported files found</p>
                </div>
              )}
            </div>
          ))}
          {!currentDirectory && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
              <HardDrive className="h-8 w-8 opacity-50" />
              <p className="text-sm">Select a directory to browse</p>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onBrowse();
                }}
              >
                Browse...
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
