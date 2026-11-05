import { Button } from '@/components/ui/button';
import { Menu, Sun, Moon, RefreshCw, PanelRight } from 'lucide-react';
import { WorkspaceTabs, WorkspaceTab } from './WorkspaceTabs';

interface TitleBarProps {
  onToggleSidebar: () => void;
  onToggleToc: () => void;
  tocOpen: boolean;
  onBrowseDirectory: () => void;
  onRefreshDirectory: () => void;
  tabs: WorkspaceTab[];
  activeDir: string | null;
  onSelectWorkspace: (dirPath: string) => void;
  onCloseWorkspace: (dirPath: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function TitleBar({
  onToggleSidebar,
  onToggleToc,
  tocOpen,
  onBrowseDirectory,
  onRefreshDirectory,
  tabs,
  activeDir,
  onSelectWorkspace,
  onCloseWorkspace,
  theme,
  onToggleTheme,
}: TitleBarProps) {
  return (
    <div className="flex h-8 items-center justify-between gap-1 border-b bg-background px-2">
      <div className="flex flex-shrink-0 items-center gap-1">
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
          onClick={onRefreshDirectory}
          title="Refresh Directory"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <WorkspaceTabs
        tabs={tabs}
        activeDir={activeDir}
        onSelect={onSelectWorkspace}
        onClose={onCloseWorkspace}
        onOpen={onBrowseDirectory}
      />

      <div className="flex flex-shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${tocOpen ? 'text-foreground' : 'text-muted-foreground'}`}
          onClick={onToggleToc}
          title="Toggle Table of Contents (Ctrl+Shift+B)"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
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
