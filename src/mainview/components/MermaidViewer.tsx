import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Minimize, Hand } from 'lucide-react';

interface MermaidViewerProps {
  content: string;
}

export function MermaidViewer({ content }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize mermaid and setup cleanup
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    });

    isMountedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (contentRef.current) {
        contentRef.current.innerHTML = '';
      }
    };
  }, [content]);

  const renderDiagram = useCallback(async () => {
    const abortController = abortControllerRef.current;
    if (!isMountedRef.current || !abortController || !contentRef.current) return;

    // Clear previous content
    contentRef.current.innerHTML = '';

    // Small delay to allow DOM to clear
    await new Promise(resolve => setTimeout(resolve, 10));

    if (!isMountedRef.current || abortController.signal.aborted) return;

    try {
      const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const { svg } = await mermaid.render(uniqueId, content);

      if (!isMountedRef.current || abortController.signal.aborted) return;

      contentRef.current.innerHTML = svg;
      const svgElement = contentRef.current.querySelector('svg');
      if (svgElement) {
        svgRef.current = svgElement as SVGSVGElement;
        const bbox = svgElement.getBoundingClientRect();
        setSvgSize({ width: bbox.width, height: bbox.height });
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    } catch (error) {
      if (!isMountedRef.current || abortController.signal.aborted) return;
      console.error('Mermaid render error:', error);
      if (contentRef.current) {
        contentRef.current.innerHTML = `
          <div class="flex h-full items-center justify-center text-destructive">
            <div class="text-center">
              <p class="font-semibold">Failed to render diagram</p>
              <p class="text-sm text-muted-foreground mt-2">${(error as Error).message}</p>
            </div>
          </div>
        `;
      }
    }
  }, [content]);

  useEffect(() => {
    const timer = setTimeout(renderDiagram, 50);
    return () => clearTimeout(timer);
  }, [renderDiagram]);

  // Setup non-passive wheel listener for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((prev) => Math.max(0.1, Math.min(5, prev + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [position]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const fitToScreen = useCallback(() => {
    if (!containerRef.current || svgSize.width === 0) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const scaleX = (containerRect.width - 40) / svgSize.width;
    const scaleY = (containerRect.height - 40) / svgSize.height;
    const newScale = Math.min(scaleX, scaleY, 1);

    setScale(newScale);
    setPosition({ x: 0, y: 0 });
  }, [svgSize]);

  const handleZoomIn = () => setScale((prev) => Math.min(5, prev + 0.2));
  const handleZoomOut = () => setScale((prev) => Math.max(0.1, prev - 0.2));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Controls */}
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-sm">{Math.round(scale * 100)}%</span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleReset}
          title="Reset View"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={fitToScreen}
          title="Fit to Screen"
        >
          <Minimize className="h-4 w-4" />
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Hand className="h-4 w-4" />
          <span>Drag to pan</span>
        </div>
      </div>

      {/* Diagram container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-card"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          ref={contentRef}
          className="mermaid-container h-full w-full"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        />
      </div>
    </div>
  );
}
