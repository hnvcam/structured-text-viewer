import { useEffect } from 'react';
import { copyText } from '@/lib/clipboard';
import { FOCUS_SEARCH_EVENT } from '@/components/SearchBar';

interface KeyboardShortcutsOptions {
  onToggleSidebar: () => void;
  onToggleToc: () => void;
  onBrowseDirectory: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onRefresh: () => void;
  onCloseTab: () => void;
  onCycleTab: (delta: 1 | -1) => void;
  // Index into the open tabs; -1 means the last tab.
  onSelectTab: (index: number) => void;
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
  onCloseTab,
  onCycleTab,
  onSelectTab,
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

      // Find in the open file: Cmd+S / Ctrl+S (and the conventional Cmd+F / Ctrl+F).
      if ((ctrlKey || metaKey) && !shiftKey && (lowerKey === 's' || lowerKey === 'f')) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
        return;
      }

      // Reload the open file: F5, Ctrl+R, Cmd+R.
      if (key === 'F5' || ((ctrlKey || metaKey) && !shiftKey && lowerKey === 'r')) {
        event.preventDefault();
        onRefresh();
        return;
      }

      // Folder tabs: Ctrl+Tab / Ctrl+Shift+Tab cycle, Ctrl/Cmd+1..8 jump,
      // Ctrl/Cmd+9 goes to the last tab, Ctrl+W closes (Cmd+W closes the window).
      if (ctrlKey && key === 'Tab') {
        event.preventDefault();
        onCycleTab(shiftKey ? -1 : 1);
        return;
      }
      if ((ctrlKey || metaKey) && !shiftKey && /^[1-9]$/.test(key)) {
        event.preventDefault();
        onSelectTab(key === '9' ? -1 : Number(key) - 1);
        return;
      }
      if (ctrlKey && !metaKey && !shiftKey && lowerKey === 'w') {
        event.preventDefault();
        onCloseTab();
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
  }, [
    onToggleSidebar,
    onToggleToc,
    onBrowseDirectory,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onRefresh,
    onCloseTab,
    onCycleTab,
    onSelectTab,
  ]);
}
