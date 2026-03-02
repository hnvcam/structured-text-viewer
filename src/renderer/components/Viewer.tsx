import { MarkdownViewer } from './MarkdownViewer';
import { MermaidViewer } from './MermaidViewer';
import { FileText, AlertCircle } from 'lucide-react';

interface ViewerProps {
  filePath: string | null;
  fileType: 'markdown' | 'mermaid' | null;
  content: string | null;
  error: string | null;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function Viewer({ filePath, fileType, content, error, zoom, onZoomChange }: ViewerProps) {
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
          <p className="mt-1 text-sm">Select a Markdown or Mermaid file from the sidebar to view its content</p>
        </div>
      </div>
    );
  }

  if (fileType === 'mermaid') {
    return <MermaidViewer content={content} />;
  }

  return (
    <MarkdownViewer
      content={content}
      zoom={zoom}
      onZoomChange={onZoomChange}
    />
  );
}
