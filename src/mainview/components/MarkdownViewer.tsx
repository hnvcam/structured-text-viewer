import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, ImageOff, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rpc } from '../rpcClient';
import { ExternalLinkPreview } from './ExternalLinkPreview';

interface MarkdownViewerProps {
  content: string;
  filePath: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

// localStorage key for the saved scroll position of a given file.
function scrollKey(filePath: string): string {
  return `scrollPos:${filePath}`;
}

// Protocols the webview can load directly without disk resolution.
function isAbsoluteUrl(src: string): boolean {
  return /^(https?:|data:|blob:|file:)/i.test(src);
}

// Renders a markdown image, resolving relative/disk paths against the markdown
// file's directory via the bun process (which returns a base64 data URL).
function MarkdownImage({
  src,
  alt,
  title,
  markdownPath,
}: {
  src?: string;
  alt?: string;
  title?: string;
  markdownPath: string;
}) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      setFailed(true);
      return;
    }

    if (isAbsoluteUrl(src)) {
      setResolvedSrc(src);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setResolvedSrc(null);
    setFailed(false);

    rpc.request
      .resolveImage({ markdownPath, src })
      .then((res) => {
        if (cancelled) return;
        if (res.dataUrl) setResolvedSrc(res.dataUrl);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [src, markdownPath]);

  if (failed) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive"
        title={src ? `Image not found: ${src}` : 'Image not found'}
      >
        <ImageOff className="h-3.5 w-3.5" />
        {alt || 'image not found'}
      </span>
    );
  }

  if (!resolvedSrc) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
        Loading image…
      </span>
    );
  }

  return <img src={resolvedSrc} alt={alt} title={title} />;
}

export function MarkdownViewer({ content, filePath, zoom, onZoomChange }: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mermaidId, setMermaidId] = useState(0);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // External-link preview overlay state.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Scroll-position persistence. We persist only positions produced by genuine
  // user scrolling — programmatic restores never overwrite the saved value, so
  // layout shifts during restore can't clobber it.
  const userInteractedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smoothly scroll the content container to the top or bottom. These are
  // intentional user navigations, so the resulting position should persist.
  const scrollToTop = useCallback(() => {
    userInteractedRef.current = true;
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    userInteractedRef.current = true;
    const el = containerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  // Restore the saved scroll position for this file. Layout grows as images and
  // mermaid diagrams render, so this is called again once they settle.
  const restoreScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const raw = localStorage.getItem(scrollKey(filePath));
    const saved = raw ? parseInt(raw, 10) : 0;
    if (saved > 0) {
      el.scrollTop = Math.min(saved, el.scrollHeight);
    }
  }, [filePath]);

  // Reset restore state whenever the file changes, then restore after first paint.
  // Re-apply a few times because images and mermaid diagrams grow the page after
  // the initial paint — but stop once the user takes over scrolling.
  useEffect(() => {
    userInteractedRef.current = false;
    const attempt = () => {
      if (!userInteractedRef.current) restoreScroll();
    };
    const raf = requestAnimationFrame(attempt);
    const t1 = window.setTimeout(attempt, 150);
    const t2 = window.setTimeout(attempt, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [filePath, restoreScroll]);

  // Persist scroll position (debounced), but only for user-initiated scrolling.
  const handleScroll = useCallback(() => {
    if (!userInteractedRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const top = el.scrollTop;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(scrollKey(filePath), String(top));
    }, 200);
  }, [filePath]);

  // Handle clicks on rendered markdown links:
  //  - in-page anchors (#slug or self-URL#slug) → smooth scroll to the heading
  //  - http/https → open the in-app preview overlay
  //  - mailto/other → hand off to the system
  const handleLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href?: string) => {
      if (!href) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      const sameDoc =
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname;

      if (href.startsWith('#') || (url.hash && sameDoc)) {
        e.preventDefault();
        const id = decodeURIComponent(url.hash.slice(1));
        const target = id ? document.getElementById(id) : null;
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      if (url.protocol === 'http:' || url.protocol === 'https:') {
        e.preventDefault();
        setPreviewUrl(url.href);
        return;
      }

      if (url.protocol === 'mailto:') {
        e.preventDefault();
        rpc.request.openExternal({ url: href });
        return;
      }

      // Anything else: prevent navigating the app webview away.
      e.preventDefault();
    },
    []
  );

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
    userInteractedRef.current = true;
    if (e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -1 : 1;
      const newZoom = Math.max(10, Math.min(32, zoom + delta));
      onZoomChange(newZoom);
    }
  };

  return (
    <div className="relative flex h-full flex-col">
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

        <div className="mx-1 h-4 w-px bg-border" />

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={scrollToTop}
          title="View Top"
        >
          <ArrowUpToLine className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={scrollToBottom}
          title="View Bottom"
        >
          <ArrowDownToLine className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-6"
        onWheel={handleWheel}
        onScroll={handleScroll}
        onPointerDown={() => { userInteractedRef.current = true; }}
        style={{ fontSize: `${zoom}px` }}
      >
        <div
          className={cn('markdown-content', 'break-words')}
          style={{ wordBreak: 'break-word' }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSlug]}
            components={{
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              a(props: any) {
                const { href, children, node, ...rest } = props;
                void node;
                return (
                  <a
                    {...rest}
                    href={href}
                    onClick={(e) => handleLinkClick(e, href)}
                  >
                    {children}
                  </a>
                );
              },
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              img(props: any) {
                return (
                  <MarkdownImage
                    src={props.src}
                    alt={props.alt}
                    title={props.title}
                    markdownPath={filePath}
                  />
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>

      <ExternalLinkPreview url={previewUrl} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}
