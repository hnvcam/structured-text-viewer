import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Minimize, Hand } from 'lucide-react';

interface SvgViewerProps {
  content: string;
}

export function SvgViewer({ content }: SvgViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
  const contentRef = useRef<HTMLDivElement>(null);

  // Render SVG inline and capture its dimensions
  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.innerHTML = content;
    const svgEl = contentRef.current.querySelector('svg');
    if (svgEl) {
      // Ensure SVG fills the container properly
      svgEl.style.maxWidth = '100%';
      svgEl.style.height = 'auto';
      const w = svgEl.viewBox.baseVal.width || svgEl.getBoundingClientRect().width;
      const h = svgEl.viewBox.baseVal.height || svgEl.getBoundingClientRect().height;
      setSvgSize({ width: w, height: h });
    }
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [content]);

  // Non-passive wheel listener for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((prev) => Math.max(0.1, Math.min(10, prev + delta)));
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const fitToScreen = useCallback(() => {
    if (!containerRef.current || svgSize.width === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = (rect.width - 40) / svgSize.width;
    const scaleY = (rect.height - 40) / svgSize.height;
    setScale(Math.min(scaleX, scaleY, 1));
    setPosition({ x: 0, y: 0 });
  }, [svgSize]);

  const handleZoomIn = () => setScale((prev) => Math.min(10, prev + 0.2));
  const handleZoomOut = () => setScale((prev) => Math.max(0.1, prev - 0.2));
  const handleReset = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-sm">{Math.round(scale * 100)}%</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn} title="Zoom In">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleReset} title="Reset View">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={fitToScreen} title="Fit to Screen">
          <Minimize className="h-4 w-4" />
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Hand className="h-4 w-4" />
          <span>Drag to pan</span>
        </div>
      </div>

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
          className="flex h-full w-full items-center justify-center"
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
