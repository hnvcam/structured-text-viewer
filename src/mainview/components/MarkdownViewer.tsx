import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { remarkAlert } from 'remark-github-blockquote-alert';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, ImageOff, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rpc } from '../rpcClient';
import { TableOfContents } from './TableOfContents';
import { MermaidBlock } from './MermaidBlock';
import { CodeBlock, hastText } from './CodeBlock';
import { RefreshFileButton } from './RefreshFileButton';

interface MarkdownViewerProps {
  content: string;
  filePath: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  tocOpen: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}

// localStorage key for the saved scroll position of a given file.
function scrollKey(filePath: string): string {
  return `scrollPos:${filePath}`;
}

// Schemes never handed to the OS: script/inline content, local files, and the
// app's own internal schemes.
const BLOCKED_SCHEMES = new Set(['javascript', 'vbscript', 'data', 'blob', 'file', 'about', 'views']);

function urlScheme(url: string): string | null {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  return m ? m[1].toLowerCase() : null;
}

// react-markdown's default transform blanks out any scheme it doesn't know
// (vscode:, cursor:, slack:, ...). Keep those so they can be opened by the OS,
// and fall back to the default sanitizer for everything else.
function urlTransform(url: string): string {
  const scheme = urlScheme(url);
  if (scheme && !BLOCKED_SCHEMES.has(scheme)) return url;
  return defaultUrlTransform(url);
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

export function MarkdownViewer({ content, filePath, zoom, onZoomChange, tocOpen, onRefresh, refreshing }: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
  //  - any other non-blocked scheme (http/https, mailto, vscode, ...) → open
  //    with the system default handler (browser, mail client, VS Code, ...)
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

      // Never let a link navigate the app webview itself.
      e.preventDefault();

      const scheme = urlScheme(href);
      if (scheme && !BLOCKED_SCHEMES.has(scheme)) {
        rpc.request.openExternal({ url: href });
      }
    },
    []
  );

  // Memoized so re-renders that don't change the document (zoom, outline
  // toggle, ...) don't rebuild the markdown subtree and remount diagrams.
  const renderedMarkdown = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkAlert]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeSlug]}
        urlTransform={urlTransform}
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
          // Mermaid blocks render as diagrams, not code: drop the <pre> wrapper so
          // its monospace/white-space styling doesn't leak into the diagram.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pre(props: any) {
            const { children, node, ...rest } = props;
            const className = node?.children?.[0]?.properties?.className;
            if (Array.isArray(className) && className.includes('language-mermaid')) {
              return <>{children}</>;
            }
            return (
              <CodeBlock {...rest} code={hastText(node)}>
                {children}
              </CodeBlock>
            );
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code(props: any) {
            const { className, children } = props;
            const match = /language-(\w+)/.exec(className || '');
            const isMermaid = match && match[1] === 'mermaid';

            if (isMermaid) {
              return <MermaidBlock source={String(children).replace(/\n$/, '')} />;
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
    ),
    [content, filePath, handleLinkClick]
  );

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

        <div className="mx-1 h-4 w-px bg-border" />

        <RefreshFileButton onRefresh={onRefresh} refreshing={refreshing} />
      </div>

      {/* Content + table of contents */}
      <div className="flex flex-1 overflow-hidden">
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
          {renderedMarkdown}
        </div>
      </div>
        {tocOpen && <TableOfContents containerRef={containerRef} content={content} />}
      </div>

    </div>
  );
}
