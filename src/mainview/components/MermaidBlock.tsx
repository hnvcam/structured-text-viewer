import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { renderMermaid } from '@/lib/mermaid';
import { useIsDark } from '@/hooks/useIsDark';

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

interface DiagramSurfaceProps {
  svg: string;
  maximized: boolean;
  onToggleMaximize: () => void;
}

// One zoomable/pannable view of a rendered diagram. Inline and maximized views
// each get their own surface, so each keeps an independent zoom/pan state.
//  - drag: pan
//  - pinch or ⌘/Ctrl + scroll: zoom
//  - plain scroll: scrolls the page inline, pans when maximized
function DiagramSurface({ svg, maximized, onToggleMaximize }: DiagramSurfaceProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // Pan/zoom lives in a ref and is written straight to the DOM once per frame:
  // re-rendering React on every pointer/wheel event made large diagrams lag.
  const viewRef = useRef({ scale: 1, x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const idleRef = useRef<number | undefined>(undefined);

  const applyView = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const el = contentRef.current;
      if (!el) return;
      const { scale, x, y } = viewRef.current;
      // Promote to a GPU layer while interacting so moves don't repaint the
      // SVG; drop it once idle so the diagram re-rasterizes sharp at the new zoom.
      el.style.willChange = 'transform';
      el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      if (labelRef.current) labelRef.current.textContent = `${Math.round(scale * 100)}%`;
      window.clearTimeout(idleRef.current);
      idleRef.current = window.setTimeout(() => {
        if (contentRef.current) contentRef.current.style.willChange = 'auto';
      }, 200);
    });
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      window.clearTimeout(idleRef.current);
    },
    []
  );

  // Native, non-passive listener so we can preventDefault. stopPropagation keeps
  // the markdown viewer's own ⌘/Ctrl+wheel text zoom from also firing.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const view = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const delta = Math.max(-50, Math.min(50, e.deltaY));
        view.scale = clampScale(view.scale * Math.exp(-delta * 0.01));
        applyView();
      } else if (maximized) {
        e.preventDefault();
        e.stopPropagation();
        view.x -= e.deltaX;
        view.y -= e.deltaY;
        applyView();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [maximized, applyView]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = viewRef.current;
    dragRef.current = { x: e.clientX, y: e.clientY, px: x, py: y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    viewRef.current.x = d.px + e.clientX - d.x;
    viewRef.current.y = d.py + e.clientY - d.y;
    applyView();
  };
  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const zoomBy = (factor: number) => {
    viewRef.current.scale = clampScale(viewRef.current.scale * factor);
    applyView();
  };
  const reset = () => {
    viewRef.current = { scale: 1, x: 0, y: 0 };
    applyView();
  };

  // Stable object so re-renders (e.g. cursor change on drag) never touch the SVG.
  const svgHtml = useMemo(() => ({ __html: svg }), [svg]);

  return (
    <div className={cn('group relative', maximized && 'min-h-0 flex-1')}>
      <div
        className={cn(
          'absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border bg-background/90 p-0.5 shadow-sm transition-opacity',
          maximized ? 'opacity-100' : 'opacity-60 group-hover:opacity-100 focus-within:opacity-100'
        )}
      >
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoomBy(1 / 1.25)} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span ref={labelRef} className="w-11 text-center text-xs tabular-nums">
          100%
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoomBy(1.25)} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset} title="Reset view">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleMaximize}
          title={maximized ? 'Exit full window (Esc)' : 'Maximize'}
        >
          {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      <div
        ref={viewportRef}
        className={cn(
          'touch-none select-none overflow-hidden',
          maximized && 'h-full w-full',
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          ref={contentRef}
          className={cn('mermaid-svg', maximized && 'mermaid-svg-fit h-full w-full')}
          style={{ transformOrigin: 'center center' }}
          dangerouslySetInnerHTML={svgHtml}
        />
      </div>
    </div>
  );
}

// A mermaid diagram embedded in markdown: renders with the current app theme,
// re-renders on theme toggle, and offers zoom/pan plus a full-window view.
export function MermaidBlock({ source }: { source: string }) {
  const dark = useIsDark();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    renderMermaid(source, dark).then(
      (result) => {
        if (cancelled) return;
        setSvg(result);
        setError(null);
      },
      (err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setSvg(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [source, dark]);

  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMaximized(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [maximized]);

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-destructive/40 bg-card p-4 text-sm text-destructive">
        Failed to render diagram: {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div className="my-4 rounded-lg border bg-card p-4">
      <DiagramSurface svg={svg} maximized={false} onToggleMaximize={() => setMaximized(true)} />
      {maximized &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-background p-4">
            <DiagramSurface svg={svg} maximized onToggleMaximize={() => setMaximized(false)} />
          </div>,
          document.body
        )}
    </div>
  );
}
