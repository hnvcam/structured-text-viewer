import { useEffect, useRef } from 'react';
import { Folder, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { baseName, parentPath, relativeDir } from '@/lib/paths';
import { FileType } from '@/types';
import { FileIcon } from './TreeView';

export interface WorkspaceTab {
  dirPath: string;
  selectedFile: string | null;
  fileType: FileType;
}

interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeDir: string | null;
  onSelect: (dirPath: string) => void;
  onClose: (dirPath: string) => void;
  onOpen: () => void;
}

// Tab labels are folder names; when two open folders share a name, the parent
// folder name is shown next to each so they can be told apart.
function tabLabels(directories: string[]): { name: string; hint?: string }[] {
  const counts = new Map<string, number>();
  for (const dir of directories) {
    const name = baseName(dir);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return directories.map((dir) => {
    const name = baseName(dir);
    return { name, hint: (counts.get(name) ?? 0) > 1 ? baseName(parentPath(dir)) : undefined };
  });
}

export function WorkspaceTabs({ tabs, activeDir, onSelect, onClose, onOpen }: WorkspaceTabsProps) {
  const directories = tabs.map((t) => t.dirPath);
  const activeTabRef = useRef<HTMLDivElement>(null);

  // Keep the active tab visible when it changes or tabs are added.
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeDir, directories.length]);

  const labels = tabLabels(directories);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5 px-2">
      {directories.length === 0 && (
        <span className="select-none px-1 text-xs text-muted-foreground">Structured Text Viewer</span>
      )}
      <div
        role="tablist"
        className="no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto"
        onWheel={(e) => {
          // Let a vertical mouse wheel scroll the tab strip sideways.
          if (e.deltaY && !e.deltaX) e.currentTarget.scrollLeft += e.deltaY;
        }}
      >
        {tabs.map(({ dirPath: dir, selectedFile, fileType }, i) => {
          const isActive = dir === activeDir;
          const { name, hint } = labels[i]!;
          const subDir = selectedFile ? relativeDir(selectedFile, dir) : '';
          const tooltip = selectedFile ?? dir;
          return (
            <div
              key={dir}
              ref={isActive ? activeTabRef : undefined}
              role="tab"
              aria-selected={isActive}
              title={i < 9 ? `${tooltip}\n(Ctrl+${i + 1})` : tooltip}
              className={cn(
                'group flex h-6 max-w-[440px] flex-shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md border pl-2 pr-1 text-xs transition-colors',
                isActive
                  ? 'border-border bg-accent text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
              onClick={() => onSelect(dir)}
              onMouseDown={(e) => {
                // Stop the middle button from starting autoscroll.
                if (e.button === 1) e.preventDefault();
              }}
              onAuxClick={(e) => {
                if (e.button === 1) onClose(dir);
              }}
            >
              {/* folder / sub/dirs / file — the sub-folders give way first when space is tight */}
              <Folder className={cn('h-3.5 w-3.5 flex-shrink-0', isActive && 'text-yellow-500')} />
              <span className="min-w-[2.5rem] truncate">{name}</span>
              {hint && <span className="min-w-0 flex-shrink-[50] truncate text-muted-foreground">— {hint}</span>}
              {selectedFile && fileType && (
                <>
                  <span className="flex-shrink-0 text-muted-foreground">/</span>
                  {subDir && (
                    <>
                      <span className="min-w-0 flex-shrink-[100] truncate text-muted-foreground" dir="rtl">
                        {/* rtl keeps the deepest folder visible when truncated */}
                        <bdi>{subDir}</bdi>
                      </span>
                      <span className="flex-shrink-0 text-muted-foreground">/</span>
                    </>
                  )}
                  <FileIcon type={fileType} className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="min-w-[3rem] truncate">{baseName(selectedFile)}</span>
                </>
              )}
              <button
                type="button"
                aria-label={`Close ${name}`}
                title="Close (Ctrl+W)"
                className={cn(
                  'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm hover:bg-foreground/10',
                  isActive ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-70'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(dir);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-shrink-0"
        onClick={onOpen}
        title="Open Folder in New Tab (Ctrl+O)"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
