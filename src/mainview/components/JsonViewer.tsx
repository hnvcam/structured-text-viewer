import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  AlertCircle,
  Check,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Route,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { copyText } from '@/lib/clipboard';
import { RefreshFileButton } from './RefreshFileButton';
import { SearchBar } from './SearchBar';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonContainer = JsonValue[] | { [key: string]: JsonValue };
type Key = string | number;

interface JsonViewerProps {
  content: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

const ROOT_PATH = '$';
// Indentation per nesting level, in em (scales with the font size).
const INDENT = 1.25;
// Width of the expand/collapse gutter in front of every row, in em.
const GUTTER = 1.25;
// Initial expansion opens levels until roughly this many rows are visible.
const INITIAL_ROW_BUDGET = 1500;
const MAX_INITIAL_DEPTH = 3;

function isContainer(v: JsonValue): v is JsonContainer {
  return v !== null && typeof v === 'object';
}

function entries(v: JsonContainer): [Key, JsonValue][] {
  return Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v);
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

// JSONPath-style path of a child: $.a.b[0]["key with spaces"]. Also used as
// the node's identity in the expansion state (it is unambiguous).
function childPath(parent: string, key: Key): string {
  if (typeof key === 'number') return `${parent}[${key}]`;
  return IDENTIFIER.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

// Text a primitive is displayed as (strings keep their quotes and escapes).
function primitiveText(v: Exclude<JsonValue, JsonContainer>): string {
  return typeof v === 'string' ? JSON.stringify(v) : String(v);
}

// Call `fn` for `value` (if a container) and every container nested in it.
function walkContainers(value: JsonValue, path: string, fn: (path: string) => void): void {
  if (!isContainer(value)) return;
  fn(path);
  for (const [k, v] of entries(value)) walkContainers(v, childPath(path, k), fn);
}

// Number of levels to open initially: as many as fit in the row budget, so
// small files open fully while huge ones stay responsive. The root is always open.
function initialDepth(root: JsonValue): number {
  if (!isContainer(root)) return 1;
  let level: JsonContainer[] = [root];
  let shown = 0;
  let depth = 0;
  while (depth < MAX_INITIAL_DEPTH && level.length) {
    const next: JsonContainer[] = [];
    let count = 0;
    for (const c of level) {
      for (const [, v] of entries(c)) {
        count++;
        if (isContainer(v)) next.push(v);
      }
    }
    if (depth > 0 && shown + count > INITIAL_ROW_BUDGET) break;
    shown += count;
    depth++;
    level = next;
  }
  return Math.max(1, depth);
}

// Every container that must be open for all rows matching `query`
// (case-insensitive, against the row text as displayed) to be visible.
function pathsToReveal(root: JsonValue, query: string): { path: string; depth: number }[] {
  const needle = query.toLowerCase();
  const out: { path: string; depth: number }[] = [];
  const visit = (value: JsonContainer, path: string, depth: number): boolean => {
    let hit = false;
    const isArray = Array.isArray(value);
    for (const [k, child] of entries(value)) {
      const keyText = isArray ? '' : `${JSON.stringify(k)}: `;
      if (isContainer(child)) {
        if ((keyText + (Array.isArray(child) ? '[' : '{')).toLowerCase().includes(needle)) hit = true;
        const cp = childPath(path, k);
        if (visit(child, cp, depth + 1)) {
          out.push({ path: cp, depth: depth + 1 });
          hit = true;
        }
      } else if ((keyText + primitiveText(child)).toLowerCase().includes(needle)) {
        hit = true;
      }
    }
    return hit;
  };
  if (isContainer(root) && visit(root, ROOT_PATH, 0)) out.push({ path: ROOT_PATH, depth: 0 });
  return out;
}

// Containers at depth < defaultDepth are open unless explicitly overridden.
interface Expansion {
  defaultDepth: number;
  overrides: Map<string, boolean>;
}

function isOpenIn(exp: Expansion, path: string, depth: number): boolean {
  return exp.overrides.get(path) ?? depth < exp.defaultDepth;
}

interface TreeContextValue {
  expansion: Expansion;
  toggle: (path: string, depth: number, value: JsonValue, recursive: boolean) => void;
}

const TreeContext = createContext<TreeContextValue | null>(null);

function CopyButton({ getText, title, icon: Icon }: { getText: () => string; title: string; icon: typeof Copy }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={async (e) => {
        e.stopPropagation();
        if (await copyText(getText())) setCopied(true);
      }}
      className="flex h-[1.5em] w-[1.5em] items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {copied ? <Check className="h-[0.85em] w-[0.85em]" /> : <Icon className="h-[0.85em] w-[0.85em]" />}
    </button>
  );
}

interface RowProps {
  depth: number;
  children: React.ReactNode;
  // Expand/collapse chevron state; omitted for rows that can't be toggled.
  open?: boolean;
  onToggle?: (recursive: boolean) => void;
  // Value/path copied by the hover actions; omitted for closing-bracket rows.
  value?: JsonValue;
  path?: string;
}

function Row({ depth, children, open, onToggle, value, path }: RowProps) {
  return (
    <div
      className="group relative rounded-sm pr-14 hover:bg-accent/40"
      style={{ paddingLeft: `${depth * INDENT + GUTTER}em` }}
    >
      {onToggle && (
        <button
          type="button"
          data-search-skip
          onClick={(e) => onToggle(e.altKey || e.shiftKey)}
          title={`${open ? 'Collapse' : 'Expand'} (Alt+click: ${open ? 'collapse' : 'expand'} all nested)`}
          className="absolute top-0 flex h-[1.5em] items-center justify-center text-muted-foreground hover:text-foreground"
          style={{ left: `${depth * INDENT}em`, width: `${GUTTER}em` }}
        >
          <ChevronRight className={cn('h-[0.9em] w-[0.9em] transition-transform', open && 'rotate-90')} />
        </button>
      )}
      {children}
      {path !== undefined && value !== undefined && (
        <span data-search-skip className="absolute right-1 top-0 hidden gap-0.5 group-hover:flex">
          <CopyButton
            title="Copy path"
            icon={Route}
            getText={() => path}
          />
          <CopyButton
            title="Copy value"
            icon={Copy}
            getText={() => (typeof value === 'string' ? value : JSON.stringify(value, null, 2))}
          />
        </span>
      )}
    </div>
  );
}

const punct = 'text-muted-foreground';

function primitiveClass(v: Exclude<JsonValue, JsonContainer>): string {
  if (typeof v === 'string') return 'text-emerald-700 dark:text-emerald-400';
  if (typeof v === 'number') return 'text-amber-700 dark:text-amber-400';
  return 'text-purple-600 dark:text-purple-400'; // true / false / null
}

function KeyLabel({ label }: { label: Key | null }) {
  if (label === null) return null;
  if (typeof label === 'number') {
    // Array indices are a visual aid: not searched, not copied with a selection.
    return (
      <span data-search-skip className="select-none text-muted-foreground/60">
        {label}:{' '}
      </span>
    );
  }
  return (
    <>
      <span className="text-sky-700 dark:text-sky-300">{JSON.stringify(label)}</span>
      <span className={punct}>: </span>
    </>
  );
}

interface JsonNodeProps {
  label: Key | null;
  value: JsonValue;
  path: string;
  depth: number;
  isLast: boolean;
}

function JsonNode({ label, value, path, depth, isLast }: JsonNodeProps) {
  const ctx = useContext(TreeContext)!;
  const comma = isLast ? null : <span className={punct}>,</span>;

  if (!isContainer(value)) {
    return (
      <Row depth={depth} value={value} path={path}>
        <KeyLabel label={label} />
        <span className={cn('whitespace-pre-wrap break-all', primitiveClass(value))}>{primitiveText(value)}</span>
        {comma}
      </Row>
    );
  }

  const isArray = Array.isArray(value);
  const [openBr, closeBr] = isArray ? ['[', ']'] : ['{', '}'];
  const items = entries(value);

  if (items.length === 0) {
    return (
      <Row depth={depth} value={value} path={path}>
        <KeyLabel label={label} />
        <span className={punct}>
          {openBr}
          {closeBr}
        </span>
        {comma}
      </Row>
    );
  }

  const open = isOpenIn(ctx.expansion, path, depth);
  const onToggle = (recursive: boolean) => ctx.toggle(path, depth, value, recursive);
  const summary = `${items.length} ${isArray ? (items.length === 1 ? 'item' : 'items') : items.length === 1 ? 'key' : 'keys'}`;

  if (!open) {
    return (
      <Row depth={depth} open={false} onToggle={onToggle} value={value} path={path}>
        <KeyLabel label={label} />
        <span className={punct}>{openBr}</span>
        <button
          type="button"
          data-search-skip
          onClick={(e) => onToggle(e.altKey || e.shiftKey)}
          className="mx-0.5 rounded bg-muted px-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Expand"
        >
          …
        </button>
        <span className={punct}>{closeBr}</span>
        {comma}
        <span data-search-skip className="ml-2 select-none text-[0.8em] text-muted-foreground/70">
          {summary}
        </span>
      </Row>
    );
  }

  return (
    <>
      <Row depth={depth} open onToggle={onToggle} value={value} path={path}>
        <KeyLabel label={label} />
        <span className={punct}>{openBr}</span>
      </Row>
      {items.map(([k, v], i) => (
        <JsonNode
          key={k}
          label={isArray ? k : String(k)}
          value={v}
          path={childPath(path, k)}
          depth={depth + 1}
          isLast={i === items.length - 1}
        />
      ))}
      <Row depth={depth}>
        <span className={punct}>{closeBr}</span>
        {comma}
      </Row>
    </>
  );
}

type ParseResult =
  | { value: JsonValue; callback: string | null; error: null }
  | { value: null; callback: null; error: string };

// JSONP: `callback(<json>);`, optionally preceded by the `/**/` comment and/or
// the `typeof callback === 'function' &&` guard that many servers emit.
const JSONP =
  /^\s*(?:\/\*[\s\S]*?\*\/\s*)?(?:typeof\s+[\w$.]+\s*={2,3}\s*(['"])function\1\s*&&\s*)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[(?:\d+|'[^']*'|"[^"]*")\])*)\s*\(([\s\S]*)\)\s*;?\s*$/;

function parseJson(content: string): ParseResult {
  // Strip a UTF-8 byte order mark, which JSON.parse rejects.
  const text = content.replace(/^﻿/, '');
  try {
    return { value: JSON.parse(text) as JsonValue, callback: null, error: null };
  } catch (e) {
    const m = JSONP.exec(text);
    if (m) {
      try {
        return { value: JSON.parse(m[3]) as JsonValue, callback: m[2], error: null };
      } catch (inner) {
        return { value: null, callback: null, error: `JSONP payload of ${m[2]}(…): ${errorMessage(inner)}` };
      }
    }
    return { value: null, callback: null, error: errorMessage(e) };
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function JsonViewer({ content, zoom, onZoomChange, onRefresh, refreshing }: JsonViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseJson(content), [content]);
  const root = parsed.value;

  const [expansion, setExpansion] = useState<Expansion>(() => ({
    defaultDepth: initialDepth(root),
    overrides: new Map(),
  }));

  const toggle = useCallback((path: string, depth: number, value: JsonValue, recursive: boolean) => {
    setExpansion((prev) => {
      const open = !isOpenIn(prev, path, depth);
      const overrides = new Map(prev.overrides);
      if (recursive) walkContainers(value, path, (p) => overrides.set(p, open));
      else overrides.set(path, open);
      return { ...prev, overrides };
    });
  }, []);

  const expandAll = () => setExpansion({ defaultDepth: Infinity, overrides: new Map() });
  const collapseAll = () => setExpansion({ defaultDepth: 1, overrides: new Map() });

  // Before the search bar scans the DOM, open every collapsed node that holds a
  // match. flushSync commits the expansion so the scan sees the new rows.
  const revealMatches = useCallback(
    (query: string) => {
      if (!query || parsed.error) return;
      const nodes = pathsToReveal(root, query);
      if (!nodes.length) return;
      flushSync(() =>
        setExpansion((prev) => {
          const closed = nodes.filter((n) => !isOpenIn(prev, n.path, n.depth));
          if (!closed.length) return prev; // no re-render when all are visible
          const overrides = new Map(prev.overrides);
          for (const n of closed) overrides.set(n.path, true);
          return { ...prev, overrides };
        })
      );
    },
    [root, parsed.error]
  );

  const treeContext = useMemo(() => ({ expansion, toggle }), [expansion, toggle]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      onZoomChange(Math.max(10, Math.min(32, zoom + (e.deltaY > 0 ? -1 : 1))));
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onZoomChange(Math.max(10, zoom - 1))}
          title="Zoom Out (Ctrl+-)"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-sm">{zoom}px</span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onZoomChange(Math.min(32, zoom + 1))}
          title="Zoom In (Ctrl++)"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onZoomChange(16)} title="Reset Zoom (Ctrl+0)">
          <RotateCcw className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-4 w-px bg-border" />

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={expandAll}
          disabled={!!parsed.error}
          title="Expand All"
        >
          <ChevronsUpDown className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={collapseAll}
          disabled={!!parsed.error}
          title="Collapse All"
        >
          <ChevronsDownUp className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-4 w-px bg-border" />

        <RefreshFileButton onRefresh={onRefresh} refreshing={refreshing} />

        <SearchBar contentRef={contentRef} scrollRef={containerRef} onQueryChange={revealMatches} />
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto p-4" onWheel={handleWheel} style={{ fontSize: `${zoom}px` }}>
        {parsed.error !== null ? (
          <>
            <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">Invalid JSON:</span> {parsed.error}
              </span>
            </div>
            <div ref={contentRef}>
              <pre className="whitespace-pre-wrap break-all font-mono text-[0.875em]">{content}</pre>
            </div>
          </>
        ) : (
          <div ref={contentRef} className="font-mono" style={{ lineHeight: 1.5 }}>
            {parsed.callback !== null && (
              <div style={{ paddingLeft: `${GUTTER}em` }}>
                <span className="text-sky-700 dark:text-sky-300">{parsed.callback}</span>
                <span className={punct}>(</span>
              </div>
            )}
            {/* A JSONP payload is indented one level inside its callback call. */}
            <div style={{ paddingLeft: parsed.callback !== null ? `${INDENT}em` : undefined }}>
              <TreeContext.Provider value={treeContext}>
                <JsonNode label={null} value={root} path={ROOT_PATH} depth={0} isLast />
              </TreeContext.Provider>
            </div>
            {parsed.callback !== null && (
              <div className={punct} style={{ paddingLeft: `${GUTTER}em` }}>
                );
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
