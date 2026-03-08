import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onToggleSidebar: () => void;
  onBrowseDirectory: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function useKeyboardShortcuts({
  onToggleSidebar,
  onBrowseDirectory,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { ctrlKey, key } = event;

      if (ctrlKey) {
        switch (key.toLowerCase()) {
          case 'b':
            event.preventDefault();
            onToggleSidebar();
            break;
          case 'o':
            event.preventDefault();
            onBrowseDirectory();
            break;
          case '=':
          case '+':
            event.preventDefault();
            onZoomIn();
            break;
          case '-':
            event.preventDefault();
            onZoomOut();
            break;
          case '0':
            event.preventDefault();
            onZoomReset();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleSidebar, onBrowseDirectory, onZoomIn, onZoomOut, onZoomReset]);
}
