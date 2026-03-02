import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TreeView } from './TreeView';
import { FolderOpen, HardDrive } from 'lucide-react';
import { FileTreeItem } from '@/types';

interface SidebarProps {
  isOpen: boolean;
  width: number;
  currentDirectory: string | null;
  treeItems: FileTreeItem[];
  selectedFile: string | null;
  expandedState: Record<string, boolean>;
  onBrowse: () => void;
  onSelectFile: (path: string, type: 'markdown' | 'mermaid') => void;
  onResize: (width: number) => void;
  onExpandStateChange: (state: Record<string, boolean>) => void;
}

export function Sidebar({
  isOpen,
  width,
  currentDirectory,
  treeItems,
  selectedFile,
  expandedState,
  onBrowse,
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
      <div className="flex h-10 items-center justify-between border-b px-3">
        <div
          className="flex-1 truncate text-xs text-muted-foreground"
          title={currentDirectory || undefined}
        >
          {currentDirectory || 'No directory selected'}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBrowse}>
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>

      {/* Tree view */}
      <ScrollArea className="flex-1">
        {currentDirectory ? (
          treeItems.length > 0 ? (
            <TreeView
              items={treeItems}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              expandedState={expandedState}
              onExpandStateChange={onExpandStateChange}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
              <HardDrive className="h-8 w-8 opacity-50" />
              <p className="text-sm">No .md or .mmd files found</p>
            </div>
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
            <HardDrive className="h-8 w-8 opacity-50" />
            <p className="text-sm">Select a directory to browse</p>
            <Button variant="outline" size="sm" onClick={onBrowse}>
              Browse...
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
