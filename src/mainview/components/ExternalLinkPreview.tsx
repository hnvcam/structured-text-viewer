import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, X } from 'lucide-react';
import { rpc } from '../rpcClient';

interface ExternalLinkPreviewProps {
  /** The initial URL to preview, or null when the overlay is closed. */
  url: string | null;
  onClose: () => void;
}

/**
 * In-app preview of an external (http/https) URL, shown as an overlay over the
 * viewer. Provides a Back button (navigates the overlay's own URL history),
 * the current URL, an "open in system browser" escape hatch, and Close.
 *
 * Note: many sites send X-Frame-Options / CSP frame-ancestors and refuse to be
 * embedded. We cannot reliably detect that from script, so the "open in
 * browser" button is always available as a fallback.
 */
export function ExternalLinkPreview({ url, onClose }: ExternalLinkPreviewProps) {
  // History stack of URLs opened in this overlay session; last entry is current.
  const [history, setHistory] = useState<string[]>([]);
  const prevUrlRef = useRef<string | null>(null);

  // When a new URL is requested, push it onto the stack (resetting on open).
  useEffect(() => {
    if (!url) {
      setHistory([]);
      prevUrlRef.current = null;
      return;
    }
    if (url !== prevUrlRef.current) {
      prevUrlRef.current = url;
      setHistory((prev) => (prev.length === 0 ? [url] : [...prev, url]));
    }
  }, [url]);

  // Esc closes the overlay.
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [url, onClose]);

  if (!url || history.length === 0) return null;

  const currentUrl = history[history.length - 1];

  const handleBack = () => {
    if (history.length > 1) {
      setHistory((prev) => prev.slice(0, -1));
    } else {
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleBack}
          title={history.length > 1 ? 'Back' : 'Close preview'}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div
          className="flex-1 truncate rounded border bg-card px-3 py-1.5 text-xs text-muted-foreground"
          title={currentUrl}
        >
          {currentUrl}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
          onClick={() => rpc.request.openExternal({ url: currentUrl })}
          title="Open in system browser"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Browser
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          title="Close preview"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <iframe
        // Remount on URL change so navigation is clean and predictable.
        key={currentUrl}
        src={currentUrl}
        className="flex-1 border-0 bg-white"
        title="External Link Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
