import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  clearHighlights,
  findTextRanges,
  paintHighlights,
  scrollRangeIntoView,
} from '@/lib/textSearch';

// Fired on window by the Cmd+S / Ctrl+S / Cmd+F / Ctrl+F shortcut.
export const FOCUS_SEARCH_EVENT = 'focusSearch';

interface SearchBarProps {
  // Element whose text is searched.
  contentRef: RefObject<HTMLElement | null>;
  // Scrollable container the matches are scrolled within.
  scrollRef: RefObject<HTMLElement | null>;
  // Called whenever search moves the scroll position.
  onNavigate?: () => void;
  // Called with the (debounced) query right before the DOM is searched, so a
  // viewer can reveal hidden content (e.g. expand collapsed JSON nodes). Any
  // DOM updates must be flushed synchronously (flushSync) to be searched.
  onQueryChange?: (query: string) => void;
}

// Toolbar search field: highlights every match in the content and scrolls to
// the current one. Enter / Shift+Enter step through matches, Escape clears.
export function SearchBar({ contentRef, scrollRef, onNavigate, onQueryChange }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [ranges, setRanges] = useState<Range[]>([]);
  const [current, setCurrent] = useState(0);
  // Set when the current match should be scrolled into view after the next
  // paint (query change or explicit navigation, not DOM-mutation re-scans).
  const scrollPendingRef = useRef(false);

  const runSearch = useCallback(
    (q: string) => {
      const root = contentRef.current;
      setRanges(root && q ? findTextRanges(root, q) : []);
    },
    [contentRef]
  );

  // Re-search (debounced) when the query changes, and jump to the first match.
  useEffect(() => {
    const t = setTimeout(() => {
      scrollPendingRef.current = query !== '';
      setCurrent(0);
      onQueryChange?.(query);
      runSearch(query);
    }, 120);
    return () => clearTimeout(t);
  }, [query, runSearch, onQueryChange]);

  // The rendered document keeps changing after mount (images load, mermaid
  // diagrams render, file reloads), which invalidates existing ranges. Re-scan
  // on mutation while a query is active, keeping the current index.
  useEffect(() => {
    const root = contentRef.current;
    if (!root || !query) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => runSearch(query), 200);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [contentRef, query, runSearch]);

  // Paint highlights and, when requested, scroll to the current match.
  useEffect(() => {
    const idx = ranges.length ? Math.min(current, ranges.length - 1) : 0;
    paintHighlights(ranges, idx, contentRef.current);
    const range = ranges[idx];
    const container = scrollRef.current;
    if (scrollPendingRef.current && range && container) {
      scrollPendingRef.current = false;
      onNavigate?.();
      scrollRangeIntoView(range, container);
    }
  }, [ranges, current, contentRef, scrollRef, onNavigate]);

  useEffect(() => () => clearHighlights(), []);

  // Focus the field from the global shortcut, selecting any existing query.
  useEffect(() => {
    const focus = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener(FOCUS_SEARCH_EVENT, focus);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focus);
  }, []);

  const step = useCallback(
    (delta: number) => {
      if (!ranges.length) return;
      scrollPendingRef.current = true;
      setCurrent((c) => (Math.min(c, ranges.length - 1) + delta + ranges.length) % ranges.length);
    },
    [ranges.length]
  );

  const clear = () => {
    setQuery('');
    setRanges([]);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clear();
    }
  };

  const total = ranges.length;
  const shown = total ? Math.min(current, total - 1) + 1 : 0;
  const noMatch = query !== '' && total === 0;

  return (
    <div className="ml-auto flex items-center gap-1">
      <div
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-md border bg-background px-2',
          'focus-within:ring-1 focus-within:ring-ring',
          noMatch && 'border-destructive/60'
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search"
          spellCheck={false}
          className="w-40 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          title="Search (Cmd+S / Ctrl+S)"
        />
        {query && (
          <>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {shown}/{total}
            </span>
            <button
              type="button"
              onClick={clear}
              className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
              title="Clear (Esc)"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => step(-1)}
        disabled={!total}
        title="Previous Match (Shift+Enter)"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => step(1)}
        disabled={!total}
        title="Next Match (Enter)"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
