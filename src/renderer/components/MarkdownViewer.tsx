import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

export function MarkdownViewer({ content, zoom, onZoomChange }: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mermaidId, setMermaidId] = useState(0);

  const renderMermaid = async () => {
    const elements = containerRef.current?.querySelectorAll('.mermaid');
    if (!elements || elements.length === 0) return;

    try {
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLElement;
        if (element.getAttribute('data-processed') === 'true') continue;

        const graphDefinition = element.textContent?.trim() || '';
        if (!graphDefinition) continue;

        try {
          const { svg } = await mermaid.render(`mermaid-${mermaidId}-${i}`, graphDefinition);
          element.innerHTML = svg;
          element.setAttribute('data-processed', 'true');
        } catch (error) {
          console.error('Mermaid render error:', error);
          element.innerHTML = `<div class="text-destructive text-sm">Failed to render diagram</div>`;
        }
      }
      setMermaidId((prev) => prev + elements.length);
    } catch (error) {
      console.error('Mermaid processing error:', error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(renderMermaid, 100);
    return () => clearTimeout(timer);
  }, [content]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
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
