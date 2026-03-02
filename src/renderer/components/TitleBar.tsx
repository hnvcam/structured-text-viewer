import { Button } from '@/components/ui/button';
import { Menu, Sun, Moon, FolderOpen } from 'lucide-react';

interface TitleBarProps {
  onToggleSidebar: () => void;
  onBrowseDirectory: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function TitleBar({
  onToggleSidebar,
  onBrowseDirectory,
  theme,
  onToggleTheme,
}: TitleBarProps) {
  return (
    <div
      className="titlebar flex h-8 items-center justify-between border-b bg-background px-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleSidebar}
          title="Toggle Sidebar (Ctrl+B)"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onBrowseDirectory}
          title="Browse Directory (Ctrl+O)"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>

      <div className="titlebar-drag-region flex-1 text-center text-xs text-muted-foreground">
        Structured Text Viewer
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-l-none"
            onClick={() => window.close()}
            title="Close"
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12">
              <path
                d="M10.107 1.893a1 1 0 0 0-1.414 0L6 4.586 3.307 1.893a1 1 0 0 0-1.414 1.414L4.586 6l-2.693 2.693a1 1 0 1 0 1.414 1.414L6 7.414l2.693 2.693a1 1 0 0 0 1.414-1.414L7.414 6l2.693-2.693a1 1 0 0 0 0-1.414z"
                fill="currentColor"
              />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
