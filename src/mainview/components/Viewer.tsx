import { MarkdownViewer } from './MarkdownViewer';
import { MermaidViewer } from './MermaidViewer';
import { SvgViewer } from './SvgViewer';
import { HtmlViewer } from './HtmlViewer';
import { JsonViewer } from './JsonViewer';
import type { FileType } from '@/types';
import { FileText, AlertCircle } from 'lucide-react';

interface ViewerProps {
  filePath: string | null;
  fileType: FileType;
  content: string | null;
  error: string | null;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  tocOpen: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}

export function Viewer({ filePath, fileType, content, error, zoom, onZoomChange, tocOpen, onRefresh, refreshing }: ViewerProps) {
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="h-16 w-16 text-destructive" />
        <div>
          <h2 className="text-lg font-semibold">Error Loading File</h2>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!filePath || !content) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <FileText className="h-24 w-24 opacity-20" />
        <div className="text-center">
          <h2 className="text-lg font-medium">No File Selected</h2>
          <p className="mt-1 text-sm">Select a Markdown, Mermaid, SVG, HTML, or JSON file from the sidebar to view its content</p>
        </div>
      </div>
    );
  }

  // Use unique key based on file path to force complete remount when switching files
  const viewerKey = filePath;

  if (fileType === 'mermaid') {
    return (
      <div key={viewerKey} className="h-full">
        <MermaidViewer content={content} onRefresh={onRefresh} refreshing={refreshing} />
      </div>
    );
  }

  if (fileType === 'svg') {
    return (
      <div key={viewerKey} className="h-full">
        <SvgViewer content={content} onRefresh={onRefresh} refreshing={refreshing} />
      </div>
    );
  }

  if (fileType === 'html') {
    return (
      <div key={viewerKey} className="h-full">
        <HtmlViewer content={content} onRefresh={onRefresh} refreshing={refreshing} />
      </div>
    );
  }

  if (fileType === 'json') {
    return (
      <div key={viewerKey} className="h-full">
        <JsonViewer
          content={content}
          zoom={zoom}
          onZoomChange={onZoomChange}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      </div>
    );
  }

  return (
    <div key={viewerKey} className="h-full">
      <MarkdownViewer
        content={content}
        filePath={filePath}
        zoom={zoom}
        onZoomChange={onZoomChange}
        tocOpen={tocOpen}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
    </div>
  );
}
