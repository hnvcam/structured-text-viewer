import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onToggleSidebar: () => void;
  onToggleToc: () => void;
  onBrowseDirectory: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function useKeyboardShortcuts({
  onToggleSidebar,
  onToggleToc,
  onBrowseDirectory,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { ctrlKey, shiftKey, key } = event;

      if (ctrlKey) {
        switch (key.toLowerCase()) {
          case 'b':
            event.preventDefault();
            // Ctrl+Shift+B toggles the table of contents; Ctrl+B the sidebar.
            if (shiftKey) onToggleToc();
            else onToggleSidebar();
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
  }, [onToggleSidebar, onToggleToc, onBrowseDirectory, onZoomIn, onZoomOut, onZoomReset]);
}
