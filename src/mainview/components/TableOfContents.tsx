import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { List } from 'lucide-react';

interface TocHeading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  // Scroll container holding the rendered markdown (headings carry ids from rehype-slug).
  containerRef: React.RefObject<HTMLDivElement | null>;
  // Re-extract whenever the rendered content changes.
  content: string;
}

// Right-side navigation panel listing the document headings. Headings are read
// from the rendered DOM (so the ids match rehype-slug exactly), and the active
// section is tracked with an IntersectionObserver scoped to the scroll container.
export function TableOfContents({ containerRef, content }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Extract headings after the markdown renders. Images/mermaid don't change the
  // heading set, so a single pass after paint (plus a delayed retry) is enough.
  useEffect(() => {
    const extract = () => {
      const el = containerRef.current;
      if (!el) return;
      const nodes = el.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
      const items: TocHeading[] = [];
      nodes.forEach((node) => {
        if (!node.id) return;
        items.push({
          id: node.id,
          text: node.textContent?.trim() || '',
          level: Number(node.tagName[1]),
        });
      });
      setHeadings(items);
    };
    const raf = requestAnimationFrame(extract);
    const t = window.setTimeout(extract, 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [content, containerRef]);

  // Scroll-spy: highlight the heading nearest the top of the viewport.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { root: el, rootMargin: '0px 0px -70% 0px', threshold: 0 }
    );

    headings.forEach((h) => {
      const node = document.getElementById(h.id);
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [headings, containerRef]);

  const handleClick = useCallback((id: string) => {
    const node = document.getElementById(id);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }, []);

  const minLevel = headings.length
    ? Math.min(...headings.map((h) => h.level))
    : 1;

  return (
    <nav className="flex h-full w-64 flex-shrink-0 flex-col border-l bg-card">
      <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b px-3 text-xs font-medium text-muted-foreground">
        <List className="h-4 w-4" />
        On this page
      </div>
      <div className="flex-1 overflow-auto py-2">
        {headings.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            No headings found
          </p>
        ) : (
          <ul className="text-sm">
            {headings.map((h, i) => (
              <li key={`${h.id}-${i}`}>
                <button
                  type="button"
                  onClick={() => handleClick(h.id)}
                  title={h.text}
                  style={{ paddingLeft: `${(h.level - minLevel) * 12 + 12}px` }}
                  className={cn(
                    'block w-full truncate border-l-2 border-transparent py-1 pr-3 text-left text-muted-foreground transition-colors hover:text-foreground',
                    activeId === h.id &&
                      'border-primary font-medium text-foreground'
                  )}
                >
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
