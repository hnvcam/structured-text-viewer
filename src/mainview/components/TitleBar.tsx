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
    <div className="flex h-8 items-center justify-between border-b bg-background px-2">
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

      <div className="flex-1 text-center text-xs text-muted-foreground select-none">
        Structured Text Viewer
      </div>

      <div className="flex items-center gap-1">
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
      </div>
    </div>
  );
}
