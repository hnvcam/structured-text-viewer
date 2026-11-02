import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyText } from '@/lib/clipboard';

// Concatenate the text content of a hast node (the code block's source).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hastText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  if (Array.isArray(node.children)) return node.children.map(hastText).join('');
  return '';
}

interface CodeBlockProps {
  code: string;
  children: ReactNode;
  // Remaining <pre> attributes from react-markdown.
  [key: string]: unknown;
}

// A fenced code block with a copy-to-clipboard button in its top-right corner.
export function CodeBlock({ code, children, ...rest }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleCopy = async () => {
    const ok = await copyText(code.replace(/\n$/, ''));
    if (!ok) return;
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative">
      <pre {...rest}>{children}</pre>
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy code'}
        aria-label={copied ? 'Copied' : 'Copy code'}
        className={cn(
          'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border',
          'bg-background/80 text-muted-foreground backdrop-blur-sm transition-opacity',
          'hover:bg-accent hover:text-foreground',
          'opacity-60 group-hover:opacity-100 focus-visible:opacity-100',
          copied && 'opacity-100 text-green-600 dark:text-green-400'
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
