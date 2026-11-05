import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { distributeWidths } from '@/lib/tableLayout';

// All sizes in em of the table's font, so widths scale with the zoom level.
const MIN_COL_EM = 4; // auto-fit never makes a column narrower than this (unless its content is)
const MAX_FLOOR_EM = 16; // one long word (URL, identifier) can't force a column wider than this
const SHORT_COL_EM = 15; // columns up to this wide on one line are kept unwrapped when possible
const LONG_MIN_EM = 12; // long-text columns are raised to this once short ones are unwrapped
const MIN_RESIZE_EM = 2.5; // narrowest a column can be dragged to

interface HandleLayout {
  lefts: number[];
  top: number;
  height: number;
}

interface MarkdownTableProps {
  children?: ReactNode;
  [key: string]: unknown;
}

/**
 * A markdown table with content-aware column widths (see distributeWidths) and
 * drag-to-resize column borders in the header row. Double-click a border to go
 * back to auto-fit.
 *
 * Widths are applied to the DOM directly (not through React state) because
 * measuring needs to clear them temporarily, and dragging updates them on
 * every pointer move.
 */
export function MarkdownTable({ children, node, ...rest }: MarkdownTableProps) {
  void node;
  const wrapRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const emRef = useRef<HTMLSpanElement>(null);
  // Set once the user drags a border: from then on these widths (em) win over auto-fit.
  const userWidthsRef = useRef<number[] | null>(null);
  const lastSizeRef = useRef({ width: -1, fontSize: -1 });
  const [handles, setHandles] = useState<HandleLayout | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const headerCells = (): HTMLTableCellElement[] => {
    const row = tableRef.current?.rows[0];
    return row ? Array.from(row.cells) : [];
  };

  const fontSizeOf = (el: Element) => parseFloat(getComputedStyle(el).fontSize) || 16;

  const applyWidths = (widthsEm: number[]) => {
    const table = tableRef.current;
    if (!table) return;
    headerCells().forEach((cell, i) => {
      cell.style.width = `${widthsEm[i]}em`;
    });
    table.style.tableLayout = 'fixed';
    table.style.width = `${widthsEm.reduce((a, b) => a + b, 0)}em`;
  };

  const updateHandles = useCallback(() => {
    const wrap = wrapRef.current;
    const cells = headerCells();
    if (!wrap || cells.length === 0) return;
    const wrapRect = wrap.getBoundingClientRect();
    const rowRect = cells[0].parentElement!.getBoundingClientRect();
    setHandles({
      lefts: cells.map((c) => c.getBoundingClientRect().right - wrapRect.left + wrap.scrollLeft),
      top: rowRect.top - wrapRect.top + wrap.scrollTop,
      height: rowRect.height,
    });
  }, []);

  const layout = useCallback(() => {
    const table = tableRef.current;
    const wrap = wrapRef.current;
    if (!table || !wrap || wrap.clientWidth === 0) return;
    const cells = headerCells();
    // Raw-HTML tables with merged cells: leave them to the browser.
    const hasSpans = Array.from(table.rows).some((r) =>
      Array.from(r.cells).some((c) => c.colSpan > 1),
    );
    if (cells.length === 0 || hasSpans) {
      setHandles(null);
      return;
    }

    const fs = fontSizeOf(table);
    lastSizeRef.current = { width: wrap.clientWidth, fontSize: fs };

    const user = userWidthsRef.current;
    if (user && user.length === cells.length) {
      applyWidths(user);
      updateHandles();
      return;
    }
    userWidthsRef.current = null;

    // Measure with the browser's own layout: once with no wrapping (max-content),
    // once squeezed to the longest words (min-content).
    table.style.width = '';
    table.style.tableLayout = '';
    cells.forEach((c) => (c.style.width = ''));
    table.dataset.measure = 'max';
    const maxW = cells.map((c) => c.getBoundingClientRect().width);
    table.dataset.measure = 'min';
    const minW = cells.map((c) => c.getBoundingClientRect().width);
    delete table.dataset.measure;

    const fit = (avail: number): boolean => {
      const widths = distributeWidths(maxW, minW, avail, {
        minCol: MIN_COL_EM * fs,
        maxFloor: MAX_FLOOR_EM * fs,
        shortCol: SHORT_COL_EM * fs,
        longMin: LONG_MIN_EM * fs,
      });
      applyWidths(widths.map((px) => px / fs));
      return widths.reduce((a, b) => a + b, 0) <= avail + 0.5;
    };
    const avail = Math.max(0, wrap.clientWidth - 1);
    // Cell borders can push a table that should just fit a few px over the
    // edge; take that off and fit again rather than show a needless scrollbar.
    if (fit(avail)) {
      // Measure the table, not wrap.scrollWidth: stale resize handles count there.
      const overflow = Math.ceil(table.getBoundingClientRect().width - wrap.clientWidth);
      if (overflow > 0) fit(avail - overflow);
    }
    updateHandles();
  }, [updateHandles]);

  // Re-fit whenever the table content changes.
  useLayoutEffect(() => {
    layout();
  }, [children, layout]);

  // Re-fit when the available width changes (window, sidebar, outline panel) or
  // the zoom level changes (the 1em sentinel resizes).
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const em = emRef.current;
    const table = tableRef.current;
    if (!wrap || !em || !table) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const last = lastSizeRef.current;
        if (wrap.clientWidth === last.width && fontSizeOf(table) === last.fontSize) return;
        layout();
      });
    });
    observer.observe(wrap);
    observer.observe(em);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [layout]);

  const startDrag = (index: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const table = tableRef.current;
    if (!table) return;
    e.preventDefault();
    e.stopPropagation();

    // Freeze every column at its current width so only the dragged one moves.
    const fs = fontSizeOf(table);
    const widths = headerCells().map((c) => c.getBoundingClientRect().width / fs);
    userWidthsRef.current = widths;
    applyWidths(widths);

    const startX = e.clientX;
    const startW = widths[index];
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // not a live pointer (synthetic event): moves still reach the handle
    }
    setDragging(index);
    document.body.classList.add('col-resizing');

    const onMove = (ev: PointerEvent) => {
      widths[index] = Math.max(MIN_RESIZE_EM, startW + (ev.clientX - startX) / fs);
      applyWidths(widths);
      updateHandles();
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      document.body.classList.remove('col-resizing');
      setDragging(null);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  const resetWidths = () => {
    userWidthsRef.current = null;
    layout();
  };

  return (
    <div ref={wrapRef} className="md-table-wrap">
      <span ref={emRef} className="md-table-em" aria-hidden />
      <table ref={tableRef} {...rest}>
        {children}
      </table>
      {handles?.lefts.map((left, i) => (
        <div
          key={i}
          className={cn('md-col-resizer', dragging === i && 'active')}
          // Centred on the border, except the last one, which stays inside the
          // table so it doesn't make the wrapper scroll sideways.
          style={{
            left: i === handles.lefts.length - 1 ? left - 8 : left - 4,
            top: handles.top,
            height: handles.height,
          }}
          onPointerDown={(e) => startDrag(i, e)}
          onDoubleClick={resetWidths}
          title="Drag to resize · double-click to auto-fit"
        />
      ))}
    </div>
  );
}
