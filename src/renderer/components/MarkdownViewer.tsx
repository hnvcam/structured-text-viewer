import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function MarkdownViewer({ content, zoom, onZoomChange }: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mermaidId, setMermaidId] = useState(0);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    });
  }, []);

  // Reset mount state and abort pending renders on content change
  useEffect(() => {
    isMountedRef.current = true;
    
    // Abort any pending renders
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Clear all mermaid elements on unmount
      const elements = containerRef.current?.querySelectorAll('.mermaid');
      if (elements) {
        elements.forEach(el => {
          el.removeAttribute('data-processed');
          const pre = el.parentElement;
          if (pre) {
            const code = pre.querySelector('code');
            if (code && code.textContent) {
              el.textContent = code.textContent;
            }
          }
        });
      }
    };
  }, [content]);

  const renderMermaid = useCallback(async () => {
    const abortController = abortControllerRef.current;
    if (!isMountedRef.current || !abortController) return;

    const elements = containerRef.current?.querySelectorAll('.mermaid');
    if (!elements || elements.length === 0) return;

    for (let i = 0; i < elements.length; i++) {
      if (!isMountedRef.current || abortController.signal.aborted) break;

      const element = elements[i] as HTMLElement;
      if (element.getAttribute('data-processed') === 'true') continue;

      const graphDefinition = element.textContent?.trim() || '';
      if (!graphDefinition) continue;

      try {
        const renderId = `mermaid-md-${mermaidId}-${i}-${Date.now()}`;
        const { svg } = await mermaid.render(renderId, graphDefinition);
        
        if (!isMountedRef.current || abortController.signal.aborted) return;
        
        element.innerHTML = svg;
        element.setAttribute('data-processed', 'true');
      } catch (error) {
        if (!isMountedRef.current || abortController.signal.aborted) return;
        console.error('Mermaid render error:', error);
        element.innerHTML = `<div class="text-destructive text-sm">Failed to render diagram</div>`;
      }
    }
    
    if (isMountedRef.current && !abortController.signal.aborted) {
      setMermaidId(prev => prev + elements.length);
    }
  }, [mermaidId]);

  useEffect(() => {
    const timer = setTimeout(renderMermaid, 50);
    return () => clearTimeout(timer);
  }, [renderMermaid]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -1 : 1;
      const newZoom = Math.max(10, Math.min(32, zoom + delta));
      onZoomChange(newZoom);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Zoom controls */}
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
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onZoomChange(16)}
          title="Reset Zoom (Ctrl+0)"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-6"
        onWheel={handleWheel}
        style={{ fontSize: `${zoom}px` }}
      >
        <div
          className={cn('markdown-content', 'break-words')}
          style={{ wordBreak: 'break-word' }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              code(props: any) {
                const { className, children } = props;
                const match = /language-(\w+)/.exec(className || '');
                const isMermaid = match && match[1] === 'mermaid';

                if (isMermaid) {
                  return (
                    <div className="mermaid-container my-4 rounded-lg border bg-card p-4">
                      <div className="mermaid">{String(children).replace(/\n$/, '')}</div>
                    </div>
                  );
                }

                return (
                  <code className={className}>{children}</code>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
