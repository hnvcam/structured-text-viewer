import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Hand, MousePointer } from 'lucide-react';

interface HtmlViewerProps {
  content: string;
}

export function HtmlViewer({ content }: HtmlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [interactMode, setInteractMode] = useState(false);

  // Non-passive wheel listener on the overlay container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (interactMode) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((prev) => Math.max(0.1, Math.min(10, prev + delta)));
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [interactMode]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (interactMode || e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [interactMode, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

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
        <div className="ml-2 h-4 w-px bg-border" />
        <Button
          variant={interactMode ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={() => setInteractMode((prev) => !prev)}
          title={interactMode ? 'Switch to Pan mode' : 'Switch to Interact mode (click links, scroll page)'}
        >
          {interactMode ? <MousePointer className="h-3.5 w-3.5" /> : <Hand className="h-3.5 w-3.5" />}
          {interactMode ? 'Interact' : 'Pan'}
        </Button>
        {!interactMode && (
          <span className="ml-auto text-xs text-muted-foreground">Drag to pan · Scroll to zoom</span>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-card"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: interactMode ? 'default' : isDragging ? 'grabbing' : 'grab' }}
      >
        <iframe
          srcDoc={content}
          sandbox="allow-same-origin allow-scripts"
          className="absolute border-0 bg-white"
          title="HTML Preview"
          style={{
            width: '100%',
            height: '100%',
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'top left',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            pointerEvents: interactMode ? 'auto' : 'none',
          }}
        />
        {/* Transparent overlay to capture mouse/wheel events in pan mode */}
        {!interactMode && (
          <div className="absolute inset-0" style={{ cursor: isDragging ? 'grabbing' : 'grab' }} />
        )}
      </div>
    </div>
  );
}
