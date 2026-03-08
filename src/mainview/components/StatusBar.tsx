import { FileText, FileCode, Folder } from 'lucide-react';

interface StatusBarProps {
  filePath: string | null;
  fileSize: number | null;
  fileModified: string | null;
  fileType: 'markdown' | 'mermaid' | null;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return '';
  }
}

export function StatusBar({ filePath, fileSize, fileModified, fileType }: StatusBarProps) {
  return (
    <div className="flex h-6 items-center justify-between border-t bg-muted/50 px-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-2 truncate">
        {filePath ? (
          <>
            {fileType === 'markdown' ? (
              <FileText className="h-3 w-3 flex-shrink-0" />
            ) : fileType === 'mermaid' ? (
              <FileCode className="h-3 w-3 flex-shrink-0" />
            ) : (
              <Folder className="h-3 w-3 flex-shrink-0" />
            )}
            <span className="truncate" title={filePath}>
              {filePath}
            </span>
          </>
        ) : (
          <span>No file selected</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {fileSize !== null && <span>{formatFileSize(fileSize)}</span>}
        {fileModified && <span title={formatDate(fileModified)}>Modified: {formatDate(fileModified)}</span>}
      </div>
    </div>
  );
}
