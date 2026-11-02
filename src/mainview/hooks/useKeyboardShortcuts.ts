import { useEffect } from 'react';
import { copyText } from '@/lib/clipboard';

interface KeyboardShortcutsOptions {
  onToggleSidebar: () => void;
  onToggleToc: () => void;
  onBrowseDirectory: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onRefresh: () => void;
}

// Text fields handle their own copy natively.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function useKeyboardShortcuts({
  onToggleSidebar,
  onToggleToc,
  onBrowseDirectory,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onRefresh,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { ctrlKey, metaKey, shiftKey, key } = event;
      const lowerKey = key.toLowerCase();

      // Copy selected text: Cmd+C (macOS), Ctrl+C, Ctrl+Shift+C.
      if ((ctrlKey || metaKey) && lowerKey === 'c' && !isEditableTarget(event.target)) {
        const text = window.getSelection()?.toString() ?? '';
        if (text) {
          event.preventDefault();
          void copyText(text);
        }
        return;
      }

      // Reload the open file: F5, Ctrl+R, Cmd+R.
      if (key === 'F5' || ((ctrlKey || metaKey) && !shiftKey && lowerKey === 'r')) {
        event.preventDefault();
        onRefresh();
        return;
      }

      if (ctrlKey) {
        switch (lowerKey) {
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
  }, [onToggleSidebar, onToggleToc, onBrowseDirectory, onZoomIn, onZoomOut, onZoomReset, onRefresh]);
}
